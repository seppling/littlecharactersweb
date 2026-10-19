/**
 * Today and "Needs attention" (src/server/today.ts): what meets on a day, the
 * next day with classes, and each kind of attention item with its date window
 * ("under 5" around the first class, birthdays, the 7-day windows).
 */
import { describe, expect, it } from 'vitest';
import type { EventItem, Program, Session } from '@/content/types';
import { bookingClock } from '@/lib/session-dates';
import { classRows } from '@/server/classes';
import {
  attentionFrom,
  attentionGroups,
  classesOn,
  devDay,
  isUrgent,
  nextClassDay,
  todaysAttention,
  type AttentionInput,
  type EnrolledChild,
} from '@/server/today';

const session = (id: string, over: Partial<Session> = {}): Session => ({
  id,
  term: 'Fall 2026',
  days: ['Tue'],
  start: '16:30',
  end: '17:30',
  startDate: '2026-10-20',
  endDate: '2026-12-15',
  locationId: 'hq',
  status: 'open',
  teacher: 'Zack Newcott',
  ...over,
});
const program = (slug: string, kind: Program['kind'], sessions: Session[]) => ({ slug, title: `Title ${slug}`, kind, sessions }) as unknown as Program;

const programs = [
  program('intro', 'class', [session('intro-tue', { capacity: 12 })]),
  program('film', 'class', [session('film-thu', { days: ['Thu'], start: '17:30', end: '18:30', startDate: '2026-08-20' })]),
  program('improv', 'class', [session('improv-nov', { days: ['Thu'], start: '18:30', end: '20:30', startDate: '2026-11-19', endDate: '2026-11-19', label: 'Thu, Nov 19' })]),
  program('pno', 'workshop', [session('pno-nov', { days: ['Fri'], start: '17:00', end: '20:00', startDate: '2026-11-13', endDate: '2026-11-13' })]),
];
const locationById = (id: string | undefined) => (id === 'hq' ? ({ id: 'hq', shortName: 'Studio', name: 'The Studio' } as never) : undefined);
const findSession = (id: string) => {
  for (const p of programs) for (const s of p.sessions) if (s.id === id) return { program: p, session: s };
  return undefined;
};
const content = { programs, locationById, findSession };
const counts = new Map([
  ['intro-tue', { active: 8, trial: 0, waitlist: 2 }],
  ['film-thu', { active: 3, trial: 1, waitlist: 0 }],
  ['improv-nov', { active: 1, trial: 0, waitlist: 0 }],
]);
const rowsAt = (now: string) => classRows(content, counts, bookingClock(4, new Date(now)));

const show: EventItem = { slug: 'fall-show', title: 'Fall Showcase', kind: 'show', times: [{ start: '2026-10-20T19:00', end: '2026-10-20T20:00' }], venue: 'The Morton', summary: '' } as unknown as EventItem;
const pnoNight: EventItem = { slug: 'pno', title: 'Parents’ Night Out', kind: 'drop-off', times: [{ start: '2026-11-13T17:00', end: '2026-11-13T20:00' }], programSlug: 'pno', summary: '' } as unknown as EventItem;

describe('classesOn and nextClassDay', () => {
  const rows = rowsAt('2026-10-20T12:00:00Z');

  it('lists the classes meeting that day and events not booked as a class, by time', () => {
    const day = classesOn(rows, [show, pnoNight], '2026-10-20', content);
    expect(day.map((c) => c.title)).toEqual(['Title intro', 'Fall Showcase']);
    expect(day[0]).toMatchObject({ time: '4:30–5:30 pm', places: '8 of 12', location: 'Studio', teacher: 'Zack Newcott', href: '/admin/classes/intro-tue', kind: 'class' });
    expect(day[1]).toMatchObject({ time: '7–8 pm', location: 'The Morton', places: '', href: '/events/fall-show', kind: 'event' });
  });

  it('shows an event booked through a class once, as the class', () => {
    const day = classesOn(rowsAt('2026-11-13T12:00:00Z'), [pnoNight], '2026-11-13', content);
    expect(day.map((c) => c.title)).toEqual(['Title pno']);
  });

  it('a class on its first day counts; the day before its start does not', () => {
    expect(classesOn(rows, [], '2026-10-13', content).map((c) => c.title)).toEqual([]);
    expect(classesOn(rows, [], '2026-10-15', content).map((c) => c.title)).toEqual(['Title film']);
  });

  it('finds the next day with classes', () => {
    const next = nextClassDay(rows, [], '2026-10-21', content);
    expect(next?.date).toBe('2026-10-22');
    expect(next?.classes.map((c) => c.title)).toEqual(['Title film']);
    expect(nextClassDay(rows, [], '2027-01-01', content)).toBeNull();
  });
});

