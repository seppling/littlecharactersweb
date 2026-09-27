import type { APIRoute } from 'astro';
import { config } from '@/server/env';
import { completeCheckout, getStripe } from '@/server/payments';
import { markInstallmentPaid, resumeRetries } from '@/server/billing';

export const prerender = false;

/**
 * Stripe → us. The signature check proves the request is from Stripe.
 * Subscribe the endpoint to these events (docs/infrastructure.md):
 *  - checkout.session.completed, checkout.session.async_payment_succeeded:
 *    enrolls even if the family closed the tab before the confirmation page loaded
 *  - checkout.session.expired: a family opened "pay now" but didn't finish;
 *    automatic retries of that monthly charge resume
 *  - payment_intent.succeeded: confirms monthly autopay charges that settle later
 * Everything here is idempotent, because Stripe may deliver an event more than once.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!config.stripeWebhookSecret) return new Response('Webhook not configured', { status: 503 });
  const signature = request.headers.get('stripe-signature') ?? '';
  const body = await request.text();

  let event;
  try {
    event = await getStripe().webhooks.constructEventAsync(body, signature, config.stripeWebhookSecret);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      await completeCheckout(event.data.object.id, null);
      break;
    case 'checkout.session.expired': {
      const installmentId = event.data.object.metadata?.installmentId;
      if (installmentId) await resumeRetries(installmentId);
      break;
    }
    case 'payment_intent.succeeded': {
      const pi = event.data.object;
      if (pi.metadata?.installmentId) await markInstallmentPaid(pi.metadata.installmentId, { paymentIntentId: pi.id, amountCents: pi.amount_received });
      break;
    }
  }
  return new Response('ok');
};
