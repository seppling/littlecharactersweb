/**
 * Payments through Stripe Embedded Checkout: the card form renders inside our
 * enrollment page, so families never leave littlecharacters.org, and card
 * numbers never touch our servers (Stripe handles PCI; we stay at SAQ A).
 *
 * Without STRIPE_SECRET_KEY (local development), the review page shows a
 * clearly labeled test-payment button instead. That path is refused in
 * production.
 */
import Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { config, isProd, paymentsMode } from './env';
import { getDb, schema } from './db';
import type { OrderLine } from './db/schema';
import { fulfillOrder } from './family';
import { markInstallmentPaid, type Charger, type ChargeResult } from './billing';

let stripe: Stripe | undefined;
export function getStripe() {
  if (!config.stripeSecretKey) throw new Error('Stripe is not configured');
  stripe ??= new Stripe(config.stripeSecretKey);
  return stripe;
}

export { paymentsMode };

/**
 * Stripe line items must be positive, so discounts are folded into the tuition
 * lines they apply to. The rounding remainder goes on the first tuition line,
 * so the charge always equals the order total.
 */
export function toStripeLineItems(lines: OrderLine[], totalCents: number, sessionTitle: string) {
  const tuition = lines.filter((l) => l.kind === 'tuition' && l.amountCents > 0);
  const fees = lines.filter((l) => l.kind === 'fee' && l.amountCents > 0);
  const discount = -lines.filter((l) => l.kind === 'discount').reduce((a, l) => a + l.amountCents, 0);
  const tuitionTotal = tuition.reduce((a, l) => a + l.amountCents, 0);

  const items = tuition.map((l) => ({
    name: l.label,
    amount: tuitionTotal ? l.amountCents - Math.round((discount * l.amountCents) / tuitionTotal) : l.amountCents,
  }));
  const sum = items.reduce((a, i) => a + i.amount, 0) + fees.reduce((a, l) => a + l.amountCents, 0);
  if (items.length) items[0].amount += totalCents - sum;
  const all = [...items, ...fees.map((l) => ({ name: l.label, amount: l.amountCents }))];

  return all
    .filter((i) => i.amount > 0)
    .map((i) => ({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: i.amount,
        product_data: { name: i.name, description: sessionTitle + (discount ? ' · discount applied' : '') },
      },
    }));
}

/** One Stripe customer per household, created the first time they pay. */
async function ensureCustomer(householdId: string, householdName: string, email: string) {
  const db = await getDb();
  const [h] = await db.select().from(schema.household).where(eq(schema.household.id, householdId));
  // Ignore placeholders left by the local test-payment stand-in ("test_customer").
  if (h?.stripeCustomerId?.startsWith('cus_')) return h.stripeCustomerId;
  const c = await getStripe().customers.create({ email, name: householdName, metadata: { householdId } });
  await db.update(schema.household).set({ stripeCustomerId: c.id }).where(eq(schema.household.id, householdId));
  return c.id;
}

export async function createEmbeddedCheckout(opts: {
  order: typeof schema.order.$inferSelect;
  householdId: string;
  householdName: string;
  email: string;
  title: string;
  saveCardForMonthly: boolean;
}) {
  const s = getStripe();
  const db = await getDb();
  const customer = await ensureCustomer(opts.householdId, opts.householdName, opts.email);

  // One live checkout per order: if the family went back and changed plans, the old form stops working.
  if (opts.order.stripeCheckoutSessionId) await s.checkout.sessions.expire(opts.order.stripeCheckoutSessionId).catch(() => {});

  const session = await s.checkout.sessions.create({
    ui_mode: 'embedded_page',
    mode: 'payment',
    customer,
    line_items: toStripeLineItems(opts.order.lines, opts.order.totalCents, opts.title),
    return_url: `${config.siteUrl}/enroll/confirmation?order=${opts.order.id}&checkout={CHECKOUT_SESSION_ID}`,
    metadata: { orderId: opts.order.id, householdId: opts.householdId },
    payment_intent_data: {
      metadata: { orderId: opts.order.id },
      // Keep the card on file so monthly tuition can be charged later.
      ...(opts.saveCardForMonthly ? { setup_future_usage: 'off_session' as const } : {}),
    },
  });

  await db.update(schema.order).set({ stripeCheckoutSessionId: session.id }).where(eq(schema.order.id, opts.order.id));
  return session.client_secret!;
}

