# Classes unit: state

Branch `claude/bo-classes`, from `claude/blissful-archimedes-enun5m` (5094d9b). No compaction or restart.

## Commits
- Classes list and a class's page (checkpoint): server module, pages, downloads, unit tests.
- Browser test, layout fixes, docs, report (this commit).

## Decisions
- "Under 5" applies to weekly classes (`kind: 'class'`) only: camps and one-off dates don't need 5 to run.
- Places filled = enrolled + trial (the same as `takenSpots`).
- Sign-in sheet address: `downloads(classPage(id) + '/sign-in-sheet').pdf`, because `admin-links.ts` has no function for it.
- "Offered <date>" for an offer whose status is `offered` only.
- `restrictedPickup` isn't passed to `childBadges`: the household's pickup list is who may collect, not a restriction.
- Badge tones and the head's action row are fixed in my pages' scoped styles; admin.css has two cascade bugs (see report).

## Open questions (all in report.md → Open points)
- Apply `journey-tests.patch` (two existing journey steps check the old roster table).
- Fix admin.css's `.badge` order and `.admin-head > div` grid rule.
- Add `classSignInSheet(id)` to `admin-links.ts`.

## Next
- Done; waiting for the coordinator.
