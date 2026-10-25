/**
 * The reports dashboard (/admin/reports): the most important numbers, each
 * the total of a report in the library, run with the same filters, so the
 * tile and the table behind it always agree. Comparisons are with last
 * season on the site, else the numbers typed in from Studio Director
 * (Settings → Last season), else "No earlier season yet".
 */
import { report } from '@/lib/admin-links';
import { formatCents } from '@/lib/pricing';
import { shiftMonth, monthShort, type ReportContext, type ReportFilters, type ReportResult, type Total } from './common';
import { seasonChildren } from './enrollment';
import { agingSummary, collectedIn } from './money';
import { findReport, Loads, runReport, type ReportDef } from './library';

export interface Tile {
  key: string;
  /** The short name on the tile: "Collected this month". */
  name: string;
  how: string;
  total: Total;
  href: string;
  /** "↑ 8 on Spring 2026", or null when there's nothing to compare with. */
  compare: string | null;
}

/** "↑ 8 on Spring 2026", "↓ $120 on Oct 2025", "Same as Spring 2026". */
export function compareText(now: number, before: number, on: string, kind: 'count' | 'money' | 'points' = 'count') {
  const d = now - before;
  if (Math.round(d) === 0) return `Same as ${on}`;
  const size = kind === 'money' ? formatCents(Math.abs(d)) : kind === 'points' ? `${Math.round(Math.abs(d))} point${Math.round(Math.abs(d)) === 1 ? '' : 's'}` : Math.abs(d).toLocaleString('en-US');
  return `${d > 0 ? '↑' : '↓'} ${size} on ${on}`;
}

export const NO_EARLIER = 'No earlier season yet';

export async function dashboard(ctx: ReportContext, viewerId: string) {
  const loads = new Loads(ctx);
  const def = (key: string) => findReport(key)!;
  const run = (key: string, f: ReportFilters = {}) => runReport(def(key), f, loads, viewerId);
  const tile = (d: ReportDef, name: string, r: ReportResult, compare: string | null, f: ReportFilters = {}): Tile => ({
    key: d.key,
    name,
    how: d.how,
    total: r.total,
    href: report(d.key, { ...f }),
    compare,
  });
  const { current, last } = loads.seasons();
  const baseline = await loads.baseline();
  const month = ctx.today.slice(0, 7);

  const [collected, booked, children, classes, comingBack, freeClass, ahead, discounts, atRisk, waitlists, owes, byMonth, pace, heard, zips, care, missed, taken] = await Promise.all([
    run('payments-received'),
    run('next-charge-day'),
    run('children'),
    run('classes'),
    run('coming-back'),
    run('free-class'),
    run('upcoming-autopay'),
    run('discounts'),
    run('at-risk'),
    run('waitlists'),
    run('who-owes'),
    run('money-by-month'),
    run('signups-by-week'),
    run('heard-about'),
    run('zip-codes'),
    run('care-details'),
    run('missed-two'),
    run('attendance-taken'),
  ]);

  // Comparisons.
  const data = await loads.money();
  const yearAgo = shiftMonth(month, -12);
  const siteYearAgo = collectedIn(data, yearAgo);
  const typedYearAgo = baseline?.monthly.find((m) => m.month === yearAgo)?.collectedCents;
  const collectedCompare =
    collected.total.value === null
      ? null
      : siteYearAgo.payments > 0
        ? compareText(collected.total.value, siteYearAgo.net, monthShort(yearAgo), 'money')
        : typedYearAgo !== undefined
          ? compareText(collected.total.value, typedYearAgo, `${monthShort(yearAgo)} (Studio Director)`, 'money')
          : null;

  const enrollments = await loads.enrollments();
  const lastKids = last ? seasonChildren(enrollments, ctx.content, last) : 0;
  const childrenCompare =
    children.total.value === null ? null : lastKids > 0 ? compareText(children.total.value, lastKids, last!) : baseline?.children !== undefined ? compareText(children.total.value, baseline.children, baseline.season) : NO_EARLIER;

  const lastFill = last && lastKids > 0 ? (await run('classes', { season: last })).total.value : null;
  const fillCompare = classes.total.value === null ? null : lastFill !== null ? compareText(classes.total.value, lastFill, last!, 'points') : NO_EARLIER;

  const lastFree = last && lastKids > 0 ? (await run('free-class', { season: last })).total.value : null;
  const freeCompare = freeClass.total.value === null ? null : lastFree !== null ? compareText(freeClass.total.value, lastFree, last!) : NO_EARLIER;

  const backCompare = last ? null : comingBack.total.value !== null ? `From Studio Director (${baseline?.season})` : null;

  return {
    season: current,
    lastSeason: last ?? (baseline ? `${baseline.season} (Studio Director)` : null),
    tiles: [
      tile(def('payments-received'), 'Collected this month', collected, collectedCompare),
      tile(def('next-charge-day'), 'Booked for the next 1st', booked, null),
      tile(def('children'), 'Children this season', children, childrenCompare),
      tile(def('classes'), 'Fill rate', classes, fillCompare),
      tile(def('coming-back'), 'Coming back', comingBack, backCompare),
      tile(def('free-class'), 'Free class to paid', freeClass, freeCompare),
    ],
    small: [tile(def('upcoming-autopay'), 'Committed ahead', ahead, null), tile(def('discounts'), 'Discounts given', discounts, null)],
    atRisk: { result: atRisk, href: report('at-risk') },
    waitlists: { result: waitlists, href: report('waitlists') },
    owes: { result: owes, aging: agingSummary(owes), href: report('who-owes') },
    byMonth: { result: byMonth, href: report('money-by-month') },
    pace: { result: pace, href: report('signups-by-week') },
    heard: { result: heard, href: report('heard-about') },
    zips: { result: zips, href: report('zip-codes') },
    care: { result: care, href: report('care-details') },
    missed: { result: missed, href: report('missed-two') },
    taken: { result: taken, href: report('attendance-taken') },
  };
}

export type Dashboard = Awaited<ReturnType<typeof dashboard>>;
