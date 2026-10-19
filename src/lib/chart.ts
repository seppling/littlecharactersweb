/**
 * Small helpers for the reports' charts (src/components/admin/reports/):
 * a round top for the scale, and how a value reads on an axis.
 */
import { formatCents } from './pricing';

/** The smallest "round" number at or above `max` (1, 2, 2.5, 5 × 10ⁿ), for the top of a scale. 0 → 1. */
export function niceMax(max: number) {
  if (!(max > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}

/** "$1.2k" on an axis for money (cents); "12" for a count. */
export function axisLabel(v: number, kind: 'money' | 'count') {
  if (kind === 'count') return Math.round(v).toLocaleString('en-US');
  const dollars = v / 100;
  if (dollars >= 1000) return `$${(dollars / 1000).toFixed(dollars % 1000 === 0 ? 0 : 1)}k`;
  return `$${Math.round(dollars)}`;
}

/** A value in full, for tooltips and the data table. */
export const fullLabel = (v: number | null, kind: 'money' | 'count') => (v === null ? '—' : kind === 'money' ? formatCents(v) : v.toLocaleString('en-US'));

/** Two series' colors: purple then teal, checked for colour-blind separation and 3:1 contrast on white. */
export const SERIES_COLORS = ['#8040b8', '#0f9e8e'] as const;
