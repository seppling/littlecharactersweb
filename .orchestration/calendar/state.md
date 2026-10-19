# Calendar unit: state

Branch `claude/bo2-calendar`, from `claude/blissful-archimedes-enun5m` (acfb1b2).

## Done
- `src/server/days-off.ts`: preview, add, list, remove days off; one class's worth; family emails.
- `src/server/adjustments.ts`: `AdjustmentInput.installmentId` / `closureId`, `insertAdjustments(tx, …)`, exported `reapply`, `draft`, `checkInput`, `logSettled`, `Tx`. Existing callers unchanged.
- `src/lib/pricing.ts`: `classDaysInMonth` exported (no change to it).
- `tests/unit/days-off.test.ts` (18 tests).

## Decisions
- Days added together share `closure.created_at` and are listed and removed as one group.
- The choice is saved as `closure.adjusted_at` (set: lowered; null: don't change).
- "Already paid: give a credit" is recorded as audit `admin.day_off.credit_due` (entity order, detail = closure id), and listed on the days-off page.
- A payment being charged right now counts as already paid (no adjustment); a failed one with the pay-now form open is lowered and catches up later.
- Any class with attendance taken blocks the whole save (untick it, or choose classes).
- Booked drop-ins are listed, not cancelled (drop-ins unit owns cancelling).
- Emails only for dates today or later.

## Next
- Calendar server + `/admin/calendar` (month, week, agenda), CSV/PDF, menu, links.
- `/admin/settings/days-off` pages; class page Dates; Today; account; public class page; ics EXDATE.
- e2e `staff-calendar.mjs`, docs, README, report.

## Open questions
- None yet.
