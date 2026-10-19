/**
 * Money reports (docs/back-office.md → Reports): what came in, what's booked,
 * who owes, charges, discounts, refunds and drop-ins. Reads only.
 *
 * Payments received and the autopay lists are Payments' own functions
 * (payments-admin.ts), so a report and the Payments page never disagree.
 * The season reports load every order, charge and refund once (a few hundred
 * families) and count them in the pure functions below.
 */
import { eq, inArray, isNotNull } from 'drizzle-orm';
import type { OrderLine } from '../db/schema';
import type { AppliedAdjustment } from '@/lib/adjustments';
import { billingOverview, totalDue } from '../billing';
import { getDb, schema } from '../db';
import { paymentsAttention, paymentsReceived, receivedCount, upcomingCharges, howPaid, type AttentionItem } from '../payments-admin';
import type { Baseline } from '../settings-store';
import * as links from '@/lib/admin-links';
import { todayInAthens } from '@/lib/pricing';
import {
  addDays,
  classTitle,
  dayShort,
  lastTwelve,
  money,
  monthName,
  monthShort,
  percent,
  plural,
  sessionPasses,
  shiftMonth,
  sum,
  termOf,
  type Content,
  type ReportContext,
  type ReportFilters,
  type ReportResult,
  type Row,
} from './common';

const { order, installment, refund, household, credit, billingAdjustment, dropIn } = schema;

// ───────────── Payments received (Payments' own list) ─────────────

/** Payments received in a month, less refunds: the Payments page's list for that month. */
export async function paymentsReceivedReport(ctx: ReportContext, f: ReportFilters): Promise<ReportResult> {
  const month = f.month ?? ctx.today.slice(0, 7);
  const lines = (await paymentsReceived(month)).filter((p) => sessionPasses(f, ctx.content.findSession(p.sessionId)));
  const net = sum(lines.map((p) => p.amountCents));
  return {
    columns: [{ label: 'Date', kind: 'date' }, { label: 'Family' }, { label: 'Class' }, { label: 'For' }, { label: 'Amount', kind: 'money' }, { label: 'How paid' }],
    rows: lines.map((p) => ({ cells: [todayInAthens(p.paidAt), p.family, classTitle(ctx.content, p.sessionId), p.what, p.amountCents, howPaid(p)], href: links.family(p.householdId) })),
    total: { value: lines.length ? net : null, display: lines.length ? money(net) : 'Nothing yet', label: `Collected in ${monthName(month)}` },
    empty: `No payments yet in ${monthName(month)}.`,
    note: lines.length ? receivedCount(lines) : undefined,
  };
}

// ───────────── Upcoming autopay ─────────────

export const AHEAD_DAYS = 90;

/** Scheduled charges for the next 90 days: "Committed ahead". */
export async function upcomingReport(ctx: ReportContext, f: ReportFilters): Promise<ReportResult> {
  const through = addDays(ctx.today, AHEAD_DAYS);
  const rows = (await upcomingCharges(ctx.today, through)).filter((c) => sessionPasses(f, ctx.content.findSession(c.sessionId)));
  const total = sum(rows.map((r) => r.amountCents));
  return {
    columns: [{ label: 'Date', kind: 'date' }, { label: 'Family' }, { label: 'Class' }, { label: 'For' }, { label: 'Amount', kind: 'money' }],
    rows: rows.map((c) => ({ cells: [c.dueDate, c.family, classTitle(ctx.content, c.sessionId), c.label, c.amountCents], href: links.family(c.householdId) })),
    total: { value: rows.length ? total : null, display: rows.length ? money(total) : 'Nothing scheduled', label: `Scheduled ${dayShort(ctx.today)} to ${dayShort(through)}` },
    empty: 'No autopay charges in the next 90 days.',
    note: rows.length ? plural(rows.length, 'charge') : undefined,
  };
}