/** Pay a monthly charge that failed; the card used becomes the saved card. */
export async function createInstallmentCheckout(opts: {
  installment: typeof schema.installment.$inferSelect;
  householdName: string;
  email: string;
}) {
  const { installment: i } = opts;
  const customer = await ensureCustomer(i.householdId, opts.householdName, opts.email);
  const session = await getStripe().checkout.sessions.create({
    ui_mode: 'embedded_page',
    mode: 'payment',
    customer,
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: i.amountCents, product_data: { name: i.label } } }],
    return_url: `${config.siteUrl}/account/pay/${i.id}?checkout={CHECKOUT_SESSION_ID}`,
    metadata: { installmentId: i.id, householdId: i.householdId },
    payment_intent_data: { metadata: { installmentId: i.id }, setup_future_usage: 'off_session' },
    // Automatic retries are paused while this form is open; see resumeRetries().
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return session.client_secret!;
}

/**
 * Finish a checkout: enroll (orders) or mark the monthly charge paid
 * (installments), and remember the card for autopay when the family agreed to
 * save it. Called from the return page and the webhook, whichever comes first;
 * safe to call twice.
 */
export async function completeCheckout(checkoutSessionId: string, userId: string | null) {
  const s = getStripe();
  const session = await s.checkout.sessions.retrieve(checkoutSessionId, { expand: ['payment_intent'] });
  const meta = session.metadata ?? {};
  const result = { paid: session.payment_status === 'paid', orderId: meta.orderId, installmentId: meta.installmentId };
  if (!result.paid) return result;

  const pi = typeof session.payment_intent === 'object' ? session.payment_intent : null;
  const paymentMethodId = typeof pi?.payment_method === 'string' ? pi.payment_method : (pi?.payment_method?.id ?? null);
  if (pi?.setup_future_usage === 'off_session' && paymentMethodId && meta.householdId) {
    await rememberCard(meta.householdId, paymentMethodId);
  }
  if (meta.orderId) await fulfillOrder(meta.orderId, userId, { checkoutSessionId: session.id, amountCents: session.amount_total });
  if (meta.installmentId) await markInstallmentPaid(meta.installmentId, { paymentIntentId: pi?.id ?? null, amountCents: session.amount_total }, userId);
  return result;
}

async function rememberCard(householdId: string, paymentMethodId: string) {
  const db = await getDb();
  const [h] = await db
    .update(schema.household)
    .set({ stripePaymentMethodId: paymentMethodId })
    .where(eq(schema.household.id, householdId))
    .returning({ customer: schema.household.stripeCustomerId });
  if (h?.customer?.startsWith('cus_')) await getStripe().customers.update(h.customer, { invoice_settings: { default_payment_method: paymentMethodId } });
}

/**
 * Charge a saved card without the family present (monthly autopay).
 * Creates the payment, lets billing.ts save its id, then confirms it, so an
 * interrupted run resumes the same payment instead of starting a second one.
 */
export const stripeCharger: Charger = async (req) => {
  const s = getStripe();
  let pi = req.paymentIntentId ? await s.paymentIntents.retrieve(req.paymentIntentId) : null;
  if (!pi) {
    pi = await s.paymentIntents.create(
      {
        amount: req.amountCents,
        currency: 'usd',
        customer: req.customerId,
        payment_method: req.paymentMethodId,
        description: req.description,
        metadata: { installmentId: req.installmentId, attempt: String(req.attempt) },
        payment_method_types: ['card'],
      },
      { idempotencyKey: `installment-${req.installmentId}-${req.attempt}` },
    );
    await req.remember(pi.id);
  }
  if (pi.status === 'requires_confirmation') {
    try {
      pi = await s.paymentIntents.confirm(pi.id, { off_session: true });
    } catch (e) {
      if (e instanceof Stripe.errors.StripeCardError) {
        const code = e.code === 'card_declined' && e.decline_code === 'insufficient_funds' ? 'insufficient_funds' : (e.code ?? 'card_declined');
        return { status: 'failed', code, retry: code !== 'authentication_required', paymentIntentId: pi.id };
      }
      throw e;
    }
  }
  return resultFor(pi);
};

function resultFor(pi: Stripe.PaymentIntent): ChargeResult {
  switch (pi.status) {
    case 'succeeded':
      return { status: 'succeeded', paymentIntentId: pi.id };
    case 'processing':
      return { status: 'pending', paymentIntentId: pi.id };
    case 'requires_action':
      return { status: 'failed', code: 'authentication_required', retry: false, paymentIntentId: pi.id };
    default:
      return { status: 'failed', code: pi.last_payment_error?.code ?? 'card_declined', retry: pi.status !== 'canceled', paymentIntentId: pi.id };
  }
}

export function testPaymentsAllowed() {
  return paymentsMode === 'test' && !isProd;
}
