/**
 * The 15% family discount, applied to the whole family (decided Oct 13, 2026).
 *
 * Once a family has two or more active weekly-class enrollments, every monthly
 * payment for their weekly classes that can still change is 15% off, whatever
 * order the children signed up in. When they drop back below two (a class
 * ends, or staff stop a child's payments), those payments go back to the
 * regular price.
 *
 * What counts: enrollments that are active (not a free trial or the waitlist),
 * in a weekly class with a monthly price (`program.kind === 'class'` and the
 * price is per month; decided Oct 13: drop-in nights like Geode Adult Improv
 * and classes priced by the session don't count), whose class hasn't ended,
 * and whose payments staff haven't stopped. A season paid in full counts, but
 * has no monthly payments to change. Camps, workshops, parties, Parents' Night
 * Out and Ovation never count.
 *
 * When the discount ends and payments go back up, the family gets an email
 * listing the new amounts (emailFamilyDiscountEnded).
 *
 * Each payment keeps its regular price (regularAmountCents, fixed at checkout).
 * Its starting amount (baseAmountCents) is the regular price, less 15% when the
 * family qualifies. Staff adjustments are then re-applied to it, so amountCents
 * is always what's charged. The 10% pay-in-full discount never combines with it.
 *
 * Which payments change: the same as for staff adjustments (lockedReason in
 * adjustments.ts). Scheduled ones; failed ones unless the family opened the
 * pay-now form in the last 2 hours; never one being charged, paid or
 * cancelled. The daily billing run catches up anything skipped, before
 * charging it.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { getDb, schema, type DB } from './db';
import { getCatalog } from './content';
import { audit, householdGuardians } from './records';
import { emailHtml, sendEmail } from './email';
import { config } from './env';
import { computeChanges, lockedReason } from './adjustments';
import { familyDiscounted, formatCents, todayInAthens } from '@/lib/pricing';
import type { AppliedAdjustment } from '@/lib/adjustments';
import type { SiteContent } from '@/content/site-content';

const { enrollment, installment, billingAdjustment, order, student } = schema;

type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
type Q = DB | Tx;
type Catalog = Pick<SiteContent, 'findSession'>;
type Installment = typeof installment.$inferSelect;
type Enrollment = typeof enrollment.$inferSelect;

export const FAMILY_DISCOUNT = {
  /** Active weekly-class enrollments a family needs for the discount. */
  minEnrollments: 2,
};

export type FamilyDiscountOptions = {
  /** The live catalog. Read it before opening a transaction (PGlite has one connection). */
  catalog: Catalog;
  now?: Date;
  /** YYYY-MM-DD in Athens: classes that ended before this day don't count. */
  today?: string;
};

/** One payment the family discount changes (or would change). */
export type FamilyDiscountChange = {
  installmentId: string;
  orderId: string;
  dueDate: string;
  label: string;
  beforeBaseCents: number;
  afterBaseCents: number;
  /** What's charged, before and after (staff adjustments included). */
  beforeCents: number;
  afterCents: number;
  lines: AppliedAdjustment[];
};

/** A weekly class priced by the month, whose last day is today or later. */
function isCurrentWeeklyClass(catalog: Catalog, sessionId: string, today: string) {
  const found = catalog.findSession(sessionId);
  if (!found || found.program.kind !== 'class' || found.session.endDate < today) return false;
  return (found.session.price ?? found.program.priceFrom)?.unit === 'month';
}

/** Orders whose remaining payments staff stopped (Stop payments cancels them; nothing else does). */
async function stoppedOrders(q: Q, householdId: string) {
  const rows = await q
    .selectDistinct({ orderId: installment.orderId })
    .from(installment)
    .where(and(eq(installment.householdId, householdId), eq(installment.status, 'cancelled')));
  return new Set(rows.map((r) => r.orderId));
}

/**
 * The family's enrollments that count toward the discount. `skip` leaves some
 * out (checkout: the children in the order being priced).
 */
export async function countingEnrollments(q: Q, householdId: string, opts: { catalog: Catalog; today: string; skip?: (e: Enrollment) => boolean }) {
  const rows = await q
    .select()
    .from(enrollment)
    .where(and(eq(enrollment.householdId, householdId), eq(enrollment.status, 'active')));
  const stopped = await stoppedOrders(q, householdId);
  return rows.filter((e) => isCurrentWeeklyClass(opts.catalog, e.sessionId, opts.today) && !(e.orderId && stopped.has(e.orderId)) && !opts.skip?.(e));
}

/**
 * What the family discount should do to the family's payments. Pure planning:
 * used to refresh (with the rows locked) and to preview.
 *  - `adding`: enrollments about to start (the review page's preview);
 *  - `stopping`: an order whose payments are about to be stopped. It no longer
 *    counts, and its own payments are left alone (they're being cancelled).
 */
