# Little Characters Theater Troupe website

The new website for [Little Characters Theater Troupe](https://www.littlecharacters.org), a children's theater company in Athens, GA. It replaces the Squarespace site and Studio Director. The family portal (enrollment, payment, persistent login) is part of this same codebase, so families never leave the site.

- **Stack:**
  - [Astro](https://astro.build) with plain CSS design tokens. Marketing pages are prerendered; `/enroll`, `/account`, `/admin` and `/api` are server-rendered.
  - Postgres via Drizzle, with embedded PGlite in development so there's nothing to install.
  - Sign-in by emailed code with [Better Auth](https://better-auth.com).
  - Payments with Stripe Embedded Checkout.
- **Docs:**
  - [`docs/todo.md`](docs/todo.md): decisions made and what's left to do. **Start here.**
  - [`docs/portal.md`](docs/portal.md): the enrollment journey, billing rules, persistent login, and moving families from Studio Director.
  - [`docs/infrastructure.md`](docs/infrastructure.md): hosting, database, email, content management, backups, costs and upkeep.
  - [`docs/security.md`](docs/security.md): OWASP Top 10 mapping, PCI, children's data, retention, secrets.
  - [`docs/research.md`](docs/research.md): exemplar sites and the patterns we took from them.
  - [`docs/content-inventory.md`](docs/content-inventory.md): what was migrated and what still needs Hannah's input.

## Run it

```bash
npm install
npm run dev       # http://localhost:4321, site + portal, no setup needed
npm run check     # type-check
npm test          # unit tests: pricing, autopay, Studio Director import, access control
npm run build     # production build in dist/
```

In development:
- The database is embedded Postgres in `.data/` (git-ignored).
- Emails, including sign-in codes, land in the mailbox at [`/dev/mailbox`](http://localhost:4321/dev/mailbox).
- Without Stripe keys, a clearly labeled test-payment button stands in for the card form.

To try staff rosters, start with `ADMIN_EMAILS=you@example.com npm run dev` and sign in with that address.

With Stripe **test** keys in `.env` (copy `.env.example`), the real embedded card form appears; use card `4242 4242 4242 4242`.

End-to-end journey in a real browser (sign in → enroll → pay → dashboard → staff roster → imported family):

```bash
npm run build && tests/e2e/serve.sh     # fresh local database with a sample import
node tests/e2e/enroll-journey.mjs       # in a second terminal
```

## Where things live

```
src/
  config/site.ts        contact info, preview banner, portal switch (native portal or Studio Director)
  data/                 all the content: programs + sessions, events, team, FAQs, locations
  lib/enroll.ts         the one place that decides where "Enroll" and "Family login" go
  lib/format.ts         dates, times, prices, age labels
  styles/tokens.css     colors, type scale, spacing (the design system)
  assets/               logo, photos and headshots (optimized at build time)
  styles/global.css     base styles + shared pieces (tape labels, buttons, chips)
  components/           Character (illustrations), PhotoFrame, ProgramCard/Row, SessionLine, EventTicket…
  pages/                /, /programs, /programs/[slug], /camps, /events, /about, /faq, /give, /contact, /geode
  pages/enroll, account, admin, api   the family portal (server-rendered)
  server/               database, auth, payments, email, encryption (see docs/portal.md)
  lib/pricing.ts        every billing rule, unit-tested
drizzle/                database migrations
scripts/
  scrape-squarespace.mjs          pulls copy + images from the old site into content/scraped/
  import-studio-director.ts       imports families and students from Studio Director CSVs
  invite-imported-families.ts     "your account is ready" emails for imported families
  run-billing.ts                  monthly autopay by hand (normally the daily scheduler does it)
tests/unit, tests/e2e
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

See [`docs/infrastructure.md`](docs/infrastructure.md). In short:
- Netlify (or Vercel) for the site and portal, Neon for Postgres, Resend for email, Stripe for payments.
- Set the environment variables from `.env.example` in the host's dashboard.
- Run `npm run db:migrate` once, then deploy on every push.
- CI (`.github/workflows/ci.yml`) type-checks, tests and builds every push, and Dependabot keeps dependencies patched.
- Monthly autopay runs daily via `.github/workflows/billing.yml` once its two secrets are set.

The launch checklist is in [`docs/todo.md`](docs/todo.md).
