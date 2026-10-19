/**
 * One class on one date (src/server/class-day.ts): which day off applies, a
 * class's dates with their days off, booked drop-ins (not pending or
 * cancelled), and places left.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Program, Session } from '@/content/types';
import { getDb, schema } from '@/server/db';
import { classDates, classDay, classDayFrom, dayOffFrom, dayOffOn, daysOffBetween, dropInCounts, dropInsOn } from '@/server/class-day';

const SID = 'class-day-tue';
const OTHER = 'class-day-wed';
const session = { id: SID, term: 'Fall 2026', days: ['Tue'], start: '16:30', end: '17:30', startDate: '2026-11-03', endDate: '2026-11-24', locationId: 'x', capacity: 4, status: 'open' } as Session;
const program = { slug: 'class-day-test', kind: 'class', title: 'Class Day Test', sessions: [session] } as unknown as Program;

let householdId = '';
const kids: string[] = [];

beforeAll(async () => {
  const db = await getDb();
  const [h] = await db.insert(schema.household).values({ name: 'Class Day Family' }).returning();
  householdId = h.id;
  for (const firstName of ['Ada', 'Ben', 'Cy']) {
    const [s] = await db.insert(schema.student).values({ householdId, firstName, lastName: 'Test', birthdate: '2017-01-01' }).returning();
    kids.push(s.id);
  }
  await db.insert(schema.enrollment).values([
    { householdId, studentId: kids[0], sessionId: SID, programSlug: program.slug, status: 'active' },
    { householdId, studentId: kids[1], sessionId: SID, programSlug: program.slug, status: 'trial' },
    { householdId, studentId: kids[2], sessionId: OTHER, programSlug: program.slug, status: 'cancelled' },
  ]);
  await db.insert(schema.closure).values([
    { date: '2026-11-24', sessionId: null, reason: 'Thanksgiving week' },
    { date: '2026-11-10', sessionId: SID, reason: 'Teacher out' },
    { date: '2026-11-10', sessionId: OTHER, reason: 'Other class only' },
  ]);
  await db.insert(schema.dropIn).values([
    { sessionId: SID, classDate: '2026-11-17', studentId: kids[2], householdId, priceCents: 2500, status: 'booked' },
    { sessionId: SID, classDate: '2026-11-17', studentId: kids[1], householdId, priceCents: 2500, status: 'pending' },
    { sessionId: SID, classDate: '2026-11-03', studentId: kids[2], householdId, priceCents: 2500, status: 'cancelled' },
    { sessionId: OTHER, classDate: '2026-11-18', studentId: kids[2], householdId, priceCents: 2500, status: 'booked' },
  ]);
});

describe('dayOffFrom', () => {
  const off = [
    { date: '2026-11-10', sessionId: null, reason: 'All' },
    { date: '2026-11-10', sessionId: 'a', reason: 'Just a' },
    { date: '2026-11-11', sessionId: 'b', reason: 'Just b' },
  ];
  it('prefers the class’s own day off, then one for every class', () => {
    expect(dayOffFrom(off, 'a', '2026-11-10')?.reason).toBe('Just a');
    expect(dayOffFrom(off, 'b', '2026-11-10')?.reason).toBe('All');
  });
  it('ignores other dates and other classes', () => {
    expect(dayOffFrom(off, 'a', '2026-11-11')).toBeNull();
    expect(dayOffFrom(off, 'b', '2026-11-12')).toBeNull();
  });
});

describe('days off from the database', () => {
  it('lists a range by date, whole-day ones first', async () => {
    const rows = await daysOffBetween('2026-11-01', '2026-11-30');
    expect(rows.map((r) => [r.date, r.sessionId === null])).toEqual([
      ['2026-11-10', false],
      ['2026-11-10', false],
      ['2026-11-24', true],
    ]);
  });
  it('finds the day off for one class and date', async () => {
    expect((await dayOffOn(SID, '2026-11-10'))?.reason).toBe('Teacher out');
    expect((await dayOffOn(SID, '2026-11-24'))?.reason).toBe('Thanksgiving week');
    expect(await dayOffOn(SID, '2026-11-17')).toBeNull();
  });
  it('marks a class’s dates, which stay the same dates', async () => {
    expect((await classDates(session)).map((d) => [d.date, d.dayOff?.reason ?? null])).toEqual([
      ['2026-11-03', null],
      ['2026-11-10', 'Teacher out'],
      ['2026-11-17', null],
      ['2026-11-24', 'Thanksgiving week'],
    ]);
  });
});

describe('drop-ins', () => {
  it('counts only booked ones', async () => {
    expect((await dropInsOn(SID, '2026-11-17')).map((d) => d.studentId)).toEqual([kids[2]]);
    expect(await dropInsOn(SID, '2026-11-03')).toEqual([]);
  });
  it('totals per class date, optionally for some classes', async () => {
    const all = await dropInCounts('2026-11-01', '2026-11-30');
    expect(all.get(`${SID} 2026-11-17`)).toBe(1);
    expect(all.get(`${OTHER} 2026-11-18`)).toBe(1);
    expect((await dropInCounts('2026-11-01', '2026-11-30', [SID])).has(`${OTHER} 2026-11-18`)).toBe(false);
    expect((await dropInCounts('2026-11-01', '2026-11-30', [])).size).toBe(0);
  });
});

describe('classDay', () => {
  it('adds enrolled, trial and booked drop-ins, and works out places left', async () => {
    expect(await classDay(program, session, '2026-11-17')).toMatchObject({ meets: true, dayOff: null, enrolled: 2, dropIns: 1, expected: 3, capacity: 4, placesLeft: 1 });
  });
  it('shows a day off, and a date the class doesn’t meet', async () => {
    expect((await classDay(program, session, '2026-11-24')).dayOff?.reason).toBe('Thanksgiving week');
    expect((await classDay(program, session, '2026-11-18')).meets).toBe(false);
  });
  it('never goes below no places, and has none to count without a limit', () => {
    const base = { sessionId: 'x', date: '2026-11-03', meets: true, dayOff: null, enrolled: 5, dropIns: 1 };
    expect(classDayFrom({ ...base, capacity: 4 }).placesLeft).toBe(0);
    expect(classDayFrom({ ...base, capacity: undefined }).placesLeft).toBeUndefined();
  });
});
