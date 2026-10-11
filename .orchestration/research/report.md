# Report: search research unit

## Result

- **`docs/seo/research.md`** (new). The search plan:
  - §0: ground rules for everyone writing wording.
  - §1: search demand, in 12 groups, with estimates.
  - §2: who ranks today, and why.
  - §3: page-by-page targets. That covers 9 site pages and all 17 programs, plus guidance for events and FAQs.
  - §4: local signals.
  - §5: listings worth having.
  - §6: 20 questions for Hannah.
  - §7: the ten most important changes.
  - §8: follow-up candidates.
- **`.orchestration/research/state.md`** and **this report**.
- Nothing in `src/`, `scripts/`, `docs/seo/log.md` or other docs changed.

## Proof

- **Title and description lengths.** A small Python script (in the scratchpad, not committed) pulls every `Title field`, `Full title` and `Description` value out of the plan. It checks each title field is 40 characters or fewer, each full title 60 or fewer and each description 155 or fewer. It also checks that each full title equals its field plus " · Little Characters".
  - Final run: `titles 26 fulls 26 problems 0`.
  - The longest values are exactly at the limits: 40, 60 and 155.
  - The first run found two descriptions over 155 (Athens Academy at 157, Ovation at 165). Both were fixed and counted again.
- **Slug coverage.** A shell loop over every `slug:` in `src/content/seed/programs.ts` checks the plan has a `/programs/<slug>` heading. All 17 are covered.
- **"GA" check.** A script confirms each page target has "GA" or "Georgia" in its title or description. The one exception is Athens Academy Enrichment, which the school's name places; the plan says so.
- **Facts checked against the seed.** Every description was re-read against `programs.ts`, `pages.ts`, `faqs.ts` and `locations.ts`. Four were corrected where the wording claimed more than the seed:
  - Mini camps: "most" end in a show, not "each".
  - Performance Troupe: it has two teachers.
  - First-class-free wording on the home page.
  - Yes, And…: "creativity" instead of "teamwork".
- **"First class free" rule.** The plan's list comes from `hasFreeFirstClass` in `src/lib/pricing.ts`.
- **Web research.** I ran 14 searches with a web search tool on Oct 11, 2026:
  - kids theater classes Athens GA
  - summer theater camp Athens GA kids
  - kids birthday party places Athens GA
  - homeschool drama class Athens GA
  - adult improv class Athens GA
  - parents night out Athens GA kids
  - Athens GA summer camps 2026 guide (an extended search)
  - special needs adaptive theater class Athens GA
  - private acting/voice lessons kids Athens GA
  - "Little Characters" theater Athens GA
  - teen acting class Athens GA
  - school holiday break camp Athens GA
  - Athens Little Playhouse
  - The Stage Oconee
  - yelp acting classes Athens GA
  - things to do with kids Athens GA

  I opened no page that needed a sign-in and contacted no one.
- **Skipped:** `npm run check`, `npm test` and the build. This unit changed no code, and its only output is Markdown.

## Decisions

- **Titles are a 40-character field plus the ending.** `Base.astro` adds " · Little Characters" (20 characters) to any title. A field of 40 or fewer keeps the full title within 60. If the Google setup unit changes how titles are assembled, the wording units must recount.
- **The site name is "Little Characters Theater Troupe".** The coordinator's note said "Theater Co."; the repository says "Troupe" (`src/config/site.ts` and the old site's title). The plan uses "Troupe".
- **Split the two summer camp pages.** `/camps` owns "theater camp" in general. `/programs/summer-camp` owns "summer camp 2027". This avoids two pages competing, and needs no code.
- **"Athens, GA" in the title or description of every page.** Search results for "Athens" are crowded with Ohio, Alabama, Florida, Tennessee and Greece.
- **Program targets go in the new search fields.** Programs have no `seo` group yet. The targets are written for the fields the Google setup unit is adding, and the visible program names stay as they are.
- **Winterville is history only.** The old site proves families came to Winterville (2025 classes, camps, shows at the Marigold Auditorium), but nothing runs there now. No Winterville page.
- **No "only" claims.** Athens Creative Theatre runs an adaptive program for teens and adults ("Monologues & More"), so "the only inclusive theater program in Athens" is probably untrue.
- **Volume is an estimate.** There was no volume tool. Volumes are relative judgements from market size, how many competitors there are, and which needs local parent guides cover. Each is marked as an estimate.

## Open points

These are §6 of the plan in short, each with my recommended answer until Hannah replies:

1. **Towns served.** Name only Athens, GA. Winterville appears as past venues only.
2. **Winterville today.** Treat it as history.
3. **Numbers.** Use none. Don't reuse "150+ students in the first year" (from a 2023 article) without her OK.
4. **Awards and press.** Mention none.
5. **"Only" claims.** Make none.
6. **Nonprofit status.** Don't say "tax-deductible".
7. **Ovation.** Keep the evergreen "ask about the next dates" page.
8. **Adult classes seen on ActiveKids.** Leave them off the site until confirmed.
9. **Toddlers.** Say "ages 4 and up".
10. **Parties.** Keep "ask for a date" and add no price.
11. **Private lessons.** Keep "booked by the hour" and add no price.
12. **Parents' Night Out ages.** Say "ages 4–12" (the seed's numbers).
13. **Summer 2027.** Say "dates coming soon" with the email list.
14. **Holiday mini camps.** List past ones only.
15. **Performance Troupe.** Use "for students who have worked in theater before".
16. **Hours.** Leave them out.
17. **Business Profile.** The kit should cover both creating and claiming a profile.
18. **Schools list.** Keep it, as the About page does now.
19. **Acting Studio level.** Say nothing about level.
20. **Emily Greene.** Don't tie her to a class.

## Follow-up candidates

These are in plan §8:

- **F1.** A page per show.
- **F2.** A canonical link or a merge if `/camps` and `/programs/summer-camp` compete after launch.
- **F3.** A brand-first home title, which needs a `Base.astro` change.
- **F4.** Move fixed dates out of program descriptions.
- **F5.** Search fields for events and FAQs (not needed now).

Also:

- The `/camp` → `/camps` redirect is critical, because the old `/camp` page still ranks for summer camp. It's already in `docs/content-inventory.md` and is the Google setup unit's job.
- `/give` still has no real donation link.

No new page is needed for a whole group of searches, so nothing here blocks the next units.

## Handoff

- **Site-pages wording session:**
  - Rules: §0.
  - Search demand: §1.
  - Targets for home, `/programs`, `/camps`, `/events`, `/about`, `/geode`, `/faq`, `/give` and `/contact`: §3.1.
  - Places to use: §4.
  - Facts not to claim: §6.
  - Priorities: §7.

  Titles and descriptions go into each page's `seo` group, and the gaps say what to add to the body text.
- **Classes, camps, events and FAQs wording session:**
  - Rules, especially the "first class free" list: §0.
  - The 17 program targets, in seed order: §3.2.
  - Events and five new FAQ questions answerable from the seed: §3.3.
  - Facts not to claim: §6.
  - Facts that go stale (the homeschool show date, free class dates): §7 item 9 and §8 F4.
- **Google Business Profile kit session:**
  - Rules: §0.
  - Demand by need, which shows which services to list: §1.
  - Competitors and the map-results caveat: §2.
  - The exact address and places served: §4.
  - The listings table: §5.
  - Questions about hours, the existing profile and towns: §6, items 1, 16 and 17.
  - Reviews and directories: §7, items 2, 5 and 6.
- **Everyone:**
  - I couldn't see Google's map results from here.
  - Recount title lengths if the Google setup unit changes the title ending.

## Compaction

No compaction or restart occurred during this unit.
