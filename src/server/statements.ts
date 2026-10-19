/**
 * A family's yearly statement (docs/back-office.md → Refunds, credits and
 * statements): every payment that year (date, child, class or drop-in,
 * amount, and the card's last four or "cash/check"), then each refund, and
 * the total paid less refunds. The heading has Little Characters' name,
 * address and email, and Hannah's optional tax ID and note (Site settings →
 * Payment statements).
 *
 * The family downloads it from their account; staff from the family's page
 * (a fresh sign-in, audit-logged). Both are CSV and PDF, made with the same
 * rows (`statementTable`).
 */
import type { SiteContent } from '@/content/site-content';
import { toCsv, type Cell } from '@/lib/csv';
import { formatCents, todayInAthens } from '@/lib/pricing';
import { csvResponse, pdfResponse } from './downloads';
import { paymentsMode } from './env';
import { familyPayments, firstNames, paymentWhat, type Payment, type Refund } from './refunds';
import { getDb, schema } from './db';
import { eq } from 'drizzle-orm';

type Content = Pick<SiteContent, 'findSession' | 'locationById' | 'site'>;
/** The card's last four for a payment, or null. Stripe in production; tests pass their own. */
export type CardLookup = (p: Payment) => Promise<string | null>;

export interface StatementLine {
  date: string;
  child: string;
  what: string;
  amountCents: number;
  paidWith: string;
  pending?: boolean;
}

export interface Statement {
  year: number;
  family: string;
  from: { name: string; address: string[]; email: string; taxId?: string; note?: string };
  payments: StatementLine[];
  refunds: StatementLine[];
  paidCents: number;
  refundedCents: number;
  netCents: number;
}

const yearOf = (d: Date) => Number(todayInAthens(d).slice(0, 4));

/** The years a family paid (or was refunded) in, newest first. */
export function statementYears(payments: Pick<Payment, 'paidAt' | 'refunds'>[]) {
  const years = new Set<number>();
  for (const p of payments) {
    years.add(yearOf(p.paidAt));
    for (const r of p.refunds) if (r.status !== 'failed') years.add(yearOf(r.createdAt));
  }
  return [...years].sort((a, b) => b - a);
}

/** "cash/check", "card ending 4242" or "card". */
export const paidWith = (p: Pick<Payment, 'via'>, last4: string | null) => (p.via === 'cash' ? 'cash/check' : last4 ? `card ending ${last4}` : 'card');

/**
 * Pure: the year's lines and totals. Refunds are counted in the year they
 * were made; failed ones gave nothing back and are left out.
 */
export function buildStatement(input: {
  year: number;
  family: string;
  from: Statement['from'];
  payments: Payment[];
  names: Map<string, string>;
  cards: Map<string, string | null>;
  findSession?: Content['findSession'];
}): Statement {
  const child = (p: Payment) => p.studentIds.map((id) => input.names.get(id)).filter(Boolean).join(', ');
  const how = (p: Payment) => paidWith(p, input.cards.get(p.key) ?? null);
  const payments = input.payments
    .filter((p) => yearOf(p.paidAt) === input.year)
    // Oldest first; a sign-up before the monthly charges paid the same moment.
    .sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime() || Number(!!a.installmentId) - Number(!!b.installmentId))
    .map((p) => ({ date: todayInAthens(p.paidAt), child: child(p), what: paymentWhat(p, input.findSession), amountCents: p.amountCents, paidWith: how(p) }));
  const refunds = input.payments
    .flatMap((p) => p.refunds.filter((r: Refund) => r.status !== 'failed' && yearOf(r.createdAt) === input.year).map((r) => ({ p, r })))
    .sort((a, b) => a.r.createdAt.getTime() - b.r.createdAt.getTime())
    .map(({ p, r }) => ({
      date: todayInAthens(r.createdAt),
      child: child(p),
      what: `Refund: ${paymentWhat(p, input.findSession)}`,
      amountCents: -r.amountCents,
      paidWith: how(p),
      pending: r.status === 'pending',
    }));
  const paidCents = payments.reduce((a, l) => a + l.amountCents, 0);
  const refundedCents = refunds.reduce((a, l) => a - l.amountCents, 0);
  return { year: input.year, family: input.family, from: input.from, payments, refunds, paidCents, refundedCents, netCents: paidCents - refundedCents };
}

