# Little Characters Theater Troupe website

The new website for [Little Characters Theater Troupe](https://www.littlecharacters.org), a children's theater company in Athens, GA. It replaces the Squarespace site. The Phase 2 family portal (enrollment, payment, persistent login) will be built into this same codebase.

- **Stack:** [Astro](https://astro.build) static site with plain CSS design tokens. There is no CSS framework, and the only client-side JavaScript is the class-finder filter and the session picker.
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
  styles/global.css     base styles + shared pieces (tape labels, buttons, chips)
  components/           Character (illustrations), PhotoFrame, ProgramCard/Row, SessionLine, EventTicket…
  pages/                /, /programs, /programs/[slug], /camps, /events, /about, /faq, /give, /contact, /geode, /account
scripts/
  scrape-squarespace.mjs  pulls copy + images from the old site into content/scraped/
```

### Editing content

Classes, camps, events, the team and FAQs are all typed data in `src/data/`. Add a session to a program and it shows up in the finder, on the program page, and in the camp calendar. The build fails if a field is missing or misspelled.

Photos: put files in `public/images/…` and set `image: { src: '/images/…', alt: '…' }` on the program or team member. Until then, each slot shows a labeled placeholder describing the photo it needs.

### Migrating from Squarespace

```bash
npm run scrape
```

This reads the old site's sitemap and saves each page as Markdown in `content/scraped/pages/` and each image in `content/scraped/images/`. It needs normal internet access; see `docs/content-inventory.md`.

## Design system

"House Lights & Spike Tape": a bright rehearsal room labeled with colored spike tape, with the lights going down for shows.

- **Type:** Bricolage Grotesque for display, Figtree for body text, and Courier Prime for schedules and logistics (the way scripts and call sheets are typed).
- **Color:** ink and a lilac-grey "hall" tint, plus five lighting-gel colors (magenta, amber, cyan, green, lilac). Each gel has an `-ink` variant that passes WCAG AA as text, and a `-tint` for backgrounds. Set `data-gel="cyan"` on any element to theme its children.
- **Illustration:** the "little characters", five shape-people with costume props (`Character.astro`).

## Deploying

The site builds to static files, so any static host works: Netlify, Vercel or Cloudflare Pages (all have free tiers and preview deploys for every branch). Before launch:

1. Replace the placeholder data (see the content inventory) and set `site.preview = false`.
2. Add real Studio Director links and form handlers in `src/config/site.ts`.
3. Add 301 redirects from the old Squarespace URLs (`/camp → /camps`, `/team → /about#team`, `/giving-page → /give`, `/classes → /programs`).
4. Point the domain at the new host.
