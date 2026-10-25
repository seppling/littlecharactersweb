/**
 * Reports (src/server/reports/): each count against hand-made rows, then the
 * rules that hold across the database: a dashboard number equals its
 * report's total, the money-by-month count equals Payments received,
 * favorites are per staff member, and only owners get reports.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Program, Session } from '@/content/types';
import type { ClassRow } from '@/server/classes';
import { getCatalog } from '@/server/content';
import { getDb, schema } from '@/server/db';
import { confirmOrder, createDraftOrder, createStudent, ensureHousehold, fulfillOrder } from '@/server/family';
import { paymentsReceived, sumCents, type AttentionItem } from '@/server/payments-admin';
import { requireStaff } from '@/server/staff';
import { csvCell, lastSeason, readFilters, filterQuery, seasonsOf, sortRows, thisSeason, weekStart, type Content } from '@/server/reports/common';
import { toCsv } from '@/lib/csv';
import { compareText, dashboard } from '@/server/reports/dashboard';
import { atRiskFrom, childrenFrom, classesFrom, comingBackFrom, dropsFrom, freeClassFrom, signupsByWeekFrom, type EnrollRow, type OrderLite } from '@/server/reports/enrollment';
import { favorites, setFavorite } from '@/server/reports/favorites';
import { heardAboutFrom, newFamiliesFrom, zipFrom, type FamilyRow } from '@/server/reports/growth';
import { findReport, Loads, REPORTS, runReport } from '@/server/reports/library';
import { agingBucket, chargesFrom, collectedIn, discountsFrom, loadMoney, refundsFrom, whoOwesFrom, type MoneyData } from '@/server/reports/money';
import { attendanceTakenFrom, careFrom, type CareRow } from '@/server/reports/safety';
import { teacherAttendanceFrom, teacherClassesFrom } from '@/server/reports/teachers';
import { niceMax, axisLabel } from '@/lib/chart';

// ───────────── Hand-made content ─────────────

const sess = (id: string, term: string, startDate: string, endDate: string, extra: Partial<Session> = {}): Session =>
  ({ id, term, days: ['Tue'], start: '16:00', end: '17:00', startDate, endDate, locationId: 'hq', status: 'open', capacity: 10, ...extra }) as Session;
const prog = (slug: string, title: string, sessions: Session[], kind: Program['kind'] = 'class'): Program => ({ slug, title, kind, sessions }) as unknown as Program;

const programs = [
  prog('intro', 'Intro to Theater', [sess('intro-s26', 'Spring 2026', '2026-01-13', '2026-05-12'), sess('intro-f26', 'Fall 2026', '2026-08-18', '2026-12-15')]),
  prog('troupe', 'Troupe', [sess('troupe-s26', 'Spring 2026', '2026-01-14', '2026-05-13'), sess('troupe-f26', 'Fall 2026', '2026-08-19', '2026-12-16', { capacity: undefined })]),
  prog('long', 'Production', [sess('long-f26', 'Fall 2026 – Spring 2027', '2026-08-17', '2027-03-31')]),
];
const content = {
  programs,
  events: [],
  site: { lateJoinWeeks: 2 },
  findSession: (id: string) => {
    for (const p of programs) for (const s of p.sessions) if (s.id === id) return { program: p, session: s };
    return undefined;
  },
  programBySlug: (slug: string) => programs.find((p) => p.slug === slug),
  locationById: () => ({ shortName: 'HQ' }),
} as unknown as Content;

const at = (iso: string) => new Date(`${iso}T15:00:00Z`);
let n = 0;
const kid = (studentId: string, sessionId: string, status: EnrollRow['status'], created = '2026-08-01', extra: Partial<EnrollRow> = {}): EnrollRow => ({
  id: `e${++n}`,
  studentId,
  firstName: studentId.toUpperCase(),
  lastName: 'Sample',
  householdId: `h-${studentId}`,
  family: `${studentId} family`,
  sessionId,
  status,
  createdAt: at(created),
  cancelledAt: null,
  dropReason: null,
  ...extra,
});
const row = (session: Session, filled: number, extra: Partial<ClassRow> = {}): ClassRow =>
  ({ program: content.findSession(session.id)!.program, session, term: session.term, label: '', when: 'Tue', teacher: 'Pat', location: 'HQ', filled, trial: 0, capacity: session.capacity, openings: undefined, waitlist: 0, state: 'running', under5: filled < 5, ...extra }) as ClassRow;
const S = (id: string) => content.findSession(id)!.session;

describe('seasons', () => {
  it('orders terms by their first class and finds this season and the one before it', () => {
    expect(seasonsOf(programs).map((s) => s.term)).toEqual(['Spring 2026', 'Fall 2026 – Spring 2027', 'Fall 2026']);
    // Running today: the latest-starting weekly class's term (as a family's page counts it).
    expect(thisSeason(programs, '2026-10-19')).toBe('Fall 2026');
    // A weekly class running today decides; the term that ended before it began is last season, not an overlapping one.
    expect(lastSeason(programs, 'Fall 2026')).toBe('Spring 2026');
    expect(lastSeason(programs, 'Spring 2026')).toBeNull();
    expect(thisSeason(programs, '2026-06-01')).toMatch(/^Fall 2026/);
  });

  it('reads and writes filters, refusing junk', () => {
    const f = readFilters(new URLSearchParams('season=Fall 2026&month=2026-13&week=2026-10-21&who=all&sort=3&dir=desc&class=intro-f26'));
    expect(f).toEqual({ season: 'Fall 2026', week: '2026-10-21', who: 'all', sort: 3, dir: 'desc', class: 'intro-f26' });
    expect(readFilters(new URLSearchParams(filterQuery(f)))).toEqual(f);
    expect(weekStart('2026-10-25')).toBe('2026-10-19');
  });

  it('sorts numbers as numbers and leaves empty cells last', () => {
    const rows = [{ cells: ['a', 10] }, { cells: ['b', null] }, { cells: ['c', 9] }, { cells: ['d', 100] }];
    expect(sortRows(rows, 1).map((r) => r.cells[0])).toEqual(['c', 'a', 'd', 'b']);
    expect(sortRows(rows, 1, 'desc').map((r) => r.cells[0])).toEqual(['d', 'a', 'c', 'b']);
  });
});

// ───────────── Money ─────────────

const money = (): MoneyData => ({
  orders: [
    // Spring: one monthly sign-up with the 15%, and a fee.
    { id: 'o1', householdId: 'h1', family: 'A family', sessionId: 'intro-s26', plan: 'monthly', studentIds: ['s1'], paidAt: at('2026-01-05'), totalCents: 11075, lines: [{ kind: 'tuition', label: 'x', amountCents: 9500 }, { kind: 'discount', label: '15% multi-class / multi-student discount', amountCents: -1425 }, { kind: 'fee', label: 'fee', amountCents: 3000 }] },
    // Fall: paid in full with the 10%, a free first class, a drop-in.
    { id: 'o2', householdId: 'h2', family: 'B family', sessionId: 'intro-f26', plan: 'full', studentIds: ['s2'], paidAt: at('2026-08-10'), totalCents: 36000, lines: [{ kind: 'tuition', label: 'x', amountCents: 40000 }, { kind: 'discount', label: '10% pay-in-full discount', amountCents: -4000 }] },
    { id: 'o3', householdId: 'h3', family: 'C family', sessionId: 'intro-f26', plan: 'trial', studentIds: ['s3'], paidAt: at('2026-08-20'), totalCents: 0, lines: [{ kind: 'tuition', label: 'first class free', amountCents: 0 }] },
    { id: 'o4', householdId: 'h3', family: 'C family', sessionId: 'troupe-f26', plan: 'drop_in', studentIds: ['s3'], paidAt: at('2026-09-02'), totalCents: 2500, lines: [{ kind: 'tuition', label: 'Drop-in', amountCents: 2500 }] },
  ],
  charges: [
    { id: 'i1', orderId: 'o1', householdId: 'h1', sessionId: 'intro-s26', dueDate: '2026-02-01', amountCents: 6075, baseAmountCents: 8075, regularAmountCents: 9500, adjustments: [{ adjustmentId: 'adj-staff', label: 'Scholarship', cents: 2000 }], lateFeeCents: 1500, status: 'paid', paidAt: at('2026-02-12') },
    { id: 'i2', orderId: 'o1', householdId: 'h1', sessionId: 'intro-s26', dueDate: '2026-03-01', amountCents: 7075, baseAmountCents: 8075, regularAmountCents: 9500, adjustments: [{ adjustmentId: 'adj-credit', label: 'Credit', cents: 1000 }], lateFeeCents: 0, status: 'failed', paidAt: null },
    { id: 'i3', orderId: 'o1', householdId: 'h1', sessionId: 'intro-s26', dueDate: '2026-04-01', amountCents: 8075, baseAmountCents: 8075, regularAmountCents: 9500, adjustments: [], lateFeeCents: 0, status: 'cancelled', paidAt: null },
    { id: 'i4', orderId: 'o1', householdId: 'h1', sessionId: 'intro-s26', dueDate: '2026-05-01', amountCents: 8075, baseAmountCents: 8075, regularAmountCents: 9500, adjustments: [], lateFeeCents: 0, status: 'scheduled', paidAt: null },
  ],
  refunds: [{ id: 'r1', householdId: 'h2', family: 'B family', orderId: 'o2', installmentId: null, amountCents: 5000, status: 'succeeded', createdAt: at('2026-08-20') }],
  creditAdjustments: new Set(['adj-credit']),
  dayOffAdjustments: new Set(),
  dropIns: [{ sessionId: 'troupe-f26', classDate: '2026-09-08', priceCents: 2500, status: 'booked', orderId: 'o4' }],
});

describe('money', () => {
  it('counts collected net of refunds, in the month the money moved', () => {
    expect(collectedIn(money(), '2026-08')).toEqual({ payments: 36000, refunds: 5000, net: 31000 });
    // February: the paid charge with its late fee.
    expect(collectedIn(money(), '2026-02').net).toBe(7575);
  });

  it('charges by type and season: due charges and late fees, not stopped or future ones', () => {
    const spring = chargesFrom(money(), content, '2026-04-15', { season: 'Spring 2026' });
    expect(spring.rows.map((r) => r.cells)).toEqual([
      ['Spring 2026', 'Tuition', 3, 8075 + 6075 + 7075],
      ['Spring 2026', 'Fees', 1, 3000],
      ['Spring 2026', 'Late fees', 1, 1500],
    ]);
    const all = chargesFrom(money(), content, '2026-10-01', {});
    expect(all.total.value).toBe(8075 + 6075 + 7075 + 8075 + 3000 + 1500 + 36000 + 2500);
  });

  it('discounts as a share of full price, each kind apart; free first classes counted, not priced', () => {
    const spring = discountsFrom(money(), content, { season: 'Spring 2026' });
    const by = Object.fromEntries(spring.rows.map((r) => [r.cells[0], r.cells.slice(1)]));
    // 15%: 1425 at sign-up and 1425 on each of the three charges not stopped.
    expect(by['Family discount (15%)'].slice(0, 2)).toEqual([4, 1425 * 4]);
    expect(by['Staff discounts'].slice(0, 2)).toEqual([1, 2000]);
    expect(by['Credits'].slice(0, 2)).toEqual([1, 1000]);
    expect(spring.total.value).toBe(1425 * 4 + 3000);
    // Full price: the sign-up's 9500 and three charges' 9500.
    expect(spring.total.label).toContain(`of $380 full price`);
    const fall = discountsFrom(money(), content, { season: 'Fall 2026' });
    expect(fall.rows.map((r) => [r.cells[0], r.cells[1], r.cells[2]])).toEqual([
      ['Season discount (10%)', 1, 4000],
      ['Free first classes', 1, null],
    ]);
  });

  it('refunds belong to their class’s season', () => {
    expect(refundsFrom(money(), content, { season: 'Fall 2026' }).total.value).toBe(5000);
    expect(refundsFrom(money(), content, { season: 'Spring 2026' }).rows).toEqual([]);
  });

  it('puts overdue charges in aging buckets, edges included', () => {
    expect([0, 30, 31, 60, 61, 90, 91].map(agingBucket)).toEqual(['0–30 days', '0–30 days', '31–60 days', '31–60 days', '61–90 days', '61–90 days', '90+ days']);
    const item = (id: string, days: number, cents: number) => ({ id, orderId: 'o', householdId: 'h', family: 'F', sessionId: 'intro-f26', label: 'x', dueDate: '2026-09-01', status: 'failed', amountCents: cents, lateFeeCents: 0, reason: 'Card declined', attempts: 1, retryOn: null, held: true, daysOverdue: days, payLinkSentAt: null }) as AttentionItem;
    const r = whoOwesFrom([item('a', 5, 1000), item('b', 95, 2000)], content, {});
    expect(r.total.value).toBe(3000);
    expect(r.rows.map((x) => x.cells[5])).toEqual(['90+ days', '0–30 days']);
  });
});

// ───────────── Enrollment ─────────────

describe('enrollment', () => {
  const enrollments = [
    kid('ava', 'intro-f26', 'active'),
    kid('ava', 'troupe-f26', 'active'), // a child in two classes is one child
    kid('ben', 'intro-f26', 'trial', '2026-08-20'),
    kid('cy', 'intro-f26', 'waitlist'),
    kid('dee', 'intro-f26', 'cancelled', '2026-08-02', { dropReason: 'Schedule', cancelledAt: at('2026-09-01') }),
    kid('eve', 'intro-f26', 'cancelled', '2026-08-02', { dropReason: 'Schedule', cancelledAt: at('2026-09-10') }),
    kid('fay', 'troupe-f26', 'cancelled'),
    kid('ava', 'intro-s26', 'active', '2026-01-05'),
    kid('gus', 'intro-s26', 'active', '2026-01-06'),
  ];

  it('counts each child this season once', () => {
    const r = childrenFrom({ enrollments }, content, 'Fall 2026', {});
    expect(r.total.value).toBe(2);
    expect(r.rows.find((x) => x.cells[0] === 'AVA Sample')!.cells[2]).toBe(2);
    expect(childrenFrom({ enrollments }, content, 'Fall 2026', { program: 'troupe' }).total.value).toBe(1);
    expect(childrenFrom({ enrollments: [] }, content, 'Fall 2026', {}).total).toMatchObject({ value: null, display: 'None yet' });
  });

  it('fill rate per class and overall; a class with no limit has no rate', () => {
    const r = classesFrom([row(S('intro-f26'), 6), row(S('troupe-f26'), 3, { capacity: undefined }), row(S('intro-s26'), 9)], 'Fall 2026', {});
    expect(r.rows.map((x) => [x.cells[0], x.cells[5]])).toEqual([
      ['Intro to Theater', 60],
      ['Troupe', null],
    ]);
    expect(r.total).toMatchObject({ value: 60, display: '60%' });
    expect(classesFrom([row(S('intro-f26'), 0)], 'Fall 2026', {}).total).toMatchObject({ value: null, display: 'No one enrolled yet' });
  });

  it('drops by class and reason', () => {
    const r = dropsFrom({ enrollments }, content, { season: 'Fall 2026' });
    expect(r.rows.map((x) => x.cells.slice(0, 4))).toEqual([
      ['Intro to Theater', 'Fall 2026', 'Schedule', 2],
      ['Troupe', 'Fall 2026', 'No reason given', 1],
    ]);
    expect(r.rows[0].cells[4]).toBe('2026-09-10');
  });

  it('free class to paid: a later paid sign-up for the same child, in any class', () => {
    const orders: OrderLite[] = [
      { id: 't1', householdId: 'h-ben', sessionId: 'intro-f26', plan: 'trial', studentIds: ['ben'], createdAt: at('2026-08-20'), paidAt: at('2026-08-20') },
      { id: 't2', householdId: 'h-cy', sessionId: 'intro-f26', plan: 'trial', studentIds: ['cy'], createdAt: at('2026-08-21'), paidAt: at('2026-08-21') },
      { id: 'p1', householdId: 'h-ben', sessionId: 'troupe-f26', plan: 'monthly', studentIds: ['ben'], createdAt: at('2026-08-28'), paidAt: at('2026-08-28') },
      // Paid before the trial: doesn't count as staying on.
      { id: 'p0', householdId: 'h-cy', sessionId: 'intro-s26', plan: 'monthly', studentIds: ['cy'], createdAt: at('2026-01-02'), paidAt: at('2026-01-02') },
    ];
    const r = freeClassFrom({ enrollments, orders }, content, 'Fall 2026', {});
    expect(r.total).toMatchObject({ value: 1, display: '1 of 2', label: 'Free class to paid: 50%' });
    expect(r.rows.map((x) => x.cells[4])).toEqual(['Troupe', 'Not yet']);
  });

  it('coming back: from the site, from Studio Director’s numbers, or not at all', () => {
    const site = comingBackFrom({ enrollments }, content, 'Fall 2026', 'Spring 2026', null, {});
    expect(site.total).toMatchObject({ value: 1, display: '1 of 2' });
    expect(site.rows.map((x) => [x.cells[0], x.cells[3]])).toEqual([
      ['GUS Sample', 'Not back yet'],
      ['AVA Sample', 'Back'],
    ]);
    const typed = comingBackFrom({ enrollments }, content, 'Fall 2026', null, { season: 'Spring 2026', children: 120, returning: 84, classes: [], monthly: [] }, {});
    expect(typed.total).toMatchObject({ value: 84, display: '84 of 120' });
    expect(typed.rows).toEqual([]);
    expect(comingBackFrom({ enrollments }, content, 'Fall 2026', null, null, {}).total).toMatchObject({ value: null, display: 'No earlier season yet' });
  });

  it('sign-ups per week, beside last season’s same week', () => {
    const r = signupsByWeekFrom({ enrollments }, content, 'Fall 2026', 'Spring 2026', '2026-09-01', {});
    // Fall's first class is Tue Aug 18 (week of Aug 17); Spring's is Tue Jan 13 (week of Jan 12).
    const byWeek = Object.fromEntries(r.rows.map((x) => [String(x.cells[0]).replace(/ \(.*/, ''), [x.cells[1], x.cells[2]]]));
    expect(byWeek['3 weeks before']).toEqual([5, 0]); // made Aug 1–2: Ava twice, Dee, Eve and Fay (dropped later); the waitlist doesn't count
    expect(byWeek['1 week before']).toEqual([0, 2]);
    expect(byWeek['Week 1']).toEqual([1, 0]);
    expect(r.total.value).toBe(6);
  });

  it('classes at risk: weekly classes under 5 within two weeks of their first class', () => {
    const r = atRiskFrom([row(S('intro-f26'), 3), row(S('troupe-f26'), 7), row(S('intro-s26'), 1)], '2026-08-25', {});
    expect(r.rows.map((x) => x.cells[0])).toEqual(['Intro to Theater']);
    expect(atRiskFrom([row(S('intro-f26'), 3)], '2026-09-10', {}).rows).toEqual([]);
  });
});

