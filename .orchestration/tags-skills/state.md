# tags-skills: state

Branch `claude/bo2-tags-skills`, from `claude/blissful-archimedes-enun5m` (3ab1c0a).

## Status
Started. Reading done; building server modules.

## Decisions
- Tag emails: `message.kind` gains `'tag'` (a TypeScript enum on a text column: no migration); `message.session_id` holds the tag id for those rows. Reason: the composer's send log needs to find a tag's earlier emails, with no new column.
- Progress note drafts hold only the note's text; the "Got it" and "Working on it" lists are picked at send time and written into `progress_note.body` then (the text families see). Reason: no column for picked skills; a draft stays editable.

## Open questions
None yet.

## Next
Server modules: src/server/tags.ts, src/server/skills.ts, src/server/progress-notes.ts.
