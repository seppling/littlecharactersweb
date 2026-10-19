# Drop-ins unit: state

Branch `claude/bo2-drop-ins`, from `claude/blissful-archimedes-enun5m` (acfb1b2). No compaction or restart.

## Status: done, report written (`report.md`)

- The type check, 642 unit tests, the build and all 15 browser tests in README order pass on one fresh database.
- The billing check still charges $80.75 and $55.
- No migration (`db:generate`: no changes).

## Decisions
In `report.md` → Decisions (17 entries).

## Open questions (for the coordinator or Hannah)
1. The $25 placeholder price: Hannah to confirm.
2. Is a missed drop-in refundable? The policy line reuses "Missed classes aren't refunded."
3. The content stores the drop-in price in dollars (`price`), not `priceCents`, to match the editor.
4. README: drop "(last)" on `staff-settings.mjs` at the merge.

## Next action
None. Waiting for the coordinator's merge or review.
