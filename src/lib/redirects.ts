/**
 * Addresses from the old Squarespace site that people and Google still have,
 * sent to their new home with a permanent (301) redirect. See
 * docs/content-inventory.md for where each old page went.
 */
const OLD_PAGES: Record<string, string> = {
  '/home': '/',
  '/classes-1': '/programs',
  '/classes': '/programs',
  '/classes1': '/programs',
  '/camp': '/camps',
  '/team': '/about#team',
  '/faqs': '/faq',
  '/giving-page': '/give',
  // PDFs the old site linked to, now pages here (keys in lower case).
  '/s/little-characters-parking-instructions.pdf': '/contact#parking',
  '/s/hannah-eppling-experience-and-teaching-philosophy-1.pdf': '/about',
};

/**
 * Where an old address now lives, or undefined when it isn't one.
 * `hasShowPage` says which /events/<slug> addresses are a current show's page
 * (src/pages/events/[slug].astro); without it, none are.
 */
export function oldSiteRedirect(pathname: string, hasShowPage: (slug: string) => boolean = () => false): string | undefined {
  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (path in OLD_PAGES) return OLD_PAGES[path];
  // The old site gave each event its own page. Here only shows have one; other
  // old event addresses go to the list on /events. Calendar files
  // (/events/<slug>.ics) are real pages here.
  if (path.startsWith('/events/') && !path.endsWith('.ics')) {
    const slug = path.slice('/events/'.length);
    if (!hasShowPage(slug)) return '/events';
    // A show's page, written another way ("/events/Show/") → its one address.
    return pathname === `/events/${slug}` ? undefined : `/events/${slug}`;
  }
  return undefined;
}
