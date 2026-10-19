# tags-skills: state

Branch `claude/bo2-tags-skills`, from `claude/blissful-archimedes-enun5m` (3ab1c0a).

## Status
Built: tags (Settings → Tags, family page, roster "Tag selected" and filter, search by tag, Email a tag, CSV/PDF), skills (Settings → Skills, teacher Skills view, class grid + worksheet, family page), progress notes (teacher drafts, Hannah's preview and send, family account). Unit tests and `tests/e2e/staff-tags-skills.mjs` pass. Full browser suite running.

## Decisions
- Tag emails: `message.kind` gains `'tag'` (a TypeScript enum on a text column: `drizzle-kit generate` says no changes); `message.session_id` holds the tag id for those rows. Reason: the composer's send log needs a tag's earlier emails, with no new column.
- Progress note drafts hold only the note's text; the Got it / Working on it lists are picked at send time and written into `progress_note.body`. Reason: no column for picked skills.
- Skills access: as `teachAccess`'s people, but not per date: covered or submitted dates don't block ticking; day off and future dates do (teachers); owners always.
- Tag redirects carry error codes, never names.
- No fresh sign-in for tag and skill changes (only downloads), like notes on the family page.
- One teacher draft per teacher, child and class, changed in place.

## Open questions
None blocking.

## Next
Full e2e run, report.
