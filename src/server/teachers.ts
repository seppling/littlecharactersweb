/**
 * Who teaches which class, and what a teacher may open (docs/back-office.md →
 * Staff roles).
 *
 * A teacher sees their own classes (class_teacher: lead or assistant, every
 * date) and the dates they cover as a substitute (class_cover: that class, that
 * date only). Nothing else: the teacher app checks `canTeach` before showing a
 * roster, and lists `teacherSessions` on its home page.
 *
 * The content's `session.teacher` text stays the public name on the site; these
 * tables are who can open the class in the back office.
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import { meetings } from '@/lib/pricing';
import type { Program, Session } from '@/content/types';
import type { SiteContent } from '@/content/site-content';
import { daysOffBetween, dayOffFrom } from './class-day';
import { getCatalog } from './content';
import { getDb, schema } from './db';

const { staff, classTeacher, classCover } = schema;

type Catalog = Pick<SiteContent, 'findSession'>;

export type TeachingAs = 'lead' | 'assistant' | 'cover';

export interface TeachingSession {
  sessionId: string;
  program: Program;
  session: Session;
  /** Lead or assistant all term, or a substitute that day. */
  as: TeachingAs;
  /** For a cover: the teacher they stand in for, if Hannah said. */
  coveringForStaffId: string | null;
  /** A day off for this class on the date (the reason), else null. Attendance is blocked then. */
  dayOff: string | null;
}

/** The class meets on this date (YYYY-MM-DD), by its days and dates in the content. */
export const meetsOn = (session: Pick<Session, 'days' | 'startDate' | 'endDate'>, date: string) =>
  date >= session.startDate && date <= session.endDate && meetings(session).includes(date);

async function activeStaff(staffId: string) {
  const db = await getDb();
  const [row] = await db.select({ active: staff.active }).from(staff).where(eq(staff.id, staffId));
  return !!row?.active;
}

/** The classes a teacher teaches or covers on a date, in time order. Empty for a deactivated person. */
export async function teacherSessions(staffId: string, date: string, catalog?: Catalog): Promise<TeachingSession[]> {
  if (!(await activeStaff(staffId))) return [];
  const content = catalog ?? (await getCatalog());
  const db = await getDb();
  const [assigned, covers] = await Promise.all([
    db.select().from(classTeacher).where(eq(classTeacher.staffId, staffId)),
    db.select().from(classCover).where(and(eq(classCover.staffId, staffId), eq(classCover.classDate, date))),
  ]);
  const out = new Map<string, Omit<TeachingSession, 'dayOff'>>();
  for (const a of assigned) {
    const found = content.findSession(a.sessionId);
    if (found && meetsOn(found.session, date)) out.set(a.sessionId, { sessionId: a.sessionId, ...found, as: a.role, coveringForStaffId: null });
  }
  for (const c of covers) {
    const found = content.findSession(c.sessionId);
    if (found && !out.has(c.sessionId)) out.set(c.sessionId, { sessionId: c.sessionId, ...found, as: 'cover', coveringForStaffId: c.coveringForStaffId });
  }
  if (!out.size) return [];
  const off = await daysOffBetween(date, date);
  return [...out.values()].map((t) => ({ ...t, dayOff: dayOffFrom(off, t.sessionId, date)?.reason ?? null })).sort((a, b) => a.session.start.localeCompare(b.session.start) || a.program.title.localeCompare(b.program.title));
}

/**
 * May this staff member open this class on this date? Their own class (any
 * date), or a class they cover on that date. A deactivated person may not.
 * Owners see everything through their own pages and don't need this.
 */
export async function canTeach(staffId: string, sessionId: string, date: string): Promise<boolean> {
  if (!(await activeStaff(staffId))) return false;
  const db = await getDb();
  const [own] = await db
    .select({ sessionId: classTeacher.sessionId })
    .from(classTeacher)
    .where(and(eq(classTeacher.staffId, staffId), eq(classTeacher.sessionId, sessionId)));
  if (own) return true;
  const [cover] = await db
    .select({ id: classCover.id })
    .from(classCover)
    .where(and(eq(classCover.staffId, staffId), eq(classCover.sessionId, sessionId), eq(classCover.classDate, date)));
  return !!cover;
}

export interface ClassTeacherRow {
  staffId: string;
  name: string;
  email: string;
  role: 'lead' | 'assistant';
  active: boolean;
}

/** A class's teachers, leads first, then by name. */
export async function classTeachers(sessionId: string): Promise<ClassTeacherRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ staffId: staff.id, name: staff.name, email: staff.email, role: classTeacher.role, active: staff.active })
    .from(classTeacher)
    .innerJoin(staff, eq(staff.id, classTeacher.staffId))
    .where(eq(classTeacher.sessionId, sessionId))
    .orderBy(asc(staff.name));
  return rows.sort((a, b) => (a.role === b.role ? 0 : a.role === 'lead' ? -1 : 1));
}

export interface CoverRow {
  id: string;
  sessionId: string;
  classDate: string;
  staffId: string;
  name: string;
  coveringForStaffId: string | null;
  coveringForName: string | null;
}

/** Substitutes for a class: on one date, or (no date) every cover, by date. */
export async function coversFor(sessionId: string, date?: string): Promise<CoverRow[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: classCover.id, sessionId: classCover.sessionId, classDate: classCover.classDate, staffId: classCover.staffId, name: staff.name, coveringForStaffId: classCover.coveringForStaffId })
    .from(classCover)
    .innerJoin(staff, eq(staff.id, classCover.staffId))
    .where(date ? and(eq(classCover.sessionId, sessionId), eq(classCover.classDate, date)) : eq(classCover.sessionId, sessionId))
    .orderBy(asc(classCover.classDate), asc(staff.name));
  const forIds = [...new Set(rows.map((r) => r.coveringForStaffId).filter((v): v is string => !!v))];
  const names = forIds.length ? new Map((await db.select({ id: staff.id, name: staff.name }).from(staff).where(inArray(staff.id, forIds))).map((r) => [r.id, r.name])) : new Map<string, string>();
  return rows.map((r) => ({ ...r, coveringForName: r.coveringForStaffId ? (names.get(r.coveringForStaffId) ?? null) : null }));
}

/** Every class a teacher is on (lead or assistant), whatever the date, with the content's details; classes no longer in the content are left out. */
export async function teacherClasses(staffId: string, catalog?: Catalog) {
  const content = catalog ?? (await getCatalog());
  const db = await getDb();
  const rows = await db.select().from(classTeacher).where(eq(classTeacher.staffId, staffId));
  return rows.flatMap((r) => {
    const found = content.findSession(r.sessionId);
    return found ? [{ sessionId: r.sessionId, role: r.role, ...found }] : [];
  });
}
