/**
 * Roster changes on a class's page (docs/back-office.md → Roster changes):
 * remove a child, add a child, and offer a waitlisted family the place.
 *
 * - Remove: a preview of exactly what changes (previewRemoval), then the
 *   change (removeChild). "Remove and stop payments" cancels the order's
 *   remaining charges when no other child on that order stays in the class;
 *   "Remove only" leaves payments alone. Both refresh the 15% family discount.
 * - Add: find a child with the staff search, then email the family a sign-up
 *   link (they pay through the normal checkout) or add them without charge (a
 *   scholarship, a staff child, a trade). A no-charge place has no order and no
 *   payments, and never counts toward the family discount
 *   (countingEnrollments), so it changes nothing anyone else pays.
 * - Offer the spot: a waitlist_offer that ends after OFFER_HOURS, and an email
 *   with a link to /enroll/<session>?offer=<id>. While it's open and a place is
 *   free, that family can sign up even when the class shows as full; the
 *   checkout's capacity check decides who gets the last place. When they pay,
 *   fulfillOrder (family.ts) turns their waitlist enrollment active and marks
 *   the offer accepted. Offers past their time are marked expired when read.
 *
 * Callers check requireStaff (and requireFreshStaff for a no-charge add).
 * Every change is written to the audit log; emails are logged like staff
 * emails (kind 'family', src/server/messages.ts).
 */
import { and, desc, eq, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm';
import type { Program, Session } from '@/content/types';
import type { SiteContent } from '@/content/site-content';
import { dayList, timeRange } from '@/lib/format';
import { isOneOff, oneOffWhen } from '@/lib/program-fit';
import { todayInAthens } from '@/lib/pricing';
import { cancelRemainingInstallments } from './billing';
import { getCatalog } from './content';
import { getDb, schema } from './db';
import { config } from './env';
import { ageOn, fitsAges, outsideAgesNote, placesFree } from './family';
import { logFamilyDiscount, previewRemovalEffect, refreshFamilyDiscount, type FamilyDiscountEffect } from './family-discount';
import { searchStaff } from './families';
import { familyAudience, footerFor, sendMessage } from './messages';
import { audit } from './records';

const { enrollment, student, household, installment, waitlistOffer } = schema;

/** How long a family has to take an offered place. Hannah to confirm. */
export const OFFER_HOURS = 48;
/** The longest reason for a no-charge place. */
export const REASON_MAX = 300;

type Catalog = Pick<SiteContent, 'findSession'>;
type EnrollmentStatus = (typeof enrollment.$inferSelect)['status'];

/** A step staff can't take; the message is safe to show them. */
export class RosterError extends Error {}

const found = (catalog: Catalog, sessionId: string) => {
  const f = catalog.findSession(sessionId);
  if (!f) throw new RosterError('That class wasn’t found.');
  return f;
};

/** "Tuesdays, 4:30–5:30 pm", or a one-off's date and time. */
const classWhen = (program: Program, session: Session) =>
  isOneOff(session) ? oneOffWhen(program, session) : [dayList(session.days), session.start && session.end ? timeRange(session.start, session.end) : ''].filter(Boolean).join(', ');

/** "Wed, Oct 21 at 3:15 pm", in Athens. */
export function offerDeadline(d: Date) {
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).replace(' AM', ' am').replace(' PM', ' pm');
  return `${day} at ${time}`;
}

/** The class is full: no place left, or staff set it to "waitlist only". */
async function isFull(program: Program, session: Session) {
  const free = await placesFree(program, session);
  return session.status === 'waitlist' || (free !== undefined && free <= 0);
}

// ───────────── Remove a child ─────────────

export type RemoveMode = 'stop' | 'only';

