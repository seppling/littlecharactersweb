import type { APIRoute } from 'astro';
import { config } from '@/server/env';
import { getStripe } from '@/server/payments';
import { fulfillOrder } from '@/server/family';

export const prerender = false;

/**
 * Stripe → us: confirms payments even if a family closes the tab before the
 * confirmation page loads. The signature check proves the request is from Stripe.
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

  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const session = event.data.object;
    if (session.payment_status === 'paid' && session.metadata?.orderId) {
      await fulfillOrder(session.metadata.orderId, null, { checkoutSessionId: session.id, amountCents: session.amount_total });
    }
  }
  return new Response('ok');
};
