# family-discount: state

Branch `claude/review-family-discount` (from `claude/blissful-archimedes-enun5m` at 7f607ac).

## Status
Done. Report: `report.md` in this folder.

## Commits
- d2543e6 start state file
- c4e5a62 regular price column (migration 0007), `src/server/family-discount.ts`, refresh after fulfillment, Stop payments and in the billing run; unit tests
- 9be281c what families and staff see, two-step Stop payments, docs, browser tests
- (final) phone layout fix on /admin/billing, review page checked at 390 px, report

## Decisions
See report.md → Decisions. In short: new `regular_amount_cents` column with a backfill from the order's 15% line; an enrollment counts when active, a weekly class (`kind === 'class'`), its class not ended, and its order not stopped; the 15% rounds in the family's favor everywhere; Stop payments is check-then-stop.

## Open questions
For Hannah (not blocking): see report.md → Open points.

## Next action
None. Waiting for the coordinator.
