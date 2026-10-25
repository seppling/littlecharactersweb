/**
 * The staff calendar (docs/back-office.md → Calendar and days off): every
 * class and event on one calendar, with days off, for a month or a week.
 *
 * - calendarDays: the pure half. Each day's classes (time, class, "8/12",
 *   teacher, where), the site's events that day, and its days off, filtered
 *   by program, location and teacher.
 * - calendarRange: loads the classes, counts, teachers and days off, then
 *   calls calendarDays.
 * - scheduleTables: the month as Studio Director's "Daily Class Schedule"
 *   (one row per class and date) and "Class Schedule" (one row per class).
 *
 * Teachers come from Settings → Staff (class_teacher), leads first; a class
 * with none there shows the content's teacher name.
 *
 * Rehearsals (src/server/shows.ts) show in their own color, linking to the
 * show's staff page.
 */
import { asc, eq } from 'drizzle-orm';
import type { EventItem } from '@/content/types';
import type { SiteContent } from '@/content/site-content';
import * as links from '@/lib/admin-links';
import { timeRange } from '@/lib/format';
import { meetings, todayInAthens } from '@/lib/pricing';
import { bookingClock } from '@/lib/session-dates';
import { sessionCounts } from './admin';
import { dayOffFrom, daysOffBetween, type DayOff } from './class-day';
import { classRows, type ClassRow } from './classes';
import { getDb, schema } from './db';
import { athensParts, findShow, rehearsalsBetween, rehearsingLabel, rehearsingSessions } from './shows';

type Content = Pick<SiteContent, 'programs' | 'events' | 'locationById' | 'site' | 'findSession'>;

const DAY = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const addDays = (date: string, n: number) => iso(utc(date) + n * DAY);
export const datesFromTo = (from: string, to: string) => {
  const out: string[] = [];
  for (let t = utc(from); t <= utc(to); t += DAY) out.push(iso(t));
  return out;
};

// ───────────── Months and weeks ─────────────

const monthRe = /^\d{4}-(0[1-9]|1[0-2])$/;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

