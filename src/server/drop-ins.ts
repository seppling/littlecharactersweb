/**
 * Paid drop-ins: a child comes to one class of a weekly class and pays for that
 * date (docs/back-office.md → Drop-ins).
 *
 * - Which classes: weekly classes (isWeeklyTuitionClass), while the site
 *   setting is open and the class doesn't turn them off; the price is the
 *   class's own or the site's (cents, stored on the booking and never worked
 *   out again). No family discount, pay-in-full discount or late fee, and a
 *   drop-in never counts toward the 15% family discount (it isn't an
 *   enrollment).
 * - A family books one date for one child: an order with plan `drop_in` and a
 *   `pending` drop_in row, which holds no place. Paying (fulfillOrder, from the
 *   webhook or the confirmation page, whichever comes first) books it once. A
 *   date that filled up meanwhile is booked anyway and shows to staff as
 *   "Over the limit": a payment already taken is never refused.
 * - Staff add one from the class's page: a pay link (a pending row until the
 *   family pays) or no charge (booked at once, price 0, with a reason). Staff
 *   cancel one with a reason; a paid one is refunded from its Refund button (refunds.ts).
 *
 * Days off and who's expected on a date come from class-day.ts, so the teacher
 * app, the calendar and drop-ins agree.
 */
import { and, asc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import type { Program, Session } from '@/content/types';
import type { SiteContent, SiteInfo } from '@/content/site-content';
import { childBadges } from '@/lib/badges';
import { timeRange } from '@/lib/format';
import { formatCents, isWeeklyTuitionClass, meetings, todayInAthens } from '@/lib/pricing';
import { arrivalLines } from '@/lib/program-fit';
import { athensNow } from '@/lib/session-dates';
import { classDates, dropInCounts } from './class-day';
import type { RosterChild } from './classes';
import { getCatalog } from './content';
import { getDb, schema } from './db';
import { emailHtml, sendEmail } from './email';
import { config } from './env';
import { POLICY_VERSION, ageOn, capacityFor, getStudent, readStudentNotes, takenSpots, type Payment } from './family';
import { familyAudience, footerFor, sendMessage } from './messages';
import { audit, householdGuardians } from './records';
import { checkReason } from './roster-changes';
import { emailWording, worded, type EmailParts } from './email-wording';
import type { Wording } from './settings-store';

const { dropIn, order, student, household, householdMember, enrollment, user } = schema;

/** The class page offers drop-ins once a class has started, or starts within this many days. */
export const DROP_IN_LEAD_DAYS = 14;
/** Why a second payment for the same child and date was cancelled. */
export const PAID_TWICE = 'Paid twice for the same date. Press Refund to give this one back.';

/** A step that can't be taken; the message is safe to show. */
export class DropInError extends Error {}

type Site = Pick<SiteInfo, 'dropIns'>;
type Catalog = Pick<SiteContent, 'findSession'> & { site: Site };
type EnrollmentStatus = (typeof enrollment.$inferSelect)['status'];

// ───────────── Which classes, which dates ─────────────

/**
 * What one class costs as a drop-in, in cents, or null when this class takes
 * no drop-ins: not a weekly class, drop-ins switched off on the site or for
 * this class, registration elsewhere, or not open yet / closed by staff.
 */
export function dropInPrice(site: Site, program: Program, session: Session): number | null {
  if (!site.dropIns.open || !isWeeklyTuitionClass(program, session) || session.dropIn?.off) return null;
  if (session.externalUrl && !session.externalUrl.includes('docs.google.com')) return null;
  if (session.status === 'coming-soon' || session.status === 'closed') return null;
  const own = session.dropIn?.price;
  if (typeof own === 'number' && Number.isFinite(own) && own > 0) return Math.round(own * 100);
  return site.dropIns.priceCents > 0 ? site.dropIns.priceCents : null;
}

const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** The class's meetings still ahead: today's only until the class starts. `now` is Athens time, "YYYY-MM-DDTHH:MM". */
export function upcomingMeetings(session: Pick<Session, 'days' | 'startDate' | 'endDate' | 'start'>, now: string) {
  const today = now.slice(0, 10);
  const time = now.slice(11, 16);
  return meetings(session).filter((d) => d > today || (d === today && !!session.start && time < session.start));
}

/** "Drop in for one class": a weekly class taking drop-ins that has started, or starts within 14 days, and has a class ahead. */
export function dropInsOffered(site: Site, program: Program, session: Session, now = athensNow()) {
  if (dropInPrice(site, program, session) === null) return false;
  if (session.startDate > addDays(now.slice(0, 10), DROP_IN_LEAD_DAYS)) return false;
  return upcomingMeetings(session, now).length > 0;
}

/** Every class a family can drop in to now, for the family account. */
export function dropInClasses(content: Pick<SiteContent, 'programs'> & { site: Site }, now = athensNow()) {
  return content.programs.flatMap((program) =>
    program.sessions
      .filter((session) => dropInsOffered(content.site, program, session, now))
      .map((session) => ({ program, session, priceCents: dropInPrice(content.site, program, session)! })),
  );
}

export type DateProblem = 'day-off' | 'full';

export interface DropInDate {
  date: string;
  /** "Tue, Oct 20" */
  label: string;
  problem: DateProblem | null;
  /** Places a drop-in could take that date; undefined when the class has no limit. */
  placesLeft: number | undefined;
}

/** "Tue, Oct 20" */
export const dropInDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
/** "Tuesday, October 20" */
export const dropInLongDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

/**
 * Pure: each date with what stops a drop-in that day. Full means the enrolled
 * and trial children plus the drop-ins booked for that date reach the limit.
 */
export function dropInDatesFrom(input: { dates: string[]; daysOff: Set<string>; enrolled: number; dropIns: Map<string, number>; capacity: number | undefined }): DropInDate[] {
  return input.dates.map((date) => {
    const placesLeft = input.capacity === undefined ? undefined : Math.max(0, input.capacity - input.enrolled - (input.dropIns.get(date) ?? 0));
    const problem: DateProblem | null = input.daysOff.has(date) ? 'day-off' : placesLeft === 0 ? 'full' : null;
    return { date, label: dropInDay(date), problem, placesLeft };
  });
}

/** The class's dates ahead, each with a day off or a full class marked. */
export async function dropInDates(program: Program, session: Session, now = athensNow()): Promise<DropInDate[]> {
  const dates = upcomingMeetings(session, now);
  if (!dates.length) return [];
  const [marked, enrolled, counts] = await Promise.all([classDates(session), takenSpots(session.id), dropInCounts(dates[0], dates[dates.length - 1], [session.id])]);
  return dropInDatesFrom({
    dates,
    daysOff: new Set(marked.filter((d) => d.dayOff).map((d) => d.date)),
    enrolled,
    dropIns: new Map(dates.map((d) => [d, counts.get(`${session.id} ${d}`) ?? 0])),
    capacity: capacityFor(program, session),
  });
}

/** Why this child can't drop in that day, or null: already in the class, or already booked that date. */
export function childProblem(c: { firstName: string }, program: Pick<Program, 'title'>, status: EnrollmentStatus | null | undefined, alreadyBooked: boolean) {
  if (status === 'active' || status === 'trial') return `${c.firstName} is already in ${program.title}.`;
  if (alreadyBooked) return `${c.firstName} already has a drop-in that day.`;
  return null;
}

/** The child's enrollment status in this class, and whether they already have a drop-in booked that date. */
async function childHere(sessionId: string, studentId: string, date: string, exceptId?: string) {
  const db = await getDb();
  const [e] = await db
    .select({ status: enrollment.status })
    .from(enrollment)
    .where(and(eq(enrollment.sessionId, sessionId), eq(enrollment.studentId, studentId), ne(enrollment.status, 'cancelled')));
  const booked = await db
    .select({ id: dropIn.id })
    .from(dropIn)
    .where(and(eq(dropIn.sessionId, sessionId), eq(dropIn.studentId, studentId), eq(dropIn.classDate, date), eq(dropIn.status, 'booked')));
  return { status: e?.status ?? null, booked: booked.some((b) => b.id !== exceptId) };
}

/** Students of this family already in this class (enrolled or trial): they can't drop in to it. */
export async function enrolledHere(householdId: string, sessionId: string) {
  const db = await getDb();
  const rows = await db
    .select({ studentId: enrollment.studentId })
    .from(enrollment)
    .where(and(eq(enrollment.householdId, householdId), eq(enrollment.sessionId, sessionId), inArray(enrollment.status, ['active', 'trial'])));
  return new Set(rows.map((r) => r.studentId));
}

const found = (catalog: Pick<SiteContent, 'findSession'>, sessionId: string) => {
  const f = catalog.findSession(sessionId);
  if (!f) throw new DropInError('That class wasn’t found.');
  return f;
};

/** The date, checked: one of the class's dates ahead, not a day off, and (unless `overFull`) not full. */
async function checkDate(program: Program, session: Session, date: string, now: string, overFull = false) {
  const d = (await dropInDates(program, session, now)).find((x) => x.date === date);
  if (!d) throw new DropInError('Pick one of the class’s dates ahead.');
  if (d.problem === 'day-off') throw new DropInError(`There’s no class on ${d.label}.`);
  if (d.problem === 'full' && !overFull) throw new DropInError(`${program.title} is full on ${d.label}.`);
  return d;
}

// ───────────── Booking and paying ─────────────

export type DropInRow = typeof dropIn.$inferSelect;

/** "Drop-in: Intro to Theater, Tue, Oct 20 (Ava)": the order's one line, and the line on the Stripe form. */
export const dropInLine = (title: string, date: string, firstName: string) => `Drop-in: ${title}, ${dropInDay(date)} (${firstName})`;

/** The order and its pending booking. Nothing is held until it's paid. */
async function createBooking(input: { householdId: string; sessionId: string; date: string; studentId: string; firstName: string; title: string; priceCents: number; userId: string }) {
  const db = await getDb();
  const [o] = await db
    .insert(order)
    .values({
      householdId: input.householdId,
      sessionId: input.sessionId,
      plan: 'drop_in',
      status: 'draft',
      studentIds: [input.studentId],
      lines: [{ kind: 'tuition', label: dropInLine(input.title, input.date, input.firstName), studentId: input.studentId, amountCents: input.priceCents }],
      subtotalCents: input.priceCents,
      discountCents: 0,
      totalCents: input.priceCents,
      createdByUserId: input.userId,
    })
    .returning();
  const [d] = await db
    .insert(dropIn)
    .values({ sessionId: input.sessionId, classDate: input.date, studentId: input.studentId, householdId: input.householdId, priceCents: input.priceCents, orderId: o.id, status: 'pending', createdBy: input.userId })
    .returning();
  return { order: o, dropIn: d };
}

/**
 * A family starts a drop-in: one child, one date. Checks the class takes
 * drop-ins, the date, and the child, then makes the order and a pending
 * booking. Throws a DropInError the page can show.
 */
export async function startDropIn(input: { householdId: string; userId: string; sessionId: string; date: string; studentId: string }, opts: { catalog?: Catalog; now?: Date } = {}) {
  const catalog = opts.catalog ?? (await getCatalog());
  const { program, session } = found(catalog, input.sessionId);
  const priceCents = dropInPrice(catalog.site, program, session);
  if (priceCents === null) throw new DropInError(`${program.title} doesn’t take drop-ins right now.`);
  const kid = await getStudent(input.householdId, input.studentId);
  if (!kid) throw new DropInError('Pick who’s coming.');
  await checkDate(program, session, input.date, athensNow(opts.now));
  const here = await childHere(session.id, kid.id, input.date);
  const problem = childProblem(kid, program, here.status, here.booked);
  if (problem) throw new DropInError(problem);
  return createBooking({ householdId: input.householdId, sessionId: session.id, date: input.date, studentId: kid.id, firstName: kid.firstName, title: program.title, priceCents, userId: input.userId });
}

/** One of this family's drop-in orders, with its booking and child. Null for anything else. */
export async function dropInOrder(householdId: string, orderId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ order, dropIn, student })
    .from(order)
    .innerJoin(dropIn, eq(dropIn.orderId, order.id))
    .innerJoin(student, eq(student.id, dropIn.studentId))
    .where(and(eq(order.id, orderId), eq(order.householdId, householdId), eq(order.plan, 'drop_in')));
  return row ?? null;
}

