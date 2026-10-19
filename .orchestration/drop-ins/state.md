# Drop-ins unit: state

Branch `claude/bo2-drop-ins`, from `claude/blissful-archimedes-enun5m` (acfb1b2).

## Done
- Content: `site.dropIns = { price: 25, open: true }` (dollars, editor money field), `session.dropIn = { price?, off? }`; `SiteInfo.dropIns = { priceCents, open }`.
- `order.plan` gains `drop_in` (TypeScript enum only; plain text in the database, no migration).
- `src/server/drop-ins.ts`: prices, dates, booking, pay readiness, fulfilment, confirmation email, staff list, roster for a date, pay link, no charge, cancel.
- `fulfillOrder` hands `drop_in` orders to `fulfillDropIn`.
- Family pages: `/drop-in/[sessionId]`, `/drop-in/pay`, `/drop-in/confirmation`; `/enroll/details` handles drop-in orders (policies, next step); enroll review/pay/confirmation send drop-in orders to the drop-in pages.
- Program page link, family account (upcoming drop-ins, "Drop in for one class" list), staff class page (roster date, Drop-in badge, Add a drop-in, Drop-ins list + CSV/PDF, Cancel), staff family page, Today counts.

## Next
- Unit tests, docs, README, e2e `tests/e2e/staff-drop-ins.mjs`, full checks, screenshots, report.

## Decisions
See report.md when written.

## Open questions
None blocking.
