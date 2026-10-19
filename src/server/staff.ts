/**
 * Who counts as staff, and when staff must sign in again (docs/back-office.md
 * → Signing in, and → Staff roles).
 *
 * - Roles: owners (every email in ADMIN_EMAILS, and anyone added as an owner
 *   in Settings → Staff) and teachers (added there). `Astro.locals.staffRole`
 *   holds it; `isAdmin` still means "owner", so every Phase 1 page is
 *   owner-only.
 * - requireStaff: the one check at the top of every owner page and endpoint.
 *   Signed-in people who aren't owners (families, teachers) get a 404 with
 *   the "Staff only" panel; signed-out visitors get the staff sign-in
 *   (AdminShell shows both).
 * - requireTeacherOrOwner: the teacher app's pages. What a teacher sees there
 *   is filtered by their classes (src/server/teachers.ts).
 * - requireFreshStaff: downloads, staff changes and later refunds need a
 *   sign-in from the last 15 minutes. Otherwise staff confirm with an emailed
 *   code at /admin/confirm and come back.
 * - readSession: staff sessions end after 30 days without use, or 1 hour on
 *   a shared device; families keep 90 days.
 */
import { and, eq } from 'drizzle-orm';
import { confirm } from '@/lib/admin-links';
import { getAuth, SESSION_EXPIRES_IN, SESSION_UPDATE_AGE } from './auth';
import { getDb, schema } from './db';
import { config } from './env';

export const FRESH_MINUTES = 15;
export const STAFF_IDLE_DAYS = 30;
/** "This is a shared device": the session ends after this long without use. */
export const SHARED_IDLE_MINUTES = 60;
/** A shared-device session in use is marked as used at most this often. */
const SHARED_TOUCH_MINUTES = 5;

export type StaffRole = 'owner' | 'teacher';

type Person = { email: string; emailVerified: boolean; name?: string | null };
type StaffRow = { role: StaffRole; active: boolean };

/**
 * A signed-in person's staff role. ADMIN_EMAILS always makes an owner, whatever
 * the staff table says; otherwise an active row in the table decides. Only a
 * verified email (proved with a sign-in code) counts.
 */
export function roleFor(person: Person | null | undefined, row: StaffRow | null | undefined, adminEmails = config.adminEmails): StaffRole | null {
  if (!person || !person.emailVerified) return null;
  if (adminEmails.includes(person.email.toLowerCase())) return 'owner';
  return row?.active ? row.role : null;
}

/** Owners from ADMIN_EMAILS can't be changed or removed on the site. */
export const isEnvOwner = (email: string) => config.adminEmails.includes(email.toLowerCase());

/**
 * The signed-in person's staff role and staff id, or null for everyone else.
 * An ADMIN_EMAILS owner gets a staff row the first time they're seen, so they
 * can be put on classes like anyone else.
 */
export async function staffMember(person: Person | null | undefined): Promise<{ role: StaffRole; staffId: string } | null> {
  if (!person?.emailVerified) return null;
  const email = person.email.toLowerCase();
  const db = await getDb();
  let [row] = await db.select().from(schema.staff).where(eq(schema.staff.email, email));
  if (!row && isEnvOwner(email)) {
    await db
      .insert(schema.staff)
      .values({ email, name: person.name?.trim() || email, role: 'owner' })
      .onConflictDoNothing();
    [row] = await db.select().from(schema.staff).where(eq(schema.staff.email, email));
  }
  const role = roleFor(person, row);
  return role && row ? { role, staffId: row.id } : null;
}

/** For server functions that change money: an owner, checked against the database as well as the page. */
export async function isOwner(person: Person | null | undefined) {
  return (await staffMember(person))?.role === 'owner';
}

type SessionTimes = { createdAt: Date | string; updatedAt: Date | string; expiresAt: Date | string };
const ms = (d: Date | string) => new Date(d).getTime();