export interface RemovalPreview {
  enrollmentId: string;
  householdId: string;
  child: string;
  family: string;
  mode: RemoveMode;
  orderId: string | null;
  /** First names of the other children on the same order who stay in the class: their payments continue. */
  staying: string[];
  /** Payments stop: "Remove and stop payments", and no other child on the order stays. */
  stops: boolean;
  /** The charges cancelled when payments stop. */
  stopping: { dueDate: string; amountCents: number }[];
  /** The family's payments the family discount changes. */
  effects: FamilyDiscountEffect[];
}

/** A child on the roster (enrolled or trial) in this class, with their family. */
async function rosterEnrollment(enrollmentId: string, sessionId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ e: enrollment, firstName: student.firstName, lastName: student.lastName, family: household.name })
    .from(enrollment)
    .innerJoin(student, eq(student.id, enrollment.studentId))
    .innerJoin(household, eq(household.id, enrollment.householdId))
    .where(and(eq(enrollment.id, enrollmentId), eq(enrollment.sessionId, sessionId), inArray(enrollment.status, ['active', 'trial'])));
  return row ?? null;
}

/** The other children on this order still in the class. */
async function stayingOnOrder(q: Pick<Awaited<ReturnType<typeof getDb>>, 'select'>, e: { id: string; orderId: string | null; sessionId: string }) {
  if (!e.orderId) return [];
  const rows = await q
    .select({ firstName: student.firstName })
    .from(enrollment)
    .innerJoin(student, eq(student.id, enrollment.studentId))
    .where(and(eq(enrollment.orderId, e.orderId), eq(enrollment.sessionId, e.sessionId), ne(enrollment.id, e.id), inArray(enrollment.status, ['active', 'trial'])));
  return rows.map((r) => r.firstName);
}

/** Exactly what removing a child would change. Nothing is saved. Null when the child isn't on the roster. */
export async function previewRemoval(enrollmentId: string, sessionId: string, mode: RemoveMode, opts: { catalog?: Catalog } = {}): Promise<RemovalPreview | null> {
  const row = await rosterEnrollment(enrollmentId, sessionId);
  if (!row) return null;
  const db = await getDb();
  const staying = await stayingOnOrder(db, row.e);
  const stops = mode === 'stop' && !!row.e.orderId && staying.length === 0;
  const stopping = stops
    ? await db
        .select({ dueDate: installment.dueDate, amountCents: installment.amountCents })
        .from(installment)
        .where(and(eq(installment.orderId, row.e.orderId!), inArray(installment.status, ['scheduled', 'failed'])))
        .orderBy(installment.dueDate)
    : [];
  const effects = await previewRemovalEffect(row.e.householdId, row.e.id, stops ? row.e.orderId! : undefined, { catalog: opts.catalog ?? (await getCatalog()) });
  return {
    enrollmentId: row.e.id,
    householdId: row.e.householdId,
    child: `${row.firstName} ${row.lastName}`,
    family: row.family,
    mode,
    orderId: row.e.orderId,
    staying,
    stops,
    stopping,
    effects,
  };
}

/**
 * Take a child off the roster: their enrollment is cancelled (the family page
 * shows it as cancelled). With 'stop', the order's remaining charges are
 * cancelled too, unless another child on the order stays in the class. Either
 * way the family discount is refreshed, in the same transaction.
 */
export async function removeChild(enrollmentId: string, sessionId: string, mode: RemoveMode, staffId: string) {
  const db = await getDb();
  // Read before the transaction: the embedded database has a single connection.
  const catalog = await getCatalog();
  const result = await db.transaction(async (tx) => {
    const [e] = await tx
      .update(enrollment)
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where(and(eq(enrollment.id, enrollmentId), eq(enrollment.sessionId, sessionId), inArray(enrollment.status, ['active', 'trial'])))
      .returning();
    if (!e) return null;
    const staying = await stayingOnOrder(tx, e);
    const stopped = mode === 'stop' && e.orderId && staying.length === 0 ? await cancelRemainingInstallments(tx, e.orderId) : [];
    return { e, stopped: stopped.length, family: await refreshFamilyDiscount(tx, e.householdId, { catalog }) };
  });
  if (!result) return null;
  const { e, stopped, family } = result;
  await audit(staffId, mode === 'stop' ? 'admin.roster.remove_stop' : 'admin.roster.remove', 'enrollment', e.id);
  if (stopped && e.orderId) await audit(staffId, 'installment.stop', 'order', e.orderId);
  await logFamilyDiscount(staffId, e.householdId, family);
  return { stopped, familyDiscount: family.changes.length };
}

