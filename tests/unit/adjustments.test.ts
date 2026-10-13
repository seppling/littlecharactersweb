/**
 * Staff adjustments: a discount Hannah gives one family, applied to the monthly
 * payments still to come, removable, logged, and only ever by staff.
 */
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb, schema } from '@/server/db';
import { confirmOrder, createDraftOrder, createStudent, ensureHousehold, fulfillOrder } from '@/server/family';
import { holdForManualPayment, listInstallments, runBilling, totalDue, type ChargeRequest, type ChargeResult } from '@/server/billing';
import { addAdjustment, previewAdjustment, removeAdjustment, type AdjustmentInput, type StaffUser } from '@/server/adjustments';
import { applyAdjustments, familyLabel, parseAdjustmentValue, type AdjustmentRule } from '@/lib/adjustments';
import { quote } from '@/lib/pricing';
import { getCatalog } from '@/server/content';

const SESSION = 'intro-f26-tue'; // Tuesdays, Aug 17 – Dec 18, $95/month
const hannah: StaffUser = { id: 'u-hannah', email: 'hannah@example.com', emailVerified: true };

const rule = (kind: 'percent' | 'amount', value: number, label = 'Discount', id = `${kind}${value}`): AdjustmentRule => ({ id, kind, value, label });

describe('the math', () => {
  it('takes a dollar amount or a percentage off', () => {
    expect(applyAdjustments(9500, [rule('amount', 4000)])).toEqual({ amountCents: 5500, lines: [{ adjustmentId: 'amount4000', label: 'Discount', cents: 4000 }] });
    expect(applyAdjustments(9500, [rule('percent', 25)]).amountCents).toBe(7125);
  });

  it('rounds the cent in the family’s favor', () => {
    // 33% of $80.75 is $26.6475: $26.65 off, so the family pays $54.10.
    expect(applyAdjustments(8075, [rule('percent', 33)])).toMatchObject({ amountCents: 5410, lines: [{ cents: 2665 }] });
  });

  it('never goes below $0, and waives a remainder too small for a card charge', () => {
    expect(applyAdjustments(9500, [rule('amount', 20000)])).toMatchObject({ amountCents: 0, lines: [{ cents: 9500 }] });
    expect(applyAdjustments(9500, [rule('percent', 100)]).amountCents).toBe(0);
    expect(applyAdjustments(9500, [rule('amount', 9460)])).toMatchObject({ amountCents: 0, lines: [{ cents: 9500 }] });
  });

  it('applies several in the order they were added', () => {
    expect(applyAdjustments(9500, [rule('percent', 50), rule('amount', 1000)]).amountCents).toBe(3750);
    expect(applyAdjustments(9500, [rule('amount', 1000), rule('percent', 50)]).amountCents).toBe(4250);
    // Nothing left: later adjustments add no line.
    expect(applyAdjustments(9500, [rule('amount', 9500), rule('percent', 10)]).lines).toHaveLength(1);
  });

  it('keeps the staff reason private unless it’s marked as shown', () => {
    expect(familyLabel('Scholarship, dad between jobs', false)).toBe('Discount');
    expect(familyLabel('Scholarship', true)).toBe('Scholarship');
  });

  it('reads what staff type', () => {
    expect(parseAdjustmentValue('amount', '$40')).toBe(4000);
    expect(parseAdjustmentValue('amount', '12.5')).toBe(1250);
    expect(parseAdjustmentValue('percent', '25%')).toBe(25);
    for (const bad of ['', '0', '-5', 'abc', '1.234']) expect(parseAdjustmentValue('amount', bad)).toBeNull();
    for (const bad of ['0', '101', '12.5']) expect(parseAdjustmentValue('percent', bad)).toBeNull();
  });

  it('stacks after the built-in discounts: the 15% is already in the monthly amount, the 10% in the pay-in-full total', async () => {
    const found = (await getCatalog()).findSession(SESSION)!;
    const kids = [{ id: 'a', firstName: 'Ana' }, { id: 'b', firstName: 'Bo' }];
    const monthly = quote({ ...found, students: kids, plan: 'monthly', otherClassEnrollments: 0, today: '2026-09-10' });
    expect(monthly.installments[0].amountCents).toBe(16150); // 2 × $95, less 15%
    expect(applyAdjustments(monthly.installments[0].amountCents, [rule('percent', 10)]).amountCents).toBe(14535); // then 10% of that
    const full = quote({ ...found, students: [kids[0]], plan: 'full', otherClassEnrollments: 0, today: '2026-09-10' });
    expect(full.discountCents).toBeGreaterThan(0); // the 10% pay-in-full discount
    expect(applyAdjustments(full.totalCents, [rule('amount', 4000)]).amountCents).toBe(full.totalCents - 4000);
  });
});

