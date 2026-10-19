/**
 * Refunds (docs/back-office.md → Refunds, credits and statements): money given
 * back for one payment, a sign-up (an order, drop-ins included) or a monthly
 * charge (an installment). Owners only, after a fresh sign-in (the pages).
 *
 *  - Never more than was paid less earlier refunds, counting pending and
 *    succeeded ones. Checked inside the transaction that writes the row, with
 *    the order's row locked, so two refunds at once can't both pass.
 *  - Card payments: the `refund` row is written `pending` first, then Stripe
 *    is called with the row's id in the idempotency key (`refund-<id>`) and in
 *    `metadata.refundId`. Stripe's answer (succeeded, pending or failed) is
 *    saved; a pending one is settled by the webhook (`refund.updated`).
 *  - Payments marked "Paid by cash/check": no Stripe call. The refund is
 *    recorded `succeeded` with no Stripe id ("Record a refund given by cash or
 *    check").
 *  - Local test payments (no Stripe keys): recorded `succeeded` without
 *    calling Stripe, by the same rule as test payments themselves, and never
 *    in production.
 *
 * A refund changes nothing about enrollments or payments to come.
 */
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { SiteContent } from '@/content/site-content';
import { formatCents, todayInAthens } from '@/lib/pricing';
import { totalDue } from './billing';
import { getDb, schema, type DB } from './db';
import { emailHtml, sendEmail } from './email';
import { isProd, paymentsMode } from './env';
import { audit, householdGuardians } from './records';
import { getCatalog } from './content';
import { isOwner } from './staff';

const { order, installment, refund, household, student, user } = schema;

type Order = typeof order.$inferSelect;
type Installment = typeof installment.$inferSelect;
export type Refund = typeof refund.$inferSelect;
type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
type Q = Awaited<ReturnType<typeof getDb>> | Tx;
type Staff = { id: string; email: string; emailVerified: boolean };
type FindSession = Pick<SiteContent, 'findSession'>['findSession'];

export const REFUNDS = {
  reasonMax: 300,
  /** What the family's email says about card refunds. */
  cardDays: '5–10 days',
};

/** A message staff can read and act on. */
export class RefundError extends Error {}

/** Recorded when a monthly charge was marked "Paid by cash/check" (billing.ts → markPaidOutsideStripe). */
const PAID_OUTSIDE_STRIPE = 'paid outside Stripe';

/**
 * How a payment was made:
 *  - card: through Stripe (a `pi_` payment, or a `cs_` checkout);
 *  - cash: marked "Paid by cash/check" by staff;
 *  - test: the local test-payment button (no Stripe keys);
 *  - none: nothing was charged (a month a discount covered).
 */
export type PaidVia = 'card' | 'cash' | 'test' | 'none';

export function installmentVia(i: Pick<Installment, 'status' | 'lastError' | 'stripePaymentIntentId' | 'amountCents' | 'lateFeeCents'>): PaidVia {
  if (i.status !== 'paid' || totalDue(i) <= 0) return 'none';
  if (i.lastError === PAID_OUTSIDE_STRIPE) return 'cash';
  return i.stripePaymentIntentId?.startsWith('pi_') ? 'card' : 'test';
}

export function orderVia(o: Pick<Order, 'status' | 'totalCents' | 'stripeCheckoutSessionId'>): PaidVia {
  if (o.status !== 'paid' || o.totalCents <= 0) return 'none';
  return o.stripeCheckoutSessionId?.startsWith('cs_') ? 'card' : 'test';
}

/** Test payments can be refunded without Stripe where they can be made: no Stripe keys, never in production (payments.ts → testPaymentsAllowed). */
export const testRefundsAllowed = () => paymentsMode === 'test' && !isProd;

// ───────────── The math ─────────────

/** What counts against a payment: pending and succeeded refunds. A failed one gave nothing back. */
export const refundedCents = (refunds: Pick<Refund, 'amountCents' | 'status'>[]) => refunds.filter((r) => r.status !== 'failed').reduce((a, r) => a + r.amountCents, 0);

