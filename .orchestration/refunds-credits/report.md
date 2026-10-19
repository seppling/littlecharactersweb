# Report: refunds, credits and a yearly statement

Branch `claude/bo2-refunds-credits`. No compaction or restart happened during this unit.

## Result

**What changes for Hannah**
- **Refund** button next to every payment on a family's page (new **Payment history**), on the order page (new **Payments made**), and next to a cancelled, paid drop-in (including "Paid twice") on the class page. After **Remove** on a class page, the notice links to **Refund part of a payment**. Every "refund it in the Stripe dashboard" line is gone.
- The refund form shows the payment, what's been refunded, then **All of it ($X left to refund)** or **Part of it**, a staff-only reason, **Email the family** (ticked), a preview, then **Refund $X**. Payments marked "Paid by cash/check" get **Record a refund given by cash or check** instead. Pending refunds that Stripe didn't answer get **Try again**.
- **Credits** on each family's page → **Add a credit** (amount, reason, "Show the reason to the family"), with a preview of which payment it comes off and the new amount; **Remove** for waiting or unpaid ones.
- **Days off:** each day off with "Already paid" families lists them with one class's worth and **Give these credits** (once only).
- **Payments received** lists refunds as their own lines (−$10, "Refund to card" / "Refund by cash or check", pending marked), so the month's total is net; the count reads "3 payments, 1 refund".
- **Statements** on the family's page: CSV and PDF per year.

**What changes for families**
- Refund email: "Refund of $X for <what>", and that it takes 5–10 days to reach their card (or "given back by cash or check").
- Account: "Partly refunded: $5 of $77.50" / "Refunded $X" on receipts; **Credits** ("Credit: −$10, Missed class · comes off your Tue, Dec 1 payment"); the credit on the payment line as discounts show; **Statements** (PDF, CSV) for each year they paid in, replacing "email us for a statement".

**By file**
- New `src/server/refunds.ts`: payments and their refunds (`Payment`, `familyPayments`, `loadPayment`, `orderPayments`), the math (`refundLeft`, `refundNote`), `createRefund`, `retryRefund`, `settleRefund`, the email, `refundsMade` (Payments received), `refundedByOrder`, `enrollmentOrder`.
- New `src/server/credits.ts`: `planCredit`, `addCredit`, `previewCredit`, `removeCredit`, `applyWaitingCredits` (with reconcile), `familyCredits`.
- New `src/server/day-off-credits.ts`: `dayOffCredits`, `giveDayOffCredits`.
- New `src/server/statements.ts`: `buildStatement` (pure), `statementTable`, `familyStatement`, the two download handlers.
- `src/server/stripe.ts`: `stripeRefunder`, `paymentCardLast4`.
- `src/pages/api/stripe/webhook.ts`: `refund.updated`, `refund.failed` → `settleRefund`.
- `src/server/billing.ts`: `applyWaitingCredits()` at the start of `runBilling`, after `reapplyPendingAdjustments` (the one change to the run).
- `src/server/family.ts`: `fulfillOrder` applies the family's waiting credits after a monthly sign-up.
- `src/server/payments-admin.ts`: refunds in `paymentsReceived`; `howPaid`, `signedCents`, `receivedCount`.
- `src/server/downloads.ts`: optional `madeFor` on PDFs (default unchanged).
- `src/server/drop-ins.ts`: `PAID_TWICE` wording.
- Content: `site.statements = { taxId?, note? }` (`types.ts`, `pages.ts` "Payment statements" group, `site-content.ts` → `SiteInfo.statements`). Empty by default; nothing invented.
- Pages: new `admin/payments/[orderId]/refund.astro`, `admin/families/[householdId]/credits.astro`, `statement.csv.ts`/`.pdf.ts` (staff and `/account/`), component `components/admin/FamilyMoney.astro`; edits to the order page, family page (one line), class page, Days off page, Payments page, account page.
- `src/lib/admin-links.ts`: `refundPage`, `creditsPage`, `familyStatement`.
- Docs: `back-office.md` §21 and three routes; `staff-billing.md` Refunds, Credits, Statements and the old Stripe lines; `security.md`; `infrastructure.md` webhook events (now 6); README test list.
- Tests: `tests/unit/refunds-credits.test.ts` (23 tests), `tests/e2e/staff-refunds.mjs`.

## Proof

All with Stripe keys blanked.
- `npm run check`: 0 errors, 0 warnings (308 files).
- `npm test`: 37 files, 733 tests pass.
- `npm run build`: passes.
- Browser tests, fresh database (`tests/e2e/serve.sh`), in README order: all 18 pass (enroll-journey, trial-journey, content-editor, navigation, staff-foundation, staff-contacts, staff-classes, staff-families, staff-payments, staff-today, staff-messages with `SERVER_LOG`, staff-roster, staff-settings, staff-teach, staff-calendar, staff-drop-ins, staff-refunds with 54 checks).
- Billing check: copied `.data/e2e` right after enroll-journey and trial-journey, `APP_ENV=development PGLITE_DIR=<copy> npm run -s billing:run -- --today 2026-12-01` → charged 2: "$80.75 · December tuition: Ava … (Family discount (15%): −$14.25)" and "$55 · December tuition: Maya … (Scholarship: −$40)", no credit lines, 0 errors.
- Unit tests cover: the most that can be refunded (pending counted, failed not, two refunds at once: one passes); the pending row at the moment Stripe is called, the refund id sent, `refund-<id>` key in `stripe.ts`; stand-ins that succeed, fail, stay pending then settle by webhook (and a later failure), and don't answer then Try again with the same id; cash and test refunds without Stripe; a credit across two orders; a credit bigger than the payment; waiting credits applied at a new sign-up and at the billing run; a credit going back to waiting after Stop payments; removing before and after applying, paid ones refused; day-off credits given once; statement totals with a refund (and a refund counted in the year it was made); teachers refused for refunds, retries, credits and day-off credits.
- Existing tests changed: `tests/e2e/enroll-journey.mjs` checked that the account's statement line was a `mailto:` link; it now checks the link to `/account/statement.pdf?year=` (the behavior this unit replaces), plus its step label.
- Screenshots in `.orchestration/refunds-credits/shots/`: refund form and preview, refunded payment (family page), credit form and preview, the family's account with a credit, at 1280 and 390 px; `statement-pdf.png` (page 1 of the family's PDF).

