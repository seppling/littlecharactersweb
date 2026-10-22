/**
 * What every report shares (docs/back-office.md → Reports): the shape of a
 * report's table and total, seasons ("this season", "last season"), and the
 * filters a report page reads from its address.
 *
 * Reports only read. Each report's counting is one function in this folder
 * (money.ts, enrollment.ts, growth.ts, safety.ts, teachers.ts), with a pure
 * half that takes plain rows, so the dashboard's number and the report's
 * table always come from the same place.
 */
import type { Program, Session } from '@/content/types';
import type { SiteContent } from '@/content/site-content';
import { formatCents } from '@/lib/pricing';
import { staffSession } from '../classes';

export type Content = Pick<SiteContent, 'programs' | 'events' | 'locationById' | 'findSession' | 'programBySlug' | 'site'>;

/** What a report needs to run: the content, today in Athens, now, and who's looking (for the audit log). */
export interface ReportContext {
  content: Content;
  today: string;
  now: Date;
}

// ───────────── Tables ─────────────

/** How a column's values read: money is in cents, a percent is 0–100. */
export type ColumnKind = 'text' | 'number' | 'money' | 'percent' | 'date';
export interface Column {
  label: string;
  kind?: ColumnKind;
}
export type Cell = string | number | null;
export interface Row {
  cells: Cell[];
  /** Where the row's first cell links (a class, a family). */
  href?: string;
}

export interface Total {
  /** The number itself (cents for money, 0–100 for a percent), or null when there's nothing to count yet. */
  value: number | null;
  /** The number in words for the tile: "$1,250", "42", "62%", "8 of 12". */
  display: string;
  /** What it is: "Collected in October 2026". */
  label: string;
}

export interface ReportResult {
  columns: Column[];
  rows: Row[];
  total: Total;
  /** Shown instead of the table when there are no rows: "No sign-ups yet this season". */
  empty: string;
  /** A line under the title, like where a number came from. */
  note?: string;
}

/** "$1,250", "−$25", "42", "62%", "Oct 20, 2026" */
export function cellText(c: Cell, kind: ColumnKind = 'text') {
  if (c === null || c === '') return '';
  if (typeof c === 'number') {
    if (kind === 'money') return c < 0 ? `−${formatCents(-c)}` : formatCents(c);
    if (kind === 'percent') return `${Math.round(c)}%`;
    return c.toLocaleString('en-US');
  }
  if (kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(c)) return new Date(`${c}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return c;
}

/**
 * A cell for a spreadsheet: money as a plain number of dollars (95, -95.5) so
 * it adds up; everything else as it reads. A number, not text: text starting
 * with "-" gets the formula guard's apostrophe (src/lib/csv.ts), which would
 * turn a refund into text that sums as nothing.
 */
export function csvCell(c: Cell, kind: ColumnKind = 'text'): Cell {
  if (typeof c === 'number' && kind === 'money') return c / 100;
  if (typeof c === 'number' && kind === 'percent') return Math.round(c);
  return c;
}

/** Rows sorted by one column (the page's ?sort=&dir=), numbers as numbers, empty cells last. */
export function sortRows(rows: Row[], column: number | undefined, dir: 'asc' | 'desc' = 'asc') {
  if (column === undefined) return rows;
  const sign = dir === 'desc' ? -1 : 1;
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => {
      const x = a.r.cells[column] ?? null;
      const y = b.r.cells[column] ?? null;
      if (x === null || x === '') return y === null || y === '' ? a.i - b.i : 1;
      if (y === null || y === '') return -1;
      const d = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en-US', { numeric: true });
      return d * sign || a.i - b.i;
    })
    .map((x) => x.r);
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
export const money = (cents: number) => (cents < 0 ? `−${formatCents(-cents)}` : formatCents(cents));
/** 62.5 → "63%"; null when there's nothing to divide by. */
export const percent = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : null);

// ───────────── Dates ─────────────

const DAY = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
export const addDays = (iso: string, days: number) => new Date(utc(iso) + days * DAY).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / DAY);
export function shiftMonth(month: string, by: number) {
  const d = new Date(`${month}-01T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return d.toISOString().slice(0, 7);
}
/** "October 2026" */
export const monthName = (month: string) => new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
/** "Oct 2026" */
export const monthShort = (month: string) => new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
/** "Oct 20" */
export const dayShort = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
/** The Monday of the week holding `iso`. */
export function weekStart(iso: string) {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return addDays(iso, -((dow + 6) % 7));
}
/** The 12 months ending with `month`, oldest first. */
export const lastTwelve = (month: string) => Array.from({ length: 12 }, (_, i) => shiftMonth(month, i - 11));

// ───────────── Seasons ─────────────

export interface Season {
  term: string;
  /** The first and last class dates of the term's sessions. */
  start: string;
  end: string;
}

/**
 * Every term in the content, in order of its first class (staff sessions:
 * the ones the site takes sign-ups for).
 */
export function seasonsOf(programs: Program[]): Season[] {
  const out = new Map<string, Season>();
  for (const p of programs)
    for (const s of p.sessions) {
      if (!staffSession(s) || !s.term) continue;
      const t = out.get(s.term);
      out.set(s.term, t ? { term: s.term, start: s.startDate < t.start ? s.startDate : t.start, end: s.endDate > t.end ? s.endDate : t.end } : { term: s.term, start: s.startDate, end: s.endDate });
    }
  return [...out.values()].sort((a, b) => a.start.localeCompare(b.start) || a.term.localeCompare(b.term));
}

/**
 * "This season": the term of the weekly classes running today, or the next
 * to start (any class when there are no weekly ones). The same rule as a
 * family's page (currentTerm in families.ts).
 */
export function thisSeason(programs: Program[], today: string): string | null {
  const pick = (list: Program[]) => {
    const sessions = list.flatMap((p) => p.sessions.filter(staffSession));
    const running = sessions.filter((s) => s.startDate <= today && s.endDate >= today).sort((a, b) => b.startDate.localeCompare(a.startDate));
    const next = sessions.filter((s) => s.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate));
    return (running[0] ?? next[0])?.term ?? null;
  };
  return pick(programs.filter((p) => p.kind === 'class')) ?? pick(programs);
}

