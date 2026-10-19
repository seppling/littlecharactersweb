/**
 * Roster changes (src/server/roster-changes.ts): removing a child, adding one
 * without charge or with a sign-up link, and offering a waitlisted family the
 * place. These touch enrollments and payments, so each money rule is checked
 * against the payments themselves.
 */
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb, schema } from '@/server/db';
import { confirmOrder, createDraftOrder, createStudent, ensureHousehold, fulfillOrder, PickError, priceOrder, takenSpots } from '@/server/family';
import { listInstallments } from '@/server/billing';
import { countingEnrollments } from '@/server/family-discount';
import { getCatalog } from '@/server/content';
import { classRoster } from '@/server/classes';
import { attentionFrom } from '@/server/today';
import {
  OFFER_HOURS,
  RosterError,
  addProblem,
  addWithoutCharge,
  checkReason,
  expireOffers,
  findChildren,
  noChargePlaces,
  offerSpot,
  openOfferCounts,
  previewRemoval,
  removeChild,
  sendSignUpLink,
  withdrawOffer,
} from '@/server/roster-changes';

// Prices from the starting content (src/content/seed/programs.ts).
const INTRO = 'intro-f26-tue'; // Tuesdays, Aug 17 – Dec 18, $95/month, ages 7–10, 20 places
const YESAND = 'yesand-f26-wed'; // Wednesdays, Aug 17 – Dec 18, $95/month
const hannah = { id: 'u-hannah' };
const NOW = new Date('2026-09-10T16:00:00Z');

async function family(tag: string) {
  const db = await getDb();
  const u = { id: `u-${tag}`, name: `Pat ${tag}`, email: `${tag}@example.com`, emailVerified: true };
  await db.insert(schema.user).values(u);
  const h = await ensureHousehold(u);
  await db.update(schema.household).set({ stripeCustomerId: `cus_${tag}`, stripePaymentMethodId: `pm_${tag}` }).where(eq(schema.household.id, h.id));
  const kids = new Map<string, string>();
  const kid = async (n: string) => {
    if (!kids.has(n)) kids.set(n, (await createStudent(h.id, { firstName: n, lastName: tag, birthdate: '2017-05-05' }, u.id)).id);
    return kids.get(n)!;
  };
  return {
    u,
    h,
    kid,
    /** Sign these children up, paid and fulfilled. */
    async enroll(names: string[], sessionId: string, plan: 'monthly' | 'full' | 'trial' | 'waitlist' = 'monthly') {
      const ids = [];
      for (const n of names) ids.push(await kid(n));
      const o = await confirmOrder(h.id, (await createDraftOrder(h.id, u.id, sessionId, ids)).id, plan, u.id);
      return fulfillOrder(o.id, u.id);
    },
    /** Put a child on the waitlist directly (the class needn't be full). */
    async waitlist(name: string, sessionId: string) {
      const [e] = await db
        .insert(schema.enrollment)
        .values({ householdId: h.id, studentId: await kid(name), sessionId, programSlug: 'intro-to-theater', status: 'waitlist' })
        .returning();
      return e;
    },
  };
}

const enrollmentOf = async (studentId: string, sessionId: string) =>
  (await (await getDb()).select().from(schema.enrollment).where(and(eq(schema.enrollment.studentId, studentId), eq(schema.enrollment.sessionId, sessionId))));
/** [month, charged, status] for one order's payments. */
const months = async (householdId: string, orderId: string) =>
  (await listInstallments(householdId)).filter((i) => i.orderId === orderId).map((i) => [i.dueDate.slice(5, 7), i.amountCents, i.status]);
const allMonths = async (householdId: string) => (await listInstallments(householdId)).map((i) => [i.orderId, i.dueDate, i.amountCents, i.baseAmountCents, i.status]);
const mail = async (to: string) => (await getDb()).select().from(schema.devEmail).where(eq(schema.devEmail.to, to));
const auditRows = async (action: string) => (await getDb()).select().from(schema.auditLog).where(eq(schema.auditLog.action, action));

/** Fill a class to its limit (20) with enrolled children from one made-up family. */
async function fillClass(sessionId: string) {
  const db = await getDb();
  const places = 20 - (await takenSpots(sessionId));
  const [h] = await db.insert(schema.household).values({ name: `Filler ${sessionId}` }).returning();
  for (let i = 0; i < places; i++) {
    const [s] = await db.insert(schema.student).values({ householdId: h.id, firstName: `Kid${i}`, lastName: 'Filler', birthdate: '2017-01-01' }).returning();
    await db.insert(schema.enrollment).values({ householdId: h.id, studentId: s.id, sessionId, programSlug: 'x', status: 'active' });
  }
  return h.id;
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  const db = await getDb();
  await db.insert(schema.user).values({ id: hannah.id, name: 'Hannah Eppling', email: 'hannah@example.com', emailVerified: true });
});
afterAll(() => {
  vi.useRealTimers();
});