/** The month asked for ("2026-11"), else this month. */
export const calendarMonth = (param: string | null | undefined, today = todayInAthens()) => (param && monthRe.test(param) ? param : today.slice(0, 7));
export const shiftMonth = (month: string, by: number) => {
  const d = new Date(utc(`${month}-01`));
  d.setUTCMonth(d.getUTCMonth() + by);
  return iso(d.getTime()).slice(0, 7);
};
export const monthTitle = (month: string) => new Date(utc(`${month}-01`)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
export const lastOfMonth = (month: string) => addDays(`${shiftMonth(month, 1)}-01`, -1);
/** The Sunday on or before a date: weeks start on Sunday, like a wall calendar. */
export const weekStart = (date: string) => addDays(date, -new Date(utc(date)).getUTCDay());
/** The week asked for (any date in it), else this week. */
export const calendarWeek = (param: string | null | undefined, today = todayInAthens()) => weekStart(param && dateRe.test(param) && !Number.isNaN(utc(param)) ? param : today);
/** "Nov 22–28, 2026" */
export function weekTitle(start: string) {
  const end = addDays(start, 6);
  const a = new Date(utc(start)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const b = new Date(utc(end)).toLocaleDateString('en-US', start.slice(0, 7) === end.slice(0, 7) ? { day: 'numeric', timeZone: 'UTC' } : { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${a}–${b}, ${end.slice(0, 4)}`;
}
/** The month grid: whole weeks, Sunday to Saturday, around the month. */
export function monthGrid(month: string) {
  const first = weekStart(`${month}-01`);
  const last = addDays(weekStart(lastOfMonth(month)), 6);
  return datesFromTo(first, last);
}

// ───────────── Filters ─────────────

export interface CalendarFilters {
  /** A program's slug. */
  program?: string;
  /** A location's id. */
  location?: string;
  /** A teacher's name, as shown. */
  teacher?: string;
}

export function calendarFilters(params: URLSearchParams): CalendarFilters {
  const get = (k: string) => params.get(k)?.trim() || undefined;
  return { program: get('program'), location: get('location'), teacher: get('teacher') };
}

/** "Intro to Theater · Studio · Hannah", for the PDF. */
export function filtersLabel(f: CalendarFilters, content: Pick<Content, 'programs' | 'locationById'>) {
  const program = f.program ? content.programs.find((p) => p.slug === f.program)?.title : undefined;
  const location = f.location ? content.locationById(f.location)?.shortName : undefined;
  return [program, location, f.teacher].filter(Boolean).join(' · ') || 'Every class';
}

// ───────────── The days ─────────────

export interface CalendarEntry {
  kind: 'class' | 'event' | 'rehearsal';
  /** "16:30", for sorting; empty when an event has no time. */
  start: string;
  /** "4:30–5:30 pm" */
  time: string;
  title: string;
  /** The session's label ("Ages 4–6"), when it says more than the date. */
  label: string;
  location: string;
  /** Leads first, then assistants; or the content's teacher. */
  teacher: string;
  /** "8/12": enrolled and trials, of the places. Empty for an event. */
  places: string;
  sessionId: string | null;
  /** The class's staff page, the event's page on the site, or a rehearsal's show (staff). */
  href: string;
  /** That date's attendance roster (the teacher app); classes only. */
  rosterHref: string | null;
  /** The reason, when this class has the day off. */
  dayOff: string | null;
}

export interface CalendarDay {
  date: string;
  /** A day off for every class that day. */
  dayOff: DayOff | null;
  entries: CalendarEntry[];
}

/** A show's rehearsal, as the calendar shows it (times in Athens). */
export interface CalendarRehearsal {
  id: string;
  showSlug: string;
  showTitle: string;
  date: string;
  /** "10:00" */
  start: string;
  end: string;
  locationId: string | null;
  location: string;
  /** The classes that rehearse (for the whole cast: the performing classes' current sessions). */
  sessionIds: string[];
  /** "Stories and Songs", or "Whole cast". */
  classes: string;
}

export interface CalendarData {
  rows: ClassRow[];
  events: EventItem[];
  daysOff: DayOff[];
  /** Session id → teacher names, leads first (Settings → Staff). */
  teachers: Map<string, string[]>;
  rehearsals?: CalendarRehearsal[];
}

const teacherOf = (r: ClassRow, teachers: Map<string, string[]>) => teachers.get(r.session.id)?.join(', ') || r.teacher;

/** Pure: each date's classes and events, with days off, as filtered. */
export function calendarDays(data: CalendarData, dates: string[], f: CalendarFilters, content: Pick<Content, 'locationById'>): CalendarDay[] {
  const rows = data.rows.filter(
    (r) =>
      (!f.program || r.program.slug === f.program) &&
      (!f.location || r.session.locationId === f.location) &&
      (!f.teacher || (data.teachers.get(r.session.id) ?? [r.teacher]).includes(f.teacher)),
  );
  const meetsOn = new Map(rows.map((r) => [r.session.id, new Set(meetings(r.session))]));
  return dates.map((date) => {
    const meeting = rows.filter((r) => meetsOn.get(r.session.id)!.has(date));
    const entries: CalendarEntry[] = meeting.map((r) => ({
      kind: 'class',
      start: r.session.start,
      time: r.session.start && r.session.end ? timeRange(r.session.start, r.session.end) : '',
      title: r.program.title,
      label: r.label,
      location: r.location,
      teacher: teacherOf(r, data.teachers),
      places: r.capacity === undefined ? `${r.filled}` : `${r.filled}/${r.capacity}`,
      sessionId: r.session.id,
      href: links.classPage(r.session.id),
      rosterHref: links.teachRoster(r.session.id, date),
      dayOff: dayOffFrom(data.daysOff, r.session.id, date)?.reason ?? null,
    }));
    // Events: not when filtering by teacher; by program and location when those are set.
    const booked = new Set(meeting.map((r) => r.program.slug));
    if (!f.teacher) {
      for (const e of data.events) {
        if (e.programSlug && booked.has(e.programSlug)) continue;
        if (f.program && e.programSlug !== f.program) continue;
        if (f.location && e.locationId !== f.location) continue;
        for (const t of e.times) {
          if (t.start.slice(0, 10) !== date) continue;
          const start = t.start.slice(11, 16);
          const end = t.end?.slice(11, 16) ?? '';
          entries.push({
            kind: 'event',
            start,
            time: start && end ? timeRange(start, end) : '',
            title: e.title,
            label: '',
            location: e.venue || content.locationById(e.locationId)?.shortName || '',
            teacher: '',
            places: '',
            sessionId: null,
            href: e.kind === 'show' ? `/events/${e.slug}` : `/events#${e.slug}`,
            rosterHref: null,
            dayOff: null,
          });
        }
      }
    }
    // Rehearsals: by a rehearsing class's program, the rehearsal's place, or a rehearsing class's teacher.
    for (const r of data.rehearsals ?? []) {
      if (r.date !== date) continue;
      const classes = data.rows.filter((row) => r.sessionIds.includes(row.session.id));
      if (f.program && !classes.some((c) => c.program.slug === f.program)) continue;
      if (f.location && r.locationId !== f.location) continue;
      if (f.teacher && !classes.some((c) => (data.teachers.get(c.session.id) ?? [c.teacher]).includes(f.teacher!))) continue;
      entries.push({
        kind: 'rehearsal',
        start: r.start,
        time: timeRange(r.start, r.end),
        title: `Rehearsal: ${r.showTitle}`,
        label: r.classes,
        location: r.location,
        teacher: '',
        places: '',
        sessionId: null,
        href: links.show(r.showSlug),
        rosterHref: null,
        dayOff: null,
      });
    }
    entries.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title));
    return { date, dayOff: data.daysOff.find((d) => d.date === date && d.sessionId === null) ?? null, entries };
  });
}

