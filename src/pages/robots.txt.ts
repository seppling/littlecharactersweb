import type { APIRoute } from 'astro';
import { site } from '@/config/site';

export const GET: APIRoute = () =>
  new Response(['User-agent: *', 'Disallow: /account', 'Disallow: /enroll', 'Disallow: /admin', 'Disallow: /dev', '', `Sitemap: ${site.url}/sitemap.xml`, ''].join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
