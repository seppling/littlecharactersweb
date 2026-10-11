# Report: Google Business Profile kit

No compaction or restart occurred.

## Result
- `docs/seo/business-profile.md` (new): 11 parts, as specified: five-minute profile checklist, facts, categories, 622-character description plus a 110-character short one, 14 services, service area, UTM links, photos and a post calendar through spring 2027, review kit, 12 other listings, questions for Hannah.
- `.orchestration/business-profile/state.md`, `report.md`.
- No other file changed.

## Proof
- Description length counted with Python: 622 of 750; short version 110.
- Facts (name, address, phone, email, social links, prices, ages, days) were taken from `src/config/site.ts`, `seed/locations.ts`, `seed/programs.ts`, `seed/pages.ts` and `seed/events.ts`.
- Link check with curl (Oct 11, 2026): all Google help pages, Macaroni KID Athens pages, ActivityHero, Yelp, Apple, Bing, Nextdoor, Patch, Facebook, Instagram, TheHomeSchoolMom and the share link returned 200 (also lobstr/websoa/seodesignchicago category lists).
- Not verified by script: flagpole.com, gigsalad.com and visitathensga.com return 403 to scripts (bot block); not checked by a browser. The kit tells Hannah to find the submit link herself on Flagpole and Visit Athens; visitathensga.com is not linked in the final text. The Google profile itself and the signed-in picker could not be checked.
- `https://www.littlecharacters.org/camps` and `/programs` return 404 today because the live Squarespace site is not the new site yet; they will work after the November launch (the `/camp` redirect to `/camps` is a separate unit's job).
- Google pages read (Oct 11, 2026): guidelines for representing your business (3038177), manage category (7249669, 3039617), photos/videos/posts policy (7213077), contribution policy on reviews (7400114), request ownership (4566671, via search summary and 200 status). Features I recommend were checked on those pages.

## Decisions
- Primary category "Drama school", additional Children's theater, Theater company, Performing arts group, Summer camp, Children's party service. Reason: weekly classes are the main paid service. Google publishes no category list; I checked names against three third-party 2026 compilations, and the kit tells Hannah to confirm in the picker. Children's theater and Children's party service appeared in only one list, so flagged.
- Recommended a service area (Athens, Watkinsville, Winterville, Bogart, Statham) while keeping the storefront address visible, per Google's hybrid rule. Caveat on staffed hours.
- Left out Q&A, messaging and Offers: could not confirm they are current.
- Omitted fees (performance/materials) from service prices to keep it short.
- Name kept exactly as the website's: Little Characters Theater Troupe.
- Macaroni KID timing inferred from guide id timestamps (2025 camp guide created Dec 4, 2024; fall guide Dec 28, 2025): email in early December 2026.

## Open points
- Hours (answer 16): recommend Hannah choose phone-answering hours, or leave blank until chosen.
- Whether Thanksgiving, winter and MLK mini camps run: posts marked "only if scheduled".
- Whether the sign says "Little Characters" or the full name (Part 11 item 12).
- Whether "Children's party service" should be added at all (depends on party details).
- No Google review-policy page was available via the Maps content policy beyond 7400114; staff-quota rule appears there.

## Follow-up candidates
- After launch, check that UTM-tagged links don't break any redirect or canonical.
- Re-verify the category names in the picker once Hannah has access.
- Add the Variety Show venue (Marigold Auditorium, Winterville) to the profile post once confirmed.

## Handoff
- Other units: keep the address, phone and name exactly as in kit Part 2. The kit sends traffic to `/`, `/programs`, `/camps`, `/events` with `utm_*` tags, so those must keep working.
