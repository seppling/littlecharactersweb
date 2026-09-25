/**
 * Monthly autopay.
 *
 * When a family picks the monthly plan, checkout saves their card and the rest
 * of the term becomes `installment` rows (one per month, due on the 1st). Once
 * a day, runBilling() charges every installment that's due to the saved card.
 *
 * Never charges twice, even if runs overlap or crash halfway:
 *  - each installment is claimed with a conditional update before charging;
 *  - the Stripe PaymentIntent id is saved before it's confirmed, so a crashed
 *    run is finished (not repeated) by the next one;
 *  - Stripe also gets an idempotency key per attempt.
 *
 * A failed charge emails the family a "pay now" link (which also updates their
 * card) and is retried automatically after BILLING.retryAfterDays, up to
 * BILLING.maxAttempts. Cards that need the cardholder present (3-D Secure) aren't
 * retried; only the family can finish those.
 *
 * Charging itself is behind the Charger interface: Stripe in production
 * (payments.ts), a stand-in in development, fakes in tests.
 */
import { and, asc, eq, inArray, isNotNull, lt, lte, or, sql } from 'drizzle-orm';
import { getDb, schema } from './db';
import { emailHtml, sendEmail } from './email';
import { config } from './env';
import { audit, householdGuardians } from './family';
import { formatCents, todayInAthens } from '@/lib/pricing';

const { installment, household } = schema;

export const BILLING = {
  maxAttempts: 3,
  /** Try again this many days after a failed charge (the 1st → the 4th → the 7th). */
  retryAfterDays: 3,
  /** A charge still "processing" after this long was interrupted; the next run finishes it. */
  staleAfterMinutes: 30,
};

export type ChargeRequest = {
  installmentId: string;
  attempt: number;
  customerId: string;
  paymentMethodId: string;
  amountCents: number;
  description: string;
  /** Set when an earlier, interrupted run already created the payment. */
  paymentIntentId: string | null;
  /** Called with the payment's id before it's confirmed, so a crash can be recovered. */
  remember: (paymentIntentId: string) => Promise<void>;
};

export type ChargeResult =
  | { status: 'succeeded'; paymentIntentId: string }
  /** Accepted but not final yet (e.g. a bank debit); the Stripe webhook finishes it. */
  | { status: 'pending'; paymentIntentId: string }
  | { status: 'failed'; code: string; retry: boolean; paymentIntentId?: string };

export type Charger = (req: ChargeRequest) => Promise<ChargeResult>;

export type BillingReport = { today: string; due: number; charged: number; pending: number; failed: number; errors: number; remaining: number };

const FAILURE_COPY: Record<string, string> = {
  card_declined: 'your bank declined the charge',
  insufficient_funds: 'the card didn’t have enough funds',
  expired_card: 'the saved card has expired',
  incorrect_cvc: 'the card was declined',
  processing_error: 'the card network had a hiccup',
  authentication_required: 'your bank wants you to approve this payment yourself',
  no_card: 'there’s no saved card on file',
};
export const failureReason = (code: string) => FAILURE_COPY[code] ?? 'the charge didn’t go through';

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

/**
 * Charge what's due. Safe to call as often as you like. `limit` keeps each call
 * short enough for serverless hosts; call again while `remaining` > 0.
 */
export async function runBilling({ charge, today = todayInAthens(), limit = Infinity }: { charge: Charger; today?: string; limit?: number }): Promise<BillingReport> {
  const db = await getDb();
  const staleBefore = new Date(Date.now() - BILLING.staleAfterMinutes * 60_000);
  const due = await db
    .select({ i: installment, customerId: household.stripeCustomerId, paymentMethodId: household.stripePaymentMethodId })
    .from(installment)
    .innerJoin(household, eq(household.id, installment.householdId))
    .where(
      or(
        and(eq(installment.status, 'scheduled'), lte(installment.dueDate, today)),
        and(eq(installment.status, 'failed'), isNotNull(installment.retryOn), lte(installment.retryOn, today)),
        and(eq(installment.status, 'processing'), lt(installment.updatedAt, staleBefore)),
      ),
    )
    .orderBy(asc(installment.dueDate));

  const batch = due.slice(0, limit);
  const report: BillingReport = { today, due: due.length, charged: 0, pending: 0, failed: 0, errors: 0, remaining: due.length - batch.length };
  for (const { i, customerId, paymentMethodId } of batch) {
    try {
      const result = await chargeOne(i, customerId, paymentMethodId, charge, today);
      if (result) report[result]++;
    } catch (e) {
      report.errors++;
      console.error(`Billing: installment ${i.id} hit an error; it will be retried on the next run.`, e);
    }
  }
  return report;
}

