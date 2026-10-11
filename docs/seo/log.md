# SEO draft: plan and log

The record of the SEO and local-discoverability draft for littlecharacters.org. Each piece of work is done by a separate Claude session on its own branch, and is merged into `claude/seo-draft` once it's checked.

## What was asked

Optimize the existing site content for search and for discoverability in Athens, GA, without overwriting the current wording. The draft stays separate.

## Decisions (October 11, 2026)

- **The draft stays separate in two ways.** All the work is on the `claude/seo-draft` branch, outside the content-editor pull request. New wording goes into the content editor as unpublished drafts, so Hannah previews each page and publishes only what she likes. Today's wording stays live until she does.
- **Two parts, with a stop after each.** Part 1 builds the research and the groundwork. Part 2 writes the wording.
- **In scope:** search research, the behind-the-scenes Google setup, wording drafts, and a Google Business Profile kit (added later the same day).
- **Small wording and technical choices** are settled during the work and noted here. Any claim (such as "Athens' only…", the towns served, prices or awards) goes to Stephen and Hannah.
- **At most three sessions run at once.**

## Plan

| # | Unit | Part | Needs | Branch |
|---|---|---|---|---|
| 1 | Search research: what Athens parents search for, who ranks, a page-by-page target list | 1 | — | `claude/seo-research` |
| 2 | Google setup: search fields for class pages, share previews, event and business details for Google, redirects from old addresses (no wording changes) | 1 | — | `claude/seo-google-setup` |
| 3 | Draft loader: puts new wording into the editor as unpublished drafts, never over newer edits | 1 | — | `claude/seo-loader` |
| 4 | Wording drafts for the site pages | 2 | 1, 2, 3 | `claude/seo-copy-pages` |
| 5 | Wording drafts for classes, camps, events and FAQs | 2 | 1, 2, 3 | `claude/seo-copy-classes` |
| 6 | Google Business Profile kit: profile description, categories, services, listings to claim, review-request message | 2 | 1 | `claude/seo-business-profile` |

## Log

Each merged unit gets an entry here: what changed, the proof, the decisions, follow-up work and notes for later units.

### 1. Search research (merged October 11)

**What changed.** `docs/seo/research.md`, the search plan that all the wording follows. It has eight parts:
- ground rules;
- search demand in 12 groups;
- who ranks today;
- targets for all 9 site pages and all 17 class and camp pages;
- local signals;
- listings worth having;
- 20 questions for Hannah;
- the ten changes that matter most.

**Proof.**
- Every title and description was counted by the helper and recounted at merge: 26 titles of 40 characters or fewer (60 with " · Little Characters"), and 26 descriptions of 155 or fewer.
- All 17 class pages are covered.
- Spot checks against the seed matched: class sizes, the 5,000 sq ft space, and fall term dates.
- 16 web searches were run on October 11. The map results (Google Business Profile) can't be seen from here.

**Decisions.**
- **Site name:** the plan uses the site's real name, "Little Characters Theater Troupe" (the coordinator's brief said "Theater Co." by mistake).
- **Place:** "Athens, GA" goes in every page's title or description, because "Athens" alone brings up results for Ohio, Alabama, Florida, Tennessee and Greece.
- **Camps:** `/camps` targets theater camps in general, and `/programs/summer-camp` targets Summer 2027.
- **Claims:** none. Athens Creative Theatre runs an adaptive program, so "the only inclusive program" would likely be untrue.

**For Stephen and Hannah.** The 20 questions in §6 of the plan. Until Hannah answers, the wording uses the plan's cautious defaults.

**Follow-up.** The candidates are in §8 of the plan:
- a page for each show;
- watch whether `/camps` and `/programs/summer-camp` compete;
- move fixed dates out of class descriptions;
- `/give` still needs its real donation link.

**Notes for later units.**
- Titles are written for the " · Little Characters" ending: recount them if the Google setup changes how titles are built.
- The `/camp` → `/camps` redirect is critical, because the old `/camp` page still ranks for summer camp.

**Cost.** $2.87.

### Answers from Stephen and Hannah (October 11)

Questions 1–10 of the research plan are answered. The answers, and how the writers apply them, are recorded under §6 of `docs/seo/research.md`:
- **Towns:** lead with "the Greater Athens area" and weave in Watkinsville, Winterville, Bogart and Statham.
- **Winterville:** the Fall 2026 Variety Show is at the Marigold Auditorium in Winterville.
- **Numbers:** none yet.
- **Press:** link the coverage that can be found.
- **Claims:** no "only" claims.
- **Nonprofit:** not a nonprofit, so never "nonprofit" or "tax-deductible".
- **Ovation:** continues, with details to come.
- **Adult classes:** none beyond improv night.
- **Ages:** 4 and up.
- **Parties:** details to come.

Questions 11–20 use the plan's defaults until they're answered.

More answers (October 11):
- **Questions 10–15:** still to be set, so the defaults apply.
- **Business Profile:** one exists ("Little Characters Theater Troupe"), so the kit improves it rather than creating one.
- **Schools:** Timothy Elementary and Barrow Elementary join the four already listed.
- **Geode Acting Studio:** welcomes beginners.
- **Questions 16 (hours) and 20 (Emily Greene):** unanswered, so the defaults apply.