## Decisions
- **Refund route** `/admin/payments/<order>/refund?installment=`: every payment belongs to an order. Fresh sign-in on the whole page (GET and POST), as Settings does, so typed values are never lost to the confirm step mid-refund.
- **Concurrency:** the order row is locked (`for update`) in the transaction that re-checks what's left and inserts the row. Simple and covers sign-up and monthly refunds of the same order.
- **Card vs test vs cash** is read from what's stored: `pi_`/`cs_` ids are card; "paid outside Stripe" is cash; anything else paid is a test payment (refundable without Stripe only where `testRefundsAllowed()`, the same rule as test payments). A card payment's refund is Stripe only; a cash one is cash only.
- **Sign-up PaymentIntent** read from the checkout session at refund time (no migration, no new column).
- **Stripe not answering** keeps the row `pending` with a note and a Try again button (same idempotency key) rather than marking it failed, since Stripe may have made it.
- **Webhook:** `refund.updated` and `refund.failed` (both exist in stripe@22's event list). A failed refund is final; a succeeded one can later fail.
- **Credit labels:** the adjustment is always shown to the family, as "Credit · <reason>" or just "Credit" for a private reason, so a private credit never reads "Discount".
- **Credit split:** the original row's amount becomes what fits; the rest is a new row "Rest of the credit from Oct 20" and is applied to the next payment right away. A payment left under 50¢ isn't charged (the existing adjustments rule), so a credit can take up to 49¢ more than its amount; recorded as is.
- **Reconcile** in `applyWaitingCredits`: a credit on a payment later cancelled goes back to waiting; one a payment shrank under keeps what fits and the rest waits. Without this, Stop payments would silently swallow credits.
- **On the order page**, a credit's adjustment links to Credits instead of offering Remove, so it's removed through the credit.
- **Day-off credits:** one per family and date (two classes that day add up), id `dayoff-<first closure id>-<household>`; giving twice inserts nothing. When the first month was paid at sign-up, one class's worth uses the order's next month's payment (a full month).
- **Statement:** card last four read from Stripe per payment (when keys are set), else "card"; refunds counted in the year made; pending refunds listed and marked "(pending)", failed ones left out. Address is HQ's location; name is the site's name. PDF says "Made … for <family>".
- `removeChild`'s return stays unchanged; the class page looks up the enrollment's order first for the "Refund part of a payment" link.

## Open points
- **Tax ID and note wording** are empty until Hannah fills them; nothing about deductibility was written. Recommended: Hannah decides.
- **Credits on families who paid the season up front** wait until their next monthly sign-up. Recommended: fine; for money back now, refund instead.
- **Credit "remainder under 50¢"** rule (above). Recommended: keep, consistent with discounts.
- **Stripe idempotency keys expire after 24 hours**: a pending refund retried a day later could in principle be sent twice if the first call actually reached Stripe. Recommended: accept (Try again is for the moment Stripe didn't answer); a follow-up could look the refund up by `metadata.refundId` first.

## Follow-up candidates
- A "Refund didn't go through" item on Needs attention.
- Look up a pending refund in Stripe by `metadata.refundId` before retrying.
- A refunds and credits report for the reports unit.
- A staff email when a refund fails after succeeding (the webhook records it only).

## Handoff
- **Routes:** `refundPage(orderId, installmentId?)`, `creditsPage(householdId)`, `familyStatement(householdId, year)` (pass to `downloads()`); families `/account/statement.csv|pdf?year=`.
- **Functions:** `familyPayments(householdId)` → `Payment[]` (`key`, `kind` signup|monthly|drop_in, `orderId`, `installmentId`, `paidAt`, `amountCents`, `via` card|cash|test|none, `refunds`, `leftCents`); `refundNote`, `refundLeft`; `refundsMade(from, until)`; `refundedByOrder(orderIds)`; `familyCredits(householdId)` → `CreditRow` with `state`; `applyWaitingCredits(householdId?)`; `buildStatement`/`familyStatement`.
- **Data:** `refund` rows always have `order_id`; `installment_id` set for monthly charges. Pending and succeeded count against the payment; failed doesn't. `credit` rows: waiting = `applied_at` null and `removed_at` null; credits' adjustments are ordinary `billing_adjustment` rows (label "Credit…", `closure_id` null). Day-off credit ids start `dayoff-`.
- **Audit actions:** `admin.refund.add|retry`, `refund.succeeded|pending|failed|email`, `admin.credit.add|remove`, `credit.applied|rest|returned`, `admin.statement.csv|pdf`, `statement.csv|pdf`.
- **Reports unit:** net money for a month = Payments received's rows (refund lines are negative).

## Compaction
None.
