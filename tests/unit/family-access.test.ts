/**
 * One family must never see or change another family's data (OWASP A01), and
 * payments must only enroll a child when the right amount was paid.
 */
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb, schema } from '@/server/db';
import { decrypt, encrypt } from '@/server/crypto';
import { isAdmin } from '@/server/auth';
import { roster } from '@/server/admin';
import {
  confirmOrder,
  createDraftOrder,
  createStudent,
  ensureHousehold,
  fulfillOrder,
  getOrder,
  getStudent,
  listEnrollments,
  PickError,
  priceOrder,
  updateStudentDetails,
  type SessionUser,
} from '@/server/family';

const SESSION = 'intro-f26-tue';
const ana: SessionUser = { id: 'u-ana', name: 'Ana Rivera', email: 'ana@example.com', emailVerified: true };
const bo: SessionUser = { id: 'u-bo', name: 'Bo Chen', email: 'bo@example.com', emailVerified: true };
let A: { id: string };
let B: { id: string };
let maya: { id: string };

beforeAll(async () => {
  // Freeze "today" in the middle of the fall term so prices don't depend on when tests run.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-10T16:00:00Z'));
  const db = await getDb();
  await db.insert(schema.user).values([ana, bo]);
  A = await ensureHousehold(ana);
  B = await ensureHousehold(bo);
  maya = await createStudent(A.id, { firstName: 'Maya', lastName: 'Rivera', birthdate: '2017-04-12' }, ana.id);
  await updateStudentDetails(A.id, maya.id, { allergies: 'Peanuts', medicalNotes: '', pickupNotes: 'Grandma Rosa', photoConsent: true }, ana.id);
});
afterAll(() => {
  vi.useRealTimers();
});

describe('household scoping', () => {
  it('hides one family’s child from another family', async () => {
    expect(await getStudent(A.id, maya.id)).not.toBeNull();
    expect(await getStudent(B.id, maya.id)).toBeNull();
  });

  it('won’t let another family edit that child', async () => {
    expect(await updateStudentDetails(B.id, maya.id, { allergies: '', medicalNotes: '', pickupNotes: 'Stranger', photoConsent: false }, bo.id)).toBeNull();
    expect((await getStudent(A.id, maya.id))?.pickupNotes).toBe('Grandma Rosa');
  });

  it('won’t let another family enroll that child', async () => {
    await expect(createDraftOrder(B.id, bo.id, SESSION, [maya.id])).rejects.toThrow(/Pick at least one student/);
  });

  it('hides one family’s order from another family', async () => {
    const o = await createDraftOrder(A.id, ana.id, SESSION, [maya.id]);
    expect(await getOrder(A.id, o.id)).not.toBeNull();
    expect(await getOrder(B.id, o.id)).toBeNull();
    await expect(confirmOrder(B.id, o.id, 'monthly', bo.id)).rejects.toThrow();
  });
});

describe('paying', () => {
  it('does not enroll when Stripe’s amount doesn’t match the order', async () => {
    const draft = await createDraftOrder(A.id, ana.id, SESSION, [maya.id]);
    const o = await confirmOrder(A.id, draft.id, 'monthly', ana.id);
    expect(o.totalCents).toBeGreaterThan(0);

    const after = await fulfillOrder(o.id, null, { checkoutSessionId: 'cs_stale', amountCents: o.totalCents - 1000 });
    expect(after.status).toBe('pending_payment');
    expect(await listEnrollments(A.id)).toHaveLength(0);
  });

  it('enrolls exactly once when the webhook and the confirmation page race', async () => {
    const db = await getDb();
    const draft = await createDraftOrder(A.id, ana.id, SESSION, [maya.id]);
    const o = await confirmOrder(A.id, draft.id, 'monthly', ana.id);
    const payment = { checkoutSessionId: 'cs_ok', amountCents: o.totalCents };
    const mailBefore = (await db.select().from(schema.devEmail)).length;

    const [x, y] = await Promise.all([fulfillOrder(o.id, null, payment), fulfillOrder(o.id, ana.id, payment)]);
    expect(x.status).toBe('paid');
    expect(y.status).toBe('paid');
    expect(await listEnrollments(A.id)).toHaveLength(1);
    expect((await db.select().from(schema.devEmail)).length - mailBefore).toBe(1);
  });
});