/** The most that can still be refunded. */
export const refundLeft = (paidCents: number, refunds: Pick<Refund, 'amountCents' | 'status'>[]) => Math.max(0, paidCents - refundedCents(refunds));

/**
 * What staff and families read next to a payment: "Refunded $25",
 * "Partly refunded: $10 of $25", with "pending" while Stripe works on it;
 * null when nothing was refunded.
 */
export function refundNote(paidCents: number, refunds: Pick<Refund, 'amountCents' | 'status'>[]): string | null {
  const done = refunds.filter((r) => r.status === 'succeeded').reduce((a, r) => a + r.amountCents, 0);
  const pending = refunds.filter((r) => r.status === 'pending').reduce((a, r) => a + r.amountCents, 0);
  const total = done + pending;
  if (!total) return null;
  const head = total >= paidCents ? `Refunded ${formatCents(total)}` : `Partly refunded: ${formatCents(total)} of ${formatCents(paidCents)}`;
  return pending ? `${head} (${formatCents(pending)} pending)` : head;
}

/** "40", "$40", "12.50" → cents, or null. */
export function parseDollars(raw: string): number | null {
  const s = raw.trim().replace(/^\$/, '').replace(/,/g, '').trim();
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(s)) return null;
  const c = Math.round(Number(s) * 100);
  return c >= 1 ? c : null;
}

// ───────────── Payments ─────────────

export type PaymentKind = 'signup' | 'monthly' | 'drop_in';

/** One payment a family made, with its refunds. */
export interface Payment {
  /** `o-<order id>` or `i-<installment id>`. */
  key: string;
  kind: PaymentKind;
  orderId: string;
  installmentId: string | null;
  householdId: string;
  sessionId: string;
  plan: Order['plan'];
  studentIds: string[];
  paidAt: Date;
  amountCents: number;
  via: PaidVia;
  /** The installment's label ("November tuition: Maya, Intro to Theater") or the drop-in's line. */
  label: string | null;
  /** Stripe ids to refund against. */
  paymentIntentId: string | null;
  checkoutSessionId: string | null;
  refunds: Refund[];
  leftCents: number;
}

const SIGN_UP: Record<string, string> = { monthly: 'first month', full: 'paid in full', once: '', trial: '', waitlist: '', drop_in: '' };

/** "Sign-up: Intro to Theater (first month)", "November tuition: Maya, Intro to Theater", "Drop-in: Intro to Theater, Tue, Oct 20 (Ava)". */
export function paymentWhat(p: Pick<Payment, 'kind' | 'sessionId' | 'plan' | 'label'>, findSession?: FindSession) {
  if (p.kind !== 'signup' && p.label) return p.label;
  const title = findSession?.(p.sessionId)?.program.title ?? 'a class';
  const extra = SIGN_UP[p.plan];
  return `Sign-up: ${title}${extra ? ` (${extra})` : ''}`;
}

function fromOrder(o: Order, refunds: Refund[]): Payment {
  const mine = refunds.filter((r) => r.orderId === o.id && !r.installmentId);
  return {
    key: `o-${o.id}`,
    kind: o.plan === 'drop_in' ? 'drop_in' : 'signup',
    orderId: o.id,
    installmentId: null,
    householdId: o.householdId,
    sessionId: o.sessionId,
    plan: o.plan,
    studentIds: o.studentIds,
    paidAt: o.paidAt ?? o.updatedAt,
    amountCents: o.totalCents,
    via: orderVia(o),
    label: o.plan === 'drop_in' ? (o.lines[0]?.label ?? null) : null,
    paymentIntentId: null,
    checkoutSessionId: o.stripeCheckoutSessionId,
    refunds: mine,
    leftCents: refundLeft(o.totalCents, mine),
  };
}