const NOW = new Date('2026-10-20T16:00:00Z'); // noon in Athens
const TODAY = '2026-10-20';
const kid = (over: Partial<EnrolledChild> = {}): EnrolledChild => ({
  enrollmentId: 'e1',
  sessionId: 'intro-tue',
  status: 'active',
  createdAt: new Date('2026-09-01T12:00:00Z'),
  studentId: 's1',
  firstName: 'Maya',
  lastName: 'Rivera',
  birthdate: '2018-03-02',
  detailsConfirmedAt: new Date('2026-09-01T12:00:00Z'),
  householdId: 'h1',
  family: 'Rivera family',
  emergencyContacts: 1,
  ...over,
});
const input = (over: Partial<AttentionInput> = {}): AttentionInput => ({ payments: [], classes: [], enrolled: [], leads: [], ...over });
const kinds = (i: AttentionInput, today = TODAY, now = NOW) => attentionFrom(i, content, today, now).map((x) => x.kind);

describe('attentionFrom', () => {
  it('failed and processing payments are alerts linking to failed payments', () => {
    const items = attentionFrom(
      input({
        payments: [
          { id: 'i1', family: 'Rivera family', label: 'November tuition', dueDate: '2026-11-01', status: 'failed', amountCents: 9500, lastError: 'card_declined', retryOn: '2026-11-03', payNowOpenedAt: null },
          { id: 'i2', family: 'Chen family', label: 'November tuition', dueDate: '2026-11-01', status: 'failed', amountCents: 9500, lastError: 'card_declined', retryOn: null, payNowOpenedAt: new Date() },
        ],
      }),
      content,
      TODAY,
      NOW,
    );
    expect(items.map((i) => [i.tone, i.title, i.action.href])).toEqual([
      ['alert', 'Payment failed: Rivera family', '/admin/payments?show=failed'],
      ['alert', 'Payment on hold: Chen family', '/admin/payments?show=failed'],
    ]);
    expect(items[0].detail).toBe('$95 · November tuition · card declined, tries again Tue, Nov 3');
  });

  it('a class with a waitlist and an open place is a waitlist opening', () => {
    const items = attentionFrom(input({ classes: rowsAt('2026-10-20T12:00:00Z') }), content, TODAY, NOW).filter((i) => i.kind === 'waitlist');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ tone: 'warning', title: 'Waitlist opening: Title intro', detail: '4 places open, 2 waiting · Tuesdays · 4:30–5:30 pm', action: { href: '/admin/classes/intro-tue' } });
  });

  it('a full class with a waitlist is not', () => {
    const full = new Map([['intro-tue', { active: 12, trial: 0, waitlist: 2 }]]);
    const rows = classRows(content, full, bookingClock(4, NOW));
    expect(kinds(input({ classes: rows }))).not.toContain('waitlist');
  });

  describe('classes under 5, from 14 days before the first class to 14 days after', () => {
    // Film (first class Thu Aug 20) has 4; Intro (first class Tue Oct 20) has 8; the one-night improv class doesn't count.
    const under5 = (today: string) => attentionFrom(input({ classes: rowsAt(`${today}T12:00:00Z`) }), content, today, new Date(`${today}T16:00:00Z`)).filter((i) => i.kind === 'under5');
    it('shows 14 days before', () => expect(under5('2026-08-06')).toHaveLength(1));
    it('not 15 days before', () => expect(under5('2026-08-05')).toHaveLength(0));
    it('shows 14 days after', () => expect(under5('2026-09-03')[0]).toMatchObject({ title: 'Title film has 4 of the 5 it needs', action: { href: '/admin/classes?under5=1' } }));
    it('not 15 days after', () => expect(under5('2026-09-04')).toHaveLength(0));
    it('one-off nights never count', () => expect(under5('2026-11-19')).toHaveLength(0));
  });

  it('families with a current class and no emergency contact, once each', () => {
    const items = attentionFrom(
      input({ enrolled: [kid({ emergencyContacts: 0 }), kid({ enrollmentId: 'e2', studentId: 's2', firstName: 'Leo', emergencyContacts: 0, sessionId: 'film-thu' }), kid({ householdId: 'h2', family: 'Chen family', studentId: 's3' })] }),
      content,
      TODAY,
      NOW,
    ).filter((i) => i.kind === 'emergency');
    expect(items).toEqual([{ kind: 'emergency', tone: 'warning', title: 'No emergency contact: Rivera family', detail: 'Maya and Leo in Title intro and Title film', action: { label: 'Open family', href: '/admin/families/h1' } }]);
  });

  it('an ended class is not a current enrollment', () => {
    const old = { ...content, findSession: (id: string) => (id === 'old' ? { program: programs[0], session: session('old', { endDate: '2026-06-01' }) } : findSession(id)) };
    expect(attentionFrom(input({ enrolled: [kid({ sessionId: 'old', emergencyContacts: 0 })] }), old, TODAY, NOW)).toEqual([]);
  });

  it('care details not confirmed within a year', () => {
    const items = attentionFrom(
      input({ enrolled: [kid({ detailsConfirmedAt: null }), kid({ studentId: 's2', firstName: 'Leo', detailsConfirmedAt: new Date('2025-10-19T12:00:00Z') }), kid({ studentId: 's3', firstName: 'Ana', detailsConfirmedAt: new Date('2025-10-22T12:00:00Z') })] }),
      content,
      TODAY,
      NOW,
    ).filter((i) => i.kind === 'care');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ tone: 'neutral', detail: 'Maya and Leo: not confirmed by a parent in the past year' });
  });

  it('new sign-ups in the last 7 days, by class', () => {
    const items = attentionFrom(
      input({
        enrolled: [
          kid({ createdAt: new Date(NOW.getTime() - 7 * 86_400_000 + 60_000), status: 'trial' }),
          kid({ studentId: 's2', firstName: 'Leo', createdAt: new Date(NOW.getTime() - 7 * 86_400_000 - 60_000) }),
        ],
      }),
      content,
      TODAY,
      NOW,
    ).filter((i) => i.kind === 'signups');
    expect(items).toEqual([{ kind: 'signups', tone: 'good', title: '1 new sign-up: Title intro', detail: 'Maya R. (free trial)', action: { label: 'Open class', href: '/admin/classes/intro-tue' } }]);
  });

  it('messages and sign-ups from the site in the last 7 days', () => {
    const day = 86_400_000;
    const items = attentionFrom(
      input({
        leads: [
          { kind: 'contact', createdAt: new Date(NOW.getTime() - day) },
          { kind: 'contact', createdAt: new Date(NOW.getTime() - 2 * day) },
          { kind: 'newsletter', createdAt: new Date(NOW.getTime() - 6 * day) },
          { kind: 'notify', createdAt: new Date(NOW.getTime() - 8 * day) },
        ],
      }),
      content,
      TODAY,
      NOW,
    );
    expect(items).toEqual([{ kind: 'leads', tone: 'neutral', title: '3 new messages and sign-ups from the site', detail: 'Message: 2 · Newsletter: 1', action: { label: 'Read them', href: '/admin/leads' } }]);
  });

  it('birthdays from today through the next 6 days', () => {
    const born = (studentId: string, firstName: string, birthdate: string) => kid({ studentId, firstName, birthdate });
    const items = attentionFrom(
      input({ enrolled: [born('a', 'Ana', '2019-10-20'), born('b', 'Ben', '2018-10-26'), born('c', 'Cy', '2018-10-27'), born('d', 'Di', '2018-10-19'), born('e', 'Ed', '2019-10-21')] }),
      content,
      TODAY,
      NOW,
    ).filter((i) => i.kind === 'birthdays');
    expect(items.map((i) => i.title)).toEqual(['Ana Rivera turns 7 today', 'Ed Rivera turns 7 tomorrow', 'Ben Rivera turns 8 on Mon']);
    expect(items[2].detail).toBe('Mon, Oct 26 · Title intro');
  });

  it('a birthday across New Year, and Feb 29 in a common year', () => {
    const at = (today: string, birthdate: string) => attentionFrom(input({ enrolled: [kid({ birthdate })] }), { findSession: () => ({ program: programs[0], session: session('x', { endDate: '2027-12-31' }) }) }, today, new Date(`${today}T16:00:00Z`)).filter((i) => i.kind === 'birthdays');
    expect(at('2026-12-29', '2019-01-02')[0]?.title).toBe('Maya Rivera turns 8 on Sat');
    expect(at('2027-02-25', '2020-02-29')[0]?.detail).toMatch(/^Sun, Feb 28/);
  });

  it('orders kinds most urgent first and counts alert and warning items', () => {
    const items = attentionFrom(
      input({
        enrolled: [kid({ emergencyContacts: 0, detailsConfirmedAt: null, birthdate: '2019-10-21', createdAt: NOW })],
        payments: [{ id: 'i1', family: 'Rivera family', label: 'Nov', dueDate: '2026-11-01', status: 'processing', amountCents: 100, lastError: null, retryOn: null, payNowOpenedAt: null }],
      }),
      content,
      TODAY,
      NOW,
    );
    expect(items.map((i) => i.kind)).toEqual(['payments', 'emergency', 'care', 'signups', 'birthdays']);
    expect(items.filter(isUrgent)).toHaveLength(2);
    expect(attentionGroups(items).map((g) => [g.kind, g.items.length])).toEqual([
      ['payments', 1],
      ['emergency', 1],
      ['care', 1],
      ['signups', 1],
      ['birthdays', 1],
    ]);
  });
});

describe('todaysAttention', () => {
  it('shows 3 of each kind, 5 families without an emergency contact, and counts the rest', () => {
    const enrolled = Array.from({ length: 7 }, (_, n) => kid({ householdId: `h${n}`, family: `F${n}`, studentId: `s${n}`, emergencyContacts: 0, detailsConfirmedAt: null }));
    const { shown, hidden } = todaysAttention(attentionFrom(input({ enrolled }), content, TODAY, NOW));
    expect(shown.filter((i) => i.kind === 'emergency')).toHaveLength(5);
    expect(shown.filter((i) => i.kind === 'care')).toHaveLength(3);
    expect(hidden).toBe(2 + 4);
  });
});

describe('devDay', () => {
  it('takes ?on= only when allowed', () => {
    expect(devDay(new URLSearchParams('on=2026-10-20'), true)).toBe('2026-10-20');
    expect(devDay(new URLSearchParams('on=2026-10-20'), false)).toBeNull();
    expect(devDay(new URLSearchParams('on=tomorrow'), true)).toBeNull();
  });
});
