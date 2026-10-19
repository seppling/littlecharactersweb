/**
 * Days off (src/server/days-off.ts): one class's worth, the preview's groups,
 * refusing a day with attendance, lowering that month's payment through
 * adjustments.ts, locked payments, ranges across two months, and removing a
 * day off (only its own adjustments, only unpaid ones).
 */
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Program, Session } from '@/content/types';
import { getDb, schema } from '@/server/db';
import { confirmOrder, createDraftOrder, createStudent, ensureHousehold, fulfillOrder } from '@/server/family';
import { listInstallments, runBilling, type ChargeRequest } from '@/server/billing';
import { addAdjustment, reapplyPendingAdjustments, type StaffUser } from '@/server/adjustments';
import { getCatalog } from '@/server/content';
import {
  addDayOff,
  datesLabel,
  daysOffList,
  familyNotices,
  oneClassCents,
  planDayOff,
  previewDayOff,
  previewRemoval,
  readDayOffRequest,
  removeDayOff,
  type DayOffRequest,
  type PlanData,
} from '@/server/days-off';

const SESSION = 'intro-f26-tue'; // Tuesdays, Aug 17 – Dec 18, $95/month
const hannah: StaffUser = { id: 'u-hannah', email: 'hannah@example.com', emailVerified: true };
const parent: StaffUser = { id: 'u-parent', email: 'parent@example.com', emailVerified: true };

const tue = { days: ['Tue'] } as Pick<Session, 'days'>;
const thu = { days: ['Thu'] } as Pick<Session, 'days'>;

describe('one class’s worth', () => {
  it('is the month’s payment ÷ the times the class meets that month', () => {
    expect(oneClassCents(9500, thu, '2026-11')).toBe(2375); // four Thursdays: $23.75
    expect(oneClassCents(9500, tue, '2026-12')).toBe(1900); // five Tuesdays
    expect(oneClassCents(9500, { days: ['Tue', 'Thu'] } as Pick<Session, 'days'>, '2026-11')).toBe(1188); // eight classes: $11.875, up to $11.88
  });
  it('starts from the payment after the 15% family discount, rounded up in the family’s favor', () => {
    expect(oneClassCents(8075, thu, '2026-11')).toBe(2019); // $80.75 ÷ 4 = $20.1875
    expect(oneClassCents(16150, tue, '2026-12')).toBe(3230);
    expect(oneClassCents(1, tue, '2026-12')).toBe(1);
  });
});

describe('reading the form', () => {
  const read = (q: string) => {
    const p = new URLSearchParams(q);
    return readDayOffRequest((k) => p.get(k), (k) => p.getAll(k));
  };
  it('takes one date, a range, every class or chosen ones', () => {
    expect(read('from=2026-11-26&which=all&reason=Thanksgiving').request).toMatchObject({ from: '2026-11-26', to: '2026-11-26', sessionIds: null, payments: null });
    expect(read('from=2026-11-23&to=2026-11-27&which=some&class=a&class=b&reason=Break&payments=keep').request).toMatchObject({ sessionIds: ['a', 'b'], payments: 'keep' });
  });
  it('says what’s missing', () => {
    expect(read('which=all&reason=x').error).toBe('Pick a date.');
    expect(read('from=2026-11-26&to=2026-11-20&reason=x').error).toMatch(/before the first/);
    expect(read('from=2026-11-26&which=some&reason=x').error).toMatch(/at least one class/);
    expect(read('from=2026-11-26').error).toMatch(/reason/);
    expect(read('from=2026-11-01&to=2026-12-31&reason=x').error).toMatch(/31 days/);
  });
  it('writes dates as families read them', () => {
    expect(datesLabel(['2026-11-26'])).toBe('Nov 26');
    expect(datesLabel(['2026-11-23', '2026-11-24', '2026-11-25'])).toBe('Nov 23–25');
    expect(datesLabel(['2026-11-30', '2026-12-01'])).toBe('Nov 30–Dec 1');
  });
});

