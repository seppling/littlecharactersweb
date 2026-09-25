/**
 * Family data access.
 *
 * Every function takes a householdId that the caller got from the signed-in
 * user's session (see householdForUser), never from the request. That is how
 * we prevent one family from reading or changing another family's data
 * (OWASP A01: broken access control).
 */
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from './db';
import { decrypt, encrypt } from './crypto';
import { emailHtml, sendEmail } from './email';
import { config } from './env';
import { locationById } from '@/data/locations';
import { dayList, timeRange } from '@/lib/format';
import { programs } from '@/data/programs';
import type { Program, Session } from '@/data/types';
import { PRICING, availablePlans, formatCents, meetings, quote, todayInAthens, type Plan } from '@/lib/pricing';

const { household, householdMember, student, order, enrollment, auditLog } = schema;

export type SessionUser = { id: string; name: string; email: string; emailVerified: boolean };

// ───────────── Catalog lookups ─────────────

export function findSession(sessionId: string): { program: Program; session: Session } | undefined {
  for (const program of programs) {
    const session = program.sessions.find((s) => s.id === sessionId);
    if (session) return { program, session };
  }
  return undefined;
}

export function capacityFor(program: Program, session: Session) {
  return session.capacity ?? (program.kind === 'class' ? PRICING.defaultClassCapacity : undefined);
}

// ───────────── Households ─────────────

