/**
 * The teacher app's data (docs/back-office.md → The teacher app): who may open
 * which roster on which date, a class's children for one date, attendance taps
 * from phones, "attendance done" with the note to Hannah, and what Hannah sees
 * about it (Today, Needs attention, the class and family pages).
 *
 * - teachAccess: the one rule for viewing and marking a class date (pure).
 * - teachRoster: the children expected that date (enrolled, trial, booked
 *   drop-ins, and anyone already marked), with badges and care details. Every
 *   read is written to the audit log, like a Phase 1 roster.
 * - saveTaps / saveReports: what phones send. Idempotent on the tap's
 *   `client_id` and on (class, date, child): the same tap twice changes
 *   nothing, and an older tap never replaces a newer one.
 * - Hannah's side: classStatuses, unreadNotes, classAttendance,
 *   childAttendance, missedTwo, and the input for the `attendance` and
 *   `missed2` items in today.ts.
 *
 * No children's names or notes go into the audit log, a URL or a log line:
 * entries hold ids, the class and the date.
 */
import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Program, ProgramKind, Session } from '@/content/types';
import type { SiteContent } from '@/content/site-content';
import { childBadges, type Badge } from '@/lib/badges';
import type { EmergencyContact, PickupPerson } from '@/lib/contacts';
import { timeRange } from '@/lib/format';
import { meetings, todayInAthens } from '@/lib/pricing';
import { athensNow } from '@/lib/session-dates';
import { classDay, daysOffBetween, dayOffFrom, dayOffOn, dropInsOn, type DayOff } from './class-day';
import { classLine, staffSession } from './classes';
import type { PdfTable } from './downloads';
import { getDb, schema } from './db';
import { ageOn, readStudentNotes } from './family';
import { emailHtml, sendEmail } from './email';
import { config } from './env';
import { audit } from './records';
import { getSetting } from './settings-store';
import { canTeach, classTeachers, coversFor, meetsOn, teacherClasses, teacherSessions } from './teachers';

const { attendance, classReport, classCover, enrollment, student, household, householdMember, user, staff, dropIn } = schema;

type Catalog = Pick<SiteContent, 'findSession'>;

/** Teachers can still take a missed class's attendance for this many days. */
export const LATE_DAYS = 7;
/** Hannah's alert: a class that ended this many hours ago without attendance. */
export const NOT_TAKEN_HOURS = 2;
export const NOTE_MAX = 200;
export const REPORT_NOTE_MAX = 2000;
/** An absence reason (Settings → Reasons keeps them shorter; an older list on a phone still fits). */
export const REASON_MAX = 60;

export const MARKS = ['present', 'absent', 'late', 'left_early'] as const;
export type Mark = (typeof MARKS)[number];
/** Late and Left early still count as there. */
export const wasThere = (m: Mark | string | null | undefined) => !!m && m !== 'absent';
export const MARK_LABELS: Record<Mark, string> = { present: 'Present', absent: 'Absent', late: 'Late', left_early: 'Left early' };

const DAY = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
export const addDays = (iso: string, days: number) => new Date(utc(iso) + days * DAY).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / DAY);
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
export const isIsoDate = (s: string) => isoDate.test(s) && !Number.isNaN(Date.parse(s));

// ───────────── Who may open and mark a class date ─────────────

export type AccessWhy = 'ok' | 'no-access' | 'not-meeting' | 'day-off' | 'future' | 'too-late' | 'submitted' | 'covered';

export interface AccessInput {
  role: 'owner' | 'teacher';
  /** canTeach(staffId, sessionId, date): their own class, or a class they cover that date. */
  teaches: boolean;
  meets: boolean;
  dayOff: string | null;
  date: string;
  /** Today in Athens. */
  today: string;
  /** Attendance for this date has been submitted (a class_report exists). */
  reported: boolean;
  /** A substitute covers this teacher on this date (their name), so it's read-only for them. */
  coveredBy: string | null;
}

export interface Access {
  view: boolean;
  edit: boolean;
  why: AccessWhy;
}

/**
 * The rule for one class date. Owners see and mark any date the class meets
 * up to today. Teachers see their own classes and cover dates (future ones
 * read-only), mark today's, change marks on the class's own day even after
 * submitting, and submit a missed one for up to 7 days. Nobody marks a day off.
 */
export function teachAccess(a: AccessInput): Access {
  if (a.role === 'teacher' && !a.teaches) return { view: false, edit: false, why: 'no-access' };
  if (!a.meets) return { view: false, edit: false, why: 'not-meeting' };
  if (a.dayOff) return { view: true, edit: false, why: 'day-off' };
  if (a.date > a.today) return { view: true, edit: false, why: 'future' };
  if (a.role === 'owner') return { view: true, edit: true, why: 'ok' };
  if (a.coveredBy) return { view: true, edit: false, why: 'covered' };
  if (a.date === a.today) return { view: true, edit: true, why: 'ok' };
  if (daysBetween(a.date, a.today) > LATE_DAYS) return { view: true, edit: false, why: 'too-late' };
  if (a.reported) return { view: true, edit: false, why: 'submitted' };
  return { view: true, edit: true, why: 'ok' };
}

export interface Viewer {
  userId: string;
  staffId: string;
  role: 'owner' | 'teacher';
}

