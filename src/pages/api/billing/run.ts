import type { APIRoute } from 'astro';
import { timingSafeEqual } from 'node:crypto';
import { config, isProd } from '@/server/env';
import { devCharger, runBilling } from '@/server/billing';
import { paymentsMode, stripeCharger } from '@/server/payments';

export const prerender = false;

/**
 * Daily monthly-autopay run, called by the scheduler (see
 * .github/workflows/billing.yml) with "Authorization: Bearer <CRON_SECRET>"
 * and "Content-Type: application/json" (Astro's CSRF check blocks bodiless POSTs).
 * Charges whatever is due today and retries failed charges that are due for
 * another try, BATCH at a time so each request stays well under serverless
 * time limits. The scheduler calls again while `remaining` > 0. Safe to call
 * more than once a day.
 */
const BATCH = 10;
export const POST: APIRoute = async ({ request, url }) => {
  if (!config.cronSecret) return new Response('Billing is not configured', { status: 503 });
  const given = Buffer.from(request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '');
  const expected = Buffer.from(config.cronSecret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response('Unauthorized', { status: 401 });

  // Development only: pretend it's another day, e.g. ?today=2026-10-01.
  const today = !isProd ? (url.searchParams.get('today') ?? undefined) : undefined;
  const charge = paymentsMode === 'stripe' ? stripeCharger : !isProd ? devCharger : null;
  if (!charge) return new Response('Stripe is not configured', { status: 503 });

  const report = await runBilling({ charge, today, limit: BATCH });
  return Response.json(report, { status: report.errors ? 500 : 200 });
};
