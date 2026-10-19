/**
 * The Stripe client, and charging a saved card for monthly autopay. No catalog
 * imports, so the billing command-line script can use it outside Astro.
 */
import Stripe from 'stripe';
import { config } from './env';
import type { Charger, ChargeResult } from './billing';
import type { Refunder } from './refunds';

let stripe: Stripe | undefined;
export function getStripe() {
  if (!config.stripeSecretKey) throw new Error('Stripe is not configured');
  stripe ??= new Stripe(config.stripeSecretKey);
  return stripe;
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

/**
 * Refund a payment (refunds.ts writes the pending row first). A sign-up's
 * payment is read from its checkout session. The row's id is the idempotency
 * key, so sending the same refund again never refunds twice. Stripe refusing
 * it is a failed refund; Stripe not answering throws, and the row stays
 * pending to try again.
 */
export const stripeRefunder: Refunder = async (req) => {
  const s = getStripe();
  let paymentIntent = req.paymentIntentId;
  if (!paymentIntent && req.checkoutSessionId) {
    const session = await s.checkout.sessions.retrieve(req.checkoutSessionId);
    paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null);
  }
  if (!paymentIntent) return { status: 'failed', stripeRefundId: null, error: 'Stripe has no card payment for this.' };
  try {
    const r = await s.refunds.create({ payment_intent: paymentIntent, amount: req.amountCents, metadata: { refundId: req.refundId } }, { idempotencyKey: `refund-${req.refundId}` });
    const status = r.status === 'succeeded' ? 'succeeded' : r.status === 'failed' || r.status === 'canceled' ? 'failed' : 'pending';
    return { status, stripeRefundId: r.id, error: status === 'failed' ? (r.failure_reason ?? 'Stripe couldn’t complete the refund.') : null };
  } catch (e) {
    if (e instanceof Stripe.errors.StripeInvalidRequestError || e instanceof Stripe.errors.StripeCardError) return { status: 'failed', stripeRefundId: null, error: e.message };
    throw e;
  }
};

/**
 * The last four digits of the card a payment was made with, for families'
 * statements (statements.ts). A monthly charge's payment, or a sign-up's
 * checkout. Null when Stripe doesn't say.
 */
export async function paymentCardLast4(ref: { paymentIntentId: string | null; checkoutSessionId: string | null }): Promise<string | null> {
  const s = getStripe();
  let pi: Stripe.PaymentIntent | null = null;
  if (ref.paymentIntentId) pi = await s.paymentIntents.retrieve(ref.paymentIntentId, { expand: ['latest_charge'] });
  else if (ref.checkoutSessionId) {
    const session = await s.checkout.sessions.retrieve(ref.checkoutSessionId, { expand: ['payment_intent.latest_charge'] });
    pi = typeof session.payment_intent === 'object' ? session.payment_intent : null;
  }
  const charge = pi && typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
  return charge?.payment_method_details?.card?.last4 ?? null;
}