// ───────────── Applied to real payments ─────────────

function fakeCharger(result: (req: ChargeRequest) => ChargeResult = () => ({ status: 'succeeded', paymentIntentId: 'pi_ok' })) {
  const calls: ChargeRequest[] = [];
  return {
    calls,
    charge: async (req: ChargeRequest) => {
      calls.push(req);
      if (!req.paymentIntentId) await req.remember(`pi_${req.installmentId.slice(0, 6)}_${req.attempt}`);
      return result(req);
    },
  };
}

async function family(tag: string, { plan = 'monthly' as 'monthly' | 'full', kids = 1 } = {}) {
  const db = await getDb();
  const u = { id: `u-${tag}`, name: `Pat ${tag}`, email: `${tag}@example.com`, emailVerified: true };
  await db.insert(schema.user).values(u);
  const h = await ensureHousehold(u);
  await db.update(schema.household).set({ stripeCustomerId: `cus_${tag}`, stripePaymentMethodId: `pm_${tag}` }).where(eq(schema.household.id, h.id));
  const ids = [];
  for (let k = 0; k < kids; k++) ids.push((await createStudent(h.id, { firstName: `Kid${k}`, lastName: tag, birthdate: '2017-05-05' }, u.id)).id);
  const o = await confirmOrder(h.id, (await createDraftOrder(h.id, u.id, SESSION, ids)).id, plan, u.id);
  await fulfillOrder(o.id, u.id);
  return { u, h, o };
}

const amounts = async (householdId: string) => (await listInstallments(householdId)).map((i) => [i.dueDate.slice(5, 7), i.amountCents, i.status]);
const input = (orderId: string, over: Partial<AdjustmentInput> = {}): AdjustmentInput => ({ orderId, kind: 'amount', value: 4000, repeat: 'once', reason: 'credit for a missed class', showToFamily: false, ...over });
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

