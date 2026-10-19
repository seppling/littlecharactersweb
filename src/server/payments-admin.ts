/**
 * The staff Payments pages (/admin/payments and /admin/payments/<order>):
 * what needs a person, what autopay charges next, who's on autopay, and what
 * came in. Reads only, plus "Send a pay link". Amounts, schedules and
 * charging stay in billing.ts; this file never changes what a family owes.
 *
 * The page and its downloads (payments.csv.ts, payments.pdf.ts) build their
 * rows with the same functions here, so they always agree.
 */
import type { APIContext } from 'astro';
import { and, asc, eq, gte, inArray, lt, max } from 'drizzle-orm';
import { getDb, schema } from './db';
import { addDays, billingOverview, sendPayLinkEmail, totalDue } from './billing';
import { csvResponse, pdfResponse } from './downloads';
import { audit } from './records';
import { requireFreshStaff } from './staff';
import { toCsv, type Cell } from '@/lib/csv';
import { formatCents, todayInAthens } from '@/lib/pricing';

const { installment, household, order, auditLog, user } = schema;

/** Audit actions this file writes or reads. */
export const PAY_LINK_SENT = 'installment.pay_link_sent';
const PAID_MANUALLY = 'installment.paid_manually';

/** Upcoming autopay on the page: the next billing day and the two months after it. Downloads: the next 90 days. */
export const UPCOMING_MONTHS = 2;
export const UPCOMING_DOWNLOAD_DAYS = 90;

/** Why a charge failed, in words for staff (billing.ts's failureReason is written to the family). */
const STAFF_REASON: Record<string, string> = {
  card_declined: 'Card declined',
  insufficient_funds: 'Not enough money on the card',
  expired_card: 'Card expired',
  incorrect_cvc: 'Card declined',
  processing_error: 'Card network error',
  authentication_required: 'The bank wants the parent to approve it',
  no_card: 'No card on file',
};
export const staffReason = (code: string | null) => STAFF_REASON[code ?? ''] ?? 'The charge didn’t go through';

/** "Tue, Dec 1" */
export const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
/** "Oct 19" in Athens, for a moment. */
export const dayOf = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
/** 9500 → "95.00", for the downloads' Amount ($) columns: a number a spreadsheet can add up. */
const dollars = (cents: number) => (cents / 100).toFixed(2);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

