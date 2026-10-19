/**
 * The staff Classes list and a class's page (docs/back-office.md → Classes).
 *
 * - classList: one row per session the site takes sign-ups for, with places
 *   filled, openings and the waitlist; filtered by the list's query string.
 *   The page and its CSV and PDF all build from it.
 * - classRoster: a class's children and waitlist, with their families'
 *   contacts and care details. The page, the print page, the roster CSV and
 *   PDF and the sign-in sheet all build from it, so they always agree. Every
 *   call is written to the audit log (rosters include medical notes).
 */
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import type { Program, Session } from '@/content/types';
import type { SiteContent } from '@/content/site-content';
import { childBadges, type Badge } from '@/lib/badges';
import type { EmergencyContact, PickupPerson } from '@/lib/contacts';
import { formatPhone } from '@/lib/contacts';
import { dayList, shortDate, timeRange } from '@/lib/format';
import { isOneOff } from '@/lib/program-fit';
import { meetings, todayInAthens } from '@/lib/pricing';
import { bookingClock, sessionState, type BookingClock, type SessionState } from '@/lib/session-dates';
import { roster, sessionCounts } from './admin';
import { getDb, schema } from './db';
import type { PdfTable } from './downloads';
import { capacityFor } from './family';
import { expireOffers, offerStates, type OfferState } from './roster-changes';

/** Classes need 5 students to run (the FAQ). */
export const MIN_TO_RUN = 5;
/** The sign-in sheet shows this many class dates. */
export const SIGN_IN_DATES = 8;

// ───────────── The Classes list ─────────────

export interface ClassFilters {
  /** Ended sessions instead of current and upcoming ones. */
  ended: boolean;
  openings: boolean;
  waitlist: boolean;
  /** Weekly classes with fewer than 5 students. */
  under5: boolean;
  /** A term, as the editor names it ("Fall 2026"). */
  term?: string;
}

/** The list's filters from its query string: ?show=ended&openings=1&waitlist=1&under5=1&term=Fall+2026. */
export function classFilters(params: URLSearchParams): ClassFilters {
  const on = (k: string) => params.get(k) === '1';
  return { ended: params.get('show') === 'ended', openings: on('openings'), waitlist: on('waitlist'), under5: on('under5'), term: params.get('term')?.trim() || undefined };
}

/** The query string for a set of filters, the reverse of classFilters. */
export function filterQuery(f: ClassFilters) {
  const q = new URLSearchParams();
  if (f.ended) q.set('show', 'ended');
  if (f.openings) q.set('openings', '1');
  if (f.waitlist) q.set('waitlist', '1');
  if (f.under5) q.set('under5', '1');
  if (f.term) q.set('term', f.term);
  const s = q.toString();
  return s ? `?${s}` : '';
}

/** The filters in words, for the PDF: "Fall 2026 · Has openings". */
export function filtersLabel(f: ClassFilters) {
  return [f.term ?? 'All terms', f.ended ? 'Ended' : 'Current and upcoming', f.openings && 'Has openings', f.waitlist && 'Has a waitlist', f.under5 && `Under ${MIN_TO_RUN}`].filter(Boolean).join(' · ');
}

export interface ClassRow {
  program: Program;
  session: Session;
  term: string;
  /** The session's own label ("Ages 4–6"), left out when it only repeats the date. */
  label: string;
  /** "Tuesdays · 4:30–5:30 pm", or the date for a one-off. */
  when: string;
  teacher: string;
  location: string;
  /** Enrolled and trial students: the places taken. */
  filled: number;
  trial: number;
  capacity: number | undefined;
  /** Places left, or undefined when there's no limit. */
  openings: number | undefined;
  waitlist: number;
  state: SessionState;
  /** A weekly class short of the 5 it needs to run. */
  under5: boolean;
}

type Counts = Map<string, { active: number; trial: number; waitlist: number }>;
type ListContent = Pick<SiteContent, 'programs' | 'locationById'>;

