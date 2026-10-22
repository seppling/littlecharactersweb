/**
 * Refunds (src/server/refunds.ts), credits (src/server/credits.ts), day-off
 * credits (src/server/day-off-credits.ts) and the yearly statement
 * (src/server/statements.ts): the most that can be refunded, the pending row
 * and Stripe's idempotency key with a stand-in for Stripe, cash and test
 * payments, credits across orders and bigger than a payment, waiting credits
 * at the billing run and at a new sign-up, removing credits, day-off credits
 * given once, the statement's totals, and teachers refused everywhere.
 */
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb, schema } from '@/server/db';
import { confirmOrder, createDraftOrder, createStudent, ensureHousehold, fulfillOrder } from '@/server/family';
import { listInstallments, markPaidOutsideStripe, runBilling, stopRemainingPayments, type ChargeRequest } from '@/server/billing';
import type { StaffUser } from '@/server/adjustments';
import { getCatalog } from '@/server/content';
import { addDayOff, previewRemoval, removeDayOff } from '@/server/days-off';
import { addStaff } from '@/server/staff-settings';
import {
  createRefund,
  familyPayments,
  loadPayment,
  parseDollars,
  refundLeft,
  refundNote,
  retryRefund,
  settleRefund,
  type RefundRequest,
  type Refunder,
} from '@/server/refunds';
import { addCredit, applyWaitingCredits, creditLabel, familyCredits, planCredit, previewCredit, removeCredit } from '@/server/credits';
import { dayOffCredits, giveDayOffCredits } from '@/server/day-off-credits';
import { buildStatement, familyStatement, statementTable, statementYears } from '@/server/statements';

const INTRO = 'intro-f26-tue'; // Tuesdays, $95/month
const YESAND = 'yesand-f26-wed'; // Wednesdays, $95/month
const hannah: StaffUser = { id: 'u-hannah', email: 'hannah@example.com', emailVerified: true };
const teacher: StaffUser = { id: 'u-teach-rc', email: 'teach.rc@example.com', emailVerified: true };

let n = 0;
async function family(tag: string) {
  const db = await getDb();
  const u = { id: `u-${tag}`, name: `Pat ${tag}`, email: `${tag}@example.com`, emailVerified: true };
  await db.insert(schema.user).values(u);
  const h = await ensureHousehold(u);
  await db.update(schema.household).set({ stripeCustomerId: `cus_${tag}`, stripePaymentMethodId: `pm_${tag}` }).where(eq(schema.household.id, h.id));
  const kid = await createStudent(h.id, { firstName: `Kid${++n}`, lastName: tag, birthdate: '2017-05-05' }, u.id);
  return { u, h, kid };
}
async function signUp(f: Awaited<ReturnType<typeof family>>, session = INTRO, plan: 'monthly' | 'full' = 'monthly', paid?: { checkoutSessionId: string }) {
  const o = await confirmOrder(f.h.id, (await createDraftOrder(f.h.id, f.u.id, session, [f.kid.id])).id, plan, f.u.id);
  if (paid) {
    const db = await getDb();
    await db.update(schema.order).set({ stripeCheckoutSessionId: paid.checkoutSessionId }).where(eq(schema.order.id, o.id));
  }
  return fulfillOrder(o.id, f.u.id, paid ? { checkoutSessionId: paid.checkoutSessionId, amountCents: o.totalCents } : undefined);
}
/** Autopay that succeeds, with Stripe-like ids so the payment counts as a card payment. */
const charge = async (req: ChargeRequest) => {
  const id = `pi_${req.installmentId.slice(0, 8)}_${req.attempt}`;
  if (!req.paymentIntentId) await req.remember(id);
  return { status: 'succeeded' as const, paymentIntentId: id };
};
const amounts = async (householdId: string) => (await listInstallments(householdId)).map((i) => [i.dueDate.slice(5, 7), i.amountCents, i.status]);