/**
 * Just before the payment form: the booking was not cancelled, the date is
 * still ahead, not a day off and not full, and the child isn't in the class or
 * booked that day already. Then the order is ready for payment. A payment
 * already made is honoured whatever the date's state (fulfillDropIn).
 */
export async function readyDropIn(householdId: string, orderId: string, opts: { catalog?: Catalog; now?: Date } = {}) {
  const b = await dropInOrder(householdId, orderId);
  if (!b) throw new DropInError('That drop-in wasn’t found.');
  if (b.order.status === 'paid') return b.order;
  if (b.dropIn.status === 'cancelled') throw new DropInError('This drop-in was cancelled. Ask us if you’d still like to come.');
  const catalog = opts.catalog ?? (await getCatalog());
  const { program, session } = found(catalog, b.order.sessionId);
  await checkDate(program, session, b.dropIn.classDate, athensNow(opts.now));
  const here = await childHere(session.id, b.student.id, b.dropIn.classDate, b.dropIn.id);
  const problem = childProblem(b.student, program, here.status, here.booked);
  if (problem) throw new DropInError(problem);
  const db = await getDb();
  const [ready] = await db
    .update(order)
    .set({ status: 'pending_payment', policyVersion: POLICY_VERSION })
    .where(and(eq(order.id, b.order.id), inArray(order.status, ['draft', 'pending_payment'])))
    .returning();
  return ready ?? b.order;
}

