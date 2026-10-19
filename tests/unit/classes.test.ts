/**
 * The staff Classes list and a class's roster (src/server/classes.ts): counts,
 * filters, the roster's order and care details, the waitlist, and the
 * sign-in sheet's dates.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Program, Session } from '@/content/types';
import { getDb, schema } from '@/server/db';
import { createStudent, ensureHousehold, updateStudentDetails, type SessionUser } from '@/server/family';
import { bookingClock } from '@/lib/session-dates';
import {
  classFilters,
  classRoster,
  classRows,
  filterQuery,
  filterRows,
  groupByTerm,
  placesLabel,
  rosterTable,
  signInDates,
  signInTable,
  termsOf,
} from '@/server/classes';

const session = (id: string, over: Partial<Session> = {}): Session => ({
  id,
  term: 'Fall 2026',
  days: ['Tue'],
  start: '16:30',
  end: '17:30',
  startDate: '2026-08-18',
  endDate: '2026-12-15',
  locationId: 'hq',
  status: 'open',
  teacher: 'Zack Newcott',
  ...over,
});
const program = (slug: string, kind: Program['kind'], sessions: Session[]) => ({ slug, title: slug, kind, sessions }) as unknown as Program;

const programs = [
  program('intro', 'class', [session('intro-tue', { capacity: 12, label: 'Ages 7–10' }), session('intro-spring', { term: 'Spring 2027', startDate: '2027-01-12', endDate: '2027-05-11' })]),
  program('night-out', 'workshop', [session('pno-sep', { days: ['Fri'], startDate: '2026-09-12', endDate: '2026-09-12' }), session('pno-nov', { label: 'Fri, Nov 13', days: ['Fri'], startDate: '2026-11-13', endDate: '2026-11-13', capacity: 2 })]),
  program('partner', 'class', [session('school', { externalUrl: 'https://school.example/register' })]),
];
const content = { programs, locationById: (id: string | undefined) => (id === 'hq' ? ({ id: 'hq', shortName: 'Studio', name: 'The Studio' } as never) : undefined) };
const counts = new Map([
  ['intro-tue', { active: 9, trial: 3, waitlist: 2 }],
  ['intro-spring', { active: 1, trial: 0, waitlist: 0 }],
  ['pno-nov', { active: 1, trial: 0, waitlist: 0 }],
]);
// October 19, 2026, mid-afternoon in Athens.
const clock = bookingClock(4, new Date('2026-10-19T18:00:00Z'));
const rows = classRows(content, counts, clock);
const row = (id: string) => rows.find((r) => r.session.id === id)!;
const none = { ended: false, openings: false, waitlist: false, under5: false };
const ids = (list: { session: Session }[]) => list.map((r) => r.session.id);

describe('the Classes list', () => {
  it('lists the sessions the site takes sign-ups for, not a partner’s', () => {
    expect(ids(rows).sort()).toEqual(['intro-spring', 'intro-tue', 'pno-nov', 'pno-sep']);
  });

  it('counts enrolled and trial students as places filled, with openings and the waitlist', () => {
    expect(row('intro-tue')).toMatchObject({ filled: 12, trial: 3, capacity: 12, openings: 0, waitlist: 2, teacher: 'Zack Newcott', location: 'Studio', when: 'Tuesdays · 4:30–5:30 pm' });
    expect(placesLabel(row('intro-tue'))).toBe('12 of 12');
    // A weekly class with no capacity set gets the default; a workshop has no limit.
    expect(row('intro-spring')).toMatchObject({ filled: 1, capacity: 20, openings: 19 });
    expect(row('pno-sep')).toMatchObject({ filled: 0, capacity: undefined, openings: undefined, waitlist: 0 });
    expect(placesLabel(row('pno-sep'))).toBe('0');
    expect(row('pno-nov').when).toBe('Fri, Nov 13 · 4:30–5:30 pm');
    // A label that only repeats the date isn't shown twice; any other label is kept.
    expect(row('pno-nov').label).toBe('');
    expect(row('intro-tue').label).toBe('Ages 7–10');
  });

  it('hides ended sessions, past one-off dates included, unless “Ended” is chosen', () => {
    expect(row('pno-sep').state).toBe('ended');
    expect(ids(filterRows(rows, none))).not.toContain('pno-sep');
    expect(ids(filterRows(rows, { ...none, ended: true }))).toEqual(['pno-sep']);
  });

  it('filters by openings, waitlist, under 5 and term', () => {
    expect(ids(filterRows(rows, { ...none, openings: true })).sort()).toEqual(['intro-spring', 'pno-nov']);
    expect(ids(filterRows(rows, { ...none, waitlist: true }))).toEqual(['intro-tue']);
    // Only weekly classes need 5 to run.
    expect(ids(filterRows(rows, { ...none, under5: true }))).toEqual(['intro-spring']);
    expect(ids(filterRows(rows, { ...none, term: 'Spring 2027' }))).toEqual(['intro-spring']);
    expect(filterRows(rows, { ...none, waitlist: true, under5: true })).toEqual([]);
  });

  it('doesn’t count a one-off night of a class as under 5', () => {
    const geode = program('geode', 'class', [session('geode-nov', { days: ['Fri'], startDate: '2026-11-20', endDate: '2026-11-20' }), session('geode-weekly', { days: ['Fri'] })]);
    const r = classRows({ ...content, programs: [geode] }, new Map(), clock);
    expect(r.map((x) => [x.session.id, x.under5])).toEqual([
      ['geode-nov', false],
      ['geode-weekly', true],
    ]);
  });

  it('groups by term in date order', () => {
    const groups = groupByTerm(filterRows(rows, none));
    expect(groups.map((g) => g.term)).toEqual(['Fall 2026', 'Spring 2027']);
    expect(ids(groups[0].rows)).toEqual(['intro-tue', 'pno-nov']);
    expect(termsOf(rows)).toEqual(['Fall 2026', 'Spring 2027']);
  });

  it('reads and writes the filters as a query string, so other pages can link to them', () => {
    const f = classFilters(new URLSearchParams('openings=1&under5=1&term=Fall+2026&show=ended&junk=1'));
    expect(f).toEqual({ ended: true, openings: true, waitlist: false, under5: true, term: 'Fall 2026' });
    expect(classFilters(new URLSearchParams(filterQuery(f).slice(1)))).toEqual(f);
    expect(filterQuery({ ...none })).toBe('');
  });
});

describe('the sign-in sheet’s dates', () => {
  const tue = session('x', { startDate: '2026-08-18', endDate: '2026-12-15' });
  it('shows the next 8 class dates from today, today included', () => {
    expect(signInDates(tue, '2026-10-20')).toEqual(['2026-10-20', '2026-10-27', '2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24', '2026-12-01', '2026-12-08']);
    expect(signInDates(tue, '2026-10-21')[0]).toBe('2026-10-27');
  });
  it('shows fewer near the end, and the last 8 once the class has ended', () => {
    expect(signInDates(tue, '2026-12-02')).toEqual(['2026-12-08', '2026-12-15']);
    expect(signInDates(tue, '2027-01-05')).toHaveLength(8);
    expect(signInDates(tue, '2027-01-05').at(-1)).toBe('2026-12-15');
  });
  it('has a column per date and no care details', () => {
    const t = signInTable([{ name: 'Maya Rivera', status: 'active', allergies: 'Peanuts' } as never], ['2026-10-20', '2026-10-27']);
    expect(t.headers).toEqual(['Student', 'Oct 20', 'Oct 27']);
    expect(t.rows[0][0]).toBe('Maya Rivera');
    expect(JSON.stringify(t)).not.toContain('Peanuts');
  });
});

describe('a class’s roster', () => {
  const SESSION = 'intro-f26-tue';
  const ana: SessionUser = { id: 'u-ana', name: 'Ana Rivera', email: 'ana@example.com', emailVerified: true };
  const bo: SessionUser = { id: 'u-bo', name: 'Bo Chen', email: 'bo@example.com', emailVerified: true };
  const hannah = { id: 'u-hannah', name: 'Hannah', email: 'hannah@example.com', emailVerified: true };
  let A: { id: string };
  let B: { id: string };

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-19T16:00:00Z'));
    const db = await getDb();
    await db.insert(schema.user).values([
      { ...ana, phone: '7065550142' },
      { ...bo, phone: null },
      hannah,
    ]);
    A = await ensureHousehold(ana);
    B = await ensureHousehold(bo);
    await db
      .update(schema.household)
      .set({ emergencyContacts: [{ name: 'Rosa Rivera', relationship: 'Grandma', phone: '7065550199' }], pickupPeople: [{ name: 'Rosa Rivera', relationship: 'Grandma' }] })
      .where(eq(schema.household.id, A.id));
    const maya = await createStudent(A.id, { firstName: 'Maya', lastName: 'Rivera', birthdate: '2018-10-20' }, ana.id);
    const leo = await createStudent(A.id, { firstName: 'Leo', lastName: 'Rivera', birthdate: '2016-01-02' }, ana.id);
    const kai = await createStudent(B.id, { firstName: 'Kai', lastName: 'Chen', birthdate: '2017-05-05' }, bo.id);
    const zoe = await createStudent(B.id, { firstName: 'Zoe', lastName: 'Adams', birthdate: '2017-03-03' }, bo.id);
    const ivy = await createStudent(B.id, { firstName: 'Ivy', lastName: 'Brooks', birthdate: '2017-07-07' }, bo.id);
    await updateStudentDetails(A.id, maya.id, { allergies: 'Peanuts', medicalNotes: '', pickupNotes: '', photoConsent: false }, ana.id);
    const base = { sessionId: SESSION, programSlug: 'intro-to-theater' };
    const old = new Date('2026-08-01T12:00:00Z');
    await db.insert(schema.enrollment).values([
      { ...base, householdId: A.id, studentId: maya.id, status: 'active' },
      { ...base, householdId: A.id, studentId: leo.id, status: 'trial', createdAt: old },
      { ...base, householdId: B.id, studentId: kai.id, status: 'cancelled' },
      { ...base, householdId: B.id, studentId: zoe.id, status: 'waitlist', createdAt: new Date('2026-10-02T12:00:00Z') },
      { ...base, householdId: B.id, studentId: ivy.id, status: 'waitlist', createdAt: new Date('2026-09-30T12:00:00Z') },
    ]);
    const [zoeEnrollment] = await db.select().from(schema.enrollment).where(eq(schema.enrollment.studentId, zoe.id));
    await db.insert(schema.waitlistOffer).values({ enrollmentId: zoeEnrollment.id, householdId: B.id, sessionId: SESSION, offeredAt: new Date('2026-10-15T14:00:00Z') });
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('lists enrolled and trial children by last name, and leaves out cancelled ones', async () => {
    const { students } = await classRoster(SESSION, hannah.id, 'view', '2026-10-19');
    expect(students.map((s) => s.name)).toEqual(['Leo Rivera', 'Maya Rivera']);
    const maya = students[1];
    expect(maya).toMatchObject({ age: 7, allergies: 'Peanuts', photoConsent: false, householdId: A.id });
    expect(maya.parents).toEqual([{ name: 'Ana Rivera', email: 'ana@example.com', phone: '7065550142' }]);
    expect(maya.emergencyContacts).toHaveLength(1);
    expect(maya.badges.map((b) => b.key)).toEqual(['medical', 'no-photos', 'new', 'birthday']);
    // Leo's first enrollment was in August: not new; a trial.
    expect(students[0].badges.map((b) => b.key)).toEqual(['trial']);
  });

  it('lists the waitlist in the order families joined, with an open offer', async () => {
    const { waitlist } = await classRoster(SESSION, hannah.id, 'view', '2026-10-19');
    expect(waitlist.map((s) => s.name)).toEqual(['Ivy Brooks', 'Zoe Adams']);
    expect(waitlist[0]).toMatchObject({ offeredAt: null, age: 9, emergencyContacts: [] });
    expect(waitlist[1].offeredAt?.toISOString()).toBe('2026-10-15T14:00:00.000Z');
  });

  it('writes each view, print and download to the audit log', async () => {
    await classRoster(SESSION, hannah.id, 'csv');
    await classRoster(SESSION, hannah.id, 'sign-in-pdf');
    const db = await getDb();
    const log = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, SESSION));
    expect(log.map((l) => l.action)).toEqual(expect.arrayContaining(['admin.roster.view', 'admin.roster.csv', 'admin.roster.sign-in-pdf']));
    expect(log.every((l) => l.userId === hannah.id)).toBe(true);
  });

  it('downloads the same children with care details, and says when there’s no emergency contact', async () => {
    const { students } = await classRoster(SESSION, hannah.id, 'csv', '2026-10-19');
    const t = rosterTable(students);
    expect(t.headers).toEqual(['Student', 'Age', 'Status', 'Parents', 'Allergies', 'Medical notes', 'Pickup', 'Emergency contacts', 'Photos']);
    expect(t.rows.map((r) => r[0])).toEqual(students.map((s) => s.name));
    expect(t.rows[1]).toEqual(['Maya Rivera', '7', 'Enrolled', 'Ana Rivera, (706) 555-0142', 'Peanuts', '', 'Rosa Rivera (Grandma)', 'Rosa Rivera (Grandma), (706) 555-0199', 'No']);
    expect(t.rows[0][2]).toBe('Trial');
  });

  it('is empty for a class no one has joined', async () => {
    expect(await classRoster('nobody-here', hannah.id)).toEqual({ students: [], waitlist: [] });
  });
});
