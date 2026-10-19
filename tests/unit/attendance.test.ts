/**
 * The teacher app (src/server/attendance.ts): who may open and mark which
 * roster on which date (teacher, substitute on and off their date, owner,
 * turned off, another teacher), idempotent taps (the same tap twice, an older
 * tap after a newer one, two phones), days off refused, the 7-day late
 * window, "attendance done", and the `attendance` and `missed2` items on
 * Needs attention.
 */
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Program, Session } from '@/content/types';
import { bookingClock } from '@/lib/session-dates';
import { childBadges } from '@/lib/badges';
import { getDb, schema } from '@/server/db';
import { getCatalog } from '@/server/content';
import { classRows } from '@/server/classes';
import { addCover, addStaff, setClasses, setStaffActive } from '@/server/staff-settings';
import { attentionFrom, type AttentionInput } from '@/server/today';
import {
  attendanceState,
  attendanceTable,
  classAttendance,
  classDateFor,
  coveringFor,
  endedHoursAgo,
  markNoteRead,
  missedTwo,
  missedTwoFrom,
  saveReports,
  saveTaps,
  teachAccess,
  teachRoster,
  unreadNotes,
  type AccessInput,
  type Tap,
  type Viewer,
} from '@/server/attendance';

// From the starting content (src/content/seed/programs.ts).
const INTRO = 'intro-f26-tue'; // Tuesdays, Aug 17 – Dec 18
const TROUPE = 'troupe-f26-wed'; // Wednesdays
const TUE = '2026-10-20';
const hannahUser = 'u-hannah-att';

// ───────────── The access rule (pure) ─────────────

describe('teachAccess', () => {
  const base: AccessInput = { role: 'teacher', teaches: true, meets: true, dayOff: null, date: TUE, today: TUE, reported: false, coveredBy: null };
  const at = (over: Partial<AccessInput>) => teachAccess({ ...base, ...over });
  it('a teacher marks their own class today', () => expect(at({})).toEqual({ view: true, edit: true, why: 'ok' }));
  it('…and can change marks on the day even after submitting', () => expect(at({ reported: true }).edit).toBe(true));
  it('another teacher’s class: no access at all', () => expect(at({ teaches: false })).toEqual({ view: false, edit: false, why: 'no-access' }));
  it('a date the class doesn’t meet: nothing to open', () => expect(at({ meets: false }).view).toBe(false));
  it('a day off: seen, never marked (owners too)', () => {
    expect(at({ dayOff: 'Thanksgiving' })).toEqual({ view: true, edit: false, why: 'day-off' });
    expect(at({ role: 'owner', dayOff: 'Thanksgiving' }).edit).toBe(false);
  });
  it('a future date: read-only', () => expect(at({ date: '2026-10-27' })).toEqual({ view: true, edit: false, why: 'future' }));
  it('a missed one, up to 7 days late', () => {
    expect(at({ date: '2026-10-13', today: '2026-10-20' }).edit).toBe(true);
    expect(at({ date: '2026-10-13', today: '2026-10-21' })).toMatchObject({ edit: false, why: 'too-late' });
  });
  it('a past date already submitted: closed for teachers, open for owners', () => {
    expect(at({ date: '2026-10-13', reported: true })).toMatchObject({ edit: false, why: 'submitted' });
    expect(at({ role: 'owner', date: '2026-10-13', reported: true }).edit).toBe(true);
    expect(at({ role: 'owner', date: '2026-08-18', teaches: false }).edit).toBe(true);
  });
  it('the regular teacher on a date a substitute covers: read-only', () => expect(at({ coveredBy: 'Casey' })).toEqual({ view: true, edit: false, why: 'covered' }));
});

describe('coveringFor', () => {
  const team = [
    { staffId: 'lead', role: 'lead' as const },
    { staffId: 'asst', role: 'assistant' as const },
  ];
  it('a cover named for them', () => expect(coveringFor('asst', [{ staffId: 'sub', name: 'Casey', coveringForStaffId: 'asst' }], team)).toBe('Casey'));
  it('a cover for nobody in particular stands in for the lead, not the assistant', () => {
    const covers = [{ staffId: 'sub', name: 'Casey', coveringForStaffId: null }];
    expect(coveringFor('lead', covers, team)).toBe('Casey');
    expect(coveringFor('asst', covers, team)).toBeNull();
  });
  it('the substitute isn’t covered by themselves', () => expect(coveringFor('sub', [{ staffId: 'sub', name: 'Casey', coveringForStaffId: 'lead' }], team)).toBeNull());
});

