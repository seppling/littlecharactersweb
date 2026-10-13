/**
 * The top of a class page: the day and time in the summary, what the
 * "Choose a time" card repeats, and the Performance(s) label.
 */
import { describe, expect, it } from 'vitest';
import { cardParts, performanceLabel, sessionLines, whenSummary } from '@/lib/class-summary';
import { programs } from '@/content/seed/programs';
import type { Session } from '@/content/types';

const weekly = (over: Partial<Session> = {}): Session => ({
  id: 'w', term: 'Fall 2026', days: ['Tue'], start: '17:15', end: '18:15',
  startDate: '2026-08-17', endDate: '2026-12-18', locationId: 'hq', status: 'open',
  price: { amount: 95, unit: 'month' }, ...over,
});
const dated = (date: string, over: Partial<Session> = {}): Session =>
  weekly({ id: date, days: ['Sat'], start: '17:00', end: '20:00', startDate: date, endDate: date, ...over });
const seed = (slug: string) => programs.find((p) => p.slug === slug)!;

describe('the day and time in the summary', () => {
  it('reads like a sentence for one weekly session', () => {
    expect(whenSummary([weekly()])).toEqual({ lines: ['Tuesdays, 5:15–6:15 pm'], seeAll: false, seeAllLabel: '' });
  });

  it('lists each different time, once', () => {
    const s = [weekly(), weekly({ id: 'b' }), weekly({ id: 'c', days: ['Thu'], start: '16:00', end: '17:00' })];
    expect(whenSummary(s)?.lines).toEqual(['Tuesdays, 5:15–6:15 pm', 'Thursdays, 4–5 pm']);
  });

  it('names the date for one-day sessions', () => {
    expect(whenSummary(seed('free-community-class').sessions)?.lines).toEqual(['Thu, Oct 15, 4:15–5:15 pm', 'Mon, Nov 2, 4–5 pm']);
  });

  it('points to the card when there are too many dates', () => {
    expect(whenSummary(seed('parents-night-out').sessions)).toEqual({ lines: ['5–8 pm on 4 dates'], seeAll: true, seeAllLabel: 'See the dates below' });
  });

  it('points to the card when there are too many different times', () => {
    const s = (['Mon', 'Tue', 'Wed', 'Thu'] as const).map((d) => weekly({ id: d, days: [d] }));
    expect(whenSummary(s)).toEqual({ lines: [], seeAll: true, seeAllLabel: 'See times below' });
  });

  it('says nothing without sessions (the program’s own “When” stays)', () => {
    expect(whenSummary([])).toBeUndefined();
  });
});

describe('what the card repeats', () => {
  it('only the dates and spots when there is one session', () => {
    const parts = cardParts([weekly()]);
    expect(parts).toEqual({ time: false, place: false, price: false });
    expect(sessionLines(weekly(), parts, 'HQ')).toEqual({ title: 'Fall 2026', meta: 'Aug 17 – Dec 18' });
  });

  it('the time, place and price when they differ between sessions', () => {
    const s = [weekly(), weekly({ id: 'b', days: ['Thu'], locationId: 'athens-academy', price: { amount: 115, unit: 'month' } })];
    const parts = cardParts(s);
    expect(parts).toEqual({ time: true, place: true, price: true });
    expect(sessionLines(s[1], parts, 'Athens Academy')).toEqual({ title: 'Thursdays · 5:15–6:15 pm', meta: 'Aug 17 – Dec 18 · Athens Academy' });
  });

  it('just the date for nights at the same time', () => {
    const s = [dated('2026-10-24', { label: 'Sat, Oct 24' }), dated('2026-11-14')];
    const parts = cardParts(s);
    expect(sessionLines(s[0], parts)).toEqual({ title: 'Sat, Oct 24', meta: '' });
    expect(sessionLines(s[1], parts)).toEqual({ title: 'Sat, Nov 14', meta: '' });
  });

  it('a session sold by a school and one with a price differ', () => {
    expect(cardParts([weekly(), weekly({ id: 'b', price: undefined, externalUrl: 'https://example.org' })]).price).toBe(true);
  });
});

describe('Performance or Performances', () => {
  it.each([
    ['Ends with a performance at our Variety Show in December.', 'Performance'],
    ['A fully staged, completely original production.', 'Performance'],
    ['A show on October 30.', 'Performance'],
    ['Most mini camps end with a short performance at pickup.', 'Performance'],
    ['Mid-season showcase and a big show at the end of the term.', 'Performances'],
    ['Short performances around town this fall, then a full-length production in spring.', 'Performances'],
    ['Student films screen at our Variety Show.', 'Performances'],
  ])('%s → %s', (text, label) => {
    expect(performanceLabel(text)).toBe(label);
  });
});