async function chargeOne(
  i: typeof installment.$inferSelect,
  customerId: string | null,
  paymentMethodId: string | null,
  charge: Charger,
  today: string,
): Promise<'charged' | 'pending' | 'failed' | null> {
  const db = await getDb();
  const resuming = i.status === 'processing';
  const attempt = resuming ? i.attempts : i.attempts + 1;

  // Claim it. Re-checks the conditions, so an overlapping run, or a family who
  // just clicked "pay now" (which clears retryOn), makes this a no-op.
  const [claimed] = await db
    .update(installment)
    .set({ status: 'processing', attempts: attempt, ...(resuming ? {} : { stripePaymentIntentId: null }), updatedAt: new Date() })
    .where(
      and(
        eq(installment.id, i.id),
        eq(installment.attempts, i.attempts),
        resuming
          ? eq(installment.status, 'processing')
          : or(and(eq(installment.status, 'scheduled'), lte(installment.dueDate, today)), and(eq(installment.status, 'failed'), isNotNull(installment.retryOn), lte(installment.retryOn, today))),
      ),
    )
    .returning();
  if (!claimed) return null;

  const result: ChargeResult =
    !customerId || !paymentMethodId
      ? { status: 'failed', code: 'no_card', retry: false }
      : await charge({
          installmentId: i.id,
          attempt,
          customerId,
          paymentMethodId,
          amountCents: i.amountCents,
          description: i.label,
          paymentIntentId: resuming ? i.stripePaymentIntentId : null,
          remember: async (paymentIntentId) => {
            await db.update(installment).set({ stripePaymentIntentId: paymentIntentId }).where(eq(installment.id, i.id));
          },
        });

  if (result.status === 'succeeded') {
    await markInstallmentPaid(i.id, { paymentIntentId: result.paymentIntentId, amountCents: i.amountCents });
    return 'charged';
  }
  if (result.status === 'pending') {
    await db.update(installment).set({ stripePaymentIntentId: result.paymentIntentId, updatedAt: new Date() }).where(eq(installment.id, i.id));
    return 'pending';
  }
  await markInstallmentFailed(i.id, result.code, result.retry && attempt < BILLING.maxAttempts ? addDays(today, BILLING.retryAfterDays) : null);
  return 'failed';
}

/** Idempotent. Only counts a payment for exactly the installment's amount. */
export async function markInstallmentPaid(installmentId: string, payment: { paymentIntentId: string | null; amountCents: number | null }, userId: string | null = null) {
  const db = await getDb();
  const [i] = await db.select().from(installment).where(eq(installment.id, installmentId));
  if (!i || i.status === 'paid') return i ?? null;
  if (payment.amountCents !== i.amountCents) {
    await audit(userId, 'installment.amount_mismatch', 'installment', i.id);
    console.error(`Installment ${i.id}: paid ${payment.amountCents}¢ but ${i.amountCents}¢ is due. Not marking paid; reconcile in Stripe.`);
    return i;
  }
  const [done] = await db
    .update(installment)
    .set({ status: 'paid', paidAt: new Date(), retryOn: null, lastError: null, stripePaymentIntentId: payment.paymentIntentId ?? i.stripePaymentIntentId })
    .where(and(eq(installment.id, i.id), sql`${installment.status} <> 'paid'`))
    .returning();
  if (!done) return i;
  await audit(userId, 'installment.paid', 'installment', i.id);
  await notify(done, 'paid').catch((e) => console.error('Receipt email failed', e));
  return done;
}

export async function markInstallmentFailed(installmentId: string, code: string, retryOn: string | null) {
  const db = await getDb();
  const [i] = await db
    .update(installment)
    .set({ status: 'failed', lastError: code, retryOn, updatedAt: new Date() })
    .where(and(eq(installment.id, installmentId), sql`${installment.status} <> 'paid'`))
    .returning();
  if (!i) return null;
  await audit(null, 'installment.failed', 'installment', i.id);
  await notify(i, 'failed').catch((e) => console.error('Payment-failed email failed', e));
  return i;
}