/**
 * Paid: the order is marked paid and its booking booked, once, whoever calls
 * first (fulfillOrder hands drop-in orders here, from the webhook or the
 * confirmation page). Booked even if the date filled up or staff cancelled the
 * pay link meanwhile: the money is taken. A second payment for a child already
 * booked that date is kept as cancelled, with PAID_TWICE, for staff to refund.
 */
export async function fulfillDropIn(o: typeof order.$inferSelect, userId: string | null, payment?: Payment) {
  const db = await getDb();
  // Read before the transaction: the embedded database has a single connection.
  const [row] = await db.select().from(dropIn).where(eq(dropIn.orderId, o.id));
  if (!row) throw new Error(`Order ${o.id} has no drop-in`);
  const twin = await db
    .select({ id: dropIn.id })
    .from(dropIn)
    .where(and(eq(dropIn.sessionId, row.sessionId), eq(dropIn.classDate, row.classDate), eq(dropIn.studentId, row.studentId), eq(dropIn.status, 'booked'), ne(dropIn.id, row.id)));
  const result = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(order)
      .set({ status: 'paid', paidAt: new Date(), stripeCheckoutSessionId: payment?.checkoutSessionId ?? o.stripeCheckoutSessionId })
      .where(and(eq(order.id, o.id), ne(order.status, 'paid')))
      .returning({ id: order.id });
    if (!claimed) return null;
    const booked = twin.length === 0;
    await tx
      .update(dropIn)
      .set(booked ? { status: 'booked', cancelledAt: null, cancelReason: null } : { status: 'cancelled', cancelledAt: new Date(), cancelReason: PAID_TWICE })
      .where(eq(dropIn.id, row.id));
    return { booked };
  });
  const [done] = await db.select().from(order).where(eq(order.id, o.id));
  if (!result) return done;
  await audit(userId, 'order.paid', 'order', o.id);
  await audit(userId, result.booked ? 'drop_in.booked' : 'drop_in.paid_twice', 'drop_in', row.id);
  if (result.booked) await sendDropInConfirmation(row.id).catch((e) => console.error('Drop-in confirmation email failed', e));
  return done;
}

