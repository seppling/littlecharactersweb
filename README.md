# Little Characters Theater Troupe website

The new website for [Little Characters Theater Troupe](https://www.littlecharacters.org), a children's theater company in Athens, GA. It replaces the Squarespace site. The Phase 2 family portal (enrollment, payment, persistent login) will be built into this same codebase.

- **Stack:** [Astro](https://astro.build) static site with plain CSS design tokens. There is no CSS framework, and the only client-side JavaScript is the class-finder filter and the session picker. Photos are optimized at build time with `astro:assets`.
- **Docs:**
  - [`docs/research.md`](docs/research.md): exemplar sites and the patterns we took from them.
  - [`docs/content-inventory.md`](docs/content-inventory.md): what was migrated and what still needs Hannah's input.
  - [`docs/portal-phase-2.md`](docs/portal-phase-2.md): how the site connects to the future portal.

## Run it

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static site in dist/
npm run check     # type-check
```

## Where things live

```
src/
  config/site.ts        contact info, preview banner, portal links (Studio Director now, native later)
  data/                 all the content: programs + sessions, events, team, FAQs, locations
  lib/enroll.ts         the one place that decides where "Enroll" and "Family login" go
  lib/format.ts         dates, times, prices, age labels
  styles/tokens.css     colors, type scale, spacing (the design system)
  assets/               logo, photos and headshots (optimized at build time)
  styles/global.css     base styles + shared pieces (tape labels, buttons, chips)
  components/           Character (illustrations), PhotoFrame, ProgramCard/Row, SessionLine, EventTicket…
  pages/                /, /programs, /programs/[slug], /camps, /events, /about, /faq, /give, /contact, /geode, /account
scripts/
  scrape-squarespace.mjs  pulls copy + images from the old site into content/scraped/
```

### Editing content

Classes, camps, events, the team and FAQs are all typed data in `src/data/`. Add a session to a program and it shows up in the finder, on the program page, and in the camp calendar. The build fails if a field is missing or misspelled.

Photos: put files in `src/assets/photos/`, import them at the top of the data file, and set `image: { src: photo, alt: '…', position: '50% 30%' }` on the program or team member. `position` controls how the photo is cropped. Astro makes responsive, compressed versions at build time. A program with no photo gets a labeled placeholder.

### Migrating from Squarespace

```bash
npm run scrape
```

This reads the old site's sitemap and saves each page as Markdown in `content/scraped/pages/` and each image in `content/scraped/images/`. The Sep 25, 2026 run is the source for everything in `src/data/`. See `docs/content-inventory.md` for what went where and the open questions. (Behind a proxy, the npm script sets `NODE_USE_ENV_PROXY=1` so Node's `fetch` uses `HTTPS_PROXY`.)

## Design system

"House Lights & Spike Tape": a bright rehearsal room labeled with colored spike tape, with the lights going down for shows.

- **Type:** Bricolage Grotesque for display, Figtree for body text, and Courier Prime for schedules and logistics (the way scripts and call sheets are typed).
- **Color:** ink and a lilac-grey "hall" tint, plus the four colors of the logo mark (red, orange, teal, purple) and a sunny yellow. Each has an `-ink` variant that passes WCAG AA as text and a `-tint` for backgrounds. Set `data-gel="teal"` on any element to theme its children. Purple is the main button color.
- **Logo:** the real lockup in the header, and the four-color mark with live text in the footer and favicon.
- **Illustration:** the "little characters", five shape-people with costume props (`Character.astro`).

## Deploying

The site builds to static files, so any static host works: Netlify, Vercel or Cloudflare Pages (all have free tiers and preview deploys for every branch). Before launch:

1. Resolve the open questions in the content inventory and set `site.preview = false`.
2. Add form handlers and a donation link in `src/config/site.ts`. The Studio Director portal links are already live.
3. Add 301 redirects from the old Squarespace URLs (listed in the content inventory).
4. Point the domain at the new host.
