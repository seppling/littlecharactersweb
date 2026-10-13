/**
 * Staff adjustments on a family's monthly payments (see src/lib/adjustments.ts
 * for the math, and docs/staff-billing.md for how Hannah uses them).
 *
 * An adjustment belongs to one order (one family's class) and lowers its unpaid
 * monthly payments: the next one only ('once'), or every one left ('monthly').
 * Each payment keeps its starting amount (baseAmountCents); amountCents, which
 * is what autopay and the pay-now form charge, is recomputed from the starting
 * amount and the adjustments still in force, so removing one restores the
 * payments it lowered.
 *
 * Which payments can change:
 *  - scheduled: yes;
 *  - failed: yes, unless the family opened the pay-now form recently (Stripe's
 *    form has the old amount for up to an hour). The next retry, or the next
 *    form they open, uses the new amount;
 *  - processing (being charged), paid, cancelled: never.
 * A payment that couldn't change when staff saved (say the family had the
 * pay-now form open) catches up at the next billing run, before it's charged.
 *
 * Staff only: every change re-checks isAdmin() here as well as on the page, and
 * is written to the audit log.
 */
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { getDb, schema, type DB } from './db';
import { audit } from './records';
import { isAdmin } from './auth';
import { ADJUSTMENTS, applyAdjustments, familyLabel, type AdjustmentKind, type AdjustmentRepeat, type AdjustmentRule, type AppliedAdjustment } from '@/lib/adjustments';

const { installment, billingAdjustment, order, household, user } = schema;

type Installment = typeof installment.$inferSelect;
export type Adjustment = typeof billingAdjustment.$inferSelect;
type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

export type StaffUser = { id: string; email: string; emailVerified: boolean };

export const PAY_NOW_LOCK_MINUTES = 120;

/** A message staff can read and act on. */
export class AdjustmentError extends Error {}

function requireStaff(staff: StaffUser | null | undefined): asserts staff is StaffUser {
  if (!isAdmin(staff)) throw new AdjustmentError('Only staff can change a family’s payments.');
}

/** Why this payment can't be changed right now, or null when it can. */
export function lockedReason(i: Pick<Installment, 'status' | 'payNowOpenedAt'>, now = new Date()): string | null {
  switch (i.status) {
    case 'scheduled':
      return null;
    case 'failed':
      return i.payNowOpenedAt && now.getTime() - i.payNowOpenedAt.getTime() < PAY_NOW_LOCK_MINUTES * 60_000 ? 'the family opened the pay-now form in the last 2 hours' : null;
    case 'processing':
      return 'it’s being charged right now';
    case 'paid':
      return 'it’s paid';
    case 'cancelled':
      return 'it was cancelled';
  }
}

const toRule = (a: Adjustment): AdjustmentRule => ({ id: a.id, kind: a.kind, value: a.value, label: familyLabel(a.reason, a.showToFamily) });

export type PaymentChange = {
  installmentId: string;
  dueDate: string;
  label: string;
  beforeCents: number;
  afterCents: number;
  lines: AppliedAdjustment[];
};

/**
 * What each changeable payment should be under these adjustments. Pure: used
 * both to save and to preview. Adjustments apply in the order they were added.
 */
export function computeChanges(installments: Installment[], adjustments: Adjustment[], now = new Date()): PaymentChange[] {
  const active = adjustments.filter((a) => !a.removedAt).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const out: PaymentChange[] = [];
  for (const i of installments) {
    if (lockedReason(i, now)) continue;
    const rules = active.filter((a) => a.repeat === 'monthly' || a.installmentId === i.id).map(toRule);
    const next = applyAdjustments(i.baseAmountCents, rules);
    if (next.amountCents === i.amountCents && JSON.stringify(next.lines) === JSON.stringify(i.adjustments)) continue;
    out.push({ installmentId: i.id, dueDate: i.dueDate, label: i.label, beforeCents: i.amountCents, afterCents: next.amountCents, lines: next.lines });
  }
  return out;
}