describe('when a class counts as ended', () => {
  // 2026-10-20 is a Tuesday; Athens is UTC−4 in October.
  const at = (hhmm: string) => new Date(`2026-10-20T${hhmm}:00-04:00`);
  it('Hannah’s alert: 2 hours after the end', () => {
    expect(endedHoursAgo(TUE, '17:30', at('19:29'))).toBe(false);
    expect(endedHoursAgo(TUE, '17:30', at('19:30'))).toBe(true);
    expect(endedHoursAgo('2026-10-19', '17:30', at('08:00'))).toBe(true);
    expect(endedHoursAgo('2026-10-21', '17:30', at('23:00'))).toBe(false);
  });
  it('Today’s chip: “Not taken” once it has ended, “done” whenever submitted', () => {
    expect(attendanceState(TUE, '17:30', false, at('17:00'))).toBeNull();
    expect(attendanceState(TUE, '17:30', false, at('17:30'))).toBe('not-taken');
    expect(attendanceState(TUE, '17:30', true, at('16:00'))).toBe('done');
  });
});

describe('missed the last two', () => {
  const r = (studentId: string, classDate: string, status: string, sessionId = 's1') => ({ studentId, sessionId, classDate, status });
  it('two absences in a row, newest first', () => {
    expect(missedTwoFrom([r('a', '2026-10-13', 'absent'), r('a', '2026-10-20', 'absent'), r('a', '2026-10-06', 'present')])).toEqual([{ studentId: 'a', sessionId: 's1', dates: ['2026-10-20', '2026-10-13'] }]);
  });
  it('a present in between, or only one absence, isn’t', () => {
    expect(missedTwoFrom([r('a', '2026-10-13', 'absent'), r('a', '2026-10-20', 'late'), r('a', '2026-10-06', 'absent')])).toEqual([]);
    expect(missedTwoFrom([r('b', '2026-10-20', 'absent')])).toEqual([]);
  });
  it('per class', () => expect(missedTwoFrom([r('a', '2026-10-20', 'absent', 's1'), r('a', '2026-10-21', 'absent', 's2')])).toEqual([]));
  it('the badge', () => {
    const b = childBadges({ hasAllergies: false, hasMedicalNotes: false, hasPickupNote: false, photoConsent: null, firstEnrolledAt: null, trial: false, dropIn: true, missedLastTwo: true, birthdate: null }, TUE);
    expect(b.map((x) => [x.key, x.label, x.tone])).toEqual([
      ['drop-in', 'Drop-in', 'neutral'],
      ['missed2', 'Missed the last two', 'warning'],
    ]);
  });
});

// ───────────── Needs attention (pure) ─────────────