describe('free trial', () => {
  it('lets a family continue to paid tuition after the trial class, keeping the same spot', async () => {
    const leo = await createStudent(A.id, { firstName: 'Leo', lastName: 'Rivera', birthdate: '2018-01-20' }, ana.id);
    const trial = await confirmOrder(A.id, (await createDraftOrder(A.id, ana.id, SESSION, [leo.id])).id, 'trial', ana.id);
    expect(trial).toMatchObject({ status: 'paid', totalCents: 0 });
    const leoIn = async () => (await listEnrollments(A.id)).filter((r) => r.student.id === leo.id).map((r) => r.enrollment.status);
    expect(await leoIn()).toEqual(['trial']);

    const next = await createDraftOrder(A.id, ana.id, SESSION, [leo.id]);
    const priced = await priceOrder(A.id, next);
    expect(priced.plans).toEqual(['monthly', 'full']); // one free class per student
    const o = await confirmOrder(A.id, next.id, 'monthly', ana.id);
    await fulfillOrder(o.id, ana.id, { checkoutSessionId: 'cs_leo', amountCents: o.totalCents });
    expect(await leoIn()).toEqual(['active']);
  });
});

describe('who can be signed up', () => {
  it('refuses a child outside the class’s ages, even in a hand-made request', async () => {
    const pip = await createStudent(A.id, { firstName: 'Pip', lastName: 'Rivera', birthdate: '2021-05-01' }, ana.id);
    const attempt = createDraftOrder(A.id, ana.id, SESSION, [pip.id]);
    await expect(attempt).rejects.toBeInstanceOf(PickError);
    await expect(createDraftOrder(A.id, ana.id, SESSION, [pip.id])).rejects.toThrow('Intro to Theater is for ages 7–10, and Pip is 5.');
    // The rule itself is unchanged: one year either side of the ages still fits.
    const six = await createStudent(A.id, { firstName: 'Sol', lastName: 'Rivera', birthdate: '2020-01-01' }, ana.id);
    await expect(createDraftOrder(A.id, ana.id, SESSION, [six.id])).resolves.toMatchObject({ studentIds: [six.id] });
  });

  it('refuses a child who is already enrolled', async () => {
    await expect(createDraftOrder(A.id, ana.id, SESSION, [maya.id])).rejects.toThrow('Maya is already enrolled in Intro to Theater.');
  });

  it('checks again when the order is confirmed', async () => {
    const kim = await createStudent(A.id, { firstName: 'Kim', lastName: 'Rivera', birthdate: '2017-01-01' }, ana.id);
    const first = await createDraftOrder(A.id, ana.id, SESSION, [kim.id]);
    const second = await createDraftOrder(A.id, ana.id, SESSION, [kim.id]);
    const paid = await confirmOrder(A.id, first.id, 'monthly', ana.id);
    await fulfillOrder(paid.id, ana.id, { checkoutSessionId: 'cs_kim', amountCents: paid.totalCents });
    await expect(confirmOrder(A.id, second.id, 'monthly', ana.id)).rejects.toThrow('Kim is already enrolled');
    expect((await getOrder(A.id, second.id))?.status).toBe('draft');
  });

  it('holds a child continuing after the free class to the same ages', async () => {
    // Ned is 11 at the free class (the top of the range, plus one year) and turns 12 before continuing.
    const ned = await createStudent(A.id, { firstName: 'Ned', lastName: 'Rivera', birthdate: '2014-09-20' }, ana.id);
    await confirmOrder(A.id, (await createDraftOrder(A.id, ana.id, SESSION, [ned.id])).id, 'trial', ana.id);
    vi.setSystemTime(new Date('2026-09-25T16:00:00Z'));
    try {
      await expect(createDraftOrder(A.id, ana.id, SESSION, [ned.id])).rejects.toThrow('and Ned is 12.');
    } finally {
      vi.setSystemTime(new Date('2026-09-10T16:00:00Z'));
    }
  });
});