/** Monthly charges scheduled for the next billing day (the 1st): "Booked for the next 1st". */
export async function nextChargeDayReport(ctx: ReportContext, f: ReportFilters): Promise<ReportResult> {
  const { nextDue, nextDueRows } = await billingOverview(ctx.today);
  const rows = nextDueRows.filter((r) => sessionPasses(f, ctx.content.findSession(r.i.sessionId)));
  const total = sum(rows.map((r) => totalDue(r.i)));
  return {
    columns: [{ label: 'Family' }, { label: 'Class' }, { label: 'For' }, { label: 'Amount', kind: 'money' }],
    rows: rows.map(({ i, family }) => ({ cells: [family, classTitle(ctx.content, i.sessionId), i.label, totalDue(i)], href: links.family(i.householdId) })),
    total: { value: nextDue ? total : null, display: nextDue ? money(total) : 'Nothing booked', label: nextDue ? `Booked for ${dayShort(nextDue)}` : 'No charges booked' },
    empty: 'No monthly charges are booked yet.',
    note: nextDue ? `${plural(rows.length, 'charge')} on ${dayShort(nextDue)}` : undefined,
  };
}

// ───────────── Who owes, and for how long ─────────────

export const AGING_BUCKETS = ['0–30 days', '31–60 days', '61–90 days', '90+ days'] as const;
/** 30 → "0–30 days", 31 → "31–60 days", 91 → "90+ days". */
export const agingBucket = (days: number) => AGING_BUCKETS[days <= 30 ? 0 : days <= 60 ? 1 : days <= 90 ? 2 : 3];

/** Pure half: failed and processing charges, oldest first, with their bucket. */
export function whoOwesFrom(items: AttentionItem[], content: Pick<Content, 'findSession'>, f: ReportFilters): ReportResult {
  const rows = items.filter((a) => sessionPasses(f, content.findSession(a.sessionId))).sort((a, b) => b.daysOverdue - a.daysOverdue);
  const total = sum(rows.map((a) => a.amountCents));
  return {
    columns: [{ label: 'Family' }, { label: 'Class' }, { label: 'For' }, { label: 'Due', kind: 'date' }, { label: 'Days overdue', kind: 'number' }, { label: 'How long' }, { label: 'Amount', kind: 'money' }, { label: 'What happened' }],
    rows: rows.map((a) => ({ cells: [a.family, classTitle(content, a.sessionId), a.label, a.dueDate, a.daysOverdue, agingBucket(a.daysOverdue), a.amountCents, a.reason], href: links.family(a.householdId) })),
    total: { value: total, display: rows.length ? `${money(total)} · ${plural(rows.length, 'payment')}` : 'None', label: 'Failed or overdue' },
    empty: 'No failed or overdue payments.',
  };
}

export async function whoOwesReport(ctx: ReportContext, f: ReportFilters) {
  return whoOwesFrom(await paymentsAttention(ctx.today), ctx.content, f);
}

/** Problem payments by bucket, for the dashboard panel (from the same rows). */
export function agingSummary(r: ReportResult) {
  return AGING_BUCKETS.map((b) => {
    const rows = r.rows.filter((x) => x.cells[5] === b);
    return { bucket: b, count: rows.length, cents: sum(rows.map((x) => Number(x.cells[6]))) };
  });
}

// ───────────── Everything charged, for the season reports ─────────────

export interface MoneyOrder {
  id: string;
  householdId: string;
  family: string;
  sessionId: string;
  plan: string;
  lines: OrderLine[];
  totalCents: number;
  studentIds: string[];
  paidAt: Date | null;
}
export interface MoneyCharge {
  id: string;
  orderId: string;
  householdId: string;
  sessionId: string;
  dueDate: string;
  amountCents: number;
  baseAmountCents: number;
  regularAmountCents: number;
  adjustments: AppliedAdjustment[];
  lateFeeCents: number;
  status: string;
  paidAt: Date | null;
}
export interface MoneyRefund {
  id: string;
  householdId: string;
  family: string;
  orderId: string | null;
  installmentId: string | null;
  amountCents: number;
  status: string;
  createdAt: Date;
}
export interface MoneyDropIn {
  sessionId: string;
  classDate: string;
  priceCents: number;
  status: string;
  orderId: string | null;
}
export interface MoneyData {
  /** Paid orders only (sign-ups, trials, drop-ins). */
  orders: MoneyOrder[];
  /** Every monthly charge, any status. */
  charges: MoneyCharge[];
  /** Pending and succeeded refunds. */
  refunds: MoneyRefund[];
  /** Adjustment ids that are credits, and ones made for a day off. */
  creditAdjustments: Set<string>;
  dayOffAdjustments: Set<string>;
  dropIns: MoneyDropIn[];
}

