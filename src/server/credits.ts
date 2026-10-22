/**
 * Credits (docs/back-office.md → Refunds, credits and statements): money a
 * family is owed that comes off their next payment, instead of a refund.
 * Owners only, after a fresh sign-in (the pages).
 *
 *  - Applied through the existing adjustments (adjustments.ts →
 *    insertAdjustments): a one-time amount on the family's next payment that
 *    can change, across their orders, earliest due date first. The credit row
 *    keeps `adjustment_id`, `applied_to_installment_id` and `applied_at`.
 *  - More than that payment: what fits is applied, and the rest becomes a new
 *    credit row ("Rest of the credit from Oct 19"), applied to the next
 *    payment that can change.
 *  - No payment that can change: the credit waits. applyWaitingCredits()
 *    applies waiting credits; it runs when a new sign-up's monthly payments
 *    are made (family.ts → fulfillOrder) and at the start of the daily
 *    billing run, before anything is charged.
 *  - A credit on a payment that was then cancelled (Stop payments) goes back
 *    to waiting; one that a family-discount change made too big for its
 *    payment keeps what still fits and the rest waits.
 *  - Removing: a waiting credit, or one on a payment not paid yet (its
 *    adjustment is removed, as removing a discount does). Paid ones stay.
 *
 * No catalog imports: the billing script runs this outside Astro.
 */
import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';
import { formatCents } from '@/lib/pricing';
import { insertAdjustments, lockedReason, logSettled, reapply, type StaffUser } from './adjustments';
import { getDb, schema, type DB } from './db';
import { audit } from './records';
import { isOwner } from './staff';

const { credit, installment, billingAdjustment, user } = schema;

export type Credit = typeof credit.$inferSelect;
type Installment = typeof installment.$inferSelect;
type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

export const CREDITS = {
  reasonMax: 100,
  maxCents: 1_000_000,
};

/** A message staff can read and act on. */
export class CreditError extends Error {}

/** What families read on the payment: "Credit · Day off Dec 8 (Thanksgiving): −$19", or "Credit: −$19" when the reason is for staff. */
export const creditLabel = (c: Pick<Credit, 'reason' | 'showToFamily'>) => (c.showToFamily && c.reason.trim() ? `Credit · ${c.reason.trim()}` : 'Credit');

/** "Rest of the credit from Oct 19" */
export const restReason = (from: Date) => `Rest of the credit from ${from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}`;

// ───────────── Which payment it comes off ─────────────

/** One payment a credit lowers. */
export interface CreditPiece {
  installmentId: string;
  orderId: string;
  sessionId: string;
  dueDate: string;
  label: string;
  /** Taken off this payment. */
  cents: number;
  beforeCents: number;
  afterCents: number;
}

/** A family's payments a credit can come off now: scheduled or failed, not locked, more than $0; earliest due date first, across their orders. */
export function creditTargets(installments: Installment[], now = new Date()) {
  return installments
    .filter((i) => (i.status === 'scheduled' || i.status === 'failed') && !lockedReason(i, now) && i.amountCents > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.orderId.localeCompare(b.orderId) || a.id.localeCompare(b.id));
}

/**
 * Pure: where a credit goes. Each payment takes what fits; what's left waits.
 * A payment left under 50¢ isn't charged (adjustments.ts takes the rest off,
 * as it does for any discount), so its after-amount is $0.
 */
export function planCredit(amountCents: number, targets: Installment[]): { pieces: CreditPiece[]; waitingCents: number } {
  let left = amountCents;
  const pieces: CreditPiece[] = [];
  for (const i of targets) {
    if (left <= 0) break;
    const cents = Math.min(left, i.amountCents);
    const rest = i.amountCents - cents;
    pieces.push({ installmentId: i.id, orderId: i.orderId, sessionId: i.sessionId, dueDate: i.dueDate, label: i.label, cents, beforeCents: i.amountCents, afterCents: rest > 0 && rest < 50 ? 0 : rest });
    left -= cents;
  }
  return { pieces, waitingCents: left };
}

// ───────────── Applying ─────────────

const asStaff = (c: Pick<Credit, 'createdBy'>): StaffUser => ({ id: c.createdBy as string, email: '', emailVerified: true });

