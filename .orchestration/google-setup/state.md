# google-setup: state

## Status
Done. Report: `.orchestration/google-setup/report.md`. No compaction or restart.

## Commits
- `f6f3840` state file
- `657cbfe` class search fields, link previews, structured data, old-site redirects
- (this commit) report and state

## Decisions (details in the report)
- No Event markup on the /events list: Google supports events only on single-event pages (doc updated Sep 8, 2026). `eventLd()` is written and tested, ready for event pages.
- Course markup (class, inclusive, lesson, workshop) + ItemList on /programs; no FAQPage (removed from Search May 7, 2026).
- Organization type: TheaterGroup + EducationalOrganization.
- Share images: 1200x630 JPEG centered on the focus point, 10% steps; built-ins at build time, uploads on request.
- Build peak RSS: 708 MB before, 676 MB after (MALLOC_ARENA_MAX=2). Build 15 s -> 35 s, dist/client 13 -> 39 MB.
- No sitemap lastmod.

## Open questions (recommendations in the report)
1. Event pages, so events can get Google results.
2. Old 2024 semester pages, /services, /store, the teaching-philosophy PDF.
3. The parking-guide PDF link points to the old site's /s/ file.
4. Geode page has no photo of its own for previews.

## CI
- `f6f3840`: passed.
- `657cbfe`: run 38112010222 passed.
- `e82b9f0`: run 38112072957 passed.

## Next action
None; waiting for the coordinator.