// ───────────── Add a child ─────────────

export type AddWay = 'link' | 'free';

export interface AddCandidate {
  studentId: string;
  householdId: string;
  name: string;
  firstName: string;
  family: string;
  age: number | null;
  /** Their enrollment in this class, if any (not cancelled). */
  status: EnrollmentStatus | null;
  /** "Ages 7–10. Maya is 5.": a warning, not a block. */
  ageNote: string | null;
}

/** Why this way can't be used for this child, or null. */
export function addProblem(c: Pick<AddCandidate, 'firstName' | 'status'>, way: AddWay) {
  if (c.status === 'active' || c.status === 'trial') return `${c.firstName} is already in this class.`;
  if (c.status === 'waitlist' && way === 'link') return `${c.firstName} is on the waitlist. Use Offer the spot instead.`;
  return null;
}

async function statusesHere(sessionId: string, studentIds: string[]) {
  if (!studentIds.length) return new Map<string, EnrollmentStatus>();
  const db = await getDb();
  const rows = await db
    .select({ studentId: enrollment.studentId, status: enrollment.status })
    .from(enrollment)
    .where(and(eq(enrollment.sessionId, sessionId), inArray(enrollment.studentId, studentIds), ne(enrollment.status, 'cancelled')));
  return new Map(rows.map((r) => [r.studentId, r.status]));
}

const candidate = (program: Program, k: { id: string; householdId: string; firstName: string; lastName: string; family: string; age: number | null }, status: EnrollmentStatus | null): AddCandidate => ({
  studentId: k.id,
  householdId: k.householdId,
  name: `${k.firstName} ${k.lastName}`,
  firstName: k.firstName,
  family: k.family,
  age: k.age,
  status,
  ageNote: k.age !== null && !fitsAges(program, k.age) ? outsideAgesNote(program, k.firstName, k.age) : null,
});

/** Children whose name matches, with whether each is already in the class. Uses the staff search. */
export async function findChildren(q: string, sessionId: string, catalog: Pick<SiteContent, 'programs' | 'findSession'>) {
  const { program } = found(catalog, sessionId);
  const { children } = await searchStaff(q, catalog);
  if (!children.length) return [];
  const db = await getDb();
  const names = new Map(
    (await db.select({ id: student.id, firstName: student.firstName, lastName: student.lastName }).from(student).where(inArray(student.id, children.map((c) => c.id)))).map((s) => [s.id, s]),
  );
  const here = await statusesHere(sessionId, children.map((c) => c.id));
  return children.map((c) => candidate(program, { ...names.get(c.id)!, id: c.id, householdId: c.householdId, family: c.family, age: c.age }, here.get(c.id) ?? null));
}

/** One child, for the confirm step. Null when there's no such child. */
export async function addCandidate(studentId: string, sessionId: string, catalog: Catalog) {
  const { program, session } = found(catalog, sessionId);
  const db = await getDb();
  const [k] = await db
    .select({ id: student.id, householdId: student.householdId, firstName: student.firstName, lastName: student.lastName, birthdate: student.birthdate, family: household.name })
    .from(student)
    .innerJoin(household, eq(household.id, student.householdId))
    .where(eq(student.id, studentId));
  if (!k) return null;
  const here = await statusesHere(sessionId, [k.id]);
  return { ...candidate(program, { ...k, age: ageOn(k.birthdate) }, here.get(k.id) ?? null), full: await isFull(program, session) };
}

