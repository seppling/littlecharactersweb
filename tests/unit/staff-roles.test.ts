/**
 * Staff roles (src/server/staff.ts), teachers on classes (src/server/teachers.ts)
 * and Settings → Staff (src/server/staff-settings.ts): owners from ADMIN_EMAILS
 * and from the staff table, teachers who see only their classes and their
 * substitute dates, the shared-device hour, and turning someone off.
 */
import { and, desc, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { getAuth } from '@/server/auth';
import { getDb, schema } from '@/server/db';
import { getCatalog } from '@/server/content';
import { isOwner, markSharedDevice, readSession, requireStaff, requireTeacherOrOwner, roleFor, SHARED_IDLE_MINUTES, staffMember, staffSessionIdle } from '@/server/staff';
import { canTeach, classTeachers, coversFor, meetsOn, teacherClasses, teacherSessions } from '@/server/teachers';
import { addCover, addStaff, assignableClasses, removeCover, setClasses, setStaffActive, staffList, StaffSettingsError, updateStaff } from '@/server/staff-settings';
import { previewAdjustment } from '@/server/adjustments';
import { staffSession } from '@/server/classes';

// From the starting content (src/content/seed/programs.ts).
const INTRO = 'intro-f26-tue'; // Tuesdays, Aug 17 – Dec 18
const YESAND = 'yesand-f26-wed'; // Wednesdays, Aug 17 – Dec 18
const TUE = '2026-10-20';
const WED = '2026-10-21';
const NOW = new Date('2026-10-19T15:00:00Z');
const hannah = { id: 'u-hannah', email: 'hannah@example.com', emailVerified: true, name: 'Hannah Example' };

async function signIn(email: string) {
  const auth = await getAuth();
  const db = await getDb();
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } });
  const [mail] = await db.select().from(schema.devEmail).where(eq(schema.devEmail.to, email)).orderBy(desc(schema.devEmail.createdAt)).limit(1);
  const otp = mail.subject.match(/\d{6}/)![0];
  const { headers } = await auth.api.signInEmailOTP({ body: { email, otp }, returnHeaders: true });
  return new Headers({ cookie: headers.getSetCookie().map((c) => c.split(';')[0]).join('; ') });
}

async function sessionOf(email: string) {
  const db = await getDb();
  const [u] = await db.select().from(schema.user).where(eq(schema.user.email, email));
  const [s] = await db.select().from(schema.session).where(eq(schema.session.userId, u.id)).orderBy(desc(schema.session.createdAt)).limit(1);
  return { user: u, session: s };
}

async function idleMinutes(email: string, minutes: number) {
  const db = await getDb();
  const { session } = await sessionOf(email);
  await db
    .update(schema.session)
    .set({ updatedAt: new Date(Date.now() - minutes * 60_000) })
    .where(eq(schema.session.id, session.id));
}

let teacherId = '';
let assistantId = '';

beforeAll(async () => {
  const db = await getDb();
  await db.insert(schema.user).values({ id: hannah.id, name: hannah.name, email: hannah.email, emailVerified: true }).onConflictDoNothing();
  teacherId = (await addStaff(hannah.id, { email: 'Mo.Teacher@Example.com', name: 'Mo Teacher', role: 'teacher' })).id;
  assistantId = (await addStaff(hannah.id, { email: 'ash@example.com', name: 'Ash Helper', role: 'teacher' })).id;
});

