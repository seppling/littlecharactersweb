/**
 * Class dates retire on their own: the dates decide when a session can be
 * booked and when it leaves the site; Hannah's status only adds limits.
 * Every test freezes "now" (Athens time).
 */
import { describe, expect, it } from 'vitest';
import {
  athensNow,
  bookingClock,
  bookingProblem,
  canBook,
  isOffered,
  lateJoinWeeksOr,
  offeredSessions,
  sessionState,
  signupsCloseAt,
  type BookingClock,
} from '@/lib/session-dates';
import { programs } from '@/content/seed/programs';
import type { Program, Session } from '@/content/types';

const at = (now: string, lateJoinWeeks = 4): BookingClock => ({ now, lateJoinWeeks });

// Intro to Theater's shape: Tuesdays, Aug 17 – Dec 18, monthly.
const weekly = (over: Partial<Session> = {}): Session => ({
  id: 'w', term: 'Fall 2026', days: ['Tue'], start: '17:15', end: '18:15',
  startDate: '2026-08-17', endDate: '2026-12-18', locationId: 'hq', status: 'open',
  price: { amount: 95, unit: 'month' }, ...over,
});
// Parents' Night Out's shape: one Saturday evening.
const night = (over: Partial<Session> = {}): Session =>
  weekly({ id: 'n', days: ['Sat'], start: '17:00', end: '20:00', startDate: '2026-10-24', endDate: '2026-10-24', ...over });
// A camp week, Monday to Friday.
const campWeek = (over: Partial<Session> = {}): Session =>
  weekly({ id: 'c', term: 'Summer 2027', label: 'Week 1', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start: '09:00', end: '15:00', startDate: '2027-06-07', endDate: '2027-06-11', ...over });

const cls = { kind: 'class' } as Program;
const party = { kind: 'party' } as Program;
const camp = { kind: 'camp' } as Program;

describe('Athens time', () => {
  it('reads the clock in Athens, not in UTC', () => {
    // 01:30 UTC on Oct 25 is still the evening of Oct 24 in Athens (EDT, UTC−4).
    expect(athensNow(new Date('2026-10-25T01:30:00Z'))).toBe('2026-10-24T21:30');
    // After the clocks change: EST, UTC−5.
    expect(athensNow(new Date('2026-12-01T04:30:00Z'))).toBe('2026-11-30T23:30');
    expect(athensNow(new Date('2026-10-24T04:00:00Z'))).toBe('2026-10-24T00:00');
  });

  it('builds a clock from the setting, falling back to 4 weeks', () => {
    expect(bookingClock(6, new Date('2026-10-13T16:00:00Z'))).toEqual({ now: '2026-10-13T12:00', lateJoinWeeks: 6 });
    expect(bookingClock(undefined).lateJoinWeeks).toBe(4);
    expect(lateJoinWeeksOr(-1)).toBe(4);
    expect(lateJoinWeeksOr(2.5)).toBe(4);
    expect(lateJoinWeeksOr('3')).toBe(4);
    expect(lateJoinWeeksOr(0)).toBe(0);
  });
});

describe('a one-night date', () => {
  const s = night();
  it('can be booked before the day', () => {
    expect(sessionState(party, s, at('2026-10-20T09:00'))).toBe('open');
    expect(canBook(party, s, at('2026-10-20T09:00'))).toBe(true);
  });
  it('can be booked on the day, until it starts', () => {
    expect(canBook(party, s, at('2026-10-24T16:59'))).toBe(true);
  });
  it('closes when it starts, and leaves the site', () => {
    expect(sessionState(party, s, at('2026-10-24T17:00'))).toBe('signups-closed');
    expect(canBook(party, s, at('2026-10-24T17:00'))).toBe(false);
    expect(isOffered(party, s, at('2026-10-24T18:30'))).toBe(false);
  });
  it('has ended the day after', () => {
    expect(sessionState(party, s, at('2026-10-24T23:59'))).toBe('signups-closed');
    expect(sessionState(party, s, at('2026-10-25T00:00'))).toBe('ended');
  });
  it('a one-day session closes at its start even in a weekly-class program', () => {
    expect(signupsCloseAt(cls, s, 4)).toBe('2026-10-24T17:00');
  });
});

describe('a weekly class', () => {
  const s = weekly();
  it('closes 4 weeks before the last day by default', () => {
    expect(signupsCloseAt(cls, s, 4)).toBe('2026-11-20T00:00');
  });
  it('can be booked before the season starts', () => {
    expect(canBook(cls, s, at('2026-08-01T10:00'))).toBe(true);
  });
  it('can be booked mid-season (late joiners are prorated)', () => {
    expect(sessionState(cls, s, at('2026-10-13T10:00'))).toBe('open');
    expect(canBook(cls, s, at('2026-11-19T23:59'))).toBe(true);
  });
  it('closes inside the cut-off, but is still running', () => {
    expect(sessionState(cls, s, at('2026-11-20T00:00'))).toBe('signups-closed');
    expect(canBook(cls, s, at('2026-12-01T10:00'))).toBe(false);
    expect(isOffered(cls, s, at('2026-12-01T10:00'))).toBe(false);
  });
  it('has ended after the last day', () => {
    expect(sessionState(cls, s, at('2026-12-18T20:00'))).toBe('signups-closed');
    expect(sessionState(cls, s, at('2026-12-19T00:00'))).toBe('ended');
  });
  it('follows the setting', () => {
    expect(canBook(cls, s, at('2026-11-25T10:00', 2))).toBe(true);
    expect(canBook(cls, s, at('2026-12-04T10:00', 2))).toBe(false);
    expect(signupsCloseAt(cls, s, 0)).toBe('2026-12-18T00:00');
  });
  it('never closes before it starts, however short', () => {
    const short = weekly({ startDate: '2026-10-20', endDate: '2026-11-03' });
    expect(signupsCloseAt(cls, short, 4)).toBe('2026-10-20T17:15');
    expect(canBook(cls, short, at('2026-10-20T17:00'))).toBe(true);
    expect(canBook(cls, short, at('2026-10-20T17:15'))).toBe(false);
  });
});