/** A stand-in for Stripe: records each call and the row's status at that moment, then answers as told. */
function standIn(answer: (req: RefundRequest) => Awaited<ReturnType<Refunder>> | Promise<never>) {
  const calls: { req: RefundRequest; rowStatus: string | undefined }[] = [];
  const refunder: Refunder = async (req) => {
    const db = await getDb();
    const [row] = await db.select().from(schema.refund).where(eq(schema.refund.id, req.refundId));
    calls.push({ req, rowStatus: row?.status });
    return answer(req);
  };
  return { refunder, calls };
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-20T16:00:00Z'));
  const db = await getDb();
  await db.insert(schema.user).values({ id: hannah.id, name: 'Hannah Eppling', email: hannah.email, emailVerified: true });
  await db.insert(schema.user).values({ id: teacher.id, name: 'Terry Teach', email: teacher.email, emailVerified: true });
  await addStaff(hannah.id, { email: teacher.email, name: 'Terry Teach', role: 'teacher' });
});
afterAll(() => {
  vi.useRealTimers();
});

describe('the most that can be refunded', () => {
  const r = (amountCents: number, status: 'pending' | 'succeeded' | 'failed') => ({ amountCents, status });
  it('is what was paid less earlier refunds, pending ones included, failed ones not', () => {
    expect(refundLeft(9500, [])).toBe(9500);
    expect(refundLeft(9500, [r(2000, 'succeeded'), r(1500, 'pending'), r(9000, 'failed')])).toBe(6000);
    expect(refundLeft(9500, [r(9500, 'succeeded')])).toBe(0);
  });
  it('says what was refunded', () => {
    expect(refundNote(2500, [])).toBeNull();
    expect(refundNote(2500, [r(2500, 'succeeded')])).toBe('Refunded $25');
    expect(refundNote(2500, [r(1000, 'succeeded')])).toBe('Partly refunded: $10 of $25');
    expect(refundNote(2500, [r(1000, 'pending')])).toBe('Partly refunded: $10 of $25 ($10 pending)');
  });
  it('reads dollars and cents', () => {
    expect(parseDollars('12.50')).toBe(1250);
    expect(parseDollars('$40')).toBe(4000);
    expect(parseDollars('1,000')).toBe(100000);
    expect(parseDollars('0')).toBeNull();
    expect(parseDollars('12.345')).toBeNull();
    expect(parseDollars('abc')).toBeNull();
  });
});