/** What the confirmation page and email say: the class, the date and time, where, and how to arrive. */
export async function dropInDetails(dropInId: string, catalog?: Pick<SiteContent, 'findSession' | 'locationById'> & { site: Pick<SiteInfo, 'parking'> }) {
  const content = catalog ?? (await getCatalog());
  const db = await getDb();
  const [row] = await db.select({ dropIn, firstName: student.firstName }).from(dropIn).innerJoin(student, eq(student.id, dropIn.studentId)).where(eq(dropIn.id, dropInId));
  if (!row) return null;
  const f = content.findSession(row.dropIn.sessionId);
  if (!f) return null;
  const loc = content.locationById(f.session.locationId);
  return {
    dropIn: row.dropIn,
    firstName: row.firstName,
    program: f.program,
    session: f.session,
    day: dropInLongDay(row.dropIn.classDate),
    time: f.session.start && f.session.end ? timeRange(f.session.start, f.session.end) : '',
    location: loc ? { name: loc.name, address: loc.address.join(', ') } : null,
    arrival: arrivalLines(f.program, content.site.parking),
  };
}

/** The email to the family's parents once a drop-in is paid. */
export async function sendDropInConfirmation(dropInId: string) {
  const d = await dropInDetails(dropInId);
  if (!d) return;
  const email = dropInEmail({ firstName: d.firstName, classTitle: d.program.title, day: d.day, time: d.time, location: d.location, priceCents: d.dropIn.priceCents, arrival: d.arrival }, await emailWording('dropIn'));
  for (const g of await householdGuardians(d.dropIn.householdId)) {
    await sendEmail({ to: g.email, subject: email.subject, text: `${email.heading}\n\n${email.lines.join('\n\n')}`, html: emailHtml(email.heading, email.lines) });
  }
}

