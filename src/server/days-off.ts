/**
 * Days off (docs/back-office.md → Calendar and days off): no class on a date,
 * for every class or chosen ones, and what that does to the month's payments.
 *
 *  - previewDayOff: before anything is saved, the classes meeting on those
 *    dates and how many children each; each family on the monthly plan with
 *    that month's payment and the amount lowered by one class; payments
 *    already paid ("give a credit"); families who paid up front or pay by the
 *    session (no change); drop-ins booked those dates; and the classes whose
 *    attendance was already taken, which refuse the day off.
 *  - addDayOff: saves the days off (one `closure` row per date, or per class
 *    and date), and, when Hannah chose "Lower that month's payments", one
 *    `billing_adjustment` per family and date, made through adjustments.ts and
 *    linked by `closure_id`. Then one email per family.
 *  - previewRemoval / removeDayOff: the payments that go back up; paid ones
 *    stay as they were.
 *
 * One class's worth: that month's payment before Hannah's own discounts
 * (`base_amount_cents`, which has the 15% family discount in it) ÷ the times
 * the class meets in that calendar month (all its weekdays, as pricing.ts
 * counts a first month), rounded up to the cent in the family's favor.
 * Prices and meetings() never change for a day off.
 *
 * Days added together (a range, or several classes) share `created_at`, and
 * the list shows and removes them as one.
 */
import { and, asc, eq, gte, inArray, isNull, like, lte, or } from 'drizzle-orm';
import type { SiteContent } from '@/content/site-content';
import type { Program, Session } from '@/content/types';
import { classDaysInMonth, formatCents, meetings, todayInAthens } from '@/lib/pricing';
import { checkInput, computeChanges, insertAdjustments, lockedReason, logSettled, reapply, type Adjustment, type AdjustmentInput, type StaffUser } from './adjustments';
import { dayOffFrom, type DayOff } from './class-day';
import { staffSession } from './classes';
import { getDb, schema } from './db';
import { config } from './env';
import { emailHtml, sendEmail } from './email';
import { audit, householdGuardians } from './records';
import { isOwner } from './staff';

const { attendance, billingAdjustment, closure, credit, dropIn, enrollment, household, installment, order, student, user } = schema;

type Installment = typeof installment.$inferSelect;
type Catalog = Pick<SiteContent, 'programs' | 'findSession'>;

export const DAY_OFF = {
  reasonMax: 80,
  /** The longest range at once: a month. */
  maxDays: 31,
};

export class DayOffError extends Error {}

export type PaymentsChoice = 'lower' | 'keep';

export interface DayOffRequest {
  from: string;
  to: string;
  /** Null: every class on those dates. */
  sessionIds: string[] | null;
  reason: string;
  /** Hannah's choice; required to save, not to preview. */
  payments: PaymentsChoice | null;
}

// ───────────── Dates and words ─────────────

