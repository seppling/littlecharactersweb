/**
 * One class on one date, as every Phase 2 unit sees it (docs/back-office.md →
 * One class date): whether it's a day off, and who's expected (enrolled and
 * trial children, as Phase 1's roster counts them, plus drop-ins booked for
 * that date). The teacher app, the calendar and drop-ins all read days off and
 * drop-ins through here, so they agree. Each may add to this file; keep these
 * signatures.
 *
 * Read-only, and no children's details: names and care details come from the
 * audited roster reads (classRoster, or the teacher app's own).
 */
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import type { Program, Session } from '@/content/types';
import { meetings } from '@/lib/pricing';
import { getDb, schema } from './db';
import { capacityFor } from './family';

const { closure, dropIn, enrollment } = schema;

export interface DayOff {
  id: string;
  date: string;
  /** Null: every class that day. */
  sessionId: string | null;
  reason: string;
}

/**
 * The day off that applies to this class on this date, from a list of days
 * off: one for this class first, then one for every class that day.
 */
export function dayOffFrom<T extends Pick<DayOff, 'date' | 'sessionId'>>(daysOff: T[], sessionId: string, date: string): T | null {
  const that = daysOff.filter((d) => d.date === date);
  return that.find((d) => d.sessionId === sessionId) ?? that.find((d) => d.sessionId === null) ?? null;
}

/** Days off from `from` to `to` (YYYY-MM-DD, both included), by date, whole-day ones first. */
export async function daysOffBetween(from: string, to: string): Promise<DayOff[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: closure.id, date: closure.date, sessionId: closure.sessionId, reason: closure.reason })
    .from(closure)
    .where(and(gte(closure.date, from), lte(closure.date, to)))
    .orderBy(asc(closure.date));
  return rows.sort((a, b) => a.date.localeCompare(b.date) || Number(a.sessionId !== null) - Number(b.sessionId !== null));
}

/** The day off for this class on this date, or null. Attendance and drop-ins are refused then. */
export async function dayOffOn(sessionId: string, date: string): Promise<DayOff | null> {
  return dayOffFrom(await daysOffBetween(date, date), sessionId, date);
}

/** A class's meeting dates (`meetings`) with the day off on each, if any. Prices and `meetings()` never change for a day off. */
export async function classDates(session: Pick<Session, 'id' | 'days' | 'startDate' | 'endDate'>): Promise<{ date: string; dayOff: DayOff | null }[]> {
  const dates = meetings(session);
  if (!dates.length) return [];
  const off = await daysOffBetween(dates[0], dates[dates.length - 1]);
  return dates.map((date) => ({ date, dayOff: dayOffFrom(off, session.id, date) }));
}

export interface BookedDropIn {
  id: string;
  sessionId: string;
  classDate: string;
  studentId: string;
  householdId: string;
  priceCents: number;
  orderId: string | null;
  createdAt: Date;
}

const bookedColumns = {
  id: dropIn.id,
  sessionId: dropIn.sessionId,
  classDate: dropIn.classDate,
  studentId: dropIn.studentId,
  householdId: dropIn.householdId,
  priceCents: dropIn.priceCents,
  orderId: dropIn.orderId,
  createdAt: dropIn.createdAt,
};

/** Drop-ins booked for this class on this date, oldest first. Pending (not paid yet) and cancelled ones aren't. */
export async function dropInsOn(sessionId: string, date: string): Promise<BookedDropIn[]> {
  const db = await getDb();
  return db
    .select(bookedColumns)
    .from(dropIn)
    .where(and(eq(dropIn.sessionId, sessionId), eq(dropIn.classDate, date), eq(dropIn.status, 'booked')))
    .orderBy(asc(dropIn.createdAt));
}

/** Booked drop-ins from `from` to `to`, optionally for some classes only: `${sessionId} ${date}` → how many. */
export async function dropInCounts(from: string, to: string, sessionIds?: string[]): Promise<Map<string, number>> {
  if (sessionIds && !sessionIds.length) return new Map();
  const db = await getDb();
  const rows = await db
    .select({ sessionId: dropIn.sessionId, classDate: dropIn.classDate })
    .from(dropIn)
    .where(
      and(
        eq(dropIn.status, 'booked'),
        gte(dropIn.classDate, from),
        lte(dropIn.classDate, to),
        sessionIds ? inArray(dropIn.sessionId, sessionIds) : undefined,
      ),
    );
  const out = new Map<string, number>();
  for (const r of rows) out.set(`${r.sessionId} ${r.classDate}`, (out.get(`${r.sessionId} ${r.classDate}`) ?? 0) + 1);
  return out;
}

export interface ClassDay {
  sessionId: string;
  date: string;
  /** The class meets that date by its days and dates (a day off still "meets"; see dayOff). */
  meets: boolean;
  dayOff: DayOff | null;
  /** Active and trial enrollments, as the roster stands now. */
  enrolled: number;
  dropIns: number;
  expected: number;
  /** Undefined when the class has no limit. */
  capacity: number | undefined;
  /** Places a drop-in could take that date; undefined when there's no limit. */
  placesLeft: number | undefined;
}

/** Pure: a class date from its counts. */
export function classDayFrom(input: { sessionId: string; date: string; meets: boolean; dayOff: DayOff | null; enrolled: number; dropIns: number; capacity: number | undefined }): ClassDay {
  const expected = input.enrolled + input.dropIns;
  return { ...input, expected, placesLeft: input.capacity === undefined ? undefined : Math.max(0, input.capacity - expected) };
}

/** One class date at a glance: day off, how many are expected, and places left. */
export async function classDay(program: Program, session: Session, date: string): Promise<ClassDay> {
  const db = await getDb();
  const [enrolled, dropIns, dayOff] = await Promise.all([
    db
      .select({ id: enrollment.id })
      .from(enrollment)
      .where(and(eq(enrollment.sessionId, session.id), inArray(enrollment.status, ['active', 'trial']))),
    dropInsOn(session.id, date),
    dayOffOn(session.id, date),
  ]);
  const meets = date >= session.startDate && date <= session.endDate && meetings(session).includes(date);
  return classDayFrom({ sessionId: session.id, date, meets, dayOff, enrolled: enrolled.length, dropIns: dropIns.length, capacity: capacityFor(program, session) });
}
