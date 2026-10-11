# Loader unit: state

## Done
- Draft format: `src/content/seo-draft/format.ts` (+ one module per kind, `index.ts`).
- Loader: `scripts/seo-drafts.ts` (library), `scripts/seo-load-drafts.ts` (CLI, `npm run seo:load-drafts`).
- Review page: `src/content/seo-draft/review.ts`, `scripts/seo-review.ts` → `docs/seo/review.md`.
- Preview DB step loads drafts (`scripts/prepare-preview-db.ts`).
- Tests: `tests/unit/seo-drafts.test.ts` (14 passing).

## Decisions
- Loader identity: `updated_by = 'seo-drafts'` (text column, no account, cannot sign in).
- Wrong path in a draft = "problem" (draft bug); `from` mismatch = "skipped" (content changed).
- No change to `src/server/content.ts`.

## Next
- npm run check / test / build, real run with browser, preview memory, docs/seo/drafts.md, report.