/** The sessions staff see: the same set as the old rosters list (registration on this site, or a Google Form). */
export const staffSession = (s: Session) => !s.externalUrl || s.externalUrl.includes('docs.google.com');

export function whenLabel(session: Session) {
  const time = session.start && session.end ? timeRange(session.start, session.end) : '';
  const day = isOneOff(session)
    ? new Date(`${session.startDate}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
    : dayList(session.days);
  return [day, time].filter(Boolean).join(' · ');
}

/** Every staff session as a row, before filtering. */
export function classRows(content: ListContent, counts: Counts, clock: BookingClock): ClassRow[] {
  return content.programs.flatMap((program) =>
    program.sessions.filter(staffSession).map((session) => {
      const c = counts.get(session.id) ?? { active: 0, trial: 0, waitlist: 0 };
      const filled = c.active + c.trial;
      const capacity = capacityFor(program, session);
      const when = whenLabel(session);
      return {
        program,
        session,
        term: session.term,
        label: session.label && !when.startsWith(session.label) ? session.label : '',
        when,
        teacher: session.teacher ?? '',
        location: content.locationById(session.locationId)?.shortName ?? '',
        filled,
        trial: c.trial,
        capacity,
        openings: capacity === undefined ? undefined : Math.max(0, capacity - filled),
        waitlist: c.waitlist,
        state: sessionState(program, session, clock),
        under5: program.kind === 'class' && filled < MIN_TO_RUN,
      };
    }),
  );
}

/** Terms in date order (by each term's first class), for the term picker. */
export function termsOf(rows: ClassRow[]) {
  const first = new Map<string, string>();
  for (const r of rows) if (!first.has(r.term) || r.session.startDate < first.get(r.term)!) first.set(r.term, r.session.startDate);
  return [...first.entries()].sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0])).map(([t]) => t);
}

export function filterRows(rows: ClassRow[], f: ClassFilters) {
  return rows.filter(
    (r) =>
      (f.ended ? r.state === 'ended' : r.state !== 'ended') &&
      (!f.openings || r.openings === undefined || r.openings > 0) &&
      (!f.waitlist || r.waitlist > 0) &&
      (!f.under5 || r.under5) &&
      (!f.term || r.term === f.term),
  );
}

/** Rows by term, terms in date order; in a term, by first class date, then name. */
export function groupByTerm(rows: ClassRow[]) {
  return termsOf(rows).map((term) => ({
    term,
    rows: rows
      .filter((r) => r.term === term)
      .sort((a, b) => a.session.startDate.localeCompare(b.session.startDate) || a.program.title.localeCompare(b.program.title) || a.session.start.localeCompare(b.session.start)),
  }));
}

/** The Classes list as filtered, grouped by term, and every term for the picker. */
export async function classList(content: ListContent & Pick<SiteContent, 'site'>, filters: ClassFilters, now = new Date()) {
  const all = classRows(content, await sessionCounts(), bookingClock(content.site.lateJoinWeeks, now));
  const visible = all.filter((r) => (filters.ended ? r.state === 'ended' : r.state !== 'ended'));
  const groups = groupByTerm(filterRows(all, filters));
  return { terms: termsOf(visible), groups, rows: groups.flatMap((g) => g.rows) };
}

/** "8 of 12", or "8" when there's no limit. */
export const placesLabel = (r: Pick<ClassRow, 'filled' | 'capacity'>) => (r.capacity === undefined ? `${r.filled}` : `${r.filled} of ${r.capacity}`);

/** The list's download: the same rows, in the same order. */
export function classListTable(rows: ClassRow[]) {
  return {
    headers: ['Term', 'Class', 'When', 'Teacher', 'Location', 'Places filled', 'Openings', 'Waitlist'],
    rows: rows.map((r) => [r.term, r.label ? `${r.program.title} (${r.label})` : r.program.title, r.when, r.teacher, r.location, placesLabel(r), r.openings ?? '', r.waitlist]),
  };
}

// ───────────── A class's roster ─────────────

export interface Parent {
  name: string;
  email: string;
  phone: string | null;
}

export interface RosterChild {
  enrollmentId: string;
  studentId: string;
  householdId: string;
  status: 'active' | 'trial' | 'waitlist';
  name: string;
  firstName: string;
  lastName: string;
  age: number | null;
  badges: Badge[];
  parents: Parent[];
  family: string;
  allergies: string;
  medicalNotes: string;
  pickupNotes: string;
  pickupPeople: PickupPerson[];
  emergencyContacts: EmergencyContact[];
  photoConsent: boolean | null;
  /** When they signed up (the waitlist's order). */
  joinedAt: Date;
  /** An open offer of a place, for a waitlisted child. */
  offeredAt: Date | null;
  /** The latest offer for a waitlisted child, open or ran out (roster-changes.ts). */
  offer: OfferState | null;
  /** Added by staff without charge: why (roster-changes.ts). */
  noChargeReason: string | null;
}

export type RosterAction = 'view' | 'print' | 'csv' | 'pdf' | 'sign-in-pdf';

const byName = (a: RosterChild, b: RosterChild) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName);

/**
 * A class's children (enrolled and trial, by last name) and its waitlist (in
 * the order families joined). Logged as admin.roster.<action>.
 */
export async function classRoster(sessionId: string, viewerId: string, action: RosterAction = 'view', today = todayInAthens()) {
  const people = await roster(sessionId, viewerId, `admin.roster.${action}`);
  const db = await getDb();
  const studentIds = [...new Set(people.map((p) => p.student.id))];
  const firsts = studentIds.length
    ? await db
        .select({ studentId: schema.enrollment.studentId, first: sql<string>`min(${schema.enrollment.createdAt})` })
        .from(schema.enrollment)
        .where(and(inArray(schema.enrollment.studentId, studentIds), ne(schema.enrollment.status, 'cancelled')))
        .groupBy(schema.enrollment.studentId)
    : [];
  const firstOf = new Map(firsts.map((f) => [f.studentId, new Date(f.first)]));
  const waitIds = people.filter((p) => p.status === 'waitlist').map((p) => p.enrollmentId);
  // Offers past their time are marked expired as they're read.
  if (waitIds.length) await expireOffers(new Date(), sessionId);
  const offerOf = await offerStates(waitIds);

  const children: RosterChild[] = people.map((p) => {
    const s = p.student;
    const status = p.status as RosterChild['status'];
    return {
      enrollmentId: p.enrollmentId,
      studentId: s.id,
      householdId: p.householdId,
      status,
      name: s.name,
      firstName: s.firstName,
      lastName: s.lastName,
      age: s.age,
      badges: childBadges(
        {
          hasAllergies: !!s.allergies.trim(),
          hasMedicalNotes: !!s.medicalNotes.trim(),
          hasPickupNote: !!s.pickup.trim(),
          photoConsent: s.photoConsent,
          firstEnrolledAt: firstOf.get(s.id) ?? null,
          trial: status === 'trial',
          birthdate: s.birthdate,
        },
        today,
      ),
      parents: p.guardians.map((g) => ({ name: g.name, email: g.email, phone: g.phone })),
      family: p.family,
      allergies: s.allergies.trim(),
      medicalNotes: s.medicalNotes.trim(),
      pickupNotes: s.pickup.trim(),
      pickupPeople: p.pickupPeople,
      emergencyContacts: p.emergencyContacts,
      photoConsent: s.photoConsent,
      joinedAt: p.enrolledAt,
      offeredAt: offerOf.get(p.enrollmentId)?.status === 'offered' ? offerOf.get(p.enrollmentId)!.offeredAt : null,
      offer: offerOf.get(p.enrollmentId) ?? null,
      noChargeReason: p.noChargeReason,
    };
  });
  return {
    students: children.filter((c) => c.status !== 'waitlist').sort(byName),
    waitlist: children.filter((c) => c.status === 'waitlist').sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime()),
  };
}
export type ClassRoster = Awaited<ReturnType<typeof classRoster>>;

/** "Yes", "No", or "Not asked". */
export const photoLabel = (consent: boolean | null) => (consent === true ? 'Yes' : consent === false ? 'No' : 'Not asked');
export const ageLabel = (age: number | null) => (age === null ? '' : `${age}`);

const parentLine = (p: Parent) => [p.name, formatPhone(p.phone)].filter(Boolean).join(', ');
const personLine = (p: { name: string; relationship: string; phone?: string }) => [`${p.name} (${p.relationship})`, formatPhone(p.phone)].filter(Boolean).join(', ');

/** The roster download (CSV and PDF): one row per child, care details included. */
export function rosterTable(students: RosterChild[]) {
  return {
    headers: ['Student', 'Age', 'Status', 'Parents', 'Allergies', 'Medical notes', 'Pickup', 'Emergency contacts', 'Photos'],
    rows: students.map((c) => [
      c.name,
      ageLabel(c.age),
      c.status === 'trial' ? 'Trial' : c.noChargeReason ? 'Enrolled (no charge)' : 'Enrolled',
      c.parents.map(parentLine).join('\n'),
      c.allergies,
      c.medicalNotes,
      [c.pickupNotes, ...c.pickupPeople.map(personLine)].filter(Boolean).join('\n'),
      c.emergencyContacts.length ? c.emergencyContacts.map(personLine).join('\n') : 'None on file',
      photoLabel(c.photoConsent),
    ]),
  };
}

/** The sign-in sheet's dates: the next 8 class dates from today, or the last 8 once the class has ended. */
export function signInDates(session: Pick<Session, 'days' | 'startDate' | 'endDate'>, today = todayInAthens(), n = SIGN_IN_DATES) {
  const all = meetings(session);
  const next = all.filter((d) => d >= today);
  return next.length ? next.slice(0, n) : all.slice(-n);
}

/** The sign-in sheet: children's names and one empty column per date. No care details. */
export function signInTable(students: RosterChild[], dates: string[]) {
  return {
    headers: ['Student', ...dates.map((d) => shortDate(d))],
    // A blank second line gives room to sign.
    rows: students.map((c) => [c.status === 'trial' ? `${c.name} (trial)` : c.name, ...dates.map(() => ' \n ')]),
  };
}

/** "Fall 2026 · Tuesdays · 4:30–5:30 pm · Studio · Zack Newcott". */
export function classLine(session: Session, location?: string) {
  return [session.label ? `${session.term} (${session.label})` : session.term, whenLabel(session), location, session.teacher].filter(Boolean).join(' · ');
}

// ───────────── The PDFs ─────────────

type Found = { program: Program; session: Session };

/** "Class Roster": every child with care details. Logged as admin.roster.pdf. */
export async function rosterPdf({ program, session }: Found, location: string | undefined, viewerId: string): Promise<PdfTable> {
  const { students } = await classRoster(session.id, viewerId, 'pdf');
  const { headers, rows } = rosterTable(students);
  const weights = [1.2, 0.4, 0.7, 2, 1.2, 1.3, 1.3, 1.7, 0.6];
  return {
    title: `Class Roster: ${program.title}`,
    subtitle: `${classLine(session, location)} · ${students.length} ${students.length === 1 ? 'child' : 'children'} · Includes allergies and medical notes. Share only with the teaching team.`,
    columns: headers.map((header, i) => ({ header, weight: weights[i] })),
    rows,
    orientation: 'landscape',
  };
}

/** "Student Sign-in Sheets": names and the next 8 class dates. No care details. Logged as admin.roster.sign-in-pdf. */
export async function signInPdf({ program, session }: Found, location: string | undefined, viewerId: string, today = todayInAthens()): Promise<PdfTable> {
  const { students } = await classRoster(session.id, viewerId, 'sign-in-pdf', today);
  const dates = signInDates(session, today);
  const { headers, rows } = signInTable(students, dates);
  return {
    title: `Student Sign-in Sheets: ${program.title}`,
    subtitle: classLine(session, location),
    columns: headers.map((header, i) => ({ header, weight: i === 0 ? 2.4 : 1 })),
    rows,
    orientation: 'landscape',
  };
}