interface AddInput {
  sessionId: string;
  studentId: string;
  staffId: string;
  /** Staff ticked "the class is full, add anyway". */
  overFull: boolean;
}

/** The child, checked for this way of adding. Throws a RosterError when it can't be done. */
async function checkAdd(input: AddInput, way: AddWay, catalog: Catalog) {
  const c = await addCandidate(input.studentId, input.sessionId, catalog);
  if (!c) throw new RosterError('That child wasn’t found.');
  const problem = addProblem(c, way);
  if (problem) throw new RosterError(problem);
  if (c.full && !input.overFull) throw new RosterError('This class is full. Tick the box to go ahead anyway.');
  return c;
}

/**
 * Email the family's parents a link to sign the child up for this class. They
 * pay through the normal checkout, so prices and discounts apply as usual.
 * `token` is the form's one-time token, so a double click sends once.
 */
export async function sendSignUpLink(input: AddInput & { token: string }, opts: { catalog?: Catalog } = {}) {
  const catalog = opts.catalog ?? (await getCatalog());
  const c = await checkAdd(input, 'link', catalog);
  const { program, session } = found(catalog, input.sessionId);
  const fam = await familyAudience(c.householdId);
  if (!fam?.parents.length) throw new RosterError(`The ${c.family} have no parent email on file.`);
  const url = new URL(`/enroll/${encodeURIComponent(session.id)}`, config.siteUrl).toString();
  const sent = await sendMessage({
    token: input.token,
    kind: 'family',
    subject: `Sign up for ${program.title}`,
    body: [`Here’s the link to sign ${c.firstName} up for ${program.title} (${classWhen(program, session)}):`, url, 'It takes a few minutes: check the details, choose how to pay, and you’re done.'].join('\n\n'),
    footer: footerFor(),
    families: [fam],
    staffId: input.staffId,
  });
  if (!sent.duplicate) await audit(input.staffId, 'admin.roster.signup_link', 'student', c.studentId);
  return { ...sent, parents: fam.parents.length };
}

/** A reason for a no-charge place, trimmed and checked. */
export function checkReason(raw: string) {
  const reason = raw.replace(/\s+/g, ' ').trim();
  if (!reason) throw new RosterError('Add a reason, like “scholarship” or “staff child”.');
  if (reason.length > REASON_MAX) throw new RosterError(`Keep the reason under ${REASON_MAX} characters.`);
  return reason;
}

/**
 * Add the child as enrolled, with no order and no payments. A waitlisted or
 * removed child's enrollment becomes this one (one per child and class), and a
 * waitlist offer still open for it is withdrawn. Changes no other payment: a
 * no-charge place doesn't count toward the family discount.
 */
export async function addWithoutCharge(input: AddInput & { reason: string }, opts: { catalog?: Catalog } = {}) {
  const catalog = opts.catalog ?? (await getCatalog());
  const reason = checkReason(input.reason);
  const c = await checkAdd(input, 'free', catalog);
  const { program, session } = found(catalog, input.sessionId);
  const db = await getDb();
  const e = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(enrollment)
      .values({ householdId: c.householdId, studentId: c.studentId, sessionId: session.id, programSlug: program.slug, status: 'active', noChargeReason: reason })
      .onConflictDoUpdate({ target: [enrollment.studentId, enrollment.sessionId], set: { status: 'active', orderId: null, noChargeReason: reason } })
      .returning();
    await tx
      .update(waitlistOffer)
      .set({ status: 'withdrawn' })
      .where(and(eq(waitlistOffer.enrollmentId, row.id), eq(waitlistOffer.status, 'offered')));
    return row;
  });
  await audit(input.staffId, 'admin.roster.add_no_charge', 'enrollment', e.id, reason);
  return e;
}

