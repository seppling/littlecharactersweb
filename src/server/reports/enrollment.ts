/**
 * Classes and enrollment reports (docs/back-office.md → Reports): fill rate
 * and waitlists, children this season, sign-ups by week, classes at risk,
 * drops, free class to paid, and coming back. Reads only.
 *
 * "Enrolled" means an active or free-trial enrollment: the places taken, as
 * on the Classes list (classRows in classes.ts). A child in two classes is
 * one child.
 */
import { and, eq, inArray } from 'drizzle-orm';
import * as links from '@/lib/admin-links';
import { isOneOff } from '@/lib/program-fit';
import { bookingClock } from '@/lib/session-dates';
import { meetings } from '@/lib/pricing';
import { sessionCounts } from '../admin';
import { classRows, MIN_TO_RUN, type ClassRow } from '../classes';
import { getDb, schema } from '../db';
import type { Baseline } from '../settings-store';
import { UNDER5_WINDOW_DAYS } from '../today';
import {
  addDays,
  classTitle,
  dayShort,
  daysBetween,
  percent,
  plural,
  seasonsOf,
  sessionPasses,
  sum,
  termOf,
  weekStart,
  type Content,
  type ReportContext,
  type ReportFilters,
  type ReportResult,
  type Row,
} from './common';
import { todayInAthens } from '@/lib/pricing';

const { enrollment, student, household, order } = schema;

export interface EnrollRow {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  householdId: string;
  family: string;
  sessionId: string;
  status: 'active' | 'trial' | 'waitlist' | 'cancelled';
  createdAt: Date;
  cancelledAt: Date | null;
  dropReason: string | null;
}

export interface OrderLite {
  id: string;
  householdId: string;
  sessionId: string;
  plan: string;
  studentIds: string[];
  createdAt: Date;
  paidAt: Date | null;
}

export interface EnrollData {
  enrollments: EnrollRow[];
  /** Paid orders: free trials, sign-ups and drop-ins. */
  orders: OrderLite[];
}

export async function loadEnrollments(): Promise<EnrollData> {
  const db = await getDb();
  const [rows, orders] = await Promise.all([
    db
      .select({
        id: enrollment.id,
        studentId: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        householdId: household.id,
        family: household.name,
        sessionId: enrollment.sessionId,
        status: enrollment.status,
        createdAt: enrollment.createdAt,
        cancelledAt: enrollment.cancelledAt,
        dropReason: enrollment.dropReason,
      })
      .from(enrollment)
      .innerJoin(student, eq(student.id, enrollment.studentId))
      .innerJoin(household, eq(household.id, enrollment.householdId)),
    db
      .select({ id: order.id, householdId: order.householdId, sessionId: order.sessionId, plan: order.plan, studentIds: order.studentIds, createdAt: order.createdAt, paidAt: order.paidAt })
      .from(order)
      .where(and(eq(order.status, 'paid'), inArray(order.plan, ['trial', 'monthly', 'full', 'once']))),
  ]);
  return { enrollments: rows as EnrollRow[], orders };
}

export const isEnrolled = (e: Pick<EnrollRow, 'status'>) => e.status === 'active' || e.status === 'trial';
const nameOf = (e: Pick<EnrollRow, 'firstName' | 'lastName'>) => `${e.firstName} ${e.lastName}`.trim();
const inSeason = (content: Pick<Content, 'findSession'>, season: string | null | undefined, f: ReportFilters) => (sessionId: string) =>
  !!season && termOf(content, sessionId) === season && sessionPasses(f, content.findSession(sessionId));

export async function loadClassRows(ctx: ReportContext) {
  return classRows(ctx.content, await sessionCounts(), bookingClock(ctx.content.site.lateJoinWeeks, ctx.now));
}

// ───────────── Fill rate ─────────────

/**
 * Each class in the season: enrolled of its places, and the waitlist. The
 * overall fill rate is every enrolled child of every place, over the classes
 * that have a limit (a class with no limit has no rate).
 */