describe('roles', () => {
  const person = (email: string, emailVerified = true) => ({ email, emailVerified });

  it('makes every ADMIN_EMAILS address an owner, whatever the table says', () => {
    expect(roleFor(person('Hannah@example.com'), undefined, ['hannah@example.com'])).toBe('owner');
    expect(roleFor(person('hannah@example.com'), { role: 'teacher', active: false }, ['hannah@example.com'])).toBe('owner');
  });

  it('takes the role from an active row in the staff table', () => {
    expect(roleFor(person('mo@example.com'), { role: 'teacher', active: true }, [])).toBe('teacher');
    expect(roleFor(person('lee@example.com'), { role: 'owner', active: true }, [])).toBe('owner');
  });

  it('gives no role to families, to turned-off staff, or to an email not yet proved', () => {
    expect(roleFor(person('ana@example.com'), undefined, ['hannah@example.com'])).toBeNull();
    expect(roleFor(person('mo@example.com'), { role: 'teacher', active: false }, [])).toBeNull();
    expect(roleFor(person('hannah@example.com', false), undefined, ['hannah@example.com'])).toBeNull();
    expect(roleFor(null, undefined, [])).toBeNull();
  });

  it('stores emails in lowercase, and gives an ADMIN_EMAILS owner a staff row the first time', async () => {
    const db = await getDb();
    const [mo] = await db.select().from(schema.staff).where(eq(schema.staff.id, teacherId));
    expect(mo.email).toBe('mo.teacher@example.com');
    expect(await staffMember({ email: 'MO.TEACHER@example.com', emailVerified: true })).toEqual({ role: 'teacher', staffId: teacherId });
    const owner = await staffMember(hannah);
    expect(owner?.role).toBe('owner');
    const [row] = await db.select().from(schema.staff).where(eq(schema.staff.email, 'hannah@example.com'));
    expect(row).toMatchObject({ id: owner!.staffId, role: 'owner', name: 'Hannah Example' });
    // Seen again: the same row.
    expect((await staffMember(hannah))?.staffId).toBe(owner!.staffId);
  });

  it('lets an owner added on the site change payments, but not a teacher', async () => {
    await addStaff(hannah.id, { email: 'lee@example.com', name: 'Lee Owner', role: 'owner' });
    expect(await isOwner({ email: 'lee@example.com', emailVerified: true })).toBe(true);
    expect(await isOwner({ email: 'mo.teacher@example.com', emailVerified: true })).toBe(false);
    await expect(previewAdjustment({ id: 'u-mo', email: 'mo.teacher@example.com', emailVerified: true }, { orderId: 'x', kind: 'amount', value: '10', repeat: 'once', reason: 'test' } as never)).rejects.toThrow('Only staff');
  });
});

describe('page checks', () => {
  const user = { id: 'u', name: 'Mo', email: 'mo.teacher@example.com', emailVerified: true };

  it('keeps every Phase 1 page for owners only', () => {
    expect(requireStaff({ user, isAdmin: false }).response!.status).toBe(404);
    expect(requireStaff({ user, isAdmin: true }).staff?.email).toBe(user.email);
  });

  it('opens the teacher app to teachers and owners, not families', () => {
    expect(requireTeacherOrOwner({ user, staffRole: 'teacher', staffId: 's1' }).staff).toMatchObject({ role: 'teacher', staffId: 's1' });
    expect(requireTeacherOrOwner({ user, staffRole: 'owner', staffId: 's2' }).staff?.role).toBe('owner');
    expect(requireTeacherOrOwner({ user, staffRole: null, staffId: null }).response!.status).toBe(404);
    expect(requireTeacherOrOwner({ user: null, staffRole: null, staffId: null })).toEqual({ staff: null, response: null });
  });
});

describe('sessions', () => {
  it('reads a teacher’s role with their session', async () => {
    const headers = await signIn('mo.teacher@example.com');
    const s = await readSession(headers);
    expect(s).toMatchObject({ role: 'teacher', staffId: teacherId, sharedDevice: false });
    // Two idle hours are nothing on their own device: the 30-day rule applies, as for owners.
    await idleMinutes('mo.teacher@example.com', 120);
    expect((await readSession(headers))?.role).toBe('teacher');
  });

  it('ends a shared-device session after an hour without use', async () => {
    expect(staffSessionIdle({ updatedAt: new Date(NOW.getTime() - 59 * 60_000), sharedDevice: true }, NOW)).toBe(false);
    expect(staffSessionIdle({ updatedAt: new Date(NOW.getTime() - 61 * 60_000), sharedDevice: true }, NOW)).toBe(true);
    expect(staffSessionIdle({ updatedAt: new Date(NOW.getTime() - 61 * 60_000), sharedDevice: false }, NOW)).toBe(false);
    expect(SHARED_IDLE_MINUTES).toBe(60);

    const headers = await signIn('ash@example.com');
    const { user, session } = await sessionOf('ash@example.com');
    await markSharedDevice(session.id, user.id);
    expect((await readSession(headers))?.sharedDevice).toBe(true);
    // In use: each visit counts as use, so 50 minutes later it's renewed.
    await idleMinutes('ash@example.com', 50);
    expect((await readSession(headers))?.role).toBe('teacher');
    expect(Date.now() - (await sessionOf('ash@example.com')).session.updatedAt.getTime()).toBeLessThan(60_000);
    // Left for over an hour: signed out, for good.
    await idleMinutes('ash@example.com', 61);
    expect(await readSession(headers)).toBeNull();
    expect(await readSession(headers)).toBeNull();
  });

  it('only marks the signed-in person’s own session as shared', async () => {
    await signIn('ash@example.com');
    const { session } = await sessionOf('ash@example.com');
    await markSharedDevice(session.id, 'someone-else');
    const db = await getDb();
    const [row] = await db.select().from(schema.session).where(eq(schema.session.id, session.id));
    expect(row.sharedDevice).toBe(false);
  });

  it('gives a family’s session no staff role, shared or not, and keeps the 90-day rule', async () => {
    const headers = await signIn('ana@example.com');
    const { user, session } = await sessionOf('ana@example.com');
    await markSharedDevice(session.id, user.id);
    await idleMinutes('ana@example.com', 120);
    expect((await readSession(headers))?.role).toBeNull();
  });
});

