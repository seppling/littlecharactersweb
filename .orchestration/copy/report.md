# copy unit: report

## Result

Hannah gets drafts to approve. Nothing on the site changes until she publishes or approves them.

**Class content (the editor's wording): `src/content/seo-draft/programs.ts`.** 29 new or rewritten edits across 12 classes, camps and workshops. They cover taglines, summaries (used on class cards), description paragraphs and the "How it ends" line.
- 22 are new edits.
- 7 replace an existing SEO draft's paragraph. Each keeps its search words (ages, places, "acting class", "filmmaking class", links), and its `why` says it replaces the SEO version.
- Entries touched: Stories and Songs, Intro to Theater, Yes, And… Improv, Produce a Show, Performance Troupe, Film Creation, Summer Camp, Mini Camps & Workshops, Free Community Class, Parents' Night Out, Private Lessons, Geode: Acting Studio.
- `docs/seo/review.md` was regenerated, so the drafts list Hannah reads shows each before → after with its reason.
- **For families:** nothing yet. Once Hannah publishes, the class pages and cards read warmer, and every price, date, age and claim stays the same.
- **For Hannah:** each class above shows "Unpublished changes" in the editor once the drafts are loaded. She publishes, edits or discards each one.

**Fixed wording (the code): `docs/review-2026-10/copy-drafts.md` + `copy-drafts.json`.** 26 numbered lines, C1–C26, in the order a family meets them:
- Class page: C1–C9
- Step 1, sign in and who's coming: C10–C18
- Step 2, details: C19
- Step 3, review & pay: C20–C21
- Step 4, confirmation page: C22–C23
- Confirmation email: C24–C26

Each line gives its place, `file:line`, the words today, the proposal and a reason; 7 lines also have a bolder option. The JSON follows the agreed shape (`alt` only where there is one). No code was changed.

## Proof

- `npm run check`: 0 errors, 0 warnings (7 hints, as before).
- `npm test`: 11 files, 306 tests passed. This includes `seo-drafts.test.ts`: every `from` matches the seed, and review.md is current.
- `npm run build`: complete.
- `npm run seo:load-drafts` (dry run). It ran with Stripe keys blanked, `DATABASE_URL` empty, `APP_ENV=development` and a fresh `PGLITE_DIR=.data/copy-check`, which was deleted afterwards. Result: "Ready to load (53)", with all 17 program drafts among them and nothing skipped or refused.
- I checked the "Performance"/"Performances" label in the class summary with a one-off script that runs `performanceLabel()` on each showcase line before and after. All 5 edited showcase lines keep their label.
- **No screenshots:** no page changes until Hannah publishes or the approved lines are applied, so `.orchestration/copy/shots/` is empty.
- **No browser tests:** the brief says none are needed, since no code changed.
- CI runs on these pushes; I did not check its result.

## Decisions

- **Fields edited:** tagline, summary, description and showcase only. Highlights are short skill labels. Prices, dates, "Good to know" (prerequisite) and SEO titles and descriptions stay as they are, for clarity and to keep the SEO work as it is.
- **Showcase edits keep the words the label logic reads,** so the summary's "Performance(s)" heading can't change by accident (checked).
- **Skipped on purpose:**
  - LC Homeschool Class: its text names October 30 and September 11, which Hannah needs to update first.
  - Athens Academy Enrichment: a partner's program, so it keeps the formal tone.
  - Ovation: the audience is sensitive, and the text is already warm.
  - Parties, Adult Improv Night and the Parents' Night Out tagline: already playful, or written for adults.
- **Theater phrases:** at most one per block. They appear in "raises the curtain", "curtain call", "Lights, camera, action!", "bows and all", "Places, everyone" (only as a bolder option, in a heading) and "first rehearsal" (only as a bolder option).
- **Untouched:** buttons other than C3, prices, money words, policies, the payment page and error messages. The one exception is C18, "to continue", which is plain.
- **C3 button ("Sign up for this time"):** it is set in two places in the class page (lines 174 and 304), and the line says both must change together.
- **No new facts:** every phrase rests on the seed or the home page. "See if it clicks" and "first to hear" are taken from the home page. "No password needed" is taken from the default sign-in text.

## Open points

1. **C1 says "unless your child wants to stay"** where today's text says "until you decide to stay". Recommended: accept it, since it is the home page's own promise. Take the bolder option if Hannah prefers to keep "you decide".
2. **C26 adds a sign-off to the email ("See you soon! The Little Characters team").** Recommended: yes. Hannah may prefer to sign it herself.
3. **The first draft commit's message is wrong.** c627c32 says "30 edits across 13"; the real count is 29 edits across 12 entries. I left it as is rather than rewrite pushed history. This report has the right numbers.

## Follow-up candidates

- Homeschool class: refresh its dated text after October 30. A playful pass can follow then.
- C3, C2 and the mobile bar's "Choose a time" button should be applied together with the class-dates unit's changes, since they touch the same card.
- The hard-coded parking line in the confirmation email (`family.ts:363`) repeats `site.parking` from the editor. It could read from the editor instead, so the page and the email can't drift apart.

## Five favourites (before → after) for Stephen

1. **Mini Camps tagline:** "Theater on school holidays and weekends." → "School's out? Theater's in! Mini camps and workshops on school holidays and weekends."
2. **Film Creation tagline:** "Learn how a film comes to life, from storyboard to screen." → "Lights, camera, action! Learn how a film comes to life, from storyboard to screen."
3. **Class page, C8:** "Questions? Ask us before you sign up." → "Not sure it's the right fit? Ask us, and we'll help you pick."
4. **Yes, And… Improv tagline:** "Accept an idea and build on it. On stage and off." → "Say "yes", add an idea, and see where the scene goes. On stage and off."
5. **Free-class choice at checkout, C21:** "Nothing due today. Decide after the class." → "Nothing due today. See if it clicks, then decide."

## Handoff

- Branch `claude/review-copy`: 4 commits on top of 7f607ac. Files changed:
  - `src/content/seo-draft/programs.ts`
  - `docs/seo/review.md`
  - `docs/review-2026-10/copy-drafts.md`
  - `docs/review-2026-10/copy-drafts.json`
  - `.orchestration/copy/*`
- Merging is safe: no code and no seed changed.
- **Watch at merge:** if another unit changes seed text that these drafts quote, `npm test` names the field. Update that `from`, then rerun `npm run seo:review`.
- The JSON is ready for the approval page.

## Compaction

No compaction or restart happened during this session.
