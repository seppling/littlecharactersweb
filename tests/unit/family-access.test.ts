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