export async function householdForUser(userId: string) {
  const db = await getDb();
  const rows = await db
    .select({ id: household.id, name: household.name })
    .from(householdMember)
    .innerJoin(household, eq(household.id, householdMember.householdId))
    .where(eq(householdMember.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function ensureHousehold(user: SessionUser) {
  const existing = await householdForUser(user.id);
  if (existing) return existing;
  const db = await getDb();
  const lastName = user.name?.trim().split(/\s+/).at(-1);
  const name = lastName ? `${lastName} family` : `${user.email.split('@')[0]}’s family`;
  const [h] = await db.insert(household).values({ name }).returning({ id: household.id, name: household.name });
  await db.insert(householdMember).values({ householdId: h.id, userId: user.id });
  await audit(user.id, 'household.create', 'household', h.id);
  return h;
}

// ───────────── Students ─────────────

export const studentInput = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  birthdate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Birthday is required')
    .refine((d) => d > '1920-01-01' && d <= todayInAthens(), 'Check the birthday'),
});

export const studentDetailsInput = z.object({
  allergies: z.string().trim().max(1000).optional().default(''),
  medicalNotes: z.string().trim().max(2000).optional().default(''),
  pickupNotes: z.string().trim().max(500).optional().default(''),
  photoConsent: z.boolean(),
});

export async function listStudents(householdId: string) {
  const db = await getDb();
  return db.select().from(student).where(eq(student.householdId, householdId)).orderBy(student.createdAt);
}

export async function getStudent(householdId: string, studentId: string) {
  const db = await getDb();
  const [s] = await db
    .select()
    .from(student)
    .where(and(eq(student.id, studentId), eq(student.householdId, householdId)));
  return s ?? null;
}

export async function createStudent(householdId: string, input: z.infer<typeof studentInput>, userId: string) {
  const db = await getDb();
  const [s] = await db.insert(student).values({ householdId, ...input }).returning();
  await audit(userId, 'student.create', 'student', s.id);
  return s;
}

export async function updateStudentDetails(householdId: string, studentId: string, input: z.infer<typeof studentDetailsInput>, userId: string) {
  const db = await getDb();
  const [s] = await db
    .update(student)
    .set({
      allergiesEnc: encrypt(input.allergies),
      medicalNotesEnc: encrypt(input.medicalNotes),
      pickupNotes: input.pickupNotes || null,
      photoConsent: input.photoConsent,
      detailsConfirmedAt: new Date(),
    })
    .where(and(eq(student.id, studentId), eq(student.householdId, householdId)))
    .returning();
  if (s) await audit(userId, 'student.update', 'student', s.id);
  return s ?? null;
}

export function readStudentNotes(s: typeof student.$inferSelect) {
  return { allergies: decrypt(s.allergiesEnc), medicalNotes: decrypt(s.medicalNotesEnc) };
}

/** Details are "fresh" if a guardian confirmed them within the past year. */
export function detailsFresh(s: typeof student.$inferSelect) {
  return !!s.detailsConfirmedAt && Date.now() - s.detailsConfirmedAt.getTime() < 365 * 86_400_000;
}

export function ageOn(birthdate: string | null, on = todayInAthens()) {
  if (!birthdate) return null;
  const [by, bm, bd] = birthdate.split('-').map(Number);
  const [y, m, d] = on.split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export function fitsAges(program: Program, age: number | null) {
  if (age === null) return true;
  return age >= program.ages.min - 1 && age <= (program.ages.max ?? 120) + 1;
}

// ───────────── Enrollments ─────────────

export async function listEnrollments(householdId: string) {
  const db = await getDb();
  return db
    .select({ enrollment, student })
    .from(enrollment)
    .innerJoin(student, eq(student.id, enrollment.studentId))
    .where(and(eq(enrollment.householdId, householdId), ne(enrollment.status, 'cancelled')))
    .orderBy(enrollment.createdAt);
}

export async function takenSpots(sessionId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(enrollment)
    .where(and(eq(enrollment.sessionId, sessionId), inArray(enrollment.status, ['active', 'trial'])));
  return row?.n ?? 0;
}

async function otherClassEnrollments(householdId: string, sessionId: string) {
  const rows = await listEnrollments(householdId);
  return rows.filter((r) => r.enrollment.status === 'active' && r.enrollment.sessionId !== sessionId && findSession(r.enrollment.sessionId)?.program.kind === 'class').length;
}

// ───────────── Orders ─────────────

export async function getOrder(householdId: string, orderId: string) {
  const db = await getDb();
  const [o] = await db
    .select()
    .from(order)
    .where(and(eq(order.id, orderId), eq(order.householdId, householdId)));
  return o ?? null;
}

export async function createDraftOrder(householdId: string, userId: string, sessionId: string, studentIds: string[]) {
  const found = findSession(sessionId);
  if (!found) throw new Error('Unknown session');
  // Only this family's students can be added.
  const mine = new Set((await listStudents(householdId)).map((s) => s.id));
  const ids = [...new Set(studentIds)].filter((id) => mine.has(id));
  if (!ids.length) throw new Error('Pick at least one student');
  const db = await getDb();
  const [o] = await db.insert(order).values({ householdId, sessionId, studentIds: ids, createdByUserId: userId }).returning();
  return o;
}

/** Everything the review step needs: students, plans, and a price quote for the chosen plan. */
export async function priceOrder(householdId: string, o: typeof order.$inferSelect, requestedPlan?: Plan) {
  const found = findSession(o.sessionId);
  if (!found) throw new Error('Unknown session');
  const { program, session } = found;
  const allStudents = await listStudents(householdId);
  const students = allStudents.filter((s) => o.studentIds.includes(s.id));

  const history = await listEnrollments(householdId);
  const alreadyIn = new Set(history.filter((r) => r.enrollment.sessionId === o.sessionId).map((r) => r.student.id));
  const newStudents = students.every((s) => !history.some((r) => r.student.id === s.id && r.enrollment.status !== 'waitlist'));

  // A student converting from a free trial already holds their spot.
  const holding = new Set(history.filter((r) => r.enrollment.sessionId === o.sessionId && r.enrollment.status === 'trial').map((r) => r.student.id));
  const cap = capacityFor(program, session);
  const full = cap !== undefined && (await takenSpots(o.sessionId)) + students.filter((s) => !holding.has(s.id)).length > cap;
  const plans = availablePlans(program, session, { newStudents, full });
  const plan = requestedPlan && plans.includes(requestedPlan) ? requestedPlan : plans.includes('monthly') ? 'monthly' : plans[0];

  const q = quote({
    program,
    session,
    students: students.map((s) => ({ id: s.id, firstName: s.firstName })),
    plan,
    otherClassEnrollments: await otherClassEnrollments(householdId, o.sessionId),
    today: todayInAthens(),
  });
  return { program, session, students, plans, plan, quote: q, alreadyIn };
}

export const POLICY_VERSION = '2026-fall';

/** Lock in the plan and price, then hand off to payment (or finish right away when nothing is due). */
export async function confirmOrder(householdId: string, orderId: string, plan: Plan, userId: string) {
  const o = await getOrder(householdId, orderId);
  if (!o || o.status === 'paid' || o.status === 'cancelled') throw new Error('This order can’t be changed');
  const priced = await priceOrder(householdId, o, plan);
  const db = await getDb();
  const [updated] = await db
    .update(order)
    .set({
      plan: priced.plan,
      lines: priced.quote.lines,
      subtotalCents: priced.quote.subtotalCents,
      discountCents: priced.quote.discountCents,
      totalCents: priced.quote.totalCents,
      policyVersion: POLICY_VERSION,
      policyAcceptedAt: new Date(),
      status: 'pending_payment',
    })
    .where(and(eq(order.id, orderId), eq(order.householdId, householdId)))
    .returning();
  if (updated.totalCents === 0) await fulfillOrder(updated.id, userId);
  return (await getOrder(householdId, orderId))!;
}

export type Payment = { checkoutSessionId: string; amountCents: number | null };

/**
 * Mark an order paid and create enrollments. Idempotent and race-safe: the
 * Stripe webhook and the confirmation page may both call it at once, and only
 * one of them enrolls and sends the email.
 *
 * A Stripe payment only counts if it's for exactly the order's total, so an
 * old checkout from before the family changed plans can't complete a pricier one.
 */
export async function fulfillOrder(orderId: string, userId: string | null, payment?: Payment) {
  const db = await getDb();
  const [o] = await db.select().from(order).where(eq(order.id, orderId));
  if (!o) throw new Error('Order not found');
  if (o.status === 'paid') return o;
  if (o.status !== 'pending_payment') throw new Error('Order is not ready for payment');
  if (payment && payment.amountCents !== o.totalCents) {
    await audit(userId, 'order.amount_mismatch', 'order', o.id);
    console.error(`Order ${o.id}: Stripe checkout ${payment.checkoutSessionId} paid ${payment.amountCents}¢ but the order is ${o.totalCents}¢. Not enrolling; reconcile in Stripe.`);
    return o;
  }
  const found = findSession(o.sessionId);
  if (!found) throw new Error('Unknown session');

  const status = o.plan === 'waitlist' ? 'waitlist' : o.plan === 'trial' ? 'trial' : 'active';
  const won = await db.transaction(async (tx) => {
    // Whoever flips the status first does the work; a concurrent call finds nothing to update.
    const [claimed] = await tx
      .update(order)
      .set({ status: 'paid', paidAt: new Date(), stripeCheckoutSessionId: payment?.checkoutSessionId ?? o.stripeCheckoutSessionId })
      .where(and(eq(order.id, o.id), ne(order.status, 'paid')))
      .returning({ id: order.id });
    if (!claimed) return false;
    for (const studentId of o.studentIds) {
      await tx
        .insert(enrollment)
        .values({ householdId: o.householdId, studentId, sessionId: o.sessionId, programSlug: found.program.slug, status, orderId: o.id })
        .onConflictDoUpdate({ target: [enrollment.studentId, enrollment.sessionId], set: { status, orderId: o.id } });
    }
    return true;
  });
  const [done] = await db.select().from(order).where(eq(order.id, orderId));
  if (!won) return done;
  await audit(userId, o.totalCents > 0 ? 'order.paid' : 'order.confirmed', 'order', o.id);
  await sendOrderConfirmation(done).catch((e) => console.error('Confirmation email failed', e));
  return done;
}

async function sendOrderConfirmation(o: typeof order.$inferSelect) {
  const found = findSession(o.sessionId);
  if (!found) return;
  const { program, session } = found;
  const db = await getDb();
  const guardians = await db
    .select({ email: schema.user.email, name: schema.user.name })
    .from(householdMember)
    .innerJoin(schema.user, eq(schema.user.id, householdMember.userId))
    .where(eq(householdMember.householdId, o.householdId));
  const kids = (await listStudents(o.householdId)).filter((s) => o.studentIds.includes(s.id)).map((s) => s.firstName);
  const first = meetings(session).find((m) => m >= todayInAthens()) ?? session.startDate;
  const loc = locationById(session.locationId);
  const firstDate = new Date(`${first}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const heading = o.plan === 'waitlist' ? 'You’re on the waitlist' : 'You’re in!';
  const lines = [
    `${kids.join(' and ')} ${o.plan === 'waitlist' ? (kids.length > 1 ? 'are' : 'is') + ' on the waitlist for' : (kids.length > 1 ? 'are' : 'is') + ' enrolled in'} ${program.title}.`,
    `${dayList(session.days)}, ${timeRange(session.start, session.end)}${o.plan === 'waitlist' ? '' : `, starting ${firstDate}`}${loc ? ` at ${loc.name}, ${loc.address.join(', ')}` : ''}.`,
    o.plan === 'trial' ? 'Your first class is free. After it, you can continue with monthly tuition or pay for the semester from your family account.' : o.totalCents > 0 ? `Paid today: ${formatCents(o.totalCents)}.` : '',
    'Wear comfy clothes and closed-toe shoes, and bring a water bottle. Park on Minor St and walk in, or use the drop-off circle after 5 pm.',
    `Your family account: ${config.siteUrl}/account`,
  ].filter(Boolean);
  for (const g of guardians) {
    await sendEmail({
      to: g.email,
      subject: `${heading} ${program.title} · Little Characters`,
      text: `${heading}\n\n${lines.join('\n\n')}`,
      html: emailHtml(heading, lines),
    });
  }
}

export async function listOrders(householdId: string) {
  const db = await getDb();
  return db
    .select()
    .from(order)
    .where(and(eq(order.householdId, householdId), eq(order.status, 'paid')))
    .orderBy(sql`${order.paidAt} desc`);
}

export async function audit(userId: string | null, action: string, entity?: string, entityId?: string) {
  const db = await getDb();
  await db.insert(auditLog).values({ userId, action, entity, entityId });
}
