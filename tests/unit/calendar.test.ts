/**
 * The staff calendar's pure half (src/server/calendar.ts): the month grid,
 * weeks, each day's classes with "8/12" and days off, filters, and the two
 * schedule downloads.
 */
import { describe, expect, it } from 'vitest';
import type { EventItem, Program, Session } from '@/content/types';
import type { ClassRow } from '@/server/classes';
import { calendarDays, calendarMonth, calendarWeek, classScheduleTable, dailyScheduleTable, monthGrid, shiftMonth, weekTitle, type CalendarData } from '@/server/calendar';

const row = (id: string, slug: string, days: Session['days'], over: Partial<ClassRow> = {}): ClassRow =>
  ({
    program: { slug, title: `Title ${slug}` } as Program,
    session: { id, days, start: '16:30', end: '17:30', startDate: '2026-11-01', endDate: '2026-11-30', locationId: 'studio' } as Session,
    term: 'Fall 2026',
    label: '',
    when: '',
    teacher: 'Site Teacher',
    location: 'Studio',
    filled: 8,
    trial: 0,
    capacity: 12,
    openings: 4,
    waitlist: 0,
    state: 'open',
    under5: false,
    ...over,
  }) as ClassRow;

const content = { locationById: (id: string) => (id === 'studio' ? { shortName: 'Studio' } : undefined) } as never;
const data = (over: Partial<CalendarData> = {}): CalendarData => ({
  rows: [row('tue', 'intro', ['Tue']), row('thu', 'acting', ['Thu'], { session: { id: 'thu', days: ['Thu'], start: '18:00', end: '19:00', startDate: '2026-11-01', endDate: '2026-11-30', locationId: 'annex' } as Session, location: 'Annex' })],
  events: [{ slug: 'show', title: 'Winter Show', kind: 'show', locationId: 'studio', times: [{ start: '2026-11-26T19:00', end: '2026-11-26T20:30' }] } as unknown as EventItem],
  daysOff: [
    { id: 'a', date: '2026-11-26', sessionId: null, reason: 'Thanksgiving' },
    { id: 'b', date: '2026-11-10', sessionId: 'tue', reason: 'Teacher out' },
  ],
  teachers: new Map([['tue', ['Hannah', 'Sam']]]),
  ...over,
});

describe('months and weeks', () => {
  it('a month is whole weeks, Sunday to Saturday', () => {
    const g = monthGrid('2026-11');
    expect([g[0], g[g.length - 1], g.length]).toEqual(['2026-11-01', '2026-12-05', 35]);
    expect(monthGrid('2027-02')[0]).toBe('2027-01-31');
  });
  it('reads the address, else this month or week', () => {
    expect(calendarMonth('2026-13', '2026-10-19')).toBe('2026-10');
    expect(calendarMonth('2026-12', '2026-10-19')).toBe('2026-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(calendarWeek('2026-11-26', '2026-10-19')).toBe('2026-11-22');
    expect(calendarWeek('nope', '2026-10-19')).toBe('2026-10-18');
    expect(weekTitle('2026-11-29')).toBe('Nov 29–Dec 5, 2026');
  });
});

describe('the days', () => {
  it('lists each day’s classes with places and teachers, and the days off', () => {
    const days = calendarDays(data(), ['2026-11-10', '2026-11-12', '2026-11-26'], {}, content);
    expect(days[0].entries.map((e) => [e.title, e.places, e.teacher, e.dayOff])).toEqual([['Title intro', '8/12', 'Hannah, Sam', 'Teacher out']]);
    expect(days[0].entries[0].rosterHref).toBe('/admin/teach/tue/2026-11-10');
    expect(days[1].entries.map((e) => [e.title, e.teacher, e.dayOff])).toEqual([['Title acting', 'Site Teacher', null]]);
    expect(days[2].dayOff?.reason).toBe('Thanksgiving');
    expect(days[2].entries.map((e) => [e.kind, e.title, e.dayOff])).toEqual([
      ['class', 'Title acting', 'Thanksgiving'],
      ['event', 'Winter Show', null],
    ]);
  });
  it('filters by program, location and teacher', () => {
    const dates = ['2026-11-24', '2026-11-26'];
    const titles = (f: Parameters<typeof calendarDays>[2]) => calendarDays(data(), dates, f, content).flatMap((d) => d.entries.map((e) => e.title));
    expect(titles({ program: 'intro' })).toEqual(['Title intro']);
    expect(titles({ location: 'annex' })).toEqual(['Title acting']);
    expect(titles({ teacher: 'Sam' })).toEqual(['Title intro']);
    expect(titles({ teacher: 'Site Teacher' })).toEqual(['Title acting']);
  });
  it('downloads: one row per class and date, and one per class with its dates and days off', () => {
    const days = calendarDays(data(), ['2026-11-24', '2026-11-26'], {}, content);
    expect(dailyScheduleTable(days).rows.map((r) => [r[2], r[6]])).toEqual([['Title intro', ''], ['Title acting', 'Thanksgiving'], ['Winter Show', '']]);
    expect(classScheduleTable(days).rows.map((r) => [r[0], r[5], r[6], r[7]])).toEqual([
      ['Title acting', '0', '', '11/26 (Thanksgiving)'],
      ['Title intro', '1', '11/24', ''],
    ]);
  });
});
