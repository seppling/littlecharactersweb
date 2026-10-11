# copy-pages: state

Branch `claude/seo-copy-pages`, started from `claude/seo-draft` (f1c2101).

## Commits
- Drafts for all 10 pages (`src/content/seo-draft/pages.ts`) and regenerated `docs/seo/review.md`.

## Decisions
- School names: "Barrow Elementary School" and "Timothy Elementary School" (the NCES/directory names and Hannah's own wording); Wikipedia's list says "David C. Barrow Elementary School" and "Timothy Road Elementary School". The district's site couldn't be read (JavaScript-only / proxy error).
- Press: only the Macaroni KID Athens article is linked (opened, HTTP 200, title "Little Characters Theatre Troupe | Macaroni KID Athens"). No Grady Newsource story about Little Characters was found.
- Price text uses `{tuitionRange}` so it follows class prices.

## Checks
- npm test: 201 passed. npm run check: 0 errors. seo:review regenerated.

## Open questions
- See report.md.

## Next action
- Browser preview of the drafts (desktop and 390 px), then report.md.
