# Roster changes: state

Branch `claude/bo-roster`, started from `claude/blissful-archimedes-enun5m` at 45bc452.

## Done

- Server: `src/server/roster-changes.ts` (remove, add by link or without charge, offers), migration `0010_roster_changes` (enrollment.no_charge_reason, audit_log.detail), `cancelRemainingInstallments` in billing.ts, the no-charge rule and `previewRemovalEffect` in family-discount.ts, offers in checkout (`checkPicks`, `priceOrder`, `fulfillOrder`) in family.ts, Today subtracts open offers.
- Pages: class page (the three places), family page and Payments ("No charge"), the family's enroll page (offer note).
- Unit tests: tests/unit/roster-changes.test.ts (14), whole suite 584 passing; `npm run check` 0 errors.
- Docs: back-office.md §14, staff-billing.md, portal.md, security.md, README.
- Browser tests: all existing ones pass after one line fix in staff-classes.mjs (two lines: `summary` → `.kid__care > summary`, because each child now also has a Remove disclosure).

## Decisions (with reasons)

- **No-charge places:** a nullable `enrollment.no_charge_reason` (migration 0010, additive), `order_id` null. The enrollment is what rosters, the family page and the discount read; a new order plan would ripple through every reader of `order.plan` and show the family a $0 receipt.
- **Reason in the audit log:** `audit_log.detail` (additive, nullable), because the task asks for the reason kept in the audit log and the enrollment's copy is cleared if the family later pays.
- **Offer authorization:** the open, unexpired offer is the permission; `?offer=` only adds the note. The sign-in flow drops query strings.
- **Remove and stop:** one transaction (cancel enrollment, cancel charges via the shared helper, refresh the discount once).
- **A full class with a sign-up link:** allowed after "Send anyway", with a warning that the family can only join the waitlist (the checkout's capacity check still decides).
- **Refuse:** enrolled or trial children; a waitlisted child gets Offer the spot instead of a link, and Add without charge converts their waitlist row.
- **Remove doesn't need a fresh sign-in,** like Stop payments on the Payments page.

## Next action

Done: report written (report.md). Waiting on the coordinator for the open points.