export function classesFrom(rows: ClassRow[], season: string | null, f: ReportFilters): ReportResult {
  const list = rows.filter((r) => !!season && r.term === season && sessionPasses(f, r)).sort((a, b) => a.program.title.localeCompare(b.program.title) || a.session.startDate.localeCompare(b.session.startDate));
  const limited = list.filter((r) => r.capacity !== undefined && r.capacity > 0);
  const filled = sum(limited.map((r) => r.filled));
  const places = sum(limited.map((r) => r.capacity!));
  const rate = percent(filled, places);
  return {
    columns: [{ label: 'Class' }, { label: 'When' }, { label: 'Teacher' }, { label: 'Enrolled', kind: 'number' }, { label: 'Places', kind: 'number' }, { label: 'Fill rate', kind: 'percent' }, { label: 'Waitlist', kind: 'number' }],
    rows: list.map((r) => ({
      cells: [r.label ? `${r.program.title} (${r.label})` : r.program.title, r.when, r.teacher, r.filled, r.capacity ?? null, r.capacity ? percent(r.filled, r.capacity) : null, r.waitlist],
      href: links.classPage(r.session.id),
    })),
    // Nobody enrolled yet: say so, rather than a 0% that looks like a result.
    total: filled === 0 ? { value: null, display: places ? 'No one enrolled yet' : 'No places yet', label: places ? `${places} places in ${season}` : 'Fill rate' } : { value: rate, display: `${Math.round(rate!)}%`, label: `Fill rate: ${filled} of ${places} places` },
    empty: season ? `No classes in ${season}.` : 'No classes yet.',
  };
}

// ───────────── Children this season ─────────────

/** Each child with an active or trial enrollment in the season, counted once, with their classes. */
export function childrenFrom(data: Pick<EnrollData, 'enrollments'>, content: Pick<Content, 'findSession'>, season: string | null, f: ReportFilters): ReportResult {
  const pass = inSeason(content, season, f);
  const kids = new Map<string, { e: EnrollRow; classes: string[] }>();
  for (const e of data.enrollments) {
    if (!isEnrolled(e) || !pass(e.sessionId)) continue;
    const k = kids.get(e.studentId) ?? { e, classes: [] };
    k.classes.push(classTitle(content, e.sessionId));
    kids.set(e.studentId, k);
  }
  const rows = [...kids.values()].sort((a, b) => a.e.lastName.localeCompare(b.e.lastName) || a.e.firstName.localeCompare(b.e.firstName));
  return {
    columns: [{ label: 'Child' }, { label: 'Family' }, { label: 'Classes', kind: 'number' }, { label: 'Class names' }],
    rows: rows.map(({ e, classes }) => ({ cells: [nameOf(e), e.family, classes.length, [...new Set(classes)].sort().join(', ')], href: links.family(e.householdId) })),
    total: { value: rows.length ? rows.length : null, display: rows.length ? rows.length.toLocaleString('en-US') : season ? 'None yet' : 'No season yet', label: season ? `Children in ${season}` : 'Children this season' },
    empty: season ? `No children enrolled in ${season} yet.` : 'No season on the site yet.',
  };
}

// ───────────── Sign-ups by week ─────────────

/** A sign-up: an enrollment made in the season (a free trial counts; the waitlist doesn't). A child who later dropped still signed up. */
const signedUp = (e: EnrollRow) => e.status !== 'waitlist';

/**
 * Sign-ups per week, counted from the week the season's first class falls
 * in (week 1), beside last season's sign-ups in the same week of its own
 * season. Weeks before the first class count down ("3 weeks before").
 */
