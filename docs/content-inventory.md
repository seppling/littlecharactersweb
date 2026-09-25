# Content inventory & migration status

What we captured from the current Squarespace site (littlecharacters.org), where it lives in the new site, and what still needs Hannah's eyes.

## How this was gathered

The build environment's network policy blocks `littlecharacters.org` and the Squarespace image CDN, so the first pass was assembled from **search-engine copies of each page** (plus Macaroni KID Athens, ActiveKids and the UGA Grady article). That gives us the copy and facts, but **no images and no guarantee of word-for-word accuracy**.

To do the full migration (verbatim copy + every photo):

```bash
npm run scrape            # writes content/scraped/{pages/*.md, images/, images.json, *.upcoming.json}
```

Run it anywhere with normal internet access (a laptop is fine), or allow these hosts in the Claude Code environment's network settings and ask Claude to run it: `www.littlecharacters.org`, `littlecharacters.org`, `images.squarespace-cdn.com`, `static1.squarespace.com`.

The script uses Squarespace's built-in `?format=json` view of every URL in `/sitemap.xml`, so it gets clean body copy, event data and full-resolution image URLs without scraping the theme.

## Pages on the current site

| Current URL | What's there | New home | Status |
|---|---|---|---|
| `/` | Mission, programs overview, camps, classes & workshops, Geode, Ovation, contact | `/` | Migrated (from search copy) |
| `/classes` (also `/classes1`, `/athens2024`, `/winterville2024`) | Class list, pricing tiers, first-class-free, discounts, ratios | `/programs`, `/programs/[slug]` | Migrated; **schedule is placeholder** |
| `/camp` | Summer camp overview, Winterville location, $150 teen intensive, deposit policy, scholarships | `/camps` | Migrated; **2027 weeks are placeholder** |
| `/events` + `/events/*` | Variety shows, Kid Zone at Wild Rumpus, Ovation, summer camp weeks | `/events` | Migrated; **fall 2026 dates are placeholder** |
| `/team` | Founder + staff bios | `/about#team` | Migrated; see open questions |
| `/faqs` | Deposit/payment policy, Fun Mondays, Parents' Night Out, parties | `/faq` + program pages | Migrated |
| `/geode` | Sister company for 12+ and adults, pricing, First Friday Improv | `/geode` | Migrated |
| `/giving-page` | Donations → scholarship fund | `/give` | Migrated; donate button still points to the old page |
| `/contact` | Email, phone, HQ address and directions | `/contact` | Migrated |

Old URLs should get 301 redirects to the new ones at launch (e.g. `/camp → /camps`, `/team → /about#team`, `/giving-page → /give`, `/classes → /programs`).

## Facts carried over (verified in 2+ sources)

- Founded 2022 by Hannah Eppling; origin story (Pre-K moms' group text; Athens lost several historic kids' theater companies).
- Mission: "Every person has a story worth telling…"
- Ages 4–17 for LC; Geode 12+ and adults. "Classes to students ages 4–100."
- Tuition: $85/mo (45 min), $95/mo (1 hr), $115/mo (1¼ hr).
- First class free for new students. 15% sibling and 15% multi-class discounts. Scholarships available.
- 7:1 student/teacher ratio in classes, capped at 20. Camps 8:1.
- Camps ≈ $50/day; $50 non-refundable deposit at registration; balance due the week before camp.
- Teen Improv & Writing Intensive: ages 11–17, 3 days, 9 am–1 pm, $150 incl. snacks and materials, no lunch.
- Ovation: monthly, special-needs class with It's Good to See You Productions, at Brella Studio, $15/class, scholarships.
- Parents' Night Out until 8 pm; downtown is 1 mile away. Birthday parties: 2 hours, evenings/weekends, coordinator, stage, tables.
- Fun Mondays with CC: HQ, 1–5 pm, register by noon the Sunday before.
- HQ: 1635 W Broad St, Athens 30606 (south side, between Rocksprings and Alps; 5,000 sq ft accessible space).
- Winterville Campus for Arts & Culture / Marigold Auditorium, 371 N Church St, Winterville 30683.
- Athens Academy Lower School enrichment: Mondays 4:00–5:15, Sep 14–Nov 9 2026, Harrison Center, CC Conner & Carley Peden, via ActiveKids.
- Contact: littlecharacterstheater@gmail.com, (281) 798-2623, @littlecharactersathens.
- One parent testimonial (camp), used verbatim.

## Placeholders to replace before launch

Everything below is in `src/data/` and flagged with comments. The site shows a "Design preview" banner until `site.preview` is set to `false` in `src/config/site.ts`.

- **Class schedule** (days, times, which location, capacity, spots left) for every weekly class.
- **Ages** for Theater Games, Intro to Theater, Intermediate Improv, Film 101, Scenes & Monologues, Middle School Improv, Techies (we inferred bands from class names).
- **Holiday mini camp** dates (Thanksgiving Nov 23–25, Winter Dec 21–23) and ages.
- **Summer 2027** camp names, weeks, ages, locations. The Little Characters Camp (4–6) name is new.
- **Event dates** for fall 2026 (Variety Show, Wild Rumpus Kid Zone, Parents' Night Out, Ovation, First Friday Improv).
- **"A day at camp"** timeline on `/camps` is a sample.
- **Adult improv class** (Geode) schedule and price.
- **Real Studio Director links** in `src/config/site.ts` (`portal.studioDirector.login/enroll`).
- **Form handling** for contact, newsletter and "notify me" (`site.forms`).
- **Logo files.** The header uses a placeholder wordmark with a character mark.
- **Photos.** Every image slot shows a labeled placeholder naming the shot it wants. Once the scrape runs, drop photos into `public/images/` and set `image.src` in the data files.

## Open questions for Hannah

1. The search results tied an Early Childhood Education / daycare-director bio to **Shondra Taylor**. Is she on the team, and what's her role?
2. **Emily** (set & costume designer): last name and whether she teaches Techies.
3. **CC Conner**: title and bio.
4. Is **Produce a Show** still limited to returning students? (The site says so, based on the current copy.)
5. Is Ovation still at **Brella Studio**, or has it moved to HQ?
6. Does **WORK.SHOP** (off Chase St) still host improv camps?
7. The Back of House directory lists **1195 Oglethorpe Ave**. Is that an old address?
8. The Macaroni KID listing says "371 N **Chase** St, Winterville". We used **Church** St, from the camp page.
9. Birthday party and private lesson **pricing**: publish it, or keep "by request"?
10. More **testimonials**, with permission to use first names.

## New copy written for the redesign

These lines are new (not from the old site) and should be read for voice:
- Program taglines and some description paragraphs in `src/data/programs.ts`.
- Home page section intros ("Where does my kid start?", "Small groups. Big confidence.", "On the call sheet").
- Pathway groupings (First steps / Find your voice / Make your own / Take the stage).
- Give page "what your gift covers" examples (all use real prices).
- FAQ answer for "What should my child wear?" (drafted).