// ───────────── Growth, safety, teachers ─────────────

describe('growth', () => {
  const families: FamilyRow[] = [
    { id: 'h-ava', name: 'A', zip: '30601', heardAbout: 'friend', source: 'portal' },
    { id: 'h-ben', name: 'B', zip: '30605', heardAbout: 'other: the library', source: 'portal' },
    { id: 'h-cy', name: 'C', zip: '30601', heardAbout: 'friend', source: 'studio-director' },
    { id: 'h-dee', name: 'D', zip: null, heardAbout: null, source: 'portal' },
  ];
  const enrollments = [kid('ava', 'intro-f26', 'active'), kid('ben', 'intro-f26', 'trial'), kid('cy', 'intro-f26', 'active'), kid('dee', 'intro-s26', 'active', '2026-01-04'), kid('dee', 'intro-f26', 'active')];

  it('new families this season by how they heard; families brought over from Studio Director aren’t new', () => {
    const r = heardAboutFrom(families, enrollments, content, 'Fall 2026', {});
    expect(r.rows.map((x) => x.cells.slice(0, 2))).toEqual([
      ['A friend or family member', 1],
      ['Something else: the library', 1],
    ]);
    expect(heardAboutFrom(families, enrollments, content, 'Fall 2026', { who: 'all' }).total.value).toBe(4);
  });

  it('ZIP codes most first, and new families by month', () => {
    expect(zipFrom(families, enrollments, content, 'Fall 2026', { who: 'all' }).rows.map((x) => x.cells.slice(0, 2))).toEqual([
      ['30601', 2],
      ['30605', 1],
      ['Not given', 1],
    ]);
    const months = newFamiliesFrom(families, enrollments, '2026-10-19');
    expect(months.total.value).toBe(3);
    expect(months.rows.find((x) => x.cells[0] === 'Jan 2026')!.cells[1]).toBe(1);
  });
});