export function signupsByWeekFrom(data: Pick<EnrollData, 'enrollments'>, content: Pick<Content, 'findSession' | 'programs'>, season: string | null, last: string | null, today: string, f: ReportFilters): ReportResult {
  const seasons = seasonsOf(content.programs);
  const start = (term: string | null) => (term ? seasons.find((s) => s.term === term)?.start : undefined);
  const count = (term: string | null) => {
    const first = start(term);
    const out = new Map<number, number>();
    if (!term || !first) return out;
    const pass = inSeason(content, term, f);
    const week0 = weekStart(first);
    for (const e of data.enrollments) {
      if (!signedUp(e) || !pass(e.sessionId)) continue;
      const w = Math.floor(daysBetween(week0, weekStart(todayInAthens(e.createdAt))) / 7);
      out.set(w, (out.get(w) ?? 0) + 1);
    }
    return out;
  };
  const now = count(season);
  const before = count(last);
  const first = start(season);
  const weeks = [...now.keys(), ...before.keys()];
  const total = sum([...now.values()]);
  if (!season || !first || !weeks.length) {
    return {
      columns: [{ label: 'Week' }, { label: 'This season', kind: 'number' }, { label: 'Last season', kind: 'number' }],
      rows: [],
      total: { value: null, display: 'None yet', label: 'Sign-ups this season' },
      empty: 'No sign-ups yet this season.',
    };
  }
  // From the first week anyone signed up, to this week (or the last week with sign-ups).
  const thisWeek = Math.floor(daysBetween(weekStart(first), weekStart(today)) / 7);
  const from = Math.min(...weeks);
  const to = Math.max(...now.keys(), Math.min(thisWeek, Math.max(...weeks)));
  const rows: Row[] = [];
  for (let w = from; w <= to; w++) {
    const monday = addDays(weekStart(first), w * 7);
    const label = w < 0 ? `${-w} week${w === -1 ? '' : 's'} before` : `Week ${w + 1}`;
    rows.push({ cells: [`${label} (${dayShort(monday)})`, now.get(w) ?? 0, last ? (before.get(w) ?? 0) : null] });
  }
  return {
    columns: [{ label: 'Week' }, { label: season, kind: 'number' }, { label: last ?? 'Last season', kind: 'number' }],
    rows,
    total: { value: total, display: total.toLocaleString('en-US'), label: `Sign-ups in ${season}` },
    empty: 'No sign-ups yet this season.',
    note: last ? `Weeks are counted from each season’s first class.` : 'No earlier season on the site yet.',
  };
}

// ───────────── Classes at risk, and waitlists ─────────────

/**
 * Weekly classes under the 5 students a class needs, from two weeks before
 * their first class to two weeks after it: the same rule as Needs attention's
 * "Classes under 5" (today.ts).
 */
export function atRiskFrom(rows: ClassRow[], today: string, f: ReportFilters): ReportResult {
  const list = rows
    .filter((r) => {
      if (r.state === 'ended' || r.program.kind !== 'class' || isOneOff(r.session) || r.filled >= MIN_TO_RUN || !sessionPasses(f, r)) return false;
      const first = meetings(r.session)[0] ?? r.session.startDate;
      return Math.abs(daysBetween(today, first)) <= UNDER5_WINDOW_DAYS;
    })
    .sort((a, b) => a.filled - b.filled);
  return {
    columns: [{ label: 'Class' }, { label: 'When' }, { label: 'First class', kind: 'date' }, { label: 'Enrolled', kind: 'number' }, { label: 'Still needs', kind: 'number' }],
    rows: list.map((r) => ({ cells: [r.label ? `${r.program.title} (${r.label})` : r.program.title, r.when, meetings(r.session)[0] ?? r.session.startDate, r.filled, MIN_TO_RUN - r.filled], href: links.classPage(r.session.id) })),
    total: { value: list.length, display: list.length ? plural(list.length, 'class', 'classes') : 'None', label: `Under ${MIN_TO_RUN} students` },
    empty: `No classes under ${MIN_TO_RUN} right now.`,
  };
}

/** Children waiting, per current class. */
export function waitlistsFrom(rows: ClassRow[], f: ReportFilters): ReportResult {
  const list = rows.filter((r) => r.state !== 'ended' && r.waitlist > 0 && sessionPasses(f, r)).sort((a, b) => b.waitlist - a.waitlist);
  const waiting = sum(list.map((r) => r.waitlist));
  return {
    columns: [{ label: 'Class' }, { label: 'When' }, { label: 'Waiting', kind: 'number' }, { label: 'Places open', kind: 'number' }],
    rows: list.map((r) => ({ cells: [r.label ? `${r.program.title} (${r.label})` : r.program.title, r.when, r.waitlist, r.openings ?? null], href: links.classPage(r.session.id) })),
    total: { value: waiting, display: waiting ? plural(waiting, 'child', 'children') : 'Nobody', label: 'Waiting for a place' },
    empty: 'Nobody is on a waitlist.',
  };
}