/** Teacher names per class, leads first, from Settings → Staff (people turned off included: the class is still theirs on paper). */
export async function teachersBySession(): Promise<Map<string, string[]>> {
  const db = await getDb();
  const rows = await db
    .select({ sessionId: schema.classTeacher.sessionId, name: schema.staff.name, role: schema.classTeacher.role })
    .from(schema.classTeacher)
    .innerJoin(schema.staff, eq(schema.staff.id, schema.classTeacher.staffId))
    .orderBy(asc(schema.classTeacher.role), asc(schema.staff.name));
  const out = new Map<string, string[]>();
  for (const r of rows) out.set(r.sessionId, [...(out.get(r.sessionId) ?? []), r.name]);
  return out;
}

/** The rehearsals starting on these dates, for the calendar. */
export async function calendarRehearsals(content: Content, from: string, to: string): Promise<CalendarRehearsal[]> {
  return (await rehearsalsBetween(from, to)).map((r) => {
    const show = findShow(content, r.showSlug);
    const a = athensParts(r.startsAt);
    return {
      id: r.id,
      showSlug: r.showSlug,
      showTitle: show?.title ?? r.showSlug,
      date: a.date,
      start: a.time,
      end: athensParts(r.endsAt).time,
      locationId: r.locationId,
      location: r.locationId ? (content.locationById(r.locationId)?.shortName ?? '') : '',
      sessionIds: rehearsingSessions(r, show, content),
      classes: rehearsingLabel(r, content),
    };
  });
}