export interface ClassDate {
  program: Program;
  session: Session;
  date: string;
  dayOff: DayOff | null;
  report: typeof classReport.$inferSelect | null;
  /** The substitutes that date, with who they cover for. */
  covers: Awaited<ReturnType<typeof coversFor>>;
  /** For a teacher: the substitute covering for them that date. */
  coveredBy: string | null;
  access: Access;
}

/** Everything the access rule needs for one class date, read once. Null when the class isn't in the content. */
export async function classDateFor(viewer: Viewer, sessionId: string, date: string, catalog: Catalog, today = todayInAthens()): Promise<ClassDate | null> {
  const found = catalog.findSession(sessionId);
  if (!found || !isIsoDate(date)) return null;
  const db = await getDb();
  const [teaches, dayOff, [report], covers, team] = await Promise.all([
    viewer.role === 'owner' ? Promise.resolve(true) : canTeach(viewer.staffId, sessionId, date),
    dayOffOn(sessionId, date),
    db.select().from(classReport).where(and(eq(classReport.sessionId, sessionId), eq(classReport.classDate, date))),
    coversFor(sessionId, date),
    classTeachers(sessionId),
  ]);
  const coveredBy = viewer.role === 'teacher' ? coveringFor(viewer.staffId, covers, team) : null;
  const access = teachAccess({ role: viewer.role, teaches, meets: meetsOn(found.session, date), dayOff: dayOff?.reason ?? null, date, today, reported: !!report, coveredBy });
  return { ...found, date, dayOff, report: report ?? null, covers, coveredBy, access };
}

/**
 * The substitute standing in for this teacher that date: one who covers for
 * them by name, or (when Hannah didn't say for whom) for the class's lead.
 * Null when they're the substitute themselves, or nobody covers for them.
 */
export function coveringFor(staffId: string, covers: { staffId: string; name: string; coveringForStaffId: string | null }[], team: { staffId: string; role: 'lead' | 'assistant' }[]) {
  if (covers.some((c) => c.staffId === staffId)) return null;
  const lead = team.find((t) => t.staffId === staffId)?.role === 'lead';
  return covers.find((c) => c.coveringForStaffId === staffId || (!c.coveringForStaffId && lead))?.name ?? null;
}

// ───────────── A class's children on one date ─────────────

export interface TeachParent {
  name: string;
  phone: string | null;
}

export interface TeachChild {
  studentId: string;
  enrollmentId: string | null;
  dropInId: string | null;
  kind: 'enrolled' | 'trial' | 'drop-in' | 'marked';
  firstName: string;
  lastName: string;
  /** "Maya R." */
  shortName: string;
  initials: string;
  age: number | null;
  badges: Badge[];
  allergies: string;
  medicalNotes: string;
  pickupNotes: string;
  pickupPeople: PickupPerson[];
  emergencyContacts: EmergencyContact[];
  parents: TeachParent[];
  photoConsent: boolean | null;
  /** `reason`: the absence reason tapped (Settings → Reasons), or ''. */
  mark: { status: Mark; note: string; reason: string; markedAt: Date } | null;
}

const byName = (a: TeachChild, b: TeachChild) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName);

/** "Maya R." and "MR": what a roster row shows. */
export const shortName = (first: string, last: string) => `${first.trim()}${last.trim() ? ` ${last.trim()[0]}.` : ''}`;
export const initials = (first: string, last: string) => `${first.trim()[0] ?? ''}${last.trim()[0] ?? ''}`.toUpperCase();

/**
 * Who's expected on a class date, as ids: active and trial enrollments, booked
 * drop-ins (class-day.ts), and anyone already marked that date (a child who
 * left the class later still shows on the dates they came). No names.
 */
export async function expectedOn(sessionId: string, date: string) {
  const db = await getDb();
  const [enrolled, drops, marked] = await Promise.all([
    db
      .select({ id: enrollment.id, studentId: enrollment.studentId, status: enrollment.status })
      .from(enrollment)
      .where(and(eq(enrollment.sessionId, sessionId), inArray(enrollment.status, ['active', 'trial']))),
    dropInsOn(sessionId, date),
    db.select({ studentId: attendance.studentId, enrollmentId: attendance.enrollmentId, dropInId: attendance.dropInId }).from(attendance).where(and(eq(attendance.sessionId, sessionId), eq(attendance.classDate, date))),
  ]);
  const out = new Map<string, { enrollmentId: string | null; dropInId: string | null; kind: TeachChild['kind'] }>();
  for (const e of enrolled) out.set(e.studentId, { enrollmentId: e.id, dropInId: null, kind: e.status === 'trial' ? 'trial' : 'enrolled' });
  for (const d of drops) if (!out.has(d.studentId)) out.set(d.studentId, { enrollmentId: null, dropInId: d.id, kind: 'drop-in' });
  for (const m of marked) if (!out.has(m.studentId)) out.set(m.studentId, { enrollmentId: m.enrollmentId, dropInId: m.dropInId, kind: 'marked' });
  return out;
}

/**
 * A class's children on one date, by first name, with badges, care details
 * (decrypted), pickup people, emergency contacts, parents' names and phones,
 * and each child's mark so far. Logged as `teach.roster.<action>` with the
 * date. Callers check teachAccess first.
 */