function fromInstallment(i: Installment, o: Pick<Order, 'plan' | 'studentIds'>, refunds: Refund[]): Payment {
  const mine = refunds.filter((r) => r.installmentId === i.id);
  return {
    key: `i-${i.id}`,
    kind: 'monthly',
    orderId: i.orderId,
    installmentId: i.id,
    householdId: i.householdId,
    sessionId: i.sessionId,
    plan: o.plan,
    studentIds: o.studentIds,
    paidAt: i.paidAt ?? i.updatedAt,
    amountCents: totalDue(i),
    via: installmentVia(i),
    label: `${i.label}${i.lateFeeCents ? ' + late fee' : ''}`,
    paymentIntentId: i.stripePaymentIntentId,
    checkoutSessionId: null,
    refunds: mine,
    leftCents: refundLeft(totalDue(i), mine),
  };
}

/** Every payment a family made (sign-ups over $0 and paid monthly charges over $0), newest first, with their refunds. */
export async function familyPayments(householdId: string, q?: Q): Promise<Payment[]> {
  const db = q ?? (await getDb());
  const [orders, installments, refunds] = await Promise.all([
    db.select().from(order).where(and(eq(order.householdId, householdId), eq(order.status, 'paid'))),
    db.select().from(installment).where(and(eq(installment.householdId, householdId), eq(installment.status, 'paid'))),
    db.select().from(refund).where(eq(refund.householdId, householdId)).orderBy(asc(refund.createdAt)),
  ]);
  const byId = new Map(orders.map((o) => [o.id, o]));
  return [
    ...orders.filter((o) => o.totalCents > 0).map((o) => fromOrder(o, refunds)),
    ...installments.filter((i) => totalDue(i) > 0 && byId.has(i.orderId)).map((i) => fromInstallment(i, byId.get(i.orderId)!, refunds)),
  ].sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime() || a.key.localeCompare(b.key));
}

/** One payment: the order's sign-up payment, or one of its monthly charges. Null when it wasn't paid (or doesn't exist). */
export async function loadPayment(ref: { orderId: string; installmentId?: string | null }, q?: Q): Promise<Payment | null> {
  const db = q ?? (await getDb());
  const [o] = await db.select().from(order).where(eq(order.id, ref.orderId));
  if (!o || o.status !== 'paid') return null;
  const refunds = await db.select().from(refund).where(eq(refund.orderId, o.id)).orderBy(asc(refund.createdAt));
  if (!ref.installmentId) return o.totalCents > 0 ? fromOrder(o, refunds) : null;
  const [i] = await db
    .select()
    .from(installment)
    .where(and(eq(installment.id, ref.installmentId), eq(installment.orderId, o.id)));
  return i && i.status === 'paid' && totalDue(i) > 0 ? fromInstallment(i, o, refunds) : null;
}

/** The order's payments (its sign-up payment and paid monthly charges), oldest first, for the order page. */
export async function orderPayments(orderId: string): Promise<Payment[]> {
  const db = await getDb();
  const [o] = await db.select().from(order).where(eq(order.id, orderId));
  if (!o || o.status !== 'paid') return [];
  const refunds = await db.select().from(refund).where(eq(refund.orderId, o.id)).orderBy(asc(refund.createdAt));
  const paid = await db
    .select()
    .from(installment)
    .where(and(eq(installment.orderId, o.id), eq(installment.status, 'paid')))
    .orderBy(asc(installment.dueDate));
  return [...(o.totalCents > 0 ? [fromOrder(o, refunds)] : []), ...paid.filter((i) => totalDue(i) > 0).map((i) => fromInstallment(i, o, refunds))];
}

/** Refunded so far per order (pending and succeeded, every payment of the order), for lists like a class's drop-ins. */
export async function refundedByOrder(orderIds: string[]) {
  if (!orderIds.length) return new Map<string, number>();
  const db = await getDb();
  const rows = await db
    .select({ orderId: refund.orderId, cents: sql<number>`sum(${refund.amountCents})::int` })
    .from(refund)
    .where(and(inArray(refund.orderId, orderIds), inArray(refund.status, ['pending', 'succeeded'])))
    .groupBy(refund.orderId);
  return new Map(rows.map((r) => [r.orderId!, Number(r.cents)]));
}

// ───────────── Stripe ─────────────

