/**
 * The 15% family discount covers the whole family: once a family has two or
 * more active weekly classes, all their remaining monthly payments for weekly
 * classes are 15% off, whatever order the children signed up in.
 */
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb, schema } from '@/server/db';
import { confirmOrder, createDraftOrder, createStudent, ensureHousehold, familyDiscountEffect, fulfillOrder, priceOrder } from '@/server/family';
import { chargeDescription, holdForManualPayment, listInstallments, runBilling, stopRemainingPayments, type ChargeRequest } from '@/server/billing';
import { addAdjustment, type StaffUser } from '@/server/adjustments';
import { previewStopEffect, refreshFamilyDiscountNow } from '@/server/family-discount';
import { discountLines, familyDiscountCents } from '@/lib/adjustments';
import { familyDiscounted } from '@/lib/pricing';

// Prices from the starting content (src/content/seed/programs.ts).
const INTRO = 'intro-f26-tue'; // Tuesdays, Aug 17 – Dec 18, $95/month
const YESAND = 'yesand-f26-wed'; // Wednesdays, Aug 17 – Dec 18, $95/month
const TROUPE = 'troupe-f26-wed'; // Wednesdays, Aug 17 – Mar 31, $115/month
const PNO = 'pno-2026-10-24'; // Parents' Night Out, $30 a child
const hannah: StaffUser = { id: 'u-hannah', email: 'hannah@example.com', emailVerified: true };

function fakeCharger() {
  const calls: ChargeRequest[] = [];
  return {
    calls,
    charge: async (req: ChargeRequest) => {
      calls.push(req);
      if (!req.paymentIntentId) await req.remember(`pi_${req.installmentId.slice(0, 6)}_${req.attempt}`);
      return { status: 'succeeded' as const, paymentIntentId: `pi_${req.installmentId.slice(0, 6)}` };
    },
  };
}

async function family(tag: string) {
  const db = await getDb();
  const u = { id: `u-${tag}`, name: `Pat ${tag}`, email: `${tag}@example.com`, emailVerified: true };
  await db.insert(schema.user).values(u);
  const h = await ensureHousehold(u);
  await db.update(schema.household).set({ stripeCustomerId: `cus_${tag}`, stripePaymentMethodId: `pm_${tag}` }).where(eq(schema.household.id, h.id));
  const kids = new Map<string, string>();
  return {
    u,
    h,
    /** Sign these children up (adding them to the family the first time), paid and fulfilled. */
    async enroll(names: string[], sessionId: string, plan: 'monthly' | 'full' | 'trial' | 'once') {
      for (const n of names) if (!kids.has(n)) kids.set(n, (await createStudent(h.id, { firstName: n, lastName: tag, birthdate: '2017-05-05' }, u.id)).id);
      const o = await confirmOrder(h.id, (await createDraftOrder(h.id, u.id, sessionId, names.map((n) => kids.get(n)!))).id, plan, u.id);
      return fulfillOrder(o.id, u.id);
    },
    kid: (n: string) => kids.get(n)!,
  };
}

/** [month, charged, status] for one order's payments. */
const months = async (householdId: string, orderId: string) =>
  (await listInstallments(householdId)).filter((i) => i.orderId === orderId).map((i) => [i.dueDate.slice(5, 7), i.amountCents, i.status]);
const mail = async (to: string) => (await getDb()).select().from(schema.devEmail).where(eq(schema.devEmail.to, to));
const ENDED = 'Your family discount has ended · Little Characters';
const auditRows = async (action: string, entityId: string) => (await getDb()).select().from(schema.auditLog).where(and(eq(schema.auditLog.action, action), eq(schema.auditLog.entityId, entityId)));

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-10T16:00:00Z'));
  const db = await getDb();
  await db.insert(schema.user).values({ id: hannah.id, name: 'Hannah Eppling', email: hannah.email, emailVerified: true });
});
afterAll(() => {
  vi.useRealTimers();
});

