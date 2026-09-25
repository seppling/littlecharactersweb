/**
 * Monthly autopay: charged on the 1st, never twice, retried sensibly, and
 * always scoped to the right family.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb, schema } from '@/server/db';
import { confirmOrder, createDraftOrder, createStudent, ensureHousehold, fulfillOrder } from '@/server/family';
import {
  getInstallment,
  holdForManualPayment,
  listInstallments,
  markInstallmentPaid,
  markPaidOutsideStripe,
  resumeRetries,
  runBilling,
  stopRemainingPayments,
  type ChargeRequest,
  type ChargeResult,
} from '@/server/billing';

const SESSION = 'intro-f26-tue'; // Tuesdays, Aug 17 – Dec 18, $95/month

function fakeCharger(result: (req: ChargeRequest) => ChargeResult | Promise<ChargeResult> = () => ({ status: 'succeeded', paymentIntentId: 'pi_ok' })) {
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

async function monthlyFamily(tag: string, { card = true } = {}) {
  const db = await getDb();
  const u = { id: `u-${tag}`, name: `Pat ${tag}`, email: `${tag}@example.com`, emailVerified: true };
  await db.insert(schema.user).values(u);
  const h = await ensureHousehold(u);
  if (card) await db.update(schema.household).set({ stripeCustomerId: `cus_${tag}`, stripePaymentMethodId: `pm_${tag}` }).where(eq(schema.household.id, h.id));
  const kid = await createStudent(h.id, { firstName: 'Kid', lastName: tag, birthdate: '2017-05-05' }, u.id);
  const o = await confirmOrder(h.id, (await createDraftOrder(h.id, u.id, SESSION, [kid.id])).id, 'monthly', u.id);
  await fulfillOrder(o.id, u.id);
  return { h, o, installments: await listInstallments(h.id) };
}

const byDue = async (householdId: string, dueDate: string) => (await listInstallments(householdId)).find((i) => i.dueDate === dueDate)!;
const emailsTo = async (email: string) => (await (await getDb()).select().from(schema.devEmail)).filter((m) => m.to === email).map((m) => m.subject);

let A: Awaited<ReturnType<typeof monthlyFamily>>;

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-10T16:00:00Z'));
  A = await monthlyFamily('rivera');
});
afterAll(() => {
  vi.useRealTimers();
});

describe('signing up for the monthly plan', () => {
  it('locks in one charge on the 1st of each remaining month', () => {
    expect(A.installments.map((i) => [i.dueDate, i.amountCents, i.status])).toEqual([
      ['2026-10-01', 9500, 'scheduled'],
      ['2026-11-01', 9500, 'scheduled'],
      ['2026-12-01', 9500, 'scheduled'],
    ]);
    expect(A.o.schedule).toHaveLength(3);
    expect(A.installments[0].label).toBe('October tuition: Kid, Intro to Theater');
  });

  it('creates nothing to charge later when paying in full', async () => {
    const db = await getDb();
    const u = { id: 'u-full', name: 'Sam Full', email: 'full@example.com', emailVerified: true };
    await db.insert(schema.user).values(u);
    const h = await ensureHousehold(u);
    const kid = await createStudent(h.id, { firstName: 'Ivy', lastName: 'Full', birthdate: '2017-02-02' }, u.id);
    const o = await confirmOrder(h.id, (await createDraftOrder(h.id, u.id, SESSION, [kid.id])).id, 'full', u.id);
    await fulfillOrder(o.id, u.id);
    expect(await listInstallments(h.id)).toEqual([]);
  });
});

describe('the daily billing run', () => {
  it('charges nothing before the 1st', async () => {
    const f = fakeCharger();
    expect(await runBilling({ charge: f.charge, today: '2026-09-30' })).toMatchObject({ due: 0, charged: 0 });
    expect(f.calls).toHaveLength(0);
  });

  it('charges on the 1st exactly once, even when two runs overlap, and emails a receipt', async () => {
    const f = fakeCharger();
    await Promise.all([runBilling({ charge: f.charge, today: '2026-10-01' }), runBilling({ charge: f.charge, today: '2026-10-01' })]);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]).toMatchObject({ customerId: 'cus_rivera', paymentMethodId: 'pm_rivera', amountCents: 9500, attempt: 1 });
    expect((await byDue(A.h.id, '2026-10-01')).status).toBe('paid');
    expect(await emailsTo('rivera@example.com')).toContain('Payment received: $95 · Little Characters');

    const again = fakeCharger();
    await runBilling({ charge: again.charge, today: '2026-10-02' });
    expect(again.calls).toHaveLength(0);
  });

  it('retries a declined card 3 days later, twice, then waits for the family', async () => {
    const f = fakeCharger(() => ({ status: 'failed', code: 'card_declined', retry: true }));
    await runBilling({ charge: f.charge, today: '2026-11-01' });
    let nov = await byDue(A.h.id, '2026-11-01');
    expect(nov).toMatchObject({ status: 'failed', attempts: 1, retryOn: '2026-11-04', lastError: 'card_declined' });
    expect(await emailsTo('rivera@example.com')).toContain('We couldn’t charge your card · Little Characters');

    await runBilling({ charge: f.charge, today: '2026-11-03' });
    expect(f.calls).toHaveLength(1);
    await runBilling({ charge: f.charge, today: '2026-11-04' });
    await runBilling({ charge: f.charge, today: '2026-11-07' });
    nov = await byDue(A.h.id, '2026-11-01');
    expect(nov).toMatchObject({ status: 'failed', attempts: 3, retryOn: null });
    expect(f.calls.map((c) => c.attempt)).toEqual([1, 2, 3]);

    await runBilling({ charge: f.charge, today: '2026-11-20' });
    expect(f.calls).toHaveLength(3);
  });

  it('doesn’t retry when the bank needs the cardholder to approve it', async () => {
    const f = fakeCharger(() => ({ status: 'failed', code: 'authentication_required', retry: false }));
    await runBilling({ charge: f.charge, today: '2026-12-01' });
    expect(await byDue(A.h.id, '2026-12-01')).toMatchObject({ status: 'failed', attempts: 1, retryOn: null });
  });

  it('finishes an interrupted charge instead of starting a second one', async () => {
    const C = await monthlyFamily('okafor');
    const crash = fakeCharger(() => {
      throw new Error('network dropped after Stripe created the payment');
    });
    expect(await runBilling({ charge: crash.charge, today: '2026-10-01' })).toMatchObject({ errors: 1 });
    const oct = await byDue(C.h.id, '2026-10-01');
    expect(oct).toMatchObject({ status: 'processing', attempts: 1 });
    expect(oct.stripePaymentIntentId).toBeTruthy();

    // Too soon to call it stuck: leave it alone.
    const f = fakeCharger();
    await runBilling({ charge: f.charge, today: '2026-10-01' });
    expect(f.calls).toHaveLength(0);

    // An hour later the next run resumes the same payment, same attempt.
    const db = await getDb();
    await db.update(schema.installment).set({ updatedAt: new Date(Date.now() - 60 * 60_000) }).where(eq(schema.installment.id, oct.id));
    await runBilling({ charge: f.charge, today: '2026-10-02' });
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0]).toMatchObject({ paymentIntentId: oct.stripePaymentIntentId, attempt: 1 });
    expect((await byDue(C.h.id, '2026-10-01')).status).toBe('paid');
  });

  it('asks the family to pay when there’s no saved card', async () => {
    const D = await monthlyFamily('chen', { card: false });
    const f = fakeCharger();
    await runBilling({ charge: f.charge, today: '2026-10-01' });
    expect(f.calls.filter((c) => c.customerId.includes('chen'))).toHaveLength(0);
    expect(await byDue(D.h.id, '2026-10-01')).toMatchObject({ status: 'failed', lastError: 'no_card', retryOn: null });
  });
});

describe('paying a failed charge by hand', () => {
  it('pauses automatic retries while the family pays, and resumes them if they don’t', async () => {
    const E = await monthlyFamily('diaz');
    const decline = fakeCharger(() => ({ status: 'failed', code: 'card_declined', retry: true }));
    await runBilling({ charge: decline.charge, today: '2026-10-01' });
    const oct = await byDue(E.h.id, '2026-10-01');
    expect(oct.retryOn).toBe('2026-10-04');

    expect(await holdForManualPayment(A.h.id, oct.id)).toBe(false); // not their charge
    expect(await holdForManualPayment(E.h.id, oct.id)).toBe(true);
    const f = fakeCharger();
    await runBilling({ charge: f.charge, today: '2026-10-04' });
    expect(f.calls.filter((c) => c.installmentId === oct.id)).toHaveLength(0);

    await resumeRetries(oct.id, '2026-10-05'); // the pay-now form expired unused
    await runBilling({ charge: f.charge, today: '2026-10-06' });
    expect(f.calls.filter((c) => c.installmentId === oct.id)).toHaveLength(1);
    expect((await byDue(E.h.id, '2026-10-01')).status).toBe('paid');
  });

  it('only counts a payment for the exact amount due', async () => {
    const dec = await byDue(A.h.id, '2026-12-01');
    await markInstallmentPaid(dec.id, { paymentIntentId: 'pi_short', amountCents: 5000 });
    expect((await byDue(A.h.id, '2026-12-01')).status).toBe('failed');
    await markInstallmentPaid(dec.id, { paymentIntentId: 'pi_full', amountCents: 9500 });
    expect((await byDue(A.h.id, '2026-12-01')).status).toBe('paid');
  });

  it('keeps each family’s charges private', async () => {
    const other = await ensureHousehold({ id: 'u-full', name: 'Sam Full', email: 'full@example.com', emailVerified: true });
    expect(await getInstallment(other.id, A.installments[0].id)).toBeNull();
    expect(await getInstallment(A.h.id, A.installments[0].id)).not.toBeNull();
  });
});

describe('staff tools', () => {
  it('stops the remaining charges when a family withdraws, and records cash payments', async () => {
    const G = await monthlyFamily('park');
    const oct = await byDue(G.h.id, '2026-10-01');
    expect(await markPaidOutsideStripe(oct.id, 'u-hannah')).toMatchObject({ status: 'paid' });

    expect(await stopRemainingPayments(G.o.id, 'u-hannah')).toBe(2);
    const f = fakeCharger();
    await runBilling({ charge: f.charge, today: '2026-12-01' });
    expect(f.calls.filter((c) => c.customerId === 'cus_park')).toHaveLength(0);
    expect((await listInstallments(G.h.id)).map((i) => i.status)).toEqual(['paid', 'cancelled', 'cancelled']);
  });
});

describe('big months', () => {
  it('works in batches so each run stays short, picking up where it left off', async () => {
    const H = await monthlyFamily('lee');
    const I = await monthlyFamily('ng');
    const f = fakeCharger();
    expect(await runBilling({ charge: f.charge, today: '2026-10-01', limit: 1 })).toMatchObject({ due: 2, charged: 1, remaining: 1 });
    expect(await runBilling({ charge: f.charge, today: '2026-10-01', limit: 1 })).toMatchObject({ due: 1, charged: 1, remaining: 0 });
    expect([(await byDue(H.h.id, '2026-10-01')).status, (await byDue(I.h.id, '2026-10-01')).status]).toEqual(['paid', 'paid']);
  });
});
