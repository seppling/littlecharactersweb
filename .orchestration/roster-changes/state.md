# Roster changes: state

Branch `claude/bo-roster`, started from `claude/blissful-archimedes-enun5m` at 45bc452.

## Decisions (with reasons)

- **No-charge places:** a new nullable `enrollment.no_charge_reason` column (migration 0010, additive), with `order_id` null. Reason: the enrollment is what rosters, the family page and the discount count read; an order with a new plan would ripple through every place that reads `order.plan` and would show as a $0 receipt to the family.
- **Offer authorization:** an open, unexpired `waitlist_offer` for the family's waitlisted child is what lets them sign up; the `?offer=` link only adds the note on the page. Reason: the sign-in flow doesn't carry query strings, and the offer row is the real permission either way.
- **Remove and stop:** one transaction cancels the enrollment, cancels the order's remaining charges (shared helper extracted from `stopRemainingPayments`, same query) and refreshes the family discount once. Reason: atomic, one discount email at most.

## Next action

Write `src/server/roster-changes.ts`, the migration, the checkout changes, then the page.