export async function teachRoster(sessionId: string, date: string, viewerUserId: string, action: 'view' | 'cache' = 'view', today = todayInAthens()): Promise<TeachChild[]> {
  const expected = await expectedOn(sessionId, date);
  await audit(viewerUserId, `teach.roster.${action}`, 'session', sessionId, date);
  const ids = [...expected.keys()];
  if (!ids.length) return [];
  const db = await getDb();
  const [kids, marks, firsts, missed] = await Promise.all([
    db.select({ student, household }).from(student).innerJoin(household, eq(household.id, student.householdId)).where(inArray(student.id, ids)),
    db.select().from(attendance).where(and(eq(attendance.sessionId, sessionId), eq(attendance.classDate, date))),
    db
      .select({ studentId: enrollment.studentId, first: sql<string>`min(${enrollment.createdAt})` })
      .from(enrollment)
      .where(and(inArray(enrollment.studentId, ids), ne(enrollment.status, 'cancelled')))
      .groupBy(enrollment.studentId),
    missedTwo({ sessionIds: [sessionId], studentIds: ids }),
  ]);
  const householdIds = [...new Set(kids.map((k) => k.household.id))];
  const parents = await db
    .select({ householdId: householdMember.householdId, name: user.name, phone: user.phone })
    .from(householdMember)
    .innerJoin(user, eq(user.id, householdMember.userId))
    .where(inArray(householdMember.householdId, householdIds))
    .orderBy(householdMember.createdAt);
  const firstOf = new Map(firsts.map((f) => [f.studentId, new Date(f.first)]));
  const markOf = new Map(marks.map((m) => [m.studentId, m]));
  const missedIds = new Set(missed.map((m) => m.studentId));

  return kids
    .map(({ student: s, household: h }) => {
      const e = expected.get(s.id)!;
      const { allergies, medicalNotes } = readStudentNotes(s);
      const m = markOf.get(s.id);
      return {
        studentId: s.id,
        enrollmentId: e.enrollmentId,
        dropInId: e.dropInId,
        kind: e.kind,
        firstName: s.firstName,
        lastName: s.lastName,
        shortName: shortName(s.firstName, s.lastName),
        initials: initials(s.firstName, s.lastName),
        age: ageOn(s.birthdate, today),
        badges: childBadges(
          {
            hasAllergies: !!allergies.trim(),
            hasMedicalNotes: !!medicalNotes.trim(),
            hasPickupNote: !!s.pickupNotes?.trim(),
            photoConsent: s.photoConsent,
            firstEnrolledAt: firstOf.get(s.id) ?? null,
            trial: e.kind === 'trial',
            dropIn: e.kind === 'drop-in',
            missedLastTwo: missedIds.has(s.id),
            birthdate: s.birthdate,
          },
          today,
        ),
        allergies: allergies.trim(),
        medicalNotes: medicalNotes.trim(),
        pickupNotes: s.pickupNotes?.trim() ?? '',
        pickupPeople: h.pickupPeople ?? [],
        emergencyContacts: h.emergencyContacts ?? [],
        parents: parents.filter((p) => p.householdId === h.id).map((p) => ({ name: p.name, phone: p.phone })),
        photoConsent: s.photoConsent,
        mark: m ? { status: m.status as Mark, note: m.note ?? '', reason: m.reason ?? '', markedAt: m.markedAt } : null,
      } satisfies TeachChild;
    })
    .sort(byName);
}

/** "2 allergy or medical · 1 pickup note", for the roster's safety strip. */
export function safetyLine(children: Pick<TeachChild, 'badges'>[]) {
  const medical = children.filter((c) => c.badges.some((b) => b.key === 'medical')).length;
  const pickup = children.filter((c) => c.badges.some((b) => b.key === 'pickup')).length;
  return [medical && `${medical} allergy or medical`, pickup && `${pickup} pickup ${pickup === 1 ? 'note' : 'notes'}`].filter(Boolean).join(' · ');
}

// ───────────── Taps and reports from phones ─────────────

const clientId = z.string().min(8).max(64).regex(/^[\w-]+$/);
const when = z.iso.datetime({ offset: true });

export const tapInput = z.object({
  clientId,
  sessionId: z.string().min(1).max(120),
  date: z.string().regex(isoDate),
  studentId: z.string().min(1).max(64),
  status: z.enum(MARKS),
  note: z.string().max(NOTE_MAX).optional().default(''),
  /** Why the child was absent: one of Settings → Reasons, tapped on the phone (optional; only kept with Absent). */
  reason: z.string().max(REASON_MAX).optional().default(''),
  markedAt: when,
});
/** A tap; `reason` may be left out (taps queued on a phone before absence reasons have none). */
export type Tap = Omit<z.infer<typeof tapInput>, 'reason'> & { reason?: string };

export const reportInput = z.object({
  clientId,
  sessionId: z.string().min(1).max(120),
  date: z.string().regex(isoDate),
  note: z.string().max(REPORT_NOTE_MAX).optional().default(''),
  at: when,
});
export type Report = z.infer<typeof reportInput>;

export const syncInput = z.object({
  /** Who made these taps on the phone. Only that person's session may send them. */
  by: z.string().min(1).max(64),
  taps: z.array(tapInput).max(500).default([]),
  reports: z.array(reportInput).max(50).default([]),
});

export type SyncResult = { clientId: string; result: 'saved' | 'same' | 'older' | 'refused'; why?: AccessWhy | 'not-on-roster' | 'not-found' };

/** A phone's clock can run ahead: a tap is never dated later than now. */
const clamp = (iso: string, now: Date) => new Date(Math.min(Date.parse(iso), now.getTime()));

