/**
 * Safety and attendance reports (docs/back-office.md → Reports): care details
 * on file, missed two in a row, attendance taken, absences, the allergy and
 * medical list for a class, and photo permission. Reads only.
 *
 * Only the allergy and medical list decrypts care details, through the
 * class roster (`roster` in admin.ts, which logs the view); the page asks for
 * a fresh sign-in first. The others say "on file" or not, never what.
 */
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import * as links from '@/lib/admin-links';
import { meetings } from '@/lib/pricing';
import { detailsOnFile } from '@/lib/student-details';
import { roster } from '../admin';
import { endedHoursAgo, missedTwo } from '../attendance';
import { dayOffFrom, daysOffBetween, dropInCounts, type DayOff } from '../class-day';
import type { ClassRow } from '../classes';
import { getDb, schema } from '../db';
import { castList } from '../shows';
import { addDays, classTitle, dayShort, plural, sessionPasses, termOf, weekStart, type Content, type ReportContext, type ReportFilters, type ReportResult } from './common';

const { enrollment, student, household, attendance, classReport, user } = schema;

const nameOf = (x: { firstName: string; lastName: string }) => `${x.firstName} ${x.lastName}`.trim();

// ───────────── Care details on file ─────────────

export interface CareRow {
  studentId: string;
  firstName: string;
  lastName: string;
  householdId: string;
  family: string;
  sessionId: string;
  detailsConfirmedAt: Date | null;
  emergencyContacts: number;
  pickupPeople: number;
}

/** Every enrolled (active or trial) child, with yes/no facts about their family's details. No care details. */
export async function loadCare(): Promise<CareRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      householdId: household.id,
      family: household.name,
      sessionId: enrollment.sessionId,
      detailsConfirmedAt: student.detailsConfirmedAt,
      emergencyContacts: household.emergencyContacts,
      pickupPeople: household.pickupPeople,
    })
    .from(enrollment)
    .innerJoin(student, eq(student.id, enrollment.studentId))
    .innerJoin(household, eq(household.id, enrollment.householdId))
    .where(inArray(enrollment.status, ['active', 'trial']));
  return rows.map((r) => ({ ...r, emergencyContacts: r.emergencyContacts.length, pickupPeople: r.pickupPeople.length }));
}

const current = (content: Pick<Content, 'findSession'>, today: string, f: ReportFilters) => (sessionId: string) => {
  const found = content.findSession(sessionId);
  return !!found && found.session.endDate >= today && sessionPasses(f, found);
};

/**
 * Each child in a class that hasn't ended, counted once: details confirmed by
 * a parent within a year, at least one emergency contact, and a pickup list.
 */
export function careFrom(rows: CareRow[], content: Pick<Content, 'findSession'>, today: string, now: Date, f: ReportFilters): ReportResult {
  const pass = current(content, today, f);
  const kids = new Map<string, CareRow>();
  for (const r of rows) if (pass(r.sessionId) && !kids.has(r.studentId)) kids.set(r.studentId, r);
  const list = [...kids.values()]
    .map((r) => ({ r, details: detailsOnFile(r, now), emergency: r.emergencyContacts > 0, pickup: r.pickupPeople > 0 }))
    .map((x) => ({ ...x, all: x.details && x.emergency && x.pickup }))
    .sort((a, b) => Number(a.all) - Number(b.all) || a.r.lastName.localeCompare(b.r.lastName));
  const yes = (b: boolean) => (b ? 'Yes' : 'No');
  const done = list.filter((x) => x.all).length;
  return {
    columns: [{ label: 'Child' }, { label: 'Family' }, { label: 'Details confirmed' }, { label: 'Emergency contact' }, { label: 'Pickup list' }, { label: 'All on file' }],
    rows: list.map((x) => ({ cells: [nameOf(x.r), x.r.family, yes(x.details), yes(x.emergency), yes(x.pickup), yes(x.all)], href: links.family(x.r.householdId) })),
    total: { value: list.length ? done : null, display: list.length ? `${done} of ${list.length}` : 'Nobody enrolled', label: 'Children with everything on file' },
    empty: 'No children in a current class.',
  };
}