/** Everything the calendar page needs for these dates. */
export async function calendarRange(content: Content, from: string, to: string, f: CalendarFilters, now = new Date()) {
  const [counts, daysOff, teachers, rehearsals] = await Promise.all([sessionCounts(), daysOffBetween(from, to), teachersBySession(), calendarRehearsals(content, from, to)]);
  const rows = classRows(content, counts, bookingClock(content.site.lateJoinWeeks, now));
  const data: CalendarData = { rows, events: content.events, daysOff, teachers, rehearsals };
  return { days: calendarDays(data, datesFromTo(from, to), f, content), options: filterOptions(rows, teachers, content) };
}

/** What the filters offer: programs and places with classes on the calendar, and every teacher. */
export function filterOptions(rows: ClassRow[], teachers: Map<string, string[]>, content: Pick<Content, 'locationById'>) {
  const programs = [...new Map(rows.map((r) => [r.program.slug, r.program.title])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const locations = [...new Map(rows.map((r) => [r.session.locationId, content.locationById(r.session.locationId)?.shortName ?? r.session.locationId])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const names = [...new Set(rows.flatMap((r) => teachers.get(r.session.id) ?? (r.teacher ? [r.teacher] : [])))].sort((a, b) => a.localeCompare(b));
  return { programs, locations, teachers: names };
}

// ───────────── Downloads ─────────────

const longDate = (d: string) => new Date(utc(d)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Studio Director's "Daily Class Schedule": one row per class or event and date. */
export function dailyScheduleTable(days: CalendarDay[]) {
  return {
    headers: ['Date', 'Time', 'Class', 'Location', 'Teacher', 'Students', 'Day off'],
    rows: days.flatMap((d) =>
      d.entries.length
        ? d.entries.map((e) => [longDate(d.date), e.time, e.label ? `${e.title} (${e.label})` : e.title, e.location, e.teacher, e.places, e.dayOff ?? ''])
        : d.dayOff
          ? [[longDate(d.date), '', 'No classes', '', '', '', d.dayOff.reason]]
          : [],
    ),
  };
}

/** Studio Director's "Class Schedule": one row per class meeting that month, with its dates and days off. */
export function classScheduleTable(days: CalendarDay[]) {
  const byClass = new Map<string, { e: CalendarEntry; dates: string[]; off: string[] }>();
  for (const d of days) {
    for (const e of d.entries) {
      if (e.kind !== 'class' || !e.sessionId) continue;
      const c = byClass.get(e.sessionId) ?? { e, dates: [], off: [] };
      (e.dayOff ? c.off : c.dates).push(e.dayOff ? `${d.date.slice(5).replace('-', '/')} (${e.dayOff})` : d.date.slice(5).replace('-', '/'));
      byClass.set(e.sessionId, c);
    }
  }
  return {
    headers: ['Class', 'Time', 'Location', 'Teacher', 'Students', 'Classes', 'Dates', 'Days off'],
    rows: [...byClass.values()]
      .sort((a, b) => a.e.title.localeCompare(b.e.title) || a.e.start.localeCompare(b.e.start))
      .map(({ e, dates, off }) => [e.label ? `${e.title} (${e.label})` : e.title, e.time, e.location, e.teacher, e.places, String(dates.length), dates.join(', '), off.join(', ')]),
  };
}

export type ScheduleReport = 'daily' | 'classes';
export const scheduleReport = (params: URLSearchParams): ScheduleReport => (params.get('report') === 'classes' ? 'classes' : 'daily');

/** One download's rows, the same the page shows (a month, as filtered). */
export async function scheduleDownload(content: Content, params: URLSearchParams) {
  const month = calendarMonth(params.get('month'));
  const f = calendarFilters(params);
  const { days } = await calendarRange(content, `${month}-01`, lastOfMonth(month), f);
  const report = scheduleReport(params);
  const table = report === 'classes' ? classScheduleTable(days) : dailyScheduleTable(days);
  return { month, report, table, title: report === 'classes' ? 'Class Schedule' : 'Daily Class Schedule', subtitle: `${monthTitle(month)} · ${filtersLabel(f, content)}` };
}