async function plan(q: Q, householdId: string, opts: Required<FamilyDiscountOptions> & { adding?: number; stopping?: string; lock?: boolean }) {
  const counted = await countingEnrollments(q, householdId, { catalog: opts.catalog, today: opts.today, skip: (e) => !!opts.stopping && e.orderId === opts.stopping });
  const count = counted.length + (opts.adding ?? 0);
  const qualifies = count >= FAMILY_DISCOUNT.minEnrollments;

  const select = q
    .select()
    .from(installment)
    .where(and(eq(installment.householdId, householdId), inArray(installment.status, ['scheduled', 'failed'])))
    .orderBy(installment.dueDate, installment.id);
  // Lock them, so the billing run can't claim one mid-change.
  const rows = opts.lock ? await select.for('update') : await select;
  const adjustments = rows.length ? await q.select().from(billingAdjustment).where(eq(billingAdjustment.householdId, householdId)) : [];

  const changes: FamilyDiscountChange[] = [];
  for (const i of rows) {
    if (i.orderId === opts.stopping || lockedReason(i, opts.now)) continue;
    // Monthly payments only exist for weekly classes; a class since removed from the catalog still gets it.
    const kind = opts.catalog.findSession(i.sessionId)?.program.kind;
    if (kind && kind !== 'class') continue;
    const afterBase = qualifies ? familyDiscounted(i.regularAmountCents) : i.regularAmountCents;
    // Staff adjustments re-applied to the new starting amount, as adjustments.ts does.
    const [c] = computeChanges(
      [{ ...i, baseAmountCents: afterBase }],
      adjustments.filter((a) => a.orderId === i.orderId),
      opts.now,
    );
    if (afterBase === i.baseAmountCents && !c) continue;
    changes.push({
      installmentId: i.id,
      orderId: i.orderId,
      dueDate: i.dueDate,
      label: i.label,
      beforeBaseCents: i.baseAmountCents,
      afterBaseCents: afterBase,
      beforeCents: i.amountCents,
      afterCents: c ? c.afterCents : i.amountCents,
      lines: c ? c.lines : i.adjustments,
    });
  }
  return { count, qualifies, rows, changes };
}

const withDefaults = (opts: FamilyDiscountOptions) => {
  const now = opts.now ?? new Date();
  return { catalog: opts.catalog, now, today: opts.today ?? todayInAthens(now) };
};

/**
 * Bring the family's changeable weekly-class payments in line with the family
 * discount. Call inside a transaction, after anything that can change how many
 * weekly classes the family has.
 */
export async function refreshFamilyDiscount(tx: Tx, householdId: string, opts: FamilyDiscountOptions) {
  const o = withDefaults(opts);
  const { count, qualifies, rows, changes } = await plan(tx, householdId, { ...o, lock: true });
  const settled: string[] = [];
  for (const c of changes) {
    const i = rows.find((r) => r.id === c.installmentId)!;
    // A failed month that now costs nothing is settled: there's nothing to retry.
    const settle = i.status === 'failed' && c.afterCents + i.lateFeeCents === 0;
    await tx
      .update(installment)
      .set({
        baseAmountCents: c.afterBaseCents,
        amountCents: c.afterCents,
        adjustments: c.lines,
        ...(settle ? { status: 'paid' as const, paidAt: o.now, retryOn: null, lastError: 'covered by a staff adjustment' } : {}),
      })
      .where(and(eq(installment.id, i.id), eq(installment.status, i.status)));
    if (settle) settled.push(i.id);
  }
  return { count, qualifies, changes, settled };
}

/**
 * Log a refresh that changed amounts, like the other money actions. When
 * payments went back up (the discount ended), email the family the new amounts.
 */
export async function logFamilyDiscount(userId: string | null, householdId: string, r: { changes: FamilyDiscountChange[]; settled: string[] }) {
  if (r.changes.length) await audit(userId, 'family_discount.refresh', 'household', householdId);
  for (const id of r.settled) await audit(userId, 'installment.paid_by_adjustment', 'installment', id);
  const raised = r.changes.filter((c) => c.afterBaseCents > c.beforeBaseCents);
  if (raised.length) await emailFamilyDiscountEnded(householdId, raised).catch((e) => console.error('Family-discount email failed', e));
}

const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dateList = (dates: string[]) => dates.map(shortDate).join(', ').replace(/, ([^,]*)$/, ' and $1');

/**
 * "Ava, Intro to Theater: $95 on Nov 1 and Dec 1 (was $80.75)." One line per
 * child and class; months with different amounts (a staff discount on one
 * month only) get their own line.
 */
