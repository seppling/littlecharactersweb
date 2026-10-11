# google-setup: state

## Status
In progress (started Oct 11, 2026).

## Findings so far (Google Search Central, pages last updated Sep 8, 2026)
- Event: "Each event MUST have a unique URL (a leaf page) and markup on that URL"; only pages focused on a single event are supported. /events is a list page.
- FAQ rich results: removed from Search (May 7, 2026). Skip FAQPage.
- Course list: still supported (summary page ItemList + Course on detail pages, at least 3 courses). Course info is gone from the gallery.

## Decisions
- Baseline build peak RSS (MALLOC_ARENA_MAX=2): 708 MB.

## Next action
Implement seo field, share images, JSON-LD, redirects.