describe('attentionFrom: attendance and missed2', () => {
  const session = { id: 'intro-tue', term: 'Fall 2026', days: ['Tue'], start: '16:30', end: '17:30', startDate: '2026-09-01', endDate: '2026-12-15', locationId: 'hq', status: 'open', teacher: 'Zack Newcott' } as Session;
  const program = { slug: 'intro', title: 'Intro', kind: 'class', sessions: [session] } as unknown as Program;
  const content = { programs: [program], locationById: () => undefined, findSession: (id: string) => (id === session.id ? { program, session } : undefined) };
  const rows = (filled: number) => classRows(content, new Map([[session.id, { active: filled, trial: 0, waitlist: 0 }]]), bookingClock(4, new Date('2026-10-20T12:00:00Z')));
  const input = (over: Partial<NonNullable<AttentionInput['attendance']>> = {}, filled = 8): AttentionInput => ({
    payments: [],
    classes: rows(filled),
    enrolled: [],
    attendance: { reports: new Set(), daysOff: [], dropIns: new Set(), missed: [], ...over },
  });
  const att = (i: AttentionInput, now: string) => attentionFrom(i, content, '2026-10-20', new Date(now)).filter((x) => x.kind === 'attendance');

  it('one item per class date not taken in the last 7 days, linking to its roster', () => {
    const items = att(input(), '2026-10-20T14:00:00Z'); // 10 am: today's class hasn't happened
    expect(items.map((i) => [i.tone, i.title, i.action.href])).toEqual([['warning', 'Attendance not taken: Intro', '/admin/teach/intro-tue/2026-10-13']]);
    expect(items[0].detail).toBe('Tue, Oct 13 · 4:30–5:30 pm · Zack Newcott');
  });
  it('today’s class, 2 hours after it ended', () => {
    expect(att(input(), '2026-10-20T23:29:00Z')).toHaveLength(1);
    expect(att(input(), '2026-10-20T23:30:00Z')).toHaveLength(2);
  });
  it('not when attendance is done, on a day off, or for a class with nobody in it', () => {
    expect(att(input({ reports: new Set(['intro-tue 2026-10-13']) }), '2026-10-20T14:00:00Z')).toHaveLength(0);
    expect(att(input({ daysOff: [{ id: 'd', date: '2026-10-13', sessionId: null, reason: 'Fall break' }] }), '2026-10-20T14:00:00Z')).toHaveLength(0);
    expect(att(input({}, 0), '2026-10-20T14:00:00Z')).toHaveLength(0);
    expect(att(input({ dropIns: new Set(['intro-tue 2026-10-13']) }, 0), '2026-10-20T14:00:00Z')).toHaveLength(1);
  });
  it('missed the last two: one warning per child, linking to the family', () => {
    const items = attentionFrom(
      input({ missed: [{ studentId: 'k1', sessionId: 'intro-tue', dates: ['2026-10-20', '2026-10-13'], firstName: 'Maya', lastName: 'Rivera', householdId: 'h1', family: 'Rivera family' }] }),
      content,
      '2026-10-20',
      new Date('2026-10-20T14:00:00Z'),
    ).filter((x) => x.kind === 'missed2');
    expect(items.map((i) => [i.tone, i.title, i.detail, i.action.href])).toEqual([['warning', 'Maya Rivera missed the last two classes', 'Intro: Tue, Oct 13 and Tue, Oct 20', '/admin/families/h1']]);
  });
});

// ───────────── With the database ─────────────

let owner: Viewer;
let lead: Viewer;
let other: Viewer;
let sub: Viewer;
const kids: string[] = [];
let householdId = '';

const tap = (studentId: string, status: Tap['status'], markedAt: string, clientId = crypto.randomUUID(), date = TUE, note = ''): Tap => ({ clientId, sessionId: INTRO, date, studentId, status, note, markedAt });
const rowOf = async (studentId: string, date = TUE) => {
  const db = await getDb();
  const rows = await db.select().from(schema.attendance).where(and(eq(schema.attendance.sessionId, INTRO), eq(schema.attendance.classDate, date), eq(schema.attendance.studentId, studentId)));
  return rows;
};

beforeAll(async () => {
  const db = await getDb();
  const catalog = await getCatalog();
  const users = [
    { id: hannahUser, email: 'hannah@example.com' },
    { id: 'u-lead', email: 'lead.att@example.com' },
    { id: 'u-other', email: 'other.att@example.com' },
    { id: 'u-sub', email: 'sub.att@example.com' },
  ];
  for (const u of users) await db.insert(schema.user).values({ ...u, name: u.email, emailVerified: true }).onConflictDoNothing();
  const [h] = await db.insert(schema.staff).values({ email: 'hannah@example.com', name: 'Hannah', role: 'owner' }).returning();
  owner = { userId: hannahUser, staffId: h.id, role: 'owner' };
  const leadRow = await addStaff(hannahUser, { email: 'lead.att@example.com', name: 'Lee Lead', role: 'teacher' });
  const otherRow = await addStaff(hannahUser, { email: 'other.att@example.com', name: 'Otto Other', role: 'teacher' });
  const subRow = await addStaff(hannahUser, { email: 'sub.att@example.com', name: 'Casey Sub', role: 'teacher' });
  lead = { userId: 'u-lead', staffId: leadRow.id, role: 'teacher' };
  other = { userId: 'u-other', staffId: otherRow.id, role: 'teacher' };
  sub = { userId: 'u-sub', staffId: subRow.id, role: 'teacher' };
  await setClasses(hannahUser, leadRow.id, new Map([[INTRO, 'lead']]));
  await setClasses(hannahUser, otherRow.id, new Map([[TROUPE, 'lead']]));
  await addCover(hannahUser, subRow.id, { sessionId: INTRO, classDate: TUE }, catalog, '2026-10-19');

  const [hh] = await db.insert(schema.household).values({ name: 'Att Family', emergencyContacts: [{ name: 'Gran', relationship: 'Grandmother', phone: '7065550100' }] }).returning();
  householdId = hh.id;
  for (const firstName of ['Ada', 'Ben', 'Cy']) {
    const [s] = await db.insert(schema.student).values({ householdId, firstName, lastName: 'Test', birthdate: '2017-01-01' }).returning();
    kids.push(s.id);
  }
  await db.insert(schema.enrollment).values([
    { householdId, studentId: kids[0], sessionId: INTRO, programSlug: 'intro', status: 'active' },
    { householdId, studentId: kids[1], sessionId: INTRO, programSlug: 'intro', status: 'trial' },
  ]);
  // Cy comes once, as a drop-in.
  await db.insert(schema.dropIn).values({ sessionId: INTRO, classDate: TUE, studentId: kids[2], householdId, priceCents: 2500, status: 'booked' });
  await db.insert(schema.closure).values({ date: '2026-11-24', sessionId: null, reason: 'Thanksgiving week' });
});

