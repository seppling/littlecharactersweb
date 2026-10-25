/**
 * Paid drop-ins (src/server/drop-ins.ts): which classes take them and at what
 * price, the dates offered, booking (a pending row that holds no place), the
 * order's line and total, paying once when the webhook and the confirmation
 * page both arrive, the family discount left alone, and staff adds and cancels.
 */
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Program, Session } from '@/content/types';
import { getDb, schema } from '@/server/db';
import { getCatalog } from '@/server/content';
import { createStudent, ensureHousehold, fulfillOrder } from '@/server/family';
import { countingEnrollments } from '@/server/family-discount';
import { toStripeLineItems } from '@/server/payments';
import { classDay, dropInsOn } from '@/server/class-day';
import { classesOn } from '@/server/today';
import { classRows } from '@/server/classes';
import { bookingClock } from '@/lib/session-dates';
import { dropInSetting } from '@/content/site-content';
import {
  DropInError,
  PAID_TWICE,
  addDropInWithoutCharge,
  cancelDropIn,
  childProblem,
  classDropIns,
  dropInDates,
  dropInDatesFrom,
  dropInLine,
  dropInPrice,
  dropInRoster,
  dropInStatus,
  dropInTable,
  dropInsOffered,
  familyDropIns,
  overLimitIds,
  readyDropIn,
  sendDropInPayLink,
  startDropIn,
  upcomingMeetings,
} from '@/server/drop-ins';

const site = { dropIns: { priceCents: 2500, open: true } };
const tue = (over: Partial<Session> = {}): Session => ({
  id: 'drop-tue',
  term: 'Fall 2026',
  days: ['Tue'],
  start: '16:30',
  end: '17:30',
  startDate: '2026-10-20',
  endDate: '2026-11-24',
  locationId: 'hq',
  price: { amount: 95, unit: 'month' },
  status: 'open',
  ...over,
});
const prog = (over: Partial<Program> = {}, session = tue()): Program =>
  ({ slug: 'drop-test', title: 'Drop Test', kind: 'class', brand: 'lc', ages: { min: 4 }, priceFrom: { amount: 95, unit: 'month' }, sessions: [session], ...over }) as unknown as Program;

describe('which classes take drop-ins, and the price', () => {
  it('weekly classes at the site’s price', () => {
    expect(dropInPrice(site, prog(), tue())).toBe(2500);
    expect(dropInPrice(site, prog(), tue({ price: { amount: 160, unit: 'session' } }))).toBe(2500);
  });
  it('a class’s own price wins', () => {
    expect(dropInPrice(site, prog(), tue({ dropIn: { price: 30 } }))).toBe(3000);
    expect(dropInPrice(site, prog(), tue({ dropIn: { price: 22.5 } }))).toBe(2250);
  });
  it('none when the site switch is off, or the class turns them off', () => {
    expect(dropInPrice({ dropIns: { priceCents: 2500, open: false } }, prog(), tue())).toBeNull();
    expect(dropInPrice(site, prog(), tue({ dropIn: { off: true } }))).toBeNull();
    expect(dropInPrice(site, prog(), tue({ dropIn: { price: 30, off: true } }))).toBeNull();
  });
  it('none for camps, workshops, parties, one-night classes, Ovation, partner classes and closed dates', () => {
    expect(dropInPrice(site, prog({ kind: 'camp' }), tue({ price: { amount: 50, unit: 'day' } }))).toBeNull();
    expect(dropInPrice(site, prog({ kind: 'workshop' }), tue({ price: { amount: 0, unit: 'class' } }))).toBeNull();
    expect(dropInPrice(site, prog({ kind: 'party' }), tue({ price: { amount: 30, unit: 'child' } }))).toBeNull();
    expect(dropInPrice(site, prog({ kind: 'inclusive' }), tue({ price: { amount: 15, unit: 'class' } }))).toBeNull();
    expect(dropInPrice(site, prog(), tue({ startDate: '2026-11-19', endDate: '2026-11-19', price: { amount: 25, unit: 'class' } }))).toBeNull();
    expect(dropInPrice(site, prog(), tue({ externalUrl: 'https://school.example/register' }))).toBeNull();
    expect(dropInPrice(site, prog(), tue({ status: 'closed' }))).toBeNull();
    expect(dropInPrice(site, prog(), tue({ status: 'coming-soon' }))).toBeNull();
  });
  it('the seed’s weekly classes take them; nights out, camps and Ovation don’t', async () => {
    const c = await getCatalog();
    const priced = (id: string) => {
      const f = c.findSession(id)!;
      return dropInPrice(c.site, f.program, f.session);
    };
    expect(c.site.dropIns).toEqual({ priceCents: 2500, open: true });
    expect(priced('intro-f26-tue')).toBe(2500);
    expect(priced('stories-songs-f26')).toBe(2500);
    expect(priced('pno-2026-10-24')).toBeNull();
    expect(priced('free-class-2026-11-02')).toBeNull();
    expect(priced('adult-improv-2026-11')).toBeNull();
  });
  it('the setting turns into cents, and a bad price closes drop-ins', () => {
    expect(dropInSetting({ price: 25, open: true })).toEqual({ priceCents: 2500, open: true });
    expect(dropInSetting({ price: 25 })).toEqual({ priceCents: 2500, open: false });
    expect(dropInSetting({ price: 0, open: true }).open).toBe(false);
    expect(dropInSetting(undefined).open).toBe(false);
  });
});