/**
 * Apply one waiting credit inside the caller's transaction: to the first
 * payment that can change; any rest becomes a new credit and goes to the next.
 * Returns the credits applied (the rest rows too) and payments it settled.
 */
async function applyCreditTx(tx: Tx, c: Credit, now: Date): Promise<{ applied: Credit[]; created: Credit[]; settled: string[] }> {
  const out = { applied: [] as Credit[], created: [] as Credit[], settled: [] as string[] };
  let current: Credit | null = c;
  while (current) {
    const rows = await tx.select().from(installment).where(eq(installment.householdId, current.householdId)).orderBy(asc(installment.dueDate)).for('update');
    const target = creditTargets(rows, now)[0];
    if (!target) break;
    const fits = Math.min(current.amountCents, target.amountCents);
    const saved = await insertAdjustments(
      tx,
      asStaff(current),
      [{ orderId: target.orderId, kind: 'amount', value: fits, repeat: 'once', installmentId: target.id, reason: creditLabel(current), showToFamily: true }],
      now,
    );
    out.settled.push(...saved.settled);
    let rest: Credit | null = null;
    if (fits < current.amountCents) {
      [rest] = await tx
        .insert(credit)
        .values({ householdId: current.householdId, amountCents: current.amountCents - fits, reason: restReason(current.createdAt), showToFamily: current.showToFamily, createdBy: current.createdBy, createdAt: now })
        .returning();
      out.created.push(rest);
    }
    const [done] = await tx
      .update(credit)
      .set({ amountCents: fits, adjustmentId: saved.adjustments[0].id, appliedToInstallmentId: target.id, appliedAt: now })
      .where(eq(credit.id, current.id))
      .returning();
    out.applied.push(done);
    current = rest;
  }
  return out;
}

async function logApplied(staffId: string | null, r: { applied: Credit[]; created: Credit[]; settled: string[] }) {
  for (const c of r.created) await audit(staffId, 'credit.rest', 'credit', c.id);
  for (const c of r.applied) await audit(staffId, 'credit.applied', 'credit', c.id, c.appliedToInstallmentId ?? undefined);
  await logSettled(staffId, r.settled);
}

/**
 * Put credits back to waiting when the payment they were on was cancelled
 * (Stop payments, Remove and stop payments) or is gone, and keep only what
 * still fits when a payment shrank under one (the family discount started).
 */
async function reconcile(householdId: string | undefined, now: Date) {
  const db = await getDb();
  const applied = await db
    .select({ c: credit, i: installment })
    .from(credit)
    .leftJoin(installment, eq(installment.id, credit.appliedToInstallmentId))
    .where(and(isNotNull(credit.appliedAt), isNull(credit.removedAt), householdId ? eq(credit.householdId, householdId) : undefined));
  let changed = 0;
  for (const { c, i } of applied) {
    if (i && i.status !== 'cancelled' && i.status !== 'scheduled' && i.status !== 'failed') continue;
    const line = i?.adjustments.find((l) => l.adjustmentId === c.adjustmentId)?.cents ?? 0;
    const gone = !i || i.status === 'cancelled';
    if (!gone && line >= c.amountCents) continue;
    // Locked for now (the pay-now form is open): leave it until it can change.
    if (i && !gone && lockedReason(i, now)) continue;
    await db.transaction(async (tx) => {
      // Unchanged since it was read: two runs at once (the billing run and a sign-up) put back or split it once.
      const [locked] = await tx
        .select()
        .from(credit)
        .where(and(eq(credit.id, c.id), isNotNull(credit.appliedAt), isNull(credit.removedAt), eq(credit.amountCents, c.amountCents)))
        .for('update');
      if (!locked) return;
      if (gone || line <= 0) {
        // Back to waiting: the adjustment is taken off (it does nothing on a cancelled payment).
        if (c.adjustmentId) await tx.update(billingAdjustment).set({ removedAt: now }).where(and(eq(billingAdjustment.id, c.adjustmentId), isNull(billingAdjustment.removedAt)));
        if (i && !gone && c.adjustmentId) await reapply(tx, i.orderId, now);
        await tx.update(credit).set({ appliedAt: null, appliedToInstallmentId: null, adjustmentId: null }).where(eq(credit.id, c.id));
      } else {
        // Shrunk: keep what's on the payment; the rest waits as its own credit.
        if (c.adjustmentId) await tx.update(billingAdjustment).set({ value: line }).where(eq(billingAdjustment.id, c.adjustmentId));
        await tx.update(credit).set({ amountCents: line }).where(eq(credit.id, c.id));
        await tx.insert(credit).values({ householdId: c.householdId, amountCents: c.amountCents - line, reason: restReason(c.createdAt), showToFamily: c.showToFamily, createdBy: c.createdBy, createdAt: now });
      }
    });
    await audit(null, 'credit.returned', 'credit', c.id, gone ? 'payment cancelled' : `kept ${formatCents(line)}`);
    changed++;
  }
  return changed;
}