export async function loadMoney(): Promise<MoneyData> {
  const db = await getDb();
  const [orders, charges, refunds, credits, dayOffs, drops] = await Promise.all([
    db
      .select({ o: order, family: household.name })
      .from(order)
      .innerJoin(household, eq(household.id, order.householdId))
      .where(inArray(order.status, ['paid'])),
    db.select().from(installment),
    db
      .select({ r: refund, family: household.name })
      .from(refund)
      .innerJoin(household, eq(household.id, refund.householdId))
      .where(inArray(refund.status, ['pending', 'succeeded'])),
    db.select({ id: credit.adjustmentId }).from(credit).where(isNotNull(credit.adjustmentId)),
    db.select({ id: billingAdjustment.id }).from(billingAdjustment).where(isNotNull(billingAdjustment.closureId)),
    db.select({ sessionId: dropIn.sessionId, classDate: dropIn.classDate, priceCents: dropIn.priceCents, status: dropIn.status, orderId: dropIn.orderId }).from(dropIn).where(inArray(dropIn.status, ['booked', 'cancelled'])),
  ]);
  return {
    orders: orders.map(({ o, family }) => ({ id: o.id, householdId: o.householdId, family, sessionId: o.sessionId, plan: o.plan, lines: o.lines, totalCents: o.totalCents, studentIds: o.studentIds, paidAt: o.paidAt })),
    charges: charges.map((i) => ({
      id: i.id,
      orderId: i.orderId,
      householdId: i.householdId,
      sessionId: i.sessionId,
      dueDate: i.dueDate,
      amountCents: i.amountCents,
      baseAmountCents: i.baseAmountCents,
      regularAmountCents: i.regularAmountCents,
      adjustments: i.adjustments,
      lateFeeCents: i.lateFeeCents,
      status: i.status,
      paidAt: i.paidAt,
    })),
    refunds: refunds.map(({ r, family }) => ({ id: r.id, householdId: r.householdId, family, orderId: r.orderId, installmentId: r.installmentId, amountCents: r.amountCents, status: r.status, createdAt: r.createdAt })),
    creditAdjustments: new Set(credits.map((c) => c.id!).filter(Boolean)),
    dayOffAdjustments: new Set(dayOffs.map((d) => d.id)),
    dropIns: drops,
  };
}

type Scope = { content: Pick<Content, 'findSession'>; season?: string; f: ReportFilters };
const inScope = ({ content, season, f }: Scope, sessionId: string) => (!season || termOf(content, sessionId) === season) && sessionPasses(f, content.findSession(sessionId));

export type ChargeType = 'Tuition' | 'Fees' | 'Drop-ins' | 'Late fees';
export interface Charged {
  sessionId: string;
  type: ChargeType;
  cents: number;
}

/**
 * Everything families were charged so far: paid sign-ups (tuition after the
 * built-in discounts, and fees), paid drop-ins, and monthly charges due by
 * today (not ones staff stopped), with their late fees.
 */
export function chargedFrom(data: MoneyData, today: string): Charged[] {
  const out: Charged[] = [];
  for (const o of data.orders) {
    if (o.plan === 'drop_in') {
      if (o.totalCents > 0) out.push({ sessionId: o.sessionId, type: 'Drop-ins', cents: o.totalCents });
      continue;
    }
    const tuition = sum(o.lines.filter((l) => l.kind !== 'fee').map((l) => l.amountCents));
    const fees = sum(o.lines.filter((l) => l.kind === 'fee').map((l) => l.amountCents));
    if (tuition > 0) out.push({ sessionId: o.sessionId, type: 'Tuition', cents: tuition });
    if (fees > 0) out.push({ sessionId: o.sessionId, type: 'Fees', cents: fees });
  }
  for (const i of data.charges) {
    if (i.status === 'cancelled' || i.dueDate > today) continue;
    if (i.amountCents > 0) out.push({ sessionId: i.sessionId, type: 'Tuition', cents: i.amountCents });
    if (i.lateFeeCents > 0) out.push({ sessionId: i.sessionId, type: 'Late fees', cents: i.lateFeeCents });
  }
  return out;
}

const TYPES: ChargeType[] = ['Tuition', 'Fees', 'Drop-ins', 'Late fees'];

