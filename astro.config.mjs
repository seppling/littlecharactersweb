// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

/**
 * Hosts sit behind a proxy that forwards the real domain and https in
 * X-Forwarded-* headers. Astro only trusts those for domains listed here;
 * otherwise every form post looks cross-site and is rejected. Read at build
 * time: the live domain, SITE_URL, and Render's preview hostname (plus any
 * *.onrender.com address when building on Render, for previews).
 */
/** @param {string | undefined} url */
const hostOf = (url) => {
  try {
    return url ? new URL(url).hostname : undefined;
  } catch {
    return undefined;
  }
};
const siteHosts = [
  'littlecharacters.org',
  'www.littlecharacters.org',
  hostOf(process.env.SITE_URL),
  process.env.RENDER_EXTERNAL_HOSTNAME,
  process.env.RENDER ? '**.onrender.com' : undefined,
].filter((h) => h && h !== 'localhost');

export default defineConfig({
  site: 'https://www.littlecharacters.org',
  integrations: [
    sitemap({
      // Keep the family portal out of search results.
      filter: (page) => !/\/(account|enroll|admin|dev)(\/|$)/.test(new URL(page).pathname),
    }),
  ],
  // Marketing pages are prerendered (fast, cacheable). Portal routes opt into
  // server rendering with `export const prerender = false`.
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  security: {
    // Rejects cross-site form posts to server routes (CSRF protection).
    checkOrigin: true,
    allowedDomains: [...new Set(siteHosts)].map((hostname) => ({ hostname, protocol: 'https' })),
  },
  trailingSlash: 'ignore',
  vite: {
    ssr: { external: ['@electric-sql/pglite'] },
  },
});