describe('the math', () => {
  it('takes 15% off, the cent rounded in the family’s favor', () => {
    expect(familyDiscounted(9500)).toBe(8075);
    expect(familyDiscounted(19000)).toBe(16150);
    // 15% of $99.90 is $14.985: $14.99 off, so the family pays $84.91.
    expect(familyDiscounted(9990)).toBe(8491);
  });

  it('names the family discount first, then staff discounts', () => {
    const i = { regularAmountCents: 9500, baseAmountCents: 8075, adjustments: [{ adjustmentId: 'a', label: 'Scholarship', cents: 4000 }] };
    expect(familyDiscountCents(i)).toBe(1425);
    expect(discountLines(i)).toEqual([
      { label: 'Family discount (15%)', cents: 1425, family: true },
      { label: 'Scholarship', cents: 4000, family: false },
    ]);
    expect(chargeDescription({ ...i, label: 'November tuition: Ava, Intro to Theater', lateFeeCents: 0 })).toBe(
      'November tuition: Ava, Intro to Theater (Family discount (15%): −$14.25, Scholarship: −$40)',
    );
  });
});

describe('a second child enrolling', () => {
  it('lowers the first child’s remaining payments when the second pays monthly, and logs it', async () => {
    const F = await family('adams');
    const ava = await F.enroll(['Ava'], INTRO, 'monthly');
    expect(await months(F.h.id, ava.id)).toEqual([['10', 9500, 'scheduled'], ['11', 9500, 'scheduled'], ['12', 9500, 'scheduled']]);

    // The review page tells the family before they pay.
    const draft = await createDraftOrder(F.h.id, F.u.id, YESAND, [(await createStudent(F.h.id, { firstName: 'Ben', lastName: 'adams', birthdate: '2016-01-01' }, F.u.id)).id]);
    const priced = await priceOrder(F.h.id, draft, 'monthly');
    const effect = await familyDiscountEffect(F.h.id, priced, draft.id);
    expect(effect).toMatchObject([{ orderId: ava.id, names: ['Ava'] }]);
    expect(effect[0].changes.map((c) => [c.dueDate, c.beforeCents, c.afterCents])).toEqual([['2026-10-01', 9500, 8075], ['2026-11-01', 9500, 8075], ['2026-12-01', 9500, 8075]]);
    expect(await months(F.h.id, ava.id)).toEqual([['10', 9500, 'scheduled'], ['11', 9500, 'scheduled'], ['12', 9500, 'scheduled']]); // a preview saves nothing

    const confirmed = await confirmOrder(F.h.id, draft.id, 'monthly', F.u.id);
    const ben = await fulfillOrder(confirmed.id, F.u.id);
    expect(await months(F.h.id, ava.id)).toEqual([['10', 8075, 'scheduled'], ['11', 8075, 'scheduled'], ['12', 8075, 'scheduled']]);
    expect(await months(F.h.id, ben.id)).toEqual([['10', 8075, 'scheduled'], ['11', 8075, 'scheduled'], ['12', 8075, 'scheduled']]);
    const [oct] = await listInstallments(F.h.id);
    expect(oct).toMatchObject({ regularAmountCents: 9500, baseAmountCents: 8075, adjustments: [] });
    expect(await auditRows('family_discount.refresh', F.h.id)).toMatchObject([{ userId: F.u.id }]);
    expect((await mail('adams@example.com')).filter((m) => m.subject === ENDED)).toEqual([]); // only when it ends
  });

  it('lowers them when the second continues after the free class and pays for the season', async () => {
    const F = await family('baker');
    await F.enroll(['Ava', 'Ben'], INTRO, 'trial');
    const ava = await F.enroll(['Ava'], INTRO, 'monthly');
    // Ben is still on his free class, which doesn't count.
    expect(await months(F.h.id, ava.id)).toEqual([['10', 9500, 'scheduled'], ['11', 9500, 'scheduled'], ['12', 9500, 'scheduled']]);
    const ben = await F.enroll(['Ben'], INTRO, 'full');
    expect(ben.lines.some((l) => l.label === '15% multi-class / multi-student discount')).toBe(true);
    expect(await months(F.h.id, ava.id)).toEqual([['10', 8075, 'scheduled'], ['11', 8075, 'scheduled'], ['12', 8075, 'scheduled']]);
    expect(await months(F.h.id, ben.id)).toEqual([]); // paid in full: nothing to change
  });
});

