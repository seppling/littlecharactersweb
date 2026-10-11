# google-setup: report

Branch `claude/seo-google-setup`, from `claude/seo-draft`. The main commit is `657cbfe`. No compaction or restart happened in this session.

## Result

**For visitors:** nothing they read on the pages changed. Two titles changed: "About Little Characters" no longer gets " · Little Characters" added a second time. Old Squarespace addresses now land on the right page instead of the 404 page. A shared link now shows the page's photo.

**For Google and link previews:** every page now has `og:image` (1200×630 JPEG, with width, height and alt), `twitter:card` `summary_large_image`, `og:site_name` and `og:locale`. Class pages get breadcrumb and Course markup, `/programs` gets a course list, and the company's own block is corrected and filled out.

By file:

| File | Change |
|---|---|
| `src/content/pages.ts` | The `seo` field is exported, and its help text explains the title rule. It now builds its color and character options from `catalog.ts` instead of `collections.ts`, which avoids an import loop now that `collections.ts` imports `seo`. |
| `src/content/collections.ts` | Programs get the `seo` field, last in the form. |
| `src/content/types.ts` | `Program.seo?: Seo`. |
| `src/lib/seo.ts` (new) | `pageTitle` (the title rule) and `jsonLd` (escapes `<`, U+2028 and U+2029). `athensDateTime` converts local editor times to ISO 8601 with the Athens offset for that day. Also `postalAddress`, `organizationLd`, `eventLd`, `offerPrice`, `courseLd`, `courseListLd`, `breadcrumbLd`, and `isCourse`/`COURSE_KINDS`. |
| `src/layouts/Base.astro` | Uses `pageTitle` and the new link-preview tags. New props: `image` (the page's main photo) and `structuredData` (extra JSON-LD blocks). The organization block now comes from `organizationLd`. |
| `src/lib/media.ts` | Share images: `focusPoint` (reads CSS object-position), `shareStop`, `shareImage` and the URL helpers. |
| `src/server/share-image.ts` (new) | `makeShareImage`: scales the photo to cover the preview, crops it to 1200×630 and saves it as a progressive JPEG. |
| `src/pages/media/share/builtin/[folder]/[name]/[stop].jpg.ts` (new) | Share images of the built-in photos (`photos/`, `team/`), made at build time. |
| `src/pages/media/share/[id]/[stop].jpg.ts` (new) | Share images of uploads, made on request from the largest stored copy, with `Cache-Control: public, max-age=31536000, immutable`. |
| `src/server/media.ts` | `getLargestMediaFile(id)`. |
| `src/lib/redirects.ts` (new), `src/middleware.ts` | 301 redirects for old addresses, handled first in the middleware. |
| `src/pages/programs/[slug].astro` | Passes `seo`, `image` and structured data (BreadcrumbList, plus Course for course kinds) to `Base`. |
| `src/pages/programs/index.astro` | `ItemList` of the course pages (only when there are at least 3). |
| `src/pages/index.astro`, `about.astro`, `camps.astro` | Pass `image={page.hero.photo}`. |
| `docs/content-editor.md` | One paragraph, "What Google shows": the title rule and which photo a shared link shows. |
| `tests/unit/seo.test.ts` (new) | 20 tests: titles, Athens offsets (including the days the clocks change), escaping, addresses, the organization block, events (one or several times, no end, no date, no address, another venue, unreadable prices), courses, breadcrumbs, focus points, crop stops, share-image lookup, JPEG output for any photo shape, and redirects (including the `.ics` exception). |
| `tests/e2e/content-editor.mjs` | After the upload step, checks that `/media/share/<id>/50.jpg` is a 1200×630 JPEG cached as immutable. |

## Proof

- `npm run check`: 0 errors, 0 warnings.
- `npm test`: 7 files, 177 tests passed (20 of them new).
- `npm run build`: passed. Memory peak with `MALLOC_ARENA_MAX=2 /usr/bin/time -v npm run build`:
  - **Before:** 708 MB maximum resident, 15 s, `dist/client` 13 MB.
  - **After:** 676 MB maximum resident, 35 s, `dist/client` 39 MB. That adds 286 share JPEGs, about 26 MB.
  - The peak didn't rise (the runs were 685, 693 and 676 MB across three attempts). The cost is time and disk.
  - An earlier attempt with mozjpeg took 50 s, so I dropped it.
- `npm run db:prepare-preview` (the memory check in CI): peak 380 MB, under the 450 MB limit.
- `tests/e2e/serve.sh`, then `node tests/e2e/enroll-journey.mjs` ("All journey checks passed.") and `node tests/e2e/content-editor.mjs` ("All editor checks passed.", including the new share-image check). Note: on a fresh container, `serve.sh` fails until `.data/` exists (`mkdir -p .data`). That happened before this change too.
- From the local server, a script parsed every JSON-LD block of `/`, `/events`, `/programs`, `/programs/yes-and-improv`, `/programs/stories-and-songs`, `/programs/summer-camp`, `/about`, `/camps`, `/geode`, `/faq` and `/contact`. It checked the required fields (organization: name, url, logo, address, location; Course: name, description, provider; breadcrumb positions and links) and found no Event blocks. It also fetched each page's `og:image`: every one returned 200 `image/jpeg` at 1200×630. Result: "all checks passed". Breadcrumb example: Find a class (/programs) › Weekly classes (/programs?kind=class) › Yes, And… Improv. The `/programs` list has 13 courses.
- Redirects, from the local server: `/home`→`/`, `/classes-1`, `/classes`, `/classes1`→`/programs`, `/camp`→`/camps`, `/team`→`/about#team`, `/faqs`→`/faq`, `/giving-page`→`/give`. `/events/parents-night-out`, `/events/8uepmlluu1px9twdv3vksheyuwj1t6-kxpf3` and `/events/lc-variety-show/` all go to `/events`. Every one returned 301. `/events/parents-night-out-nov.ics` returned 200 `text/calendar`.
- I looked at three crops (trust game, rehearsal circle, cast photo). Faces are in frame.
- CI: see "CI" at the end of this file.

## Decisions

1. **No Event markup on `/events`.** Google's Event documentation (updated Sep 8, 2026) says: "Each event MUST have a unique URL (a leaf page) and markup on that URL" and "The event experience on Google only supports pages that focus on a single event." `/events` is a list, so marking it up would earn nothing and breaks a stated rule. The coordinator asked for care. The full `eventLd()` builder is still written and unit-tested to Google's spec: an Event per performance, Athens offset, Place with a street address, organizer, offline attendance, `EventScheduled`, offers when the price is plain. It plugs into a single-event page with one line. See Open point 1.
2. **Course markup only for `class`, `inclusive`, `lesson` and `workshop`** (the free class). Camps and parties are not courses in Google's sense ("an explicit educational outcome", "a general public event … is not a course"). Course markup includes name, description (the summary), url and provider. The Course list documentation (updated Sep 8, 2026) still supports it, with at least 3 courses and an `ItemList` on the summary page (`/programs`). "Course info" is no longer in Google's search gallery, so I added no `hasCourseInstance`, prices or schedules. Weekly classes are never marked as events.
3. **No FAQPage.** Google's FAQ documentation says the feature stopped appearing in Search on May 7, 2026, and the page was removed on Jun 15, 2026.
4. **The company's type changes from `PerformingArtsTheater` to `['TheaterGroup', 'EducationalOrganization']`.** `PerformingArtsTheater` is a building (a Place), so the `email`, `founder` and `foundingDate` it carried weren't valid for it. `TheaterGroup` ("a theater group or company") fits "Theater Troupe", and the second type fits the classes. Google's Organization documentation accepts Organization subtypes.
   - Added: `@id`, `logo` (`/apple-touch-icon.png`, 180×180 PNG; Google wants at least 112×112), `image` (the default share photo), and `location` (every location as a Place with its address).
   - Still no coordinates, hours, price range or areas served. The hard-coded address fallback is gone: the address now comes only from the HQ location.
   - The block stays on every page, as before.
5. **Share images:** a 1200×630 crop centered on the focus point (as far as the photo allows), rounded to 10% steps along the side that gets cropped.
   - All built-in photos are narrower than 1200:630, so only the up-down position matters for them.
   - Steps let the built-in photos be made at build time; with 25% steps, the trust-game crop cut off heads.
   - Centering rather than CSS object-position, because the editor asks Hannah to click the face.
   - The logo (`brand/`) gets no share image.
   - Pages without a usable photo use the home page's hero photo, then the built-in cast photo. Without any photo, `twitter:card` falls back to `summary`.
6. **Share image URLs use `https://www.littlecharacters.org`** (`Astro.site`), like the canonical link, so previews made on Render point to production. They work from launch on.
7. **Redirects go in the middleware** (one tested function), not in Astro's `redirects` config, so they can be unit-tested and the `.ics` exception is plain to see. Matching ignores letter case and trailing slashes. The redirect is cached for a day.
8. **`/home` and `/classes1` were added** as clear equivalents (`/home` was the old home page; `/classes1` is a class listing like `/classes`).
9. **No `lastmod` in the sitemap.** Each page is built from several entries (a class page also shows FAQs and locations), so one "last published" date wouldn't be true. Getting dates would also need `src/server/content.ts`, which another session owns.

## Open points

1. **Give each event its own page** (e.g. `/events/<slug>`) so Google can show event results. *Recommended: yes, in a later unit.*
   - The page would show the existing ticket (`EventTicket`) and use `eventLd()` with the event's place and price, plus `seo` fields if wanted.
   - The `/events/*` redirect would then have to let current event slugs through. Old Squarespace slugs (e.g. `parents-night-out`) differ from the current ones (`parents-night-out-nov`), but a new event could reuse an old name, so check slugs against the content first.
   - Events also have no photo field. Google recommends an image, so the event pages should get one; that is a change to the editor.
2. **Old addresses with no clear new page.** *Recommended:*
   - `/spring2024`, `/athens2024`, `/winterville2024` (old semesters' class pages): → `/programs`. Ask Hannah whether she wants that or a 404.
   - `/services` (unused Squarespace template) and `/store` (empty): leave them as 404.
   - `/s/Hannah-Eppling-Experience-and-Teaching-Philosophy-1.pdf`: question for Hannah. Is it still wanted? If so, add it to `public/` and keep the address.
3. **The parking guide link will break at launch.** The site settings point to `https://www.littlecharacters.org/s/Little-Characters-Parking-Instructions.pdf`, a Squarespace file on the domain the new site takes over. *Recommended:* put the PDF in `public/` at the same path, or upload it elsewhere and update the setting. The seed is owned by others, so I didn't change it.
4. **Geode's preview shows the default (children's) photo**, because the Geode page has no top photo. *Recommended:* give the Geode page a top photo field, or pass one of its past-event photos as its preview photo (a one-line change in `src/pages/geode.astro`).
5. **Address details for Hannah:** the organization's `telephone` is the site setting as typed (with no +1). Google is fine with that. Nothing to do unless she wants the international form.

## Follow-up candidates

- Event pages (Open point 1).
- Check the live site after launch with the Rich Results Test and the URL Inspection tool in Search Console, and submit `/sitemap.xml`.
- If the build time (+20 s) or the share images on disk (~26 MB) matter on the host, make the built-in share images on request too. That needs the source photos available at run time.

## Handoff

- **Field names** (all optional):
  - Pages: `seo.title` and `seo.description` (home, about, camps, geode, give, contact, faq, classes, events).
  - Programs (classes, camps, parties): `seo.title` and `seo.description`. Each is a `seo` group on the program, edited under **Search engines** at the bottom of the class form.
  - Limits: title up to 70 characters, description up to 300.
  - Events have no `seo` field.
- **Title rule** (`pageTitle` in `src/lib/seo.ts`): the shown title is `seo.title`, or else the page's built-in title (a class's name). " · Little Characters" is added at the end unless the title already contains "Little Characters" (any letter case). With no title at all (the home page without `seo.title`), it's "Little Characters Theater Troupe · Athens, GA". So a search title of up to about 50 characters leaves room for the ending; one that names Little Characters itself gets no ending. Descriptions: `seo.description`, or else the page's built-in description (a class's summary), or else the site description.
- **Preview photo per page:**
  - Home: `home.hero.photo`.
  - About: `about.hero.photo`.
  - Camps: `camps.hero.photo`.
  - Each class page: the program's `image`.
  - Every other page (`/programs`, `/events`, `/geode`, `/faq`, `/give`, `/contact`, 404): the home page's hero photo, or the built-in cast photo if that's empty.
  - The alt text is the photo's description, so good alt text also helps previews.
- **Structured data:** class summaries become the Course description, so the wording sessions should keep summaries factual. Google shows about 60 characters.
- **Taking it back:** `git revert 657cbfe` undoes everything. Or, by part:
  - Remove `seo` from the programs field list (saved values are then ignored).
  - Drop the `structuredData` props.
  - Remove the redirect lines in `src/middleware.ts`.
  - Delete `src/pages/media/share/` and the `og:image` block in `Base.astro`.

## CI

See `state.md` for the run result.