/**
 * "Last season": the latest term that had ended before this one began. A
 * long term that overlaps this one (Fall to Spring) isn't "last season".
 * Null when the site has no earlier term; the dashboard then uses the numbers
 * typed in from Studio Director (Settings → Last season), or says so.
 */
export function lastSeason(programs: Program[], current: string | null): string | null {
  if (!current) return null;
  const all = seasonsOf(programs);
  const now = all.find((s) => s.term === current);
  if (!now) return null;
  const before = all.filter((s) => s.term !== current && s.end < now.start).sort((a, b) => b.end.localeCompare(a.end));
  return before[0]?.term ?? null;
}

export const termOf = (content: Pick<Content, 'findSession'>, sessionId: string) => content.findSession(sessionId)?.session.term ?? null;

// ───────────── Filters ─────────────

/** Everything a report page can be filtered by. Each report says which it uses (library.ts). */
export interface ReportFilters {
  /** A term: "Fall 2026". */
  season?: string;
  /** "2026-10" */
  month?: string;
  /** A program's slug. */
  program?: string;
  /** A location's id. */
  location?: string;
  /** A session id (one class). */
  class?: string;
  /** A show's slug. */
  show?: string;
  /** Any date in the week (YYYY-MM-DD). */
  week?: string;
  /** Families: new this season, or every family with a class this season. */
  who?: 'new' | 'all';
  /** The column to sort by, and which way. */
  sort?: number;
  dir?: 'asc' | 'desc';
}

const isMonth = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const clean = (s: string | null, max = 120) => {
  const t = s?.trim();
  return t && t.length <= max ? t : undefined;
};

export function readFilters(params: URLSearchParams): ReportFilters {
  const f: ReportFilters = {};
  const season = clean(params.get('season'));
  if (season) f.season = season;
  const month = params.get('month');
  if (month && isMonth(month)) f.month = month;
  for (const k of ['program', 'location', 'class', 'show'] as const) {
    const v = clean(params.get(k));
    if (v) f[k] = v;
  }
  const week = params.get('week');
  if (week && isDate(week)) f.week = week;
  const who = params.get('who');
  if (who === 'new' || who === 'all') f.who = who;
  const sort = params.get('sort');
  if (sort && /^\d{1,2}$/.test(sort)) f.sort = Number(sort);
  const dir = params.get('dir');
  if (dir === 'asc' || dir === 'desc') f.dir = dir;
  return f;
}

/** The query string for a set of filters, the reverse of readFilters ("" when none). */
export function filterQuery(f: ReportFilters) {
  const q = new URLSearchParams();
  for (const k of ['season', 'month', 'program', 'location', 'class', 'show', 'week', 'who'] as const) if (f[k]) q.set(k, String(f[k]));
  if (f.sort !== undefined) q.set('sort', String(f.sort));
  if (f.dir) q.set('dir', f.dir);
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** Does a class pass the program and location filters? */
export function sessionPasses(f: Pick<ReportFilters, 'program' | 'location' | 'class'>, found: { program: Program; session: Session } | undefined) {
  if (!f.program && !f.location && !f.class) return true;
  if (!found) return false;
  return (!f.program || found.program.slug === f.program) && (!f.location || found.session.locationId === f.location) && (!f.class || found.session.id === f.class);
}

/** "Fall 2026: Intro to Theater (Ages 4–6)" style title of a class, for tables. */
export function classTitle(content: Pick<Content, 'findSession'>, sessionId: string) {
  const found = content.findSession(sessionId);
  if (!found) return 'A class no longer on the site';
  const label = found.session.label?.trim();
  return label ? `${found.program.title} (${label})` : found.program.title;
}
