/**
 * Staff adjustments: a one-off discount Hannah gives a family (a scholarship,
 * pay-what-you-can, a sibling deal, a credit for a missed class). Pure math, no
 * database, so every rule is unit-tested (tests/unit/adjustments.test.ts).
 *
 *  - A percentage or a dollar amount off a monthly payment.
 *  - Applied after the built-in discounts: a payment's starting amount already
 *    includes the 15% multi-class / multi-student discount.
 *  - Several adjustments apply in the order they were added; a percentage is
 *    taken from what's left after the earlier ones.
 *  - Rounded to the cent in the family's favor, and never below $0.
 *  - Tuition only: the late fee is added on top, never discounted.
 */

export type AdjustmentKind = 'percent' | 'amount';
export type AdjustmentRepeat = 'once' | 'monthly';

export interface AdjustmentRule {
  id: string;
  kind: AdjustmentKind;
  /** Whole percent (1–100) for 'percent'; cents for 'amount'. */
  value: number;
  /** What the family sees, e.g. "Scholarship" or "Discount". */
  label: string;
}

/** One adjustment's effect on one payment, as the family sees it ("Scholarship: −$40"). */
export interface AppliedAdjustment {
  adjustmentId: string;
  label: string;
  cents: number;
}

export const ADJUSTMENTS = {
  /** Stripe can't charge less than 50¢, so a smaller remainder is taken off too. */
  minChargeCents: 50,
  maxAmountCents: 1_000_000,
  maxReasonLength: 120,
  /** What families see when staff keep the reason private. */
  defaultFamilyLabel: 'Discount',
};

/** The family-facing label: the reason only when staff chose to show it. */
export function familyLabel(reason: string, showToFamily: boolean) {
  return showToFamily && reason.trim() ? reason.trim() : ADJUSTMENTS.defaultFamilyLabel;
}

/** Apply adjustments, in order, to a payment's starting amount (cents). */
export function applyAdjustments(baseCents: number, rules: AdjustmentRule[]): { amountCents: number; lines: AppliedAdjustment[] } {
  let remaining = Math.max(0, baseCents);
  const lines: AppliedAdjustment[] = [];
  for (const r of rules) {
    if (remaining <= 0) break;
    // Integer math; the cent rounds up, so the family pays the lower amount.
    const wanted = r.kind === 'percent' ? Math.floor((remaining * r.value + 99) / 100) : r.value;
    const off = Math.min(Math.max(0, wanted), remaining);
    if (off <= 0) continue;
    remaining -= off;
    lines.push({ adjustmentId: r.id, label: r.label, cents: off });
  }
  if (remaining > 0 && remaining < ADJUSTMENTS.minChargeCents && lines.length) {
    lines[lines.length - 1].cents += remaining;
    remaining = 0;
  }
  return { amountCents: remaining, lines };
}

/** "$40 off" or "25% off". */
export function describeAdjustment(a: { kind: AdjustmentKind; value: number }) {
  return a.kind === 'percent' ? `${a.value}% off` : `${formatMoney(a.value)} off`;
}

export const repeatLabel = (r: AdjustmentRepeat) => (r === 'once' ? 'next payment only' : 'every remaining month');

/** "Scholarship: −$40" */
export const adjustmentLine = (l: Pick<AppliedAdjustment, 'label' | 'cents'>) => `${l.label}: −${formatMoney(l.cents)}`;

function formatMoney(c: number) {
  return `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
}

/**
 * Read the staff form's amount: "40", "$40", "12.50" (dollars) or "25", "25%"
 * (percent). Returns null when it isn't a usable value.
 */
export function parseAdjustmentValue(kind: AdjustmentKind, raw: string): number | null {
  const s = raw.trim().replace(/^\$/, '').replace(/%$/, '').trim();
  if (kind === 'percent') {
    if (!/^\d{1,3}$/.test(s)) return null;
    const n = Number(s);
    return n >= 1 && n <= 100 ? n : null;
  }
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(s)) return null;
  const c = Math.round(Number(s) * 100);
  return c >= 1 && c <= ADJUSTMENTS.maxAmountCents ? c : null;
}
