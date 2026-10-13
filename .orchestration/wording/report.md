# Wording unit: report

## Result

**1. "Semester" → "season"** (families now read "season" on the home, camps, class finder, FAQ, class and workshop pages, at checkout and in their account):

| File | Before → after |
|---|---|
| `src/content/seed/pages.ts` | "pay the semester" → "pay for the season" (home, how-it-works card); "This semester’s classes" → "This season’s classes"; "Pay the semester up front and save 10%" → "Pay for the season up front and save 10%"; "mid-semester showcase" → "mid-season showcase" (3×) |
| `src/content/seed/faqs.ts` | "the full semester" → "the full season"; "drops mid-semester" → "drops mid-season"; "cancelled for the semester" → "cancelled for the season"; "Pay for the semester in full" → "Pay for the season in full"; "mid-semester showcase" → "mid-season showcase"; "1–2 times a semester" → "1–2 times a season" |
| `src/content/seed/programs.ts` | "Mid-semester showcase" → "Mid-season showcase" (2×); "more than once a semester" → "more than once a season" (tagline and description); "1–2 times a semester" → "1–2 times a season" (summary and description) |
| `src/server/family.ts:315` | order note: "pay for the semester" → "pay for the season" |
| `src/pages/enroll/review.astro:37` | plan choice: "Pay the semester in full" → "Pay for the season in full" |
| `src/pages/account/index.astro:59` | order label: "(semester)" → "(full season)" |
| `src/content/seo-draft/faqs.ts`, `src/content/seo-draft/programs.ts` | every `from` that quotes changed seed text, and its `to`, carry the same change; the new "lobby" FAQ draft says "mid-season showcase" |
| `docs/seo/review.md` | regenerated with `npm run seo:review` |

Session term names ("Fall 2026") unchanged.

**2. Camps page:** the fact label "The finale" → "Performances" (`src/content/seed/pages.ts`). Class page untouched.

**3. Logo:** `src/assets/brand/logo-horizontal.webp` re-exported: "THEATER TROUPE" is 1.8× bigger (cap height 46 → 83 px in the source, now about 70% of the wordmark's width instead of 44%), taken from the lockup's own lettering so the typeface, color and spacing match. Same canvas size, so the logo's footprint in the header is unchanged. `src/components/Logo.astro`: on phones the lockup is 170 px wide instead of 150 px. Original kept out of the repo (it's in git history). Footer logo (live text) unchanged.

**4. Event cards** (`src/components/EventTicket.astro`; `/events`, home, Geode): under the time, a line with the place's name, its street address and a "Map" link (when the location has a map link). An event with "Or another venue" shows only that text, as typed.

For Hannah: the seed content changes reach the real database at its first start; nothing to publish. The SEO drafts still wait for her in the editor, now with "season".

## Proof

- `npm run check`: 0 errors, 0 warnings (6 hints, unchanged).
- `npm test`: 9 files, 259 tests passed.
- `npm run build`: complete.
- `tests/e2e/serve.sh` (fresh DB), then `node tests/e2e/enroll-journey.mjs`: all journey checks passed; `node tests/e2e/content-editor.mjs`: all editor checks passed. Ran twice (before and after the phone logo width change), both green.
- Playwright at 1280 and 390 px on `/`, `/events`, `/camps`, `/geode`: `scrollWidth` equals the viewport everywhere (no sideways scroll). Rendered text of `/`, `/camps`, `/classes`, `/events` has no "semester"; `/faq` HTML has "full season" and "mid-season". Every ticket on `/events` shows "Little Characters HQ / 1635 W Broad St, Athens, GA 30606 / Map".
- The free-text venue case was checked by reading the code only: no upcoming seeded event uses "Or another venue" (the botanical garden one is past).
- Screenshots in `shots/`: `logo-desktop.png`, `logo-phone.png`, `events-desktop.jpg`, `events-phone.jpg`, `home-desktop.jpg`, `camps-desktop.jpg`, `camps-phone.jpg`, `geode-phone.jpg`.

### Every "semester" in the repository

- Changed: all lines listed in the Result table above (seed, seo-draft, `family.ts`, `enroll/review.astro`, `account/index.astro`, `docs/seo/review.md` regenerated).
- Left, off-limits for this unit:
  - `src/pages/programs/[slug].astro:133` "pay the semester in full and save 10%" (class page, the class-page session).
  - `src/lib/pricing.ts:165` "…or pay for the semester." (family-facing trial note) and `:10` (code comment) (billing, the discounts session).
- Left, not read by families: `content/scraped/**` (copies of the old site, kept as a record); `docs/content-inventory.md:27` ("Older semesters", the old pages); `docs/seo/log.md:145`, `docs/seo/research.md:34` (research notes); `docs/seo/research.md:203` (an early description idea in the research notes, not a draft); `docs/review-2026-10/log.md:19` (the plan itself). No parent-facing docs or emails used the word.

## Decisions

- **Logo re-exported, not text beside the mark.** Keeps the exact typeface and look of the lockup; the source is 2196 px wide and shown at 170–190 px, so the scaled lettering stays crisp at 1×–3×. Live text would need the lockup's font, which the site doesn't load.
- **Phone lockup 150 → 170 px.** Gives the bigger subtitle a bit more size where it's smallest; the header still has room next to Menu.
- **"(semester)" → "(full season)"** in the account order label: "(season)" alone was unclear next to "(free trial)" and "(first month + fees)".
- **"pay the semester" → "pay for the season"**, Hannah's own wording.
- **Venue on its own line** on the ticket so the address fits on phones.

## Open points

- `src/lib/pricing.ts:165` still tells families "…or pay for the semester." Recommended: the discounts session (or the coordinator at merge) changes it to "…or pay for the season."
- `src/pages/programs/[slug].astro:133` still says "pay the semester in full". Recommended: the class-page session changes it to "pay for the season in full and save 10%".

## Follow-up candidates

- Footer logo's live "Theater Troupe" (0.72rem) could grow to match if Hannah wants.
- `npm ci` reports audit warnings (not looked into).

## Handoff

Branch `claude/review-wording`, ready to merge. Conflicts likely only in `src/content/seed/pages.ts` if another unit edits the same lines.

## Compaction

No compaction or restart occurred.