// ───────────── Missed two in a row ─────────────

/** Children absent from their last two marked classes, in classes that haven't ended. */
export async function missedTwoReport(ctx: ReportContext, f: ReportFilters): Promise<ReportResult> {
  const pass = current(ctx.content, ctx.today, f);
  const missed = (await missedTwo()).filter((m) => pass(m.sessionId));
  const db = await getDb();
  const people = missed.length
    ? new Map(
        (
          await db
            .select({ id: student.id, firstName: student.firstName, lastName: student.lastName, householdId: household.id, family: household.name })
            .from(student)
            .innerJoin(household, eq(household.id, student.householdId))
            .where(inArray(student.id, [...new Set(missed.map((m) => m.studentId))]))
        ).map((s) => [s.id, s]),
      )
    : new Map();
  const rows = missed
    .map((m) => ({ m, p: people.get(m.studentId) }))
    .filter((x) => x.p)
    .sort((a, b) => b.m.dates[0].localeCompare(a.m.dates[0]))
    .map(({ m, p }) => ({ cells: [nameOf(p), p.family, classTitle(ctx.content, m.sessionId), `${dayShort(m.dates[1])} and ${dayShort(m.dates[0])}`], href: links.family(p.householdId) }));
  const children = new Set(missed.map((m) => m.studentId)).size;
  return {
    columns: [{ label: 'Child' }, { label: 'Family' }, { label: 'Class' }, { label: 'Missed' }],
    rows,
    total: { value: children, display: children ? plural(children, 'child', 'children') : 'Nobody', label: 'Missed their last two classes' },
    empty: 'Nobody has missed two in a row.',
  };
}

// ───────────── Attendance taken ─────────────

export interface TakenInput {
  classes: ClassRow[];
  /** "sessionId date" → who sent it, for the class dates with attendance done. */
  reports: Map<string, string>;
  daysOff: DayOff[];
  dropIns: Map<string, number>;
  /** "sessionId date" → children marked there (present, late or left early). */
  present: Map<string, number>;
}

/**
 * The class dates in one week (Monday to Sunday) that should have attendance
 * by now: classes with children that met and ended 2 hours ago, not on a day
 * off. The same rule as Needs attention's "Attendance not taken".
 */
export function attendanceTakenFrom(input: TakenInput, week: string, now: Date, today: string, f: ReportFilters): ReportResult {
  const monday = weekStart(week);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const rows: { date: string; r: ClassRow; by: string | undefined }[] = [];
  for (const d of days) {
    for (const r of input.classes) {
      const key = `${r.session.id} ${d}`;
      if (!sessionPasses(f, r) || !meetings(r.session).includes(d) || (r.filled === 0 && !input.dropIns.get(key))) continue;
      if (dayOffFrom(input.daysOff, r.session.id, d)) continue;
      if (!(d < today || (d === today && endedHoursAgo(d, r.session.end, now)))) continue;
      rows.push({ date: d, r, by: input.reports.get(key) });
    }
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.r.session.start.localeCompare(b.r.session.start));
  const done = rows.filter((x) => x.by !== undefined).length;
  return {
    columns: [{ label: 'Date', kind: 'date' }, { label: 'Class' }, { label: 'Teacher' }, { label: 'Taken' }, { label: 'There', kind: 'number' }],
    rows: rows.map(({ date, r, by }) => ({
      cells: [date, r.label ? `${r.program.title} (${r.label})` : r.program.title, r.teacher, by === undefined ? 'Not yet' : by ? `Yes, by ${by}` : 'Yes', by === undefined ? null : (input.present.get(`${r.session.id} ${date}`) ?? 0)],
      href: links.teachRoster(r.session.id, date),
    })),
    total: { value: rows.length ? done : null, display: rows.length ? `${done} of ${rows.length}` : 'No classes yet', label: `Attendance taken, week of ${dayShort(monday)}` },
    empty: `No classes due attendance in the week of ${dayShort(monday)} yet.`,
  };
}

