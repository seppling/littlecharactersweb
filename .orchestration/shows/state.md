# Shows unit: state

Branch `claude/bo2-shows`, from `claude/blissful-archimedes-enun5m` (3ab1c0a).

## Done
- `src/server/shows.ts`: shows list, cast (add, edit, move, remove, another role), suggestions from performing classes, downloads (program, staff sheet), rehearsals (add, change, remove; Athens time), who sees which rehearsal (teachers, families), change emails.
- Staff pages: `/admin/shows`, `/admin/shows/<slug>`, `/admin/shows/<slug>/email`, downloads `program.csv|pdf`, `cast-sheet.csv|pdf`. Shell menu: Shows. Links: `shows()`, `show(slug)`, `showEmail(slug)`.
- Calendar: rehearsal entries (teal), month, week and phone views.
- Teacher app Today: read-only rehearsal cards.
- Family account: role line and rehearsals; class calendar file (.ics) lists the child's rehearsals.

## Decisions (with reasons)
- Cast emails are logged as `kind: 'class'` messages with `session_id = 'show:<slug>'`: no schema change, the composer and the family page's log work as they are.
- Cast changes don't need a fresh sign-in (no money, no care details); downloads do.
- Whole-cast rehearsals: teachers of the performing classes' current sessions see them; every child in the cast is called.
- Rehearsal cards come from `teacherRehearsals` in `shows.ts` beside `teachCards`, not inside it, to keep `TeachCard` unchanged.

## Open questions
- none yet

## Also done
- Unit tests (`tests/unit/shows.test.ts`, 22), browser test `tests/e2e/staff-shows.mjs` (in README), docs §21 and security row, report.

## Next
- Nothing: the unit is finished. All checks pass (check, 732 unit tests, build, all 17 browser tests in order). See report.md.