// ───────────── The preview's groups, from plain data ─────────────

describe('the preview’s groups', () => {
  const s = (id: string, unit: 'month' | 'session') =>
    ({ program: { slug: id, title: `Class ${id}`, kind: 'class' } as Program, session: { id, days: ['Thu'], startDate: '2026-09-03', endDate: '2026-12-17', price: { amount: 95, unit } } as Session });
  const inst = (id: string, orderId: string, dueDate: string, status: 'scheduled' | 'paid' | 'processing' | 'failed', base = 9500, over = {}) =>
    ({ id, orderId, householdId: `h-${orderId}`, sessionId: 'm', dueDate, amountCents: base, baseAmountCents: base, regularAmountCents: 9500, adjustments: [], lateFeeCents: 0, label: 'x', status, attempts: 0, retryOn: null, lastError: null, stripePaymentIntentId: null, payNowOpenedAt: null, paidAt: null, createdAt: new Date(), updatedAt: new Date(), ...over }) as PlanData['installments'][number];
  const now = new Date('2026-10-10T12:00:00Z');
  const data = (over: Partial<PlanData> = {}): PlanData => ({
    dates: ['2026-11-26'],
    everyClass: true,
    sessions: [s('m', 'month'), s('p', 'session')],
    existing: [],
    attendance: new Set(),
    enrollments: [
      { sessionId: 'm', householdId: 'h-o1', firstName: 'Ava', status: 'active', orderId: 'o1' },
      { sessionId: 'm', householdId: 'h-o1', firstName: 'Ben', status: 'active', orderId: 'o1' },
      { sessionId: 'm', householdId: 'h-o2', firstName: 'Cy', status: 'active', orderId: 'o2' },
      { sessionId: 'm', householdId: 'h-o3', firstName: 'Di', status: 'active', orderId: 'o3' },
      { sessionId: 'm', householdId: 'h-o4', firstName: 'Ed', status: 'trial', orderId: 'o4' },
      { sessionId: 'm', householdId: 'h-o5', firstName: 'Flo', status: 'active', orderId: null },
      { sessionId: 'p', householdId: 'h-o6', firstName: 'Gus', status: 'active', orderId: 'o6' },
      { sessionId: 'm', householdId: 'h-o7', firstName: 'Hal', status: 'active', orderId: 'o7' },
    ],
    orders: [
      { id: 'o1', householdId: 'h-o1', plan: 'monthly', status: 'paid', paidAt: now },
      { id: 'o2', householdId: 'h-o2', plan: 'monthly', status: 'paid', paidAt: now },
      { id: 'o3', householdId: 'h-o3', plan: 'full', status: 'paid', paidAt: now },
      { id: 'o4', householdId: 'h-o4', plan: 'trial', status: 'paid', paidAt: now },
      { id: 'o6', householdId: 'h-o6', plan: 'once', status: 'paid', paidAt: now },
      { id: 'o7', householdId: 'h-o7', plan: 'monthly', status: 'paid', paidAt: now },
    ],
    installments: [inst('i1', 'o1', '2026-11-01', 'scheduled', 16150), inst('i2', 'o2', '2026-11-01', 'paid'), inst('i7', 'o7', '2026-11-01', 'processing')],
    adjustments: [],
    families: new Map(['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7'].map((o) => [`h-${o}`, `Family ${o}`])),
    dropIns: [{ householdId: 'h-o9', sessionId: 'm', date: '2026-11-26', child: 'Ivy' }],
    now,
    ...over,
  });

  it('sorts every family into what happens to them', () => {
    const plan = planDayOff(data());
    expect(plan.classes.map((c) => [c.sessionId, c.children])).toEqual([['m', 7], ['p', 1]]);
    // One payment for the order that covers two children: $161.50 ÷ 4 Thursdays = $40.375, $40.38 off.
    expect(plan.lowered.map((l) => [l.orderId, l.children, l.beforeCents, l.afterCents, l.dates])).toEqual([['o1', ['Ava', 'Ben'], 16150, 12112, [{ date: '2026-11-26', cents: 4038 }]]]);
    expect(plan.alreadyPaid.map((p) => [p.orderId, p.cents, p.why])).toEqual([['o2', 2375, 'November is paid'], ['o7', 2375, 'November is being charged right now']]);
    expect(plan.noChange.map((p) => [p.orderId, p.why])).toEqual([['o3', 'Paid the season up front'], ['o4', 'Free first class'], [null, 'No charge'], ['o6', 'Pays by the session']]);
    expect(plan.dropIns.map((x) => [x.family, x.child])).toEqual([['Family', 'Ivy']]);
    expect(plan.blockers).toEqual([]);
  });

  it('the first month, paid at sign-up, is already paid', () => {
    const plan = planDayOff(data({ installments: [] }));
    expect(plan.alreadyPaid.find((p) => p.orderId === 'o1')).toMatchObject({ why: 'Paid at sign-up (first month)', cents: null });
  });

  it('refuses a class whose attendance was taken, and says why', () => {
    const plan = planDayOff(data({ attendance: new Set(['m 2026-11-26']) }));
    expect(plan.classes.find((c) => c.sessionId === 'm')?.refused).toBe('Attendance was already taken for Class m on Nov 26.');
    expect(plan.blockers[0]).toMatch(/Choose the classes instead/);
  });

  it('leaves alone a class that already has a day off that date', () => {
    const plan = planDayOff(data({ existing: [{ id: 'c', date: '2026-11-26', sessionId: 'm', reason: 'Teacher out' }] }));
    expect(plan.alreadyOff).toEqual([{ sessionId: 'm', title: 'Class m', date: '2026-11-26', reason: 'Teacher out' }]);
    expect(plan.lowered).toEqual([]);
  });

  it('a locked payment still lowers, a little later', () => {
    const plan = planDayOff(data({ installments: [inst('i1', 'o1', '2026-11-01', 'failed', 16150, { payNowOpenedAt: new Date(now.getTime() - 60_000) })] }));
    expect(plan.lowered[0]).toMatchObject({ later: true, afterCents: 12112 });
  });

  it('emails each family once: the new amount, or plain “No class”', () => {
    const plan = planDayOff(data());
    const lower = familyNotices(plan, { reason: 'Thanksgiving', payments: 'lower' }, '2026-10-10', 'https://x/account');
    expect(lower.map((n) => n.householdId).sort()).toEqual(['h-o1', 'h-o2', 'h-o3', 'h-o4', 'h-o5', 'h-o6', 'h-o7', 'h-o9']);
    const o1 = lower.find((n) => n.householdId === 'h-o1')!;
    expect(o1.subject).toBe('No class Nov 26 · Little Characters');
    expect(o1.lines).toContain('Ava and Ben, Class m: no class Thu, Nov 26 (Thanksgiving).');
    expect(o1.lines).toContain('Ava and Ben, Class m: your November payment is now $121.12 (was $161.50), one class less for Nov 26.');
    expect(lower.find((n) => n.householdId === 'h-o2')!.lines.join(' ')).not.toMatch(/payment is now/);
    const keep = familyNotices(plan, { reason: 'Thanksgiving', payments: 'keep' }, '2026-10-10', 'https://x/account');
    expect(keep.find((n) => n.householdId === 'h-o1')!.lines.join(' ')).not.toMatch(/payment is now/);
    // A day off in the past is a record only: nobody is emailed.
    expect(familyNotices(plan, { reason: 'Snow', payments: 'lower' }, '2026-11-27', 'https://x/account')).toEqual([]);
  });
});

