import type { APIRoute } from 'astro';
import { site } from '@/config/site';
import { isUpcoming } from '@/content/catalog';
import { hasShowPage } from '@/lib/events';
import { todayInAthens } from '@/lib/pricing';

/** The public pages, including every class page and the pages of shows still to come, for search engines. The portal stays out. */
export const GET: APIRoute = ({ locals }) => {
  const { programs, events } = locals.content;
  const today = todayInAthens();
  const shows = events.filter((e) => hasShowPage(e) && isUpcoming(e, today)).map((e) => `/events/${e.slug}`);
  const paths = ['/', '/programs', '/camps', '/events', '/about', '/geode', '/faq', '/give', '/contact', ...programs.map((p) => `/programs/${p.slug}`), ...shows];
  const urls = paths.map((path) => `  <url><loc>${new URL(path, site.url).href}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
