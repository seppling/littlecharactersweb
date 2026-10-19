import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDb, schema } from '@/server/db';
import { isProd } from '@/server/env';

export const prerender = false;

/**
 * Development only, for browser tests: makes the signed-in session look older.
 * `minutes` moves its sign-in time back (the 15-minute fresh sign-in for
 * downloads); `days` moves its last renewal back (the 30-day staff idle limit).
 * Doesn't exist in production.
 */
export const POST: APIRoute = async ({ locals, request }) => {
  if (isProd || !locals.session) return new Response('Not found', { status: 404 });
  const form = await request.formData();
  const minutes = Number(form.get('minutes') ?? 0) || 0;
  const days = Number(form.get('days') ?? 0) || 0;
  const s = locals.session;
  const back = (d: Date, ms: number) => new Date(new Date(d).getTime() - ms);
  const db = await getDb();
  await db
    .update(schema.session)
    .set({ createdAt: back(s.createdAt, minutes * 60_000 + days * 86_400_000), updatedAt: back(s.updatedAt, days * 86_400_000), expiresAt: back(s.expiresAt, days * 86_400_000) })
    .where(eq(schema.session.id, s.id));
  return new Response(null, { status: 204 });
};
