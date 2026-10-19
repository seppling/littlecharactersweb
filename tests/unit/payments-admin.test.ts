/**
 * The staff Payments pages' reads (src/server/payments-admin.ts), and "Send a
 * pay link": the same email a failed charge sends, to the same parents.
 */
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb, schema } from '@/server/db';
import { config } from '@/server/env';
import { confirmOrder, createDraftOrder, createStudent, ensureHousehold, fulfillOrder } from '@/server/family';
import { listInstallments, markInstallmentFailed, markPaidOutsideStripe, runBilling, type ChargeRequest, type ChargeResult } from '@/server/billing';
import {
  PAY_LINK_SENT,
  addMonths,
  byDate,
  listFor,
  overdueTable,
  paymentsAttention,
  paymentsReceived,
  receivedMonth,
  receivedTable,
  sendPayLink,
  shiftMonth,
  upcomingAutopay,
  upcomingCharges,
} from '@/server/payments-admin';

const SESSION = 'intro-f26-tue'; // Tuesdays, Aug 17 – Dec 18, $95/month
const HANNAH = { id: 'u-hannah', name: 'Hannah Eppling', email: 'hannah@example.com', emailVerified: true };
const title = () => 'Intro to Theater';

async function monthlyFamily(tag: string, kid: string) {
  const db = await getDb();
  const u = { id: `u-${tag}`, name: `Pat ${tag}`, email: `${tag}@example.com`, emailVerified: true };
  await db.insert(schema.user).values(u);
  const h = await ensureHousehold(u);
  await db.update(schema.household).set({ stripeCustomerId: `cus_${tag}`, stripePaymentMethodId: `pm_${tag}` }).where(eq(schema.household.id, h.id));
  const child = await createStudent(h.id, { firstName: kid, lastName: tag, birthdate: '2017-05-05' }, u.id);
  const o = await confirmOrder(h.id, (await createDraftOrder(h.id, u.id, SESSION, [child.id])).id, 'monthly', u.id);
  await fulfillOrder(o.id, u.id);
  return { h, o, u };
}

const charger = (fail: (req: ChargeRequest) => boolean) => async (req: ChargeRequest): Promise<ChargeResult> => {
  await req.remember(`pi_${req.installmentId.slice(0, 6)}_${req.attempt}`);
  return fail(req) ? { status: 'failed', code: 'card_declined', retry: true } : { status: 'succeeded', paymentIntentId: `pi_${req.installmentId.slice(0, 6)}` };
};
const mail = async () => (await (await getDb()).select().from(schema.devEmail)).map((m) => ({ to: m.to, subject: m.subject, text: m.text }));
const byDue = async (householdId: string, dueDate: string) => (await listInstallments(householdId)).find((i) => i.dueDate === dueDate)!;

let R: Awaited<ReturnType<typeof monthlyFamily>>;
let D: Awaited<ReturnType<typeof monthlyFamily>>;

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-10T16:00:00Z'));
  const db = await getDb();
  await db.insert(schema.user).values(HANNAH);
  R = await monthlyFamily('ruiz', 'Lena');
  D = await monthlyFamily('diaz', 'Omar');
  // A second parent in the Ruiz family: both get every payment email.
  const other = { id: 'u-ruiz2', name: 'Alex Ruiz', email: 'ruiz2@example.com', emailVerified: true };
  await db.insert(schema.user).values(other);
  await db.insert(schema.householdMember).values({ householdId: R.h.id, userId: other.id });
});
afterAll(() => {
  vi.useRealTimers();
});