describe('which payments change', () => {
  it('leaves paid and processing months alone; a month with the pay-now form open catches up at the billing run', async () => {
    const F = await family('cruz');
    const ava = await F.enroll(['Ava'], INTRO, 'monthly');
    const db = await getDb();
    const [oct, nov, dec] = await listInstallments(F.h.id);
    await runBilling({ charge: fakeCharger().charge, today: '2026-10-01' }); // October paid at $95
    await db.update(schema.installment).set({ status: 'processing' }).where(eq(schema.installment.id, nov.id));
    await db.update(schema.installment).set({ status: 'failed', lastError: 'card_declined' }).where(eq(schema.installment.id, dec.id));
    expect(await holdForManualPayment(F.h.id, dec.id)).toBe(true); // the family has the pay-now form open

    await F.enroll(['Ben'], YESAND, 'monthly');
    expect(await months(F.h.id, ava.id)).toEqual([['10', 9500, 'paid'], ['11', 9500, 'processing'], ['12', 9500, 'failed']]);
    expect((await listInstallments(F.h.id)).find((i) => i.id === oct.id)).toMatchObject({ regularAmountCents: 9500, baseAmountCents: 9500 });

    // Three hours later the form has expired; the next run catches December up before charging it.
    vi.setSystemTime(new Date('2026-09-10T19:00:00Z'));
    try {
      await db.update(schema.installment).set({ status: 'failed', retryOn: '2026-12-04' }).where(eq(schema.installment.id, dec.id));
      const f = fakeCharger();
      await runBilling({ charge: f.charge, today: '2026-12-04' });
      const charge = f.calls.find((c) => c.installmentId === dec.id)!;
      expect(charge.amountCents).toBe(8075);
      expect(charge.description).toBe('December tuition: Ava, Intro to Theater (Family discount (15%): −$14.25)');
      // November's interrupted charge is finished at the amount it started with; it never changes.
      expect(f.calls.find((c) => c.installmentId === nov.id)?.amountCents).toBe(9500);
      expect(await months(F.h.id, ava.id)).toEqual([['10', 9500, 'paid'], ['11', 9500, 'paid'], ['12', 8075, 'paid']]);
    } finally {
      vi.setSystemTime(new Date('2026-09-10T16:00:00Z'));
    }
  });

  it('counts a season paid in full without changing it', async () => {
    const F = await family('diaz');
    const ava = await F.enroll(['Ava'], INTRO, 'full');
    const ben = await F.enroll(['Ben'], TROUPE, 'monthly');
    expect(await months(F.h.id, ava.id)).toEqual([]);
    expect((await months(F.h.id, ben.id)).map((m) => m[1])).toEqual([9775, 9775, 9775, 9775, 9775, 9775]); // $115 less 15%, Oct–Mar
    expect((await refreshFamilyDiscountNow(F.h.id, null)).changes).toEqual([]);
  });

  it('doesn’t count a sibling on a free class or the waitlist', async () => {
    const F = await family('evans');
    const ava = await F.enroll(['Ava'], INTRO, 'monthly');
    await F.enroll(['Ben'], YESAND, 'trial');
    const db = await getDb();
    const cy = await createStudent(F.h.id, { firstName: 'Cy', lastName: 'evans', birthdate: '2015-01-01' }, F.u.id);
    await db.insert(schema.enrollment).values({ householdId: F.h.id, studentId: cy.id, sessionId: TROUPE, programSlug: 'performance-troupe', status: 'waitlist' });
    const r = await refreshFamilyDiscountNow(F.h.id, null);
    expect(r).toMatchObject({ count: 1, qualifies: false, changes: [] });
    expect(await months(F.h.id, ava.id)).toEqual([['10', 9500, 'scheduled'], ['11', 9500, 'scheduled'], ['12', 9500, 'scheduled']]);
  });

  it('doesn’t count Parents’ Night Out or a camp', async () => {
    const F = await family('fox');
    const ava = await F.enroll(['Ava'], INTRO, 'monthly');
    await F.enroll(['Ben'], PNO, 'once');
    const db = await getDb();
    // A camp sign-up (no camp dates are open in the starting content, so it's added directly).
    await db.insert(schema.enrollment).values({ householdId: F.h.id, studentId: F.kid('Ben'), sessionId: 'summer-camp-2027-w1', programSlug: 'summer-camp', status: 'active' });
    expect(await refreshFamilyDiscountNow(F.h.id, null)).toMatchObject({ count: 1, changes: [] });
    expect(await months(F.h.id, ava.id)).toEqual([['10', 9500, 'scheduled'], ['11', 9500, 'scheduled'], ['12', 9500, 'scheduled']]);
  });

  it('only counts classes priced by the month: not a drop-in night or a class priced by the session', async () => {
    const F = await family('kemp');
    const ava = await F.enroll(['Ava'], INTRO, 'monthly');
    const db = await getDb();
    const ben = await createStudent(F.h.id, { firstName: 'Ben', lastName: 'kemp', birthdate: '2018-01-01' }, F.u.id);
    await db.insert(schema.enrollment).values([
      // Geode Adult Improv: a $25 night; Stories & Songs: $160 for 8 weeks. Both are weekly classes in the catalog.
      { householdId: F.h.id, studentId: ben.id, sessionId: 'adult-improv-2026-11', programSlug: 'geode-adult-improv', status: 'active' },
      { householdId: F.h.id, studentId: ben.id, sessionId: 'stories-songs-f26', programSlug: 'stories-and-songs', status: 'active' },
    ]);
    expect(await refreshFamilyDiscountNow(F.h.id, null)).toMatchObject({ count: 1, qualifies: false, changes: [] });
    expect(await months(F.h.id, ava.id)).toEqual([['10', 9500, 'scheduled'], ['11', 9500, 'scheduled'], ['12', 9500, 'scheduled']]);
  });

  it('keeps two children in one order as before: 15% at checkout, nothing more', async () => {
    const F = await family('gray');
    const both = await F.enroll(['Ava', 'Ben'], INTRO, 'monthly');
    expect(await months(F.h.id, both.id)).toEqual([['10', 16150, 'scheduled'], ['11', 16150, 'scheduled'], ['12', 16150, 'scheduled']]);
    const [oct] = await listInstallments(F.h.id);
    expect(oct).toMatchObject({ regularAmountCents: 19000, baseAmountCents: 16150 });
    expect(await auditRows('family_discount.refresh', F.h.id)).toEqual([]); // nothing changed after checkout
  });
});