export async function loadTaken(classes: ClassRow[], week: string): Promise<TakenInput> {
  const from = weekStart(week);
  const to = addDays(from, 6);
  const db = await getDb();
  const [reports, daysOff, dropIns, marks] = await Promise.all([
    db
      .select({ sessionId: classReport.sessionId, classDate: classReport.classDate, by: user.name, email: user.email })
      .from(classReport)
      .leftJoin(user, eq(user.id, classReport.submittedBy))
      .where(and(gte(classReport.classDate, from), lte(classReport.classDate, to))),
    daysOffBetween(from, to),
    dropInCounts(from, to),
    db
      .select({ sessionId: attendance.sessionId, classDate: attendance.classDate, status: attendance.status })
      .from(attendance)
      .where(and(gte(attendance.classDate, from), lte(attendance.classDate, to))),
  ]);
  const present = new Map<string, number>();
  for (const m of marks) if (m.status !== 'absent') present.set(`${m.sessionId} ${m.classDate}`, (present.get(`${m.sessionId} ${m.classDate}`) ?? 0) + 1);
  return { classes, reports: new Map(reports.map((r) => [`${r.sessionId} ${r.classDate}`, r.by || r.email || ''])), daysOff, dropIns, present };
}

// ───────────── Absences ─────────────

export interface MarkRow {
  sessionId: string;
  classDate: string;
  status: string;
  reason: string | null;
  studentId: string;
  firstName: string;
  lastName: string;
  householdId: string;
  family: string;
}

export async function loadMarks(): Promise<MarkRow[]> {
  const db = await getDb();
  return db
    .select({
      sessionId: attendance.sessionId,
      classDate: attendance.classDate,
      status: attendance.status,
      reason: attendance.reason,
      studentId: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      householdId: household.id,
      family: household.name,
    })
    .from(attendance)
    .innerJoin(student, eq(student.id, attendance.studentId))
    .innerJoin(household, eq(household.id, student.householdId))
    .where(eq(attendance.status, 'absent'));
}

/** Every absence in the season, newest first, with the reason when one was picked. */
export function absencesFrom(marks: MarkRow[], content: Pick<Content, 'findSession'>, season: string | null, f: ReportFilters): ReportResult {
  const rows = marks
    .filter((m) => m.status === 'absent' && !!season && termOf(content, m.sessionId) === season && sessionPasses(f, content.findSession(m.sessionId)))
    .sort((a, b) => b.classDate.localeCompare(a.classDate) || a.lastName.localeCompare(b.lastName));
  return {
    columns: [{ label: 'Date', kind: 'date' }, { label: 'Child' }, { label: 'Family' }, { label: 'Class' }, { label: 'Reason' }],
    rows: rows.map((m) => ({ cells: [m.classDate, nameOf(m), m.family, classTitle(content, m.sessionId), m.reason ?? ''], href: links.family(m.householdId) })),
    total: { value: season ? rows.length : null, display: season ? (rows.length ? plural(rows.length, 'absence') : 'None') : 'No season yet', label: season ? `Absences in ${season}` : 'Absences' },
    empty: season ? `No absences marked in ${season}.` : 'No season on the site yet.',
  };
}


// ───────────── Allergies and medical notes (decrypted) ─────────────

/**
 * One class's children with their allergies and medical notes, decrypted.
 * Read through the roster, which writes `admin.report.allergies` to the
 * audit log for the class. The page asks for a fresh sign-in first.
 */