/**
 * Teachers may change marks on the class's own day even after submitting. A
 * tap made that day and sent the next morning (no signal) still counts as
 * made that day.
 */
const tapDay = (classDate: string, markedAt: Date, today: string) => (todayInAthens(markedAt) === classDate ? classDate : today);

async function accessFor(viewer: Viewer, sessionId: string, date: string, catalog: Catalog, today: string) {
  return classDateFor(viewer, sessionId, date, catalog, today);
}

/**
 * Save attendance taps. Per tap: refused when the viewer may not mark that
 * class date or the child isn't expected; `same` when this tap was already
 * saved; `older` when the child has a newer mark; else saved. A change to an
 * existing mark is written to the audit log with the old and new status.
 */
export async function saveTaps(viewer: Viewer, taps: Tap[], catalog: Catalog, now = new Date(), today = todayInAthens(now)): Promise<SyncResult[]> {
  const db = await getDb();
  const results: SyncResult[] = [];
  const dates = new Map<string, Awaited<ReturnType<typeof accessFor>>>();
  const rosters = new Map<string, Awaited<ReturnType<typeof expectedOn>>>();
  for (const tap of taps) {
    const key = `${tap.sessionId} ${tap.date}`;
    const markedAt = clamp(tap.markedAt, now);
    const day = tapDay(tap.date, markedAt, today);
    const accessKey = `${key} ${day}`;
    if (!dates.has(accessKey)) dates.set(accessKey, await accessFor(viewer, tap.sessionId, tap.date, catalog, day));
    const cd = dates.get(accessKey)!;
    if (!cd) {
      results.push({ clientId: tap.clientId, result: 'refused', why: 'not-found' });
      continue;
    }
    if (!cd.access.edit) {
      results.push({ clientId: tap.clientId, result: 'refused', why: cd.access.why });
      continue;
    }
    if (!rosters.has(key)) rosters.set(key, await expectedOn(tap.sessionId, tap.date));
    const who = rosters.get(key)!.get(tap.studentId);
    if (!who) {
      results.push({ clientId: tap.clientId, result: 'refused', why: 'not-on-roster' });
      continue;
    }
    const [dup] = await db.select({ id: attendance.id }).from(attendance).where(eq(attendance.clientId, tap.clientId));
    if (dup) {
      results.push({ clientId: tap.clientId, result: 'same' });
      continue;
    }
    const [before] = await db
      .select({ status: attendance.status, note: attendance.note, reason: attendance.reason })
      .from(attendance)
      .where(and(eq(attendance.sessionId, tap.sessionId), eq(attendance.classDate, tap.date), eq(attendance.studentId, tap.studentId)));
    const note = tap.note.trim() || null;
    // An absence reason stays only with Absent: a later Present clears it.
    const reason = tap.status === 'absent' ? (tap.reason ?? '').trim() || null : null;
    let saved: { id: string }[];
    try {
      saved = await db
        .insert(attendance)
        .values({ sessionId: tap.sessionId, classDate: tap.date, studentId: tap.studentId, enrollmentId: who.enrollmentId, dropInId: who.dropInId, status: tap.status, note, reason, markedBy: viewer.userId, markedAt, clientId: tap.clientId })
        .onConflictDoUpdate({
          target: [attendance.sessionId, attendance.classDate, attendance.studentId],
          set: { status: tap.status, note, reason, markedBy: viewer.userId, markedAt, clientId: tap.clientId, updatedAt: now },
          setWhere: sql`${attendance.markedAt} < excluded.marked_at`,
        })
        .returning({ id: attendance.id });
    } catch (e) {
      // The same tap, sent twice at once from a flaky connection: the other request saved it.
      if (/client_id/.test(String((e as Error)?.message))) {
        results.push({ clientId: tap.clientId, result: 'same' });
        continue;
      }
      throw e;
    }
    if (!saved.length) {
      results.push({ clientId: tap.clientId, result: 'older' });
      continue;
    }
    if (before && (before.status !== tap.status || (before.note ?? null) !== note || (before.reason ?? null) !== reason)) {
      await audit(viewer.userId, 'teach.attendance.change', 'student', tap.studentId, `${tap.sessionId} ${tap.date}: ${before.status} → ${tap.status}`);
    }
    results.push({ clientId: tap.clientId, result: 'saved' });
  }
  return results;
}

/**
 * "Submit attendance": the class_report for that date, with the note to
 * Hannah. Submitting again updates it (a changed note shows on Today again);
 * an older submission sent late from a phone never replaces a newer one.
 */
