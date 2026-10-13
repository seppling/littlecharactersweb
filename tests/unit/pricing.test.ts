import { describe, expect, it } from 'vitest';
import type { Program, Session } from '@/content/types';
import { availablePlans, defaultPlan, formatCents, hasFreeFirstClass, joiningNow, meetings, monthlySchedule, planCopy, quote, sessionPriceParts, type Plan } from '@/lib/pricing';
import { priceLabel } from '@/lib/format';
import { toStripeLineItems } from '@/server/payments';

// A Tuesday class, Sep 1 – Dec 15 2026: Sep has 5 meetings, Oct 4, Nov 4, Dec 3.
const session: Session = {
  id: 'test-tue',
  term: 'Fall 2026',
  days: ['Tue'],
  start: '17:00',
  end: '18:00',
  startDate: '2026-09-01',
  endDate: '2026-12-15',
  locationId: 'studio',
  price: { amount: 95, unit: 'month' },
  status: 'open',
};
const program = {
  slug: 'test-class',
  title: 'Test Class',
  kind: 'class',
  brand: 'lc',
  gel: 'purple',
  ages: { min: 7, max: 11 },
  fee: { amount: 30, label: 'Performance fee' },
  sessions: [session],
} as unknown as Program;

const maya = { id: 's1', firstName: 'Maya' };
const leo = { id: 's2', firstName: 'Leo' };
const q = (plan: Plan, today: string, students = [maya], otherClassEnrollments = 0, p = program, s = session) =>
  quote({ program: p, session: s, students, plan, otherClassEnrollments, today });

