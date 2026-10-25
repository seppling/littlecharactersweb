/**
 * The preview's demo data (scripts/demo-data.ts, docs/plans/preview-demo-data.md):
 * the story plays on a fresh database, on a clock moved from August to
 * Oct 25, 2026, and leaves made-up families with a term's payments,
 * attendance and the rest, every address @example.com and every phone 555.
 */
import { and, eq, inArray, like } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getCatalog } from '@/server/content';
import { getDb, schema } from '@/server/db';
import { missedTwo } from '@/server/attendance';
import { readStudentNotes } from '@/server/family';
import { dashboard } from '@/server/reports/dashboard';
import { findReport, Loads, runReport } from '@/server/reports/library';
import { readFilters, type Content } from '@/server/reports/common';
import { athensInstant } from '@/server/shows';
import { DEMO_START, demoContacts, seedDemo, type DemoSummary } from '../../scripts/demo-data';

const UNTIL = athensInstant('2026-10-25', '12:00');
let summary: DemoSummary;

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  // Before the database opens: the story's clock only moves forward.
  vi.setSystemTime(DEMO_START);
  summary = await seedDemo({ until: UNTIL, setNow: (at) => vi.setSystemTime(at) });
}, 180_000);
afterAll(() => vi.useRealTimers());

const rows = async <T>(q: Promise<T[]>) => (await q).length;