describe('refunding a card payment', () => {
  it('writes the pending row first, sends its id to Stripe, and saves Stripe’s answer; emails the family', async () => {
    const f = await family('ruiz');
    const o = await signUp(f, INTRO, 'monthly', { checkoutSessionId: 'cs_test_ruiz' });
    const { refunder, calls } = standIn((req) => ({ status: 'succeeded', stripeRefundId: `re_${req.refundId.slice(0, 6)}` }));
    const out = await createRefund(hannah, { orderId: o.id, amountCents: 1000, reason: 'Missed the first week', emailFamily: true }, { refunder });
    expect(calls).toHaveLength(1);
    expect(calls[0].rowStatus).toBe('pending');
    expect(calls[0].req).toEqual({ refundId: out.refund.id, amountCents: 1000, paymentIntentId: null, checkoutSessionId: 'cs_test_ruiz' });
    expect(out.refund).toMatchObject({ status: 'succeeded', stripeRefundId: `re_${out.refund.id.slice(0, 6)}`, amountCents: 1000, orderId: o.id, installmentId: null, createdBy: hannah.id });
    expect(out.payment.leftCents).toBe(o.totalCents - 1000);
    expect(out.emailed).toBe(1);
    const db = await getDb();
    const mail = (await db.select().from(schema.devEmail)).find((m) => m.to === 'ruiz@example.com' && m.subject.startsWith('Refund of $10 for'));
    expect(mail?.subject).toBe('Refund of $10 for Sign-up: Intro to Theater (first month) · Little Characters');
    expect(mail?.text).toContain('It takes 5–10 days to reach your card.');
    const p = await loadPayment({ orderId: o.id });
    expect(refundNote(p!.amountCents, p!.refunds)).toBe(`Partly refunded: $10 of ${'$' + (o.totalCents / 100).toFixed(o.totalCents % 100 ? 2 : 0)}`);
  });

  it('a monthly charge is refunded on its own payment; Stripe’s idempotency key is the row’s id (stripe.ts)', async () => {
    const f = await family('nguyen');
    const o = await signUp(f);
    await runBilling({ charge, today: '2026-11-01' });
    const nov = (await listInstallments(f.h.id))[0];
    expect(nov.status).toBe('paid');
    const { refunder, calls } = standIn(() => ({ status: 'succeeded', stripeRefundId: 're_nguyen' }));
    const out = await createRefund(hannah, { orderId: o.id, installmentId: nov.id, amountCents: 9500, reason: 'Withdrew', emailFamily: false }, { refunder });
    expect(calls[0].req.paymentIntentId).toBe(nov.stripePaymentIntentId);
    expect(out.refund).toMatchObject({ status: 'succeeded', installmentId: nov.id, orderId: o.id });
    expect(out.emailed).toBe(0);
    // All of it is refunded: nothing more.
    await expect(createRefund(hannah, { orderId: o.id, installmentId: nov.id, amountCents: 1, reason: 'x', emailFamily: false }, { refunder })).rejects.toThrow(/refunded in full already/);
    // Nothing else changes: the enrollment and the payments to come.
    expect(await amounts(f.h.id)).toEqual([['11', 9500, 'paid'], ['12', 9500, 'scheduled']]);
    const src = await import('node:fs').then((fs) => fs.readFileSync('src/server/stripe.ts', 'utf8'));
    expect(src).toContain('idempotencyKey: `refund-${req.refundId}`');
    expect(src).toContain('metadata: { refundId: req.refundId }');
  });

  it('a failed refund is saved as failed with Stripe’s reason, gives nothing back, and isn’t emailed', async () => {
    const f = await family('okafor');
    const o = await signUp(f, INTRO, 'monthly', { checkoutSessionId: 'cs_test_okafor' });
    const { refunder } = standIn(() => ({ status: 'failed', stripeRefundId: null, error: 'Charge already refunded' }));
    const out = await createRefund(hannah, { orderId: o.id, amountCents: 500, reason: 'Oops', emailFamily: true }, { refunder });
    expect(out.refund).toMatchObject({ status: 'failed', error: 'Charge already refunded' });
    expect(out.emailed).toBe(0);
    expect(out.payment.leftCents).toBe(o.totalCents);
  });

  it('pending, then settled by the webhook; a later failure is saved too', async () => {
    const f = await family('patel');
    const o = await signUp(f, INTRO, 'monthly', { checkoutSessionId: 'cs_test_patel' });
    const { refunder } = standIn(() => ({ status: 'pending', stripeRefundId: 're_patel' }));
    const out = await createRefund(hannah, { orderId: o.id, amountCents: 700, reason: 'Credit', emailFamily: false }, { refunder });
    expect(out.refund.status).toBe('pending');
    // Pending counts against what's left.
    expect((await loadPayment({ orderId: o.id }))!.leftCents).toBe(o.totalCents - 700);
    expect(await settleRefund({ stripeRefundId: 're_patel', refundId: out.refund.id, status: 'pending' })).toBeNull();
    const done = await settleRefund({ stripeRefundId: 're_patel', refundId: out.refund.id, status: 'succeeded' });
    expect(done?.status).toBe('succeeded');
    // Delivered twice: nothing changes.
    expect((await settleRefund({ stripeRefundId: 're_patel', status: 'succeeded' }))?.status).toBe('succeeded');
    const failed = await settleRefund({ stripeRefundId: 're_patel', status: 'failed', failureReason: 'expired_or_canceled_card' });
    expect(failed).toMatchObject({ status: 'failed', error: 'The card was closed or has expired. Give the money back another way.' });
    expect((await loadPayment({ orderId: o.id }))!.leftCents).toBe(o.totalCents);
  });

  it('Stripe not answering leaves it pending; Try again sends the same refund id', async () => {
    const f = await family('quinn');
    const o = await signUp(f, INTRO, 'monthly', { checkoutSessionId: 'cs_test_quinn' });
    const down = standIn(() => Promise.reject(new Error('connection reset')));
    const out = await createRefund(hannah, { orderId: o.id, amountCents: 300, reason: 'x', emailFamily: false }, { refunder: down.refunder });
    expect(out.refund).toMatchObject({ status: 'pending', stripeRefundId: null });
    expect(out.refund.error).toMatch(/Try again/);
    const up = standIn(() => ({ status: 'succeeded', stripeRefundId: 're_quinn' }));
    await expect(retryRefund(teacher, out.refund.id, { refunder: up.refunder })).rejects.toThrow(/Only owners/);
    const again = await retryRefund(hannah, out.refund.id, { refunder: up.refunder });
    expect(up.calls[0].req.refundId).toBe(down.calls[0].req.refundId);
    expect(again).toMatchObject({ status: 'succeeded', stripeRefundId: 're_quinn', error: null });
  });

  it('never more than is left: checked on the server, and two refunds at once can’t both pass', async () => {
    const f = await family('reyes');
    const o = await signUp(f, INTRO, 'monthly', { checkoutSessionId: 'cs_test_reyes' });
    const { refunder } = standIn(() => ({ status: 'pending', stripeRefundId: null }));
    await expect(createRefund(hannah, { orderId: o.id, amountCents: o.totalCents + 1, reason: 'x', emailFamily: false }, { refunder })).rejects.toThrow(/more than is left/);
    const sixty = Math.round(o.totalCents * 0.6);
    const both = await Promise.allSettled([
      createRefund(hannah, { orderId: o.id, amountCents: sixty, reason: 'one', emailFamily: false }, { refunder }),
      createRefund(hannah, { orderId: o.id, amountCents: sixty, reason: 'two', emailFamily: false }, { refunder }),
    ]);
    expect(both.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    expect(both.find((x) => x.status === 'rejected')).toMatchObject({ reason: expect.objectContaining({ message: expect.stringMatching(/more than is left/) }) });
    const db = await getDb();
    expect(await db.select().from(schema.refund).where(eq(schema.refund.orderId, o.id))).toHaveLength(1);
  });

  it('the same form sent twice (a double click) refunds once, even a full refund', async () => {
    const f = await family('okoro');
    const o = await signUp(f, INTRO, 'monthly', { checkoutSessionId: 'cs_test_okoro' });
    const stand = standIn(() => ({ status: 'succeeded', stripeRefundId: 're_okoro' }));
    const id = crypto.randomUUID();
    const input = { orderId: o.id, amountCents: o.totalCents, reason: 'Moved away', emailFamily: false, id };
    const both = await Promise.all([createRefund(hannah, input, { refunder: stand.refunder }), createRefund(hannah, input, { refunder: stand.refunder })]);
    expect(both.map((b) => b.refund.id)).toEqual([id, id]);
    // Pressed again after it went through: still the one refund, not "refunded in full already".
    expect((await createRefund(hannah, input, { refunder: stand.refunder })).refund.id).toBe(id);
    expect(stand.calls).toHaveLength(1);
    const db = await getDb();
    expect(await db.select().from(schema.refund).where(eq(schema.refund.orderId, o.id))).toHaveLength(1);
  });

  it('a reason is required', async () => {
    const f = await family('soto');
    const o = await signUp(f, INTRO, 'monthly', { checkoutSessionId: 'cs_test_soto' });
    await expect(createRefund(hannah, { orderId: o.id, amountCents: 100, reason: '  ', emailFamily: false }, { refunder: standIn(() => ({ status: 'succeeded', stripeRefundId: 're' })).refunder })).rejects.toThrow(/Write a reason/);
  });
});

describe('cash, check and test payments', () => {
  it('a month marked paid by cash or check: recorded as given back, no Stripe call', async () => {
    const f = await family('tanaka');
    const o = await signUp(f);
    const nov = (await listInstallments(f.h.id))[0];
    await markPaidOutsideStripe(nov.id, hannah.id);
    const p = await loadPayment({ orderId: o.id, installmentId: nov.id });
    expect(p?.via).toBe('cash');
    const { refunder, calls } = standIn(() => ({ status: 'succeeded', stripeRefundId: 'never' }));
    const out = await createRefund(hannah, { orderId: o.id, installmentId: nov.id, amountCents: 2000, reason: 'Gave back $20 in cash', emailFamily: true }, { refunder });
    expect(calls).toHaveLength(0);
    expect(out.refund).toMatchObject({ status: 'succeeded', stripeRefundId: null, amountCents: 2000 });
    const db = await getDb();
    expect((await db.select().from(schema.devEmail)).find((m) => m.to === 'tanaka@example.com' && m.subject.startsWith('Refund of $20'))?.text).toContain('back by cash or check');
  });

  it('a local test payment (no Stripe keys): recorded as succeeded without Stripe', async () => {
    const f = await family('ueda');
    const o = await signUp(f);
    expect((await loadPayment({ orderId: o.id }))?.via).toBe('test');
    const out = await createRefund(hannah, { orderId: o.id, amountCents: 500, reason: 'Test', emailFamily: false });
    expect(out.refund).toMatchObject({ status: 'succeeded', stripeRefundId: null });
  });
});

describe('credits', () => {
  it('come off the family’s next payment across their orders, earliest due date first; then the next', async () => {
    const f = await family('vance');
    await signUp(f, INTRO);
    const kid2 = await createStudent(f.h.id, { firstName: 'Vee', lastName: 'vance', birthdate: '2016-03-03' }, f.u.id);
    const o2 = await confirmOrder(f.h.id, (await createDraftOrder(f.h.id, f.u.id, YESAND, [kid2.id])).id, 'monthly', f.u.id);
    await fulfillOrder(o2.id, f.u.id);
    // Two classes: 15% off each, $80.75 a month.
    const before = await listInstallments(f.h.id);
    expect(before.map((i) => [i.dueDate, i.amountCents])).toEqual([['2026-11-01', 8075], ['2026-11-01', 8075], ['2026-12-01', 8075], ['2026-12-01', 8075]]);

    const preview = await previewCredit(hannah, { householdId: f.h.id, amountCents: 1900, reason: 'Missed class Oct 6', showToFamily: true });
    expect(preview.pieces).toEqual([expect.objectContaining({ dueDate: '2026-11-01', cents: 1900, beforeCents: 8075, afterCents: 6175 })]);
    expect(preview.waitingCents).toBe(0);
    expect(await amounts(f.h.id)).toEqual(before.map((i) => [i.dueDate.slice(5, 7), 8075, 'scheduled']));

    const saved = await addCredit(hannah, { householdId: f.h.id, amountCents: 1900, reason: 'Missed class Oct 6', showToFamily: true });
    const after = await listInstallments(f.h.id);
    const target = after.find((i) => i.id === preview.pieces[0].installmentId)!;
    expect(target.amountCents).toBe(6175);
    expect(target.adjustments).toEqual([expect.objectContaining({ label: 'Credit · Missed class Oct 6', cents: 1900 })]);
    expect(saved!.applied[0]).toMatchObject({ appliedToInstallmentId: target.id, adjustmentId: target.adjustments[0].adjustmentId });
    expect(saved!.applied[0].appliedAt).toBeInstanceOf(Date);

    // The same Save credit form sent twice: one credit.
    const once = crypto.randomUUID();
    const credit = { householdId: f.h.id, amountCents: 500, reason: 'Pressed twice', showToFamily: false };
    expect(await addCredit(hannah, credit, { id: once })).not.toBeNull();
    expect(await addCredit(hannah, credit, { id: once })).toBeNull();
    expect((await familyCredits(f.h.id)).filter((c) => c.reason === 'Pressed twice')).toHaveLength(1);

    // A private reason: families read "Credit".
    expect(creditLabel({ reason: 'Hannah’s note', showToFamily: false })).toBe('Credit');
  });

  it('bigger than the payment: what fits is applied, the rest is a new credit on the next payment', async () => {
    const f = await family('wells');
    await signUp(f);
    const saved = await addCredit(hannah, { householdId: f.h.id, amountCents: 12000, reason: 'Season credit', showToFamily: false });
    expect(await amounts(f.h.id)).toEqual([['11', 0, 'scheduled'], ['12', 7000, 'scheduled']]);
    const list = await familyCredits(f.h.id);
    expect(list.map((c) => [c.amountCents, c.reason, c.state]).sort()).toEqual([
      [2500, 'Rest of the credit from Oct 20', 'applied'],
      [9500, 'Season credit', 'applied'],
    ]);
    expect(saved!.created).toHaveLength(1);
    expect(planCredit(12000, (await listInstallments(f.h.id)).filter(() => false))).toEqual({ pieces: [], waitingCents: 12000 });
  });

  it('waits when there’s no payment to come, and is applied when the family signs up', async () => {
    const f = await family('xu');
    await signUp(f, INTRO, 'full');
    const saved = await addCredit(hannah, { householdId: f.h.id, amountCents: 2500, reason: 'Day off', showToFamily: true });
    expect(saved!.applied).toEqual([]);
    expect((await familyCredits(f.h.id))[0].state).toBe('waiting');
    // A new monthly sign-up: the credit comes off its first payment.
    const kid2 = await createStudent(f.h.id, { firstName: 'Xan', lastName: 'xu', birthdate: '2016-03-03' }, f.u.id);
    const o2 = await confirmOrder(f.h.id, (await createDraftOrder(f.h.id, f.u.id, YESAND, [kid2.id])).id, 'monthly', f.u.id);
    await fulfillOrder(o2.id, f.u.id);
    const c = (await familyCredits(f.h.id))[0];
    expect(c.state).toBe('applied');
    expect(c.payment?.dueDate).toBe('2026-11-01');
  });

  it('waits while the only payment is locked, and is applied by the billing run before anything is charged', async () => {
    const f = await family('young');
    const o = await signUp(f);
    const db = await getDb();
    const [nov, dec] = await listInstallments(f.h.id);
    // November failed and the family has the pay-now form open; December is paid already.
    await db.update(schema.installment).set({ status: 'failed', payNowOpenedAt: new Date(), retryOn: null }).where(eq(schema.installment.id, nov.id));
    await db.update(schema.installment).set({ status: 'paid', paidAt: new Date() }).where(eq(schema.installment.id, dec.id));
    await addCredit(hannah, { householdId: f.h.id, amountCents: 1000, reason: 'Waiting', showToFamily: true });
    expect((await familyCredits(f.h.id))[0].state).toBe('waiting');
    // Three hours later the form has expired; the billing run applies the credit first.
    vi.setSystemTime(new Date('2026-10-20T19:30:00Z'));
    await runBilling({ charge, today: '2026-10-20' });
    expect((await listInstallments(f.h.id))[0]).toMatchObject({ orderId: o.id, amountCents: 8500, status: 'failed' });
    expect((await familyCredits(f.h.id))[0].state).toBe('applied');
    vi.setSystemTime(new Date('2026-10-20T16:00:00Z'));
  });

  it('a credit on a payment that’s then stopped goes back to waiting', async () => {
    const f = await family('zane');
    const o = await signUp(f);
    await addCredit(hannah, { householdId: f.h.id, amountCents: 1500, reason: 'Stopped', showToFamily: true });
    await stopRemainingPayments(o.id, hannah.id);
    expect(await applyWaitingCredits(f.h.id)).toBe(0);
    expect((await familyCredits(f.h.id))[0]).toMatchObject({ state: 'waiting', appliedToInstallmentId: null });
  });

  it('removing: a waiting one, and an applied one (its payment goes back up); a paid one stays', async () => {
    const f = await family('abbott');
    await signUp(f);
    const db = await getDb();
    const a = await addCredit(hannah, { householdId: f.h.id, amountCents: 2000, reason: 'One', showToFamily: true });
    expect((await amounts(f.h.id))[0]).toEqual(['11', 7500, 'scheduled']);
    await removeCredit(hannah, f.h.id, a!.credit.id);
    expect((await amounts(f.h.id))[0]).toEqual(['11', 9500, 'scheduled']);
    const [adj] = await db.select().from(schema.billingAdjustment).where(eq(schema.billingAdjustment.id, a!.applied[0].adjustmentId!));
    expect(adj.removedAt).toBeInstanceOf(Date);
    await expect(removeCredit(hannah, f.h.id, a!.credit.id)).rejects.toThrow(/already removed/);

    // Paid: it stays.
    vi.setSystemTime(new Date('2026-10-20T16:01:00Z'));
    const b = await addCredit(hannah, { householdId: f.h.id, amountCents: 1000, reason: 'Two', showToFamily: true });
    await runBilling({ charge, today: '2026-11-01' });
    expect((await amounts(f.h.id))[0]).toEqual(['11', 8500, 'paid']);
    await expect(removeCredit(hannah, f.h.id, b!.credit.id)).rejects.toThrow(/stays/);

    // Waiting: removed, nothing else changes.
    await db.update(schema.installment).set({ status: 'cancelled' }).where(and(eq(schema.installment.householdId, f.h.id), eq(schema.installment.status, 'scheduled')));
    vi.setSystemTime(new Date('2026-10-20T16:02:00Z'));
    const c = await addCredit(hannah, { householdId: f.h.id, amountCents: 500, reason: 'Three', showToFamily: false });
    expect(c!.applied).toEqual([]);
    await removeCredit(hannah, f.h.id, c!.credit.id);
    expect((await familyCredits(f.h.id)).map((x) => [x.reason, x.state])).toEqual([['Three', 'removed'], ['Two', 'used'], ['One', 'removed']]);
    vi.setSystemTime(new Date('2026-10-20T16:00:00Z'));
  });
});

describe('day-off credits', () => {
  it('one class’s worth for each family whose month was paid, given once only', async () => {
    const catalog = await getCatalog();
    const f = await family('baird');
    await signUp(f);
    // November is paid when Hannah adds a day off on Nov 24 (a Tuesday) and lowers payments.
    await runBilling({ charge, today: '2026-11-01' });
    const saved = await addDayOff(hannah, catalog, { from: '2026-11-24', to: '2026-11-24', sessionIds: [INTRO], reason: 'Teacher out', payments: 'lower' });
    const list = await dayOffCredits(catalog, saved.closureIds);
    const mine = list.find((c) => c.householdId === f.h.id)!;
    // $95 ÷ 4 November Tuesdays = $23.75.
    expect(mine).toMatchObject({ date: '2026-11-24', reason: 'Day off Nov 24 (Teacher out)', cents: 2375, given: false });
    await expect(giveDayOffCredits(teacher, catalog, saved.closureIds)).rejects.toThrow(/Only owners/);
    expect(await giveDayOffCredits(hannah, catalog, saved.closureIds)).toBeGreaterThanOrEqual(1);
    expect((await dayOffCredits(catalog, saved.closureIds)).find((c) => c.householdId === f.h.id)?.given).toBe(true);
    expect(await giveDayOffCredits(hannah, catalog, saved.closureIds)).toBe(0);
    const credits = await familyCredits(f.h.id);
    expect(credits.map((c) => [c.amountCents, c.reason, c.showToFamily, c.state])).toEqual([[2375, 'Day off Nov 24 (Teacher out)', true, 'applied']]);
    expect((await listInstallments(f.h.id))[1].adjustments).toEqual([expect.objectContaining({ label: 'Credit · Day off Nov 24 (Teacher out)', cents: 2375 })]);

    // Removed (a typo, say): the credit is taken back and December goes back up; added again, it's given again, once.
    expect((await previewRemoval(hannah, saved.closureIds[0]))!.creditsBack.map((c) => c.householdId)).toContain(f.h.id);
    await removeDayOff(hannah, saved.closureIds[0]);
    expect((await familyCredits(f.h.id)).map((c) => c.state)).toEqual(['removed']);
    expect((await listInstallments(f.h.id))[1].adjustments).toEqual([]);
    const again = await addDayOff(hannah, catalog, { from: '2026-11-24', to: '2026-11-24', sessionIds: [INTRO], reason: 'Teacher out', payments: 'lower' });
    expect(await giveDayOffCredits(hannah, catalog, again.closureIds)).toBeGreaterThanOrEqual(1);
    expect((await familyCredits(f.h.id)).filter((c) => c.state !== 'removed').map((c) => c.amountCents)).toEqual([2375]);

    // Used on a paid December: removing the day off leaves it, and adding the day once more gives no second one.
    await runBilling({ charge, today: '2026-12-01' });
    const removal = (await previewRemoval(hannah, again.closureIds[0]))!;
    expect(removal.creditsStay.map((c) => c.householdId)).toContain(f.h.id);
    await removeDayOff(hannah, again.closureIds[0]);
    const third = await addDayOff(hannah, catalog, { from: '2026-11-24', to: '2026-11-24', sessionIds: [INTRO], reason: 'Teacher out', payments: 'lower' });
    expect((await dayOffCredits(catalog, third.closureIds)).find((c) => c.householdId === f.h.id)?.given).toBe(true);
    await giveDayOffCredits(hannah, catalog, third.closureIds);
    expect((await familyCredits(f.h.id)).filter((c) => c.state !== 'removed')).toHaveLength(1);
  });

});

describe('the yearly statement', () => {
  it('lists the year’s payments, then refunds, and the total paid less refunds', async () => {
    const f = await family('cole');
    const o = await signUp(f);
    await runBilling({ charge, today: '2026-11-01' });
    const nov = (await listInstallments(f.h.id))[0];
    await createRefund(hannah, { orderId: o.id, installmentId: nov.id, amountCents: 2000, reason: 'Missed', emailFamily: false }, { refunder: standIn(() => ({ status: 'succeeded', stripeRefundId: 're_cole' })).refunder });
    const catalog = await getCatalog();
    const content = { findSession: catalog.findSession, locationById: catalog.locationById, site: { ...catalog.site, statements: { taxId: '12-3456789' } } };
    const s = (await familyStatement(f.h.id, 2026, content, { cardOf: async () => '4242' }))!;
    expect(s.payments.map((l) => [l.what, l.amountCents, l.paidWith])).toEqual([
      ['Sign-up: Intro to Theater (first month)', o.totalCents, 'card'],
      ['November tuition: ' + nov.label.split(': ')[1], 9500, 'card ending 4242'],
    ]);
    expect(s.payments[0].child).toBe(`Kid${n}`);
    expect(s.refunds).toEqual([expect.objectContaining({ amountCents: -2000, what: `Refund: ${nov.label}`, paidWith: 'card ending 4242' })]);
    expect(s).toMatchObject({ paidCents: o.totalCents + 9500, refundedCents: 2000, netCents: o.totalCents + 7500 });
    expect(s.from).toMatchObject({ name: 'Little Characters Theater Troupe', address: ['1635 W Broad St', 'Athens, GA 30606'], taxId: '12-3456789' });
    const t = statementTable(s);
    expect(t.rows.at(-1)).toEqual(['', '', 'Total paid less refunds', '', ((o.totalCents + 7500) / 100).toFixed(2)]);
    expect(statementYears(await familyPayments(f.h.id))).toEqual([2026]);
    // Another year: nothing in it.
    expect((await familyStatement(f.h.id, 2025, content))!.netCents).toBe(0);
  });

  it('counts a refund in the year it was made, and leaves failed ones out (pure)', () => {
    const at = (iso: string) => new Date(`${iso}T17:00:00Z`);
    const pay = (key: string, paidAt: string, cents: number, refunds: { cents: number; at: string; status: 'pending' | 'succeeded' | 'failed' }[]) =>
      ({
        key,
        kind: 'monthly',
        orderId: 'o',
        installmentId: key,
        householdId: 'h',
        sessionId: 's',
        plan: 'monthly',
        studentIds: ['k'],
        paidAt: at(paidAt),
        amountCents: cents,
        via: 'cash',
        label: `Payment ${key}`,
        paymentIntentId: null,
        checkoutSessionId: null,
        refunds: refunds.map((r, i) => ({ id: `${key}${i}`, amountCents: r.cents, status: r.status, createdAt: at(r.at) })),
        leftCents: 0,
      }) as unknown as Parameters<typeof buildStatement>[0]['payments'][number];
    const payments = [pay('a', '2026-12-01', 9500, [{ cents: 9500, at: '2027-01-05', status: 'succeeded' }]), pay('b', '2026-11-01', 9500, [{ cents: 500, at: '2026-11-03', status: 'failed' }])];
    const base = { family: 'F', from: { name: 'LC', address: [], email: 'e' }, payments, names: new Map([['k', 'Ava']]), cards: new Map() };
    expect(buildStatement({ ...base, year: 2026 })).toMatchObject({ paidCents: 19000, refundedCents: 0, netCents: 19000 });
    expect(buildStatement({ ...base, year: 2027 })).toMatchObject({ paidCents: 0, refundedCents: 9500, netCents: -9500 });
    expect(buildStatement({ ...base, year: 2026 }).payments[0]).toMatchObject({ child: 'Ava', paidWith: 'cash/check' });
  });
});

describe('teachers are refused everywhere', () => {
  it('refunds, credits and day-off credits', async () => {
    const f = await family('dunn');
    const o = await signUp(f);
    await expect(createRefund(teacher, { orderId: o.id, amountCents: 100, reason: 'x', emailFamily: false })).rejects.toThrow(/Only owners/);
    await expect(previewCredit(teacher, { householdId: f.h.id, amountCents: 100, reason: 'x', showToFamily: false })).rejects.toThrow(/Only owners/);
    await expect(addCredit(teacher, { householdId: f.h.id, amountCents: 100, reason: 'x', showToFamily: false })).rejects.toThrow(/Only owners/);
    const c = await addCredit(hannah, { householdId: f.h.id, amountCents: 100, reason: 'x', showToFamily: false });
    await expect(removeCredit(teacher, f.h.id, c!.credit.id)).rejects.toThrow(/Only owners/);
  });
});

describe('links', async () => {
  const links = await import('@/lib/admin-links');
  it('give the refund, credits and statement addresses', () => {
    expect(links.refundPage('o1')).toBe('/admin/payments/o1/refund');
    expect(links.refundPage('o1', 'i1')).toBe('/admin/payments/o1/refund?installment=i1');
    expect(links.creditsPage('h1')).toBe('/admin/families/h1/credits');
    expect(links.downloads(links.familyStatement('h1', 2026))).toEqual({ csv: '/admin/families/h1/statement.csv?year=2026', pdf: '/admin/families/h1/statement.pdf?year=2026' });
  });
});
