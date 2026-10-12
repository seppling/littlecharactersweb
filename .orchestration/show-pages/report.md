# show-pages: report

Unit: a page for each show, and event cards that link to where to learn more. Branch `claude/seo-show-pages`, from `claude/seo-draft` (c7d1587).

## Result

**For families:** each show has its own page they can share, for example `/events/fall-variety-show`. On the events list, the home page and the Geode page, a show's name links to its page. The names of Parents' Night Out, the free class and improv night link to their class pages. Every card keeps its button: the registration forms for Parents' Night Out and improv night are unchanged.

**For Google:** each show page has its own title, description, share image and breadcrumb. It also has Event markup for each performance still to come, so the show can appear in Google's event results. The sitemap lists the shows that are still to come.

By file:
- `src/pages/events/[slug].astro` (new): the show page. It shows:
  - the date and times, or "Date coming soon (expected <month>)";
  - the place, with its address and a map link;
  - the cost and ages;
  - the button and "Add to calendar";
  - the description, and the photo if there is one;
  - a breadcrumb and a link back to `/events`.

  After the show, the page stays with the note "This show has already happened. See what's coming up", and drops the button, the calendar link and the Event markup. Non-show slugs get the 404 page, but the middleware redirects them before they get there.
- `src/lib/events.ts` (new):
  - `hasShowPage`: shows only;
  - `eventPath`;
  - `eventLink`: the card title's link;
  - `isPastShow` and `upcomingTimes`;
  - `showPageLd`: the breadcrumb, plus `eventLd()` for the performances still to come.
- `src/lib/redirects.ts`: only the `/events/` rule changed. `oldSiteRedirect(path, hasShowPage?)`:
  - a show's address is served;
  - the same address with a trailing slash or capitals → its one address;
  - anything else under `/events/` → `/events` (301), as before;
  - `.ics` is untouched.

  Without the second argument the behavior is the same as before.
- `src/middleware.ts`: `/events/...` addresses are checked after the content loads (the check needs the list of shows, and it follows staff preview). Every other old address is redirected as early as before. A shared `permanentRedirect` helper keeps the same 301 and cache header.
- `src/content/types.ts` and `src/content/collections.ts`: events get three optional fields:
  - `programSlug`, labeled "Class page": a reference to a class, picked from a list;
  - `image`, labeled "Photo": the same image field as classes;
  - `seo`, imported from `pages.ts`, whose definition is unchanged.

  The editor's "view on site" link for a show now opens its page.
- `src/components/EventTicket.astro`: the title links to the show page, or to the class page when that class exists.
- `src/content/seed/events.ts`: `programSlug` is set in `pno`, `improvNight` and `freeClass`. No wording changed.
- `src/pages/sitemap.xml.ts`: adds the pages of shows still to come.
- `src/pages/events/[slug].ics.ts`: the link in the calendar file's description goes to the show's page. Other events keep `/events#slug`.
- `docs/content-editor.md`: two short paragraphs, "A new show" and "Nights that repeat". "What Google shows" now mentions shows.
- `tests/unit/show-pages.test.ts` (new): 16 tests.
- `docs/screenshots/show-pages/*.jpg`: the Variety Show, a past show and a show with a photo, each at desktop and 390 px; the `/events` list.

## Proof

- `npm test`: 9 files and 258 tests pass, including the new `show-pages.test.ts`, which covers:
  - **redirects:** a show is served; a trailing slash or capitals go to its one address; `/events/lc-variety-show/`, an unknown slug, a recurring night and a deeper path go to `/events`; `.ics`, `/events` and `/events/` are untouched;
  - **Event markup:** an upcoming show gets a breadcrumb plus one Event per performance; finished performances are dropped; a past show gets the breadcrumb only; an undated show gets the breadcrumb only;
  - **which events get a page:** only the two seed shows, including the past one;
  - **card links:** a show links to its page; Parents' Night Out links to its class page; a missing or unset class gives no link; every seed recurring night points at a real class and keeps its button;
  - **editor fields:** every seed event and a show with a photo and search fields pass the editor's checks.

  The seo-draft tests (the wording drafts still apply) also pass.
- `npm run check`: 0 errors, 0 warnings.
- `npm run build`: complete.
- `tests/e2e/serve.sh` on a fresh database, then `node tests/e2e/enroll-journey.mjs` ("All journey checks passed."), then `node tests/e2e/content-editor.mjs` ("All editor checks passed."). Both ran on the final build.
- `curl` against the local server:
  - `/events/fall-variety-show` → 200;
  - `/events/fall-variety-show/` → 301 to `/events/fall-variety-show`;
  - `/events/lc-variety-show/` → 301 to `/events`;
  - `/events/parents-night-out-nov` → 301 to `/events`;
  - `/events/parents-night-out-nov.ics` → 200, `text/calendar`, a valid VCALENDAR;
  - `/camp` → 301 to `/camps`;
  - `/events/fall-variety-show.ics` → 404, as before: the show has no date, so no calendar file and no calendar link.
- **Variety Show page:**
  - title "Fall 2026 Variety Show · Little Characters";
  - description from the event;
  - canonical `/events/fall-variety-show`;
  - og:image is the default share image;
  - BreadcrumbList JSON-LD (Shows & events → Fall 2026 Variety Show);
  - no Event, correctly, because it has no date yet.