describe('teachers on classes', () => {
  beforeAll(async () => {
    const catalog = await getCatalog();
    expect(meetsOn(catalog.findSession(INTRO)!.session, TUE)).toBe(true);
    expect(meetsOn(catalog.findSession(INTRO)!.session, WED)).toBe(false);
    await setClasses(hannah.id, teacherId, new Map([[INTRO, 'lead']]));
    await setClasses(hannah.id, assistantId, new Map([[INTRO, 'assistant']]));
    await addCover(hannah.id, assistantId, { sessionId: YESAND, classDate: WED, coveringForStaffId: teacherId }, catalog, '2026-10-19');
  });

  it('lets a teacher open their own class on any date, and nothing else', async () => {
    expect(await canTeach(teacherId, INTRO, TUE)).toBe(true);
    expect(await canTeach(teacherId, INTRO, '2026-11-03')).toBe(true);
    expect(await canTeach(teacherId, YESAND, WED)).toBe(false);
  });

  it('lets a substitute open the class on that date only', async () => {
    expect(await canTeach(assistantId, YESAND, WED)).toBe(true);
    expect(await canTeach(assistantId, YESAND, '2026-10-28')).toBe(false);
  });

  it('lists the classes a teacher teaches or covers on a date', async () => {
    expect((await teacherSessions(teacherId, TUE)).map((t) => [t.sessionId, t.as])).toEqual([[INTRO, 'lead']]);
    expect(await teacherSessions(teacherId, WED)).toEqual([]);
    expect((await teacherSessions(assistantId, WED)).map((t) => [t.sessionId, t.as, t.coveringForStaffId])).toEqual([[YESAND, 'cover', teacherId]]);
    expect((await teacherSessions(assistantId, TUE)).map((t) => [t.sessionId, t.as])).toEqual([[INTRO, 'assistant']]);
    expect((await teacherClasses(teacherId)).map((c) => c.sessionId)).toEqual([INTRO]);
  });

  it('marks a day off on the teacher’s list', async () => {
    const db = await getDb();
    await db.insert(schema.closure).values({ date: TUE, reason: 'Fall break', createdBy: hannah.id });
    expect((await teacherSessions(teacherId, TUE))[0].dayOff).toBe('Fall break');
    await db.delete(schema.closure).where(eq(schema.closure.date, TUE));
  });

  it('lists a class’s teachers, leads first, and its substitutes', async () => {
    expect((await classTeachers(INTRO)).map((t) => [t.name, t.role])).toEqual([
      ['Mo Teacher', 'lead'],
      ['Ash Helper', 'assistant'],
    ]);
    expect(await coversFor(YESAND, WED)).toMatchObject([{ name: 'Ash Helper', coveringForName: 'Mo Teacher', classDate: WED }]);
    expect(await coversFor(YESAND, TUE)).toEqual([]);
  });

  it('takes everything away from a person turned off, and keeps their records', async () => {
    const id = (await addStaff(hannah.id, { email: 'sam@example.com', name: 'Sam Leaving', role: 'teacher' })).id;
    await setClasses(hannah.id, id, new Map([[INTRO, 'assistant']]));
    const headers = await signIn('sam@example.com');
    expect((await readSession(headers))?.role).toBe('teacher');

    await setStaffActive(hannah.id, hannah.email, id, false);
    expect((await readSession(headers))?.role).toBeNull();
    expect(await canTeach(id, INTRO, TUE)).toBe(false);
    expect(await teacherSessions(id, TUE)).toEqual([]);
    // Records stay: the assignment is still there for the reports.
    expect((await classTeachers(INTRO)).some((t) => t.staffId === id && !t.active)).toBe(true);
    await expect(setClasses(hannah.id, id, new Map([[YESAND, 'lead']]))).rejects.toThrow('Turn this person back on');

    await setStaffActive(hannah.id, hannah.email, id, true);
    expect((await readSession(headers))?.role).toBe('teacher');
  });
});

