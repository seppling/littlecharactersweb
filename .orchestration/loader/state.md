# Loader unit: state

Status: done. Report: `.orchestration/loader/report.md`.

## Commits (branch claude/seo-loader)
1. SEO drafts: draft format, loader, review page and tests
2. SEO drafts: docs, report

## Decisions
- Loader identity: `content_entry.updated_by = 'seo-drafts'` (a text column, not an account; can't sign in).
- A wrong path or item in a draft = "problem" (a bug in the draft file); a `from` mismatch = "skipped" (the content changed).
- No change to `src/server/content.ts`.
- `--from <file>` lets the loader take drafts from another file, for trying it out.

## Open questions
- None blocking. See the report's Open points.

## Next action
- None for this unit. Wording sessions add drafts to `src/content/seo-draft/*.ts`, run `npm test` and `npm run seo:review`.