describe('the demo story', () => {
  it('makes the families, children and sign-ups', () => {
    expect(summary).toMatchObject({ families: 30, children: 36 });
    expect(summary.enrollments).toBeGreaterThanOrEqual(45);
    expect(summary.taps).toBeGreaterThan(300);
  });

  it('uses made-up contacts only: @example.com addresses and 555 numbers', async () => {
    const { emails, phones } = await demoContacts();
    expect(emails.length).toBeGreaterThan(30);
    for (const e of emails) expect(e).toMatch(/@example\.com$/);
    expect(phones.length).toBeGreaterThan(30);
    for (const p of phones) expect(p).toMatch(/^\d{3}555\d{4}$/);
  });

  it('has an owner, two teachers and the parent to sign in as', async () => {
    const db = await getDb();
    const staff = await db.select({ email: schema.staff.email, role: schema.staff.role }).from(schema.staff);
    expect(staff).toEqual(expect.arrayContaining([{ email: 'owner@example.com', role: 'owner' }, { email: 'teacher@example.com', role: 'teacher' }, { email: 'teacher2@example.com', role: 'teacher' }]));
    expect(await rows(db.select().from(schema.user).where(eq(schema.user.email, 'parent@example.com')))).toBe(1);
  });

  it('fills Intro to Theater with a waitlist, and leaves two classes under five', async () => {
    const db = await getDb();
    const count = (session: string, status: 'active' | 'waitlist') => rows(db.select().from(schema.enrollment).where(and(eq(schema.enrollment.sessionId, session), eq(schema.enrollment.status, status))));
    expect(await count('intro-f26-tue', 'active')).toBe(20);
    expect(await count('intro-f26-tue', 'waitlist')).toBe(2);
    expect(await count('acting-studio-f26', 'active')).toBe(3);
    expect(await count('stories-songs-f26', 'active')).toBe(3);
  });

  it('has a teacher on every class, and allergy notes stored encrypted', async () => {
    const db = await getDb();
    const leads = await db.select({ sessionId: schema.classTeacher.sessionId }).from(schema.classTeacher).where(eq(schema.classTeacher.role, 'lead'));
    expect(new Set(leads.map((l) => l.sessionId)).size).toBe(8);
    const [ada] = await db.select().from(schema.student).where(eq(schema.student.firstName, 'Ada'));
    expect(ada.allergiesEnc).toBeTruthy();
    expect(ada.allergiesEnc).not.toContain('Peanuts');
    expect(readStudentNotes(ada).allergies).toContain('Peanuts');
  });

  it('has free classes that went on to monthly, and two that didn’t', async () => {
    const db = await getDb();
    for (const first of ['Ava', 'Lucas']) {
      const [kid] = await db.select().from(schema.student).where(eq(schema.student.firstName, first));
      const orders = await db.select({ plan: schema.order.plan }).from(schema.order).where(eq(schema.order.householdId, kid.householdId));
      expect(orders.map((o) => o.plan).sort(), first).toEqual(['monthly', 'trial']);
      expect((await db.select({ s: schema.enrollment.status }).from(schema.enrollment).where(eq(schema.enrollment.studentId, kid.id)))[0].s).toBe('active');
    }
    const left = await db.select({ reason: schema.enrollment.dropReason }).from(schema.enrollment).innerJoin(schema.student, eq(schema.student.id, schema.enrollment.studentId)).where(inArray(schema.student.firstName, ['Tess', 'Leah']));
    expect(left.map((l) => l.reason).filter(Boolean).sort()).toEqual(['Cost', 'Schedule']);
  });

  it('has the term’s money: two failed payments (one late fee, one waived), a check, a refund, credits, the family discount', async () => {
    const db = await getDb();
    // The 15% family discount: a payment's base below its regular price (src/server/family-discount.ts).
    const discounted = (await db.select({ base: schema.installment.baseAmountCents, regular: schema.installment.regularAmountCents }).from(schema.installment)).filter((i) => i.base < i.regular);
    expect(discounted.length).toBeGreaterThan(5);
    // The fall break's credits, for the families who'd already paid October.
    expect(await rows(db.select().from(schema.credit).where(like(schema.credit.id, 'dayoff-%')))).toBeGreaterThanOrEqual(3);
    const failed = await db.select().from(schema.installment).where(eq(schema.installment.status, 'failed'));
    expect(failed).toHaveLength(2);
    expect(failed.map((i) => i.lateFeeCents).sort()).toEqual([0, 1500]);
    expect(await rows(db.select().from(schema.installment).where(eq(schema.installment.lastError, 'paid outside Stripe')))).toBe(2);
    // Refunded by check, so it works on the preview with Stripe test keys set as well.
    const refunds = await db.select().from(schema.refund);
    expect(refunds.map((r) => [r.status, r.stripeRefundId])).toEqual([['succeeded', null]]);
    expect(await rows(db.select().from(schema.credit))).toBeGreaterThanOrEqual(2);
    expect(await rows(db.select().from(schema.dropIn).where(eq(schema.dropIn.status, 'booked')))).toBe(1);
  });

  it('has attendance: a child who missed two in a row, a teacher’s note, and a class not taken', async () => {
    const db = await getDb();
    const [kai] = await db.select().from(schema.student).where(eq(schema.student.firstName, 'Kai'));
    expect((await missedTwo()).map((m) => m.studentId)).toContain(kai.id);
    const notes = await db.select({ note: schema.classReport.note }).from(schema.classReport);
    expect(notes.filter((n) => n.note)).toHaveLength(1);
    // This week's Film class (Thu Oct 22) is left for the teacher.
    expect(await rows(db.select().from(schema.attendance).where(and(eq(schema.attendance.sessionId, 'film-f26-thu'), eq(schema.attendance.classDate, '2026-10-22'))))).toBe(0);
  });

  it('has the rest: days off, tags, skills, a progress note, the show, leads, last season, and an empty mailbox', async () => {
    const db = await getDb();
    expect(await rows(db.select().from(schema.closure))).toBe(7);
    expect(await rows(db.select().from(schema.tag))).toBe(3);
    expect(await rows(db.select().from(schema.studentSkill))).toBeGreaterThan(0);
    expect(await rows(db.select().from(schema.progressNote))).toBe(1);
    expect(await rows(db.select().from(schema.showCast))).toBe(7);
    expect(await rows(db.select().from(schema.showRehearsal))).toBe(1);
    expect(await rows(db.select().from(schema.lead))).toBe(4);
    expect(await rows(db.select().from(schema.staffSetting).where(eq(schema.staffSetting.key, 'reports.baseline')))).toBe(1);
    expect(await rows(db.select().from(schema.devEmail))).toBe(0);
  });

  it('every dashboard number equals its report’s total', async () => {
    const db = await getDb();
    const [owner] = await db.select().from(schema.user).where(eq(schema.user.email, 'owner@example.com'));
    const ctx = { content: (await getCatalog()) as unknown as Content, today: '2026-10-25', now: UNTIL };
    const d = await dashboard(ctx, owner.id);
    for (const t of [...d.tiles, ...d.small]) {
      const r = await runReport(findReport(t.key)!, readFilters(new URL(t.href, 'http://x').searchParams), new Loads(ctx), owner.id);
      expect(r.total, t.key).toEqual(t.total);
      expect(t.total.value, t.key).not.toBeNull();
    }
  });
});