// ───────────── Drops ─────────────

export const NO_REASON = 'No reason given';

/** Children who dropped, by class and reason. Older drops have no date or reason. */
export function dropsFrom(data: Pick<EnrollData, 'enrollments'>, content: Pick<Content, 'findSession'>, f: ReportFilters): ReportResult {
  const by = new Map<string, { sessionId: string; reason: string; n: number; last: string | null }>();
  for (const e of data.enrollments) {
    if (e.status !== 'cancelled' || (f.season && termOf(content, e.sessionId) !== f.season) || !sessionPasses(f, content.findSession(e.sessionId))) continue;
    const reason = e.dropReason?.trim() || NO_REASON;
    const k = `${e.sessionId}\n${reason}`;
    const g = by.get(k) ?? { sessionId: e.sessionId, reason, n: 0, last: null };
    g.n++;
    const day = e.cancelledAt ? todayInAthens(e.cancelledAt) : null;
    if (day && (!g.last || day > g.last)) g.last = day;
    by.set(k, g);
  }
  const rows = [...by.values()].sort((a, b) => classTitle(content, a.sessionId).localeCompare(classTitle(content, b.sessionId)) || b.n - a.n);
  const n = sum(rows.map((r) => r.n));
  return {
    columns: [{ label: 'Class' }, { label: 'Season' }, { label: 'Reason' }, { label: 'Drops', kind: 'number' }, { label: 'Latest', kind: 'date' }],
    rows: rows.map((r) => ({ cells: [classTitle(content, r.sessionId), termOf(content, r.sessionId) ?? '', r.reason, r.n, r.last], href: content.findSession(r.sessionId) ? links.classPage(r.sessionId) : undefined })),
    total: { value: n, display: n ? plural(n, 'drop') : 'None', label: f.season ? `Drops in ${f.season}` : 'Drops' },
    empty: f.season ? `No drops in ${f.season}.` : 'No drops.',
  };
}

// ───────────── Free class to paid ─────────────

const PAID_PLANS = new Set(['monthly', 'full', 'once']);

/**
 * Each child's free first class in the season, and whether the family then
 * signed that child up and paid (any class, after the free class was booked).
 */
export function freeClassFrom(data: EnrollData, content: Pick<Content, 'findSession'>, season: string | null, f: ReportFilters): ReportResult {
  const pass = inSeason(content, season, f);
  const people = new Map(data.enrollments.map((e) => [e.studentId, e]));
  const seen = new Set<string>();
  const trials: { studentId: string; sessionId: string; at: Date; paid: OrderLite | undefined }[] = [];
  for (const o of [...data.orders].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    if (o.plan !== 'trial' || !pass(o.sessionId)) continue;
    for (const studentId of o.studentIds) {
      if (seen.has(studentId)) continue;
      seen.add(studentId);
      const paid = data.orders
        .filter((p) => PAID_PLANS.has(p.plan) && p.studentIds.includes(studentId) && p.createdAt.getTime() >= o.createdAt.getTime())
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      trials.push({ studentId, sessionId: o.sessionId, at: o.paidAt ?? o.createdAt, paid });
    }
  }
  const converted = trials.filter((t) => t.paid).length;
  const rate = percent(converted, trials.length);
  return {
    columns: [{ label: 'Child' }, { label: 'Family' }, { label: 'Free class in' }, { label: 'Booked', kind: 'date' }, { label: 'Then paid for' }],
    rows: trials.map((t) => {
      const p = people.get(t.studentId);
      return { cells: [p ? nameOf(p) : 'A child', p?.family ?? '', classTitle(content, t.sessionId), todayInAthens(t.at), t.paid ? classTitle(content, t.paid.sessionId) : 'Not yet'], href: p ? links.family(p.householdId) : undefined };
    }),
    total: { value: trials.length ? converted : null, display: trials.length ? `${converted} of ${trials.length}` : 'None yet', label: rate === null ? 'Free class to paid' : `Free class to paid: ${Math.round(rate)}%` },
    empty: season ? `No free first classes in ${season} yet.` : 'No season on the site yet.',
  };
}

