# Report: staff discount adjustments (`claude/review-discounts`)

## Result

Hannah can now give one family a discount on their monthly payments: a dollar amount or a percentage, on the next payment or every remaining month, with a reason. She sees the new amounts before saving, can remove it later, and every change is logged. Families see "Discount: −$40" (or "Scholarship: −$40" if Hannah chooses to show the reason) on the payment, and the charge, the receipt email and the Stripe description all use the lower amount.

By file:
- `src/lib/adjustments.ts` (new): the math, with no database. Percent or amount, in the order they were added, applied after the built-in discounts. The cent rounds in the family's favor, the amount never goes below $0, and a remainder under 50¢ is taken off too. It also has the family label and the parsing of the staff form.
- `src/server/db/schema.ts` and `drizzle/0006_staff_adjustments.sql` (+ meta snapshot): a new `billing_adjustment` table holds the order, kind, value, once/monthly, the target payment for "once", the reason, `show_to_family`, `created_by`/`created_at` and `removed_at`/`removed_by`. `installment` gets three new columns:
  - `base_amount_cents`, backfilled from `amount_cents` in the migration;
  - `adjustments` (jsonb lines, as the family sees them);
  - `pay_now_opened_at`.
- `src/server/adjustments.ts` (new):
  - preview, add and remove, each staff-only (`isAdmin` re-checked here) and run in a transaction with `FOR UPDATE` on the order's payments;
  - each change recomputes the payments from their base amount;
  - a catch-up step that the billing run calls;
  - the staff views (one order's billing, and the list of families on monthly autopay).
- `src/server/billing.ts`:
  - the run first catches up adjustments that couldn't be applied earlier;
  - a $0 month is marked paid without calling Stripe;
  - the charge description is `<label> (Scholarship: −$40)`;
  - receipt and failure emails name the discount, with a "Nothing to pay" email for a covered month;
  - `holdForManualPayment` records `payNowOpenedAt`;
  - `devCharger` prints `[test charge] $55 · …` (development only).
- `src/server/payments.ts`: the pay-now Checkout line item gets a `description` naming the adjustment (its amount was already `amountCents`). No other change to how Stripe is called.
- `src/server/family.ts`: new installments get `baseAmountCents`.
- `src/pages/admin/billing/[orderId].astro` (new): one family's payments, with the due date, status, usual amount, discounts and amount charged. It also lists the discounts: what each takes off, its reason, what the family sees, who added it and when, which payments it changes, and a **Remove** button with a confirm step. The **Add a discount** form goes to a **Check before saving** step that shows each payment now and after, then **Save discount**. Removed discounts are listed with who removed them and when.
- `src/pages/admin/billing.astro`: a new list, **Families on monthly autopay**, with a **Payments & discounts** link on each row; family names in the existing tables link to their page too.
- `src/pages/account/index.astro`: in upcoming autopay, a discounted payment shows a green "Scholarship: −$40" line and the old amount struck through above the new one. Receipts and "didn't go through" alerts show the line too.
- `src/pages/account/pay/[id].astro`: shows the breakdown (`$95 tuition, Discount: −$40`), and re-reads the payment after holding it, so the Stripe form always gets the current amount.
- Tests:
  - `tests/unit/adjustments.test.ts` (new, 19 tests);
  - `tests/e2e/enroll-journey.mjs`: Hannah adds a discount, a family's posted request gets a 404, and the family sees the discount. It also checks at 390 px that the page doesn't scroll sideways.
- Docs:
  - `docs/staff-billing.md` (new, for Hannah);
  - a section in `docs/portal.md` and its code map;
  - a link from `docs/content-editor.md`;
  - one phrase in `docs/security.md` (A09).

For Hannah: **Monthly autopay → Payments & discounts → Add a discount → Check the new amounts → Save discount.** To undo: **Remove**.

## Proof

- `npm run check`: 0 errors, 0 warnings (6 existing hints in `tests/e2e/content-editor.mjs`).
- `npm test`: 10 files, 278 tests passed (259 before, plus 19 new). Run 5 more times on the new file and twice on the full suite after the fix below; all passed.
- `npm run build`: complete.
- Browser tests on a fresh database (`npm run build && tests/e2e/serve.sh`):
  - `node tests/e2e/enroll-journey.mjs`: all steps passed, including the new ones:
    - "Hannah takes $40 off the family's next payment ($95 → $55), after checking the new amount";
    - "A family posting the staff discount form gets 'not found'";
    - "The family sees 'Scholarship: −$40' and $55 on their next payment".
  - Then `node tests/e2e/content-editor.mjs`: all passed.
  - The server was stopped by its PID.
- Billing script, run as CI runs it, on a local database with one family and a $40 "once" adjustment shown to the family. Real date Oct 13: October was paid at checkout, so November is the next payment.
  ```
  2026-11-01 scheduled base 9500 charge 5500 [["Scholarship",4000]]
  $ npm run -s billing:run -- --today 2026-11-01
  [test charge] $55 · November tuition: Maya, Intro to Theater (Scholarship: −$40)
  [dev mailbox] to=sam@example.com subject="Payment received: $55 · Little Characters"
  { today: '2026-11-01', lateFees: 0, due: 1, charged: 1, pending: 0, failed: 0, errors: 0, remaining: 0 }
  exit 0
  2026-11-01 paid charged 5500
  email: Thank you! We received $55 for November tuition: Maya, Intro to Theater (Scholarship: −$40).
  audit: adjustment.add u-staff
  ```
  CI's own form also ran clean: `APP_ENV=development PGLITE_DIR=memory:// npm run -s billing:run -- --today 2026-10-01` exits 0.
- What the unit tests prove:
  - once vs every month;
  - percent vs amount;
  - the $0 floor and the sub-50¢ remainder;
  - rounding in the family's favor (33% of $161.50 → $53.30 off);
  - stacking after the 15% (two students: $161.50 → 10% → $145.35; 33% → $108.20 in the database) and after the 10% (pure math; a paid-in-full order is refused, because nothing is left to charge);
  - two adjustments in order;
  - paid months untouched;
  - removal restores the unpaid months only, and a paid month keeps its record;
  - a recurring adjustment added mid-enrollment changes only Nov and Dec;
  - the late fee isn't discounted (100% off leaves $15 due);
  - a $0 month is never sent to the charger;
  - a failed month that's fully covered is settled;
  - a month with the pay-now form open, or being charged, is left alone, and the run catches it up later;
  - preview saves nothing;
  - a reason is required;
  - a family user, or an unverified staff address, can't preview, add or remove;
  - audit rows for add and remove.
- Screenshots in `.orchestration/discounts/shots/`, each at desktop width and at 390 px:
  - `7c-discount-check` (the confirm step);
  - `7d-discount-saved` (the admin page after saving);
  - `9-family-discount` (the family account).

  I looked at all six. There is no sideways scroll, which the journey also checks. In the full-page captures, the site's sticky header appears halfway down the family account page. That is how full-page screenshots draw a sticky header, not a layout problem.

**Two things to report plainly:**
1. **One request reached Stripe's test mode by accident.** This container has `STRIPE_SECRET_KEY` (a test-mode key) set. My first billing-script run didn't blank it, so the script called Stripe's API once. The call failed with "No such PaymentMethod: 'test_card'": no payment was made and no money moved. That was a request to an outside service, which the limits forbid. Every later run blanked the Stripe keys, as `tests/e2e/serve.sh` does. The test-mode account may show one failed request around 01:33 UTC on Oct 13, with a PaymentIntent for $55.
2. **A flaky test I caught and fixed.** One test failed on about 1 run in 3 at first. Two adjustments saved in the same millisecond (frozen clock in tests) were ordered by random id. Now each new adjustment is stamped strictly after the existing ones for that order, so the order is always the order they were added.

## Decisions

- **Per order, not per enrollment.** Monthly payments belong to the order (one family's class, possibly several children), so the adjustment does too. It is simpler and matches what's charged.
- **Payments keep a base amount; `amountCents` becomes what's charged.** All existing code (autopay, pay-now, receipts, staff totals) already charges `amountCents`, so none of it can miss the discount. Removal recomputes from the base, so nothing is lost by stacking.
- **Which payments can change:**
  - scheduled: yes;
  - failed: yes. The next retry makes a new payment at the new amount;
  - not when the family opened pay-now in the last 2 hours. Stripe's form holds the old amount for up to 1 hour, and a mismatched payment is refused;
  - processing: never. The PaymentIntent already exists with its amount;
  - paid and cancelled: never.

  The daily run catches up anything skipped, before charging it.
- **"Once" picks the next payment that can change, when it's added**, and stays on that payment. Otherwise it would slide to a later month once that one is paid.
- **Several adjustments apply in the order added; a percentage comes off what's left.** It's predictable, and removal is consistent because everything is recomputed.
- **The 50¢ remainder goes to $0.** Stripe can't charge less than 50¢; that's also in the family's favor.
- **$0 months aren't sent to Stripe.** A scheduled one is marked paid on its date, with a "Nothing to pay" email. A failed one with no late fee is settled at once, so it doesn't pick up a late fee in the meantime.
- **Reason private by default.** Families see "Discount" unless Hannah ticks **Show the reason to the family**. Reasons like "dad between jobs" stay private.
- **Whole percentages only (1–100), amounts up to $10,000.** It's enough for scholarships and credits, and easy to widen.
- **Confirmation is a server-side "Check before saving" step** that shows the real before and after amounts, not a JavaScript `confirm()` that would duplicate the math. Remove uses the existing `data-confirm` pattern.
- **Staff check in two places:** on the page (404 for families, like the other admin pages) and in `src/server/adjustments.ts`, which is unit-tested.
- **No link from the roster.** The teachers unit is giving teachers roster access without billing, so a billing link there would conflict with that unit and point teachers at billing. Instead, `/admin/billing` lists every family on monthly autopay.
- **No change to `src/lib/pricing.ts`**, the built-in discounts or the late fee rules.

## Open points

1. **Discounts on a class paid in full, or on the first month paid at checkout.** Those payments are already collected, so a discount there would be a refund, which means a change to how Stripe is called. That is outside this unit. *Recommendation:* refund in the Stripe dashboard (documented in `staff-billing.md`). For a scholarship known before enrollment, Hannah adds a discount right after the family enrolls; it takes effect from the next month.
2. **The pay-now 2-hour lock.** It covers the 1-hour Stripe form, plus a margin for the webhook. A webhook delayed past that window, with a discount added meanwhile, would be refused as an amount mismatch and logged (`installment.amount_mismatch`), and staff would reconcile it. *Recommendation:* accept it. It needs three rare events at once, and the failure is loud and safe (the family isn't marked paid for the wrong amount).
3. **Whether families should get an email when a discount is added.** Today they see it in their account and on the next receipt. *Recommendation:* no email for now; ask Hannah.

## Follow-up candidates

- An "adjustments this month" total on `/admin/billing`, for bookkeeping (scholarship fund).
- Decimal percentages, if Hannah ever needs them.
- When the downloadable statements come after launch, include the adjustment lines.

## Handoff

- Merge note: the migration is `0006_staff_adjustments`. If another unit also adds a migration, renumber one of them and regenerate the snapshot with `npm run db:generate`.
- `tests/e2e/enroll-journey.mjs` has new steps after "Hannah's billing page" and at the end. The teachers unit may touch the same file.
- No seed text, class page, event cards or navigation changed. No SEO draft is affected.

## Compaction

No compaction or restart happened during this unit.