describe('when the class page offers them, and which dates', () => {
  it('from 14 days before the first class until the last class starts', () => {
    expect(dropInsOffered(site, prog(), tue(), '2026-10-05T09:00')).toBe(false);
    expect(dropInsOffered(site, prog(), tue(), '2026-10-06T09:00')).toBe(true);
    expect(dropInsOffered(site, prog(), tue(), '2026-11-10T09:00')).toBe(true);
    expect(dropInsOffered(site, prog(), tue(), '2026-11-24T16:29')).toBe(true);
    expect(dropInsOffered(site, prog(), tue(), '2026-11-24T16:30')).toBe(false);
  });
  it('today’s class only until it starts', () => {
    expect(upcomingMeetings(tue(), '2026-11-10T16:29')[0]).toBe('2026-11-10');
    expect(upcomingMeetings(tue(), '2026-11-10T16:30')[0]).toBe('2026-11-17');
  });
  it('marks days off and full dates', () => {
    const dates = dropInDatesFrom({
      dates: ['2026-11-03', '2026-11-10', '2026-11-17'],
      daysOff: new Set(['2026-11-10']),
      enrolled: 3,
      dropIns: new Map([['2026-11-17', 1]]),
      capacity: 4,
    });
    expect(dates.map((d) => [d.date, d.problem, d.placesLeft])).toEqual([
      ['2026-11-03', null, 1],
      ['2026-11-10', 'day-off', 1],
      ['2026-11-17', 'full', 0],
    ]);
    expect(dates[0].label).toBe('Tue, Nov 3');
  });
  it('a child in the class, or booked that day already, can’t book', () => {
    const p = prog();
    expect(childProblem({ firstName: 'Ava' }, p, 'active', false)).toBe('Ava is already in Drop Test.');
    expect(childProblem({ firstName: 'Ava' }, p, 'trial', false)).toBe('Ava is already in Drop Test.');
    expect(childProblem({ firstName: 'Ava' }, p, 'waitlist', false)).toBeNull();
    expect(childProblem({ firstName: 'Ava' }, p, null, true)).toBe('Ava already has a drop-in that day.');
    expect(childProblem({ firstName: 'Ava' }, p, 'cancelled', false)).toBeNull();
  });
});

describe('Over the limit', () => {
  it('the earliest bookings take the places left; later ones are over', () => {
    const rows = [
      { id: 'a', date: '2026-11-03', status: 'booked' },
      { id: 'b', date: '2026-11-03', status: 'cancelled' },
      { id: 'c', date: '2026-11-03', status: 'booked' },
      { id: 'd', date: '2026-11-10', status: 'booked' },
    ];
    expect([...overLimitIds(rows, 3, 4)]).toEqual(['c']);
    expect(overLimitIds(rows, 3, undefined).size).toBe(0);
  });
});

// ───────────── With the database ─────────────

