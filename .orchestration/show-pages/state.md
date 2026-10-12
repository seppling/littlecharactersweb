# show-pages: state

Branch `claude/seo-show-pages`, from `claude/seo-draft` at c7d1587.

## Status
In progress: reading the code, then adding show pages, the redirect change, card links, editor fields, sitemap, docs.

## Decisions
- Show pages are for events of kind `show` only, past ones included (shared links keep working).
- The `/events/<slug>` check needs the site content, so the middleware runs the `/events/` redirect after the content is loaded (it respects staff preview).

## Open questions
(none yet)

## Next action
Write `src/lib/events.ts` and the page.
