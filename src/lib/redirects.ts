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
};

/** Where an old address now lives, or undefined when it isn't one. */
export function oldSiteRedirect(pathname: string): string | undefined {
  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  if (path in OLD_PAGES) return OLD_PAGES[path];
  // The old site gave each event its own page; the new one lists them all on
  // /events. Calendar files (/events/<slug>.ics) are real pages here.
  if (path.startsWith('/events/') && !path.endsWith('.ics')) return '/events';
  return undefined;
}
