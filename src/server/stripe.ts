/**
 * The Stripe client, and charging a saved card for monthly autopay. No catalog
 * imports, so the billing command-line script can use it outside Astro.
 */
import Stripe from 'stripe';
import { config } from './env';
import type { Charger, ChargeResult } from './billing';

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