/** Charges by type and season. Pure. */
export function chargesFrom(data: MoneyData, content: Pick<Content, 'findSession'>, today: string, f: ReportFilters): ReportResult {
  const scope = { content, season: f.season, f };
  const charged = chargedFrom(data, today).filter((c) => inScope(scope, c.sessionId));
  const groups = new Map<string, { season: string; type: ChargeType; n: number; cents: number }>();
  for (const c of charged) {
    const season = termOf(content, c.sessionId) ?? 'No season';
    const k = `${season}\n${c.type}`;
    const g = groups.get(k) ?? { season, type: c.type, n: 0, cents: 0 };
    g.n++;
    g.cents += c.cents;
    groups.set(k, g);
  }
  const rows = [...groups.values()].sort((a, b) => a.season.localeCompare(b.season) || TYPES.indexOf(a.type) - TYPES.indexOf(b.type));
  const total = sum(rows.map((r) => r.cents));
  return {
    columns: [{ label: 'Season' }, { label: 'Type' }, { label: 'Charges', kind: 'number' }, { label: 'Amount', kind: 'money' }],
    rows: rows.map((r) => ({ cells: [r.season, r.type, r.n, r.cents] })),
    total: { value: rows.length ? total : null, display: rows.length ? money(total) : 'Nothing yet', label: f.season ? `Charged in ${f.season}` : 'Charged, every season' },
    empty: f.season ? `Nothing charged yet in ${f.season}.` : 'Nothing charged yet.',
  };
}

/** Charged vs paid by class. Pure. */
export function classPaymentsFrom(data: MoneyData, content: Pick<Content, 'findSession'>, today: string, f: ReportFilters): ReportResult {
  const scope = { content, season: f.season, f };
  type Acc = { charged: number; paid: number; refunded: number; overdue: number; toCome: number };
  const by = new Map<string, Acc>();
  const acc = (id: string) => by.get(id) ?? (by.set(id, { charged: 0, paid: 0, refunded: 0, overdue: 0, toCome: 0 }), by.get(id)!);
  for (const c of chargedFrom(data, today)) if (inScope(scope, c.sessionId)) acc(c.sessionId).charged += c.cents;
  const orderSession = new Map(data.orders.map((o) => [o.id, o.sessionId]));
  for (const o of data.orders) if (o.totalCents > 0 && inScope(scope, o.sessionId)) acc(o.sessionId).paid += o.totalCents;
  for (const i of data.charges) {
    if (!inScope(scope, i.sessionId)) continue;
    if (i.status === 'paid') acc(i.sessionId).paid += totalDue(i);
    else if (i.status === 'failed' || i.status === 'processing') acc(i.sessionId).overdue += totalDue(i);
    else if (i.status === 'scheduled') acc(i.sessionId).toCome += totalDue(i);
  }
  const chargeSession = new Map(data.charges.map((i) => [i.id, i.sessionId]));
  for (const r of data.refunds) {
    const sessionId = (r.installmentId && chargeSession.get(r.installmentId)) || (r.orderId && orderSession.get(r.orderId));
    if (sessionId && inScope(scope, sessionId)) acc(sessionId).refunded += r.amountCents;
  }
  const rows: Row[] = [...by.entries()]
    .map(([id, a]) => ({ id, a, title: classTitle(content, id), season: termOf(content, id) ?? '' }))
    .sort((x, y) => x.season.localeCompare(y.season) || x.title.localeCompare(y.title))
    .map(({ id, a, title, season }) => ({ cells: [title, season, a.charged, a.paid, a.refunded, a.paid - a.refunded, a.overdue, a.toCome], href: content.findSession(id) ? links.classPage(id) : undefined }));
  const kept = sum(rows.map((r) => Number(r.cells[5])));
  return {
    columns: [
      { label: 'Class' },
      { label: 'Season' },
      { label: 'Charged', kind: 'money' },
      { label: 'Paid', kind: 'money' },
      { label: 'Refunded', kind: 'money' },
      { label: 'Kept', kind: 'money' },
      { label: 'Overdue', kind: 'money' },
      { label: 'Still to come', kind: 'money' },
    ],
    rows,
    total: { value: rows.length ? kept : null, display: rows.length ? money(kept) : 'Nothing yet', label: 'Paid, less refunds' },
    empty: f.season ? `No payments yet in ${f.season}.` : 'No payments yet.',
  };
}

export type DiscountKind = 'Family discount (15%)' | 'Season discount (10%)' | 'Staff discounts' | 'Days off' | 'Credits' | 'Free first classes';
const KINDS: DiscountKind[] = ['Family discount (15%)', 'Season discount (10%)', 'Staff discounts', 'Days off', 'Credits', 'Free first classes'];

