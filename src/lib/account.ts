/**
 * Small pieces of the family account page (src/pages/account/index.astro),
 * kept here so they're unit-tested (tests/unit/account.test.ts).
 */
import { formatCents } from './pricing';

const BRANDS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  diners: 'Diners Club',
  jcb: 'JCB',
  unionpay: 'UnionPay',
  cartes_bancaires: 'Cartes Bancaires',
};

type SavedCard = {
  stripePaymentMethodId: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpMonth: number | null;
  cardExpYear: number | null;
};

/**
 * "Visa ending 4242, expires 4/2030" for the saved card, "Test card" for the
 * local test-payment stand-in, or null when no card is saved. A card saved
 * before its details were recorded shows as "Card saved at checkout".
 */
export function cardLabel(h: SavedCard): string | null {
  const pm = h.stripePaymentMethodId;
  if (!pm) return null;
  if (!pm.startsWith('pm_')) return 'Test card';
  if (!h.cardLast4) return 'Card saved at checkout';
  const brand = h.cardBrand ? (BRANDS[h.cardBrand] ?? h.cardBrand.charAt(0).toUpperCase() + h.cardBrand.slice(1)) : 'Card';
  const expires = h.cardExpMonth && h.cardExpYear ? `, expires ${h.cardExpMonth}/${h.cardExpYear}` : '';
  return `${brand} ending ${h.cardLast4}${expires}`;
}

/** "Kai", "Kai and Ava", "Kai, Ava and Leo". */
export function namesList(names: string[]) {
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

export interface AutopayGroup<T> {
  dueDate: string;
  totalCents: number;
  items: (T & { who: string })[];
  /** "Nov 1: $175.75 · Kai $95, Ava $80.75" */
  summary: string;
}

/**
 * Upcoming autopay by date: one line per date with its total and each child's
 * share, then the per-child payments themselves. `who` names the children a
 * payment is for (one payment can cover siblings in the same class).
 */
export function groupAutopay<T extends { dueDate: string; amountCents: number }>(payments: T[], who: (p: T) => string[]): AutopayGroup<T>[] {
  const byDate = new Map<string, (T & { who: string })[]>();
  for (const p of [...payments].sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
    const list = byDate.get(p.dueDate) ?? [];
    list.push({ ...p, who: namesList(who(p)) });
    byDate.set(p.dueDate, list);
  }
  return [...byDate].map(([dueDate, items]) => {
    const totalCents = items.reduce((a, i) => a + i.amountCents, 0);
    // One share per child (or group of siblings), adding up a child's classes on that date.
    const shares = new Map<string, number>();
    for (const i of items) shares.set(i.who, (shares.get(i.who) ?? 0) + i.amountCents);
    const day = new Date(`${dueDate}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const parts = [...shares].map(([name, cents]) => `${name || 'Tuition'} ${formatCents(cents)}`);
    return { dueDate, totalCents, items, summary: `${day}: ${formatCents(totalCents)} · ${parts.join(', ')}` };
  });
}

/**
 * The welcome note for a family imported from Studio Director, with the last
 * day of Studio Director billing when Hannah has set it.
 */
export function studioDirectorWelcome(billingEnds?: string) {
  const ends = billingEnds && /^\d{4}-\d{2}-\d{2}$/.test(billingEnds)
    ? ` on ${new Date(`${billingEnds}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })}`
    : '';
  return `Your fall classes and payments stay in Studio Director until the term ends${ends}. Spring sign-up happens here. Please check your family details and each child’s details below.`;
}