/**
 * Pure: the drop-in confirmation. Hannah's wording (Settings → Emails,
 * `dropIn`) changes the subject and the first line; who, when and where, what
 * was paid, how to arrive and the account link are always in it.
 */
export function dropInEmail(
  d: { firstName: string; classTitle: string; day: string; time: string; location: { name: string; address: string } | null; priceCents: number; arrival: string[] },
  wording: Wording | null,
): EmailParts & { lines: string[] } {
  const heading = 'Drop-in booked';
  const lines = [
    `${d.firstName} is booked to drop in to ${d.classTitle}.`,
    `${d.day}${d.time ? `, ${d.time}` : ''}${d.location ? ` at ${d.location.name}, ${d.location.address}` : ''}.`,
    d.priceCents > 0 ? `Paid today: ${formatCents(d.priceCents)}.` : '',
    ...d.arrival,
    `Your family account: ${config.siteUrl}/account`,
  ].filter(Boolean);
  const e = worded({ subject: `${heading}: ${d.classTitle} · Little Characters`, heading, lines }, wording, { child: d.firstName, class: d.classTitle, date: d.day }, [`Booked: ${d.firstName}, drop-in to ${d.classTitle}.`]);
  return { ...e, lines: e.lines as string[] };
}

/** A family's drop-ins (booked or cancelled; not unpaid ones), by date, for their account and their staff page. */
export async function familyDropIns(householdId: string, opts: { from?: string } = {}) {
  const db = await getDb();
  const rows = await db
    .select({
      id: dropIn.id,
      sessionId: dropIn.sessionId,
      date: dropIn.classDate,
      studentId: dropIn.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      status: dropIn.status,
      priceCents: dropIn.priceCents,
      orderId: dropIn.orderId,
      noChargeReason: dropIn.noChargeReason,
      cancelReason: dropIn.cancelReason,
      orderStatus: order.status,
    })
    .from(dropIn)
    .innerJoin(student, eq(student.id, dropIn.studentId))
    .leftJoin(order, eq(order.id, dropIn.orderId))
    .where(and(eq(dropIn.householdId, householdId), ne(dropIn.status, 'pending')))
    .orderBy(asc(dropIn.classDate), asc(dropIn.createdAt));
  return rows.filter((r) => !opts.from || r.date >= opts.from).map(({ orderStatus, ...r }) => ({ ...r, paid: orderStatus === 'paid' }));
}

// ───────────── Staff ─────────────

export interface StaffDropIn {
  id: string;
  date: string;
  studentId: string;
  householdId: string;
  child: string;
  firstName: string;
  family: string;
  status: DropInRow['status'];
  priceCents: number;
  orderId: string | null;
  /** The order was paid. */
  paid: boolean;
  noChargeReason: string | null;
  cancelReason: string | null;
  /** A pay link staff sent, not paid yet. */
  payLink: boolean;
  /** Booked beyond the class's limit for that date. */
  overLimit: boolean;
}

/**
 * Pure: the booked drop-ins beyond the class's limit, per date. `rows` in the
 * order they were booked: the earliest take the places left after the
 * enrolled children.
 */