describe('calendar', () => {
  it('lists every Tuesday in the term', () => {
    const all = meetings(session);
    expect(all).toHaveLength(16);
    expect(all[0]).toBe('2026-09-01');
    expect(all.at(-1)).toBe('2026-12-15');
    expect(all.every((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === 2)).toBe(true);
  });

  it('bills whole months when joining in the first week', () => {
    expect(monthlySchedule(session, '2026-09-08')).toEqual([
      { month: '2026-09', share: 1, classes: 5 },
      { month: '2026-10', share: 1, classes: 4 },
      { month: '2026-11', share: 1, classes: 4 },
      { month: '2026-12', share: 1, classes: 3 },
    ]);
  });

  it('prorates the first month by meetings left when joining later', () => {
    // Sep 22 and 29 left of 5 September meetings.
    expect(monthlySchedule(session, '2026-09-22')[0]).toEqual({ month: '2026-09', share: 2 / 5, classes: 2 });
  });
});

describe('monthly plan', () => {
  it('charges the first month plus the one-time fee, and lists what comes later', () => {
    const r = q('monthly', '2026-09-01');
    expect(r.totalCents).toBe(9500 + 3000);
    expect(r.installments).toEqual([
      { dueDate: '2026-10-01', amountCents: 9500, regularAmountCents: 9500, label: 'October tuition: Maya, Test Class' },
      { dueDate: '2026-11-01', amountCents: 9500, regularAmountCents: 9500, label: 'November tuition: Maya, Test Class' },
      { dueDate: '2026-12-01', amountCents: 9500, regularAmountCents: 9500, label: 'December tuition: Maya, Test Class' },
    ]);
    expect(r.later[0]).toBe('Then $95 charged automatically to your saved card on the 1st of October, November and December.');
  });

  it('prorates a late start', () => {
    const r = q('monthly', '2026-09-22');
    // Unchanged by the mid-month rule: 2 of September's 5 meetings left.
    expect(r.lines[0]).toMatchObject({ label: 'Maya: September tuition, 2 classes (prorated)', amountCents: 3800 });
    expect(r.totalCents).toBe(3800 + 3000);
  });

  it('gives 15% off tuition (not fees) for two students', () => {
    const r = q('monthly', '2026-09-01', [maya, leo]);
    expect(r.subtotalCents).toBe(2 * 9500 + 2 * 3000);
    expect(r.discountCents).toBe(Math.round(19000 * 0.15));
    expect(r.later[0]).toContain('$161.50');
    expect(r.installments.every((i) => i.amountCents === 16150)).toBe(true);
  });

  it('gives 15% off when the family is already in another class', () => {
    expect(q('monthly', '2026-09-01', [maya], 1).discountCents).toBe(Math.round(9500 * 0.15));
  });
});

describe('pay in full', () => {
  it('takes 10% off the whole term', () => {
    const r = q('full', '2026-09-01');
    expect(r.installments).toEqual([]);
    expect(r.discountCents).toBe(3800); // 10% of 4 × $95
    expect(r.totalCents).toBe(38000 - 3800 + 3000);
  });

  it('does not stack discounts; the bigger one wins', () => {
    const r = q('full', '2026-09-01', [maya, leo]);
    const discounts = r.lines.filter((l) => l.kind === 'discount');
    expect(discounts).toHaveLength(1);
    expect(discounts[0].label).toMatch(/15%/);
    expect(r.notes.join(' ')).toMatch(/don’t combine/);
  });
});

describe('other plans', () => {
  it('offers a free first class to new students of Little Characters classes only', () => {
    expect(availablePlans(program, session, { newStudents: true, full: false })).toEqual(['trial', 'monthly', 'full']);
    expect(availablePlans(program, session, { newStudents: false, full: false })).toEqual(['monthly', 'full']);
    expect(availablePlans({ ...program, brand: 'geode' }, session, { newStudents: true, full: false })).toEqual(['monthly', 'full']);
    expect(q('trial', '2026-09-01').totalCents).toBe(0);
  });

  it('puts families on the waitlist with nothing due when the class is full', () => {
    expect(availablePlans(program, session, { newStudents: true, full: true })).toEqual(['waitlist']);
    expect(q('waitlist', '2026-09-01').totalCents).toBe(0);
  });

  it('charges nothing for a class that has ended', () => {
    const r = q('monthly', '2027-01-05');
    expect(r.totalCents).toBe(0);
    expect(r.notes).toContain('This class has ended.');
  });

  it('prices Parents’ Night Out per child: $30 first, $10 each additional, no class discount', () => {
    const pno = { ...program, kind: 'party', fee: undefined } as Program;
    const night = { ...session, price: { amount: 30, unit: 'child' as const, additional: 10 } };
    const r = q('once', '2026-09-01', [maya, leo, { id: 's3', firstName: 'Ivy' }], 0, pno, night);
    expect(r.lines.map((l) => l.amountCents)).toEqual([3000, 1000, 1000]);
    expect(r.totalCents).toBe(5000);
  });
});

describe('Stripe line items', () => {
  it('fold discounts into tuition and always add up to the order total', () => {
    for (const students of [[maya], [maya, leo], [maya, leo, { id: 's3', firstName: 'Ivy' }]]) {
      for (const plan of ['monthly', 'full'] as const) {
        const r = q(plan, '2026-09-22', students);
        const items = toStripeLineItems(r.lines, r.totalCents, 'Test');
        expect(items.every((i) => i.price_data.unit_amount > 0)).toBe(true);
        expect(items.reduce((a, i) => a + i.price_data.unit_amount, 0)).toBe(r.totalCents);
      }
    }
  });

  it('formats money the way people write it', () => {
    expect(formatCents(9500)).toBe('$95');
    expect(formatCents(16150)).toBe('$161.50');
  });
});

// ───────────── Decided Oct 13, 2026 (Stephen) ─────────────

// Stories and Songs: Tuesdays Oct 20 – Dec 15 2026, $160 for the session, $30 fee. 9 Tuesdays.
const storiesSession: Session = { ...session, id: 'stories', startDate: '2026-10-20', endDate: '2026-12-15', price: { amount: 160, unit: 'session' } };
const stories = { ...program, slug: 'stories', title: 'Stories and Songs', ages: { min: 4, max: 6 }, sessions: [storiesSession] } as Program;
// Geode Acting Studio: Tuesdays from Oct 20 2026, $95 a month, $30 fee.
const actingSession: Session = { ...session, id: 'acting', startDate: '2026-10-20', endDate: '2026-12-15' };
const acting = { ...program, slug: 'acting', title: 'Acting Studio', brand: 'geode', sessions: [actingSession] } as Program;
// Geode Adult Improv Night: one Thursday, $25.
const improvNight: Session = { ...session, id: 'improv', days: ['Thu'], startDate: '2026-11-19', endDate: '2026-11-19', price: { amount: 25, unit: 'class' } };
const improv = { ...program, slug: 'improv', title: 'Adult Improv Night', brand: 'geode', fee: undefined, ages: { min: 18 }, sessions: [improvNight] } as Program;

describe('free first class on a class priced per session', () => {
  it('is offered to new students of Stories and Songs, not Geode or drop-in nights', () => {
    expect(meetings(storiesSession)).toHaveLength(9);
    expect(hasFreeFirstClass(stories)).toBe(true);
    expect(availablePlans(stories, storiesSession, { newStudents: true, full: false })).toEqual(['trial', 'once']);
    expect(availablePlans(stories, storiesSession, { newStudents: false, full: false })).toEqual(['once']);
    expect(availablePlans({ ...stories, brand: 'geode' } as Program, storiesSession, { newStudents: true, full: false })).toEqual(['once']);
    expect(availablePlans(improv, improvNight, { newStudents: true, full: false })).toEqual(['once']);
    const r = q('trial', '2026-10-13', [maya], 0, stories, storiesSession);
    expect(r.totalCents).toBe(0);
    expect(r.notes[0]).toMatch(/pay for the classes left/);
  });

  it('then charges the classes left, prorated from the session price, plus the fee', () => {
    // Maya's free class was Oct 20; she stays on the next day: 8 of 9 classes left.
    const r = quote({ program: stories, session: storiesSession, students: [maya], plan: 'once', otherClassEnrollments: 0, today: '2026-10-21', trialStudentIds: [maya.id] });
    expect(r.lines[0]).toMatchObject({ label: 'Maya: Stories and Songs (8 of 9 classes, prorated)', amountCents: Math.round((16000 * 8) / 9) });
    expect(r.totalCents).toBe(14222 + 3000);
    // Without a free class, joining in the first week still pays the whole session.
    expect(q('once', '2026-10-21', [maya], 0, stories, storiesSession).lines[0]).toMatchObject({ label: 'Maya: Stories and Songs (9 classes)', amountCents: 16000 });
    // Before the session starts, nothing is left out.
    expect(quote({ program: stories, session: storiesSession, students: [maya], plan: 'once', otherClassEnrollments: 0, today: '2026-10-13', trialStudentIds: [maya.id] }).totalCents).toBe(16000 + 3000);
  });

  it('pre-selects the free class for new students, and monthly for everyone else', () => {
    expect(defaultPlan(['trial', 'monthly', 'full'])).toBe('trial');
    expect(defaultPlan(['trial', 'once'])).toBe('trial');
    expect(defaultPlan(['monthly', 'full'])).toBe('monthly');
    expect(defaultPlan(['once'])).toBe('once');
    expect(defaultPlan(['waitlist'])).toBe('waitlist');
  });
});

describe('a class that starts mid-month', () => {
  it('charges the first month for its classes: Acting Studio from Oct 20 is 2 of 4 Tuesdays, $47.50', () => {
    expect(monthlySchedule(actingSession, '2026-10-13')).toEqual([
      { month: '2026-10', share: 2 / 4, classes: 2 },
      { month: '2026-11', share: 1, classes: 4 },
      { month: '2026-12', share: 1, classes: 3 },
    ]);
    const r = q('monthly', '2026-10-13', [maya], 0, acting, actingSession);
    expect(r.lines[0]).toMatchObject({ label: 'Maya: October tuition, 2 classes (prorated)', amountCents: 4750 });
    expect(r.totalCents).toBe(4750 + 3000);
    expect(r.installments.map((i) => [i.dueDate, i.amountCents])).toEqual([['2026-11-01', 9500], ['2026-12-01', 9500]]);
  });

  it('prices the season from the same shares', () => {
    const r = q('full', '2026-10-13', [maya], 0, acting, actingSession);
    expect(r.lines[0]).toMatchObject({ amountCents: 23750, label: 'Maya: Fall 2026 tuition (3 months, 9 classes)' });
    expect(r.totalCents).toBe(23750 - 2375 + 3000);
  });

  it('leaves late joiners as they were: a class that started on the 1st, joined on the 22nd', () => {
    expect(monthlySchedule(session, '2026-09-22')[0]).toEqual({ month: '2026-09', share: 2 / 5, classes: 2 });
    expect(q('monthly', '2026-09-22').lines[0].amountCents).toBe(3800);
    // A first-week joiner of a class that started on the 1st pays the whole month, as before.
    expect(q('monthly', '2026-09-08').lines[0]).toMatchObject({ amountCents: 9500, label: 'Maya: September tuition, 5 classes' });
  });
});

describe('the 15%', () => {
  it('counts a class priced per session toward the two', () => {
    // A family with Stories and Songs enrolls a sibling in a monthly class: 15% off.
    expect(q('monthly', '2026-09-01', [leo], 1).discountCents).toBe(Math.ceil((9500 * 15) / 100));
  });

  it('never applies to a drop-in night, even with two people in one sign-up', () => {
    const two = q('once', '2026-11-01', [maya, leo], 0, improv, improvNight);
    expect(two.discountCents).toBe(0);
    expect(two.totalCents).toBe(5000);
    expect(q('once', '2026-11-01', [maya], 2, improv, improvNight).discountCents).toBe(0);
  });

  it('keeps two students in one sign-up at 15% for a class priced per session', () => {
    const r = q('once', '2026-10-13', [maya, leo], 0, stories, storiesSession);
    expect(r.discountCents).toBe(4800);
  });

  it('rounds the first month’s 15% in the family’s favor, as the later months', () => {
    // Acting Studio, 2 students: October is 2 × $47.50 = $95 → 15% is $14.25 exactly; with 3 students, $142.50 → $21.375 → $21.38 off.
    const kids = [maya, leo, { id: 's3', firstName: 'Ivy' }];
    expect(q('monthly', '2026-10-13', kids, 0, acting, actingSession).discountCents).toBe(2138);
  });
});

describe('plan labels on the review page', () => {
  const plans = (today: string, students = [maya], others = 0) => ({
    monthly: q('monthly', today, students, others),
    full: q('full', today, students, others),
  });

  it('names the 10% and the saving when paying up front', () => {
    const { monthly, full } = plans('2026-09-01');
    expect(planCopy('full', full, monthly)).toEqual({ title: 'Pay for the season in full', body: '$372 today, 10% off, and you’re done. You save $38 over paying monthly.' });
  });

  it('names the 15% family discount, and says it’s the same as monthly', () => {
    const { monthly, full } = plans('2026-09-01', [maya], 1);
    expect(full.lines.find((l) => l.kind === 'discount')?.label).toMatch(/15%/);
    expect(planCopy('full', full, monthly).body).toBe(`${formatCents(full.totalCents)} today with the 15% family discount, and you’re done. It’s the same total as paying monthly.`);
    expect(planCopy('full', full, monthly).body).not.toMatch(/10%/);
  });

  it('keeps the other plans’ words', () => {
    expect(planCopy('trial', q('trial', '2026-09-01')).title).toBe('Try the first class free');
    expect(planCopy('monthly', q('monthly', '2026-09-01')).body).toBe('$125 today, then charged automatically on the 1st of each month.');
  });
});

describe('price labels', () => {
  it('says what a session covers, from its real meetings', () => {
    expect(sessionPriceParts(storiesSession.price, storiesSession)).toEqual({ total: '$160 for 9 weeks', perClass: '$17.78 a class' });
    const eight = { ...storiesSession, endDate: '2026-12-08' };
    expect(priceLabel(eight.price, eight)).toBe('$160 for 8 weeks ($20 a class)');
    expect(priceLabel(session.price, session)).toBe('$95/mo');
    expect(priceLabel(improvNight.price, improvNight)).toBe('$25/class');
  });
});

describe('joining now, on the class page', () => {
  const today = '2026-10-13';

  it('matches checkout for a monthly class with a free class', () => {
    const intro = { ...session, startDate: '2026-08-17', endDate: '2026-12-18' };
    const p = { ...program, sessions: [intro] } as Program;
    const m = q('monthly', today, [maya], 0, p, intro);
    const f = q('full', today, [maya], 0, p, intro);
    expect(m.lines[0].amountCents).toBe(7125); // 3 of October's 4 Tuesdays
    expect(joiningNow(p, intro, today)).toEqual([
      'Nothing today; the first class is free.',
      `Or $71.25 + $30 fee today, then $95 on Nov 1 and Dec 1.`,
      `Or ${formatCents(f.totalCents - 3000)} + $30 fee for the rest of the season.`,
    ]);
  });

  it('matches checkout for a class that starts mid-month, without a free class', () => {
    expect(joiningNow(acting, actingSession, today)).toEqual([
      '$47.50 + $30 fee today, then $95 on Nov 1 and Dec 1.',
      `Or ${formatCents(q('full', today, [maya], 0, acting, actingSession).totalCents - 3000)} + $30 fee for the rest of the season.`,
    ]);
  });

  it('matches checkout for a class priced per session', () => {
    expect(joiningNow(stories, storiesSession, today)).toEqual([
      'Nothing today; the first class is free. If you stay on, you pay only for the classes left.',
      'Or $160 + $30 fee today for all 9 classes.',
    ]);
    const late = joiningNow(stories, storiesSession, '2026-11-04')!;
    expect(late[1]).toBe(`Or ${formatCents(q('once', '2026-11-04', [maya], 0, stories, storiesSession).totalCents - 3000)} + $30 fee today for the 6 classes left.`);
  });

  it('says nothing for drop-in nights, full classes or a class that has ended', () => {
    expect(joiningNow(improv, improvNight, today)).toBeUndefined();
    expect(joiningNow(acting, { ...actingSession, status: 'waitlist' }, today)).toBeUndefined();
    expect(joiningNow(acting, actingSession, '2027-01-05')).toBeUndefined();
  });
});