describe('safety and teachers', () => {
  it('care details on file: each child once, all three needed', () => {
    const now = at('2026-10-19');
    const care = (studentId: string, sessionId: string, extra: Partial<CareRow>): CareRow => ({ studentId, firstName: studentId, lastName: 'S', householdId: 'h', family: 'F', sessionId, detailsConfirmedAt: at('2026-08-01'), emergencyContacts: 1, pickupPeople: 1, ...extra });
    const r = careFrom([care('a', 'intro-f26', {}), care('a', 'troupe-f26', {}), care('b', 'intro-f26', { pickupPeople: 0 }), care('c', 'intro-s26', { emergencyContacts: 0 })], content, '2026-10-19', now, {});
    expect(r.total).toMatchObject({ value: 1, display: '1 of 2' });
  });

  it('attendance taken this week: met, ended, with children, not a day off', () => {
    const classes = [row(S('intro-f26'), 6), row(S('troupe-f26'), 0)];
    const r = attendanceTakenFrom({ classes, reports: new Map([['intro-f26 2026-10-20', 'Pat']]), daysOff: [], dropIns: new Map([['troupe-f26 2026-10-20', 1]]), present: new Map([['intro-f26 2026-10-20', 5]]) }, '2026-10-22', at('2026-10-22'), '2026-10-22', {});
    expect(r.rows.map((x) => [x.cells[1], x.cells[3], x.cells[4]])).toEqual([
      ['Intro to Theater', 'Yes, by Pat', 5],
      ['Troupe', 'Not yet', null],
    ]);
    expect(r.total.display).toBe('1 of 2');
    const off = attendanceTakenFrom({ classes, reports: new Map(), daysOff: [{ id: 'd', date: '2026-10-20', sessionId: null, reason: 'Fall break' }], dropIns: new Map(), present: new Map() }, '2026-10-22', at('2026-10-22'), '2026-10-22', {});
    expect(off.rows).toEqual([]);
  });

  it('teachers: Settings → Staff first, else the site’s name; attendance per teacher', () => {
    const classes = [row(S('intro-f26'), 6), row(S('troupe-f26'), 4, { teacher: 'Sam on the site' })];
    const links = [{ sessionId: 'intro-f26', name: 'Lee', role: 'lead' as const }, { sessionId: 'intro-f26', name: 'Ari', role: 'assistant' as const }];
    expect(teacherClassesFrom(classes, links, 'Fall 2026', {}).rows.map((x) => [x.cells[0], x.cells[4]])).toEqual([
      ['Ari', 'Assists'],
      ['Lee', 'Teaches'],
      ['Sam on the site', 'Named on the site'],
    ]);
    const r = teacherAttendanceFrom({ classes, teacherLinks: links, reports: new Set(['intro-f26 2026-08-18']), daysOff: [], dropIns: new Map() }, 'Fall 2026', '2026-08-26', at('2026-08-26'), {});
    expect(r.rows.find((x) => x.cells[0] === 'Lee')!.cells.slice(1, 5)).toEqual([1, 2, 1, 1]);
    // Lee and Ari share Intro's two dates: the total counts each class date once.
    expect(r.total.display).toBe('1 of 3');
  });
});