describe('Settings → Staff', () => {
  it('won’t add someone twice, or an ADMIN_EMAILS owner', async () => {
    await expect(addStaff(hannah.id, { email: 'ash@example.com', name: 'Ash', role: 'teacher' })).rejects.toThrow('already on staff');
    await expect(addStaff(hannah.id, { email: 'hannah@example.com', name: 'H', role: 'owner' })).rejects.toThrow(StaffSettingsError);
    await expect(addStaff(hannah.id, { email: 'not an email', name: 'X', role: 'teacher' })).rejects.toThrow('Enter their email');
    await expect(addStaff(hannah.id, { email: 'x@example.com', name: ' ', role: 'teacher' })).rejects.toThrow('Enter their name');
  });

  it('can’t change or turn off an ADMIN_EMAILS owner, and owners can’t lock themselves out', async () => {
    const owner = (await staffMember(hannah))!;
    await expect(setStaffActive(hannah.id, hannah.email, owner.staffId, false)).rejects.toThrow('set in the site’s settings');
    await expect(updateStaff(hannah.id, hannah.email, owner.staffId, { name: 'H', role: 'teacher' })).rejects.toThrow('set in the site’s settings');
    // Their name can change; they stay an owner.
    await updateStaff(hannah.id, hannah.email, owner.staffId, { name: 'Hannah E', role: 'owner' });
    expect((await staffMember(hannah))?.role).toBe('owner');
    const db = await getDb();
    const [lee] = await db.select().from(schema.staff).where(eq(schema.staff.email, 'lee@example.com'));
    await expect(setStaffActive('u-lee', 'lee@example.com', lee.id, false)).rejects.toThrow('can’t turn yourself off');
    await expect(updateStaff('u-lee', 'lee@example.com', lee.id, { name: 'Lee', role: 'teacher' })).rejects.toThrow('own owner role');
  });

  it('lists everyone with their role, owners from the settings included', async () => {
    const list = await staffList(['hannah@example.com', 'second@example.com']);
    expect(list.find((p) => p.email === 'hannah@example.com')).toMatchObject({ role: 'owner', fixed: true, active: true });
    expect(list.find((p) => p.email === 'second@example.com')).toMatchObject({ id: '', role: 'owner', fixed: true });
    expect(list.find((p) => p.email === 'mo.teacher@example.com')).toMatchObject({ role: 'teacher', fixed: false, classCount: 1 });
  });

  it('offers current and upcoming classes, not ended ones or a partner’s', async () => {
    const choices = assignableClasses(await getCatalog(), '2026-10-19');
    expect(choices.some((c) => c.sessionId === INTRO)).toBe(true);
    expect(choices.every((c) => c.session.endDate >= '2026-10-19' && staffSession(c.session))).toBe(true);
  });

  it('changes classes, and logs each change', async () => {
    const n = await setClasses(hannah.id, teacherId, new Map([[INTRO, 'assistant'], [YESAND, '']]));
    expect(n).toBe(1);
    expect((await classTeachers(INTRO)).find((t) => t.staffId === teacherId)?.role).toBe('assistant');
    expect(await setClasses(hannah.id, teacherId, new Map([[INTRO, 'assistant']]))).toBe(0);
    await setClasses(hannah.id, teacherId, new Map([[INTRO, 'lead']]));
    const db = await getDb();
    const log = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.entity, 'staff'), eq(schema.auditLog.entityId, teacherId)));
    expect(log.map((l) => l.action)).toEqual(expect.arrayContaining(['admin.staff.add', 'admin.staff.class_add', 'admin.staff.class_role']));
    expect(log.find((l) => l.action === 'admin.staff.class_add')?.detail).toBe(`${INTRO} lead`);
  });

  it('only adds a substitute date the class meets on, from today on', async () => {
    const catalog = await getCatalog();
    const add = (classDate: string, coveringForStaffId?: string) => addCover(hannah.id, teacherId, { sessionId: YESAND, classDate, coveringForStaffId }, catalog, '2026-10-19');
    await expect(add(TUE)).rejects.toThrow('doesn’t meet on that date');
    await expect(add('2026-10-14')).rejects.toThrow('today or a later date');
    await expect(add('2026-10-28', teacherId)).rejects.toThrow('cover for themselves');
    const row = await add('2026-10-28');
    await expect(add('2026-10-28')).rejects.toThrow('already covering');
    expect(await canTeach(teacherId, YESAND, '2026-10-28')).toBe(true);
    await removeCover(hannah.id, teacherId, row.id);
    expect(await canTeach(teacherId, YESAND, '2026-10-28')).toBe(false);
    await expect(removeCover(hannah.id, assistantId, row.id)).rejects.toThrow('wasn’t found');
  });
});
