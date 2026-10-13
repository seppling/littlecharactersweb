# family-discount: state

Branch `claude/review-family-discount` (from `claude/blissful-archimedes-enun5m` at 7f607ac).

## Status
Done. Report: `report.md` in this folder.

## Commits
- d2543e6 start state file
- c4e5a62 regular price column (migration 0007), `src/server/family-discount.ts`, refresh after fulfillment, Stop payments and in the billing run; unit tests
- 9be281c what families and staff see, two-step Stop payments, docs, browser tests
- f5f6c0f phone layout fix on /admin/billing, review page checked at 390 px, report
- (follow-up) ended email; only month-priced classes count

## Decisions
See report.md → Decisions. In short: new `regular_amount_cents` column with a backfill from the order's 15% line; an enrollment counts when active, a weekly class (`kind === 'class'`), its class not ended, and its order not stopped; the 15% rounds in the family's favor everywhere; Stop payments is check-then-stop.

## Open questions
Stephen answered the open points (Oct 13): ended email built, paid-in-full withdrawal left as is, only month-priced classes count. One choice to confirm: children in one sign-up still get 15% together whatever the price unit (report.md → Open points 3).

## Next action
None. Waiting for the coordinator.
