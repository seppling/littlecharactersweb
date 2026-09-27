# Content inventory & migration status

What we captured from the current Squarespace site, where it lives in the new site, and what still needs Hannah's eyes.

## How it was captured

On Sep 25, 2026, `npm run scrape` pulled every URL in littlecharacters.org's sitemap (74 pages) and 97 images. For each page the script saves:

- the Squarespace `?format=json` data, or the rendered HTML where the page is built from 7.1 sections;
- a Markdown copy in `content/scraped/pages/`;
- every image, full size, in `content/scraped/images/`.

It also downloaded two PDFs linked from the site: the Fall 2026 tuition guidelines and the parking guide.

```bash
npm run scrape   # re-run anytime; needs network access to littlecharacters.org + images.squarespace-cdn.com
```

**What's committed and what isn't.** The Markdown pages and the JSON manifests (`pages.json`, `images.json`, `events.*.json`, `site.json`) are committed. The full image set (~54 MB), the raw JSON dumps and the PDFs are git-ignored; re-run the scrape to get them back. The 26 photos the site actually uses were copied into `src/assets/photos`, `src/assets/team` and `src/assets/brand`, and Astro builds responsive versions of them.

## Where each old page went

| Current URL | New home | Notes |
|---|---|---|
| `/` (home) | `/` | Mission, "Our Approach" (3 steps with photos), what we offer, special-needs support, testimonials |
| `/classes-1` (Fall 2026 Classes) | `/programs`, `/programs/[slug]` | **Source of truth for the catalog.** All 10 offerings, with days, times, ages, prices, fees and teachers |
| `/classes`, `/classes1`, `/spring2024`, `/athens2024`, `/winterville2024` | none | Older semesters. Kept in `content/scraped/pages/` for reference |
| `/faqs` | `/faq` and program pages | Merged with the Fall 2026 tuition guidelines PDF |
| `/team` | `/about#team` | All 9 people, with headshots |
| `/geode` | `/geode` | Copy, classes, Third Thursday Improv, past-event photos |
| `/events` + 60 event pages | `/events` | Upcoming events migrated; past ones feed "Recent favorites" on `/camps` |
| `/giving-page` | `/give` | Adds the FAQ's "How can I support LC?" list and the Amazon Wish List |
| `/contact` | `/contact` | Adds the parking guide as a section |
| `/camp` | `/camps` | The old page is a 404 now; camp formats are rebuilt from the 2023–2025 camp event pages |
| `/services`, `/store` | none | `/services` is an unused Squarespace template (interior design demo). Delete it |

Set up 301 redirects at launch:

- `/classes-1` → `/programs`
- `/classes` → `/programs`
- `/camp` → `/camps`
- `/team` → `/about#team`
- `/faqs` → `/faq`
- `/giving-page` → `/give`
- `/events/*` → `/events`

## Photos in use

| Asset | Original | Used for |
|---|---|---|
| `photos/cast-silly-faces.webp` | Screenshot 2025-08-14 (cast photo) | Home hero, Summer Camp |
| `photos/teacher-with-students.webp` | IMG_1625 | Approach step 1, Private Lessons, Athens Academy |
| `photos/rehearsing-on-stage.webp` | IMG_1498 | Approach step 2, Intro to Theater |
| `photos/carnival-show.webp` | 20230520_190322 | Approach step 3, Produce a Show |
| `photos/camp-show-stage.webp` | scarterstudios_2023_144 | Performance Troupe, Camps hero |
| `photos/rehearsal-circle.webp` | Screenshot 2025-08-14 (circle) | About hero, Acting Studio, Free Community Class |
| `photos/full-house-twisted-tales.webp` | Little-Characters-Twisted-Tales-153 | About (inclusion) |
| `photos/film-green-screen-*.webp` (6) | Film class green-screen portraits | Film Creation, Stories and Songs, Homeschool, Parents' Night Out, Parties, Mini Camps |
| `photos/trust-game-outdoors.webp` | IMG_7481 | Yes, And… Improv |
| `photos/geode-*.webp` (3) | Geode page photos | Geode past events, Adult Improv |
| `team/*.webp` (9) | Team page headshots | About |
| `brand/logo-horizontal.webp`, `brand/logo-mark.png` | Logo Hz.png (trimmed) | Header, footer, favicon |

The green-screen portraits show identifiable children, as did the old site. It's worth confirming photo consent still covers the new site.

## Discrepancies found on the current site

**Decision (Sep 2026): pricing conflicts default to the monthly price.** Geode Acting Studio is now $95/month. The rest are tracked in `todo.md`. Otherwise the new site uses the first option listed in each case.

1. **Ratio.** The Fall 2026 page says 7 students per teacher; the FAQ says 8:1 with classes of 8–12. We say "classes of 8–12 kids, about 7 students per teacher".
2. **Geode Acting Studio.** The Fall 2026 page lists 8 weeks (Oct 20 – Dec 15) at $180 per session, teacher TBD. The Geode page lists weekly at $95/month with Peyton Harris. *Resolved: $95/month.*
3. **Produce a Show.** The Fall 2026 page says ages 7+ with CC Conner & Zack Newcott. The Geode page says ages 8+ with CC Conner & Carley Peden.
4. **Yes, And… Improv.** Wednesdays on the Fall 2026 page; Mondays on the Geode page.
5. **Adult improv price.** $25 on the Fall 2026 page; $20 on the Geode page.
6. **Parents' Night Out.** The heading says 5–8 pm; the body jokes "or until 9".
7. **Carley's last name.** "Pedan" on the Team page; "Peden" on ActiveKids.
8. **Who we serve.** The FAQ says LC is pre-K–5th and Geode is grades 6–12; the Geode page says Geode is 11+.

## Still to decide or supply

- **Fall Variety Show date** (December) and ticketing link. It shows on `/events` as "date coming soon".
- **Ovation.** It isn't on the Fall 2026 schedule. It's listed as "ask about the next dates"; confirm whether it continues.
- **Summer 2027 camp weeks.** Add them as sessions labeled "Week 1", "Week 2"… and the week-by-week grid on `/camps` appears automatically.
- **Holiday mini camps and workshops for 2026–27.** None are announced yet.
- **Free Community Class registration link.** The site currently says "Registration coming soon".
- **A real donation link.** The current giving page has copy but no payment form.
- **Form handling** for contact, newsletter and "notify me" (`site.forms` in `src/config/site.ts`).
- **School partners list** ("Athens Montessori School, Oglethorpe Ave. Elementary, Love.Craft Athens") is from the old home page and may be dated.
- **Hannah's full bio PDF** linked from the Team page returns 404.
- **More testimonials**, with permission.

## Copy written new for the redesign

Everything else is the site's own words, lightly edited for length. These lines are new:

- Section intros on the home page ("On the call sheet", "Where does my kid start?", "From 'I'm nervous' to a bow on stage", "Small groups. Big confidence.", "More ways to play").
- Pathway groupings (First steps / Find your voice / Make your own / Take the stage).
- Program taglines where the old site had none.
- The "What your gift covers" examples on `/give` (all use real Fall 2026 prices).
- The "A day at camp" timeline, assembled from the 2023 summer camp pages.
