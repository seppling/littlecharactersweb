# Families unit: state

Branch `claude/bo-families`, from `claude/blissful-archimedes-enun5m` at 5094d9b.

## Next action
Write `src/server/families.ts`, then the pages, tests, browser test, screenshots, report.

## Decisions
- Downloads: Family List at `downloads(search())` (/admin/search.csv|pdf); Student / Class List, Student Contact List and Family Notes at `/admin/search/children|contacts|notes.(csv|pdf)`, built from `search()`, since admin-links.ts is off limits. Shown on the Families list (no query), and Notes also on a family's page.
- "This season" = the catalog term running today (weekly classes first), else the next to start.
- Back link on a family's page: to the search results when staff came from them (same-site Referer), else Families. Keeps names out of the family page's URL.

## Open questions
(none yet)

## Commits
(none yet)