describe('adjusting a family’s payments', () => {
  it('once: takes the amount off the next payment only, logged, and the charge is the adjusted amount', async () => {
    const F = await family('rivera');
    expect(await amounts(F.h.id)).toEqual([['10', 9500, 'scheduled'], ['11', 9500, 'scheduled'], ['12', 9500, 'scheduled']]);

    const { adjustment, changes } = await addAdjustment(hannah, input(F.o.id));
    expect(changes.map((c) => [c.beforeCents, c.afterCents])).toEqual([[9500, 5500]]);
    expect(await amounts(F.h.id)).toEqual([['10', 5500, 'scheduled'], ['11', 9500, 'scheduled'], ['12', 9500, 'scheduled']]);
    const [oct] = await listInstallments(F.h.id);
    expect(oct).toMatchObject({ baseAmountCents: 9500, adjustments: [{ adjustmentId: adjustment.id, label: 'Discount', cents: 4000 }] });
    expect(adjustment).toMatchObject({ createdBy: hannah.id, reason: 'credit for a missed class', installmentId: oct.id, removedAt: null });
    expect(await auditRows('adjustment.add', adjustment.id)).toHaveLength(1);

    const f = fakeCharger();
    await runBilling({ charge: f.charge, today: '2026-10-01' });
    const mine = f.calls.filter((c) => c.customerId === 'cus_rivera');
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ amountCents: 5500, description: 'October tuition: Kid0, Intro to Theater (Discount: −$40)' });
    expect((await listInstallments(F.h.id))[0]).toMatchObject({ status: 'paid', amountCents: 5500 });
    const mail = await (await getDb()).select().from(schema.devEmail);
    expect(mail.find((m) => m.to === 'rivera@example.com' && m.subject.startsWith('Payment received'))?.text).toContain('We received $55 for October tuition: Kid0, Intro to Theater (Discount: −$40).');
  });

  it('every month, added mid-enrollment: only what’s still unpaid changes; paid months never do', async () => {
    const F = await family('okafor');
    await runBilling({ charge: fakeCharger().charge, today: '2026-10-01' });
    const { changes } = await addAdjustment(hannah, input(F.o.id, { kind: 'percent', value: 25, repeat: 'monthly', reason: 'Scholarship', showToFamily: true }));
    expect(changes.map((c) => c.dueDate)).toEqual(['2026-11-01', '2026-12-01']);
    expect(await amounts(F.h.id)).toEqual([['10', 9500, 'paid'], ['11', 7125, 'scheduled'], ['12', 7125, 'scheduled']]);
    expect((await listInstallments(F.h.id))[1].adjustments).toMatchObject([{ label: 'Scholarship', cents: 2375 }]);
  });

  it('stacks two adjustments, and removing one restores what it took off the unpaid months only', async () => {
    const F = await family('diaz');
    const monthly = await addAdjustment(hannah, input(F.o.id, { kind: 'percent', value: 50, repeat: 'monthly', reason: 'pay what you can' }));
    const once = await addAdjustment(hannah, input(F.o.id, { value: 1000 }));
    expect(await amounts(F.h.id)).toEqual([['10', 3750, 'scheduled'], ['11', 4750, 'scheduled'], ['12', 4750, 'scheduled']]);

    await runBilling({ charge: fakeCharger().charge, today: '2026-10-01' });
    const removed = await removeAdjustment(hannah, monthly.adjustment.id);
    expect(removed?.changes.map((c) => [c.dueDate, c.beforeCents, c.afterCents])).toEqual([
      ['2026-11-01', 4750, 9500],
      ['2026-12-01', 4750, 9500],
    ]);
    expect(await amounts(F.h.id)).toEqual([['10', 3750, 'paid'], ['11', 9500, 'scheduled'], ['12', 9500, 'scheduled']]);
    // The paid month still shows what it was charged with.
    expect((await listInstallments(F.h.id))[0].adjustments.map((l) => l.adjustmentId)).toEqual([monthly.adjustment.id, once.adjustment.id]);
    const [row] = await (await getDb()).select().from(schema.billingAdjustment).where(eq(schema.billingAdjustment.id, monthly.adjustment.id));
    expect(row).toMatchObject({ removedBy: hannah.id });
    expect(row.removedAt).toBeInstanceOf(Date);
    expect(await auditRows('adjustment.remove', monthly.adjustment.id)).toHaveLength(1);
    expect(await removeAdjustment(hannah, monthly.adjustment.id)).toBeNull(); // only once
  });

  it('applies after the 15% multi-student discount, rounding in the family’s favor', async () => {
    const F = await family('chen', { kids: 2 });
    expect((await amounts(F.h.id))[0]).toEqual(['10', 16150, 'scheduled']);
    await addAdjustment(hannah, input(F.o.id, { kind: 'percent', value: 33, repeat: 'monthly', reason: 'sibling deal' }));
    // 33% of $161.50 is $53.295: $53.30 off.
    expect((await amounts(F.h.id)).map((r) => r[1])).toEqual([10820, 10820, 10820]);
  });

  it('a month brought to $0 is settled on its date without charging the card', async () => {
    const F = await family('park');
    await addAdjustment(hannah, input(F.o.id, { value: 20000, repeat: 'monthly', reason: 'full scholarship' }));
    expect((await amounts(F.h.id)).map((r) => r[1])).toEqual([0, 0, 0]);
    const f = fakeCharger();
    await runBilling({ charge: f.charge, today: '2026-10-01' });
    expect(f.calls.filter((c) => c.customerId === 'cus_park')).toHaveLength(0);
    expect((await listInstallments(F.h.id))[0]).toMatchObject({ status: 'paid', amountCents: 0 });
    const mail = await (await getDb()).select().from(schema.devEmail);
    expect(mail.some((m) => m.to === 'park@example.com' && m.subject.startsWith('Nothing to pay: October tuition'))).toBe(true);
  });

  it('doesn’t discount the late fee', async () => {
    const F = await family('kim');
    const decline = fakeCharger(() => ({ status: 'failed', code: 'card_declined', retry: true }));
    for (const day of ['2026-10-01', '2026-10-04', '2026-10-07', '2026-10-11']) await runBilling({ charge: decline.charge, today: day });
    const [oct] = await listInstallments(F.h.id);
    expect(oct).toMatchObject({ status: 'failed', lateFeeCents: 1500, retryOn: null });

    await addAdjustment(hannah, input(F.o.id, { kind: 'percent', value: 100, reason: 'hardship' }));
    const after = (await listInstallments(F.h.id))[0];
    expect(after).toMatchObject({ status: 'failed', amountCents: 0, lateFeeCents: 1500 });
    expect(totalDue(after)).toBe(1500);
  });

  it('a failed month that’s fully covered is settled right away', async () => {
    const F = await family('lee');
    await runBilling({ charge: fakeCharger(() => ({ status: 'failed', code: 'card_declined', retry: true })).charge, today: '2026-10-01' });
    await addAdjustment(hannah, input(F.o.id, { value: 9500, reason: 'scholarship' }));
    expect((await listInstallments(F.h.id))[0]).toMatchObject({ status: 'paid', amountCents: 0, lastError: 'covered by a staff adjustment' });
  });

  it('leaves a month alone while it’s being charged or the family has the pay-now form open, then catches up', async () => {
    const F = await family('ng');
    const decline = fakeCharger(() => ({ status: 'failed', code: 'card_declined', retry: true }));
    await runBilling({ charge: decline.charge, today: '2026-10-01' });
    expect(await holdForManualPayment(F.h.id, (await listInstallments(F.h.id))[0].id)).toBe(true); // the family opens "pay now"

    const { changes } = await addAdjustment(hannah, input(F.o.id, { value: 1000, repeat: 'monthly', reason: 'sibling deal' }));
    expect(changes.map((c) => c.dueDate)).toEqual(['2026-11-01', '2026-12-01']);
    expect((await amounts(F.h.id))[0]).toEqual(['10', 9500, 'failed']);

    // Two hours later the form has expired; the next run brings October up to date before charging.
    vi.setSystemTime(new Date('2026-09-10T18:30:00Z'));
    await runBilling({ charge: decline.charge, today: '2026-10-02' });
    expect((await amounts(F.h.id))[0]).toEqual(['10', 8500, 'failed']);
    vi.setSystemTime(new Date('2026-09-10T16:00:00Z'));

    // A charge in progress never changes.
    const db = await getDb();
    const [nov] = (await listInstallments(F.h.id)).slice(1);
    await db.update(schema.installment).set({ status: 'processing' }).where(eq(schema.installment.id, nov.id));
    const { changes: c2 } = await addAdjustment(hannah, input(F.o.id, { value: 500, repeat: 'monthly', reason: 'credit' }));
    expect(c2.map((c) => c.dueDate)).toEqual(['2026-12-01']);
    expect((await listInstallments(F.h.id))[1]).toMatchObject({ status: 'processing', amountCents: 8500 });
  });

  it('previews without saving', async () => {
    const F = await family('mora');
    const p = await previewAdjustment(hannah, input(F.o.id, { repeat: 'monthly' }));
    expect(p.changes.map((c) => c.afterCents)).toEqual([5500, 5500, 5500]);
    expect((await amounts(F.h.id)).map((r) => r[1])).toEqual([9500, 9500, 9500]);
    expect(await (await getDb()).select().from(schema.billingAdjustment).where(eq(schema.billingAdjustment.orderId, F.o.id))).toHaveLength(0);
  });

  it('needs a reason and a sensible amount', async () => {
    const F = await family('patel');
    await expect(addAdjustment(hannah, input(F.o.id, { reason: '   ' }))).rejects.toThrow(/reason/);
    await expect(addAdjustment(hannah, input(F.o.id, { kind: 'percent', value: 150 }))).rejects.toThrow(/1 to 100/);
    await expect(addAdjustment(hannah, input(F.o.id, { value: 0 }))).rejects.toThrow(/dollar amount/);
  });

  it('has nothing to change on a class paid in full (the 10% was taken at checkout)', async () => {
    const F = await family('full', { plan: 'full' });
    await expect(addAdjustment(hannah, input(F.o.id))).rejects.toThrow(/no upcoming payment/);
  });

  it('only staff can add or remove one; a family’s request fails and changes nothing', async () => {
    const F = await family('ruiz');
    const parent: StaffUser = { id: F.u.id, email: F.u.email, emailVerified: true };
    await expect(addAdjustment(parent, input(F.o.id))).rejects.toThrow(/Only staff/);
    await expect(previewAdjustment(parent, input(F.o.id))).rejects.toThrow(/Only staff/);
    // A staff address that hasn't been verified with a code doesn't count either.
    await expect(addAdjustment({ ...hannah, emailVerified: false }, input(F.o.id))).rejects.toThrow(/Only staff/);
    expect((await amounts(F.h.id)).map((r) => r[1])).toEqual([9500, 9500, 9500]);

    const { adjustment } = await addAdjustment(hannah, input(F.o.id));
    await expect(removeAdjustment(parent, adjustment.id)).rejects.toThrow(/Only staff/);
    expect((await amounts(F.h.id))[0][1]).toBe(5500);
  });
});