describe('removing a child', () => {
  it('removing the only child on an order stops that order’s payments, after a preview', async () => {
    const F = await family('ames');
    const ava = await F.enroll(['Ava'], INTRO);
    const [e] = await enrollmentOf(await F.kid('Ava'), INTRO);

    const preview = await previewRemoval(e.id, INTRO, 'stop');
    expect(preview).toMatchObject({ stops: true, staying: [], orderId: ava.id, effects: [] });
    expect(preview!.stopping.map((i) => [i.dueDate, i.amountCents])).toEqual([['2026-10-01', 9500], ['2026-11-01', 9500], ['2026-12-01', 9500]]);
    expect(await months(F.h.id, ava.id)).toEqual([['10', 9500, 'scheduled'], ['11', 9500, 'scheduled'], ['12', 9500, 'scheduled']]); // a preview saves nothing

    const r = await removeChild(e.id, INTRO, 'stop', hannah.id);
    expect(r).toEqual({ stopped: 3, familyDiscount: 0 });
    expect(await months(F.h.id, ava.id)).toEqual([['10', 9500, 'cancelled'], ['11', 9500, 'cancelled'], ['12', 9500, 'cancelled']]);
    const [dropped] = await enrollmentOf(e.studentId, INTRO);
    expect(dropped.status).toBe('cancelled');
    // The drop date, for Phase 2's drop reports.
    expect(dropped.cancelledAt).toBeInstanceOf(Date);
    // Off the roster; logged.
    const { students } = await classRoster(INTRO, hannah.id);
    expect(students.some((c) => c.enrollmentId === e.id)).toBe(false);
    expect((await auditRows('admin.roster.remove_stop')).map((a) => a.entityId)).toContain(e.id);
    expect((await auditRows('installment.stop')).map((a) => a.entityId)).toContain(ava.id);
    // A second click finds nothing to remove.
    expect(await removeChild(e.id, INTRO, 'stop', hannah.id)).toBeNull();
  });

  it('removing one of two children on an order leaves its payments alone, and the preview says why', async () => {
    const F = await family('bell');
    const both = await F.enroll(['Ava', 'Ben'], INTRO);
    const before = await months(F.h.id, both.id);
    const [ben] = await enrollmentOf(await F.kid('Ben'), INTRO);

    const preview = await previewRemoval(ben.id, INTRO, 'stop');
    expect(preview).toMatchObject({ stops: false, staying: ['Ava'], stopping: [], orderId: both.id });

    const r = await removeChild(ben.id, INTRO, 'stop', hannah.id);
    expect(r!.stopped).toBe(0);
    // Down to one counting enrollment, so the order's own 15% ends: its months go back to the regular price for both children.
    expect(preview!.effects.map((x) => x.orderId)).toEqual([both.id]);
    const after = await months(F.h.id, both.id);
    expect(after.map((m) => m[2])).toEqual(['scheduled', 'scheduled', 'scheduled']);
    expect(after.map((m) => m[1])).toEqual(preview!.effects[0].changes.map((c) => c.afterCents));
    expect(before.map((m) => m[1])).toEqual(preview!.effects[0].changes.map((c) => c.beforeCents));
    expect((await enrollmentOf(await F.kid('Ava'), INTRO))[0].status).toBe('active');
  });

  it('“Remove only” leaves payments alone', async () => {
    const F = await family('cole');
    const ava = await F.enroll(['Ava'], INTRO);
    const [e] = await enrollmentOf(await F.kid('Ava'), INTRO);
    const preview = await previewRemoval(e.id, INTRO, 'only');
    expect(preview).toMatchObject({ stops: false, stopping: [], effects: [] });
    const before = await allMonths(F.h.id);
    expect(await removeChild(e.id, INTRO, 'only', hannah.id)).toEqual({ stopped: 0, familyDiscount: 0 });
    expect(await allMonths(F.h.id)).toEqual(before);
    expect(await months(F.h.id, ava.id)).toEqual([['10', 9500, 'scheduled'], ['11', 9500, 'scheduled'], ['12', 9500, 'scheduled']]);
    expect((await auditRows('admin.roster.remove')).map((a) => a.entityId)).toContain(e.id);
  });

  it('ends the family discount when a removal drops the family below two, and the preview says so first', async () => {
    const F = await family('dunn');
    const ava = await F.enroll(['Ava'], INTRO);
    const ben = await F.enroll(['Ben'], YESAND);
    expect(await months(F.h.id, ava.id)).toEqual([['10', 8075, 'scheduled'], ['11', 8075, 'scheduled'], ['12', 8075, 'scheduled']]);
    const [e] = await enrollmentOf(await F.kid('Ben'), YESAND);

    for (const mode of ['stop', 'only'] as const) {
      const preview = await previewRemoval(e.id, YESAND, mode);
      // Ava's months go back to $95. With "Remove only", Ben's own order keeps charging, also at the regular price.
      const lines = preview!.effects.flatMap((x) => x.changes.map((c) => [x.names.join(), c.dueDate, c.beforeCents, c.afterCents]));
      expect(lines.filter((l) => l[0] === 'Ava')).toEqual([['Ava', '2026-10-01', 8075, 9500], ['Ava', '2026-11-01', 8075, 9500], ['Ava', '2026-12-01', 8075, 9500]]);
      expect(lines.filter((l) => l[0] === 'Ben')).toHaveLength(mode === 'only' ? 3 : 0);
    }

    const r = await removeChild(e.id, YESAND, 'stop', hannah.id);
    expect(r).toEqual({ stopped: 3, familyDiscount: 3 });
    expect(await months(F.h.id, ava.id)).toEqual([['10', 9500, 'scheduled'], ['11', 9500, 'scheduled'], ['12', 9500, 'scheduled']]);
    expect(await months(F.h.id, ben.id)).toEqual([['10', 8075, 'cancelled'], ['11', 8075, 'cancelled'], ['12', 8075, 'cancelled']]);
    expect((await mail('dunn@example.com')).map((m) => m.subject)).toContain('Your family discount has ended · Little Characters');
  });
});

