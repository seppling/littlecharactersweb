/**
 * Family data access.
 *
 * Every function takes a householdId that the caller got from the signed-in
 * user's session (see householdForUser), never from the request. That is how
 * we prevent one family from reading or changing another family's data
 * (OWASP A01: broken access control).
 */
import { and, eq, gt, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from './db';
import { decrypt, encrypt } from './crypto';
import { emailHtml, sendEmail } from './email';
import { audit, householdGuardians } from './records';
import { config } from './env';
import { getCatalog } from './content';
import { ageLabel, dayList, timeRange } from '@/lib/format';
import type { Program, Session } from '@/content/types';
import { bookingClock, bookingProblem } from '@/lib/session-dates';
import { PRICING, availablePlans, defaultPlan, formatCents, isWeeklyTuitionClass, meetings, quote, todayInAthens, type Plan } from '@/lib/pricing';
import { countingEnrollments, effects, logFamilyDiscount, previewEnrollmentEffect, refreshFamilyDiscount, type FamilyDiscountChange } from './family-discount';
import { detailsOnFile } from '@/lib/student-details';
import { applyWaitingCredits } from './credits';
import type { FamilyDetails, FamilyDetailsInput } from '@/lib/family-details';
import { isAdult, isOneOff, oneOffWhen } from '@/lib/program-fit';
import { emailWording, worded, type EmailParts } from './email-wording';
import type { Wording } from './settings-store';

const { household, householdMember, student, order, enrollment, installment, waitlistOffer } = schema;

export type SessionUser = { id: string; name: string; email: string; emailVerified: boolean };

// ───────────── Catalog lookups ─────────────

/** A session in the live catalog (edited at /admin/content). */
export async function findSession(sessionId: string): Promise<{ program: Program; session: Session } | undefined> {
  return (await getCatalog()).findSession(sessionId);
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

/** What the account page shows about the household itself: where it came from and the saved card. */
export async function householdAccount(householdId: string) {
  const db = await getDb();
  const [h] = await db
    .select({
      source: household.source,
      stripePaymentMethodId: household.stripePaymentMethodId,
      cardBrand: household.cardBrand,
      cardLast4: household.cardLast4,
      cardExpMonth: household.cardExpMonth,
      cardExpYear: household.cardExpYear,
    })
    .from(household)
    .where(eq(household.id, householdId));
  return h ?? null;
}

// ───────────── Family details ─────────────

/** Emergency contacts, pickup people, ZIP and how they heard about us (src/lib/family-details.ts). */
export async function getFamilyDetails(householdId: string): Promise<FamilyDetails | null> {
  const db = await getDb();
  const [h] = await db
    .select({
      emergencyContacts: household.emergencyContacts,
      pickupPeople: household.pickupPeople,
      zip: household.zip,
      heardAbout: household.heardAbout,
      contactsConfirmedAt: household.contactsConfirmedAt,
    })
    .from(household)
    .where(eq(household.id, householdId));
  return h ?? null;
}

/**
 * Saves the family's part of the form and records it as confirmed. "How did
 * you hear about us?" is only written when it was asked and answered. The audit
 * log says that it changed, never what it says.
 */
export async function updateFamilyDetails(householdId: string, input: FamilyDetailsInput, userId: string) {
  const db = await getDb();
  const [h] = await db
    .update(household)
    .set({
      emergencyContacts: input.emergencyContacts,
      pickupPeople: input.pickupPeople,
      zip: input.zip,
      ...(input.heardAbout ? { heardAbout: input.heardAbout } : {}),
      contactsConfirmedAt: new Date(),
    })
    .where(eq(household.id, householdId))
    .returning({ id: household.id });
  if (h) await audit(userId, 'household.details.update', 'household', h.id);
  return !!h;
}

/** "Looks right": a parent checked the family details and nothing changed. */
export async function confirmFamilyDetails(householdId: string, userId: string) {
  const db = await getDb();
  const [h] = await db.update(household).set({ contactsConfirmedAt: new Date() }).where(eq(household.id, householdId)).returning({ id: household.id });
  if (h) await audit(userId, 'household.details.confirm', 'household', h.id);
  return !!h;
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

/** "Looks right": the guardian checked the details and nothing changed. Records when, and nothing else. */
export async function confirmStudentDetails(householdId: string, studentId: string, userId: string) {
  const db = await getDb();
  const [s] = await db
    .update(student)
    .set({ detailsConfirmedAt: new Date() })
    .where(and(eq(student.id, studentId), eq(student.householdId, householdId)))
    .returning({ id: student.id });
  if (s) await audit(userId, 'student.confirm', 'student', s.id);
  return !!s;
}

export function readStudentNotes(s: typeof student.$inferSelect) {
  return { allergies: decrypt(s.allergiesEnc), medicalNotes: decrypt(s.medicalNotesEnc) };
}

/** Details are "fresh" if a guardian confirmed them within the past year. */
export function detailsFresh(s: typeof student.$inferSelect) {
  return detailsOnFile(s);
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

/** "Ages 7–10. Maya is 5." Shown beside a student who is outside a class's ages. */
export function outsideAgesNote(program: Program, firstName: string, age: number) {
  return `${ageLabel(program.ages, program.agesLabel)}. ${firstName} is ${age}.`;
}

type EnrollmentStatus = typeof enrollment.$inferSelect.status;

/**
 * Why this student can't be signed up for this class, or null if they can.
 * Enrolled and waitlisted students can't be picked again; a student after a free
 * trial can continue. Everyone is held to the class's ages (fitsAges).
 */
export function pickProblem(program: Program, s: { firstName: string; birthdate: string | null }, status?: EnrollmentStatus) {
  if (status === 'active') return `${s.firstName} is already enrolled in ${program.title}.`;
  if (status === 'waitlist') return `${s.firstName} is already on the waitlist for ${program.title}.`;
  const age = ageOn(s.birthdate);
  if (!fitsAges(program, age)) return `${program.title} is for ${ageLabel(program.ages, program.agesLabel).toLowerCase()}, and ${s.firstName} is ${age}. Ask us if you think it’s still a good fit.`;
  return null;
}

/** A student the family can't sign up for this class; the message is safe to show them. */
export class PickError extends Error {}

/**
 * Throws a PickError if any of these students can't be signed up for the
 * session. A waitlisted child whose family staff offered a place can sign up
 * while the offer is open and a place is free (the first family to pay gets it).
 */
async function checkPicks(householdId: string, program: Program, session: Session, students: { id: string; firstName: string; birthdate: string | null }[]) {
  const here = new Map((await listEnrollments(householdId)).filter((r) => r.enrollment.sessionId === session.id).map((r) => [r.student.id, r.enrollment.status]));
  const offered = await offeredStudents(householdId, session.id);
  const taking = students.filter((s) => here.get(s.id) === 'waitlist' && offered.has(s.id));
  if (taking.length) {
    const free = await placesFree(program, session);
    if (free !== undefined && free < taking.length) throw new PickError(placeTakenNote(program, taking[0].firstName));
  }
  for (const s of students) {
    const status = here.get(s.id);
    const problem = pickProblem(program, s, status === 'waitlist' && offered.has(s.id) ? undefined : status);
    if (problem) throw new PickError(problem);
  }
}

// ───────────── Waitlist offers ─────────────

/**
 * This family's children with an open offer of a place in this class (staff's
 * "Offer the spot", src/server/roster-changes.ts): the offer id and when it
 * ends. An offer past its time doesn't count, even before it's marked expired.
 */
export async function offeredStudents(householdId: string, sessionId: string, now = new Date()) {
  const db = await getDb();
  const rows = await db
    .select({ studentId: enrollment.studentId, offerId: waitlistOffer.id, expiresAt: waitlistOffer.expiresAt })
    .from(waitlistOffer)
    .innerJoin(enrollment, eq(enrollment.id, waitlistOffer.enrollmentId))
    .where(
      and(
        eq(waitlistOffer.householdId, householdId),
        eq(waitlistOffer.sessionId, sessionId),
        eq(waitlistOffer.status, 'offered'),
        eq(enrollment.status, 'waitlist'),
        or(isNull(waitlistOffer.expiresAt), gt(waitlistOffer.expiresAt, now)),
      ),
    );
  return new Map(rows.map((r) => [r.studentId, { offerId: r.offerId, expiresAt: r.expiresAt }]));
}

/** Places left in the class (enrolled and trial children take one each), or undefined when there's no limit. */
export async function placesFree(program: Program, session: Session) {
  const cap = capacityFor(program, session);
  return cap === undefined ? undefined : Math.max(0, cap - (await takenSpots(session.id)));
}

/** Shown when a family with an offer finds the place already taken. */
export const placeTakenNote = (program: Program, firstName: string) =>
  `Sorry, the place in ${program.title} has been taken. ${firstName} is still on the waitlist, and we’ll email you if another place opens.`;

/**
 * Throws a PickError when the session can't be booked right now: its date has
 * passed or is past its sign-up cut-off, or staff closed it or haven't opened
 * it yet (src/lib/session-dates.ts). Covers new sign-ups, the waitlist and
 * continuing after a free class, which all start an order here.
 */
async function checkBookable(program: Program, session: Session) {
  if (session.status === 'coming-soon') throw new PickError(`Registration for this ${program.title} date hasn’t opened yet.`);
  const problem = bookingProblem(program, session, bookingClock((await getCatalog()).site.lateJoinWeeks));
  if (problem) throw new PickError(problem);
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

/** One of this family's enrollments, with the student. */
export async function getEnrollment(householdId: string, enrollmentId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ enrollment, student })
    .from(enrollment)
    .innerJoin(student, eq(student.id, enrollment.studentId))
    .where(and(eq(enrollment.id, enrollmentId), eq(enrollment.householdId, householdId)));
  return row ?? null;
}

export async function takenSpots(sessionId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(enrollment)
    .where(and(eq(enrollment.sessionId, sessionId), inArray(enrollment.status, ['active', 'trial'])));
  return row?.n ?? 0;
}

/**
 * The family's other active weekly-class enrollments, for the multi-class /
 * multi-student discount: the same ones the family discount counts
 * (src/server/family-discount.ts). A brother or sister already in this same
 * class counts too (for example when siblings who took the free class together
 * continue one at a time).
 */
async function otherClassEnrollments(householdId: string, sessionId: string, studentIds: string[]) {
  const db = await getDb();
  const rows = await countingEnrollments(db, householdId, {
    catalog: await getCatalog(),
    today: todayInAthens(),
    skip: (e) => e.sessionId === sessionId && studentIds.includes(e.studentId),
  });
  return rows.length;
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
  const found = await findSession(sessionId);
  if (!found) throw new Error('Unknown session');
  // Only this family's students can be added.
  const mine = new Map((await listStudents(householdId)).map((s) => [s.id, s]));
  const ids = [...new Set(studentIds)].filter((id) => mine.has(id));
  if (!ids.length) throw new Error('Pick at least one student');
  await checkBookable(found.program, found.session);
  // The picker greys these out; this catches a stale page or a hand-made request.
  await checkPicks(householdId, found.program, found.session, ids.map((id) => mine.get(id)!));
  const db = await getDb();
  const [o] = await db.insert(order).values({ householdId, sessionId, studentIds: ids, createdByUserId: userId }).returning();
  return o;
}

/** Everything the review step needs: students, plans, and a price quote for the chosen plan. */
export async function priceOrder(householdId: string, o: typeof order.$inferSelect, requestedPlan?: Plan) {
  const found = await findSession(o.sessionId);
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
  // Staff can mark a session "waitlist only" in the editor before it's technically at capacity;
  // a family staff offered a place to can still take it while one is free.
  const offered = await offeredStudents(householdId, o.sessionId);
  const byOffer = students.length > 0 && students.every((s) => offered.has(s.id));
  const full = (session.status === 'waitlist' && !byOffer) || (cap !== undefined && (await takenSpots(o.sessionId)) + students.filter((s) => !holding.has(s.id)).length > cap);
  const plans = availablePlans(program, session, { newStudents, full });
  // New students start on the free first class where it's offered; everyone else on monthly.
  const plan = requestedPlan && plans.includes(requestedPlan) ? requestedPlan : defaultPlan(plans);

  const q = quote({
    program,
    session,
    students: students.map((s) => ({ id: s.id, firstName: s.firstName })),
    plan,
    otherClassEnrollments: await otherClassEnrollments(householdId, o.sessionId, students.map((s) => s.id)),
    today: todayInAthens(),
    // Staying on after the free class: a class priced per session charges the classes left.
    trialStudentIds: students.filter((s) => holding.has(s.id)).map((s) => s.id),
  });
  return { program, session, students, plans, plan, quote: q, alreadyIn };
}

/**
 * Review page: when this enrollment starts the family discount, the family's
 * other monthly payments it lowers (nothing is saved). Only a paid weekly class
 * counts (monthly or per session), not a free trial, the waitlist or a drop-in night.
 */
export async function familyDiscountEffect(householdId: string, priced: Pick<Awaited<ReturnType<typeof priceOrder>>, 'program' | 'session' | 'plan' | 'students'>, orderId: string) {
  if (!isWeeklyTuitionClass(priced.program, priced.session) || priced.plan === 'trial' || priced.plan === 'waitlist') return [];
  const effects = await previewEnrollmentEffect(householdId, priced.students.length);
  return effects.filter((e) => e.orderId !== orderId);
}

/** Bump when the policy summary on /enroll/details or the /policies page changes, so we know what each family agreed to. */
export const POLICY_VERSION = '2026-fall-policies-page';

/** Lock in the plan and price, then hand off to payment (or finish right away when nothing is due). */
export async function confirmOrder(householdId: string, orderId: string, plan: Plan, userId: string) {
  const o = await getOrder(householdId, orderId);
  if (!o || o.status === 'paid' || o.status === 'cancelled') throw new Error('This order can’t be changed');
  const priced = await priceOrder(householdId, o, plan);
  // The date may have closed while the family filled in the details. An order
  // already handed to payment is honoured (fulfillOrder doesn't check dates).
  await checkBookable(priced.program, priced.session);
  // Checked again here: a child may have been enrolled by another order since this one was started.
  await checkPicks(householdId, priced.program, priced.session, priced.students);
  const db = await getDb();
  const [updated] = await db
    .update(order)
    .set({
      plan: priced.plan,
      lines: priced.quote.lines,
      subtotalCents: priced.quote.subtotalCents,
      discountCents: priced.quote.discountCents,
      totalCents: priced.quote.totalCents,
      schedule: priced.quote.installments,
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
  // One class of a weekly class: a booking, not an enrollment (src/server/drop-ins.ts).
  if (o.plan === 'drop_in') return (await import('./drop-ins')).fulfillDropIn(o, userId, payment);
  const found = await findSession(o.sessionId);
  if (!found) throw new Error('Unknown session');

  const status = o.plan === 'waitlist' ? 'waitlist' : o.plan === 'trial' ? 'trial' : 'active';
  // Read before the transaction: the embedded database has a single connection.
  const catalog = await getCatalog();
  const result = await db.transaction(async (tx) => {
    // Whoever flips the status first does the work; a concurrent call finds nothing to update.
    const [claimed] = await tx
      .update(order)
      .set({ status: 'paid', paidAt: new Date(), stripeCheckoutSessionId: payment?.checkoutSessionId ?? o.stripeCheckoutSessionId })
      .where(and(eq(order.id, o.id), ne(order.status, 'paid')))
      .returning({ id: order.id });
    if (!claimed) return null;
    // One enrollment per child and class: a waitlisted (or removed) child's row becomes this one.
    const enrolled: string[] = [];
    for (const studentId of o.studentIds) {
      const [e] = await tx
        .insert(enrollment)
        .values({ householdId: o.householdId, studentId, sessionId: o.sessionId, programSlug: found.program.slug, status, orderId: o.id })
        .onConflictDoUpdate({ target: [enrollment.studentId, enrollment.sessionId], set: { status, orderId: o.id, noChargeReason: null, cancelledAt: null, dropReason: null } })
        .returning({ id: enrollment.id });
      enrolled.push(e.id);
    }
    // A place staff offered from the waitlist is taken (an offer that ran out while the family was paying still counts).
    const accepted =
      status === 'waitlist'
        ? []
        : await tx
            .update(waitlistOffer)
            .set({ status: 'accepted', orderId: o.id })
            .where(and(inArray(waitlistOffer.enrollmentId, enrolled), inArray(waitlistOffer.status, ['offered', 'expired'])))
            .returning({ id: waitlistOffer.id });
    // Monthly plan: the rest of the term, charged automatically on the 1st (src/server/billing.ts).
    if (o.plan === 'monthly' && o.schedule.length) {
      await tx
        .insert(installment)
        .values(
          o.schedule.map((c) => ({
            householdId: o.householdId,
            orderId: o.id,
            sessionId: o.sessionId,
            dueDate: c.dueDate,
            amountCents: c.amountCents,
            baseAmountCents: c.amountCents,
            // Orders confirmed before the regular price was recorded: take what was agreed.
            regularAmountCents: c.regularAmountCents ?? c.amountCents,
            label: c.label,
          })),
        )
        .onConflictDoNothing();
    }
    // A new active class can start the family discount on the family's other payments.
    return { accepted, family: status === 'active' ? await refreshFamilyDiscount(tx, o.householdId, { catalog }) : null };
  });
  const [done] = await db.select().from(order).where(eq(order.id, orderId));
  if (!result) return done;
  await audit(userId, o.totalCents > 0 ? 'order.paid' : 'order.confirmed', 'order', o.id);
  for (const a of result.accepted) await audit(userId, 'waitlist_offer.accepted', 'waitlist_offer', a.id);
  if (result.family) await logFamilyDiscount(userId, o.householdId, result.family);
  // Credits waiting for a payment come off the new monthly payments (src/server/credits.ts).
  if (o.plan === 'monthly' && o.schedule.length) await applyWaitingCredits(o.householdId).catch((e) => console.error('Applying waiting credits failed', e));
  const lowered = result.family?.changes.filter((c) => c.orderId !== o.id && c.afterCents < c.beforeCents) ?? [];
  await sendOrderConfirmation(done, lowered).catch((e) => console.error('Confirmation email failed', e));
  return done;
}

/**
 * "Ava's remaining monthly payments drop to $80.75 with the 15% family
 * discount." One line per child and class whose payments this sign-up lowered.
 */
export function loweredLines(list: { names: string[]; changes: Pick<FamilyDiscountChange, 'afterCents'>[] }[]) {
  return list.map((e) => {
    const after = [...new Set(e.changes.map((c) => c.afterCents))];
    const who = `${e.names.join(' and ')}’s`;
    return after.length === 1
      ? `${who} remaining monthly payments also drop to ${formatCents(after[0])} with the 15% family discount.`
      : `${who} remaining monthly payments also get the 15% family discount.`;
  });
}

async function sendOrderConfirmation(o: typeof order.$inferSelect, lowered: FamilyDiscountChange[] = []) {
  const found = await findSession(o.sessionId);
  if (!found) return;
  const { program, session } = found;
  const unit = (session.price ?? program.priceFrom)?.unit;
  const guardians = await householdGuardians(o.householdId);
  const kids = (await listStudents(o.householdId)).filter((s) => o.studentIds.includes(s.id)).map((s) => s.firstName);
  const first = meetings(session).find((m) => m >= todayInAthens()) ?? session.startDate;
  const loc = (await getCatalog()).locationById(session.locationId);
  const firstDate = new Date(`${first}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const email = confirmationEmail(
    {
      plan: o.plan,
      kids,
      classTitle: program.title,
      firstDate,
      when: `${isOneOff(session) ? oneOffWhen(program, session) : `${dayList(session.days)}, ${timeRange(session.start, session.end)}${o.plan === 'waitlist' ? '' : `, starting ${firstDate}`}`}${loc ? ` at ${loc.name}, ${loc.address.join(', ')}` : ''}.`,
      unit,
      totalCents: o.totalCents,
      autopay: [o.plan === 'monthly' && o.schedule.length ? autopayLine(o.schedule) : '', ...loweredLines(await effects(o.householdId, lowered))].filter(Boolean).join(' '),
      adult: isAdult(program),
    },
    o.plan === 'waitlist' ? null : await emailWording('welcome'),
  );
  for (const g of guardians) {
    await sendEmail({
      to: g.email,
      subject: email.subject,
      text: `${email.heading}\n\n${email.lines.join('\n\n')}`,
      html: emailHtml(email.heading, email.lines),
    });
  }
}

/**
 * Pure: the email after a sign-up ("You're in!", or "You're on the
 * waitlist"). Hannah's wording (Settings → Emails, `welcome`) changes the
 * subject and the first line of a sign-up's email, never a waitlist one's; who
 * is enrolled, when and where, what was paid, autopay, what to bring and the
 * account link are always in it.
 */
export function confirmationEmail(
  d: { plan: string; kids: string[]; classTitle: string; firstDate: string; when: string; unit?: string; totalCents: number; autopay: string; adult: boolean },
  wording: Wording | null,
): EmailParts & { lines: string[] } {
  const heading = d.plan === 'waitlist' ? 'You’re on the waitlist' : 'You’re in!';
  const many = d.kids.length > 1;
  const lines = [
    `${d.kids.join(' and ')} ${d.plan === 'waitlist' ? (many ? 'are' : 'is') + ' on the waitlist for' : (many ? 'are' : 'is') + ' enrolled in'} ${d.classTitle}.`,
    d.when,
    d.plan === 'trial'
      ? d.unit === 'session'
        ? 'Your first class is free. After it, you can stay on from your family account and pay for the classes left.'
        : 'Your first class is free. After it, you can continue with monthly tuition or pay for the season from your family account.'
      : d.totalCents > 0
        ? `Paid today: ${formatCents(d.totalCents)}.`
        : '',
    d.autopay,
    d.adult
      ? 'Wear comfy clothes and bring a water bottle. Park on Minor St and walk in to our front door on W Broad St.'
      : 'Wear comfy clothes and closed-toe shoes, and bring a water bottle. Park on Minor St and walk in, or use the drop-off circle after 5 pm.',
    `Your family account: ${config.siteUrl}/account`,
  ].filter(Boolean);
  const children = d.kids.join(' and ');
  const e = worded({ subject: `${heading} ${d.classTitle} · Little Characters`, heading, lines }, d.plan === 'waitlist' ? null : wording, { child: children, class: d.classTitle, date: d.firstDate }, [
    `Enrolled: ${children} in ${d.classTitle}.`,
  ]);
  return { ...e, lines: e.lines as string[] };
}

/** "We'll charge $95 to your saved card on Oct 1, Nov 1 and Dec 1." */
export function autopayLine(schedule: { dueDate: string; amountCents: number }[]) {
  const dates = schedule.map((c) => new Date(`${c.dueDate}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }));
  const amounts = new Set(schedule.map((c) => c.amountCents));
  const amount = amounts.size === 1 ? formatCents(schedule[0].amountCents) : 'the monthly tuition';
  return `We’ll charge ${amount} to your saved card on ${dates.join(', ').replace(/, ([^,]*)$/, ' and $1')}, and email a receipt each time.`;
}

/**
 * The confirmation page's family totals, read from the family's payments (no
 * prices are worked out again): what was paid today across today's sign-ups,
 * and what autopay charges on the next 1st across all their children.
 */
export async function familyTotals(householdId: string, today = todayInAthens()) {
  const db = await getDb();
  const paid = await db
    .select({ id: order.id, totalCents: order.totalCents, paidAt: order.paidAt })
    .from(order)
    .where(and(eq(order.householdId, householdId), eq(order.status, 'paid')));
  const todays = paid.filter((p) => p.paidAt && todayInAthens(p.paidAt) === today);
  const [y, m] = today.split('-').map(Number);
  const nextFirst = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const next = await db
    .select({ orderId: installment.orderId, amountCents: installment.amountCents })
    .from(installment)
    .where(and(eq(installment.householdId, householdId), eq(installment.dueDate, nextFirst), inArray(installment.status, ['scheduled', 'failed'])));
  return {
    signUpsToday: todays.length,
    paidTodayCents: todays.reduce((a, p) => a + p.totalCents, 0),
    nextFirst,
    nextMonthCents: next.reduce((a, i) => a + i.amountCents, 0),
    nextMonthOrders: new Set(next.map((i) => i.orderId)).size,
  };
}

export async function listOrders(householdId: string) {
  const db = await getDb();
  return db
    .select()
    .from(order)
    .where(and(eq(order.householdId, householdId), eq(order.status, 'paid')))
    .orderBy(sql`${order.paidAt} desc`);
}

export { audit, householdGuardians };
