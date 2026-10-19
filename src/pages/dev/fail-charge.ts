import type { APIRoute } from 'astro';
import { and, asc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/server/db';
import { isProd } from '@/server/env';
import { addDays, BILLING, markInstallmentFailed } from '@/server/billing';
import { todayInAthens } from '@/lib/pricing';

export const prerender = false;

/**
 * Development only, for browser tests (tests/e2e/staff-payments.mjs): the
 * local test-payment stand-in never declines, so this makes the next scheduled
 * charge of an order fail the way a declined card does (markInstallmentFailed:
 * the family gets the "pay now" email, a retry in 3 days). Staff only.
 * Doesn't exist in production.
 */
export const POST: APIRoute = async ({ locals, request }) => {
  if (isProd || !locals.user || !locals.isAdmin) return new Response('Not found', { status: 404 });
  const orderId = String((await request.formData()).get('order') ?? '');
  const db = await getDb();
  const [next] = await db
    .select()
    .from(schema.installment)
    .where(and(eq(schema.installment.orderId, orderId), eq(schema.installment.status, 'scheduled')))
    .orderBy(asc(schema.installment.dueDate))
    .limit(1);
  if (!next) return new Response('Nothing scheduled', { status: 404 });
  const today = todayInAthens();
  await db.update(schema.installment).set({ attempts: next.attempts + 1 }).where(eq(schema.installment.id, next.id));
  await markInstallmentFailed(next.id, 'card_declined', addDays(today, BILLING.retryAfterDays), today);
  return Response.json({ installmentId: next.id });
};