describe('who may see which roster on which date', () => {
  const view = async (v: Viewer, date: string, today = TUE, sessionId = INTRO) => (await classDateFor(v, sessionId, date, await getCatalog(), today))?.access;
  it('the class’s teacher: any date it meets (future ones read-only)', async () => {
    expect(await view(lead, '2026-10-13')).toMatchObject({ view: true, edit: true });
    expect(await view(lead, '2026-11-03')).toMatchObject({ view: true, edit: false, why: 'future' });
  });
  it('a substitute: on their date only', async () => {
    expect(await view(sub, TUE)).toMatchObject({ view: true, edit: true });
    expect(await view(sub, '2026-10-13')).toMatchObject({ view: false });
  });
  it('the lead on the substitute’s date: read-only, with who covers', async () => {
    const cd = await classDateFor(lead, INTRO, TUE, await getCatalog(), TUE);
    expect(cd?.access).toMatchObject({ view: true, edit: false, why: 'covered' });
    expect(cd?.coveredBy).toBe('Casey Sub');
  });
  it('another teacher: nothing', async () => expect(await view(other, TUE)).toMatchObject({ view: false, why: 'no-access' }));
  it('an owner: every class', async () => expect(await view(owner, TUE)).toMatchObject({ view: true, edit: true }));
  it('a date the class doesn’t meet, and an unknown class', async () => {
    expect(await view(owner, '2026-10-21')).toMatchObject({ view: false, why: 'not-meeting' });
    expect(await classDateFor(owner, 'no-such-class', TUE, await getCatalog(), TUE)).toBeNull();
  });
  it('a day off: seen, not marked', async () => expect(await view(owner, '2026-11-24', '2026-11-24')).toMatchObject({ view: true, edit: false, why: 'day-off' }));
});

describe('the roster for a date', () => {
  it('enrolled, trial and the drop-in booked that date, with badges and care details; logged with the date', async () => {
    const kidsOn = await teachRoster(INTRO, TUE, hannahUser, 'view', TUE);
    expect(kidsOn.map((k) => [k.shortName, k.kind])).toEqual([
      ['Ada T.', 'enrolled'],
      ['Ben T.', 'trial'],
      ['Cy T.', 'drop-in'],
    ]);
    expect(kidsOn[2].badges.map((b) => b.key)).toContain('drop-in');
    expect(kidsOn[0].emergencyContacts[0].name).toBe('Gran');
    const db = await getDb();
    const logged = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'teach.roster.view'), eq(schema.auditLog.entityId, INTRO)));
    expect(logged.at(-1)?.detail).toBe(TUE);
  });
  it('the drop-in isn’t expected on another date', async () => expect((await teachRoster(INTRO, '2026-10-13', hannahUser, 'view', TUE)).map((k) => k.firstName)).toEqual(['Ada', 'Ben']));
});

