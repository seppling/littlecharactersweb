/**
 * What search engines and link previews read: page titles and structured
 * data (JSON-LD, https://schema.org), built only from the site's real content.
 * src/layouts/Base.astro puts it in each page's <head>.
 */
import type { EventItem, Location, Program } from '@/content/types';

/**
 * The addresses search engines should index. Every other host (the Render
 * previews, the private production address before the domain moves, a laptop)
 * is sent "noindex", so search results never show a copy of the site.
 */
const LIVE_HOSTS = new Set(['littlecharacters.org', 'www.littlecharacters.org']);
export const isLiveHost = (hostname: string) => LIVE_HOSTS.has(hostname.toLowerCase());

/** How every page title is built: the page's own title, then the company name, unless the title already says it. */
export function pageTitle(title: string | undefined, names: { name: string; shortName: string }) {
  if (!title?.trim()) return `${names.name} · Athens, GA`;
  return title.toLowerCase().includes(names.shortName.toLowerCase()) ? title : `${title} · ${names.shortName}`;
}

/**
 * Structured data for a <script type="application/ld+json">. `<` is escaped so
 * text from the editor can't close the script tag, and the two line breaks
 * that JSON allows but JavaScript once didn't are escaped too.
 */
export const jsonLd = (data: unknown) =>
  JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

const ATHENS = 'America/New_York';

/** The UTC offset in Athens at that instant, like "-04:00". */
function offsetAt(instant: Date) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: ATHENS, timeZoneName: 'longOffset' })
    .formatToParts(instant)
    .find((p) => p.type === 'timeZoneName')?.value;
  const m = name?.match(/GMT([+-]\d{2}):?(\d{2})?/);
  return m ? `${m[1]}:${m[2] ?? '00'}` : '+00:00';
}

/**
 * A local Athens time from the editor ("2026-11-02T16:00") → ISO 8601 with the
 * offset that applies on that day ("2026-11-02T16:00:00-05:00"). Undefined for
 * anything that isn't a date and time.
 */
export function athensDateTime(local: string | undefined) {
  const m = local?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return undefined;
  const [, y, mo, d, h, mi, s = '00'] = m;
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  if (Number.isNaN(wall)) return undefined;
  // Guess the instant with the offset at the wall time, then correct once (for days the clocks change).
  let offset = offsetAt(new Date(wall));
  const minutes = (o: string) => (o.startsWith('-') ? -1 : 1) * (Number(o.slice(1, 3)) * 60 + Number(o.slice(4, 6)));
  offset = offsetAt(new Date(wall - minutes(offset) * 60_000));
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${offset}`;
}

/** Address lines as entered for a location ("1635 W Broad St", "Athens, GA 30606") → a PostalAddress. */
export function postalAddress(lines: string[] | undefined) {
  const clean = (lines ?? []).map((l) => l.trim()).filter(Boolean);
  if (!clean.length) return undefined;
  const last = clean.at(-1)!.match(/^(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (!last || clean.length < 2) return { '@type': 'PostalAddress', streetAddress: clean.join(', '), addressCountry: 'US' };
  return {
    '@type': 'PostalAddress',
    streetAddress: clean.slice(0, -1).join(', '),
    addressLocality: last[1],
    addressRegion: last[2],
    postalCode: last[3],
    addressCountry: 'US',
  };
}

export const place = (loc: Location) => ({ '@type': 'Place', name: loc.name, address: postalAddress(loc.address) });

interface SiteFacts {
  name: string;
  shortName: string;
  url: string;
  description: string;
  founded: number;
  founder: string;
  contact: { email: string; phone: string };
  social: { instagram?: string; facebook?: string };
}


/** The company: a theater troupe that teaches classes. Only what the site's content says. */
export function organizationLd(input: { site: SiteFacts; locations: Location[]; hq?: Location; logo: string; image?: string }) {
  const { site, locations, hq } = input;
  return {
    '@context': 'https://schema.org',
    '@type': ['TheaterGroup', 'EducationalOrganization'],
    '@id': `${site.url}/#organization`,
    name: site.name,
    alternateName: site.shortName,
    description: site.description,
    url: site.url,
    logo: input.logo,
    image: input.image,
    email: site.contact.email,
    telephone: site.contact.phone,
    foundingDate: String(site.founded),
    founder: { '@type': 'Person', name: site.founder },
    address: hq ? postalAddress(hq.address) : undefined,
    location: locations.length ? locations.map(place) : undefined,
    sameAs: [site.social.instagram, site.social.facebook].filter(Boolean),
  };
}

/** A price written in the editor → a schema.org Offer price, only when it's plainly one price ("Free", "$25"). */
export function offerPrice(price: string | undefined) {
  const text = price?.trim();
  if (!text) return undefined;
  if (/^free$/i.test(text)) return 0;
  const m = text.match(/^\$(\d+(?:\.\d{2})?)$/);
  return m ? Number(m[1]) : undefined;
}

const absolute = (href: string | undefined, base: string) => {
  if (!href) return undefined;
  try {
    const url = new URL(href, base);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
};

/**
 * One schema.org Event per performance of an event, following Google's event
 * guidelines. Events without a date ("date coming soon") or without a street
 * address are left out: Google needs both.
 */
export function eventLd(event: EventItem, ctx: { site: SiteFacts; location?: Location; pageUrl: string; image?: string }) {
  // Another venue ("State Botanical Garden") is only a name, without the street address Google needs.
  const location = ctx.location && !event.venue ? place(ctx.location) : undefined;
  if (!location?.address) return [];
  const price = offerPrice(event.price);
  const ticketUrl = absolute(event.cta?.href, ctx.site.url) ?? ctx.pageUrl;
  return event.times.flatMap((t) => {
    const startDate = athensDateTime(t.start);
    if (!startDate) return [];
    const endDate = athensDateTime(t.end);
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: event.title,
        description: event.summary,
        startDate,
        endDate: endDate && endDate > startDate ? endDate : undefined,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location,
        image: ctx.image ? [ctx.image] : undefined,
        organizer: { '@type': 'Organization', name: ctx.site.name, url: ctx.site.url },
        offers:
          price === undefined ? undefined : { '@type': 'Offer', price, priceCurrency: 'USD', url: ticketUrl },
        url: ctx.pageUrl,
      },
    ];
  });
}

/** Kinds of programs that are courses in Google's sense: taught by teachers, with skills to learn. Camps and parties aren't. */
export const COURSE_KINDS: Program['kind'][] = ['class', 'inclusive', 'lesson', 'workshop'];
export const isCourse = (p: Program) => COURSE_KINDS.includes(p.kind);

/** A class as a schema.org Course (Google's "course list" result). */
export function courseLd(program: Program, ctx: { site: SiteFacts; url: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: program.title,
    description: program.summary,
    url: ctx.url,
    provider: { '@type': 'Organization', name: ctx.site.name, sameAs: ctx.site.url },
  };
}

/** The list of courses on the class finder, which Google pairs with each class page's Course. */
export function courseListLd(urls: string[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: urls.map((url, i) => ({ '@type': 'ListItem', position: i + 1, url })),
  };
}

/** The trail at the top of a page. The last step is the page itself, so it has no link. */
export function breadcrumbLd(steps: { name: string; url?: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: steps.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s.name, item: s.url })),
  };
}