describe('adding a child without charge', () => {
  it('needs a reason', () => {
    expect(() => checkReason('   ')).toThrow(RosterError);
    expect(() => checkReason('x'.repeat(301))).toThrow(RosterError);
    expect(checkReason('  staff   child ')).toBe('staff child');
  });

  it('never counts toward the family discount, and changes no other payment', async () => {
    const F = await family('egan');
    const ava = await F.enroll(['Ava'], INTRO);
    const before = await allMonths(F.h.id);
    const catalog = await getCatalog();

    const e = await addWithoutCharge({ sessionId: YESAND, studentId: await F.kid('Cleo'), staffId: hannah.id, reason: 'Scholarship', overFull: false });
    expect(e).toMatchObject({ status: 'active', orderId: null, noChargeReason: 'Scholarship' });
    expect(await allMonths(F.h.id)).toEqual(before); // Ava still pays $95
    expect(await months(F.h.id, ava.id)).toEqual([['10', 9500, 'scheduled'], ['11', 9500, 'scheduled'], ['12', 9500, 'scheduled']]);
    const counted = await countingEnrollments(await getDb(), F.h.id, { catalog, today: '2026-09-10' });
    expect(counted.map((c) => c.id)).not.toContain(e.id);
    expect(counted).toHaveLength(1);

    // A paid second class later starts the discount as usual; the no-charge place still isn't counted.
    const ben = await F.enroll(['Ben'], YESAND);
    expect(await months(F.h.id, ava.id)).toEqual([['10', 8075, 'scheduled'], ['11', 8075, 'scheduled'], ['12', 8075, 'scheduled']]);
    expect(await months(F.h.id, ben.id)).toEqual([['10', 8075, 'scheduled'], ['11', 8075, 'scheduled'], ['12', 8075, 'scheduled']]);
    expect((await countingEnrollments(await getDb(), F.h.id, { catalog, today: '2026-09-10' })).length).toBe(2);

    // Kept in the record, and listed for Payments.
    const [a] = (await auditRows('admin.roster.add_no_charge')).filter((x) => x.entityId === e.id);
    expect(a).toMatchObject({ userId: hannah.id, detail: 'Scholarship' });
    expect((await noChargePlaces(catalog)).find((p) => p.enrollmentId === e.id)).toMatchObject({ child: 'Cleo egan', reason: 'Scholarship' });
    const { students } = await classRoster(YESAND, hannah.id);
    expect(students.find((c) => c.enrollmentId === e.id)?.noChargeReason).toBe('Scholarship');
  });

  it('refuses a child already in the class, warns on a full class and allows it after a second confirm', async () => {
    const F = await family('fox');
    await F.enroll(['Ava'], INTRO);
    const ava = await F.kid('Ava');
    await expect(addWithoutCharge({ sessionId: INTRO, studentId: ava, staffId: hannah.id, reason: 'trade', overFull: true })).rejects.toThrow('Ava is already in this class.');
    expect(addProblem({ firstName: 'Ava', status: 'trial' }, 'free')).toBe('Ava is already in this class.');
    expect(addProblem({ firstName: 'Ava', status: 'waitlist' }, 'link')).toMatch(/Offer the spot/);
    expect(addProblem({ firstName: 'Ava', status: 'waitlist' }, 'free')).toBeNull();

    const found = await findChildren('Ava fox', INTRO, await getCatalog());
    expect(found).toMatchObject([{ name: 'Ava fox', status: 'active' }]);

    const FULL = 'troupe-f26-wed';
    await fillClass(FULL);
    const cleo = await F.kid('Cleo');
    await expect(addWithoutCharge({ sessionId: FULL, studentId: cleo, staffId: hannah.id, reason: 'staff child', overFull: false })).rejects.toThrow(/full/);
    const e = await addWithoutCharge({ sessionId: FULL, studentId: cleo, staffId: hannah.id, reason: 'staff child', overFull: true });
    expect(e.status).toBe('active');
  });

  it('a removed no-charge child who later signs up and pays is an ordinary enrollment again', async () => {
    const F = await family('gale');
    const e = await addWithoutCharge({ sessionId: INTRO, studentId: await F.kid('Ava'), staffId: hannah.id, reason: 'trade', overFull: false });
    await removeChild(e.id, INTRO, 'stop', hannah.id);
    const paid = await F.enroll(['Ava'], INTRO);
    const rows = await enrollmentOf(await F.kid('Ava'), INTRO);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: e.id, status: 'active', orderId: paid.id, noChargeReason: null });
  });
});