export function addMonths(iso: string, months: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

// ───────────── Needs attention ─────────────

export type AttentionItem = {
  id: string;
  orderId: string;
  householdId: string;
  family: string;
  sessionId: string;
  label: string;
  dueDate: string;
  status: 'failed' | 'processing';
  /** Tuition plus any late fee: what the family owes now. */
  amountCents: number;
  lateFeeCents: number;
  reason: string;
  attempts: number;
  retryOn: string | null;
  /** Failed with no more automatic tries: waiting for the family (or staff) to pay. */
  held: boolean;
  daysOverdue: number;
  /** The last time staff sent a pay link, or null. */
  payLinkSentAt: Date | null;
};

/** Failed charges and charges waiting for a manual payment (the same ones Today counts, from billingOverview), oldest first. */
export async function paymentsAttention(today = todayInAthens()): Promise<AttentionItem[]> {
  const { needsAttention } = await billingOverview(today);
  const sent = await lastPayLinks(needsAttention.map((r) => r.i.id));
  return needsAttention.map(({ i, family }) => ({
    id: i.id,
    orderId: i.orderId,
    householdId: i.householdId,
    family,
    sessionId: i.sessionId,
    label: i.label,
    dueDate: i.dueDate,
    status: i.status === 'processing' ? 'processing' : 'failed',
    amountCents: totalDue(i),
    lateFeeCents: i.lateFeeCents,
    reason: i.status === 'processing' ? 'Charging now' : staffReason(i.lastError),
    attempts: i.attempts,
    retryOn: i.retryOn,
    held: i.status === 'failed' && !i.retryOn,
    daysOverdue: Math.max(0, daysBetween(i.dueDate, today)),
    payLinkSentAt: sent.get(i.id) ?? null,
  }));
}

/** What happens next, in a few words: "Trying again Tue, Nov 4" or "Waiting for the family to pay". */
export const nextStep = (a: Pick<AttentionItem, 'status' | 'retryOn'>) =>
  a.status === 'processing' ? 'Finishes on its own' : a.retryOn ? `Trying again ${shortDate(a.retryOn)}` : 'Waiting for the family to pay';

async function lastPayLinks(installmentIds: string[]) {
  if (!installmentIds.length) return new Map<string, Date>();
  const db = await getDb();
  const rows = await db
    .select({ id: auditLog.entityId, at: max(auditLog.createdAt) })
    .from(auditLog)
    .where(and(eq(auditLog.action, PAY_LINK_SENT), inArray(auditLog.entityId, installmentIds)))
    .groupBy(auditLog.entityId);
  return new Map(rows.filter((r) => r.id && r.at).map((r) => [r.id!, new Date(r.at!)]));
}

/**
 * "Send a pay link": the same "pay now" email a failed charge sends, to the
 * same parents (sendPayLinkEmail), logged as PAY_LINK_SENT. Only for a charge
 * that failed. Returns how many parents it went to, or null when there's
 * nothing to pay.
 */
export async function sendPayLink(installmentId: string, staffUserId: string, today = todayInAthens()) {
  const db = await getDb();
  const [i] = await db
    .select()
    .from(installment)
    .where(and(eq(installment.id, installmentId), eq(installment.status, 'failed')));
  if (!i) return null;
  const sent = await sendPayLinkEmail(i, today);
  if (sent) await audit(staffUserId, PAY_LINK_SENT, 'installment', i.id);
  return sent;
}

// ───────────── Upcoming autopay ─────────────

export type UpcomingCharge = { id: string; orderId: string; householdId: string; family: string; sessionId: string; label: string; dueDate: string; amountCents: number };
export type UpcomingDay = { date: string; charges: UpcomingCharge[]; totalCents: number };

/** Scheduled charges due from `from` through `through`, by date, then family. */
export async function upcomingCharges(from: string, through: string): Promise<UpcomingCharge[]> {
  const db = await getDb();
  const rows = await db
    .select({ i: installment, family: household.name })
    .from(installment)
    .innerJoin(household, eq(household.id, installment.householdId))
    .where(and(eq(installment.status, 'scheduled'), gte(installment.dueDate, from), lt(installment.dueDate, addDays(through, 1))))
    .orderBy(asc(installment.dueDate), asc(household.name), asc(installment.label));
  return rows.map(({ i, family }) => ({ id: i.id, orderId: i.orderId, householdId: i.householdId, family, sessionId: i.sessionId, label: i.label, dueDate: i.dueDate, amountCents: totalDue(i) }));
}

export function byDate(charges: UpcomingCharge[]): UpcomingDay[] {
  const days = new Map<string, UpcomingDay>();
  for (const c of charges) {
    const d = days.get(c.dueDate) ?? { date: c.dueDate, charges: [], totalCents: 0 };
    d.charges.push(c);
    d.totalCents += c.amountCents;
    days.set(c.dueDate, d);
  }
  return [...days.values()];
}

/** The page's Upcoming autopay: the next billing day (as on Today) and the two months after it, grouped by date. */
export async function upcomingAutopay(today = todayInAthens()) {
  const { nextDue } = await billingOverview(today);
  if (!nextDue) return { nextDue: null, through: null, days: [] as UpcomingDay[] };
  const through = addMonths(nextDue, UPCOMING_MONTHS);
  return { nextDue, through, days: byDate(await upcomingCharges(nextDue, through)) };
}

// ───────────── Families on autopay ─────────────

export type AutopayFamily = { orderId: string; householdId: string; sessionId: string; family: string; remaining: number; adjusted: number; next: { dueDate: string; amountCents: number } | null };

/** Each family's class with monthly payments still to come, A to Z (the same rows as ordersWithUpcomingPayments, with the family's id and next charge). */
export async function autopayFamilies(): Promise<AutopayFamily[]> {
  const db = await getDb();
  const rows = await db
    .select({ i: installment, family: household.name })
    .from(installment)
    .innerJoin(household, eq(household.id, installment.householdId))
    .where(inArray(installment.status, ['scheduled', 'processing', 'failed']))
    .orderBy(asc(household.name), asc(installment.dueDate));
  const out = new Map<string, AutopayFamily>();
  for (const { i, family } of rows) {
    const e = out.get(i.orderId) ?? { orderId: i.orderId, householdId: i.householdId, sessionId: i.sessionId, family, remaining: 0, adjusted: 0, next: null };
    e.remaining++;
    if (i.amountCents !== i.baseAmountCents) e.adjusted++;
    if (!e.next && i.status === 'scheduled') e.next = { dueDate: i.dueDate, amountCents: totalDue(i) };
    out.set(i.orderId, e);
  }
  return [...out.values()];
}

// ───────────── Payments received ─────────────

export type ReceivedPayment = {
  key: string;
  paidAt: Date;
  householdId: string;
  family: string;
  sessionId: string;
  orderId: string;
  /** "November tuition: Maya, Intro to Theater" or "Sign-up (first month)". */
  what: string;
  amountCents: number;
  method: 'card' | 'staff';
  /** Who marked a cash or check payment. */
  markedBy: string | null;
};

const SIGN_UP: Record<string, string> = { monthly: 'Sign-up (first month)', full: 'Sign-up (paid in full)', once: 'Sign-up', trial: 'Sign-up', waitlist: 'Sign-up', drop_in: 'Drop-in' };

/** "2026-10" from ?month=, or this month. */
export function receivedMonth(param: string | null | undefined, today = todayInAthens()) {
  return param && /^\d{4}-(0[1-9]|1[0-2])$/.test(param) ? param : today.slice(0, 7);
}
export const shiftMonth = (month: string, by: number) => addMonths(`${month}-01`, by).slice(0, 7);
/** "October 2026" */
export const monthName = (month: string) => new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * What came in during a month (in Athens time), newest first: paid monthly
 * charges and one-time sign-up payments. Months a discount covered completely
 * charged nothing and aren't listed.
 */
export async function paymentsReceived(month: string): Promise<ReceivedPayment[]> {
  const db = await getDb();
  // A day either side covers the time zone; the exact month is checked below.
  const from = new Date(`${addDays(`${month}-01`, -1)}T00:00:00Z`);
  const until = new Date(`${addDays(`${shiftMonth(month, 1)}-01`, 1)}T00:00:00Z`);
  const inMonth = (d: Date | null): d is Date => !!d && todayInAthens(d).slice(0, 7) === month;

  const monthly = (
    await db
      .select({ i: installment, family: household.name })
      .from(installment)
      .innerJoin(household, eq(household.id, installment.householdId))
      .where(and(eq(installment.status, 'paid'), gte(installment.paidAt, from), lt(installment.paidAt, until)))
  ).filter((r) => inMonth(r.i.paidAt) && totalDue(r.i) > 0);
  const signUps = (
    await db
      .select({ o: order, family: household.name })
      .from(order)
      .innerJoin(household, eq(household.id, order.householdId))
      .where(and(eq(order.status, 'paid'), gte(order.paidAt, from), lt(order.paidAt, until)))
  ).filter((r) => inMonth(r.o.paidAt) && r.o.totalCents > 0);

  const manual = monthly.filter((r) => r.i.lastError === 'paid outside Stripe').map((r) => r.i.id);
  const markedBy = manual.length
    ? new Map(
        (
          await db
            .select({ id: auditLog.entityId, name: user.name, email: user.email })
            .from(auditLog)
            .leftJoin(user, eq(user.id, auditLog.userId))
            .where(and(eq(auditLog.action, PAID_MANUALLY), inArray(auditLog.entityId, manual)))
        ).map((r) => [r.id, r.name || r.email || 'staff']),
      )
    : new Map<string | null, string>();

  return [
    ...monthly.map(({ i, family }): ReceivedPayment => {
      const staff = i.lastError === 'paid outside Stripe';
      return {
        key: `i-${i.id}`,
        paidAt: i.paidAt!,
        householdId: i.householdId,
        family,
        sessionId: i.sessionId,
        orderId: i.orderId,
        what: i.label,
        amountCents: totalDue(i),
        method: staff ? 'staff' : 'card',
        markedBy: staff ? (markedBy.get(i.id) ?? 'staff') : null,
      };
    }),
    ...signUps.map(({ o, family }): ReceivedPayment => ({
      key: `o-${o.id}`,
      paidAt: o.paidAt!,
      householdId: o.householdId,
      family,
      sessionId: o.sessionId,
      orderId: o.id,
      what: SIGN_UP[o.plan] ?? 'Sign-up',
      amountCents: o.totalCents,
      method: 'card',
      markedBy: null,
    })),
  ].sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime() || a.key.localeCompare(b.key));
}