describe('a camp week', () => {
  const s = campWeek();
  it('can be booked until the week starts', () => {
    expect(canBook(camp, s, at('2027-06-07T08:59'))).toBe(true);
    expect(sessionState(camp, s, at('2027-06-07T09:00'))).toBe('signups-closed');
  });
  it('has ended after the Friday', () => {
    expect(sessionState(camp, s, at('2027-06-12T08:00'))).toBe('ended');
  });
});

describe('Hannah’s status, on top of the dates', () => {
  const mid = at('2026-10-13T10:00');
  const after = at('2026-11-25T10:00');
  it('open and few-left are bookable while the dates allow, never after', () => {
    for (const status of ['open', 'few-left'] as const) {
      expect(canBook(cls, weekly({ status }), mid)).toBe(true);
      expect(canBook(cls, weekly({ status }), after)).toBe(false);
    }
  });
  it('waitlist: families can join the waitlist only while the dates allow', () => {
    expect(canBook(cls, weekly({ status: 'waitlist' }), mid)).toBe(true);
    expect(canBook(cls, weekly({ status: 'waitlist' }), after)).toBe(false);
  });
  it('coming soon is shown, not bookable, and goes away with the dates', () => {
    expect(isOffered(cls, weekly({ status: 'coming-soon' }), mid)).toBe(true);
    expect(canBook(cls, weekly({ status: 'coming-soon' }), mid)).toBe(false);
    expect(isOffered(cls, weekly({ status: 'coming-soon' }), after)).toBe(false);
  });
  it('closed is never shown or bookable', () => {
    expect(isOffered(cls, weekly({ status: 'closed' }), mid)).toBe(false);
    expect(canBook(cls, weekly({ status: 'closed' }), mid)).toBe(false);
  });
});

describe('the words a family sees when a date is refused', () => {
  const p = { kind: 'class', title: 'Intro to Theater' } as Program;
  it('says why', () => {
    expect(bookingProblem(p, weekly(), at('2026-10-13T10:00'))).toBeNull();
    expect(bookingProblem(p, weekly(), at('2026-12-01T10:00'))).toBe('Sign-ups for Intro to Theater (Fall 2026) closed 4 weeks before the last class.');
    expect(bookingProblem(p, weekly(), at('2026-12-12T10:00', 1))).toContain('a week before the last class');
    expect(bookingProblem(p, weekly(), at('2027-01-05T10:00'))).toBe('This Intro to Theater date has already happened.');
    expect(bookingProblem(p, weekly({ status: 'closed' }), at('2026-10-13T10:00'))).toBe('Sign-ups for this Intro to Theater date are closed.');
    const pno = { kind: 'party', title: 'Parents’ Night Out' } as Program;
    expect(bookingProblem(pno, night(), at('2026-10-24T18:00'))).toBe('Sign-ups for this Parents’ Night Out date closed when it started.');
  });
});

describe('the starting content', () => {
  const pno = programs.find((p) => p.slug === 'parents-night-out')!;
  it('Parents’ Night Out no longer offers Sep 25 once it has passed', () => {
    const ids = offeredSessions(pno, at('2026-10-13T10:00')).map((s) => s.id);
    expect(ids).not.toContain('pno-2026-09-25');
    expect(ids).toContain('pno-2026-10-24');
  });
});

describe('the late-joining cut-off setting', () => {
  it('starts at 4 weeks, and a site saved before the setting existed gets 4 too', async () => {
    const { buildSiteContent } = await import('@/content/site-content');
    const { pages: seedPages } = await import('@/content/seed/pages');
    expect(seedPages.site.signups.lateJoinWeeks).toBe(4);
    expect(buildSiteContent([]).site.lateJoinWeeks).toBe(4);
    const { signups: _, ...older } = seedPages.site;
    expect(buildSiteContent([{ collection: 'pages', id: 'site', position: 0, data: older }]).site.lateJoinWeeks).toBe(4);
  });
  it('follows what Hannah sets', async () => {
    const { buildSiteContent } = await import('@/content/site-content');
    const { pages: seedPages } = await import('@/content/seed/pages');
    const data = { ...seedPages.site, signups: { lateJoinWeeks: 2 } };
    expect(buildSiteContent([{ collection: 'pages', id: 'site', position: 0, data }]).site.lateJoinWeeks).toBe(2);
  });
});