/**
 * Discounts given in a season, as a share of full price. Full price is the
 * regular tuition before any discount (sign-ups' tuition lines, and each
 * monthly charge's regular amount, not counting charges staff stopped). A
 * free first class has no price on record, so it's counted, not priced.
 */
export function discountsFrom(data: MoneyData, content: Pick<Content, 'findSession'>, f: ReportFilters): ReportResult {
  const scope = { content, season: f.season, f };
  const by = new Map<DiscountKind, { n: number; cents: number }>(KINDS.map((k) => [k, { n: 0, cents: 0 }]));
  const add = (k: DiscountKind, cents: number) => {
    const g = by.get(k)!;
    g.n++;
    g.cents += cents;
  };
  let full = 0;
  for (const o of data.orders) {
    if (o.plan === 'drop_in' || !inScope(scope, o.sessionId)) continue;
    if (o.plan === 'trial') {
      for (const l of o.lines) if (l.kind === 'tuition') add('Free first classes', 0);
      continue;
    }
    full += sum(o.lines.filter((l) => l.kind === 'tuition').map((l) => l.amountCents));
    for (const l of o.lines) {
      if (l.kind !== 'discount' || l.amountCents >= 0) continue;
      add(l.label.startsWith('10%') ? 'Season discount (10%)' : 'Family discount (15%)', -l.amountCents);
    }
  }
  for (const i of data.charges) {
    if (i.status === 'cancelled' || !inScope(scope, i.sessionId)) continue;
    full += i.regularAmountCents;
    if (i.regularAmountCents > i.baseAmountCents) add('Family discount (15%)', i.regularAmountCents - i.baseAmountCents);
    for (const a of i.adjustments) {
      if (a.cents <= 0) continue;
      add(data.creditAdjustments.has(a.adjustmentId) ? 'Credits' : data.dayOffAdjustments.has(a.adjustmentId) ? 'Days off' : 'Staff discounts', a.cents);
    }
  }
  const given = sum([...by.values()].map((g) => g.cents));
  const share = percent(given, full);
  const rows = KINDS.filter((k) => by.get(k)!.n > 0).map((k) => {
    const g = by.get(k)!;
    return { cells: [k, g.n, k === 'Free first classes' ? null : g.cents, k === 'Free first classes' ? null : percent(g.cents, full)] };
  });
  return {
    columns: [{ label: 'Discount' }, { label: 'Times', kind: 'number' }, { label: 'Amount', kind: 'money' }, { label: 'Share of full price', kind: 'percent' }],
    rows,
    total: { value: rows.length ? given : null, display: rows.length ? `${money(given)}${share === null ? '' : ` · ${Math.round(share)}%`}` : 'None yet', label: share === null ? 'Discounts given' : `Discounts given: ${Math.round(share)}% of ${money(full)} full price` },
    empty: f.season ? `No discounts yet in ${f.season}.` : 'No discounts yet.',
  };
}

/** Refunds (pending and succeeded), newest first. Pure. */
export function refundsFrom(data: MoneyData, content: Pick<Content, 'findSession'>, f: ReportFilters): ReportResult {
  const scope = { content, season: f.season, f };
  const orderSession = new Map(data.orders.map((o) => [o.id, o.sessionId]));
  const chargeSession = new Map(data.charges.map((i) => [i.id, i.sessionId]));
  const rows = data.refunds
    .map((r) => ({ r, sessionId: (r.installmentId && chargeSession.get(r.installmentId)) || (r.orderId && orderSession.get(r.orderId)) || '' }))
    .filter((x) => x.sessionId && inScope(scope, x.sessionId) && (!f.month || todayInAthens(x.r.createdAt).slice(0, 7) === f.month))
    .sort((a, b) => b.r.createdAt.getTime() - a.r.createdAt.getTime());
  const total = sum(rows.map((x) => x.r.amountCents));
  return {
    columns: [{ label: 'Date', kind: 'date' }, { label: 'Family' }, { label: 'Class' }, { label: 'Amount', kind: 'money' }, { label: 'Status' }],
    rows: rows.map(({ r, sessionId }) => ({ cells: [todayInAthens(r.createdAt), r.family, classTitle(content, sessionId), r.amountCents, r.status === 'pending' ? 'Pending' : 'Done'], href: links.family(r.householdId) })),
    total: { value: rows.length ? total : null, display: rows.length ? `${money(total)} · ${plural(rows.length, 'refund')}` : 'None', label: 'Refunded' },
    empty: 'No refunds.',
  };
}