export async function saveReports(viewer: Viewer, reports: Report[], catalog: Catalog, now = new Date(), today = todayInAthens(now)): Promise<SyncResult[]> {
  const db = await getDb();
  const results: SyncResult[] = [];
  for (const r of reports) {
    const at = clamp(r.at, now);
    const cd = await accessFor(viewer, r.sessionId, r.date, catalog, tapDay(r.date, at, today));
    if (!cd || !cd.access.edit) {
      results.push({ clientId: r.clientId, result: 'refused', why: cd ? cd.access.why : 'not-found' });
      continue;
    }
    const note = r.note.trim() || null;
    const existing = cd.report;
    if (existing && existing.submittedAt.getTime() >= at.getTime()) {
      results.push({ clientId: r.clientId, result: existing.submittedAt.getTime() === at.getTime() ? 'same' : 'older' });
      continue;
    }
    if (existing) {
      const noteChanged = (existing.note ?? null) !== note;
      await db
        .update(classReport)
        .set({ submittedBy: viewer.userId, submittedAt: at, note, updatedAt: now, ...(noteChanged ? { noteReadAt: null, noteReadBy: null } : {}) })
        .where(and(eq(classReport.id, existing.id), sql`${classReport.submittedAt} < ${at}`));
    } else {
      await db.insert(classReport).values({ sessionId: r.sessionId, classDate: r.date, submittedBy: viewer.userId, submittedAt: at, note }).onConflictDoNothing();
    }
    await audit(viewer.userId, existing ? 'teach.attendance.resubmit' : 'teach.attendance.submit', 'session', r.sessionId, r.date);
    results.push({ clientId: r.clientId, result: 'saved' });
  }
  return results;
}

// ───────────── What Hannah sees ─────────────

/** "Riley Sample": the staff name for a user, else their account name, else their email. */
async function namesOf(userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!ids.length) return new Map<string, string>();
  const db = await getDb();
  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email, staffName: staff.name })
    .from(user)
    .leftJoin(staff, eq(staff.email, sql`lower(${user.email})`))
    .where(inArray(user.id, ids));
  return new Map(rows.map((r) => [r.id, r.staffName?.trim() || r.name?.trim() || r.email]));
}

/** Attendance done for these classes on a date: session id → when, and by whom. */
export async function reportsOn(sessionIds: string[], date: string) {
  if (!sessionIds.length) return new Map<string, { submittedAt: Date; by: string }>();
  const db = await getDb();
  const rows = await db
    .select({ sessionId: classReport.sessionId, submittedAt: classReport.submittedAt, submittedBy: classReport.submittedBy })
    .from(classReport)
    .where(and(inArray(classReport.sessionId, sessionIds), eq(classReport.classDate, date)));
  const names = await namesOf(rows.map((r) => r.submittedBy ?? ''));
  return new Map(rows.map((r) => [r.sessionId, { submittedAt: r.submittedAt, by: names.get(r.submittedBy ?? '') ?? '' }]));
}

/** Class dates with attendance done, from `from` to `to`: "sessionId date" keys. */
export async function reportKeys(from: string, to: string) {
  const db = await getDb();
  const rows = await db
    .select({ sessionId: classReport.sessionId, classDate: classReport.classDate })
    .from(classReport)
    .where(and(gte(classReport.classDate, from), lte(classReport.classDate, to)));
  return new Set(rows.map((r) => `${r.sessionId} ${r.classDate}`));
}

/**
 * Today's attendance status for one class: done (a class_report), "not taken"
 * once it has ended, or nothing before then. `now` is the real moment.
 */
export function attendanceState(date: string, end: string, done: boolean, now: Date): 'done' | 'not-taken' | null {
  if (done) return 'done';
  const local = athensNow(now);
  if (date < local.slice(0, 10)) return 'not-taken';
  if (date > local.slice(0, 10)) return null;
  return end && local.slice(11) >= end ? 'not-taken' : null;
}

/** The class ended at least NOT_TAKEN_HOURS ago (Athens time). Earlier dates have; later ones haven't. */
export function endedHoursAgo(date: string, end: string, now: Date, hours = NOT_TAKEN_HOURS) {
  const local = athensNow(now);
  const today = local.slice(0, 10);
  if (date !== today) return date < today;
  const [h, m] = (end || '23:59').split(':').map(Number);
  const due = h * 60 + m + hours * 60;
  if (due >= 24 * 60) return false;
  const [nh, nm] = local.slice(11).split(':').map(Number);
  return nh * 60 + nm >= due;
}

export interface TeacherNote {
  id: string;
  sessionId: string;
  classDate: string;
  note: string;
  by: string;
  submittedAt: Date;
}

/** Notes to Hannah not marked read yet, newest first. */
export async function unreadNotes(sessionId?: string): Promise<TeacherNote[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(classReport)
    .where(and(isNull(classReport.noteReadAt), sql`coalesce(${classReport.note}, '') <> ''`, sessionId ? eq(classReport.sessionId, sessionId) : undefined))
    .orderBy(desc(classReport.classDate), desc(classReport.submittedAt));
  const names = await namesOf(rows.map((r) => r.submittedBy ?? ''));
  return rows.map((r) => ({ id: r.id, sessionId: r.sessionId, classDate: r.classDate, note: r.note ?? '', by: names.get(r.submittedBy ?? '') ?? 'A teacher', submittedAt: r.submittedAt }));
}

/** Hannah read a teacher's note: it leaves Today. */
export async function markNoteRead(reportId: string, userId: string, now = new Date()) {
  const db = await getDb();
  const [row] = await db
    .update(classReport)
    .set({ noteReadAt: now, noteReadBy: userId, updatedAt: now })
    .where(and(eq(classReport.id, reportId), isNull(classReport.noteReadAt)))
    .returning({ sessionId: classReport.sessionId, classDate: classReport.classDate });
  if (row) await audit(userId, 'admin.attendance.note_read', 'session', row.sessionId, row.classDate);
  return !!row;
}