describe('siblings who take the free class together', () => {
  it('get the sibling discount when they continue one at a time', async () => {
    const cy: SessionUser = { id: 'u-cy', name: 'Cy Park', email: 'cy@example.com', emailVerified: true };
    const db = await getDb();
    await db.insert(schema.user).values(cy);
    const C = await ensureHousehold(cy);
    const ava = await createStudent(C.id, { firstName: 'Ava', lastName: 'Park', birthdate: '2017-03-01' }, cy.id);
    const ben = await createStudent(C.id, { firstName: 'Ben', lastName: 'Park', birthdate: '2018-03-01' }, cy.id);
    await confirmOrder(C.id, (await createDraftOrder(C.id, cy.id, SESSION, [ava.id, ben.id])).id, 'trial', cy.id);

    // Ava continues first, alone: Ben is still on his free class, so no discount yet.
    const a = await confirmOrder(C.id, (await createDraftOrder(C.id, cy.id, SESSION, [ava.id])).id, 'monthly', cy.id);
    expect(a.discountCents).toBe(0);
    await fulfillOrder(a.id, cy.id, { checkoutSessionId: 'cs_ava', amountCents: a.totalCents });

    // Then Ben: Ava is now in the same class, which counts as a second student (15%, the bigger discount).
    const draft = await createDraftOrder(C.id, cy.id, SESSION, [ben.id]);
    const monthly = (await priceOrder(C.id, draft, 'monthly')).quote;
    expect(monthly.lines).toContainEqual(expect.objectContaining({ kind: 'discount', label: '15% multi-class / multi-student discount' }));
    expect(monthly.installments.every((i) => i.amountCents === 8075)).toBe(true);
    const full = (await priceOrder(C.id, draft, 'full')).quote;
    expect(full.lines.filter((l) => l.kind === 'discount')).toEqual([expect.objectContaining({ label: '15% multi-class / multi-student discount' })]);
    expect(full.notes).toContain('Discounts don’t combine, so you’re getting the bigger one.');
  });
});

describe('siblings in separate classes', () => {
  it('get the sibling discount once a brother or sister is enrolled in another weekly class', async () => {
    const di: SessionUser = { id: 'u-di', name: 'Di Okafor', email: 'di@example.com', emailVerified: true };
    const db = await getDb();
    await db.insert(schema.user).values(di);
    const D = await ensureHousehold(di);
    const eli = await createStudent(D.id, { firstName: 'Eli', lastName: 'Okafor', birthdate: '2018-01-01' }, di.id);
    const dee = await createStudent(D.id, { firstName: 'Dee', lastName: 'Okafor', birthdate: '2014-05-01' }, di.id);
    const TROUPE = 'troupe-f26-wed';
    const hasMulti = (q: Awaited<ReturnType<typeof priceOrder>>['quote']) => q.lines.some((l) => l.label === '15% multi-class / multi-student discount');

    // Eli alone in Intro to Theater: no discount.
    const e = await confirmOrder(D.id, (await createDraftOrder(D.id, di.id, SESSION, [eli.id])).id, 'monthly', di.id);
    expect(e.discountCents).toBe(0);

    // Until Eli's enrollment is paid, it doesn't count.
    expect(hasMulti((await priceOrder(D.id, await createDraftOrder(D.id, di.id, TROUPE, [dee.id]), 'monthly')).quote)).toBe(false);
    await fulfillOrder(e.id, di.id, { checkoutSessionId: 'cs_eli', amountCents: e.totalCents });

    // Dee joins Performance Troupe, a different class: Eli counts, so Dee gets 15% off, monthly or for the season.
    const draft = await createDraftOrder(D.id, di.id, TROUPE, [dee.id]);
    expect(hasMulti((await priceOrder(D.id, draft, 'monthly')).quote)).toBe(true);
    expect(hasMulti((await priceOrder(D.id, draft, 'full')).quote)).toBe(true);
  });
});

describe('staff access', () => {
  it('requires a verified email on the admin list', () => {
    expect(isAdmin({ email: 'Hannah@example.com', emailVerified: true })).toBe(true);
    expect(isAdmin({ email: 'hannah@example.com', emailVerified: false })).toBe(false);
    expect(isAdmin({ email: 'ana@example.com', emailVerified: true })).toBe(false);
  });

  it('shows staff the allergy notes on the roster, and logs that they looked', async () => {
    const rows = await roster(SESSION, 'u-hannah');
    expect(rows.find((r) => r.student.name === 'Maya Rivera')?.student).toMatchObject({ allergies: 'Peanuts', pickup: 'Grandma Rosa' });
    const db = await getDb();
    const log = await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, 'admin.roster.view'));
    expect(log).toMatchObject([{ userId: 'u-hannah', entityId: SESSION }]);
  });
});

