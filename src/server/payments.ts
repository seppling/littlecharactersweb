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
  const [h] = await db.select().from(schema.household).where(eq(schema.household.id, opts.householdId));

  let customer = h?.stripeCustomerId ?? undefined;
  if (!customer) {
    const c = await s.customers.create({ email: opts.email, name: opts.householdName, metadata: { householdId: opts.householdId } });
    customer = c.id;
    await db.update(schema.household).set({ stripeCustomerId: customer }).where(eq(schema.household.id, opts.householdId));
  }

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

export async function checkoutIsPaid(checkoutSessionId: string) {
  const session = await getStripe().checkout.sessions.retrieve(checkoutSessionId);
  return {
    paid: session.payment_status === 'paid',
    orderId: session.metadata?.orderId,
    payment: { checkoutSessionId: session.id, amountCents: session.amount_total },
  };
}

export function testPaymentsAllowed() {
  return paymentsMode === 'test' && !isProd;
}
