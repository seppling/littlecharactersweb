/**
 * "This is a shared device", ticked on the staff sign-in: the session just
 * made ends after an hour without use (src/server/staff.ts). Only ever the
 * signed-in person's own session.
 */
import type { APIRoute } from 'astro';
import { markSharedDevice } from '@/server/staff';

export const prerender = false;

export const POST: APIRoute = async ({ locals }) => {
  if (!locals.user || !locals.session) return new Response(null, { status: 401 });
  await markSharedDevice(locals.session.id, locals.user.id);
  return new Response(null, { status: 204 });
};