export function endedLines(effects: FamilyDiscountEffect[], classTitle: (sessionId: string) => string) {
  const lines: string[] = [];
  for (const e of effects) {
    const groups = new Map<string, FamilyDiscountChange[]>();
    for (const c of e.changes) groups.set(`${c.beforeCents}>${c.afterCents}`, [...(groups.get(`${c.beforeCents}>${c.afterCents}`) ?? []), c]);
    for (const cs of groups.values()) {
      lines.push(`${e.names.join(' and ')}, ${classTitle(e.sessionId)}: ${formatCents(cs[0].afterCents)} on ${dateList(cs.map((c) => c.dueDate))} (was ${formatCents(cs[0].beforeCents)}).`);
    }
  }
  return lines;
}

/** The family discount ended: tell the family which payments went back up, before they're charged. */
export async function emailFamilyDiscountEnded(householdId: string, raised: FamilyDiscountChange[]) {
  const catalog = await getCatalog();
  const classTitle = (sessionId: string) => catalog.findSession(sessionId)?.program.title ?? 'your class';
  const heading = 'Your family discount has ended';
  const lines = [
    'Our 15% family discount is for families with two or more students or classes in our weekly classes paid monthly. Your family now has one, so the monthly payments you haven’t made yet are back to the regular price:',
    ...endedLines(await effects(householdId, raised), classTitle),
    'Payments you’ve already made don’t change. The new amounts are charged to your saved card on the 1st, as usual.',
    `Every upcoming payment is in your family account: ${new URL('/account', config.siteUrl)}`,
    'Questions, or think this isn’t right? Just reply to this email.',
  ];
  for (const g of await householdGuardians(householdId)) {
    await sendEmail({ to: g.email, subject: `${heading} · Little Characters`, text: `${heading}\n\n${lines.join('\n\n')}`, html: emailHtml(heading, lines) });
  }
  await audit(null, 'family_discount.ended_email', 'household', householdId);
}

/** Refresh one family in its own transaction, and log it. */
export async function refreshFamilyDiscountNow(householdId: string, userId: string | null, opts: Partial<FamilyDiscountOptions> = {}) {
  const catalog = opts.catalog ?? (await getCatalog());
  const db = await getDb();
  const r = await db.transaction((tx) => refreshFamilyDiscount(tx, householdId, { ...opts, catalog }));
  await logFamilyDiscount(userId, householdId, r);
  return r;
}

/**
 * Billing run: every family with payments still to come, before anything is
 * charged. Catches up months that couldn't change earlier (the pay-now form was
 * open) and families whose class has ended. Returns how many payments changed.
 */
export async function refreshAllFamilyDiscounts(opts: { now?: Date; today?: string } = {}) {
  const db = await getDb();
  const catalog = await getCatalog();
  const families = await db
    .selectDistinct({ householdId: installment.householdId })
    .from(installment)
    .where(inArray(installment.status, ['scheduled', 'failed']));
  let changed = 0;
  for (const { householdId } of families) changed += (await refreshFamilyDiscountNow(householdId, null, { ...opts, catalog })).changes.length;
  return changed;
}

// ───────────── Previews ─────────────

/** One child's (one order's) payments that change, for the sentences families and staff read. */
export type FamilyDiscountEffect = {
  orderId: string;
  sessionId: string;
  names: string[];
  changes: FamilyDiscountChange[];
};

async function effects(householdId: string, changes: FamilyDiscountChange[]): Promise<FamilyDiscountEffect[]> {
  if (!changes.length) return [];
  const db = await getDb();
  const orderIds = [...new Set(changes.map((c) => c.orderId))];
  const orders = await db.select({ id: order.id, sessionId: order.sessionId, studentIds: order.studentIds }).from(order).where(inArray(order.id, orderIds));
  const kids = new Map((await db.select({ id: student.id, firstName: student.firstName }).from(student).where(eq(student.householdId, householdId))).map((s) => [s.id, s.firstName]));
  return orders.map((o) => ({
    orderId: o.id,
    sessionId: o.sessionId,
    names: o.studentIds.map((id) => kids.get(id)).filter((n): n is string => !!n),
    changes: changes.filter((c) => c.orderId === o.id),
  }));
}

/**
 * Review page: what enrolling `adding` more children in a weekly class would do
 * to the family's other payments (nothing is saved).
 */
export async function previewEnrollmentEffect(householdId: string, adding: number, opts: Partial<FamilyDiscountOptions> = {}) {
  const o = withDefaults({ ...opts, catalog: opts.catalog ?? (await getCatalog()) });
  const { changes } = await plan(await getDb(), householdId, { ...o, adding });
  return effects(householdId, changes);
}

/** Staff, before stopping an order's payments: which of the family's other payments go back up. */
export async function previewStopEffect(orderId: string, opts: Partial<FamilyDiscountOptions> = {}) {
  const db = await getDb();
  const [o] = await db.select({ householdId: order.householdId }).from(order).where(eq(order.id, orderId));
  if (!o) return [];
  const d = withDefaults({ ...opts, catalog: opts.catalog ?? (await getCatalog()) });
  const { changes } = await plan(db, o.householdId, { ...d, stopping: orderId });
  return effects(o.householdId, changes);
}