/**
 * Apply every waiting credit that has a payment to come off (one family's, or
 * everyone's). Called when a sign-up makes new monthly payments, and at the
 * start of the billing run, before anything is charged. Returns how many
 * credits were applied (rest rows included).
 */
export async function applyWaitingCredits(householdId?: string, now = new Date()) {
  const db = await getDb();
  await reconcile(householdId, now);
  const waiting = await db
    .select()
    .from(credit)
    .where(and(isNull(credit.appliedAt), isNull(credit.removedAt), householdId ? eq(credit.householdId, householdId) : undefined))
    .orderBy(asc(credit.createdAt), asc(credit.id));
  let applied = 0;
  for (const c of waiting) {
    const r = await db.transaction(async (tx) => {
      const [locked] = await tx.select().from(credit).where(and(eq(credit.id, c.id), isNull(credit.appliedAt), isNull(credit.removedAt))).for('update');
      return locked ? applyCreditTx(tx, locked, now) : null;
    });
    if (!r) continue;
    await logApplied(null, r);
    applied += r.applied.length;
  }
  return applied;
}

// ───────────── Staff: add, preview, remove ─────────────

export interface CreditInput {
  householdId: string;
  amountCents: number;
  reason: string;
  showToFamily: boolean;
}

export function checkCredit(input: CreditInput) {
  const reason = input.reason.trim();
  if (!reason) throw new CreditError('Write a reason, like “Day off Dec 8” or “Missed class”.');
  if (reason.length > CREDITS.reasonMax) throw new CreditError(`Keep the reason under ${CREDITS.reasonMax} characters.`);
  if (!Number.isInteger(input.amountCents) || input.amountCents < 1 || input.amountCents > CREDITS.maxCents) throw new CreditError('Enter an amount, like 19 or 12.50.');
  return { ...input, reason };
}

async function requireOwner(staff: StaffUser) {
  if (!(await isOwner(staff))) throw new CreditError('Only owners can give credits.');
}

/** Before saving: the payments it would come off, and what would wait. */
export async function previewCredit(staff: StaffUser, raw: CreditInput, now = new Date()) {
  await requireOwner(staff);
  const input = checkCredit(raw);
  const db = await getDb();
  const rows = await db.select().from(installment).where(eq(installment.householdId, input.householdId)).orderBy(asc(installment.dueDate));
  return { input, ...planCredit(input.amountCents, creditTargets(rows, now)) };
}

/** Save a credit and apply it at once where it can be. */
export async function addCredit(staff: StaffUser, raw: CreditInput, opts: { now?: Date; id?: string; detail?: string } = {}) {
  await requireOwner(staff);
  const input = checkCredit(raw);
  const now = opts.now ?? new Date();
  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const [c] = await tx
      .insert(credit)
      .values({ ...(opts.id ? { id: opts.id } : {}), householdId: input.householdId, amountCents: input.amountCents, reason: input.reason, showToFamily: input.showToFamily, createdBy: staff.id, createdAt: now })
      .onConflictDoNothing()
      .returning();
    if (!c) return null;
    return { credit: c, ...(await applyCreditTx(tx, c, now)) };
  });
  if (!result) return null;
  await audit(staff.id, 'admin.credit.add', 'credit', result.credit.id, opts.detail ?? formatCents(input.amountCents));
  await logApplied(staff.id, result);
  return result;
}