describe('charts and comparisons', () => {
  it('rounds the scale up and words the comparison', () => {
    expect([0, 3, 7, 12, 240, 99999].map(niceMax)).toEqual([1, 5, 10, 20, 250, 100000]);
    expect(axisLabel(250000, 'money')).toBe('$2.5k');
    expect(compareText(120, 112, 'Spring 2026')).toBe('↑ 8 on Spring 2026');
    expect(compareText(9000, 12000, 'Oct 2025', 'money')).toBe('↓ $30 on Oct 2025');
    expect(compareText(5, 5, 'Spring 2026')).toBe('Same as Spring 2026');
  });
});

// ───────────── With the database ─────────────

describe('with the database', () => {
  const HANNAH = { id: 'u-rep-hannah', name: 'Hannah', email: 'hannah@example.com', emailVerified: true };
  let catalog: Awaited<ReturnType<typeof getCatalog>>;

  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-10T16:00:00Z'));
    catalog = await getCatalog();
    const db = await getDb();
    await db.insert(schema.user).values(HANNAH);
    for (const [tag, kids] of [['quill', ['Rue']], ['marsh', ['Ode', 'Pip']]] as const) {
      const u = { id: `u-${tag}`, name: `Pat ${tag}`, email: `${tag}@example.com`, emailVerified: true };
      await db.insert(schema.user).values(u);
      const h = await ensureHousehold(u);
      await db.update(schema.household).set({ stripeCustomerId: `cus_${tag}`, stripePaymentMethodId: `pm_${tag}`, zip: '30601', heardAbout: 'friend' }).where(eq(schema.household.id, h.id));
      const ids = [];
      for (const k of kids) ids.push((await createStudent(h.id, { firstName: k, lastName: tag, birthdate: '2017-05-05' }, u.id)).id);
      const o = await confirmOrder(h.id, (await createDraftOrder(h.id, u.id, 'intro-f26-tue', ids)).id, 'monthly', u.id);
      await fulfillOrder(o.id, u.id);
    }
  });
  afterAll(() => vi.useRealTimers());

  const ctx = () => ({ content: catalog as unknown as Content, today: '2026-09-10', now: new Date() });

  it('every dashboard number equals its report’s total, with the same filters', async () => {
    const d = await dashboard(ctx(), HANNAH.id);
    for (const t of [...d.tiles, ...d.small]) {
      const r = await runReport(findReport(t.key)!, readFilters(new URL(t.href, 'http://x').searchParams), new Loads(ctx()), HANNAH.id);
      expect(r.total, t.key).toEqual(t.total);
    }
    expect(d.tiles.find((t) => t.key === 'children')!.total.value).toBe(3);
    expect(d.tiles.find((t) => t.key === 'payments-received')!.total.value).toBeGreaterThan(0);
    expect(d.owes.result.total).toEqual((await runReport(findReport('who-owes')!, {}, new Loads(ctx()), HANNAH.id)).total);
  });

  it('money by month counts the same as Payments received', async () => {
    const data = await loadMoney();
    for (const month of ['2026-08', '2026-09']) expect(collectedIn(data, month).net).toBe(sumCents(await paymentsReceived(month)));
  });

  it('runs every report in the library', async () => {
    const loads = new Loads(ctx());
    for (const def of REPORTS) {
      const r = await runReport(def, {}, loads, HANNAH.id);
      expect(r.columns.length, def.key).toBeGreaterThan(0);
      for (const x of r.rows) expect(x.cells, def.key).toHaveLength(r.columns.length);
    }
  });

  it('keeps favorites per staff member', async () => {
    const db = await getDb();
    const [a] = await db.insert(schema.staff).values({ email: 'rep-a@example.com', name: 'A', role: 'owner' }).returning();
    const [b] = await db.insert(schema.staff).values({ email: 'rep-b@example.com', name: 'B', role: 'owner' }).returning();
    expect(await setFavorite(a.id, 'who-owes', true)).toBe(true);
    await setFavorite(a.id, 'who-owes', true);
    await setFavorite(a.id, 'children', true);
    expect(await setFavorite(a.id, 'no-such-report', true)).toBe(false);
    expect(await favorites(a.id)).toEqual(['who-owes', 'children']);
    expect(await favorites(b.id)).toEqual([]);
    await setFavorite(a.id, 'who-owes', false);
    expect(await favorites(a.id)).toEqual(['children']);
  });

  it('turns teachers and families away', () => {
    const teacher = { user: { id: 'u-t', email: 't@example.com' } as App.Locals['user'], isAdmin: false };
    expect(requireStaff(teacher).response?.status).toBe(404);
    expect(requireStaff({ user: HANNAH as unknown as App.Locals['user'], isAdmin: true }).response).toBeNull();
  });
});

describe('report spreadsheets', () => {
  it('writes money as numbers, so a refund adds up instead of becoming text', () => {
    expect(csvCell(95000, 'money')).toBe(950);
    expect(csvCell(-9500, 'money')).toBe(-95);
    expect(csvCell(-1, 'money')).toBe(-0.01);
    const csv = toCsv(['What', 'Amount'], [['Tuition', csvCell(95000, 'money')], ['Refund', csvCell(-9500, 'money')]]);
    expect(csv).toContain('Refund,-95\r\n');
    expect(csv).not.toContain("'-95");
  });
});