describe('a sign-up link', () => {
  it('emails the parents the class’s sign-up page and logs it like a staff email', async () => {
    const F = await family('hart');
    const token = crypto.randomUUID();
    const input = { sessionId: INTRO, studentId: await F.kid('Ava'), staffId: hannah.id, overFull: false, token };
    const r = await sendSignUpLink(input);
    expect(r).toMatchObject({ duplicate: false, parents: 1 });
    const [m] = (await mail('hart@example.com')).filter((x) => x.subject === 'Sign up for Intro to Theater');
    expect(m.text).toContain('/enroll/intro-f26-tue');
    const db = await getDb();
    const [logged] = await db.select().from(schema.message).where(eq(schema.message.id, token));
    expect(logged).toMatchObject({ kind: 'family', sentByUserId: hannah.id });
    expect(await db.select().from(schema.messageRecipient).where(eq(schema.messageRecipient.messageId, token))).toMatchObject([{ householdId: F.h.id, status: 'sent' }]);
    // A double click sends once.
    expect((await sendSignUpLink(input)).duplicate).toBe(true);
    expect((await mail('hart@example.com')).filter((x) => x.subject === 'Sign up for Intro to Theater')).toHaveLength(1);
  });
});

describe('offering the spot', () => {
  it('emails an offer that ends in 48 hours; the family signs up from the waitlist and is enrolled once, the offer accepted', async () => {
    const F = await family('ivey');
    const w = await F.waitlist('Ava', INTRO);
    const offer = await offerSpot({ enrollmentId: w.id, sessionId: INTRO, staffId: hannah.id });
    expect(OFFER_HOURS).toBe(48);
    expect(offer.expiresAt!.getTime() - NOW.getTime()).toBe(48 * 3_600_000);
    const [m] = (await mail('ivey@example.com')).filter((x) => x.subject === 'A place opened in Intro to Theater');
    expect(m.text).toContain('A place opened in Intro to Theater. Sign up by Sat, Sep 12 at 12:00 pm to take it.');
    expect(m.text).toContain(`/enroll/intro-f26-tue?offer=${offer.id}`);
    await expect(offerSpot({ enrollmentId: w.id, sessionId: INTRO, staffId: hannah.id })).rejects.toThrow(/already has an open offer/);
    expect((await openOfferCounts())[INTRO]).toBe(1);
    expect((await classRoster(INTRO, hannah.id)).waitlist.find((c) => c.enrollmentId === w.id)?.offer).toMatchObject({ id: offer.id, status: 'offered' });

    const draft = await createDraftOrder(F.h.id, F.u.id, INTRO, [await F.kid('Ava')]);
    const priced = await priceOrder(F.h.id, draft, 'monthly');
    expect(priced.plans).toContain('monthly');
    const o = await fulfillOrder((await confirmOrder(F.h.id, draft.id, 'monthly', F.u.id)).id, F.u.id);

    const rows = await enrollmentOf(await F.kid('Ava'), INTRO);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: w.id, status: 'active', orderId: o.id });
    const [after] = await (await getDb()).select().from(schema.waitlistOffer).where(eq(schema.waitlistOffer.id, offer.id));
    expect(after).toMatchObject({ status: 'accepted', orderId: o.id });
    expect((await openOfferCounts())[INTRO]).toBeUndefined();
  });

  it('an expired offer can’t be used, and shows as expired on the class page', async () => {
    const F = await family('judd');
    const w = await F.waitlist('Ava', INTRO);
    const offer = await offerSpot({ enrollmentId: w.id, sessionId: INTRO, staffId: hannah.id, now: new Date(NOW.getTime() - (OFFER_HOURS + 1) * 3_600_000) });
    await expect(createDraftOrder(F.h.id, F.u.id, INTRO, [await F.kid('Ava')])).rejects.toThrow('Ava is already on the waitlist for Intro to Theater.');
    expect((await classRoster(INTRO, hannah.id)).waitlist.find((c) => c.enrollmentId === w.id)?.offer).toMatchObject({ id: offer.id, status: 'expired' });
    const [row] = await (await getDb()).select().from(schema.waitlistOffer).where(eq(schema.waitlistOffer.id, offer.id));
    expect(row.status).toBe('expired'); // marked when read
    expect(await expireOffers()).toBe(0);
    // Staff can offer it again.
    expect((await offerSpot({ enrollmentId: w.id, sessionId: INTRO, staffId: hannah.id })).status).toBe('offered');
  });

  it('a withdrawn offer can’t be used; the child stays on the waitlist', async () => {
    const F = await family('kemp');
    const w = await F.waitlist('Ava', INTRO);
    const offer = await offerSpot({ enrollmentId: w.id, sessionId: INTRO, staffId: hannah.id });
    expect(await withdrawOffer(offer.id, INTRO, hannah.id)).toBe(true);
    expect(await withdrawOffer(offer.id, INTRO, hannah.id)).toBe(false);
    await expect(createDraftOrder(F.h.id, F.u.id, INTRO, [await F.kid('Ava')])).rejects.toThrow(PickError);
    expect((await enrollmentOf(await F.kid('Ava'), INTRO))[0].status).toBe('waitlist');
    expect((await classRoster(INTRO, hannah.id)).waitlist.find((c) => c.enrollmentId === w.id)?.offer).toBeNull();
  });

  it('a full class refuses an offer link when no place is free; a free place lets it through', async () => {
    const SESSION = 'yesand-f26-wed';
    const F = await family('lowe');
    const w = await F.waitlist('Ava', SESSION);
    await offerSpot({ enrollmentId: w.id, sessionId: SESSION, staffId: hannah.id });
    const filler = await fillClass(SESSION);
    await expect(createDraftOrder(F.h.id, F.u.id, SESSION, [await F.kid('Ava')])).rejects.toThrow('Sorry, the place in Yes, And… Improv has been taken. Ava is still on the waitlist, and we’ll email you if another place opens.');

    // One child leaves: the offer works again, and checkout offers paid plans.
    const db = await getDb();
    const [one] = await db.select().from(schema.enrollment).where(eq(schema.enrollment.householdId, filler)).limit(1);
    await db.update(schema.enrollment).set({ status: 'cancelled' }).where(eq(schema.enrollment.id, one.id));
    const draft = await createDraftOrder(F.h.id, F.u.id, SESSION, [await F.kid('Ava')]);
    expect((await priceOrder(F.h.id, draft, 'monthly')).plans).not.toEqual(['waitlist']);
  });
});

describe('Today’s waitlist openings', () => {
  it('leaves out places already offered', () => {
    const row = { program: { title: 'Intro to Theater', kind: 'class' }, session: { id: INTRO, startDate: '2026-08-17' }, label: '', when: 'Tuesdays', state: 'running', waitlist: 2, openings: 1, filled: 19 } as never;
    const content = { findSession: () => undefined };
    const items = (offers?: Record<string, number>) => attentionFrom({ payments: [], classes: [row], enrolled: [], offers }, content as never, '2026-09-10', NOW).filter((i) => i.kind === 'waitlist');
    expect(items()).toHaveLength(1);
    expect(items({ [INTRO]: 1 })).toHaveLength(0);
  });
});
