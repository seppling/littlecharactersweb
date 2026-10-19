/**
 * Staff sign-in rules: a fresh sign-in for downloads, and staff sessions that
 * end after 30 days without use (families keep 90).
 */
import { desc, eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getAuth } from '@/server/auth';
import { getDb, schema } from '@/server/db';
import { dueForRenewal, readSession, requireFreshStaff, requireStaff, signedInRecently, staffSessionIdle } from '@/server/staff';

const DAY = 86_400_000;
const now = new Date('2026-10-19T15:00:00Z');
const at = (msAgo: number) => new Date(now.getTime() - msAgo);

describe('fresh sign-in', () => {
  it('is fresh for 15 minutes after signing in', () => {
    expect(signedInRecently({ session: { id: 's', createdAt: at(14 * 60_000), updatedAt: now, expiresAt: now } }, 15, now)).toBe(true);
    expect(signedInRecently({ session: { id: 's', createdAt: at(16 * 60_000), updatedAt: now, expiresAt: now } }, 15, now)).toBe(false);
    expect(signedInRecently({ session: null }, 15, now)).toBe(false);
  });

  const staff = { user: { id: 'u', name: 'Hannah', email: 'hannah@example.com', emailVerified: true }, isAdmin: true };
  const url = new URL('http://localhost/admin/leads.csv?x=1');

  it('lets a freshly signed-in staff member download', () => {
    expect(requireFreshStaff({ ...staff, session: { id: 's', createdAt: at(60_000), updatedAt: now, expiresAt: now } }, url, now)).toBeNull();
  });

  it('sends staff who signed in a while ago to confirm, then back', () => {
    const res = requireFreshStaff({ ...staff, session: { id: 's', createdAt: at(20 * 60_000), updatedAt: now, expiresAt: now } }, url, now)!;
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('/admin/confirm?next=%2Fadmin%2Fleads.csv%3Fx%3D1');
  });

  it('sends signed-out visitors to confirm, and families to not found', () => {
    expect(requireFreshStaff({ user: null, isAdmin: false, session: null }, url, now)!.status).toBe(303);
    const family = { user: { ...staff.user, email: 'ana@example.com' }, isAdmin: false, session: { id: 's', createdAt: now, updatedAt: now, expiresAt: now } };
    expect(requireFreshStaff(family, url, now)!.status).toBe(404);
    expect(requireStaff(family).response!.status).toBe(404);
    expect(requireStaff({ user: null, isAdmin: false })).toEqual({ staff: null, response: null });
    expect(requireStaff(staff).staff?.email).toBe('hannah@example.com');
  });
});

describe('staff idle limit', () => {
  it('ends a staff session not renewed for 30 days', () => {
    expect(staffSessionIdle({ updatedAt: at(29 * DAY) }, now)).toBe(false);
    expect(staffSessionIdle({ updatedAt: at(31 * DAY) }, now)).toBe(true);
  });

  it('renews a session in use once a day, as before', () => {
    expect(dueForRenewal({ expiresAt: new Date(now.getTime() + 90 * DAY) }, now)).toBe(false);
    expect(dueForRenewal({ expiresAt: new Date(now.getTime() + 89 * DAY) }, now)).toBe(true);
  });

  async function signIn(email: string) {
    const auth = await getAuth();
    const db = await getDb();
    await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } });
    const [mail] = await db.select().from(schema.devEmail).where(eq(schema.devEmail.to, email)).orderBy(desc(schema.devEmail.createdAt)).limit(1);
    const otp = mail.subject.match(/\d{6}/)![0];
    const { headers } = await auth.api.signInEmailOTP({ body: { email, otp }, returnHeaders: true });
    const cookie = headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    return new Headers({ cookie });
  }

  async function idleFor(email: string, days: number) {
    const db = await getDb();
    const [u] = await db.select().from(schema.user).where(eq(schema.user.email, email));
    const last = new Date(Date.now() - days * DAY);
    await db
      .update(schema.session)
      .set({ updatedAt: last, expiresAt: new Date(last.getTime() + 90 * DAY) })
      .where(eq(schema.session.userId, u.id));
  }

  it('signs staff out after 30 idle days, where the session is read', async () => {
    const headers = await signIn('hannah@example.com');
    expect((await readSession(headers))?.user.email).toBe('hannah@example.com');
    await idleFor('hannah@example.com', 29);
    const renewed = await readSession(headers);
    expect(renewed?.user.email).toBe('hannah@example.com');
    expect(Date.now() - new Date(renewed!.session.updatedAt).getTime()).toBeLessThan(60_000);
    await idleFor('hannah@example.com', 31);
    expect(await readSession(headers)).toBeNull();
    // The session is gone for good, not just hidden once.
    expect(await readSession(headers)).toBeNull();
  });

  it('keeps families signed in for 90 days', async () => {
    const headers = await signIn('ana@example.com');
    await idleFor('ana@example.com', 60);
    expect((await readSession(headers))?.user.email).toBe('ana@example.com');
  });
});
