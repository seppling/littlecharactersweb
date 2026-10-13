# family-discount: state

Branch `claude/review-family-discount` (from `claude/blissful-archimedes-enun5m` at 7f607ac).

## Status
In progress: design done, implementing.

## Decisions (so far)
- New column `installment.regular_amount_cents` (migration 0007): the month's price for the order's children before the 15% family discount. Backfill: the site isn't live; for rows whose order shows the 15% line, regular = round(base / 0.85), else regular = base.
- One module `src/server/family-discount.ts`: counting + `refreshFamilyDiscount(tx, householdId, opts)`.
- An enrollment counts when: status active, program kind `class` (as today), its session hasn't ended (endDate >= today), and its order's payments weren't stopped by staff (no cancelled payment on the order).
- Family discount rounding: in the family's favor (cents − ceil(15%)), also used for checkout installments so the two agree.
- Stop payments becomes a two-step check-then-stop on /admin/billing, showing which other payments go back up.

## Open questions
None blocking.

## Next action
Migration + schema, then the module and call sites.