describe('encryption at rest', () => {
  it('stores notes as ciphertext and detects tampering', async () => {
    const db = await getDb();
    const [row] = await db.select().from(schema.student).where(eq(schema.student.id, maya.id));
    expect(row.allergiesEnc).not.toContain('Peanuts');
    expect(decrypt(row.allergiesEnc)).toBe('Peanuts');

    const sealed = encrypt('Asthma')!;
    const parts = sealed.split(':');
    parts[3] = Buffer.from('Asthmb').toString('base64');
    expect(() => decrypt(parts.join(':'))).toThrow();
    expect(encrypt('   ')).toBeNull();
  });
});

describe('class dates that have closed', () => {
  // Each test moves the clock, then puts it back to mid-September.
  const at = (iso: string) => vi.setSystemTime(new Date(iso));
  const reset = () => at('2026-09-10T16:00:00Z');
  let F: { id: string };
  const fay: SessionUser = { id: 'u-fay', name: 'Fay Lund', email: 'fay@example.com', emailVerified: true };
  beforeAll(async () => {
    const db = await getDb();
    await db.insert(schema.user).values(fay);
    F = await ensureHousehold(fay);
  });

  it('refuses a one-night date once it has started, whatever its status says', async () => {
    const gus = await createStudent(F.id, { firstName: 'Gus', lastName: 'Lund', birthdate: '2018-02-01' }, fay.id);
    at('2026-09-25T21:30:00Z'); // 5:30 pm in Athens: Parents’ Night Out started at 5.
    try {
      await expect(createDraftOrder(F.id, fay.id, 'pno-2026-09-25', [gus.id])).rejects.toThrow('Sign-ups for this Parents’ Night Out date closed when it started.');
      at('2026-09-26T14:00:00Z');
      await expect(createDraftOrder(F.id, fay.id, 'pno-2026-09-25', [gus.id])).rejects.toBeInstanceOf(PickError);
    } finally {
      reset();
    }
    // Before it starts it can be booked.
    at('2026-09-25T20:59:00Z');
    try {
      await expect(createDraftOrder(F.id, fay.id, 'pno-2026-09-25', [gus.id])).resolves.toMatchObject({ studentIds: [gus.id] });
    } finally {
      reset();
    }
  });

  it('refuses a date staff haven’t opened yet', async () => {
    const hal = await createStudent(F.id, { firstName: 'Hal', lastName: 'Lund', birthdate: '2018-02-01' }, fay.id);
    await expect(createDraftOrder(F.id, fay.id, 'free-class-2026-10-15', [hal.id])).rejects.toThrow('hasn’t opened yet');
  });

  it('refuses at checkout when the late-joining cut-off passes partway through', async () => {
    const ivy = await createStudent(F.id, { firstName: 'Ivy', lastName: 'Lund', birthdate: '2017-02-01' }, fay.id);
    const draft = await createDraftOrder(F.id, fay.id, SESSION, [ivy.id]);
    at('2026-11-20T15:00:00Z'); // Intro to Theater ends Dec 18: 4 weeks before is Nov 20.
    try {
      await expect(confirmOrder(F.id, draft.id, 'monthly', fay.id)).rejects.toThrow('Sign-ups for Intro to Theater (Fall 2026) closed 4 weeks before the last class.');
      expect((await getOrder(F.id, draft.id))?.status).toBe('draft');
    } finally {
      reset();
    }
  });

  it('refuses continuing after the free class once sign-ups have closed', async () => {
    const jo = await createStudent(F.id, { firstName: 'Jo', lastName: 'Lund', birthdate: '2017-02-01' }, fay.id);
    await confirmOrder(F.id, (await createDraftOrder(F.id, fay.id, SESSION, [jo.id])).id, 'trial', fay.id);
    at('2026-12-01T15:00:00Z');
    try {
      await expect(createDraftOrder(F.id, fay.id, SESSION, [jo.id])).rejects.toBeInstanceOf(PickError);
    } finally {
      reset();
    }
  });

  it('honours a payment already handed to Stripe when the date closes', async () => {
    const kit = await createStudent(F.id, { firstName: 'Kit', lastName: 'Lund', birthdate: '2017-02-01' }, fay.id);
    const pending = await confirmOrder(F.id, (await createDraftOrder(F.id, fay.id, SESSION, [kit.id])).id, 'monthly', fay.id);
    expect(pending.status).toBe('pending_payment');
    at('2026-11-20T15:00:00Z');
    try {
      await fulfillOrder(pending.id, fay.id, { checkoutSessionId: 'cs_kit', amountCents: pending.totalCents });
      expect((await listEnrollments(F.id)).find((r) => r.student.id === kit.id)?.enrollment.status).toBe('active');
    } finally {
      reset();
    }
  });
});
