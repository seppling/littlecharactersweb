import type { APIRoute } from 'astro';
import { site } from '@/config/site';
import { classCalendar, firstClassOnOrAfter } from '@/lib/ics';
import { classDates } from '@/server/class-day';

/**
 * "Add to calendar" for a class: one repeating event for the whole term. The
 * family account offers its own file per child (src/pages/account/calendar).
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const found = locals.content.findSession(params.sessionId ?? '');
  if (!found) return new Response('Not found', { status: 404 });
  const { program, session } = found;
  const loc = locals.content.locationById(session.locationId);
  const skip = (await classDates(session)).filter((d) => d.dayOff).map((d) => d.date);
  const body = classCalendar({
    session,
    skip,
    first: firstClassOnOrAfter(session, session.startDate) ?? session.startDate,
    uid: `${session.id}@littlecharacters.org`,
    prodId: `-//${site.shortName}//Classes//EN`,
    summary: `${program.title} (Little Characters)`,
    description: `${site.url}/programs/${program.slug}`,
    location: loc ? `${loc.name}, ${loc.address.join(', ')}` : undefined,
  });
  return new Response(body, { headers: { 'Content-Type': 'text/calendar; charset=utf-8' } });
};