describe('saving taps', () => {
  const catalog = () => getCatalog();
  const now = new Date('2026-10-20T22:00:00Z');

  it('the same tap twice changes nothing', async () => {
    const t = tap(kids[0], 'present', '2026-10-20T21:30:00Z');
    expect(await saveTaps(sub, [t], await catalog(), now, TUE)).toEqual([{ clientId: t.clientId, result: 'saved' }]);
    expect(await saveTaps(sub, [t], await catalog(), now, TUE)).toEqual([{ clientId: t.clientId, result: 'same' }]);
    expect(await rowOf(kids[0])).toHaveLength(1);
  });
  it('an older tap after a newer one is ignored; the newer stays', async () => {
    await saveTaps(sub, [tap(kids[1], 'late', '2026-10-20T21:40:00Z')], await catalog(), now, TUE);
    const [res] = await saveTaps(sub, [tap(kids[1], 'absent', '2026-10-20T21:35:00Z')], await catalog(), now, TUE);
    expect(res.result).toBe('older');
    expect((await rowOf(kids[1]))[0].status).toBe('late');
  });
  it('two phones: the later tap wins, one row per child, and the change is logged with old and new', async () => {
    const a = tap(kids[2], 'present', '2026-10-20T21:31:00Z');
    const b = tap(kids[2], 'left_early', '2026-10-20T21:45:00Z');
    await saveTaps(owner, [b], await catalog(), now, TUE);
    await saveTaps(sub, [a], await catalog(), now, TUE);
    const rows = await rowOf(kids[2]);
    expect(rows.map((r) => [r.status, r.clientId, r.dropInId !== null])).toEqual([['left_early', b.clientId, true]]);
    const c = tap(kids[2], 'present', '2026-10-20T21:50:00Z');
    await saveTaps(sub, [c], await catalog(), now, TUE);
    const db = await getDb();
    const [change] = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'teach.attendance.change'), eq(schema.auditLog.entityId, kids[2])));
    expect(change.detail).toBe(`${INTRO} ${TUE}: left_early → present`);
  });
  it('a phone clock running ahead is held to now', async () => {
    await saveTaps(sub, [tap(kids[0], 'absent', '2026-10-21T09:00:00Z')], await catalog(), now, TUE);
    expect((await rowOf(kids[0]))[0].markedAt.toISOString()).toBe(now.toISOString());
  });
  it('a child not on the roster, another teacher, a day off: refused', async () => {
    const db = await getDb();
    const [stranger] = await db.insert(schema.student).values({ householdId, firstName: 'Zed', lastName: 'Test' }).returning();
    expect((await saveTaps(sub, [tap(stranger.id, 'present', '2026-10-20T21:30:00Z')], await catalog(), now, TUE))[0]).toMatchObject({ result: 'refused', why: 'not-on-roster' });
    expect((await saveTaps(other, [tap(kids[0], 'present', '2026-10-20T21:30:00Z')], await catalog(), now, TUE))[0]).toMatchObject({ result: 'refused', why: 'no-access' });
    const thanksgiving = new Date('2026-11-24T22:00:00Z');
    expect((await saveTaps(owner, [tap(kids[0], 'present', '2026-11-24T21:00:00Z', undefined, '2026-11-24')], await catalog(), thanksgiving, '2026-11-24'))[0]).toMatchObject({ result: 'refused', why: 'day-off' });
    expect(await rowOf(kids[0], '2026-11-24')).toHaveLength(0);
  });
  it('the 7-day window: a missed class up to 7 days late, then closed (owners any time)', async () => {
    const date = '2026-10-13';
    const late = async (today: string) => saveTaps(lead, [tap(kids[0], 'present', `${today}T15:00:00Z`, undefined, date)], await getCatalog(), new Date(`${today}T16:00:00Z`), today);
    expect((await late('2026-10-21'))[0]).toMatchObject({ result: 'refused', why: 'too-late' });
    expect((await late('2026-10-20'))[0].result).toBe('saved');
    const owned = await saveTaps(owner, [tap(kids[1], 'absent', '2026-12-01T15:00:00Z', undefined, date)], await catalog(), new Date('2026-12-01T16:00:00Z'), '2026-12-01');
    expect(owned[0].result).toBe('saved');
  });
});