/** Re-apply an order's adjustments to its changeable payments, inside a transaction. */
async function reapply(tx: Tx, orderId: string, now: Date) {
  // Lock the order's payments, so the billing run can't claim one mid-change.
  const rows = await tx.select().from(installment).where(eq(installment.orderId, orderId)).orderBy(asc(installment.dueDate)).for('update');
  const adjustments = await tx.select().from(billingAdjustment).where(eq(billingAdjustment.orderId, orderId));
  const changes = computeChanges(rows, adjustments, now);
  const settled: string[] = [];
  for (const c of changes) {
    const i = rows.find((r) => r.id === c.installmentId)!;
    // A failed month that now costs nothing is settled: there's nothing to retry.
    const settle = i.status === 'failed' && c.afterCents + i.lateFeeCents === 0;
    await tx
      .update(installment)
      .set({
        amountCents: c.afterCents,
        adjustments: c.lines,
        ...(settle ? { status: 'paid' as const, paidAt: now, retryOn: null, lastError: 'covered by a staff adjustment' } : {}),
      })
      .where(and(eq(installment.id, i.id), eq(installment.status, i.status)));
    if (settle) settled.push(i.id);
  }
  return { changes, settled };
}

async function logSettled(staffId: string | null, ids: string[]) {
  for (const id of ids) await audit(staffId, 'installment.paid_by_adjustment', 'installment', id);
}

export type AdjustmentInput = {
  orderId: string;
  kind: AdjustmentKind;
  value: number;
  repeat: AdjustmentRepeat;
  reason: string;
  showToFamily: boolean;
};

function checkInput(input: AdjustmentInput) {
  const reason = input.reason.trim();
  if (!reason) throw new AdjustmentError('Write a reason (for example “scholarship” or “credit for a missed class”).');
  if (reason.length > ADJUSTMENTS.maxReasonLength) throw new AdjustmentError(`Keep the reason under ${ADJUSTMENTS.maxReasonLength} characters.`);
  if (!['percent', 'amount'].includes(input.kind) || !['once', 'monthly'].includes(input.repeat)) throw new AdjustmentError('Pick a kind of discount and how often.');
  const ok = Number.isInteger(input.value) && (input.kind === 'percent' ? input.value >= 1 && input.value <= 100 : input.value >= 1 && input.value <= ADJUSTMENTS.maxAmountCents);
  if (!ok) throw new AdjustmentError(input.kind === 'percent' ? 'Enter a percentage from 1 to 100.' : 'Enter a dollar amount, like 40 or 12.50.');
  return { ...input, reason };
}

/** The new adjustment as it would be saved: checks, and picks the payment a 'once' applies to. */
function draft(rows: Installment[], existing: Adjustment[], staff: StaffUser, input: AdjustmentInput, now: Date): Adjustment {
  const changeable = rows.filter((i) => !lockedReason(i, now));
  if (!changeable.length) throw new AdjustmentError('This family has no upcoming payment that can be changed right now.');
  return {
    id: crypto.randomUUID(),
    householdId: rows[0].householdId,
    orderId: input.orderId,
    kind: input.kind,
    value: input.value,
    repeat: input.repeat,
    installmentId: input.repeat === 'once' ? changeable[0].id : null,
    reason: input.reason,
    showToFamily: input.showToFamily,
    createdBy: staff.id,
    // Always after the ones already there, so "the order they were added" is never a tie.
    createdAt: new Date(Math.max(now.getTime(), ...existing.map((a) => a.createdAt.getTime() + 1))),
    removedAt: null,
    removedBy: null,
  };
}

/** What saving this adjustment would change, without saving it (the confirm step). */
export async function previewAdjustment(staff: StaffUser, raw: AdjustmentInput, now = new Date()) {
  requireStaff(staff);
  const input = checkInput(raw);
  const db = await getDb();
  const rows = await db.select().from(installment).where(eq(installment.orderId, input.orderId)).orderBy(asc(installment.dueDate));
  const existing = await db.select().from(billingAdjustment).where(eq(billingAdjustment.orderId, input.orderId));
  const a = draft(rows, existing, staff, input, now);
  return { input, changes: computeChanges(rows, [...existing, a], now) };
}

export async function addAdjustment(staff: StaffUser, raw: AdjustmentInput, now = new Date()) {
  requireStaff(staff);
  const input = checkInput(raw);
  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(order).where(eq(order.id, input.orderId));
    if (!o || o.status !== 'paid') throw new AdjustmentError('That enrollment isn’t paid and active.');
    const rows = await tx.select().from(installment).where(eq(installment.orderId, o.id)).orderBy(asc(installment.dueDate)).for('update');
    const existing = await tx.select().from(billingAdjustment).where(eq(billingAdjustment.orderId, o.id));
    const [a] = await tx.insert(billingAdjustment).values(draft(rows, existing, staff, input, now)).returning();
    return { adjustment: a, ...(await reapply(tx, o.id, now)) };
  });
  await audit(staff.id, 'adjustment.add', 'billing_adjustment', result.adjustment.id);
  await logSettled(staff.id, result.settled);
  return result;
}