export type RefundRequest = {
  refundId: string;
  amountCents: number;
  /** A monthly charge's payment. */
  paymentIntentId: string | null;
  /** A sign-up's checkout; the refunder reads its payment from Stripe. */
  checkoutSessionId: string | null;
};
export type RefundResult = { status: 'succeeded' | 'pending' | 'failed'; stripeRefundId: string | null; error?: string | null };
/** Stripe in production (stripe.ts → stripeRefunder); stand-ins in tests. Throws when Stripe can't be reached (the refund stays pending, to try again). */
export type Refunder = (req: RefundRequest) => Promise<RefundResult>;

/** Stripe's refund status, as ours. */
export function refundStatus(s: string | null | undefined): Refund['status'] {
  if (s === 'succeeded') return 'succeeded';
  if (s === 'failed' || s === 'canceled') return 'failed';
  return 'pending';
}

// ───────────── Making a refund ─────────────

export interface RefundInput {
  orderId: string;
  installmentId?: string | null;
  amountCents: number;
  reason: string;
  emailFamily: boolean;
}

/** The checked input, and how it will be refunded. Throws RefundError with words for staff. */
export function checkRefund(p: Payment | null, input: RefundInput) {
  if (!p) throw new RefundError('That payment wasn’t found, or wasn’t paid.');
  const reason = input.reason.trim();
  if (!reason) throw new RefundError('Write a reason. Only staff see it.');
  if (reason.length > REFUNDS.reasonMax) throw new RefundError(`Keep the reason under ${REFUNDS.reasonMax} characters.`);
  if (!Number.isInteger(input.amountCents) || input.amountCents < 1) throw new RefundError('Enter an amount, like 25 or 12.50.');
  if (p.leftCents <= 0) throw new RefundError('This payment has been refunded in full already.');
  if (input.amountCents > p.leftCents) throw new RefundError(`That’s more than is left to refund. You can refund up to ${formatCents(p.leftCents)}.`);
  if (p.via === 'none') throw new RefundError('Nothing was paid for this, so there’s nothing to refund.');
  if (p.via === 'test' && !testRefundsAllowed()) throw new RefundError('This was a test payment, not a real one. There’s nothing to refund in Stripe.');
  return { ...input, reason, how: p.via === 'card' ? ('stripe' as const) : p.via === 'cash' ? ('cash' as const) : ('test' as const) };
}

export interface RefundOutcome {
  refund: Refund;
  payment: Payment;
  /** How many parents were emailed. */
  emailed: number;
}

/**
 * Refund a payment. Card payments: the pending row first, then Stripe. Cash
 * or check, and local test payments: recorded as succeeded, no Stripe call.
 */
export async function createRefund(staff: Staff, input: RefundInput, opts: { refunder?: Refunder; findSession?: FindSession; now?: Date } = {}): Promise<RefundOutcome> {
  if (!(await isOwner(staff))) throw new RefundError('Only owners can refund payments.');
  const db = await getDb();
  // A first look outside the transaction, so a card refund without Stripe set up is refused before anything is written.
  const first = checkRefund(await loadPayment(input), input);
  const refunder = opts.refunder ?? (first.how === 'stripe' ? await defaultRefunder() : null);
  if (first.how === 'stripe' && !refunder) throw new RefundError('Stripe isn’t set up on this site, so card payments can’t be refunded here.');

  const { row, payment } = await db.transaction(async (tx) => {
    // Every refund of this order waits here for the one before it, so the check below sees it.
    await tx.select({ id: order.id }).from(order).where(eq(order.id, input.orderId)).for('update');
    const p = await loadPayment(input, tx);
    const ok = checkRefund(p, input);
    const [r] = await tx
      .insert(refund)
      .values({
        householdId: p!.householdId,
        orderId: p!.orderId,
        installmentId: p!.installmentId,
        amountCents: ok.amountCents,
        reason: ok.reason,
        status: ok.how === 'stripe' ? 'pending' : 'succeeded',
        createdBy: staff.id,
        createdAt: opts.now ?? new Date(),
      })
      .returning();
    return { row: r, payment: p! };
  });
  await audit(staff.id, 'admin.refund.add', 'refund', row.id, `${formatCents(row.amountCents)} ${first.how}`);

  const done = first.how === 'stripe' ? await sendToStripe(row, payment, refunder!) : row;
  const emailed = input.emailFamily && done.status !== 'failed' ? await emailRefund(done, payment, first.how, opts.findSession).catch((e) => (console.error('Refund email failed', e), 0)) : 0;
  return { refund: done, payment: { ...payment, refunds: [...payment.refunds, done], leftCents: refundLeft(payment.amountCents, [...payment.refunds, done]) }, emailed };
}

