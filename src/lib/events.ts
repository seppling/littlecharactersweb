/**
 * Shows get a page of their own (/events/<slug>), so families can share a
 * link to one show and Google can list it in its event results, which only
 * take pages about one event. Recurring nights (Parents' Night Out, the free
 * class, improv night) don't: their cards link to their class page instead.
 */
import { isUpcoming } from '@/content/catalog';
import type { EventItem, Location } from '@/content/types';
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