/** Drop-ins by month and class: booked dates and what was paid for them. Pure. */
export function dropInsFrom(data: MoneyData, content: Pick<Content, 'findSession'>, f: ReportFilters): ReportResult {
  const scope = { content, season: f.season, f };
  const paidOrders = new Set(data.orders.map((o) => o.id));
  const by = new Map<string, { month: string; sessionId: string; n: number; cents: number }>();
  for (const d of data.dropIns) {
    if (d.status !== 'booked' || !inScope(scope, d.sessionId)) continue;
    const month = d.classDate.slice(0, 7);
    if (f.month && month !== f.month) continue;
    const k = `${month} ${d.sessionId}`;
    const g = by.get(k) ?? { month, sessionId: d.sessionId, n: 0, cents: 0 };
    g.n++;
    if (d.orderId && paidOrders.has(d.orderId)) g.cents += d.priceCents;
    by.set(k, g);
  }
  const rows = [...by.values()].sort((a, b) => b.month.localeCompare(a.month) || classTitle(content, a.sessionId).localeCompare(classTitle(content, b.sessionId)));
  const n = sum(rows.map((r) => r.n));
  return {
    columns: [{ label: 'Month' }, { label: 'Class' }, { label: 'Drop-ins', kind: 'number' }, { label: 'Paid', kind: 'money' }],
    rows: rows.map((r) => ({ cells: [monthShort(r.month), classTitle(content, r.sessionId), r.n, r.cents], href: content.findSession(r.sessionId) ? links.classPage(r.sessionId) : undefined })),
    total: { value: rows.length ? n : null, display: rows.length ? plural(n, 'drop-in') : 'None yet', label: 'Drop-ins booked' },
    empty: 'No drop-ins booked.',
  };
}

// ───────────── Money by month ─────────────

/**
 * Collected in a month, less refunds: the same lines as Payments received
 * (paymentsReceived), counted from the loaded rows so twelve months take one
 * load. The unit tests check the two agree.
 */
export function collectedIn(data: MoneyData, month: string) {
  const inMonth = (d: Date | null) => !!d && todayInAthens(d).slice(0, 7) === month;
  const paid = sum(data.orders.filter((o) => o.totalCents > 0 && inMonth(o.paidAt)).map((o) => o.totalCents));
  const monthly = sum(data.charges.filter((i) => i.status === 'paid' && totalDue(i) > 0 && inMonth(i.paidAt)).map(totalDue));
  const refunded = sum(data.refunds.filter((r) => inMonth(r.createdAt) && r.orderId).map((r) => r.amountCents));
  return { payments: paid + monthly, refunds: refunded, net: paid + monthly - refunded };
}

/**
 * The 12 months to `month`: payments, refunds and what was kept, beside the
 * same month a year earlier from the numbers typed in from Studio Director
 * (Settings → Last season), when there are some.
 */
export function moneyByMonthFrom(data: MoneyData, month: string, baseline: Baseline | null): ReportResult {
  const before = new Map((baseline?.monthly ?? []).map((m) => [m.month, m.collectedCents]));
  const months = lastTwelve(month);
  const rows = months.map((m) => {
    const c = collectedIn(data, m);
    const prior = before.get(shiftMonth(m, -12));
    return { cells: [monthShort(m), c.payments, c.refunds, c.net, prior ?? null], href: links.payments(undefined, m) };
  });
  const any = rows.some((r) => r.cells[1] !== 0 || r.cells[2] !== 0);
  const total = sum(rows.map((r) => Number(r.cells[3])));
  return {
    columns: [{ label: 'Month' }, { label: 'Payments', kind: 'money' }, { label: 'Refunds', kind: 'money' }, { label: 'Collected', kind: 'money' }, { label: 'A year before', kind: 'money' }],
    rows,
    total: { value: any ? total : null, display: any ? money(total) : 'Nothing yet', label: `Collected ${monthShort(months[0])} to ${monthShort(month)}` },
    empty: 'No payments yet.',
    note: before.size ? `“A year before” is from Studio Director (${baseline!.season}), typed in under Settings.` : 'No earlier year on the site yet.',
  };
}

export { monthName };