const SID = 'drop-db-tue';
const session = tue({ id: SID, capacity: 20 });
const program = prog({ slug: 'drop-db', title: 'Drop Test' }, session);
// A small class, for full dates.
const SMALL = 'drop-db-small';
const small = tue({ id: SMALL, capacity: 3 });
const smallProgram = prog({ slug: 'drop-small', title: 'Small Test' }, small);
const NOW = new Date('2026-10-19T14:00:00Z'); // Mon, Oct 19, 10 am in Athens
let liveSite: Awaited<ReturnType<typeof getCatalog>>['site'];
const catalog = {
  findSession: (id: string) => (id === SID ? { program, session } : id === SMALL ? { program: smallProgram, session: small } : undefined),
  locationById: () => undefined,
  get site() {
    return { ...liveSite, dropIns: { priceCents: 2500, open: true } };
  },
};
const opts = { catalog, now: NOW };

async function family(tag: string) {
  const db = await getDb();
  const u = { id: `u-drop-${tag}`, name: `Pat ${tag}`, email: `drop-${tag}@example.com`, emailVerified: true };
  await db.insert(schema.user).values(u);
  const h = await ensureHousehold(u);
  const kid = (firstName: string) => createStudent(h.id, { firstName, lastName: tag, birthdate: '2017-05-05' }, u.id);
  return { u, h, kid };
}

async function enroll(householdId: string, studentId: string, sessionId = SID, status: 'active' | 'trial' = 'active') {
  const db = await getDb();
  await db.insert(schema.enrollment).values({ householdId, studentId, sessionId, programSlug: 'drop-db', status });
}

beforeAll(async () => {
  liveSite = (await getCatalog()).site;
  const db = await getDb();
  await db.insert(schema.user).values({ id: 'u-hannah', name: 'Hannah Test', email: 'hannah@example.com', emailVerified: true });
});

