/**
 * Who counts as staff, and when staff must sign in again (docs/back-office.md
 * → Signing in).
 *
 * - requireStaff: the one check at the top of every staff page and endpoint.
 *   Signed-in families get "Not found"; signed-out visitors get the staff
 *   sign-in (AdminShell shows it).
 * - requireFreshStaff: downloads, and later refunds and staff changes, need a
 *   sign-in from the last 15 minutes. Otherwise staff confirm with an emailed
 *   code at /admin/confirm and come back.
 * - readSession: staff sessions end after 30 days without use; families keep
 *   90 days.
 */
import { eq } from 'drizzle-orm';
import { confirm } from '@/lib/admin-links';
import { getAuth, isAdmin, SESSION_EXPIRES_IN, SESSION_UPDATE_AGE } from './auth';
import { getDb, schema } from './db';

export const FRESH_MINUTES = 15;
export const STAFF_IDLE_DAYS = 30;

type SessionTimes = { createdAt: Date | string; updatedAt: Date | string; expiresAt: Date | string };
const ms = (d: Date | string) => new Date(d).getTime();

/** Signed in (with an emailed code) in the last `minutes`. */
export function signedInRecently(locals: Pick<App.Locals, 'session'>, minutes = FRESH_MINUTES, now = new Date()) {
  const s = locals.session;
  if (!s) return false;
  const age = now.getTime() - ms(s.createdAt);
  return age >= 0 && age <= minutes * 60_000;
}

/** A staff session not renewed for 30 days counts as signed out. Renewal happens at most once a day while in use. */
export function staffSessionIdle(session: Pick<SessionTimes, 'updatedAt'>, now = new Date()) {
  return now.getTime() - ms(session.updatedAt) > STAFF_IDLE_DAYS * 86_400_000;
}

/** Better Auth's own rule for when a session in use is extended (once a day). */
export function dueForRenewal(session: Pick<SessionTimes, 'expiresAt'>, now = new Date()) {
  return ms(session.expiresAt) - SESSION_EXPIRES_IN * 1000 + SESSION_UPDATE_AGE * 1000 <= now.getTime();
}

/**
 * The signed-in person for a request, or null. Reads the session without
 * renewing it first, so an idle staff session is seen as idle; ends it if so;
 * otherwise renews it as Better Auth always has.
 */
export async function readSession(headers: Headers, now = new Date()) {
  const auth = await getAuth();
  let result = await auth.api.getSession({ headers, query: { disableRefresh: true } });
  if (!result) return null;
  if (isAdmin(result.user) && staffSessionIdle(result.session, now)) {
    const db = await getDb();
    await db.delete(schema.session).where(eq(schema.session.id, result.session.id));
    return null;
  }
  if (dueForRenewal(result.session, now)) result = await auth.api.getSession({ headers });
  return result ?? null;
}

const notFound = () => new Response('Not found', { status: 404 });

/**
 * The check at the top of every staff page and endpoint:
 *
 *   const { staff, response } = requireStaff(Astro.locals);
 *   if (response) return response;
 *   // staff is null when signed out: AdminShell shows the sign-in.
 */
export function requireStaff(locals: Pick<App.Locals, 'user' | 'isAdmin'>): { staff: NonNullable<App.Locals['user']> | null; response: Response | null } {
  if (locals.user && locals.isAdmin) return { staff: locals.user, response: null };
  if (locals.user) return { staff: null, response: notFound() };
  return { staff: null, response: null };
}

/**
 * Downloads and other sensitive steps: staff who signed in within the last
 * 15 minutes, or a trip to /admin/confirm and back. Null means go ahead.
 *
 *   const stop = requireFreshStaff(locals, url);
 *   if (stop) return stop;
 */
export function requireFreshStaff(locals: Pick<App.Locals, 'user' | 'isAdmin' | 'session'>, url: URL, now = new Date()): Response | null {
  const { staff, response } = requireStaff(locals);
  if (response) return response;
  if (staff && signedInRecently(locals, FRESH_MINUTES, now)) return null;
  return new Response(null, { status: 303, headers: { Location: confirm(url.pathname + url.search), 'Cache-Control': 'private, no-store' } });
}