/** Signed in (with an emailed code) in the last `minutes`. */
export function signedInRecently(locals: Pick<App.Locals, 'session'>, minutes = FRESH_MINUTES, now = new Date()) {
  const s = locals.session;
  if (!s) return false;
  const age = now.getTime() - ms(s.createdAt);
  return age >= 0 && age <= minutes * 60_000;
}

/**
 * A staff session not renewed for 30 days counts as signed out (renewal
 * happens at most once a day while in use). On a shared device, 1 hour
 * without use (it's marked as used every few minutes).
 */
export function staffSessionIdle(session: Pick<SessionTimes, 'updatedAt'> & { sharedDevice?: boolean }, now = new Date()) {
  const limit = session.sharedDevice ? SHARED_IDLE_MINUTES * 60_000 : STAFF_IDLE_DAYS * 86_400_000;
  return now.getTime() - ms(session.updatedAt) > limit;
}

/** Better Auth's own rule for when a session in use is extended (once a day). */
export function dueForRenewal(session: Pick<SessionTimes, 'expiresAt'>, now = new Date()) {
  return ms(session.expiresAt) - SESSION_EXPIRES_IN * 1000 + SESSION_UPDATE_AGE * 1000 <= now.getTime();
}

/**
 * The signed-in person for a request, with their staff role, or null. Reads
 * the session without renewing it first, so an idle staff session is seen as
 * idle; ends it if so; otherwise renews it as Better Auth always has (and
 * marks a shared-device session as used).
 */
export async function readSession(headers: Headers, now = new Date()) {
  const auth = await getAuth();
  let result = await auth.api.getSession({ headers, query: { disableRefresh: true } });
  if (!result) return null;
  const staff = await staffMember(result.user);
  let sharedDevice = false;
  if (staff) {
    const db = await getDb();
    const [row] = await db.select({ sharedDevice: schema.session.sharedDevice }).from(schema.session).where(eq(schema.session.id, result.session.id));
    sharedDevice = !!row?.sharedDevice;
    if (staffSessionIdle({ updatedAt: result.session.updatedAt, sharedDevice }, now)) {
      await db.delete(schema.session).where(eq(schema.session.id, result.session.id));
      return null;
    }
    if (sharedDevice && now.getTime() - ms(result.session.updatedAt) > SHARED_TOUCH_MINUTES * 60_000) {
      await db.update(schema.session).set({ updatedAt: now }).where(eq(schema.session.id, result.session.id));
      result.session.updatedAt = now;
    }
  }
  if (dueForRenewal(result.session, now)) result = await auth.api.getSession({ headers });
  if (!result) return null;
  return { ...result, role: staff?.role ?? null, staffId: staff?.staffId ?? null, sharedDevice };
}

/**
 * "This is a shared device", ticked on the staff sign-in: this session ends
 * after an hour without use. Only for the signed-in person's own session.
 */
export async function markSharedDevice(sessionId: string, userId: string) {
  const db = await getDb();
  await db
    .update(schema.session)
    .set({ sharedDevice: true })
    .where(and(eq(schema.session.id, sessionId), eq(schema.session.userId, userId)));
}

/**
 * No body, so Astro shows src/pages/404.astro with the 404 status kept. For a
 * staff address, that page shows the shell's "Staff only" panel with Sign out.
 */
const notFound = () => new Response(null, { status: 404 });

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
 * The teacher app's pages: teachers and owners. Everyone else signed in gets
 * the "Staff only" 404; signed-out visitors get the staff sign-in.
 *
 *   const { staff, response } = requireTeacherOrOwner(Astro.locals);
 *   if (response) return response;
 *
 * `staff.staffId` is the id classes are assigned to (src/server/teachers.ts).
 */
export function requireTeacherOrOwner(locals: Pick<App.Locals, 'user' | 'staffRole' | 'staffId'>): {
  staff: (NonNullable<App.Locals['user']> & { role: StaffRole; staffId: string }) | null;
  response: Response | null;
} {
  if (locals.user && locals.staffRole && locals.staffId) return { staff: { ...locals.user, role: locals.staffRole, staffId: locals.staffId }, response: null };
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