describe('dropping back to one', () => {
  it('when staff stop a child’s payments: they see it first, then only unpaid months go back up', async () => {
    const F = await family('hale');
    const ava = await F.enroll(['Ava'], INTRO, 'monthly');
    const ben = await F.enroll(['Ben'], YESAND, 'monthly');
    await runBilling({ charge: fakeCharger().charge, today: '2026-10-01' }); // October paid at $80.75 each

    const preview = await previewStopEffect(ben.id);
    expect(preview).toMatchObject([{ orderId: ava.id, names: ['Ava'] }]);
    expect(preview[0].changes.map((c) => [c.dueDate, c.beforeCents, c.afterCents])).toEqual([['2026-11-01', 8075, 9500], ['2026-12-01', 8075, 9500]]);

    const r = await stopRemainingPayments(ben.id, hannah.id);
    expect(r.stopped).toBe(2);
    expect(r.familyDiscount.map((c) => [c.dueDate, c.afterCents])).toEqual([['2026-11-01', 9500], ['2026-12-01', 9500]]);
    expect(await months(F.h.id, ava.id)).toEqual([['10', 8075, 'paid'], ['11', 9500, 'scheduled'], ['12', 9500, 'scheduled']]);
    expect(await months(F.h.id, ben.id)).toEqual([['10', 8075, 'paid'], ['11', 8075, 'cancelled'], ['12', 8075, 'cancelled']]);
    expect(await auditRows('family_discount.refresh', F.h.id)).toMatchObject([{ userId: F.u.id }, { userId: hannah.id }]);
    // The family is told before they're charged.
    const [ended] = (await mail('hale@example.com')).filter((m) => m.subject === ENDED);
    expect(ended.text).toContain('Ava, Intro to Theater: $95 on Nov 1 and Dec 1 (was $80.75).');
    expect(ended.text).toContain('Payments you’ve already made don’t change.');
    expect(await auditRows('family_discount.ended_email', F.h.id)).toHaveLength(1);
    // The next billing run doesn't bring it back.
    const f = fakeCharger();
    await runBilling({ charge: f.charge, today: '2026-11-01' });
    expect(f.calls.filter((c) => c.customerId === 'cus_hale').map((c) => c.amountCents)).toEqual([9500]);
  });

  it('when a child’s class ends: the billing run puts the other class back to the regular price', async () => {
    const F = await family('ito');
    const ava = await F.enroll(['Ava'], TROUPE, 'monthly'); // to Mar 31
    await F.enroll(['Ben'], INTRO, 'monthly'); // ends Dec 18
    expect((await months(F.h.id, ava.id)).map((m) => m[1])).toEqual([9775, 9775, 9775, 9775, 9775, 9775]);
    const f = fakeCharger();
    for (const day of ['2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01']) await runBilling({ charge: f.charge, today: day });
    expect(await months(F.h.id, ava.id)).toEqual([
      ['10', 9775, 'paid'], ['11', 9775, 'paid'], ['12', 9775, 'paid'],
      ['01', 11500, 'paid'], ['02', 11500, 'scheduled'], ['03', 11500, 'scheduled'],
    ]);
    const ended = (await mail('ito@example.com')).filter((m) => m.subject === ENDED);
    expect(ended).toHaveLength(1);
    expect(ended[0].text).toContain('Ava, LC/Geode Performance Troupe: $115 on Jan 1, Feb 1 and Mar 1 (was $97.75).');
  });
});

