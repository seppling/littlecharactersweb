// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';

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
  },
  trailingSlash: 'ignore',
  vite: {
    ssr: { external: ['@electric-sql/pglite'] },
  },
});