// ───────────── Coming back ─────────────

/**
 * Last season's children who are enrolled again this season, with the list
 * of who isn't back yet. Last season comes from the site when it had one;
 * otherwise from the numbers typed in from Studio Director (Settings → Last
 * season), which give a count but no names; with neither, there's nothing
 * to compare.
 */
export function comingBackFrom(data: Pick<EnrollData, 'enrollments'>, content: Pick<Content, 'findSession'>, season: string | null, last: string | null, baseline: Baseline | null, f: ReportFilters): ReportResult {
  const columns = [{ label: 'Child' }, { label: 'Family' }, { label: `Last season (${last ?? 'none'})` }, { label: 'Back?' }, { label: 'This season' }] as ReportResult['columns'];
  if (season && last) {
    const before = new Map<string, { e: EnrollRow; classes: Set<string> }>();
    const now = new Map<string, Set<string>>();
    for (const e of data.enrollments) {
      if (!isEnrolled(e)) continue;
      const term = termOf(content, e.sessionId);
      if (term === last && sessionPasses(f, content.findSession(e.sessionId))) {
        const k = before.get(e.studentId) ?? { e, classes: new Set() };
        k.classes.add(classTitle(content, e.sessionId));
        before.set(e.studentId, k);
      }
      if (term === season) now.set(e.studentId, (now.get(e.studentId) ?? new Set()).add(classTitle(content, e.sessionId)));
    }
    const rows = [...before.values()]
      .sort((a, b) => Number(now.has(a.e.studentId)) - Number(now.has(b.e.studentId)) || a.e.lastName.localeCompare(b.e.lastName))
      .map(({ e, classes }) => ({ cells: [nameOf(e), e.family, [...classes].join(', '), now.has(e.studentId) ? 'Back' : 'Not back yet', [...(now.get(e.studentId) ?? [])].join(', ')], href: links.family(e.householdId) }));
    const back = rows.filter((r) => r.cells[3] === 'Back').length;
    const rate = percent(back, rows.length);
    return {
      columns,
      rows,
      total: { value: rows.length ? back : null, display: rows.length ? `${back} of ${rows.length}` : 'Nobody last season', label: rate === null ? 'Coming back' : `Coming back from ${last}: ${Math.round(rate)}%` },
      empty: `Nobody was enrolled in ${last}.`,
    };
  }
  if (baseline?.children !== undefined && baseline.returning !== undefined) {
    const rate = percent(baseline.returning, baseline.children);
    return {
      columns,
      rows: [],
      total: { value: baseline.returning, display: `${baseline.returning} of ${baseline.children}`, label: rate === null ? `Coming back (${baseline.season})` : `Came back after ${baseline.season}: ${Math.round(rate)}%` },
      empty: `From Studio Director: ${baseline.returning} of ${baseline.children} children came back after ${baseline.season}. Names come once a season has run on the new site.`,
      note: 'Typed in from Studio Director under Settings → Last season.',
    };
  }
  return {
    columns,
    rows: [],
    total: { value: null, display: 'No earlier season yet', label: 'Coming back' },
    empty: 'No earlier season yet. This fills in once a season has run on the new site, or when last season’s numbers are typed in under Settings.',
  };
}

/** Children enrolled in a past season, for the dashboard's comparison: the site's own count, else Studio Director's. */
export function seasonChildren(data: Pick<EnrollData, 'enrollments'>, content: Pick<Content, 'findSession'>, season: string | null) {
  if (!season) return 0;
  return new Set(data.enrollments.filter((e) => isEnrolled(e) && termOf(content, e.sessionId) === season).map((e) => e.studentId)).size;
}

