/**
 * When a class date can be booked, and when it leaves the site. The dates
 * decide; Hannah's status in the editor only adds limits on top ("closed",
 * "waitlist", "coming soon"). An "open" status never keeps a past date bookable.
 *
 *  - One-day sessions (a night out, a workshop, the free class): sign-ups close
 *    when it starts.
 *  - Camp weeks (multi-day sessions of a camp): sign-ups close when the week starts.
 *  - Weekly classes: families can still join after the first class (the first
 *    month is prorated) until the late-joining cut-off, a number of weeks before
 *    the last day. It's a site setting (site.signups.lateJoinWeeks in the editor).
 *  - After its last day a session has ended and isn't shown on the site. It stays
 *    in the editor: enrollments and payments point to it.
 *
 * Times are Athens time. Pages are rendered on each request, so a date closes
 * at the right moment with no scheduled job.
 */
import type { Program, Session } from '@/content/types';

export const DEFAULT_LATE_JOIN_WEEKS = 4;

/** "Now" for the booking rules: Athens local time, plus the late-joining cut-off. */
export interface BookingClock {
  /** Athens local time, "YYYY-MM-DDTHH:MM". */
  now: string;
  lateJoinWeeks: number;
}

/** Athens local time as "YYYY-MM-DDTHH:MM". */
export function athensNow(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** A setting that isn't a sensible whole number of weeks falls back to the default. */
export function lateJoinWeeksOr(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 52 ? value : DEFAULT_LATE_JOIN_WEEKS;
}

export function bookingClock(lateJoinWeeks?: number, date = new Date()): BookingClock {
  return { now: athensNow(date), lateJoinWeeks: lateJoinWeeksOr(lateJoinWeeks) };
}

const oneDay = (s: Pick<Session, 'startDate' | 'endDate'>) => s.startDate === s.endDate;

function minusWeeks(iso: string, weeks: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - weeks * 7);
  return d.toISOString().slice(0, 10);
}

/** How a session's sign-ups close: when it starts, or at the late-joining cut-off. */
export const closesAtStart = (program: Pick<Program, 'kind'>, session: Pick<Session, 'startDate' | 'endDate'>) => oneDay(session) || program.kind === 'camp';

/** When sign-ups close, Athens local time "YYYY-MM-DDTHH:MM". */
export function signupsCloseAt(program: Pick<Program, 'kind'>, session: Pick<Session, 'startDate' | 'endDate' | 'start'>, lateJoinWeeks: number) {
  const starts = `${session.startDate}T${session.start || '00:00'}`;
  if (closesAtStart(program, session)) return starts;
  const cutOff = `${minusWeeks(session.endDate, lateJoinWeeks)}T00:00`;
  // A short class never closes before it starts.
  return cutOff > starts ? cutOff : starts;
}

/** What the dates alone say: sign-ups open, sign-ups closed (still running), or over. */
export type SessionState = 'open' | 'signups-closed' | 'ended';

export function sessionState(program: Pick<Program, 'kind'>, session: Session, clock: BookingClock): SessionState {
  if (clock.now.slice(0, 10) > session.endDate) return 'ended';
  if (clock.now >= signupsCloseAt(program, session, clock.lateJoinWeeks)) return 'signups-closed';
  return 'open';
}

/** For the editor, beside each session that's no longer on the site because of its dates. */
export const stateLabels: Record<Exclude<SessionState, 'open'>, string> = {
  'signups-closed': 'Sign-ups closed',
  ended: 'Ended',
};

/** On the site: open by date and not closed by Hannah. Includes "coming soon" dates (shown, not bookable yet). */
export function isOffered(program: Pick<Program, 'kind'>, session: Session, clock: BookingClock) {
  return session.status !== 'closed' && sessionState(program, session, clock) === 'open';
}

/** Families can sign up (or join the waitlist) right now. */
export function canBook(program: Pick<Program, 'kind'>, session: Session, clock: BookingClock) {
  return session.status !== 'coming-soon' && isOffered(program, session, clock);
}

/** The sessions the site shows for a program, in editor order. */
export function offeredSessions(program: Program, clock: BookingClock) {
  return program.sessions.filter((s) => isOffered(program, s, clock));
}

const weeksBefore = (n: number) => (n === 0 ? 'on the day of' : n === 1 ? 'a week before' : `${n} weeks before`);

/**
 * Why a family can't sign up for this session right now, in words for them,
 * or null when they can. "Coming soon" is left to the page (it has its own
 * "Get notified" step).
 */
export function bookingProblem(program: Program, session: Session, clock: BookingClock): string | null {
  if (session.status === 'closed') return `Sign-ups for this ${program.title} date are closed.`;
  const state = sessionState(program, session, clock);
  if (state === 'ended') return `This ${program.title} date has already happened.`;
  if (state === 'signups-closed') {
    return closesAtStart(program, session)
      ? `Sign-ups for this ${program.title} date closed when it started.`
      : `Sign-ups for ${program.title} (${session.term}) closed ${weeksBefore(clock.lateJoinWeeks)} the last class.`;
  }
  return null;
}