async function defaultRefunder(): Promise<Refunder | null> {
  if (paymentsMode !== 'stripe') return null;
  return (await import('./stripe')).stripeRefunder;
}

/** Call Stripe for a pending row and save its answer. Stripe unreachable: the row stays pending, with a note, to try again. */
async function sendToStripe(row: Refund, p: Pick<Payment, 'paymentIntentId' | 'checkoutSessionId'>, refunder: Refunder): Promise<Refund> {
  const db = await getDb();
  let result: RefundResult;
  try {
    result = await refunder({ refundId: row.id, amountCents: row.amountCents, paymentIntentId: p.paymentIntentId, checkoutSessionId: p.checkoutSessionId });
  } catch (e) {
    console.error(`Refund ${row.id}: Stripe didn't answer; it stays pending.`, e);
    const [r] = await db.update(refund).set({ error: 'Stripe didn’t answer. Press Try again.' }).where(and(eq(refund.id, row.id), eq(refund.status, 'pending'))).returning();
    return r ?? row;
  }
  const [r] = await db
    .update(refund)
    .set({ status: result.status, stripeRefundId: result.stripeRefundId, error: result.status === 'failed' ? (result.error ?? 'Stripe refused the refund.') : null })
    // The webhook may have settled it already.
    .where(and(eq(refund.id, row.id), eq(refund.status, 'pending')))
    .returning();
  if (r) await audit(null, `refund.${r.status}`, 'refund', r.id);
  return r ?? (await db.select().from(refund).where(eq(refund.id, row.id)))[0];
}

/**
 * Send a pending card refund to Stripe again, when Stripe didn't answer the
 * first time. The same idempotency key, so Stripe never refunds it twice.
 */
export async function retryRefund(staff: Staff, refundId: string, opts: { refunder?: Refunder } = {}) {
  if (!(await isOwner(staff))) throw new RefundError('Only owners can refund payments.');
  const db = await getDb();
  const [r] = await db.select().from(refund).where(eq(refund.id, refundId));
  if (!r || r.status !== 'pending' || r.stripeRefundId) throw new RefundError('That refund isn’t waiting to be sent.');
  const p = await loadPayment({ orderId: r.orderId!, installmentId: r.installmentId });
  if (!p) throw new RefundError('That payment wasn’t found.');
  const refunder = opts.refunder ?? (await defaultRefunder());
  if (!refunder) throw new RefundError('Stripe isn’t set up on this site.');
  await audit(staff.id, 'admin.refund.retry', 'refund', r.id);
  return sendToStripe(r, p, refunder);
}

/**
 * Stripe's webhook (`refund.updated`, `refund.failed`): a pending refund
 * succeeded or failed, or a succeeded one failed later (the card was closed).
 * Found by `metadata.refundId`, else by the Stripe id. Idempotent.
 */
export async function settleRefund(s: { stripeRefundId: string; refundId?: string | null; status: string | null | undefined; failureReason?: string | null }) {
  const db = await getDb();
  const status = refundStatus(s.status);
  if (status === 'pending') return null;
  const [r] = s.refundId
    ? await db.select().from(refund).where(eq(refund.id, s.refundId))
    : await db.select().from(refund).where(eq(refund.stripeRefundId, s.stripeRefundId));
  if (!r || r.status === status || r.status === 'failed') return r ?? null;
  const [done] = await db
    .update(refund)
    .set({ status, stripeRefundId: r.stripeRefundId ?? s.stripeRefundId, error: status === 'failed' ? failureWords(s.failureReason) : null })
    .where(and(eq(refund.id, r.id), eq(refund.status, r.status)))
    .returning();
  if (done) await audit(null, `refund.${status}`, 'refund', done.id);
  return done ?? null;
}