describe('attendance done, and the note to Hannah', () => {
  const now = new Date('2026-10-20T22:30:00Z');
  const report = (note: string, at: string) => ({ clientId: crypto.randomUUID(), sessionId: INTRO, date: TUE, note, at });

  it('submitting saves the report with the note; an older submission sent late is ignored', async () => {
    const catalog = await getCatalog();
    expect((await saveReports(sub, [report('Out of glue sticks', '2026-10-20T22:10:00Z')], catalog, now, TUE))[0].result).toBe('saved');
    expect((await saveReports(sub, [report('Old note', '2026-10-20T22:00:00Z')], catalog, now, TUE))[0].result).toBe('older');
    const notes = await unreadNotes(INTRO);
    expect(notes.map((n) => [n.note, n.by])).toEqual([['Out of glue sticks', 'Casey Sub']]);
  });
  it('Mark read: it leaves Today; a changed note shows again', async () => {
    const [n] = await unreadNotes(INTRO);
    expect(await markNoteRead(n.id, hannahUser)).toBe(true);
    expect(await unreadNotes(INTRO)).toHaveLength(0);
    await saveReports(sub, [report('Also: Ben needs a script', '2026-10-20T22:20:00Z')], await getCatalog(), now, TUE);
    expect((await unreadNotes(INTRO)).map((x) => x.note)).toEqual(['Also: Ben needs a script']);
  });
  it('after submitting, a tap made on the day and sent the next morning still counts', async () => {
    const next = new Date('2026-10-21T13:00:00Z');
    const [res] = await saveTaps(sub, [tap(kids[1], 'present', '2026-10-20T22:25:00Z')], await getCatalog(), next, '2026-10-21');
    expect(res.result).toBe('saved');
  });
  it('a teacher can’t reopen a submitted past date', async () => {
    await saveReports(lead, [{ clientId: crypto.randomUUID(), sessionId: INTRO, date: '2026-10-13', note: '', at: '2026-10-20T15:00:00Z' }], await getCatalog(), new Date('2026-10-20T16:00:00Z'), '2026-10-20');
    const [res] = await saveTaps(lead, [tap(kids[0], 'absent', '2026-10-20T17:00:00Z', undefined, '2026-10-13')], await getCatalog(), new Date('2026-10-20T17:30:00Z'), '2026-10-20');
    expect(res).toMatchObject({ result: 'refused', why: 'submitted' });
  });
});

describe('Hannah’s views', () => {
  it('the class’s attendance: each date with present / marked and who took it; the download', async () => {
    const catalog = await getCatalog();
    const a = await classAttendance(catalog.findSession(INTRO)!.session, TUE);
    const tue = a.dates.find((d) => d.date === TUE)!;
    // Ada was marked absent (the phone clock test); Ben late, then present; Cy present.
    expect([tue.present, tue.marked, tue.by]).toEqual([2, 3, 'Casey Sub']);
    const t = attendanceTable(a);
    expect(t.headers.slice(-3)).toEqual(['10/20', 'Present', 'Absent']);
    expect(t.rows.map((r) => r[0])).toEqual(['Ada Test', 'Ben Test', 'Cy Test']);
  });
  it('missed the last two, for a child absent twice in a row', async () => {
    const catalog = await getCatalog();
    // Ada: absent on Oct 6 and Oct 13 (owner marks), then the badge until she's back.
    await saveTaps(owner, [tap(kids[0], 'absent', '2026-10-21T10:00:00Z', undefined, '2026-10-06'), tap(kids[0], 'absent', '2026-10-21T10:00:00Z', undefined, '2026-10-13')], catalog, new Date('2026-10-21T12:00:00Z'), '2026-10-21');
    await saveTaps(owner, [tap(kids[0], 'absent', '2026-10-21T10:00:01Z', undefined, TUE)], catalog, new Date('2026-10-21T12:00:00Z'), '2026-10-21');
    expect((await missedTwo({ sessionIds: [INTRO] })).map((m) => m.studentId)).toEqual([kids[0]]);
  });
  it('a teacher turned off loses access at once', async () => {
    await setStaffActive(hannahUser, 'hannah@example.com', sub.staffId, false);
    expect((await classDateFor(sub, INTRO, TUE, await getCatalog(), TUE))?.access.view).toBe(false);
  });
});
