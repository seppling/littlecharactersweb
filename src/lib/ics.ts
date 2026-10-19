/**
 * "Add to calendar" files (.ics) for a class: one repeating event from its
 * first meeting to the end of the term.
 *
 * The public file (/calendar/<session>.ics) starts at the session's first day.
 * The family account's file starts at the child's own first class, names the
 * child, and adds a reminder an hour before each class.
 * Both leave out the class's days off (EXDATE).
 */
import { meetings } from './pricing';
import type { Session } from '@/content/types';

const BYDAY = { Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR', Sat: 'SA', Sun: 'SU' } as const;
const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');

/** The first class on or after `from` (YYYY-MM-DD), or undefined when the class has no meetings left. */
export function firstClassOnOrAfter(session: Pick<Session, 'days' | 'startDate' | 'endDate'>, from: string) {
  return meetings(session).find((m) => m >= from);
}

export interface ClassCalendar {
  session: Pick<Session, 'id' | 'days' | 'start' | 'end' | 'startDate' | 'endDate'>;
  /** The first meeting in the file (YYYY-MM-DD). */
  first: string;
  uid: string;
  summary: string;
  description: string;
  location?: string;
  prodId: string;
  /** Minutes before each class for a reminder; none when left out. */
  reminderMinutes?: number;
  /** Days off (YYYY-MM-DD): left out of the repeating event. */
  skip?: string[];
  now?: Date;
}

export function classCalendar(c: ClassCalendar) {
  const { session } = c;
  const date = c.first.replace(/-/g, '');
  const hm = (t: string) => t.replace(':', '') + '00';
  const until = session.endDate.replace(/-/g, '') + 'T235959Z';
  const repeating = c.first !== session.endDate && session.startDate !== session.endDate;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${c.prodId}`,
    'BEGIN:VEVENT',
    `UID:${c.uid}`,
    `DTSTAMP:${(c.now ?? new Date()).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
    `DTSTART;TZID=America/New_York:${date}T${hm(session.start)}`,
    `DTEND;TZID=America/New_York:${date}T${hm(session.end)}`,
    repeating ? `RRULE:FREQ=WEEKLY;BYDAY=${session.days.map((d) => BYDAY[d]).join(',')};UNTIL=${until}` : '',
    ...(repeating ? (c.skip ?? []).filter((d) => d >= c.first).map((d) => `EXDATE;TZID=America/New_York:${d.replace(/-/g, '')}T${hm(session.start)}`) : []),
    `SUMMARY:${escape(c.summary)}`,
    `DESCRIPTION:${escape(c.description)}`,
    c.location ? `LOCATION:${escape(c.location)}` : '',
    ...(c.reminderMinutes
      ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escape(c.summary)}`, `TRIGGER:-PT${c.reminderMinutes}M`, 'END:VALARM']
      : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}