/** "No charge, added by staff: scholarship" */
export const noChargeLabel = (reason: string) => `No charge, added by staff: ${reason}`;

/** Every no-charge place in a class that hasn't ended, for the Payments page. */
export async function noChargePlaces(catalog: Catalog, today = todayInAthens()) {
  const db = await getDb();
  const rows = await db
    .select({ enrollmentId: enrollment.id, householdId: enrollment.householdId, sessionId: enrollment.sessionId, reason: enrollment.noChargeReason, firstName: student.firstName, lastName: student.lastName, family: household.name })
    .from(enrollment)
    .innerJoin(student, eq(student.id, enrollment.studentId))
    .innerJoin(household, eq(household.id, enrollment.householdId))
    .where(and(eq(enrollment.status, 'active'), isNotNull(enrollment.noChargeReason)))
    .orderBy(household.name, student.firstName);
  return rows
    .filter((r) => (catalog.findSession(r.sessionId)?.session.endDate ?? '') >= today)
    .map((r) => ({ ...r, reason: r.reason ?? '', child: `${r.firstName} ${r.lastName}` }));
}

// ───────────── Offer the spot ─────────────

/** Mark offers past their time as expired (no scheduled job: whoever reads them does it). */
export async function expireOffers(now = new Date(), sessionId?: string) {
  const db = await getDb();
  const rows = await db
    .update(waitlistOffer)
    .set({ status: 'expired' })
    .where(and(eq(waitlistOffer.status, 'offered'), lt(waitlistOffer.expiresAt, now), sessionId ? eq(waitlistOffer.sessionId, sessionId) : undefined))
    .returning({ id: waitlistOffer.id });
  return rows.length;
}

export interface OfferState {
  id: string;
  offeredAt: Date;
  expiresAt: Date | null;
  status: 'offered' | 'expired';
}

/** The latest offer for each of these waitlisted enrollments, when it's open or ran out (withdrawn ones don't show). */
export async function offerStates(enrollmentIds: string[], now = new Date()) {
  const out = new Map<string, OfferState>();
  if (!enrollmentIds.length) return out;
  const db = await getDb();
  const rows = await db.select().from(waitlistOffer).where(inArray(waitlistOffer.enrollmentId, enrollmentIds)).orderBy(desc(waitlistOffer.offeredAt));
  const seen = new Set<string>();
  for (const r of rows) {
    // Only the latest counts: after a withdrawn offer, older ones don't show either.
    if (seen.has(r.enrollmentId)) continue;
    seen.add(r.enrollmentId);
    const status = r.status === 'offered' && r.expiresAt && r.expiresAt < now ? 'expired' : r.status;
    if (status === 'offered' || status === 'expired') out.set(r.enrollmentId, { id: r.id, offeredAt: r.offeredAt, expiresAt: r.expiresAt, status });
  }
  return out;
}

/** Open offers per class, for Today's "Waitlist openings" (an offered place isn't open to the next family). */
export async function openOfferCounts(now = new Date()) {
  const db = await getDb();
  const rows = await db
    .select({ sessionId: waitlistOffer.sessionId, n: sql<number>`count(*)::int` })
    .from(waitlistOffer)
    .innerJoin(enrollment, eq(enrollment.id, waitlistOffer.enrollmentId))
    .where(and(eq(waitlistOffer.status, 'offered'), eq(enrollment.status, 'waitlist'), sql`(${waitlistOffer.expiresAt} is null or ${waitlistOffer.expiresAt} > ${now})`))
    .groupBy(waitlistOffer.sessionId);
  return Object.fromEntries(rows.map((r) => [r.sessionId, r.n])) as Record<string, number>;
}

/**
 * Offer a waitlisted child the place: an offer that ends in OFFER_HOURS, and
 * an email to the family's parents with the sign-up link.
 */
