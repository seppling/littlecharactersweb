import type { APIRoute, GetStaticPaths } from 'astro';
import { programs } from '@/data/programs';
import { locationById } from '@/data/locations';
import { site } from '@/config/site';

/** "Add to calendar" for a class: one repeating event for the whole term. */
export const getStaticPaths: GetStaticPaths = () =>
  programs.flatMap((program) => program.sessions.map((session) => ({ params: { sessionId: session.id }, props: { program, session } })));

const BYDAY = { Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR', Sat: 'SA', Sun: 'SU' } as const;
const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');

export const GET: APIRoute = ({ props }) => {
  const { program, session } = props as { program: (typeof programs)[number]; session: (typeof programs)[number]['sessions'][number] };
  const loc = locationById(session.locationId);
  // First meeting on or after the start date that falls on one of the class days.
  const days = session.days.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(d));
  const first = new Date(`${session.startDate}T12:00:00Z`);
  while (!days.includes(first.getUTCDay())) first.setUTCDate(first.getUTCDate() + 1);
  const date = first.toISOString().slice(0, 10).replace(/-/g, '');
  const hm = (t: string) => t.replace(':', '') + '00';
  const until = session.endDate.replace(/-/g, '') + 'T235959Z';
  const repeating = session.startDate !== session.endDate;

  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${site.shortName}//Classes//EN`,
    'BEGIN:VEVENT',
    `UID:${session.id}@littlecharacters.org`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
    `DTSTART;TZID=America/New_York:${date}T${hm(session.start)}`,
    `DTEND;TZID=America/New_York:${date}T${hm(session.end)}`,
    repeating ? `RRULE:FREQ=WEEKLY;BYDAY=${session.days.map((d) => BYDAY[d]).join(',')};UNTIL=${until}` : '',
    `SUMMARY:${escape(`${program.title} (Little Characters)`)}`,
    `DESCRIPTION:${escape(`${site.url}/programs/${program.slug}`)}`,
    loc ? `LOCATION:${escape(`${loc.name}, ${loc.address.join(', ')}`)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');

  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
};