/** Remove an adjustment: the payments it lowered that are still unpaid go back up. */
export async function removeAdjustment(staff: StaffUser, adjustmentId: string, now = new Date()) {
  requireStaff(staff);
  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const [a] = await tx
      .update(billingAdjustment)
      .set({ removedAt: now, removedBy: staff.id })
      .where(and(eq(billingAdjustment.id, adjustmentId), isNull(billingAdjustment.removedAt)))
      .returning();
    if (!a) return null;
    return { adjustment: a, ...(await reapply(tx, a.orderId, now)) };
  });
  if (!result) return null;
  await audit(staff.id, 'adjustment.remove', 'billing_adjustment', adjustmentId);
  await logSettled(staff.id, result.settled);
  return result;
}

/**
 * Billing run: bring payments that couldn't change earlier (the pay-now form
 * was open, or a charge was in progress and then failed) up to date before
 * anything is charged.
 */
export async function reapplyPendingAdjustments(now = new Date()) {
  const db = await getDb();
  const orders = await db
    .selectDistinct({ orderId: billingAdjustment.orderId })
    .from(billingAdjustment)
    .innerJoin(installment, eq(installment.orderId, billingAdjustment.orderId))
    .where(inArray(installment.status, ['scheduled', 'failed']));
  let changed = 0;
  for (const { orderId } of orders) {
    const r = await db.transaction((tx) => reapply(tx, orderId, now));
    changed += r.changes.length;
    await logSettled(null, r.settled);
  }
  return changed;
}

// ───────────── Staff views ─────────────

/** Everything the family billing page shows: the payments and every adjustment, removed ones included. */
export async function orderBilling(orderId: string) {
  const db = await getDb();
  const [o] = await db.select({ order, family: household.name }).from(order).innerJoin(household, eq(household.id, order.householdId)).where(eq(order.id, orderId));
  if (!o) return null;
  const installments = await db.select().from(installment).where(eq(installment.orderId, orderId)).orderBy(asc(installment.dueDate));
  const adjustments = await db.select().from(billingAdjustment).where(eq(billingAdjustment.orderId, orderId)).orderBy(asc(billingAdjustment.createdAt));
  const people = [...new Set(adjustments.flatMap((a) => [a.createdBy, a.removedBy]).filter((x): x is string => !!x))];
  const names = new Map(
    (people.length ? await db.select({ id: user.id, name: user.name, email: user.email }).from(user).where(inArray(user.id, people)) : []).map((u) => [u.id, u.name || u.email]),
  );
  return {
    order: o.order,
    family: o.family,
    installments,
    adjustments: adjustments.map((a) => ({
      ...a,
      familyLabel: familyLabel(a.reason, a.showToFamily),
      createdByName: a.createdBy ? (names.get(a.createdBy) ?? 'staff') : 'staff',
      removedByName: a.removedBy ? (names.get(a.removedBy) ?? 'staff') : null,
      affects: installments.flatMap((i) => i.adjustments.filter((l) => l.adjustmentId === a.id).map((l) => ({ installment: i, cents: l.cents }))),
    })),
  };
}

/** Families with monthly payments still to come, for the list on /admin/billing. */
export async function ordersWithUpcomingPayments() {
  const db = await getDb();
  const rows = await db
    .select({ orderId: installment.orderId, sessionId: installment.sessionId, family: household.name, status: installment.status, amountCents: installment.amountCents, baseAmountCents: installment.baseAmountCents })
    .from(installment)
    .innerJoin(household, eq(household.id, installment.householdId))
    .where(inArray(installment.status, ['scheduled', 'processing', 'failed']))
    .orderBy(asc(household.name), asc(installment.dueDate));
  const out = new Map<string, { orderId: string; sessionId: string; family: string; remaining: number; adjusted: number }>();
  for (const r of rows) {
    const e = out.get(r.orderId) ?? { orderId: r.orderId, sessionId: r.sessionId, family: r.family, remaining: 0, adjusted: 0 };
    e.remaining++;
    if (r.amountCents !== r.baseAmountCents) e.adjusted++;
    out.set(r.orderId, e);
  }
  return [...out.values()];
}