describe('Payments received', () => {
  it('lists sign-up payments by the month they came in, paid by card', async () => {
    const sept = await paymentsReceived('2026-09');
    expect(sept.map((p) => [p.family, p.what, p.method])).toEqual(
      expect.arrayContaining([
        ['ruiz family', 'Sign-up (first month)', 'card'],
        ['diaz family', 'Sign-up (first month)', 'card'],
      ]),
    );
    expect(sept).toHaveLength(2);
    expect(await paymentsReceived('2026-10')).toEqual([]);
  });

  it('lists monthly charges, newest first, with cash or check marked by staff', async () => {
    vi.setSystemTime(new Date('2026-10-01T13:00:00Z'));
    expect(await markPaidOutsideStripe((await byDue(D.h.id, '2026-10-01')).id, HANNAH.id)).toMatchObject({ status: 'paid' });
    vi.setSystemTime(new Date('2026-10-01T14:00:00Z'));
    await runBilling({ charge: charger(() => false), today: '2026-10-01' });

    const oct = await paymentsReceived('2026-10');
    expect(oct.map((p) => [p.family, p.what, p.amountCents, p.method, p.markedBy])).toEqual([
      ['ruiz family', 'October tuition: Lena, Intro to Theater', 9500, 'card', null],
      ['diaz family', 'October tuition: Omar, Intro to Theater', 9500, 'staff', 'Hannah Eppling'],
    ]);
    expect(receivedTable(oct, title).rows).toEqual([
      ['2026-10-01', 'ruiz family', 'Intro to Theater', 'October tuition: Lena, Intro to Theater', '95.00', 'Card'],
      ['2026-10-01', 'diaz family', 'Intro to Theater', 'October tuition: Omar, Intro to Theater', '95.00', 'Cash or check, marked by Hannah Eppling'],
    ]);
  });

  it('counts a payment in the month it was made in Athens, not in UTC', async () => {
    const db = await getDb();
    const oct = await byDue(R.h.id, '2026-10-01');
    // 11:30 PM on Oct 31 in Athens is already Nov 1 in UTC.
    await db.update(schema.installment).set({ paidAt: new Date('2026-11-01T03:30:00Z') }).where(eq(schema.installment.id, oct.id));
    expect((await paymentsReceived('2026-10')).map((p) => p.family)).toContain('ruiz family');
    expect((await paymentsReceived('2026-11')).map((p) => p.family)).not.toContain('ruiz family');
    await db.update(schema.installment).set({ paidAt: new Date('2026-10-01T14:00:00Z') }).where(eq(schema.installment.id, oct.id));
  });
});

describe('Send a pay link', () => {
  it('sends the very email a failed charge sends, to the same parents, and records it', async () => {
    vi.setSystemTime(new Date('2026-11-01T14:00:00Z'));
    const before = (await mail()).length;
    await runBilling({ charge: charger((req) => req.customerId === 'cus_ruiz'), today: '2026-11-01' });
    const nov = await byDue(R.h.id, '2026-11-01');
    expect(nov).toMatchObject({ status: 'failed', retryOn: '2026-11-04', lastError: 'card_declined' });
    const failedEmails = (await mail()).slice(before).filter((m) => m.subject.startsWith('We couldn’t'));
    expect(failedEmails.map((m) => m.to).sort()).toEqual(['ruiz2@example.com', 'ruiz@example.com']);

    // The words haven't changed since the email lived inside markInstallmentFailed.
    const payUrl = new URL(`/account/pay/${nov.id}`, config.siteUrl).toString();
    expect(failedEmails[0].subject).toBe('We couldn’t charge your card · Little Characters');
    expect(failedEmails[0].text).toBe(
      [
        'We couldn’t charge your card',
        'We tried to charge $95 for November tuition: Lena, Intro to Theater, but your bank declined the charge.',
        `We’ll try again on Wednesday, November 4. To pay now or use a different card, go to ${payUrl}`,
        'To avoid the $15 late fee, please make sure it’s paid by Tuesday, November 10.',
        'Questions, or need to make other arrangements? Just reply to this email.',
      ].join('\n\n'),
    );

    const mid = (await mail()).length;
    expect(await sendPayLink(nov.id, HANNAH.id, '2026-11-01')).toBe(2);
    const resent = (await mail()).slice(mid);
    expect(resent).toEqual(failedEmails);

    const db = await getDb();
    const logged = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, PAY_LINK_SENT), eq(schema.auditLog.entityId, nov.id)));
    expect(logged).toHaveLength(1);
    expect(logged[0].userId).toBe(HANNAH.id);
  });

  it('markInstallmentFailed still emails the pay link itself', async () => {
    const dec = await byDue(D.h.id, '2026-12-01');
    const before = (await mail()).length;
    await markInstallmentFailed(dec.id, 'expired_card', null, '2026-12-01');
    const sent = (await mail()).slice(before);
    expect(sent.map((m) => [m.to, m.subject])).toEqual([['diaz@example.com', 'We couldn’t charge your card · Little Characters']]);
    expect(sent[0].text).toContain('but the saved card has expired.');
    expect(sent[0].text).toContain(`Please pay or update your card here: ${new URL(`/account/pay/${dec.id}`, config.siteUrl)}`);
    // Put it back for the tests below.
    await (await getDb()).update(schema.installment).set({ status: 'scheduled', lastError: null }).where(eq(schema.installment.id, dec.id));
  });

  it('sends nothing for a charge that isn’t waiting to be paid', async () => {
    const before = (await mail()).length;
    expect(await sendPayLink((await byDue(D.h.id, '2026-11-01')).id, HANNAH.id)).toBeNull();
    expect(await sendPayLink((await byDue(D.h.id, '2026-12-01')).id, HANNAH.id)).toBeNull();
    expect((await mail()).length).toBe(before);
  });
});

