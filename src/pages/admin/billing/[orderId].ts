import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { paymentsOrder } from '@/lib/admin-links';
import { getDb, schema } from '@/server/db';
import { movedTo } from '@/server/moved';

export const prerender = false;

/**
 * Old address of one family's payments (/admin/billing/<order>), now
 * /admin/payments/<order>. Staff get "Not found" for an unknown order; signed-out
 * visitors are sent on without a lookup, so they learn nothing about which orders exist.
 */
export const ALL: APIRoute = async ({ locals, params, request, url }) => {
  const id = params.orderId ?? '';
  let known = !!id;
  if (known && locals.isAdmin) {
    const db = await getDb();
    known = (await db.select({ id: schema.order.id }).from(schema.order).where(eq(schema.order.id, id)).limit(1)).length > 0;
  }
  return movedTo(locals, request, known ? paymentsOrder(id) + url.search : null);
};