const FAILURE: Record<string, string> = {
  expired_or_canceled_card: 'The card was closed or has expired. Give the money back another way.',
  lost_or_stolen_card: 'The card was reported lost or stolen. Give the money back another way.',
  charge_for_pending_refund_disputed: 'The family disputed the charge with their bank.',
  insufficient_funds: 'The Stripe balance was too low. Add funds in Stripe, then refund again.',
  declined: 'The card’s bank declined the refund.',
};
const failureWords = (code: string | null | undefined) => FAILURE[code ?? ''] ?? 'Stripe couldn’t complete the refund.';

// ───────────── The email ─────────────

/** "Refund of $25 for Drop-in: Intro to Theater, Tue, Oct 20 (Ava)". */
export const refundHeading = (cents: number, what: string) => `Refund of ${formatCents(cents)} for ${what}`;

async function emailRefund(r: Refund, p: Payment, how: 'stripe' | 'cash' | 'test', findSession?: FindSession) {
  const guardians = await householdGuardians(r.householdId);
  if (!guardians.length) return 0;
  const heading = refundHeading(r.amountCents, paymentWhat(p, findSession ?? (await getCatalog()).findSession));
  const lines = [
    how === 'cash'
      ? `We’ve given you ${formatCents(r.amountCents)} back by cash or check.`
      : `We’ve refunded ${formatCents(r.amountCents)} to the card you paid with. It takes ${REFUNDS.cardDays} to reach your card.`,
    'It shows in the Payments part of your family account.',
    'Questions? Just reply to this email.',
  ];
  await sendEmail({ to: guardians.map((g) => g.email), subject: `${heading} · Little Characters`, text: `${heading}\n\n${lines.join('\n\n')}`, html: emailHtml(heading, lines) });
  await audit(null, 'refund.email', 'refund', r.id);
  return guardians.length;
}

// ───────────── Lists ─────────────

/** Refunds made in a month (Athens time), pending and succeeded, newest first, with the family: Payments received's refund lines. */
export async function refundsMade(from: Date, until: Date) {
  const db = await getDb();
  const rows = await db
    .select({ r: refund, family: household.name, o: order })
    .from(refund)
    .innerJoin(household, eq(household.id, refund.householdId))
    .innerJoin(order, eq(order.id, refund.orderId))
    .where(and(inArray(refund.status, ['pending', 'succeeded']), sql`${refund.createdAt} >= ${from}`, sql`${refund.createdAt} < ${until}`))
    .orderBy(desc(refund.createdAt));
  const instIds = rows.map((x) => x.r.installmentId).filter((x): x is string => !!x);
  const insts = new Map(instIds.length ? (await db.select().from(installment).where(inArray(installment.id, instIds))).map((i) => [i.id, i]) : []);
  return rows.map(({ r, family, o }) => {
    const i = r.installmentId ? insts.get(r.installmentId) : undefined;
    const p = i ? fromInstallment(i, o, []) : fromOrder(o, []);
    return { refund: r, family, payment: p };
  });
}

/** Who made each refund, for the staff lists. */
export async function refundAuthors(refunds: Pick<Refund, 'createdBy'>[]) {
  const ids = [...new Set(refunds.map((r) => r.createdBy).filter((x): x is string => !!x))];
  if (!ids.length) return new Map<string, string>();
  const db = await getDb();
  return new Map((await db.select({ id: user.id, name: user.name, email: user.email }).from(user).where(inArray(user.id, ids))).map((u) => [u.id, u.name || u.email]));
}

/** Children's first names for a payment's `studentIds`. */
export async function firstNames(householdId: string) {
  const db = await getDb();
  return new Map((await db.select({ id: student.id, firstName: student.firstName }).from(student).where(eq(student.householdId, householdId))).map((s) => [s.id, s.firstName]));
}

/** "Oct 19, 2026" in Athens. */
export const refundDay = (d: Date) => new Date(`${todayInAthens(d)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