export function overLimitIds(rows: { id: string; date: string; status: string }[], enrolled: number, capacity: number | undefined) {
  const over = new Set<string>();
  if (capacity === undefined) return over;
  const seen = new Map<string, number>();
  for (const r of rows) {
    if (r.status !== 'booked') continue;
    const n = (seen.get(r.date) ?? 0) + 1;
    seen.set(r.date, n);
    if (enrolled + n > capacity) over.add(r.id);
  }
  return over;
}

/**
 * A class's drop-ins for its page, oldest date first: booked, cancelled, and
 * pay links staff sent that aren't paid yet. A family's own unfinished
 * checkouts are left out (they hold nothing).
 */
export async function classDropIns(program: Program, session: Session): Promise<StaffDropIn[]> {
  const db = await getDb();
  // A pending row made by someone outside the family is a staff pay link.
  const byOutsider = sql<boolean>`${dropIn.createdBy} is not null and not exists (select 1 from ${householdMember} m where m.household_id = ${dropIn.householdId} and m.user_id = ${dropIn.createdBy})`;
  const rows = await db
    .select({
      id: dropIn.id,
      date: dropIn.classDate,
      studentId: dropIn.studentId,
      householdId: dropIn.householdId,
      firstName: student.firstName,
      lastName: student.lastName,
      family: household.name,
      status: dropIn.status,
      priceCents: dropIn.priceCents,
      orderId: dropIn.orderId,
      orderStatus: order.status,
      noChargeReason: dropIn.noChargeReason,
      cancelReason: dropIn.cancelReason,
      byOutsider,
    })
    .from(dropIn)
    .innerJoin(student, eq(student.id, dropIn.studentId))
    .innerJoin(household, eq(household.id, dropIn.householdId))
    .leftJoin(order, eq(order.id, dropIn.orderId))
    .where(and(eq(dropIn.sessionId, session.id), or(ne(dropIn.status, 'pending'), byOutsider)))
    // In the order they were booked: when paid, or when staff added one with no charge.
    .orderBy(asc(dropIn.classDate), sql`coalesce(${order.paidAt}, ${dropIn.createdAt})`);
  const over = overLimitIds(rows, await takenSpots(session.id), capacityFor(program, session));
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    studentId: r.studentId,
    householdId: r.householdId,
    child: `${r.firstName} ${r.lastName}`,
    firstName: r.firstName,
    family: r.family,
    status: r.status,
    priceCents: r.priceCents,
    orderId: r.orderId,
    paid: r.orderStatus === 'paid',
    noChargeReason: r.noChargeReason,
    cancelReason: r.cancelReason,
    payLink: r.status === 'pending',
    overLimit: over.has(r.id),
  }));
}

/** "Paid $25", "No charge: trade", "Pay link sent", "Cancelled: sick". */
export function dropInStatus(r: Pick<StaffDropIn, 'status' | 'priceCents' | 'paid' | 'noChargeReason' | 'cancelReason'>) {
  if (r.status === 'cancelled') return `Cancelled${r.cancelReason ? `: ${r.cancelReason}` : ''}${r.paid ? ` (paid ${formatCents(r.priceCents)})` : ''}`;
  if (r.status === 'pending') return `Pay link sent, ${formatCents(r.priceCents)} not paid yet`;
  if (r.noChargeReason !== null || r.priceCents === 0) return `No charge${r.noChargeReason ? `: ${r.noChargeReason}` : ''}`;
  return `Paid ${formatCents(r.priceCents)}`;
}

/** The Drop-ins download (CSV and PDF): no care details. Amounts are plain numbers so a spreadsheet can add them up. */
export function dropInTable(rows: StaffDropIn[]) {
  return {
    headers: ['Date', 'Child', 'Family', 'Status', 'Paid ($)', 'Over the limit'],
    rows: rows.map((r) => [
      r.date,
      r.child,
      r.family,
      dropInStatus(r),
      r.paid ? (r.priceCents / 100).toFixed(2) : r.status === 'booked' ? '0.00' : '',
      r.overLimit ? 'Yes' : '',
    ]),
  };
}