describe('with a staff discount', () => {
  it('takes the family discount first, then the staff discount, rounded in the family’s favor', async () => {
    const F = await family('jones');
    const ava = await F.enroll(['Ava'], INTRO, 'monthly');
    await addAdjustment(hannah, { orderId: ava.id, kind: 'percent', value: 10, repeat: 'monthly', reason: 'Scholarship', showToFamily: true });
    expect((await months(F.h.id, ava.id)).map((m) => m[1])).toEqual([8550, 8550, 8550]); // $95 less 10%

    await F.enroll(['Ben'], YESAND, 'monthly');
    // $95 less 15% is $80.75; 10% of that is $8.075, so $8.08 off: $72.67.
    expect((await months(F.h.id, ava.id)).map((m) => m[1])).toEqual([7267, 7267, 7267]);
    const [oct] = (await listInstallments(F.h.id)).filter((i) => i.orderId === ava.id);
    expect(discountLines(oct).map((l) => [l.label, l.cents])).toEqual([['Family discount (15%)', 1425], ['Scholarship', 808]]);

    const f = fakeCharger();
    await runBilling({ charge: f.charge, today: '2026-10-01' });
    // Both are due Oct 1; the run doesn't promise an order between them.
    expect(f.calls.filter((c) => c.customerId === 'cus_jones').map((c) => [c.amountCents, c.description]).sort((x, y) => Number(x[0]) - Number(y[0]))).toEqual([
      [7267, 'October tuition: Ava, Intro to Theater (Family discount (15%): −$14.25, Scholarship: −$8.08)'],
      [8075, 'October tuition: Ben, Yes, And… Improv (Family discount (15%): −$14.25)'],
    ]);
  });
});
