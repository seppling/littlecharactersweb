/**
 * Teacher reports (docs/back-office.md → Reports): who teaches what and when,
 * and attendance taken for each teacher's classes. Reads only.
 *
 * A class's teachers are the people on it in Settings → Staff (leads first);
 * a class with nobody there uses the teacher named on the site.
 */
import { and, eq, gte, lte } from 'drizzle-orm';
import * as links from '@/lib/admin-links';
import { meetings } from '@/lib/pricing';
import { endedHoursAgo } from '../attendance';
import { dayOffFrom, daysOffBetween, dropInCounts, type DayOff } from '../class-day';
import type { ClassRow } from '../classes';
import { getDb, schema } from '../db';
import { percent, plural, seasonsOf, sessionPasses, sum, type Content, type ReportFilters, type ReportResult } from './common';

export interface TeacherLink {
  sessionId: string;
  name: string;
  role: 'lead' | 'assistant';
}

export async function loadTeacherLinks(): Promise<TeacherLink[]> {
  const db = await getDb();
  const { classTeacher, staff } = schema;
  return db.select({ sessionId: classTeacher.sessionId, name: staff.name, role: classTeacher.role }).from(classTeacher).innerJoin(staff, eq(staff.id, classTeacher.staffId));
}

const ROLE = { lead: 'Teaches', assistant: 'Assists', site: 'Named on the site' } as const;

/** Each class's teachers: Settings → Staff's, leads first, else the site's name. */
export function teachersOf(r: ClassRow, links_: TeacherLink[]) {
  const mine = links_.filter((l) => l.sessionId === r.session.id).sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'lead' ? -1 : 1));
  if (mine.length) return mine.map((l) => ({ name: l.name, role: ROLE[l.role] }));
  return r.teacher ? [{ name: r.teacher, role: ROLE.site }] : [];
}

/** Every class in the season under each of its teachers, with when and where. */
export function teacherClassesFrom(classes: ClassRow[], teacherLinks: TeacherLink[], season: string | null, f: ReportFilters): ReportResult {
  const rows = classes
    .filter((r) => !!season && r.term === season && sessionPasses(f, r))
    .flatMap((r) => teachersOf(r, teacherLinks).map((t) => ({ t, r })))
    .sort((a, b) => a.t.name.localeCompare(b.t.name) || a.r.session.days.join().localeCompare(b.r.session.days.join()) || a.r.session.start.localeCompare(b.r.session.start));
  const teachers = new Set(rows.map((x) => x.t.name)).size;
  return {
    columns: [{ label: 'Teacher' }, { label: 'Class' }, { label: 'When' }, { label: 'Where' }, { label: 'Role' }],
    rows: rows.map(({ t, r }) => ({ cells: [t.name, r.label ? `${r.program.title} (${r.label})` : r.program.title, r.when, r.location, t.role], href: links.classPage(r.session.id) })),
    total: { value: season ? teachers : null, display: season ? plural(teachers, 'teacher') : 'No season yet', label: season ? `Teaching in ${season}` : 'Teachers' },
    empty: season ? `No teachers on ${season}’s classes yet. Add them under Settings → Staff.` : 'No season on the site yet.',
  };
}

export interface TeacherAttendanceInput {
  classes: ClassRow[];
  teacherLinks: TeacherLink[];
  reports: Set<string>;
  daysOff: DayOff[];
  dropIns: Map<string, number>;
}

/**
 * For each teacher, the season's class dates so far that needed attendance
 * (children expected, not a day off, ended 2 hours ago) and how many were
 * taken. A class with two teachers counts for both, and once in the total.
 */
export function teacherAttendanceFrom(input: TeacherAttendanceInput, season: string | null, today: string, now: Date, f: ReportFilters): ReportResult {
  const by = new Map<string, { classes: Set<string>; due: number; taken: number }>();
  // The total counts each class date once, however many teachers it has.
  const dueDates = new Set<string>();
  const takenDates = new Set<string>();
  for (const r of input.classes) {
    if (!season || r.term !== season || !sessionPasses(f, r)) continue;
    const teachers = teachersOf(r, input.teacherLinks);
    for (const d of meetings(r.session)) {
      const key = `${r.session.id} ${d}`;
      if (d > today || (d === today && !endedHoursAgo(d, r.session.end, now))) continue;
      if (dayOffFrom(input.daysOff, r.session.id, d) || (r.filled === 0 && !input.dropIns.get(key))) continue;
      if (teachers.length) {
        dueDates.add(key);
        if (input.reports.has(key)) takenDates.add(key);
      }
      for (const t of teachers) {
        const g = by.get(t.name) ?? { classes: new Set(), due: 0, taken: 0 };
        g.classes.add(r.session.id);
        g.due++;
        if (input.reports.has(key)) g.taken++;
        by.set(t.name, g);
      }
    }
  }
  const rows = [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const due = dueDates.size;
  const taken = takenDates.size;
  return {
    columns: [{ label: 'Teacher' }, { label: 'Classes', kind: 'number' }, { label: 'Class dates so far', kind: 'number' }, { label: 'Taken', kind: 'number' }, { label: 'Not taken', kind: 'number' }, { label: 'Taken', kind: 'percent' }],
    rows: rows.map(([name, g]) => ({ cells: [name, g.classes.size, g.due, g.taken, g.due - g.taken, percent(g.taken, g.due)] })),
    total: { value: due ? taken : null, display: due ? `${taken} of ${due}` : 'No class dates yet', label: season ? `Attendance taken in ${season}` : 'Attendance taken' },
    empty: season ? `No class dates in ${season} have needed attendance yet.` : 'No season on the site yet.',
  };
}

export async function loadTeacherAttendance(classes: ClassRow[], content: Pick<Content, 'programs'>, season: string | null, today: string): Promise<TeacherAttendanceInput> {
  const s = seasonsOf(content.programs).find((x) => x.term === season);
  const from = s?.start ?? today;
  const to = s && s.end < today ? s.end : today;
  const db = await getDb();
  const { classReport } = schema;
  const [teacherLinks, reports, daysOff, dropIns] = await Promise.all([
    loadTeacherLinks(),
    db
      .select({ sessionId: classReport.sessionId, classDate: classReport.classDate })
      .from(classReport)
      .where(and(gte(classReport.classDate, from), lte(classReport.classDate, to))),
    daysOffBetween(from, to),
    dropInCounts(from, to),
  ]);
  return { classes, teacherLinks, reports: new Set(reports.map((r) => `${r.sessionId} ${r.classDate}`)), daysOff, dropIns };
}