- **A dated show at HQ:** as Hannah, in the local editor, I gave the e2e test's "Spring Showcase" a location (HQ), a photo, a search title and the price "Free", then published it. Its page has:
  - title "Spring Showcase in Athens, GA · Little Characters";
  - og:image of the event's photo (`/media/share/builtin/photos/cast-silly-faces/50.jpg`);
  - an Event with `startDate` `2027-04-24T14:00:00-04:00`, the HQ PostalAddress, the image, and an Offer with price 0;
  - all from the existing `eventLd()`.

  The editor lists 18 choices for "Class page" (none, plus 17 classes).
- **Card links** on the local server:
  - `/events`: shows go to `/events/<slug>`; Free class → `/programs/free-community-class`, improv → `/programs/geode-adult-improv`, Parents' Night Out → `/programs/parents-night-out`;
  - the home page and `/geode`: the same.
- **Screenshots** at 1280 px and 390 px: no horizontal scroll on any page.
- **CI** on `fff6202`: see the end of this report.

## Decisions

- **Pages only for kind `show`, past shows included.** That is what the brief says: links people shared keep working. Recurring nights link to their class page.
- **The redirect check runs in the middleware, after the content loads, and only for `/events/...`.** Which slugs are shows lives in the database. Checking after the load means a show Hannah is previewing works for her, and everything else redirects as early as before. `oldSiteRedirect` stays a pure function with an optional predicate, so it stays unit-testable and old callers behave the same.
- **A show's address written another way** (trailing slash, capitals) gets a 301 to the one canonical address, so Google sees one page.
- **A past show's page drops its button and "Add to calendar".** A ticket link for a finished show is misleading. The description and the place stay.
- **No Event markup when the show uses "Or another venue".** That is unchanged `eventLd()` behavior: a venue is a name without the street address Google needs. The editor guide tells Hannah to pick a place under **Where**.
- **The card link needs the class to exist.** If the class is deleted or unpublished, the title is plain text instead of a broken link. Deleting a class that an event points at is already blocked by the editor's "used by" check, because it is a `ref` field.
- **The show page reuses the class page's look** (light band, facts grid), not the dark ticket. It uses one column when there's no photo.
- **The calendar file's link** now goes to the show page for shows. It is a one-line change that makes the file more useful, and other events keep the old link.

## Open points

1. **The Variety Show won't get Event markup with today's wording draft.** The draft puts the Marigold Auditorium in the free-text "Or another venue" field. *Recommended:* once the date is set, add "Marigold Auditorium for Arts and Culture" as a **Location** with its address and map link, and choose it under **Where** instead of the venue text. That is a content step for Hannah (the address is already in the draft). A follow-up wording-draft change could do it instead, but the loader edits fields, not new locations, so the Location itself is a manual step. *Question for Hannah:* the map link for the Marigold Auditorium.
2. **The home page lists past events.** It filters by "has a date", not by "still to come", so "Jack and the Beanstalk" (Sep 27) shows there today. This was already the case before my change and is outside this unit. *Recommended:* use `isUpcoming` there, as `/events` does.
3. **Old addresses of recurring nights** (`/events/parents-night-out-...`) go to `/events`. *Recommended:* keep that. Sending them to the class page would be slightly better, but the old Squarespace slugs don't match the new ones anyway.

## Follow-up candidates

- The fix for the home page's past events (open point 2).
- A Location for the Marigold Auditorium (open point 1).
- Show photos: none of the shows has a photo yet, so they share the default image. Hannah can add one per show.
- An `eventStatus` of postponed or cancelled, if a show is ever moved. Google supports it, and it would need a small editor field.

## Handoff

- **How Hannah adds a show so it gets a page:**
  1. In **Shows & events**, add an event and set **Kind** to **Show**.
  2. Fill in the name and the **Short name for links**, which becomes `/events/<short name>`.
  3. Add the description, the dates (or the expected month), the place under **Where**, the price and the button.
  4. Optionally add a **Photo** and the **Search engines** title and description.
  5. Publish.

  The page exists at once, the events list links to it, and it is in the sitemap until it's over. With a date and a place under **Where**, Google can list it. Explained in `docs/content-editor.md`.
- **Fields added to events:** `programSlug`, `image`, `seo`. `pages.ts` is not touched, so the other session's change to the `seo` group (the "photo for link previews") flows in through the import. On a merge, `src/content/collections.ts` imports `seo` the same way as before.
- **`src/lib/redirects.ts`:** only the `/events/` rule changed. The other session's PDF redirects (new entries in `OLD_PAGES` or new rules) should merge cleanly. If they add a rule *above* the `/events/` block it doesn't interact. The middleware now skips the early redirect for `/events/...` only.
- **Existing databases:** the Render preview and any local `.data` were seeded before this change, so their recurring events have no "Class page" until they're re-seeded or set in the editor. Show pages work there regardless.
- **To take it back:** revert `fff6202`. No database changes or migrations are involved: the new fields are optional, and saved values are ignored by the old code.

## Compaction

None occurred in this session.