// ───────────── Saved, with real payments ─────────────

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
  return { u, h, o, ids };
}
const amounts = async (householdId: string) => (await listInstallments(householdId)).map((i) => [i.dueDate.slice(5, 7), i.amountCents, i.status]);
const charge = async (req: ChargeRequest) => {
  if (!req.paymentIntentId) await req.remember(`pi_${req.installmentId.slice(0, 6)}_${req.attempt}`);
  return { status: 'succeeded' as const, paymentIntentId: 'pi_ok' };
};
const one = (from: string, to = from, payments: DayOffRequest['payments'] = 'lower', sessionIds: string[] | null = [SESSION]): DayOffRequest => ({ from, to, sessionIds, reason: 'Thanksgiving', payments });

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-10T16:00:00Z'));
  const db = await getDb();
  await db.insert(schema.user).values({ id: hannah.id, name: 'Hannah Eppling', email: hannah.email, emailVerified: true });
  await db.insert(schema.user).values({ id: parent.id, name: 'A Parent', email: parent.email, emailVerified: true });
});
afterAll(() => {
  vi.useRealTimers();
});

describe('adding and removing a day off', () => {
  it('only owners', async () => {
    const catalog = await getCatalog();
    await expect(previewDayOff(parent, catalog, one('2026-12-08'))).rejects.toThrow(/Only owners/);
  });

  it('lowers that month’s payment by one class, after a scholarship already there; emails; and removing restores it', async () => {
    const catalog = await getCatalog();
    const A = await family('alvarez');
    const B = await family('baker', { plan: 'full' });
    await addAdjustment(hannah, { orderId: A.o.id, kind: 'amount', value: 4000, repeat: 'monthly', reason: 'Scholarship', showToFamily: false });
    expect(await amounts(A.h.id)).toEqual([['10', 5500, 'scheduled'], ['11', 5500, 'scheduled'], ['12', 5500, 'scheduled']]);

    const preview = await previewDayOff(hannah, catalog, one('2026-12-08'));
    const mine = preview.lowered.find((l) => l.orderId === A.o.id)!;
    // $95 ÷ 5 December Tuesdays = $19, from the price before the scholarship.
    expect(mine).toMatchObject({ month: '2026-12', beforeCents: 5500, afterCents: 3600, dates: [{ date: '2026-12-08', cents: 1900 }] });
    expect(preview.noChange.find((p) => p.orderId === B.o.id)?.why).toBe('Paid the season up front');
    // Nothing saved yet.
    expect(await amounts(A.h.id)).toEqual([['10', 5500, 'scheduled'], ['11', 5500, 'scheduled'], ['12', 5500, 'scheduled']]);

    await expect(addDayOff(hannah, catalog, one('2026-12-08', '2026-12-08', null))).rejects.toThrow(/Choose what happens/);
    const saved = await addDayOff(hannah, catalog, one('2026-12-08'));
    expect(await amounts(A.h.id)).toEqual([['10', 5500, 'scheduled'], ['11', 5500, 'scheduled'], ['12', 3600, 'scheduled']]);
    const dec = (await listInstallments(A.h.id))[2];
    expect(dec.adjustments.map((l) => [l.label, l.cents])).toEqual([['Discount', 4000], ['Day off Dec 8 (Thanksgiving)', 1900]]);
    const db = await getDb();
    const [c] = await db.select().from(schema.closure).where(eq(schema.closure.id, saved.closureIds[0]));
    expect(c).toMatchObject({ date: '2026-12-08', sessionId: SESSION, reason: 'Thanksgiving', adjustedBy: hannah.id });
    expect(c.adjustedAt).toBeInstanceOf(Date);
    const adj = await db.select().from(schema.billingAdjustment).where(eq(schema.billingAdjustment.closureId, c.id));
    expect(adj.map((a) => [a.orderId, a.value, a.installmentId])).toContainEqual([A.o.id, 1900, dec.id]);
    expect(await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'admin.day_off.add'), eq(schema.auditLog.entityId, c.id)))).toHaveLength(1);
    const mail = await db.select().from(schema.devEmail);
    expect(mail.find((m) => m.to === 'alvarez@example.com' && m.subject === 'No class Dec 8 · Little Characters')?.text).toContain('Kid0, Intro to Theater: your December payment is now $36 (was $55), one class less for Dec 8.');
    expect(mail.find((m) => m.to === 'baker@example.com' && m.subject === 'No class Dec 8 · Little Characters')?.text).toContain('Kid0, Intro to Theater: no class Tue, Dec 8 (Thanksgiving).');

    // The list shows it, with what was done.
    const list = await daysOffList(catalog, '2026-09-10');
    const g = list.upcoming.find((x) => x.ids.includes(c.id))!;
    expect(g).toMatchObject({ dates: ['2026-12-08'], classes: 'Intro to Theater', lowered: true });
    expect(g.adjustments.families.find((f) => f.orderId === A.o.id)).toMatchObject({ cents: 1900, paid: false });

    // Removing: a preview, then December goes back to $55 and the scholarship stays.
    const before = await previewRemoval(hannah, c.id);
    expect(before?.changes.find((x) => x.orderId === A.o.id)).toMatchObject({ dueDate: '2026-12-01', beforeCents: 3600, afterCents: 5500 });
    await removeDayOff(hannah, c.id);
    expect(await amounts(A.h.id)).toEqual([['10', 5500, 'scheduled'], ['11', 5500, 'scheduled'], ['12', 5500, 'scheduled']]);
    expect(await db.select().from(schema.closure).where(eq(schema.closure.id, c.id))).toEqual([]);
  });

  it('a range across two months: the paid month is “give a credit”, the next is lowered; removing leaves the paid one as it was', async () => {
    const catalog = await getCatalog();
    vi.setSystemTime(new Date('2026-10-20T16:00:00Z'));
    const C = await family('chu', { kids: 2 });
    // Two children: $190 less 15% = $161.50 a month. November gets paid first.
    await runBilling({ charge, today: '2026-11-01' });
    expect((await amounts(C.h.id)).slice(0, 2)).toEqual([['11', 16150, 'paid'], ['12', 16150, 'scheduled']]);

    const preview = await previewDayOff(hannah, catalog, one('2026-11-24', '2026-12-01'));
    expect(preview.alreadyPaid.find((p) => p.orderId === C.o.id)).toMatchObject({ date: '2026-11-24', cents: 4038, why: 'November is paid' });
    expect(preview.lowered.find((l) => l.orderId === C.o.id)).toMatchObject({ month: '2026-12', beforeCents: 16150, afterCents: 12920, dates: [{ date: '2026-12-01', cents: 3230 }] });
    const saved = await addDayOff(hannah, catalog, one('2026-11-24', '2026-12-01'));
    expect(saved.closureIds).toHaveLength(2);
    expect((await amounts(C.h.id)).slice(0, 2)).toEqual([['11', 16150, 'paid'], ['12', 12920, 'scheduled']]);
    const list = await daysOffList(catalog, '2026-10-20');
    const g = list.upcoming.find((x) => x.ids.includes(saved.closureIds[0]))!;
    expect(g.dates).toEqual(['2026-11-24', '2026-12-01']);
    expect(g.creditsDue.map((x) => x.orderId)).toContain(C.o.id);

    // December is charged at the lower amount; then removing the day off changes nothing paid.
    await runBilling({ charge, today: '2026-12-01' });
    expect((await amounts(C.h.id)).slice(0, 2)).toEqual([['11', 16150, 'paid'], ['12', 12920, 'paid']]);
    const r = await previewRemoval(hannah, saved.closureIds[0]);
    expect(r?.changes.filter((x) => x.orderId === C.o.id)).toEqual([]);
    expect(r?.paidStay.find((x) => x.orderId === C.o.id)).toMatchObject({ cents: 3230 });
    await removeDayOff(hannah, saved.closureIds[1]); // either day of the group removes both
    const db = await getDb();
    expect(await db.select().from(schema.closure).where(eq(schema.closure.reason, 'Thanksgiving'))).toEqual([]);
    expect((await amounts(C.h.id)).slice(0, 2)).toEqual([['11', 16150, 'paid'], ['12', 12920, 'paid']]);
    // The paid month's adjustment isn't marked removed: it's what was charged.
    const kept = await db.select().from(schema.billingAdjustment).where(and(eq(schema.billingAdjustment.orderId, C.o.id), eq(schema.billingAdjustment.value, 3230)));
    expect(kept[0].removedAt).toBeNull();
  });

  it('the month paid at sign-up is already paid', async () => {
    const catalog = await getCatalog();
    vi.setSystemTime(new Date('2026-10-20T16:00:00Z'));
    const D = await family('dube');
    // Joined Oct 20: October was paid at sign-up; nothing to lower that month.
    const preview = await previewDayOff(hannah, catalog, one('2026-10-27'));
    expect(preview.alreadyPaid.find((p) => p.orderId === D.o.id)?.why).toBe('Paid at sign-up (first month)');
    expect(preview.lowered.find((l) => l.orderId === D.o.id)).toBeUndefined();
  });

  it('a payment the family has open to pay changes a little later', async () => {
    const catalog = await getCatalog();
    vi.setSystemTime(new Date('2026-10-02T16:00:00Z'));
    const E = await family('evans');
    const db = await getDb();
    const [nov] = (await listInstallments(E.h.id)).filter((i) => i.dueDate === '2026-11-01');
    await db.update(schema.installment).set({ status: 'failed', payNowOpenedAt: new Date() }).where(eq(schema.installment.id, nov.id));
    const preview = await previewDayOff(hannah, catalog, one('2026-11-17'));
    expect(preview.lowered.find((l) => l.orderId === E.o.id)).toMatchObject({ later: true, beforeCents: 9500, afterCents: 7125 });
    await addDayOff(hannah, catalog, one('2026-11-17'));
    expect((await listInstallments(E.h.id)).find((i) => i.id === nov.id)?.amountCents).toBe(9500);
    // Once the pay-now form has expired, the billing run brings it up to date.
    await reapplyPendingAdjustments(new Date(Date.now() + 3 * 3_600_000));
    expect((await listInstallments(E.h.id)).find((i) => i.id === nov.id)?.amountCents).toBe(7125);
  });

  it('refuses a date whose attendance was taken', async () => {
    const catalog = await getCatalog();
    const F = await family('fox');
    const db = await getDb();
    await db.insert(schema.attendance).values({ sessionId: SESSION, classDate: '2026-12-15', studentId: F.ids[0], status: 'present' });
    const preview = await previewDayOff(hannah, catalog, one('2026-12-15'));
    expect(preview.classes[0].refused).toBe('Attendance was already taken for Intro to Theater on Dec 15.');
    await expect(addDayOff(hannah, catalog, one('2026-12-15'))).rejects.toThrow(/Attendance was already taken/);
    expect(await db.select().from(schema.closure).where(eq(schema.closure.date, '2026-12-15'))).toEqual([]);
  });

  it('“Don’t change payments” saves the choice and changes nothing', async () => {
    const catalog = await getCatalog();
    vi.setSystemTime(new Date('2026-10-02T16:00:00Z'));
    const G = await family('garcia');
    const before = await amounts(G.h.id);
    const saved = await addDayOff(hannah, catalog, { ...one('2026-12-01', '2026-12-01', 'keep', null), reason: 'Winter break' });
    expect(saved.lowered).toBe(0);
    expect(await amounts(G.h.id)).toEqual(before);
    const db = await getDb();
    const [c] = await db.select().from(schema.closure).where(eq(schema.closure.id, saved.closureIds[0]));
    expect(c).toMatchObject({ sessionId: null, adjustedAt: null, adjustedBy: null });
    const mail = await db.select().from(schema.devEmail);
    expect(mail.find((m) => m.to === 'garcia@example.com' && m.subject === 'No class Dec 1 · Little Characters')?.text).not.toMatch(/payment is now/);
    // An every-class day off on the same date can't be added twice.
    await expect(addDayOff(hannah, catalog, { ...one('2026-12-01', '2026-12-01', 'keep', null), reason: 'Again' })).rejects.toThrow(/already a day off/);
  });
});