export async function offerSpot(input: { enrollmentId: string; sessionId: string; staffId: string; now?: Date }, opts: { catalog?: Catalog } = {}) {
  const now = input.now ?? new Date();
  const catalog = opts.catalog ?? (await getCatalog());
  const { program } = found(catalog, input.sessionId);
  await expireOffers(now, input.sessionId);
  const db = await getDb();
  const [row] = await db
    .select({ e: enrollment, firstName: student.firstName, family: household.name })
    .from(enrollment)
    .innerJoin(student, eq(student.id, enrollment.studentId))
    .innerJoin(household, eq(household.id, enrollment.householdId))
    .where(and(eq(enrollment.id, input.enrollmentId), eq(enrollment.sessionId, input.sessionId), eq(enrollment.status, 'waitlist')));
  if (!row) throw new RosterError('That child isn’t on the waitlist any more.');
  const [open] = await db.select({ id: waitlistOffer.id }).from(waitlistOffer).where(and(eq(waitlistOffer.enrollmentId, row.e.id), eq(waitlistOffer.status, 'offered')));
  if (open) throw new RosterError(`${row.firstName} already has an open offer.`);
  const fam = await familyAudience(row.e.householdId);
  if (!fam?.parents.length) throw new RosterError(`The ${row.family} have no parent email on file.`);

  const expiresAt = new Date(now.getTime() + OFFER_HOURS * 3_600_000);
  const [offer] = await db
    .insert(waitlistOffer)
    .values({ enrollmentId: row.e.id, householdId: row.e.householdId, sessionId: input.sessionId, offeredByUserId: input.staffId, offeredAt: now, expiresAt })
    .returning();
  await audit(input.staffId, 'admin.waitlist.offer', 'waitlist_offer', offer.id);
  const url = new URL(`/enroll/${encodeURIComponent(input.sessionId)}?offer=${offer.id}`, config.siteUrl).toString();
  await sendMessage({
    token: crypto.randomUUID(),
    kind: 'family',
    subject: `A place opened in ${program.title}`,
    body: [
      `A place opened in ${program.title}. Sign up by ${offerDeadline(expiresAt)} to take it.`,
      url,
      `The place goes to the first family to sign up. If you don’t sign up by then, ${row.firstName} stays on the waitlist.`,
    ].join('\n\n'),
    footer: footerFor(),
    families: [fam],
    staffId: input.staffId,
  });
  return offer;
}

/** Withdraw an open offer; the child stays on the waitlist. False when it wasn't open. */
export async function withdrawOffer(offerId: string, sessionId: string, staffId: string) {
  const db = await getDb();
  const [o] = await db
    .update(waitlistOffer)
    .set({ status: 'withdrawn' })
    .where(and(eq(waitlistOffer.id, offerId), eq(waitlistOffer.sessionId, sessionId), eq(waitlistOffer.status, 'offered')))
    .returning({ id: waitlistOffer.id });
  if (o) await audit(staffId, 'admin.waitlist.withdraw', 'waitlist_offer', o.id);
  return !!o;
}

/** The offer an /enroll/<session>?offer=<id> link names, when it's this family's and for this class. */
export async function familyOffer(offerId: string, householdId: string, sessionId: string, now = new Date()) {
  if (!/^[0-9a-f-]{36}$/i.test(offerId)) return null;
  await expireOffers(now, sessionId);
  const db = await getDb();
  const [o] = await db
    .select({ id: waitlistOffer.id, status: waitlistOffer.status, expiresAt: waitlistOffer.expiresAt, firstName: student.firstName, enrollmentStatus: enrollment.status })
    .from(waitlistOffer)
    .innerJoin(enrollment, eq(enrollment.id, waitlistOffer.enrollmentId))
    .innerJoin(student, eq(student.id, enrollment.studentId))
    .where(and(eq(waitlistOffer.id, offerId), eq(waitlistOffer.householdId, householdId), eq(waitlistOffer.sessionId, sessionId)));
  return o ?? null;
}

