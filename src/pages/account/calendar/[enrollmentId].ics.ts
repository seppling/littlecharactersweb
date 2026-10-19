import type { APIRoute } from 'astro';
import { site } from '@/config/site';
import { classCalendar, firstClassOnOrAfter } from '@/lib/ics';
import { classDates } from '@/server/class-day';
import { todayInAthens } from '@/lib/pricing';
import { getEnrollment, householdForUser } from '@/server/family';
import { childRehearsals } from '@/server/shows';

export const prerender = false;

/**
 * "Add to calendar" from the family account: the child's own classes, from
 * their first class (not the session's first day, which may be weeks before
 * they joined), named for the child, with a reminder an hour before; and
 * the child's show rehearsals for this class (src/server/shows.ts).
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
  const skip = (await classDates(session)).filter((d) => d.dayOff).map((d) => d.date);
  const where = (id: string | null) => {
    const l = id ? locals.content.locationById(id) : undefined;
    return l ? `${l.name}, ${l.address.join(', ')}` : undefined;
  };
  const extras = (await childRehearsals(row.student.id, session.id, locals.content, new Date())).map((r) => ({
    uid: `rehearsal-${r.id}-${row.student.id}@littlecharacters.org`,
    start: r.startsAt,
    end: r.endsAt,
    summary: `${row.student.firstName}: Rehearsal, ${r.showTitle}`,
    description: [r.note, `${site.url}/events/${r.showSlug}`].filter(Boolean).join('\n'),
    location: where(r.locationId),
  }));
  const body = classCalendar({
    session,
    skip,
    first,
    uid: `${row.enrollment.id}@littlecharacters.org`,
    prodId: `-//${site.shortName}//Family account//EN`,
    summary: `${row.student.firstName}: ${program.title}`,
    description: `${program.title} at ${site.shortName}. ${site.url}/programs/${program.slug}`,
    location: loc ? `${loc.name}, ${loc.address.join(', ')}` : undefined,
    reminderMinutes: 60,
    extras,
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