const dollars = (cents: number) => (cents / 100).toFixed(2);
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** The rows both files share: payments, refunds, then the totals. Amounts are plain numbers so a spreadsheet can add them up. */
export function statementTable(s: Statement): { headers: string[]; rows: Cell[][] } {
  return {
    headers: ['Date', 'Child', 'For', 'Paid with', 'Amount ($)'],
    rows: [
      ...s.payments.map((l) => [l.date, l.child, l.what, l.paidWith, dollars(l.amountCents)]),
      ...s.refunds.map((l) => [l.date, l.child, `${l.what}${l.pending ? ' (pending)' : ''}`, l.paidWith, dollars(l.amountCents)]),
      ['', '', `Total paid in ${s.year}`, '', dollars(s.paidCents)],
      ['', '', 'Refunds', '', dollars(-s.refundedCents)],
      ['', '', 'Total paid less refunds', '', dollars(s.netCents)],
    ],
  };
}

/** Who it's from, for the heading: the site's name, HQ's address, the contact email, and Hannah's tax ID and note when set. */
export function statementFrom(content: Content): Statement['from'] {
  const hq = content.locationById('hq');
  return { name: content.site.name, address: hq?.address ?? [], email: content.site.contact.email, taxId: content.site.statements?.taxId, note: content.site.statements?.note };
}

/** A family's statement for a year, with each card payment's last four from Stripe (one lookup per payment). */
export async function familyStatement(householdId: string, year: number, content: Content, opts: { cardOf?: CardLookup } = {}): Promise<Statement | null> {
  const db = await getDb();
  const [h] = await db.select({ name: schema.household.name }).from(schema.household).where(eq(schema.household.id, householdId));
  if (!h) return null;
  const all = await familyPayments(householdId);
  const mine = all.filter((p) => yearOf(p.paidAt) === year || p.refunds.some((r) => yearOf(r.createdAt) === year));
  const cardOf = opts.cardOf ?? stripeCards;
  const cards = new Map<string, string | null>();
  for (const p of mine) if (p.via === 'card') cards.set(p.key, await cardOf(p).catch(() => null));
  return buildStatement({ year, family: h.name, from: statementFrom(content), payments: mine, names: await firstNames(householdId), cards, findSession: content.findSession });
}

const stripeCards: CardLookup = async (p) => {
  if (paymentsMode !== 'stripe') return null;
  return (await import('./stripe')).paymentCardLast4(p);
};

/** The years to offer, newest first (this year when there's nothing yet). */
export async function yearsFor(householdId: string) {
  return statementYears(await familyPayments(householdId));
}

/** `?year=2026`, else the newest year with payments, else this year. */
export function pickYear(param: string | null, years: number[], today = todayInAthens()) {
  const n = Number(param);
  if (param && /^\d{4}$/.test(param) && n >= 2020 && n <= Number(today.slice(0, 4)) + 1) return n;
  return years[0] ?? Number(today.slice(0, 4));
}

/** The CSV or PDF file. */
export async function statementResponse(format: 'csv' | 'pdf', s: Statement) {
  const t = statementTable(s);
  const name = `Little Characters statement ${s.year} (${s.family}).${format}`;
  if (format === 'csv') {
    const from = [[], [s.from.name], [s.from.address.join(', ')], [s.from.email], ...(s.from.taxId ? [[`Tax ID: ${s.from.taxId}`]] : []), ...(s.from.note ? [[s.from.note]] : [])];
    return csvResponse(name, toCsv(t.headers, [...t.rows, ...from]));
  }
  const subtitle = [
    `${s.family} · ${s.payments.length} ${s.payments.length === 1 ? 'payment' : 'payments'}${s.refunds.length ? `, ${s.refunds.length} ${s.refunds.length === 1 ? 'refund' : 'refunds'}` : ''} · Total paid less refunds ${formatCents(s.netCents)}`,
    [s.from.name, ...s.from.address, s.from.email].filter(Boolean).join(' · '),
    s.from.taxId ? `Tax ID: ${s.from.taxId}` : '',
    s.from.note ?? '',
  ]
    .filter(Boolean)
    .join('\n');
  return pdfResponse(name, {
    title: `Statement for ${s.year}`,
    subtitle,
    columns: [
      { header: 'Date', weight: 0.9 },
      { header: 'Child', weight: 0.9 },
      { header: 'For', weight: 2.6 },
      { header: 'Paid with', weight: 1.1 },
      { header: 'Amount ($)', weight: 0.8, align: 'right' },
    ],
    rows: t.rows.map((r) => [r[0] ? day(String(r[0])) : '', ...r.slice(1)]),
    orientation: 'portrait',
  });
}
