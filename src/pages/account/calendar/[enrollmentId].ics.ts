import type { APIRoute } from 'astro';
import { site } from '@/config/site';
import { classCalendar, firstClassOnOrAfter } from '@/lib/ics';
import { todayInAthens } from '@/lib/pricing';
import { getEnrollment, householdForUser } from '@/server/family';

export const prerender = false;

/**
 * "Add to calendar" from the family account: the child's own classes, from
 * their first class (not the session's first day, which may be weeks before
 * they joined), named for the child, with a reminder an hour before.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.user;
  if (!user) return new Response('Sign in first', { status: 401 });
  const household = await householdForUser(user.id);
  const row = household ? await getEnrollment(household.id, params.enrollmentId ?? '') : null;
  const found = row && row.enrollment.status !== 'cancelled' && row.enrollment.status !== 'waitlist' ? locals.content.findSession(row.enrollment.sessionId) : undefined;
  if (!row || !found) return new Response('Not found', { status: 404 });
  const { program, session } = found;
  const joined = todayInAthens(row.enrollment.createdAt);
  const first = firstClassOnOrAfter(session, joined);
  if (!first) return new Response('This class has no more dates', { status: 404 });
  const loc = locals.content.locationById(session.locationId);
  const body = classCalendar({
    session,
    first,
    uid: `${row.enrollment.id}@littlecharacters.org`,
    prodId: `-//${site.shortName}//Family account//EN`,
    summary: `${row.student.firstName}: ${program.title}`,
    description: `${program.title} at ${site.shortName}. ${site.url}/programs/${program.slug}`,
    location: loc ? `${loc.name}, ${loc.address.join(', ')}` : undefined,
    reminderMinutes: 60,
  });
  const filename = `${row.student.firstName}-${program.slug}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  });
};
