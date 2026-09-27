// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

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
  // Every page is rendered on request, so content edited at /admin/content
  // shows up as soon as it's published. The content is cached in memory (see
  // src/server/content.ts), and photos are resized ahead of time (src/lib/media.ts).
  output: 'server',
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