export const howPaid = (p: Pick<ReceivedPayment, 'method' | 'markedBy'>) => (p.method === 'card' ? 'Card' : `Cash or check, marked by ${p.markedBy ?? 'staff'}`);
export const sumCents = (rows: { amountCents: number }[]) => rows.reduce((a, r) => a + r.amountCents, 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// ───────────── Downloads ─────────────

type ClassTitle = (sessionId: string) => string;
type Table = { headers: string[]; rows: Cell[][] };

export function receivedTable(rows: ReceivedPayment[], classTitle: ClassTitle): Table {
  return {
    headers: ['Date', 'Family', 'Class', 'For', 'Amount ($)', 'How paid'],
    rows: rows.map((p) => [todayInAthens(p.paidAt), p.family, classTitle(p.sessionId), p.what, dollars(p.amountCents), howPaid(p)]),
  };
}

export function overdueTable(rows: AttentionItem[], classTitle: ClassTitle): Table {
  return {
    headers: ['Due', 'Family', 'Class', 'For', 'Amount ($)', 'Late fee ($)', 'Days overdue', 'What happened', 'Next', 'Pay link sent'],
    rows: rows.map((a) => [
      a.dueDate,
      a.family,
      classTitle(a.sessionId),
      a.label,
      dollars(a.amountCents),
      a.lateFeeCents ? dollars(a.lateFeeCents) : '',
      a.daysOverdue,
      a.reason,
      nextStep(a),
      a.payLinkSentAt ? todayInAthens(a.payLinkSentAt) : '',
    ]),
  };
}

export function upcomingTable(rows: UpcomingCharge[], classTitle: ClassTitle): Table {
  return {
    headers: ['Date', 'Family', 'Class', 'For', 'Amount ($)'],
    rows: rows.map((c) => [c.dueDate, c.family, classTitle(c.sessionId), c.label, dollars(c.amountCents)]),
  };
}

export type PaymentsList = 'received' | 'overdue' | 'upcoming';
/** /admin/payments.csv?show=failed → the Overdue List; ?show=upcoming → Upcoming Autopay; otherwise the Payments List for ?month=. */
export const listFor = (url: URL): PaymentsList => ({ failed: 'overdue', upcoming: 'upcoming' } as const)[url.searchParams.get('show') ?? ''] ?? 'received';

async function paymentsFile(list: PaymentsList, url: URL, classTitle: ClassTitle, today: string) {
  if (list === 'overdue') {
    const rows = await paymentsAttention(today);
    return { title: 'Overdue List', file: `overdue ${today}`, subtitle: `Failed or waiting to be paid · ${plural(rows.length, 'charge')} · ${formatCents(sumCents(rows))}`, table: overdueTable(rows, classTitle), weights: [0.9, 1.2, 1.3, 2, 0.8, 0.7, 0.7, 1.3, 1.2, 0.9] };
  }
  if (list === 'upcoming') {
    const through = addDays(today, UPCOMING_DOWNLOAD_DAYS);
    const rows = await upcomingCharges(today, through);
    return { title: 'Upcoming Autopay', file: `upcoming autopay ${today}`, subtitle: `${shortDate(today)} to ${shortDate(through)} · ${plural(rows.length, 'charge')} · ${formatCents(sumCents(rows))}`, table: upcomingTable(rows, classTitle), weights: [0.9, 1.3, 1.4, 2.4, 0.8] };
  }
  const month = receivedMonth(url.searchParams.get('month'), today);
  const rows = await paymentsReceived(month);
  return { title: 'Payments List', file: `payments ${month}`, subtitle: `${monthName(month)} · ${plural(rows.length, 'payment')} · ${formatCents(sumCents(rows))}`, table: receivedTable(rows, classTitle), weights: [0.9, 1.3, 1.4, 2.4, 0.8, 1.5] };
}

/** The whole download endpoint: a fresh sign-in, the rows, the audit entry, the file. */
export async function paymentsDownload(format: 'csv' | 'pdf', { locals, url }: Pick<APIContext, 'locals' | 'url'>) {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const list = listFor(url);
  const classTitle: ClassTitle = (id) => locals.content.findSession(id)?.program.title ?? id;
  const f = await paymentsFile(list, url, classTitle, todayInAthens());
  await audit(locals.user!.id, `admin.download.${format}`, 'list', `payments-${list}`);
  const name = `Little Characters ${f.file}.${format}`;
  if (format === 'csv') return csvResponse(name, toCsv(f.table.headers, f.table.rows));
  return pdfResponse(name, {
    title: f.title,
    subtitle: f.subtitle,
    columns: f.table.headers.map((header, i) => ({ header, weight: f.weights[i], align: /\(\$\)|Days/.test(header) ? 'right' : undefined })),
    rows: f.table.rows,
    orientation: 'landscape',
  });
}