export async function allergyList(ctx: ReportContext, f: ReportFilters, viewerId: string): Promise<ReportResult> {
  const columns = [{ label: 'Child' }, { label: 'Allergies' }, { label: 'Medical notes' }, { label: 'Family' }];
  const found = f.class ? ctx.content.findSession(f.class) : undefined;
  if (!found) return { columns, rows: [], total: { value: null, display: 'Pick a class', label: 'Allergies and medical notes' }, empty: 'Pick a class to see its allergies and medical notes.' };
  const kids = (await roster(found.session.id, viewerId, 'admin.report.allergies')).filter((k) => k.status === 'active' || k.status === 'trial');
  const listed = kids.filter((k) => k.student.allergies || k.student.medicalNotes);
  return {
    columns,
    rows: kids
      .sort((a, b) => Number(!(b.student.allergies || b.student.medicalNotes)) - Number(!(a.student.allergies || a.student.medicalNotes)) || a.student.lastName.localeCompare(b.student.lastName))
      .map((k) => ({ cells: [k.student.name, k.student.allergies || 'None listed', k.student.medicalNotes || 'None listed', k.family], href: links.family(k.householdId) })),
    total: { value: listed.length, display: `${listed.length} of ${kids.length}`, label: `Children with something listed in ${classTitle(ctx.content, found.session.id)}` },
    empty: `No children in ${classTitle(ctx.content, found.session.id)} yet.`,
  };
}

// ───────────── Photo permission ─────────────

const PHOTO = (consent: boolean | null) => (consent === true ? 'Yes' : consent === false ? 'No photos' : 'Not asked');

/** Photo permission for a class, a show's cast, or (with neither) every child in a current class. */
export async function photoPermission(ctx: ReportContext, f: ReportFilters): Promise<ReportResult> {
  const columns = [{ label: 'Child' }, { label: 'Family' }, { label: 'Photos' }, { label: f.show ? 'Role' : 'Classes' }];
  let rows: { name: string; family: string; householdId: string; consent: boolean | null; extra: string }[];
  if (f.show) {
    const cast = await castList(f.show);
    const seen = new Map<string, (typeof rows)[number]>();
    for (const c of cast) {
      const r = seen.get(c.studentId) ?? { name: nameOf(c), family: c.family, householdId: c.householdId, consent: c.photo === 'yes' ? true : c.photo === 'no' ? false : null, extra: '' };
      r.extra = [r.extra, c.role].filter(Boolean).join(', ');
      seen.set(c.studentId, r);
    }
    rows = [...seen.values()];
  } else {
    const db = await getDb();
    const pass = current(ctx.content, ctx.today, f);
    const list = await db
      .select({ studentId: student.id, firstName: student.firstName, lastName: student.lastName, householdId: household.id, family: household.name, consent: student.photoConsent, sessionId: enrollment.sessionId })
      .from(enrollment)
      .innerJoin(student, eq(student.id, enrollment.studentId))
      .innerJoin(household, eq(household.id, enrollment.householdId))
      .where(inArray(enrollment.status, ['active', 'trial']));
    const by = new Map<string, (typeof rows)[number]>();
    for (const e of list) {
      if (!pass(e.sessionId)) continue;
      const r = by.get(e.studentId) ?? { name: nameOf(e), family: e.family, householdId: e.householdId, consent: e.consent, extra: '' };
      r.extra = [r.extra, classTitle(ctx.content, e.sessionId)].filter(Boolean).join(', ');
      by.set(e.studentId, r);
    }
    rows = [...by.values()];
  }
  const order = (c: boolean | null) => (c === false ? 0 : c === null ? 1 : 2);
  rows.sort((a, b) => order(a.consent) - order(b.consent) || a.name.localeCompare(b.name));
  const no = rows.filter((r) => r.consent === false).length;
  return {
    columns,
    rows: rows.map((r) => ({ cells: [r.name, r.family, PHOTO(r.consent), r.extra], href: links.family(r.householdId) })),
    total: { value: rows.length ? no : null, display: rows.length ? `${no} of ${rows.length}` : 'Nobody yet', label: 'Children without photo permission' },
    empty: f.show ? 'Nobody is in this cast yet.' : 'No children in a current class.',
  };
}