/**
 * The children dropping in to a class on one date, as roster entries with the
 * Drop-in badge and their care details (decrypted; logged as
 * `admin.roster.drop_ins` with the date, like a roster view).
 */
export async function dropInRoster(sessionId: string, date: string, viewerId: string, today = todayInAthens()): Promise<RosterChild[]> {
  const db = await getDb();
  const rows = await db
    .select({ dropIn, student, household })
    .from(dropIn)
    .innerJoin(student, eq(student.id, dropIn.studentId))
    .innerJoin(household, eq(household.id, dropIn.householdId))
    .where(and(eq(dropIn.sessionId, sessionId), eq(dropIn.classDate, date), eq(dropIn.status, 'booked')))
    .orderBy(asc(student.lastName), asc(student.firstName));
  if (!rows.length) return [];
  const householdIds = [...new Set(rows.map((r) => r.household.id))];
  const guardians = await db
    .select({ householdId: householdMember.householdId, name: user.name, email: user.email, phone: user.phone })
    .from(householdMember)
    .innerJoin(user, eq(user.id, householdMember.userId))
    .where(inArray(householdMember.householdId, householdIds))
    .orderBy(householdMember.createdAt);
  await audit(viewerId, 'admin.roster.drop_ins', 'session', sessionId, date);
  return rows.map(({ dropIn: d, student: s, household: h }) => {
    const notes = readStudentNotes(s);
    return {
      enrollmentId: '',
      dropInId: d.id,
      studentId: s.id,
      householdId: h.id,
      status: 'active',
      name: `${s.firstName} ${s.lastName}`,
      firstName: s.firstName,
      lastName: s.lastName,
      age: ageOn(s.birthdate),
      badges: childBadges(
        { hasAllergies: !!notes.allergies.trim(), hasMedicalNotes: !!notes.medicalNotes.trim(), hasPickupNote: !!s.pickupNotes?.trim(), photoConsent: s.photoConsent, firstEnrolledAt: null, trial: false, dropIn: true, birthdate: s.birthdate },
        today,
      ),
      parents: guardians.filter((g) => g.householdId === h.id).map((g) => ({ name: g.name, email: g.email, phone: g.phone })),
      family: h.name,
      allergies: notes.allergies.trim(),
      medicalNotes: notes.medicalNotes.trim(),
      pickupNotes: s.pickupNotes?.trim() ?? '',
      pickupPeople: h.pickupPeople ?? [],
      emergencyContacts: h.emergencyContacts ?? [],
      photoConsent: s.photoConsent,
      joinedAt: d.createdAt,
      offeredAt: null,
      offer: null,
      noChargeReason: d.noChargeReason,
    };
  });
}

/** The roster's date on the class page: the next class from today, else the last one. */
export function rosterDate(session: Pick<Session, 'days' | 'startDate' | 'endDate'>, today = todayInAthens()) {
  const all = meetings(session);
  return all.find((d) => d >= today) ?? all[all.length - 1] ?? null;
}

interface StaffAdd {
  sessionId: string;
  studentId: string;
  date: string;
  staffId: string;
}

/** The child, for a staff add: found, not in the class, not booked that day. */
async function staffChild(input: StaffAdd, program: Program) {
  const db = await getDb();
  const [k] = await db.select({ id: student.id, householdId: student.householdId, firstName: student.firstName }).from(student).where(eq(student.id, input.studentId));
  if (!k) throw new DropInError('That child wasn’t found.');
  const here = await childHere(input.sessionId, k.id, input.date);
  const problem = childProblem(k, program, here.status, here.booked);
  if (problem) throw new DropInError(problem);
  return k;
}

/**
 * Email the family a link to pay for one date. The booking stays pending, and
 * holds no place, until they pay. A full date or a day off is refused.
 * `token` is the form's one-time token, so a double click sends once.
 */