describe('Needs attention', () => {
  it('shows the failed charge with its amount, reason, next try, days overdue and the pay link sent', async () => {
    const items = await paymentsAttention('2026-11-03');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ family: 'ruiz family', householdId: R.h.id, amountCents: 9500, reason: 'Card declined', retryOn: '2026-11-04', held: false, daysOverdue: 2, status: 'failed' });
    expect(items[0].payLinkSentAt).toBeInstanceOf(Date);
    expect(overdueTable(items, title).rows[0]).toEqual(['2026-11-01', 'ruiz family', 'Intro to Theater', 'November tuition: Lena, Intro to Theater', '95.00', '', 2, 'Card declined', 'Trying again Wed, Nov 4', '2026-11-01']);
  });
});

describe('Upcoming autopay', () => {
  it('groups the next billing day and the two months after it by date, with a total per date', async () => {
    const up = await upcomingAutopay('2026-11-03');
    expect(up.nextDue).toBe('2026-12-01');
    expect(up.through).toBe('2027-02-01');
    expect(up.days.map((d) => [d.date, d.charges.map((c) => c.family), d.totalCents])).toEqual([['2026-12-01', ['diaz family', 'ruiz family'], 19000]]);
  });

  it('downloads a date range, and adds up each date', async () => {
    expect(await upcomingCharges('2026-11-03', '2026-11-30')).toEqual([]);
    const charges = await upcomingCharges('2026-11-03', '2027-02-01');
    expect(byDate(charges).map((d) => d.totalCents)).toEqual([19000]);
  });
});

describe('small helpers', () => {
  it('reads the month and the list to download', () => {
    expect(receivedMonth(null, '2026-10-19')).toBe('2026-10');
    expect(receivedMonth('2026-02', '2026-10-19')).toBe('2026-02');
    for (const bad of ['2026-13', '26-01', '2026-1', 'x']) expect(receivedMonth(bad, '2026-10-19')).toBe('2026-10');
    expect([shiftMonth('2026-01', -1), shiftMonth('2026-12', 1)]).toEqual(['2025-12', '2027-01']);
    expect(addMonths('2026-12-01', 2)).toBe('2027-02-01');
    const u = (q: string) => new URL(`http://x/admin/payments.csv${q}`);
    expect([listFor(u('?show=failed')), listFor(u('?show=upcoming')), listFor(u('?month=2026-09')), listFor(u('?show=nope'))]).toEqual(['overdue', 'upcoming', 'received', 'received']);
  });
});
