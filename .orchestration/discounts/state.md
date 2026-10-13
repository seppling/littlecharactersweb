# Unit: staff discount adjustments (`claude/review-discounts`)

## Status
In progress. Started 2026-10-13 from `claude/blissful-archimedes-enun5m` (0b44eaf).

## Plan
1. Pure math in `src/lib/adjustments.ts` (no change to `src/lib/pricing.ts`).
2. Table `billing_adjustment`; installment gets `base_amount_cents`, `adjustments` (lines the family sees) and `pay_now_opened_at`. Migration `drizzle/0006_*`.
3. `src/server/adjustments.ts`: add, remove, re-apply (in a transaction, row locks), staff-only check.
4. Billing: $0 months settle without Stripe; charge description and receipts name the adjustment.
5. Admin page `/admin/billing/<orderId>`, list of families on `/admin/billing`.
6. Family account shows "Scholarship: −$40" (or "Discount: −$40" by default).
7. Tests, docs, billing script run, e2e, screenshots.

## Decisions
(see report.md once written)

## Open questions
None yet.

## Next action
Write the code.