export interface AttendanceDate {
  date: string;
  dayOff: string | null;
  present: number;
  marked: number;
  /** Who submitted it, or null when not taken. */
  by: string | null;
  note: string | null;
  /** The children marked Absent ("Maya R."), with the reason the teacher tapped, if any. */
  absent: { name: string; reason: string | null }[];
}

export interface ClassAttendance {
  dates: AttendanceDate[];
  /** One row per child marked at least once, by name: their mark on each date. */
  children: { studentId: string; name: string; marks: Record<string, Mark> }[];
}

/** A class's attendance so far: each date it met up to today (and any later date already marked), and each child's marks. */
export async function classAttendance(session: Session, today = todayInAthens()): Promise<ClassAttendance> {
  const db = await getDb();
  const [rows, reports] = await Promise.all([
    db
      .select({ studentId: attendance.studentId, classDate: attendance.classDate, status: attendance.status, reason: attendance.reason, firstName: student.firstName, lastName: student.lastName })
      .from(attendance)
      .innerJoin(student, eq(student.id, attendance.studentId))
      .where(eq(attendance.sessionId, session.id)),
    db.select().from(classReport).where(eq(classReport.sessionId, session.id)),
  ]);
  const taken = new Set([...rows.map((r) => r.classDate), ...reports.map((r) => r.classDate)]);
  const dates = meetings(session).filter((d) => d <= today || taken.has(d));
  if (!dates.length) return { dates: [], children: [] };
  const off = await daysOffBetween(dates[0], dates[dates.length - 1]);
  const names = await namesOf(reports.map((r) => r.submittedBy ?? ''));
  const reportOf = new Map(reports.map((r) => [r.classDate, r]));
  const out: AttendanceDate[] = dates.map((date) => {
    const marks = rows.filter((r) => r.classDate === date);
    const r = reportOf.get(date);
    return {
      date,
      dayOff: dayOffFrom(off, session.id, date)?.reason ?? null,
      present: marks.filter((m) => wasThere(m.status)).length,
      marked: marks.length,
      by: r ? (names.get(r.submittedBy ?? '') ?? 'A teacher') : null,
      note: r?.note ?? null,
      absent: marks
        .filter((m) => m.status === 'absent')
        .map((m) => ({ name: shortName(m.firstName, m.lastName), reason: m.reason }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  });
  const kids = new Map<string, ClassAttendance['children'][number]>();
  for (const r of rows) {
    const k = kids.get(r.studentId) ?? { studentId: r.studentId, name: `${r.firstName} ${r.lastName}`, marks: {} };
    k.marks[r.classDate] = r.status as Mark;
    kids.set(r.studentId, k);
  }
  return { dates: out, children: [...kids.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}

const SHORT_MARK: Record<Mark, string> = { present: 'P', absent: 'A', late: 'L', left_early: 'LE' };
const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

/** The attendance download (CSV and PDF): a row per child, a column per class date, then totals. */
export function attendanceTable(a: ClassAttendance) {
  const taken = a.dates.filter((d) => !d.dayOff);
  return {
    headers: ['Child', ...taken.map((d) => md(d.date)), 'Present', 'Absent'],
    rows: a.children.map((c) => {
      const marks = taken.map((d) => c.marks[d.date]);
      return [c.name, ...marks.map((m) => (m ? SHORT_MARK[m] : '')), marks.filter((m) => wasThere(m)).length, marks.filter((m) => m === 'absent').length];
    }),
  };
}

/** "Attendance": the download as a PDF, landscape, with what the letters mean. */
export async function attendancePdf({ program, session }: { program: Program; session: Session }, location: string | undefined, today = todayInAthens()): Promise<PdfTable> {
  const a = await classAttendance(session, today);
  const { headers, rows } = attendanceTable(a);
  return {
    title: `Attendance: ${program.title}`,
    subtitle: `${classLine(session, location)} · P present, A absent, L late, LE left early · Days off left out`,
    columns: headers.map((header, i) => ({ header, weight: i === 0 ? 3 : 1, align: i === 0 ? 'left' : 'right' })),
    rows,
    orientation: 'landscape',
  };
}

export interface MissedTwo {
  studentId: string;
  sessionId: string;
  /** The two class dates, newest first. */
  dates: [string, string];
}

/**
 * Children whose last two marks in a class are both Absent ("missed two in a
 * row"), among active and trial enrollments. Optionally for some classes or
 * children only.
 */
export async function missedTwo(opts: { sessionIds?: string[]; studentIds?: string[]; since?: string } = {}): Promise<MissedTwo[]> {
  if (opts.sessionIds?.length === 0 || opts.studentIds?.length === 0) return [];
  const db = await getDb();
  const rows = await db
    .select({ studentId: attendance.studentId, sessionId: attendance.sessionId, classDate: attendance.classDate, status: attendance.status })
    .from(attendance)
    .innerJoin(enrollment, and(eq(enrollment.studentId, attendance.studentId), eq(enrollment.sessionId, attendance.sessionId)))
    .where(
      and(
        inArray(enrollment.status, ['active', 'trial']),
        opts.sessionIds ? inArray(attendance.sessionId, opts.sessionIds) : undefined,
        opts.studentIds ? inArray(attendance.studentId, opts.studentIds) : undefined,
        opts.since ? gte(attendance.classDate, opts.since) : undefined,
      ),
    )
    .orderBy(desc(attendance.classDate));
  return missedTwoFrom(rows);
}

/** Pure half of missedTwo: rows newest first. */
export function missedTwoFrom(rows: { studentId: string; sessionId: string; classDate: string; status: string }[]): MissedTwo[] {
  const last = new Map<string, typeof rows>();
  for (const r of [...rows].sort((a, b) => b.classDate.localeCompare(a.classDate))) {
    const k = `${r.studentId} ${r.sessionId}`;
    const list = last.get(k) ?? [];
    if (list.length < 2) last.set(k, [...list, r]);
  }
  return [...last.values()].filter((l) => l.length === 2 && l.every((r) => r.status === 'absent')).map((l) => ({ studentId: l[0].studentId, sessionId: l[0].sessionId, dates: [l[0].classDate, l[1].classDate] }));
}

/** Each child's classes missed this season (a term's dates), and whether they missed the last two in any class. */
export async function childAttendance(studentIds: string[], catalog: Catalog, term: string | null) {
  const out = new Map<string, { missed: number; missedLastTwo: boolean }>();
  if (!studentIds.length) return out;
  const db = await getDb();
  const [rows, two] = await Promise.all([
    db.select({ studentId: attendance.studentId, sessionId: attendance.sessionId, status: attendance.status }).from(attendance).where(inArray(attendance.studentId, studentIds)),
    missedTwo({ studentIds }),
  ]);
  for (const id of studentIds) out.set(id, { missed: 0, missedLastTwo: two.some((t) => t.studentId === id) });
  for (const r of rows) {
    if (r.status !== 'absent' || (term && catalog.findSession(r.sessionId)?.session.term !== term)) continue;
    out.get(r.studentId)!.missed++;
  }
  return out;
}

/**
 * What Needs attention needs for `attendance` and `missed2` (today.ts): one
 * query each, over the last LATE_DAYS days. With Settings → Attendance's
 * start date and kinds (`startDate`, `kinds`; null when unset: every date and
 * every kind, as before).
 */
export async function attentionAttendance(today: string): Promise<AttentionAttendance> {
  const from = addDays(today, -LATE_DAYS);
  const db = await getDb();
  const [reports, daysOff, drops, missed, startDate, kinds] = await Promise.all([
    reportKeys(from, today),
    daysOffBetween(from, today),
    db.select({ sessionId: dropIn.sessionId, classDate: dropIn.classDate }).from(dropIn).where(and(eq(dropIn.status, 'booked'), gte(dropIn.classDate, from), lte(dropIn.classDate, today))),
    missedTwo({ since: addDays(today, -60) }),
    getSetting('attendance.startDate'),
    getSetting('attendance.kinds'),
  ]);
  const students = missed.length
    ? await db
        .select({ id: student.id, firstName: student.firstName, lastName: student.lastName, householdId: household.id, family: household.name })
        .from(student)
        .innerJoin(household, eq(household.id, student.householdId))
        .where(inArray(student.id, [...new Set(missed.map((m) => m.studentId))]))
    : [];
  const byId = new Map(students.map((s) => [s.id, s]));
  return {
    reports,
    daysOff,
    dropIns: new Set(drops.map((d) => `${d.sessionId} ${d.classDate}`)),
    missed: missed.flatMap((m) => {
      const s = byId.get(m.studentId);
      return s ? [{ ...m, firstName: s.firstName, lastName: s.lastName, householdId: s.householdId, family: s.family }] : [];
    }),
    startDate,
    kinds,
  };
}

export interface AttentionAttendance {
  /** `${sessionId} ${date}` with a class_report. */
  reports: Set<string>;
  daysOff: DayOff[];
  /** `${sessionId} ${date}` with a booked drop-in. */
  dropIns: Set<string>;
  missed: (MissedTwo & { firstName: string; lastName: string; householdId: string; family: string })[];
  /** Settings → Attendance: "Attendance not taken" only from this date. Unset: every date. */
  startDate?: string | null;
  /** Settings → Attendance: the program kinds that raise it. Unset: every kind. */
  kinds?: ProgramKind[] | null;
}

/** Pure: does this class date raise "Attendance not taken", by Settings → Attendance? */
export function attendanceExpected(a: Pick<AttentionAttendance, 'startDate' | 'kinds'>, kind: ProgramKind, date: string) {
  return (!a.startDate || date >= a.startDate) && (!a.kinds || a.kinds.includes(kind));
}


// ───────────── The teacher's home ─────────────

type HomeCatalog = Pick<SiteContent, 'findSession' | 'programs' | 'locationById'>;

export interface TeachCard {
  sessionId: string;
  program: Program;
  session: Session;
  date: string;
  location: string;
  /** Their part that day; `owner` for an owner seeing a class they aren't on. */
  as: 'lead' | 'assistant' | 'cover' | 'owner';
  /** A substitute's regular teacher, by name ("Covering for Zack"), when Hannah said. */
  coveringFor: string | null;
  /** The substitute standing in for this teacher that date. */
  coveredBy: string | null;
  dayOff: string | null;
  /** Children expected: enrolled, trial and booked drop-ins. */
  expected: number;
  done: boolean;
}

/**
 * The cards on the teacher's home for one date: a teacher's classes and cover
 * dates (teacherSessions); for an owner, every class meeting that date.
 */
export async function teachCards(viewer: Viewer, date: string, catalog: HomeCatalog): Promise<TeachCard[]> {
  const db = await getDb();
  const mine = await teacherSessions(viewer.staffId, date, catalog);
  const list: { sessionId: string; program: Program; session: Session; as: TeachCard['as']; coveringForStaffId: string | null; dayOff: string | null }[] = [...mine];
  if (viewer.role === 'owner') {
    const off = await daysOffBetween(date, date);
    for (const program of catalog.programs)
      for (const session of program.sessions)
        if (staffSession(session) && meetsOn(session, date) && !list.some((m) => m.sessionId === session.id))
          list.push({ sessionId: session.id, program, session, as: 'owner', coveringForStaffId: null, dayOff: dayOffFrom(off, session.id, date)?.reason ?? null });
    list.sort((a, b) => a.session.start.localeCompare(b.session.start) || a.program.title.localeCompare(b.program.title));
  }
  if (!list.length) return [];
  const forIds = [...new Set(list.map((l) => l.coveringForStaffId).filter((v): v is string => !!v))];
  const names = forIds.length ? new Map((await db.select({ id: staff.id, name: staff.name }).from(staff).where(inArray(staff.id, forIds))).map((r) => [r.id, r.name])) : new Map<string, string>();
  const done = await reportsOn(
    list.map((l) => l.sessionId),
    date,
  );
  return Promise.all(
    list.map(async (l) => {
      const [day, covers, team] = await Promise.all([classDay(l.program, l.session, date), l.as === 'lead' || l.as === 'assistant' ? coversFor(l.sessionId, date) : Promise.resolve([]), l.as === 'lead' || l.as === 'assistant' ? classTeachers(l.sessionId) : Promise.resolve([])]);
      return {
        sessionId: l.sessionId,
        program: l.program,
        session: l.session,
        date,
        location: catalog.locationById(l.session.locationId)?.shortName ?? '',
        as: l.as,
        coveringFor: l.coveringForStaffId ? (names.get(l.coveringForStaffId) ?? null) : null,
        coveredBy: covers.length ? coveringFor(viewer.staffId, covers, team) : null,
        dayOff: l.dayOff,
        expected: day.expected,
        done: done.has(l.sessionId),
      };
    }),
  );
}

/** The next date after `date` (within `within` days) when this person teaches or covers a class; null if none. */
export async function nextTeachingDay(viewer: Viewer, date: string, catalog: HomeCatalog, within = 120) {
  const db = await getDb();
  const sessions =
    viewer.role === 'owner'
      ? catalog.programs.flatMap((p) => p.sessions.filter(staffSession))
      : (await teacherClasses(viewer.staffId, catalog)).map((c) => c.session);
  const [cover] = await db
    .select({ classDate: classCover.classDate })
    .from(classCover)
    .where(and(eq(classCover.staffId, viewer.staffId), gte(classCover.classDate, addDays(date, 1)), lte(classCover.classDate, addDays(date, within))))
    .orderBy(asc(classCover.classDate))
    .limit(1);
  for (let i = 1; i <= within; i++) {
    const d = addDays(date, i);
    if (cover?.classDate === d || sessions.some((s) => meetsOn(s, d))) return d;
  }
  return null;
}

// ───────────── Substitutes ─────────────

/**
 * A substitute date was added (Settings → Staff): one short email to the
 * substitute and one to the teacher they cover for (when Hannah said who),
 * with the class, the date and a link to the teacher app. A failed email
 * doesn't undo the cover; it's logged without names.
 */
export async function sendCoverEmails(cover: { sessionId: string; classDate: string; staffId: string; coveringForStaffId: string | null }, found: { program: Program; session: Session }) {
  const db = await getDb();
  const ids = [cover.staffId, cover.coveringForStaffId].filter((v): v is string => !!v);
  const people = new Map((await db.select({ id: staff.id, name: staff.name, email: staff.email }).from(staff).where(inArray(staff.id, ids))).map((p) => [p.id, p]));
  const sub = people.get(cover.staffId);
  const regular = cover.coveringForStaffId ? people.get(cover.coveringForStaffId) : undefined;
  const day = new Date(`${cover.classDate}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const time = found.session.start && found.session.end ? `, ${timeRange(found.session.start, found.session.end)}` : '';
  const link = new URL('/admin/teach', config.siteUrl).toString();
  const first = (name: string) => (name.includes('@') ? '' : ` ${name.split(' ')[0]}`);
  const emails: { to: string; subject: string; lines: string[] }[] = [];
  if (sub)
    emails.push({
      to: sub.email,
      subject: `You’re covering ${found.program.title} on ${day}`,
      lines: [`Hi${first(sub.name)}, you’re teaching ${found.program.title} on ${day}${time}${regular ? `, covering for ${regular.name}` : ''}.`, `The roster and attendance are in the teacher app on the day: ${link}`],
    });
  if (regular && sub)
    emails.push({
      to: regular.email,
      subject: `${sub.name} is covering ${found.program.title} on ${day}`,
      lines: [`Hi${first(regular.name)}, ${sub.name} is teaching ${found.program.title} for you on ${day}${time}.`, `You can still see the class in the teacher app: ${link}`],
    });
  for (const e of emails) {
    try {
      await sendEmail({ to: e.to, subject: e.subject, text: e.lines.join('\n\n'), html: emailHtml(e.subject, e.lines) });
    } catch (err) {
      console.error(`Cover email failed for class ${cover.sessionId} on ${cover.classDate}: ${(err as Error).message}`);
    }
  }
  return emails.length;
}