describe('booking and paying', () => {
  it('a booking is a pending row and a draft order with one line; it holds no place', async () => {
    const f = await family('book');
    const ava = await f.kid('Ava');
    const before = await classDay(program, session, '2026-10-20');
    const b = await startDropIn({ householdId: f.h.id, userId: f.u.id, sessionId: SID, date: '2026-10-20', studentId: ava.id }, opts);
    expect(b.dropIn).toMatchObject({ status: 'pending', priceCents: 2500, orderId: b.order.id, classDate: '2026-10-20' });
    expect(b.order).toMatchObject({ plan: 'drop_in', status: 'draft', subtotalCents: 2500, discountCents: 0, totalCents: 2500, studentIds: [ava.id] });
    expect(b.order.lines).toEqual([{ kind: 'tuition', label: 'Drop-in: Drop Test, Tue, Oct 20 (Ava)', studentId: ava.id, amountCents: 2500 }]);
    expect(dropInLine('Drop Test', '2026-10-20', 'Ava')).toBe(b.order.lines[0].label);
    // One Stripe line for the whole price.
    const items = toStripeLineItems(b.order.lines, b.order.totalCents, 'Drop Test · drop-in');
    expect(items).toHaveLength(1);
    expect(items[0].price_data.unit_amount).toBe(2500);
    expect(items[0].price_data.product_data.name).toBe('Drop-in: Drop Test, Tue, Oct 20 (Ava)');
    // An abandoned checkout holds nothing.
    expect(await dropInsOn(SID, '2026-10-20')).toEqual([]);
    expect((await classDay(program, session, '2026-10-20')).expected).toBe(before.expected);
    expect(await familyDropIns(f.h.id)).toEqual([]);
    expect((await classDropIns(program, session)).some((d) => d.id === b.dropIn.id)).toBe(false);
  });

  it('refuses a child in the class, a day off and a date not ahead', async () => {
    const f = await family('refuse');
    const ben = await f.kid('Ben');
    const cy = await f.kid('Cy');
    await enroll(f.h.id, ben.id);
    const start = (studentId: string, date: string) => startDropIn({ householdId: f.h.id, userId: f.u.id, sessionId: SID, date, studentId }, opts);
    await expect(start(ben.id, '2026-10-27')).rejects.toThrow('Ben is already in Drop Test.');
    const db = await getDb();
    await db.insert(schema.closure).values({ date: '2026-11-03', sessionId: SID, reason: 'Teacher out' });
    await expect(start(cy.id, '2026-11-03')).rejects.toThrow('There’s no class on Tue, Nov 3.');
    await expect(start(cy.id, '2026-10-13')).rejects.toThrow(DropInError);
    await expect(start(cy.id, '2026-10-21')).rejects.toThrow(DropInError);
    // Another family's child can't be picked.
    const other = await family('refuse-other');
    const zed = await other.kid('Zed');
    await expect(start(zed.id, '2026-10-27')).rejects.toThrow('Pick who’s coming.');
  });

  it('pays once when the webhook and the confirmation page both arrive', async () => {
    const f = await family('pay');
    const dee = await f.kid('Dee');
    const b = await startDropIn({ householdId: f.h.id, userId: f.u.id, sessionId: SID, date: '2026-10-27', studentId: dee.id }, opts);
    const db = await getDb();
    await db.update(schema.order).set({ policyAcceptedAt: new Date() }).where(eq(schema.order.id, b.order.id));
    const ready = await readyDropIn(f.h.id, b.order.id, opts);
    expect(ready.status).toBe('pending_payment');
    const payment = { checkoutSessionId: 'cs_test_drop', amountCents: 2500 };
    const [one, two] = await Promise.all([fulfillOrder(b.order.id, null, payment), fulfillOrder(b.order.id, f.u.id, payment)]);
    expect(one.status).toBe('paid');
    expect(two.status).toBe('paid');
    const rows = await db.select().from(schema.dropIn).where(eq(schema.dropIn.orderId, b.order.id));
    expect(rows.map((r) => r.status)).toEqual(['booked']);
    const audits = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'drop_in.booked'), eq(schema.auditLog.entityId, b.dropIn.id)));
    expect(audits).toHaveLength(1);
    // No enrollment: a drop-in isn't a place in the class.
    const enrolled = await db.select().from(schema.enrollment).where(eq(schema.enrollment.studentId, dee.id));
    expect(enrolled).toEqual([]);
    expect((await dropInsOn(SID, '2026-10-27')).map((d) => d.studentId)).toEqual([dee.id]);
    expect((await familyDropIns(f.h.id)).map((d) => [d.date, d.status, d.paid])).toEqual([['2026-10-27', 'booked', true]]);
    // A third call changes nothing.
    await fulfillOrder(b.order.id, null, payment);
    expect(await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'drop_in.booked'), eq(schema.auditLog.entityId, b.dropIn.id)))).toHaveLength(1);
  });

  it('a payment for the wrong amount books nothing', async () => {
    const f = await family('wrong');
    const eve = await f.kid('Eve');
    const b = await startDropIn({ householdId: f.h.id, userId: f.u.id, sessionId: SID, date: '2026-10-27', studentId: eve.id }, opts);
    await readyDropIn(f.h.id, b.order.id, opts);
    const o = await fulfillOrder(b.order.id, null, { checkoutSessionId: 'cs_wrong', amountCents: 9500 });
    expect(o.status).toBe('pending_payment');
    expect((await dropInsOn(SID, '2026-10-27')).some((d) => d.studentId === eve.id)).toBe(false);
  });

  it('books a payment taken after the date filled up, and shows it over the limit', async () => {
    const f = await family('full');
    const kids = await Promise.all(['Fay', 'Gus', 'Hal', 'Ivy'].map((n) => f.kid(n)));
    // Two enrolled in the class (limit 3).
    await enroll(f.h.id, kids[0].id, SMALL);
    await enroll(f.h.id, kids[1].id, SMALL, 'trial');
    const start = (i: number) => startDropIn({ householdId: f.h.id, userId: f.u.id, sessionId: SMALL, date: '2026-11-10', studentId: kids[i].id }, opts);
    const late = await start(2);
    await readyDropIn(f.h.id, late.order.id, opts);
    const first = await start(3);
    await readyDropIn(f.h.id, first.order.id, opts);
    await fulfillOrder(first.order.id, null);
    // The date is full now: no new booking or payment form...
    expect((await dropInDates(smallProgram, small, '2026-10-19T10:00')).find((d) => d.date === '2026-11-10')?.problem).toBe('full');
    await expect(readyDropIn(f.h.id, late.order.id, opts)).rejects.toThrow('Small Test is full on Tue, Nov 10.');
    // ...but a payment already made is booked anyway.
    await fulfillOrder(late.order.id, null);
    const list = (await classDropIns(smallProgram, small)).filter((d) => d.date === '2026-11-10');
    expect(list.map((d) => [d.firstName, d.status, d.overLimit])).toEqual([
      ['Ivy', 'booked', false],
      ['Hal', 'booked', true],
    ]);
  });

  it('a second payment for a child already booked that day is kept cancelled, for a refund', async () => {
    const f = await family('twice');
    const jo = await f.kid('Jo');
    const a = await startDropIn({ householdId: f.h.id, userId: f.u.id, sessionId: SID, date: '2026-11-17', studentId: jo.id }, opts);
    const b = await startDropIn({ householdId: f.h.id, userId: f.u.id, sessionId: SID, date: '2026-11-17', studentId: jo.id }, opts);
    await readyDropIn(f.h.id, a.order.id, opts);
    await readyDropIn(f.h.id, b.order.id, opts);
    await fulfillOrder(a.order.id, null);
    const paid = await fulfillOrder(b.order.id, null);
    expect(paid.status).toBe('paid');
    const db = await getDb();
    const [second] = await db.select().from(schema.dropIn).where(eq(schema.dropIn.id, b.dropIn.id));
    expect(second).toMatchObject({ status: 'cancelled', cancelReason: PAID_TWICE });
    expect((await dropInsOn(SID, '2026-11-17')).filter((d) => d.studentId === jo.id)).toHaveLength(1);
  });

  it('never counts toward the 15% family discount', async () => {
    const f = await family('discount');
    const kay = await f.kid('Kay');
    const lu = await f.kid('Lu');
    const c = await getCatalog();
    const db = await getDb();
    await db.insert(schema.enrollment).values({ householdId: f.h.id, studentId: kay.id, sessionId: 'intro-f26-tue', programSlug: 'intro-to-theater', status: 'active' });
    await addDropInWithoutCharge({ sessionId: 'intro-f26-tue', studentId: lu.id, date: '2026-10-27', staffId: f.u.id, reason: 'Trying it out', overFull: false }, { catalog: c, now: NOW });
    const counting = await countingEnrollments(db, f.h.id, { catalog: c, today: '2026-10-19' });
    expect(counting).toHaveLength(1);
  });
});

