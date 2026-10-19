import type { APIRoute } from 'astro';
import { getDb, schema } from '@/server/db';
import { isProd } from '@/server/env';

export const prerender = false;

/**
 * Development only, for browser tests (tests/e2e/staff-drop-ins.mjs): marks a
 * class date as a day off, so the drop-in page can be checked to refuse it
 * (the calendar unit adds days off for real). Staff only. Doesn't exist in
 * production.
 */
export const POST: APIRoute = async ({ locals, request }) => {
  if (isProd || !locals.user || !locals.isAdmin) return new Response('Not found', { status: 404 });
  const form = await request.formData();
  const sessionId = String(form.get('session') ?? '');
  const date = String(form.get('date') ?? '');
  if (!sessionId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Response('Bad request', { status: 400 });
  const db = await getDb();
  await db.insert(schema.closure).values({ sessionId, date, reason: 'Test day off', createdBy: locals.user.id }).onConflictDoNothing();
  return new Response(null, { status: 204 });
};
