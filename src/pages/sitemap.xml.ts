import type { APIRoute } from 'astro';
import { site } from '@/config/site';

/** The public pages, including every class page, for search engines. The portal stays out. */
export const GET: APIRoute = ({ locals }) => {
  const paths = ['/', '/programs', '/camps', '/events', '/about', '/geode', '/faq', '/give', '/contact', ...locals.content.programs.map((p) => `/programs/${p.slug}`)];
  const urls = paths.map((path) => `  <url><loc>${new URL(path, site.url).href}</loc></url>`).join('\n');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