async function notify(i: typeof installment.$inferSelect, kind: 'paid' | 'failed') {
  const guardians = await householdGuardians(i.householdId);
  const payUrl = new URL(`/account/pay/${i.id}`, config.siteUrl).toString();
  const heading = kind === 'paid' ? `Payment received: ${formatCents(i.amountCents)}` : 'We couldn’t charge your card';
  const lines =
    kind === 'paid'
      ? [`Thank you! We charged ${formatCents(i.amountCents)} to your saved card for ${i.label}.`, `Your receipts are in your family account: ${new URL('/account', config.siteUrl)}`]
      : [
          `We tried to charge ${formatCents(i.amountCents)} for ${i.label}, but ${failureReason(i.lastError ?? '')}.`,
          i.retryOn ? `We’ll try again on ${fmtDate(i.retryOn)}. To pay now or use a different card, go to ${payUrl}` : `Please pay or update your card here: ${payUrl}`,
          'Questions, or need to make other arrangements? Just reply to this email.',
        ];
  for (const g of guardians) {
    await sendEmail({ to: g.email, subject: `${heading} · Little Characters`, text: `${heading}\n\n${lines.join('\n\n')}`, html: emailHtml(heading, lines) });
  }
}

// ───────────── For families (always scoped to their household) ─────────────

export async function listInstallments(householdId: string) {
  const db = await getDb();
  return db.select().from(installment).where(eq(installment.householdId, householdId)).orderBy(asc(installment.dueDate));
}

export async function getInstallment(householdId: string, installmentId: string) {
  const db = await getDb();
  const [i] = await db
    .select()
    .from(installment)
    .where(and(eq(installment.id, installmentId), eq(installment.householdId, householdId)));
  return i ?? null;
}

/**
 * The family is paying a failed charge themselves. Stop automatic retries first,
 * so the daily run can't charge it at the same time. Returns false if it's
 * already being charged or paid.
 */
export async function holdForManualPayment(householdId: string, installmentId: string) {
  const db = await getDb();
  const [held] = await db
    .update(installment)
    .set({ retryOn: null })
    .where(and(eq(installment.id, installmentId), eq(installment.householdId, householdId), eq(installment.status, 'failed')))
    .returning({ id: installment.id });
  return !!held;
}

const NO_RETRY = new Set(['authentication_required', 'no_card']);

/** The family opened the pay-now form but didn't pay: go back to automatic retries. */
export async function resumeRetries(installmentId: string, today = todayInAthens()) {
  const db = await getDb();
  const [i] = await db.select().from(installment).where(eq(installment.id, installmentId));
  if (!i || i.status !== 'failed' || i.retryOn || i.attempts >= BILLING.maxAttempts || NO_RETRY.has(i.lastError ?? '')) return;
  await db
    .update(installment)
    .set({ retryOn: addDays(today, 1) })
    .where(and(eq(installment.id, i.id), eq(installment.status, 'failed')));
}

// ───────────── For staff ─────────────

export async function billingOverview(today = todayInAthens()) {
  const db = await getDb();
  const rows = await db
    .select({ i: installment, family: household.name })
    .from(installment)
    .innerJoin(household, eq(household.id, installment.householdId))
    .where(inArray(installment.status, ['scheduled', 'processing', 'failed']))
    .orderBy(asc(installment.dueDate));
  const nextDue = rows.find((r) => r.i.status === 'scheduled' && r.i.dueDate >= today)?.i.dueDate ?? null;
  return {
    needsAttention: rows.filter((r) => r.i.status === 'failed' || r.i.status === 'processing'),
    nextDue,
    nextDueRows: rows.filter((r) => r.i.status === 'scheduled' && r.i.dueDate === nextDue),
  };
}

/** A family withdrew: stop the charges that haven't happened yet. */
export async function stopRemainingPayments(orderId: string, staffUserId: string) {
  const db = await getDb();
  const stopped = await db
    .update(installment)
    .set({ status: 'cancelled', retryOn: null })
    .where(and(eq(installment.orderId, orderId), inArray(installment.status, ['scheduled', 'failed'])))
    .returning({ id: installment.id });
  await audit(staffUserId, 'installment.stop', 'order', orderId);
  return stopped.length;
}

/** Paid by cash, check, Zelle or Venmo. */
export async function markPaidOutsideStripe(installmentId: string, staffUserId: string) {
  const db = await getDb();
  const [i] = await db
    .update(installment)
    .set({ status: 'paid', paidAt: new Date(), retryOn: null, lastError: 'paid outside Stripe' })
    .where(and(eq(installment.id, installmentId), inArray(installment.status, ['scheduled', 'failed'])))
    .returning();
  if (i) await audit(staffUserId, 'installment.paid_manually', 'installment', i.id);
  return i ?? null;
}

/** Development only: pretends every charge succeeds. */
export const devCharger: Charger = async (req) => {
  const id = `test_pi_${req.installmentId.slice(0, 8)}_${req.attempt}`;
  await req.remember(id);
  return { status: 'succeeded', paymentIntentId: id };
};