/** Take a credit back: waiting, or on a payment not paid yet. Paid ones stay. */
export async function removeCredit(staff: StaffUser, householdId: string, creditId: string, now = new Date()) {
  await requireOwner(staff);
  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const [c] = await tx
      .select()
      .from(credit)
      .where(and(eq(credit.id, creditId), eq(credit.householdId, householdId)))
      .for('update');
    if (!c || c.removedAt) throw new CreditError('That credit was already removed.');
    let settled: string[] = [];
    if (c.appliedAt && c.appliedToInstallmentId) {
      const [i] = await tx.select().from(installment).where(eq(installment.id, c.appliedToInstallmentId));
      if (i?.status === 'paid') throw new CreditError('That credit already came off a payment that’s paid, so it stays.');
      if (i?.status === 'processing') throw new CreditError('That payment is being charged right now. Try again in a few minutes.');
      if (i && lockedReason(i, now)) throw new CreditError('The family has the pay-now form open. Try again in two hours.');
      if (c.adjustmentId) {
        await tx.update(billingAdjustment).set({ removedAt: now, removedBy: staff.id }).where(and(eq(billingAdjustment.id, c.adjustmentId), isNull(billingAdjustment.removedAt)));
        if (i) settled = (await reapply(tx, i.orderId, now)).settled;
      }
    }
    const [done] = await tx.update(credit).set({ removedAt: now, removedBy: staff.id }).where(eq(credit.id, c.id)).returning();
    return { credit: done, settled };
  });
  await audit(staff.id, 'admin.credit.remove', 'credit', creditId);
  await logSettled(staff.id, result.settled);
  return result.credit;
}

// ───────────── Lists ─────────────

export type CreditState = 'waiting' | 'applied' | 'used' | 'removed';

export interface CreditRow extends Credit {
  state: CreditState;
  /** The payment it comes off (or came off). */
  payment: Pick<Installment, 'id' | 'dueDate' | 'label' | 'status' | 'orderId'> | null;
  createdByName: string;
  removedByName: string | null;
}

export const creditState = (c: Pick<Credit, 'removedAt' | 'appliedAt'>, paymentStatus: Installment['status'] | null | undefined): CreditState =>
  c.removedAt ? 'removed' : !c.appliedAt ? 'waiting' : paymentStatus === 'paid' ? 'used' : 'applied';

/** A family's credits, newest first, removed ones too. */
export async function familyCredits(householdId: string): Promise<CreditRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ c: credit, i: { id: installment.id, dueDate: installment.dueDate, label: installment.label, status: installment.status, orderId: installment.orderId } })
    .from(credit)
    .leftJoin(installment, eq(installment.id, credit.appliedToInstallmentId))
    .where(eq(credit.householdId, householdId))
    .orderBy(asc(credit.createdAt), asc(credit.id));
  const people = [...new Set(rows.flatMap((r) => [r.c.createdBy, r.c.removedBy]).filter((x): x is string => !!x))];
  const names = new Map(people.length ? (await db.select({ id: user.id, name: user.name, email: user.email }).from(user).where(inArray(user.id, people))).map((u) => [u.id, u.name || u.email]) : []);
  return rows
    .map(({ c, i }) => ({
      ...c,
      state: creditState(c, i?.status),
      payment: i?.id ? i : null,
      createdByName: c.createdBy ? (names.get(c.createdBy) ?? 'staff') : 'staff',
      removedByName: c.removedBy ? (names.get(c.removedBy) ?? 'staff') : null,
    }))
    .reverse();
}

/** "Waiting for the next payment", "Comes off the Dec 1 payment", "Came off the Dec 1 payment", "Removed". */
export function creditStatus(c: Pick<CreditRow, 'state' | 'payment'>) {
  const day = c.payment ? new Date(`${c.payment.dueDate}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
  switch (c.state) {
    case 'waiting':
      return 'Waiting for the next payment';
    case 'applied':
      return `Comes off the ${day} payment`;
    case 'used':
      return `Came off the ${day} payment`;
    case 'removed':
      return 'Removed';
  }
}
