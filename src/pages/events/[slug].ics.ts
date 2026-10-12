import type { APIRoute } from 'astro';
import { site } from '@/config/site';

/** "Add to calendar" files, one per dated event. */
// Floating local times with an explicit Eastern TZID, which every major calendar accepts.
const stamp = (iso: string) => iso.replace(/[-:]/g, '').slice(0, 13) + '00';
const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n');

export const GET: APIRoute = ({ params, locals }) => {
  const { events, locationById } = locals.content;
  const event = events.find((e) => e.slug === params.slug);
  if (!event || !event.times.length) return new Response('Not found', { status: 404 });
  const loc = locationById(event.locationId);
  const where = event.venue ?? (loc ? `${loc.name}, ${loc.address.join(', ')}` : '');
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

  const vevents = event.times.map((t, i) =>
    [
      'BEGIN:VEVENT',
      `UID:${event.slug}-${i}@littlecharacters.org`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=America/New_York:${stamp(t.start)}`,
      `DTEND;TZID=America/New_York:${stamp(t.end)}`,
      `SUMMARY:${escape(event.title)}`,
      `DESCRIPTION:${escape(`${event.summary}\n\n${site.url}/events#${event.slug}`)}`,
      where && `LOCATION:${escape(where)}`,
      'END:VEVENT',
    ]
      .filter(Boolean)
      .join('\r\n'),
  );

  const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${site.shortName}//Events//EN`, 'CALSCALE:GREGORIAN', ...vevents, 'END:VCALENDAR'].join('\r\n');

  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
};
