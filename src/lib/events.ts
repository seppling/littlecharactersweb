/**
 * Shows get a page of their own (/events/<slug>), so families can share a
 * link to one show and Google can list it in its event results, which only
 * take pages about one event. Recurring nights (Parents' Night Out, the free
 * class, improv night) don't: their cards link to their class page instead.
 */
import { isUpcoming } from '@/content/catalog';
import type { EventItem, Location, Program } from '@/content/types';
import { enrollHref } from '@/lib/enroll';
import { isOffered, type BookingClock } from '@/lib/session-dates';
import { breadcrumbLd, eventLd } from '@/lib/seo';

/** Which events have a page of their own: shows, past ones too, so shared links keep working. */
export const hasShowPage = (e: Pick<EventItem, 'kind'>) => e.kind === 'show';

/** Where an event lives on the site: its own page for a show, its card on /events for the rest. */
export const eventPath = (e: Pick<EventItem, 'kind' | 'slug'>) => (hasShowPage(e) ? `/events/${e.slug}` : `/events#${e.slug}`);

/**
 * Where an event card's title links: a show's own page, or the class page
 * chosen in the editor (when that class still exists). Undefined for none.
 */
export function eventLink(e: EventItem, programExists: (slug: string) => boolean) {
  if (hasShowPage(e)) return `/events/${e.slug}`;
  if (e.programSlug && programExists(e.programSlug)) return `/programs/${e.programSlug}`;
  return undefined;
}

/** A dated show whose last performance is over (before `today`, YYYY-MM-DD). Undated shows haven't happened. */
export const isPastShow = (e: EventItem, today: string) => e.times.length > 0 && !isUpcoming(e, today);

/** Performances on or after `today`, the ones worth marking up for Google. */
export const upcomingTimes = (e: EventItem, today: string) => e.times.filter((t) => (t.end || t.start).slice(0, 10) >= today);

type Site = Parameters<typeof eventLd>[1]['site'];

/**
 * Structured data for a show's page: the breadcrumb, and one Event per
 * performance still to come. A show that's over, or has no date yet, gets no
 * Event (Google requires a start date, and past events don't belong there).
 */
export function showPageLd(e: EventItem, ctx: { site: Site; location?: Location; pageUrl: string; image?: string; today: string }) {
  const crumbs = breadcrumbLd([{ name: 'Shows & events', url: new URL('/events', ctx.site.url).href }, { name: e.title }]);
  const performances = eventLd({ ...e, times: upcomingTimes(e, ctx.today) }, ctx);
  return [crumbs, ...performances];
}

/**
 * The class date an event is booked through: the session of its class page
 * (`programSlug`) that runs on the event's one date. Parents' Night Out, the
 * improv nights and the free class are each a class with one session per
 * night, so families book an event in the same place as on the class page.
 * Undefined when the event has no class page, more than one date, or no
 * session that day; the event's own button is used then.
 */
export function eventSession(e: EventItem, programBySlug: (slug: string) => Program | undefined) {
  if (!e.programSlug || e.times.length !== 1) return undefined;
  const program = programBySlug(e.programSlug);
  const day = e.times[0].start.slice(0, 10);
  const session = program?.sessions.find((s) => s.startDate === day && s.endDate === day);
  return program && session ? { program, session } : undefined;
}

export interface EventAction {
  label: string;
  href: string;
}

/**
 * An event card's main button. An event booked through a class date gets that
 * date's sign-up (or its waitlist, or "Get notified" while it isn't open yet),
 * and nothing once sign-ups have closed: never a second way to book. Any other
 * event keeps the button set in the editor.
 */
export function eventAction(
  e: EventItem,
  programBySlug: (slug: string) => Program | undefined,
  clock: BookingClock,
): EventAction | undefined {
  const booked = eventSession(e, programBySlug);
  if (!booked) return e.cta;
  const { program, session } = booked;
  if (!isOffered(program, session, clock)) return undefined;
  if (session.status === 'coming-soon') return { label: 'Get notified', href: `/programs/${program.slug}#notify` };
  return { label: session.status === 'waitlist' ? 'Join waitlist' : 'Register', href: enrollHref(program, session) };
}