export async function sendDropInPayLink(input: StaffAdd & { token: string }, opts: { catalog?: Catalog; now?: Date } = {}) {
  const catalog = opts.catalog ?? (await getCatalog());
  const { program, session } = found(catalog, input.sessionId);
  const priceCents = dropInPrice(catalog.site, program, session);
  if (priceCents === null) throw new DropInError(`${program.title} doesn’t take drop-ins. Check Drop-ins in Site settings and on the class.`);
  const db = await getDb();
  const [already] = await db.select({ id: schema.message.id }).from(schema.message).where(eq(schema.message.id, input.token));
  if (already) return { duplicate: true, parents: 0 };
  const k = await staffChild(input, program);
  const d = await checkDate(program, session, input.date, athensNow(opts.now));
  const fam = await familyAudience(k.householdId);
  if (!fam?.parents.length) throw new DropInError(`The ${fam?.name ?? 'family'} have no parent email on file.`);
  const b = await createBooking({ householdId: k.householdId, sessionId: session.id, date: input.date, studentId: k.id, firstName: k.firstName, title: program.title, priceCents, userId: input.staffId });
  const url = new URL(`/drop-in/pay?order=${encodeURIComponent(b.order.id)}`, config.siteUrl).toString();
  const sent = await sendMessage({
    token: input.token,
    kind: 'family',
    subject: `Drop-in: ${program.title}, ${d.label}`,
    body: [
      `Here’s the link to pay for ${k.firstName}’s drop-in to ${program.title} on ${dropInLongDay(input.date)}${session.start && session.end ? `, ${timeRange(session.start, session.end)}` : ''}: ${formatCents(priceCents)}.`,
      url,
      'The place is booked once you pay.',
    ].join('\n\n'),
    footer: footerFor(),
    families: [fam],
    staffId: input.staffId,
  });
  if (!sent.duplicate) await audit(input.staffId, 'admin.drop_in.pay_link', 'drop_in', b.dropIn.id, input.date);
  return { duplicate: sent.duplicate, parents: fam.parents.length };
}

/**
 * Book a drop-in with no charge (a fresh sign-in, as for no-charge places):
 * booked at once, price 0, the reason kept, no order and no Stripe call. A full
 * date needs `overFull`; a day off is refused.
 */
export async function addDropInWithoutCharge(input: StaffAdd & { reason: string; overFull: boolean }, opts: { catalog?: Catalog; now?: Date } = {}) {
  const catalog = opts.catalog ?? (await getCatalog());
  const { program, session } = found(catalog, input.sessionId);
  if (!isWeeklyTuitionClass(program, session)) throw new DropInError('Drop-ins are for weekly classes.');
  let reason: string;
  try {
    reason = checkReason(input.reason);
  } catch (e) {
    throw new DropInError((e as Error).message);
  }
  const k = await staffChild(input, program);
  await checkDate(program, session, input.date, athensNow(opts.now), input.overFull);
  const db = await getDb();
  const [d] = await db
    .insert(dropIn)
    .values({ sessionId: session.id, classDate: input.date, studentId: k.id, householdId: k.householdId, priceCents: 0, status: 'booked', noChargeReason: reason, createdBy: input.staffId })
    .returning();
  await audit(input.staffId, 'admin.drop_in.add_no_charge', 'drop_in', d.id, `${input.date}: ${reason}`);
  return d;
}

/** Cancel a booked drop-in, or a pay link not paid yet. Nothing is refunded here. False when it changed meanwhile. */
export async function cancelDropIn(input: { dropInId: string; sessionId: string; staffId: string; reason: string }) {
  let reason: string;
  try {
    reason = checkReason(input.reason);
  } catch {
    throw new DropInError('Add a reason, like “sick” or “booked by mistake”.');
  }
  const db = await getDb();
  const [d] = await db
    .update(dropIn)
    .set({ status: 'cancelled', cancelledAt: new Date(), cancelReason: reason })
    .where(and(eq(dropIn.id, input.dropInId), eq(dropIn.sessionId, input.sessionId), inArray(dropIn.status, ['booked', 'pending'])))
    .returning({ id: dropIn.id, classDate: dropIn.classDate });
  if (!d) return false;
  await audit(input.staffId, 'admin.drop_in.cancel', 'drop_in', d.id, `${d.classDate}: ${reason}`);
  return true;
}

/** Booked drop-ins per class on one date, for Today's "8 of 12". */
export async function dropInsToday(date: string) {
  const counts = await dropInCounts(date, date);
  return new Map([...counts].map(([key, n]) => [key.split(' ')[0], n]));
}
