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

### 3. Draft loader (merged October 11)

**What changed.**
- The format for wording drafts is in `src/content/seo-draft/`. Each change names the field, the exact text it replaces, the new text and the reason.
- `npm run seo:load-drafts` saves the drafts in the content editor as unpublished drafts, through the editor's own save and its checks. Without `--commit` it only shows what it would do.
- `npm run seo:review` writes `docs/seo/review.md`, the before-and-after page for Hannah and Stephen.
- The Render preview loads the drafts, so they can be reviewed in the preview's editor.
- The guide is `docs/seo/drafts.md`.

**Proof.** 14 new tests prove the safety rules against a real (in-memory) database:
- nothing is ever published;
- a page with Hannah's unpublished changes is left alone;
- a field that changed since the draft was written is skipped, with the field named;
- running it twice changes nothing;
- each draft file is checked against the starting content and the editor's rules.

The helper also ran it for real: the public page kept its wording, and the editor showed "Unpublished changes" with the draft in Preview. The preview database step peaks at 357–369 MB, under its 450 MB limit. CI passed.

**Decisions.**
- **Who saved a draft:** it's recorded as "seo-drafts", which isn't an account. When Hannah publishes, the history records her.
- **Partial drafts:** if any change to a page no longer fits, that page's whole draft is skipped.
- **When to run it:** once on the real database at launch, and remove rejected drafts from the files afterwards. A discarded draft would come back on a second run.
- **Accepted risk:** if Hannah saved a draft in the same instant the loader runs, the loader's save would replace hers. Running the loader when nobody is editing avoids it.

**Follow-up.** Show "saved by seo-drafts" in the editor's status box.

**Cost.** $3.20.

### 2. Google setup (merged October 11)

**What changed** (no wording on the pages changed):
- **Search fields:** class pages have a "Search engines" field (title and description), like the site pages.
- **Titles:** a search title that already contains "Little Characters" no longer gets the ending added a second time.
- **Link previews:** every page shows a photo when shared, as a 1200×630 JPEG cropped around the photo's focus point.
- **Structured data:** class pages carry breadcrumb and course details, `/programs` carries a course list, and the organization block is corrected (`TheaterGroup` and `EducationalOrganization`, with logo, image and locations).
- **Redirects:** old Squarespace addresses send 301 redirects to their new pages: `/home`, `/classes-1`, `/classes`, `/classes1`, `/camp`, `/team`, `/faqs`, `/giving-page`, and old `/events/...` pages. Calendar files (`.ics`) are left alone.

**Proof.**
- 20 new tests.
- The helper's build memory peak didn't rise (708 MB before, 676–693 MB after). The cost is about 20 s more build time and 26 MB of preview images.
- The JSON-LD of 11 pages was parsed and checked, and every page's preview image is a 1200×630 JPEG.
- CI passed.
- At merge, on the combined branch: type check clean, 191 unit tests pass, the build passes, and both browser tests pass. `/camp` and `/classes-1` return 301, and `.ics` files return 200.

**Decisions.**
- **No event markup on `/events`.** Google now requires one page per event for event results.
- **No FAQ markup.** Google stopped showing it in May 2026.
- **Course markup** only for classes, lessons, the free class and Ovation, not for camps or parties.
- **Redirects** run in the middleware, so they can be tested.

**For Stephen and Hannah.**
- **The parking guide link will break at launch.** The site settings point to a PDF on the Squarespace site. Copy the PDF onto the new site at the same address before the domain moves. *A launch-checklist item.*
- **Old semester pages** (`/spring2024`, `/athens2024`, `/winterville2024`): redirect them to `/programs` (decided: better for families than a "page not found").
- **The teaching-philosophy PDF** (`/s/Hannah-Eppling-Experience-and-Teaching-Philosophy-1.pdf`): ask Hannah whether to keep it.

**Follow-up.**
- A page for each event, so shows can appear in Google's event results. The research plan also suggests it.
- A preview photo for Geode, which shows the default children's photo today.
- Save the preview images of uploaded photos instead of making them on each request.
- After launch, run Google's Rich Results Test and submit the sitemap in Search Console.

**Notes for the wording units.**
- **Field names:** `seo.title` and `seo.description` on pages and programs. Events have none.
- **Class summaries become the course description Google reads,** so keep them factual.
- **Preview photos:** each class page uses its photo. Home, About and Camps use their top photo. Every other page uses the home photo.

**Cost.** $5.82.

### 6. Google Business Profile kit (merged October 11)

**What changed.** `docs/seo/business-profile.md`, a step-by-step kit for Hannah, in eleven parts:
- a five-minute checklist on the existing profile;
- the exact name, address, phone, website and email for every listing;
- categories;
- a 622-character description, with a 110-character short version;
- 14 services;
- the service area;
- links tagged so profile visits can be counted;
- photos and a post calendar through spring 2027;
- the review kit;
- 12 other listings, Macaroni KID first;
- questions for Hannah.

**Proof.**
- The description was counted (622 of 750).
- Facts were taken from the site settings and seed. I checked the name, address, phone and email at merge.
- Links were checked with a script. Flagpole and GigSalad block scripts and weren't checked.
- Google's help pages were read on October 11.

**Decisions.**
- **Primary category:** "Drama school". The additional categories are Children's theater, Theater company, Performing arts group, Summer camp and Children's party service. Google publishes no category list, so Hannah confirms each one in the picker. Two of them appeared in only one list.
- **Service area:** add one (Athens, Watkinsville, Winterville, Bogart, Statham), keeping the storefront address visible.
- **Left out:** Q&A, messaging and Offers, which couldn't be confirmed as current features.
- **Macaroni KID:** email them in early December 2026 for the 2027 summer camp guide.
- **Fixed at merge:** the review rule "don't ask people to review in your lobby" now says what Google's policy actually forbids: a review station or device at the space. A printed QR code that families scan on their own phones stays allowed.

**For Stephen and Hannah.**
- Hours.
- Whether the sign says "Little Characters" or the full name.
- Whether to add "Children's party service" once party details are set.
- Which holiday mini camps will run.

**Cost.** $1.03.
