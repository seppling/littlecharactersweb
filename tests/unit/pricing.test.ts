import { describe, expect, it } from 'vitest';
import type { Program, Session } from '@/data/types';
import { availablePlans, formatCents, meetings, monthlySchedule, quote, type Plan } from '@/lib/pricing';
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
      { month: '2026-09', share: 1 },
      { month: '2026-10', share: 1 },
      { month: '2026-11', share: 1 },
      { month: '2026-12', share: 1 },
    ]);
  });

  it('prorates the first month by meetings left when joining later', () => {
    // Sep 22 and 29 left of 5 September meetings.
    expect(monthlySchedule(session, '2026-09-22')[0]).toEqual({ month: '2026-09', share: 2 / 5 });
  });
});

describe('monthly plan', () => {
  it('charges the first month plus the one-time fee, and lists what comes later', () => {
    const r = q('monthly', '2026-09-01');
    expect(r.totalCents).toBe(9500 + 3000);
    expect(r.later[0]).toContain('3 more monthly payments of $95');
    expect(r.later[0]).toContain('October, November, December');
  });

  it('prorates a late start', () => {
    const r = q('monthly', '2026-09-22');
    expect(r.lines[0]).toMatchObject({ label: 'Maya: September tuition (prorated)', amountCents: 3800 });
    expect(r.totalCents).toBe(3800 + 3000);
  });

  it('gives 15% off tuition (not fees) for two students', () => {
    const r = q('monthly', '2026-09-01', [maya, leo]);
    expect(r.subtotalCents).toBe(2 * 9500 + 2 * 3000);
    expect(r.discountCents).toBe(Math.round(19000 * 0.15));
    expect(r.later[0]).toContain('$161.50');
  });

  it('gives 15% off when the family is already in another class', () => {
    expect(q('monthly', '2026-09-01', [maya], 1).discountCents).toBe(Math.round(9500 * 0.15));
  });
});

describe('pay in full', () => {
  it('takes 10% off the whole term', () => {
    const r = q('full', '2026-09-01');
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