const DAY = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export function datesBetween(from: string, to: string) {
  const out: string[] = [];
  for (let t = utc(from); t <= utc(to); t += DAY) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** "Nov 26" */
export const monthDay = (iso: string) => new Date(utc(iso)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
/** "Thu, Nov 26" */
export const weekdayDate = (iso: string) => new Date(utc(iso)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
/** "December" */
export const monthWord = (month: string) => new Date(utc(`${month}-01`)).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
/** "Nov 26", "Nov 23–27", "Nov 30–Dec 4" */
export function datesLabel(dates: string[]) {
  const sorted = [...dates].sort();
  if (!sorted.length) return '';
  const [a, b] = [sorted[0], sorted[sorted.length - 1]];
  if (a === b) return monthDay(a);
  if (sorted.length !== datesBetween(a, b).length) return sorted.map(monthDay).join(', ');
  return a.slice(0, 7) === b.slice(0, 7) ? `${monthDay(a)}–${Number(b.slice(8))}` : `${monthDay(a)}–${monthDay(b)}`;
}
/** What families read on a lowered payment: "Day off Nov 26 (Thanksgiving)". */
export const adjustmentReason = (date: string, reason: string) => `Day off ${monthDay(date)} (${reason})`;
/** What families read in a class's dates: "No class Nov 26 (Thanksgiving)". */
export const noClassLine = (d: Pick<DayOff, 'date' | 'reason'>) => `No class ${monthDay(d.date)} (${d.reason})`;

/** One class's worth of a month's payment, rounded up to the cent in the family's favor. */
export function oneClassCents(baseCents: number, session: Pick<Session, 'days'>, month: string) {
  const n = classDaysInMonth(session, month);
  return n > 0 ? Math.ceil(Math.max(0, baseCents) / n) : 0;
}

/** Read the form (or the preview's address). Errors are for Hannah. */
export function readDayOffRequest(get: (k: string) => string | null, all: (k: string) => string[]): { request: DayOffRequest; error: string | null } {
  const from = (get('from') ?? '').trim();
  const to = (get('to') ?? '').trim() || from;
  const every = get('which') !== 'some';
  const sessionIds = every ? null : [...new Set(all('class').filter(Boolean))];
  const reason = (get('reason') ?? '').trim().replace(/\s+/g, ' ');
  const p = get('payments');
  const request: DayOffRequest = { from, to, sessionIds, reason, payments: p === 'lower' || p === 'keep' ? p : null };
  const error = !isoDate.test(from) || !isoDate.test(to) || Number.isNaN(utc(from)) || Number.isNaN(utc(to))
    ? 'Pick a date.'
    : to < from
      ? 'The last day is before the first day.'
      : datesBetween(from, to).length > DAY_OFF.maxDays
        ? `Pick ${DAY_OFF.maxDays} days or fewer at a time.`
        : sessionIds && !sessionIds.length
          ? 'Pick at least one class, or choose every class.'
          : !reason
            ? 'Write a reason, like “Thanksgiving” or “Snow day”. Families see it.'
            : reason.length > DAY_OFF.reasonMax
              ? `Keep the reason under ${DAY_OFF.reasonMax} characters.`
              : null;
  return { request, error };
}

/** The request as an address query, for the preview step and the fresh sign-in's way back. */
export function requestQuery(r: DayOffRequest) {
  const q = new URLSearchParams({ step: 'check', from: r.from, to: r.to, which: r.sessionIds ? 'some' : 'all', reason: r.reason });
  for (const id of r.sessionIds ?? []) q.append('class', id);
  return q.toString();
}

// ───────────── The plan (pure) ─────────────

export interface PlanClass {
  sessionId: string;
  title: string;
  date: string;
  /** Enrolled and trial children. */
  children: number;
  /** Why this class can't have the day off (attendance taken). */
  refused: string | null;
}

/** One family's monthly payment that a day off lowers. */
export interface PlanLowered {
  orderId: string;
  householdId: string;
  family: string;
  sessionId: string;
  title: string;
  children: string[];
  installmentId: string;
  month: string;
  dueDate: string;
  /** Each date off in that month, and one class's worth for it. */
  dates: { date: string; cents: number }[];
  beforeCents: number;
  afterCents: number;
  /** Locked for now (the family has the pay-now form open): it changes a little later. */
  later: boolean;
}

/** A family whose class is off, with nothing to change automatically. */
export interface PlanOther {
  householdId: string;
  family: string;
  sessionId: string;
  title: string;
  children: string[];
  date: string;
  orderId: string | null;
  /** For "already paid": one class's worth, when it's known. */
  cents: number | null;
  why: string;
}

export interface DayOffPlan {
  dates: string[];
  everyClass: boolean;
  classes: PlanClass[];
  /** Classes and dates that already have a day off (left as they are). */
  alreadyOff: { sessionId: string; title: string; date: string; reason: string }[];
  lowered: PlanLowered[];
  alreadyPaid: PlanOther[];
  noChange: PlanOther[];
  dropIns: { householdId: string; family: string; sessionId: string; title: string; date: string; child: string }[];
  /** Why it can't be saved as asked. */
  blockers: string[];
}

export interface PlanData {
  dates: string[];
  everyClass: boolean;
  sessions: { program: Program; session: Session }[];
  existing: DayOff[];
  /** `${sessionId} ${date}` with attendance taken. */
  attendance: Set<string>;
  enrollments: { sessionId: string; householdId: string; firstName: string; status: 'active' | 'trial'; orderId: string | null }[];
  orders: { id: string; householdId: string; plan: string; status: string; paidAt: Date | null }[];
  installments: Installment[];
  adjustments: Adjustment[];
  families: Map<string, string>;
  dropIns: { householdId: string; sessionId: string; date: string; child: string }[];
  now: Date;
}

const byName = <T extends { family: string; title: string }>(a: T, b: T) => a.family.localeCompare(b.family) || a.title.localeCompare(b.title);

/** Everything a day off would do, from plain data. */
export function planDayOff(d: PlanData): DayOffPlan {
  const titleOf = (sid: string) => d.sessions.find((s) => s.session.id === sid)?.program.title ?? sid;
  const classes: PlanClass[] = [];
  const alreadyOff: DayOffPlan['alreadyOff'] = [];
  const pairs: { sessionId: string; date: string; session: Session }[] = [];
  for (const date of d.dates) {
    for (const { program, session } of d.sessions) {
      if (!meetings(session).includes(date)) continue;
      const off = dayOffFrom(d.existing, session.id, date);
      if (off) {
        alreadyOff.push({ sessionId: session.id, title: program.title, date, reason: off.reason });
        continue;
      }
      const kids = d.enrollments.filter((e) => e.sessionId === session.id);
      const refused = d.attendance.has(`${session.id} ${date}`) ? `Attendance was already taken for ${program.title} on ${monthDay(date)}.` : null;
      classes.push({ sessionId: session.id, title: program.title, date, children: kids.length, refused });
      pairs.push({ sessionId: session.id, date, session });
    }
  }

  const blockers: string[] = [];
  const refused = classes.filter((c) => c.refused);
  if (refused.length) {
    blockers.push(
      ...refused.map((c) => `${c.refused} A class that met can’t have a day off.${d.everyClass ? ' Choose the classes instead, and leave it out.' : ' Untick it to go on.'}`),
    );
  }
  if (d.everyClass && d.dates.every((date) => d.existing.some((e) => e.date === date && e.sessionId === null))) {
    blockers.push(`There’s already a day off for every class on ${datesLabel(d.dates)}.`);
  } else if (!d.everyClass && !pairs.length) {
    blockers.push(alreadyOff.length ? 'Those classes already have a day off on those dates.' : 'None of those classes meet on those dates.');
  }

  const orders = new Map(d.orders.map((o) => [o.id, o]));
  const lowered = new Map<string, PlanLowered>();
  const alreadyPaid: PlanOther[] = [];
  const noChange: PlanOther[] = [];
  for (const p of pairs) {
    const month = p.date.slice(0, 7);
    // One entry per family and order: an order can cover two children in the class.
    const groups = new Map<string, { householdId: string; orderId: string | null; children: string[] }>();
    for (const e of d.enrollments.filter((x) => x.sessionId === p.sessionId)) {
      const key = e.orderId ?? `none ${e.householdId}`;
      const g = groups.get(key) ?? { householdId: e.householdId, orderId: e.orderId, children: [] };
      g.children.push(e.firstName);
      groups.set(key, g);
    }
    for (const g of groups.values()) {
      const base = { householdId: g.householdId, family: d.families.get(g.householdId) ?? 'Family', sessionId: p.sessionId, title: titleOf(p.sessionId), children: g.children, date: p.date, orderId: g.orderId };
      const o = g.orderId ? orders.get(g.orderId) : undefined;
      if (!o) {
        noChange.push({ ...base, cents: null, why: 'No charge' });
        continue;
      }
      if (o.plan === 'trial') noChange.push({ ...base, cents: null, why: 'Free first class' });
      else if (o.plan === 'full') noChange.push({ ...base, cents: null, why: 'Paid the season up front' });
      else if (o.plan !== 'monthly') noChange.push({ ...base, cents: null, why: 'Pays by the session' });
      else {
        const inst = d.installments.find((i) => i.orderId === o.id && i.dueDate.slice(0, 7) === month);
        const cents = inst ? oneClassCents(inst.baseAmountCents, p.session, month) : null;
        if (!inst) alreadyPaid.push({ ...base, cents, why: `Paid at sign-up (first month)` });
        else if (inst.status === 'paid') alreadyPaid.push({ ...base, cents, why: `${monthWord(month)} is paid` });
        else if (inst.status === 'processing') alreadyPaid.push({ ...base, cents, why: `${monthWord(month)} is being charged right now` });
        else if (inst.status === 'cancelled') noChange.push({ ...base, cents: null, why: 'Payments stopped' });
        else if (cents) {
          const l = lowered.get(inst.id) ?? {
            orderId: o.id,
            householdId: g.householdId,
            family: base.family,
            sessionId: p.sessionId,
            title: base.title,
            children: g.children,
            installmentId: inst.id,
            month,
            dueDate: inst.dueDate,
            dates: [],
            beforeCents: inst.amountCents,
            afterCents: inst.amountCents,
            later: false,
          };
          l.dates.push({ date: p.date, cents });
          lowered.set(inst.id, l);
        }
      }
    }
  }

  // The new amounts, applied as the adjustments would be (after the ones already there).
  for (const l of lowered.values()) {
    const rows = d.installments.filter((i) => i.orderId === l.orderId);
    const existing = d.adjustments.filter((a) => a.orderId === l.orderId);
    const drafts = l.dates.map((x, n) => draftLike(rows[0], existing, l, x, n, d.now));
    const target = rows.find((i) => i.id === l.installmentId)!;
    l.later = !!lockedReason(target, d.now);
    const change = computeChanges([{ ...target, payNowOpenedAt: null }], [...existing, ...drafts], d.now)[0];
    l.afterCents = change ? change.afterCents : target.amountCents;
  }

  return {
    dates: d.dates,
    everyClass: d.everyClass,
    classes,
    alreadyOff,
    lowered: [...lowered.values()].sort(byName),
    alreadyPaid: alreadyPaid.sort(byName),
    noChange: noChange.sort(byName),
    dropIns: d.dropIns
      .filter((x) => pairs.some((p) => p.sessionId === x.sessionId && p.date === x.date))
      .map((x) => ({ ...x, family: d.families.get(x.householdId) ?? 'Family', title: titleOf(x.sessionId) }))
      .sort(byName),
    blockers,
  };
}

/** A day-off adjustment as it would be saved, for the preview's math. */
function draftLike(first: Installment, existing: Adjustment[], l: PlanLowered, x: { date: string; cents: number }, n: number, now: Date): Adjustment {
  const after = Math.max(now.getTime(), ...existing.map((a) => a.createdAt.getTime() + 1));
  return {
    id: `preview-${l.installmentId}-${n}`,
    householdId: first.householdId,
    orderId: l.orderId,
    kind: 'amount',
    value: x.cents,
    repeat: 'once',
    installmentId: l.installmentId,
    reason: x.date,
    showToFamily: true,
    createdBy: null,
    createdAt: new Date(after + n),
    removedAt: null,
    removedBy: null,
    closureId: null,
  };
}

// ───────────── Loading ─────────────

function sessionsFor(catalog: Catalog, sessionIds: string[] | null) {
  const all = catalog.programs.flatMap((program) => program.sessions.filter(staffSession).map((session) => ({ program, session })));
  return sessionIds ? all.filter((s) => sessionIds.includes(s.session.id)) : all;
}

type Q = Awaited<ReturnType<typeof getDb>> | Parameters<Parameters<Awaited<ReturnType<typeof getDb>>['transaction']>[0]>[0];

async function loadPlan(q: Q, catalog: Catalog, r: DayOffRequest, now: Date): Promise<DayOffPlan> {
  const dates = datesBetween(r.from, r.to);
  const sessions = sessionsFor(catalog, r.sessionIds);
  const ids = sessions.map((s) => s.session.id);
  const existing = await q
    .select({ id: closure.id, date: closure.date, sessionId: closure.sessionId, reason: closure.reason })
    .from(closure)
    .where(and(gte(closure.date, r.from), lte(closure.date, r.to)));
  if (!ids.length) {
    return planDayOff({ dates, everyClass: r.sessionIds === null, sessions, existing, attendance: new Set(), enrollments: [], orders: [], installments: [], adjustments: [], families: new Map(), dropIns: [], now });
  }
  const [taken, enrolled, booked] = await Promise.all([
    q
      .selectDistinct({ sessionId: attendance.sessionId, date: attendance.classDate })
      .from(attendance)
      .where(and(inArray(attendance.sessionId, ids), gte(attendance.classDate, r.from), lte(attendance.classDate, r.to))),
    q
      .select({ sessionId: enrollment.sessionId, householdId: enrollment.householdId, firstName: student.firstName, status: enrollment.status, orderId: enrollment.orderId })
      .from(enrollment)
      .innerJoin(student, eq(student.id, enrollment.studentId))
      .where(and(inArray(enrollment.sessionId, ids), inArray(enrollment.status, ['active', 'trial'])))
      .orderBy(asc(student.firstName)),
    q
      .select({ householdId: dropIn.householdId, sessionId: dropIn.sessionId, date: dropIn.classDate, child: student.firstName })
      .from(dropIn)
      .innerJoin(student, eq(student.id, dropIn.studentId))
      .where(and(inArray(dropIn.sessionId, ids), eq(dropIn.status, 'booked'), gte(dropIn.classDate, r.from), lte(dropIn.classDate, r.to))),
  ]);
  const orderIds = [...new Set(enrolled.map((e) => e.orderId).filter((x): x is string => !!x))];
  const [orders, installments, adjustments] = orderIds.length
    ? await Promise.all([
        q.select({ id: order.id, householdId: order.householdId, plan: order.plan, status: order.status, paidAt: order.paidAt }).from(order).where(inArray(order.id, orderIds)),
        q.select().from(installment).where(inArray(installment.orderId, orderIds)).orderBy(asc(installment.dueDate)),
        q.select().from(billingAdjustment).where(inArray(billingAdjustment.orderId, orderIds)),
      ])
    : [[], [], []];
  const householdIds = [...new Set([...enrolled.map((e) => e.householdId), ...booked.map((b) => b.householdId)])];
  const families = new Map(
    householdIds.length ? (await q.select({ id: household.id, name: household.name }).from(household).where(inArray(household.id, householdIds))).map((h) => [h.id, h.name]) : [],
  );
  return planDayOff({
    dates,
    everyClass: r.sessionIds === null,
    sessions,
    existing,
    attendance: new Set(taken.map((t) => `${t.sessionId} ${t.date}`)),
    enrollments: enrolled.map((e) => ({ ...e, status: e.status as 'active' | 'trial' })),
    orders: orders.filter((o) => o.status === 'paid'),
    installments,
    adjustments,
    families,
    dropIns: booked,
    now,
  });
}

async function requireOwner(staff: StaffUser | null | undefined) {
  if (!(await isOwner(staff))) throw new DayOffError('Only owners can change days off.');
}

/** What a day off would do, without saving anything. */
export async function previewDayOff(staff: StaffUser, catalog: Catalog, r: DayOffRequest, now = new Date()) {
  await requireOwner(staff);
  return loadPlan(await getDb(), catalog, r, now);
}

// ───────────── Saving ─────────────

export interface DayOffResult {
  closureIds: string[];
  plan: DayOffPlan;
  /** Payments lowered (0 for "Don't change payments"). */
  lowered: number;
  emailed: number;
}

/**
 * Save a day off. The plan is worked out again inside the transaction, so it
 * acts on the payments as they are now. Refused when a class's attendance was
 * taken, and when Hannah hasn't chosen what to do about payments.
 */
export async function addDayOff(staff: StaffUser, catalog: Catalog, r: DayOffRequest, now = new Date(), today = todayInAthens(now)): Promise<DayOffResult> {
  await requireOwner(staff);
  if (!r.payments) throw new DayOffError('Choose what happens to the monthly payments.');
  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const plan = await loadPlan(tx, catalog, r, now);
    if (plan.blockers.length) throw new DayOffError(plan.blockers[0]);
    const adjusted = r.payments === 'lower' ? { adjustedAt: now, adjustedBy: staff.id } : {};
    const base = { reason: r.reason, createdBy: staff.id, createdAt: now, ...adjusted };
    const rows = plan.everyClass
      ? plan.dates.map((date) => ({ ...base, date, sessionId: null }))
      : plan.classes.map((c) => ({ ...base, date: c.date, sessionId: c.sessionId }));
    // An every-class day off already there for a date is kept as it is.
    const existingAll = new Set(
      (await tx.select({ date: closure.date }).from(closure).where(and(isNull(closure.sessionId), gte(closure.date, r.from), lte(closure.date, r.to)))).map((x) => x.date),
    );
    const inserted = await tx
      .insert(closure)
      .values(rows.filter((x) => x.sessionId !== null || !existingAll.has(x.date)))
      .returning();
    const closureFor = (sessionId: string, date: string) => inserted.find((c) => c.date === date && (c.sessionId === sessionId || c.sessionId === null))!;

    const adjustmentIds: string[] = [];
    const settled: string[] = [];
    if (r.payments === 'lower') {
      const byOrder = new Map<string, AdjustmentInput[]>();
      for (const l of plan.lowered) {
        for (const x of l.dates) {
          const input = checkInput({
            orderId: l.orderId,
            kind: 'amount',
            value: x.cents,
            repeat: 'once',
            reason: adjustmentReason(x.date, r.reason),
            showToFamily: true,
            installmentId: l.installmentId,
            closureId: closureFor(l.sessionId, x.date).id,
          });
          byOrder.set(l.orderId, [...(byOrder.get(l.orderId) ?? []), input]);
        }
      }
      for (const inputs of byOrder.values()) {
        const saved = await insertAdjustments(tx, staff, inputs, now);
        adjustmentIds.push(...saved.adjustments.map((a) => a.id));
        settled.push(...saved.settled);
      }
    }
    return { plan, inserted, adjustmentIds, settled };
  });

  for (const c of result.inserted) await audit(staff.id, 'admin.day_off.add', 'closure', c.id, `${c.date} ${c.sessionId ?? 'every class'}: ${r.payments === 'lower' ? 'payments lowered' : 'payments not changed'}`);
  for (const id of result.adjustmentIds) await audit(staff.id, 'adjustment.add', 'billing_adjustment', id, 'day off');
  await logSettled(staff.id, result.settled);
  // The record of payments already made, until credits arrive: one entry per family's order and date.
  for (const p of result.plan.alreadyPaid) {
    const c = result.inserted.find((x) => x.date === p.date && (x.sessionId === p.sessionId || x.sessionId === null));
    if (c && p.orderId) await audit(staff.id, 'admin.day_off.credit_due', 'order', p.orderId, c.id);
  }
  const emailed = await emailFamilies(result.plan, r, today);
  return { closureIds: result.inserted.map((c) => c.id), plan: result.plan, lowered: r.payments === 'lower' ? result.plan.lowered.length : 0, emailed };
}

// ───────────── Email ─────────────

export interface FamilyNotice {
  householdId: string;
  subject: string;
  heading: string;
  lines: string[];
}

const names = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Pure: one short email per family. Lowered payments list each child, class, date and the new amount; everyone else hears "No class". */
export function familyNotices(plan: DayOffPlan, r: Pick<DayOffRequest, 'reason' | 'payments'>, today: string, accountUrl: string): FamilyNotice[] {
  const lowered = r.payments === 'lower' ? plan.lowered : [];
  const others = [...(r.payments === 'lower' ? [] : plan.lowered.flatMap((l) => l.dates.map((x) => ({ householdId: l.householdId, title: l.title, children: l.children, date: x.date })))), ...plan.alreadyPaid, ...plan.noChange, ...plan.dropIns.map((x) => ({ ...x, children: [x.child] }))];
  const households = [...new Set([...lowered.map((l) => l.householdId), ...others.map((o) => o.householdId)])];
  const out: FamilyNotice[] = [];
  for (const h of households) {
    const mine = lowered.filter((l) => l.householdId === h);
    const off = [
      ...mine.flatMap((l) => l.dates.map((x) => ({ title: l.title, children: l.children, date: x.date }))),
      ...others.filter((o) => o.householdId === h),
    ].filter((x) => x.date >= today);
    if (!off.length) continue;
    const dates = [...new Set(off.map((x) => x.date))];
    const heading = `No class ${datesLabel(dates)}`;
    const classLines = [...new Map(off.map((x) => [`${x.title} ${x.date} ${x.children.join()}`, `${names(x.children)}, ${x.title}: no class ${weekdayDate(x.date)} (${r.reason}).`])).values()];
    const payLines = mine
      .filter((l) => l.dates.some((x) => x.date >= today))
      .map((l) => `${names(l.children)}, ${l.title}: your ${monthWord(l.month)} payment is now ${formatCents(l.afterCents)} (was ${formatCents(l.beforeCents)}), one class less for ${l.dates.map((x) => monthDay(x.date)).join(' and ')}.`);
    out.push({
      householdId: h,
      subject: `${heading} · Little Characters`,
      heading,
      lines: [
        ...classLines,
        ...payLines,
        ...(payLines.length ? ['The new amount is charged to your saved card on the 1st, as usual.'] : []),
        `Your classes and payments are in your family account: ${accountUrl}`,
        'Questions? Just reply to this email.',
      ],
    });
  }
  return out;
}

async function emailFamilies(plan: DayOffPlan, r: DayOffRequest, today: string) {
  const notices = familyNotices(plan, r, today, new URL('/account', config.siteUrl).toString());
  let sent = 0;
  for (const n of notices) {
    const to = (await householdGuardians(n.householdId)).map((g) => g.email);
    if (!to.length) continue;
    await sendEmail({ to, subject: n.subject, text: `${n.heading}\n\n${n.lines.join('\n\n')}`, html: emailHtml(n.heading, n.lines) });
    await audit(null, 'admin.day_off.email', 'household', n.householdId);
    sent++;
  }
  return sent;
}

// ───────────── The list, and removing ─────────────

export interface DayOffGroup {
  /** The first row's id: the group's address. */
  id: string;
  ids: string[];
  dates: string[];
  /** Null: every class. */
  sessionIds: string[] | null;
  classes: string;
  reason: string;
  lowered: boolean;
  createdAt: Date;
  createdBy: string;
  /** Adjustments still in force: how many, and how much in all. */
  adjustments: { count: number; cents: number; families: { orderId: string; householdId: string; family: string; month: string; date: string; cents: number; paid: boolean }[] };
  /** Families who had paid already when it was added (the record until credits arrive). */
  creditsDue: { orderId: string; householdId: string; family: string }[];
}

/** Every day off, grouped as added, newest dates first within upcoming and past. */
export async function daysOffList(catalog: Pick<SiteContent, 'findSession'>, today = todayInAthens()) {
  const db = await getDb();
  const rows = await db.select().from(closure).orderBy(asc(closure.date));
  const ids = rows.map((r) => r.id);
  const adjustments = ids.length
    ? await db
        .select({ a: billingAdjustment, family: household.name, status: installment.status, dueDate: installment.dueDate })
        .from(billingAdjustment)
        .innerJoin(household, eq(household.id, billingAdjustment.householdId))
        .leftJoin(installment, eq(installment.id, billingAdjustment.installmentId))
        .where(and(inArray(billingAdjustment.closureId, ids), isNull(billingAdjustment.removedAt)))
    : [];
  const credits = ids.length
    ? await db
        .select({ closureId: schema.auditLog.detail, orderId: schema.auditLog.entityId, householdId: order.householdId, family: household.name })
        .from(schema.auditLog)
        .innerJoin(order, eq(order.id, schema.auditLog.entityId))
        .innerJoin(household, eq(household.id, order.householdId))
        .where(and(eq(schema.auditLog.action, 'admin.day_off.credit_due'), inArray(schema.auditLog.detail, ids)))
    : [];
  const people = [...new Set(rows.map((r) => r.createdBy).filter((x): x is string => !!x))];
  const who = new Map(people.length ? (await db.select({ id: user.id, name: user.name, email: user.email }).from(user).where(inArray(user.id, people))).map((u) => [u.id, u.name || u.email]) : []);
  const groups = new Map<number, typeof rows>();
  for (const r of rows) groups.set(r.createdAt.getTime(), [...(groups.get(r.createdAt.getTime()) ?? []), r]);
  const title = (sid: string) => catalog.findSession(sid)?.program.title ?? 'A class no longer on the site';
  const list: DayOffGroup[] = [...groups.values()].map((g) => {
    const gids = new Set(g.map((r) => r.id));
    const mine = adjustments.filter((x) => x.a.closureId && gids.has(x.a.closureId));
    const every = g.some((r) => r.sessionId === null);
    const sids = [...new Set(g.map((r) => r.sessionId).filter((x): x is string => !!x))];
    return {
      id: g[0].id,
      ids: g.map((r) => r.id),
      dates: [...new Set(g.map((r) => r.date))].sort(),
      sessionIds: every ? null : sids,
      classes: every ? 'Every class' : sids.map(title).join(', '),
      reason: g[0].reason,
      lowered: !!g[0].adjustedAt,
      createdAt: g[0].createdAt,
      createdBy: g[0].createdBy ? (who.get(g[0].createdBy) ?? 'staff') : 'staff',
      adjustments: {
        count: mine.length,
        cents: mine.reduce((s, x) => s + x.a.value, 0),
        families: mine
          .map((x) => ({ orderId: x.a.orderId, householdId: x.a.householdId, family: x.family, month: x.dueDate?.slice(0, 7) ?? '', date: g.find((r) => r.id === x.a.closureId)!.date, cents: x.a.value, paid: x.status === 'paid' }))
          .sort((a, b) => a.family.localeCompare(b.family) || a.date.localeCompare(b.date)),
      },
      creditsDue: [...new Map(credits.filter((c) => c.closureId && gids.has(c.closureId)).map((c) => [c.orderId!, { orderId: c.orderId!, householdId: c.householdId, family: c.family }])).values()],
    };
  });
  const last = (g: DayOffGroup) => g.dates[g.dates.length - 1];
  return {
    upcoming: list.filter((g) => last(g) >= today).sort((a, b) => a.dates[0].localeCompare(b.dates[0])),
    past: list.filter((g) => last(g) < today).sort((a, b) => b.dates[0].localeCompare(a.dates[0])),
  };
}

async function groupRows(q: Q, id: string) {
  const [one] = await q.select().from(closure).where(eq(closure.id, id));
  if (!one) return [];
  return q.select().from(closure).where(eq(closure.createdAt, one.createdAt));
}

export interface RemovalChange {
  orderId: string;
  householdId: string;
  family: string;
  installmentId: string;
  dueDate: string;
  beforeCents: number;
  afterCents: number;
}

/** What removing a day off (and the days added with it) does: the payments that go back up, and the paid ones that stay. */
async function removalPlan(q: Q, id: string, now: Date) {
  const rows = await groupRows(q, id);
  if (!rows.length) return null;
  const ids = rows.map((r) => r.id);
  const mine = await q.select().from(billingAdjustment).where(and(inArray(billingAdjustment.closureId, ids), isNull(billingAdjustment.removedAt)));
  const orderIds = [...new Set(mine.map((a) => a.orderId))];
  const [installments, all, families] = orderIds.length
    ? await Promise.all([
        q.select().from(installment).where(inArray(installment.orderId, orderIds)),
        q.select().from(billingAdjustment).where(inArray(billingAdjustment.orderId, orderIds)),
        q.select({ id: order.id, householdId: order.householdId, family: household.name }).from(order).innerJoin(household, eq(household.id, order.householdId)).where(inArray(order.id, orderIds)),
      ])
    : [[], [], []];
  const unpaid = (a: Adjustment) => ['scheduled', 'failed'].includes(installments.find((i) => i.id === a.installmentId)?.status ?? '');
  const removing = mine.filter(unpaid);
  const keeping = mine.filter((a) => !unpaid(a));
  const changes: RemovalChange[] = [];
  for (const orderId of orderIds) {
    const gone = new Set(removing.filter((a) => a.orderId === orderId).map((a) => a.id));
    if (!gone.size) continue;
    const rowsFor = installments.filter((i) => i.orderId === orderId).map((i) => ({ ...i, payNowOpenedAt: null }));
    const f = families.find((x) => x.id === orderId)!;
    // Only payments whose amount changes (computeChanges also lists ones whose stored lines are merely re-ordered).
    for (const c of computeChanges(rowsFor, all.filter((a) => a.orderId === orderId).map((a) => (gone.has(a.id) ? { ...a, removedAt: now } : a)), now).filter((c) => c.afterCents !== c.beforeCents)) {
      changes.push({ orderId, householdId: f.householdId, family: f.family, installmentId: c.installmentId, dueDate: c.dueDate, beforeCents: c.beforeCents, afterCents: c.afterCents });
    }
  }
  const paidStay = keeping.map((a) => ({ orderId: a.orderId, householdId: a.householdId, family: families.find((x) => x.id === a.orderId)?.family ?? 'Family', cents: a.value, reason: a.reason }));

  // "Give these credits" for these days (ids dayoff-<closure>-<family>, day-off-credits.ts): taken back unless already
  // on a payment that's paid (or being charged), like the day's own discounts.
  const credits = await q
    .select({ c: credit, family: household.name })
    .from(credit)
    .innerJoin(household, eq(household.id, credit.householdId))
    .where(and(or(...ids.map((id) => like(credit.id, `dayoff-${id}-%`))), isNull(credit.removedAt)));
  const onPayments = credits.some((x) => x.c.appliedToInstallmentId)
    ? await q.select({ id: installment.id, orderId: installment.orderId, status: installment.status }).from(installment).where(inArray(installment.id, credits.flatMap((x) => (x.c.appliedToInstallmentId ? [x.c.appliedToInstallmentId] : []))))
    : [];
  const paymentOf = (c: typeof credit.$inferSelect) => onPayments.find((i) => i.id === c.appliedToInstallmentId);
  const creditsBack = credits.filter((x) => !x.c.appliedAt || ['scheduled', 'failed'].includes(paymentOf(x.c)?.status ?? '')).map((x) => ({ ...x.c, family: x.family, orderId: paymentOf(x.c)?.orderId ?? null }));
  const creditsStay = credits.filter((x) => !creditsBack.some((b) => b.id === x.c.id)).map((x) => ({ ...x.c, family: x.family }));
  return { rows, removing, changes: changes.sort((a, b) => a.family.localeCompare(b.family)), paidStay, creditsBack, creditsStay };
}

export async function previewRemoval(staff: StaffUser, id: string, now = new Date()) {
  await requireOwner(staff);
  return removalPlan(await getDb(), id, now);
}

/**
 * Remove a day off (and the days added with it): its unpaid adjustments come
 * off and those payments go back up, and the credits given for it are taken
 * back (waiting ones, and ones on a payment not paid yet). Paid ones stay as they were.
 */
export async function removeDayOff(staff: StaffUser, id: string, now = new Date()) {
  await requireOwner(staff);
  const db = await getDb();
  const result = await db.transaction(async (tx) => {
    const plan = await removalPlan(tx, id, now);
    if (!plan) return null;
    const settled: string[] = [];
    if (plan.removing.length) {
      await tx
        .update(billingAdjustment)
        .set({ removedAt: now, removedBy: staff.id })
        .where(
          and(
            inArray(
              billingAdjustment.id,
              plan.removing.map((a) => a.id),
            ),
            isNull(billingAdjustment.removedAt),
          ),
        );
    }
    for (const c of plan.creditsBack) {
      if (c.adjustmentId) await tx.update(billingAdjustment).set({ removedAt: now, removedBy: staff.id }).where(and(eq(billingAdjustment.id, c.adjustmentId), isNull(billingAdjustment.removedAt)));
      await tx.update(credit).set({ removedAt: now, removedBy: staff.id }).where(and(eq(credit.id, c.id), isNull(credit.removedAt)));
    }
    const orderIds = new Set([...plan.removing.map((a) => a.orderId), ...plan.creditsBack.flatMap((c) => (c.orderId ? [c.orderId] : []))]);
    for (const orderId of orderIds) settled.push(...(await reapply(tx, orderId, now)).settled);
    await tx.delete(closure).where(
      inArray(
        closure.id,
        plan.rows.map((r) => r.id),
      ),
    );
    return { ...plan, settled };
  });
  if (!result) return null;
  for (const r of result.rows) await audit(staff.id, 'admin.day_off.remove', 'closure', r.id, `${r.date} ${r.sessionId ?? 'every class'}`);
  for (const a of result.removing) await audit(staff.id, 'adjustment.remove', 'billing_adjustment', a.id, 'day off removed');
  for (const c of result.creditsBack) await audit(staff.id, 'admin.credit.remove', 'credit', c.id, 'day off removed');
  await logSettled(staff.id, result.settled);
  return result;
}