describe('staff', () => {
  it('adds one with no charge: booked at once, price 0, the reason kept, no order', async () => {
    const f = await family('free');
    const max = await f.kid('Max');
    await expect(addDropInWithoutCharge({ sessionId: SID, studentId: max.id, date: '2026-10-20', staffId: 'u-hannah', reason: '  ', overFull: false }, opts)).rejects.toThrow('Add a reason');
    const d = await addDropInWithoutCharge({ sessionId: SID, studentId: max.id, date: '2026-10-20', staffId: 'u-hannah', reason: 'Make-up', overFull: false }, opts);
    expect(d).toMatchObject({ status: 'booked', priceCents: 0, orderId: null, noChargeReason: 'Make-up' });
    expect(dropInStatus({ ...d, paid: false })).toBe('No charge: Make-up');
    const db = await getDb();
    const [a] = await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'admin.drop_in.add_no_charge'), eq(schema.auditLog.entityId, d.id)));
    expect(a.detail).toBe('2026-10-20: Make-up');
    // On the roster for that date only, with the Drop-in badge.
    const roster = await dropInRoster(SID, '2026-10-20', 'u-hannah', '2026-10-19');
    const mine = roster.find((r) => r.studentId === max.id)!;
    expect(mine.dropInId).toBe(d.id);
    expect(mine.badges.map((b) => b.key)).toContain('drop-in');
    expect(await dropInRoster(SID, '2026-10-27', 'u-hannah', '2026-10-19').then((r) => r.some((x) => x.studentId === max.id))).toBe(false);
    // Booked twice for the same day: refused.
    await expect(addDropInWithoutCharge({ sessionId: SID, studentId: max.id, date: '2026-10-20', staffId: 'u-hannah', reason: 'Again', overFull: false }, opts)).rejects.toThrow('Max already has a drop-in that day.');
  });

  it('a full date needs "add anyway"', async () => {
    const f = await family('anyway');
    const [ned, oli] = await Promise.all(['Ned', 'Oli'].map((n) => f.kid(n)));
    // The small class has 2 of its 3 places taken (the test above): one drop-in fills the date.
    const add = (studentId: string, overFull: boolean) => addDropInWithoutCharge({ sessionId: SMALL, studentId, date: '2026-11-24', staffId: 'u-hannah', reason: 'Trade', overFull }, opts);
    await add(ned.id, false);
    await expect(add(oli.id, false)).rejects.toThrow('Small Test is full on Tue, Nov 24.');
    await expect(sendDropInPayLink({ sessionId: SMALL, studentId: oli.id, date: '2026-11-24', staffId: 'u-hannah', token: crypto.randomUUID() }, opts)).rejects.toThrow('full');
    await add(oli.id, true);
    const list = (await classDropIns(smallProgram, small)).filter((d) => d.date === '2026-11-24');
    expect(list.map((d) => [d.firstName, d.overLimit])).toEqual([
      ['Ned', false],
      ['Oli', true],
    ]);
  });

  it('sends a pay link once: a pending booking shown as sent, holding no place', async () => {
    const f = await family('link');
    const rae = await f.kid('Rae');
    const token = crypto.randomUUID();
    const r = await sendDropInPayLink({ sessionId: SID, studentId: rae.id, date: '2026-10-20', staffId: 'u-hannah', token }, opts);
    expect(r).toEqual({ duplicate: false, parents: 1 });
    expect(await sendDropInPayLink({ sessionId: SID, studentId: rae.id, date: '2026-10-20', staffId: 'u-hannah', token }, opts)).toEqual({ duplicate: true, parents: 0 });
    const db = await getDb();
    const rows = await db.select().from(schema.dropIn).where(eq(schema.dropIn.studentId, rae.id));
    expect(rows.map((x) => x.status)).toEqual(['pending']);
    expect((await dropInsOn(SID, '2026-10-20')).some((d) => d.studentId === rae.id)).toBe(false);
    const shown = (await classDropIns(program, session)).find((d) => d.studentId === rae.id)!;
    expect(shown.payLink).toBe(true);
    expect(dropInStatus(shown)).toBe('Pay link sent, $25 not paid yet');
    const [mail] = await db.select().from(schema.devEmail).where(eq(schema.devEmail.to, 'drop-link@example.com'));
    expect(mail.subject).toBe('Drop-in: Drop Test, Tue, Oct 20');
    expect(mail.text).toContain(`/drop-in/pay?order=${rows[0].orderId}`);
  });

  it('cancels with a reason, once; the CSV says so', async () => {
    const f = await family('cancel');
    const sam = await f.kid('Sam');
    const d = await addDropInWithoutCharge({ sessionId: SID, studentId: sam.id, date: '2026-10-27', staffId: 'u-hannah', reason: 'Trade', overFull: false }, opts);
    await expect(cancelDropIn({ dropInId: d.id, sessionId: SID, staffId: 'u-hannah', reason: '' })).rejects.toThrow('Add a reason');
    expect(await cancelDropIn({ dropInId: d.id, sessionId: 'another-class', staffId: 'u-hannah', reason: 'Sick' })).toBe(false);
    expect(await cancelDropIn({ dropInId: d.id, sessionId: SID, staffId: 'u-hannah', reason: 'Sick' })).toBe(true);
    expect(await cancelDropIn({ dropInId: d.id, sessionId: SID, staffId: 'u-hannah', reason: 'Sick' })).toBe(false);
    expect((await dropInsOn(SID, '2026-10-27')).some((x) => x.id === d.id)).toBe(false);
    const row = (await classDropIns(program, session)).find((x) => x.id === d.id)!;
    expect(dropInStatus(row)).toBe('Cancelled: Sick');
    const table = dropInTable([row]);
    expect(table.headers).toEqual(['Date', 'Child', 'Family', 'Status', 'Paid ($)', 'Over the limit']);
    expect(table.rows[0]).toEqual(['2026-10-27', 'Sam cancel', 'cancel family', 'Cancelled: Sick', '', '']);
  });
});

describe('Today', () => {
  it('counts the day’s drop-ins in "8 of 12"', () => {
    const p = { slug: 'intro', title: 'Intro', kind: 'class', sessions: [tue({ id: 'intro-tue', capacity: 12 })] } as unknown as Program;
    const content = { programs: [p], locationById: () => undefined };
    const rows = classRows(content, new Map([['intro-tue', { active: 7, trial: 1, waitlist: 0 }]]), bookingClock(4, new Date('2026-10-20T12:00:00Z')));
    expect(classesOn(rows, [], '2026-10-20', content)[0].places).toBe('8 of 12');
    expect(classesOn(rows, [], '2026-10-20', content, new Map([['intro-tue', 2]]))[0].places).toBe('10 of 12');
  });
});
