// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.littlecharacters.org',
  integrations: [sitemap()],
  // Static for now. Phase 2 (family portal) switches to `output: 'server'`
  // with an adapter so /account and /enroll can read the session cookie,
  // while marketing pages stay prerendered.
  output: 'static',
  trailingSlash: 'ignore',
});
