# family-discount: report

Branch `claude/review-family-discount`, from `claude/blissful-archimedes-enun5m` at 7f607ac. No compaction or restart happened during this unit.

## Result

The 15% discount now covers the whole family. Once a family has two or more active weekly-class enrollments, all their remaining monthly payments for weekly classes are 15% off, whatever order the children signed up in. When the family drops back to one, the unpaid months go back to the regular price. The published rule and its numbers (10%, 15%), the late fee and proration are unchanged.

**For families**
- Ava continues monthly ($95), then Ben pays for the season: Ava's later months drop to $80.75. Before this change they stayed at $95.
- The review page says so before they pay: "Ava’s remaining monthly payments also drop to $80.75."
- The account, the pay-now page, receipts, emails and the card charge show "Family discount (15%): −$14.25", before any staff discount line. The account also has a short note saying the discount applies while two or more are enrolled. When the discount ends, the note says so.
- Months already paid, months being charged, and seasons paid in full never change. There are no refunds.

**For Hannah**
- Nothing to set up. It's automatic.
- On a family's **Payments & discounts** page, each payment shows the regular price, the family discount and her own discounts, each in its own column.
- **Stop payments** on Monthly autopay now has two steps. It first shows the charges it cancels and which of the family's other payments go back up, and by how much (for example "Ava, Intro to Theater, Tue, Dec 1: ~~$72.67~~ → $85.50 (+$12.83)"). Then she confirms or cancels.
- Her discounts come off after the family discount: $95 → $80.75 → a 10% scholarship takes $8.08 → $72.67.
- Every refresh that changes amounts is logged.

**By file**
- `drizzle/0007_family_discount.sql` (+ `meta/0007_snapshot.json`, `_journal.json`): adds `installment.regular_amount_cents`, the month's price before the 15%, and fills it in for existing rows (see Decisions).
- `src/server/db/schema.ts`: the new column. Also an optional `regularAmountCents` on the order's locked-in schedule.
- `src/lib/pricing.ts`: `familyDiscounted()` takes the 15% off and rounds the cent in the family's favor. Checkout's monthly installments use it and carry their regular price.
- `src/lib/adjustments.ts`: `FAMILY_DISCOUNT_LABEL`, `familyDiscountCents()` and `discountLines()` (the family discount first, then staff lines).
- `src/server/family-discount.ts` (new):
  - `countingEnrollments` decides what counts.
  - `refreshFamilyDiscount(tx, householdId, …)` locks the family's unpaid payments (`FOR UPDATE`) and sets each changeable one's `baseAmountCents` from its regular price. It then re-applies staff adjustments with `computeChanges`, as `reapply` does, and settles a failed month that comes to $0.
  - `refreshFamilyDiscountNow` and `refreshAllFamilyDiscounts` wrap it, with the audit log entry.
  - Two previews: `previewEnrollmentEffect` for the review page and `previewStopEffect` for staff.
- `src/server/family.ts`:
  - `fulfillOrder` refreshes inside its transaction when an enrollment becomes active, which includes "continue after the free class". It stores the regular price.
  - `otherClassEnrollments` (the checkout count) now uses the same counting rule.
  - New `familyDiscountEffect` for the review page.
  - `createDraftOrder` and `checkPicks` are untouched.
- `src/server/billing.ts`:
  - `runBilling` refreshes every family before reapplying staff adjustments and before charging.
  - `stopRemainingPayments` runs in a transaction, refreshes the family, and now returns `{ stopped, familyDiscount }`.
  - `adjustmentNote` and `chargeDescription` name the family discount.
- `src/server/payments.ts`: only the pay-now line item's description changes, so it names the family discount. The amount and how Stripe is called are unchanged.
- Pages:
  - `account/index.astro` and `account/pay/[id].astro`: the family discount line and the note.
  - `enroll/review.astro`: the sentence.
  - `admin/billing/[orderId].astro`: the Regular / Family 15% / Staff discounts columns.
  - `admin/billing.astro`: the two-step Stop payments. Long class names now wrap, which fixes a 28 px sideways scroll at 390 px that was there before this change.
- Docs:
  - `docs/portal.md`: a new "Family discount" section, plus updates to the billing rules, withdrawals, adjustments and the code map.
  - `docs/staff-billing.md`: a plain-words section for Hannah, and Stop payments.
- Tests:
  - New `tests/unit/family-discount.test.ts` (12 tests).
  - `pricing.test.ts` and `billing.test.ts`: two assertions follow the new fields and return value.
  - `tests/e2e/trial-journey.mjs`: Ava's later months are now expected at $80.75. The comments in the test explain why.

## Proof

All commands were run with `STRIPE_SECRET_KEY= PUBLIC_STRIPE_PUBLISHABLE_KEY= STRIPE_WEBHOOK_SECRET=` blanked.

- `npm run check`: 0 errors, 0 warnings.
- `npm test`: 12 files, **318 tests pass**. The new tests in `family-discount.test.ts` cover:
  - 15% rounding in the family's favor ($99.90 → $84.91), and the line order and charge description;
  - the second child, monthly, lowers the first child's three months from $95 to $80.75. The review-page preview shows it first and saves nothing. Logged;
  - Ben continues after the free class and pays the season, which lowers Ava's months. A trial sibling doesn't count;
  - paid and processing months are untouched. A failed month with the pay-now form open is skipped, then caught up by the billing run 3 hours later and charged $80.75 with "(Family discount (15%): −$14.25)";
  - a season paid in full counts and isn't changed;
  - trial and waitlisted siblings don't count;
  - Parents' Night Out and a camp don't count;
  - two children in one order: $161.50 a month, as before, with nothing changed after checkout;
  - Stop payments: the preview lists Ava's Nov and Dec going from $80.75 to $95. After stopping, only the unpaid months go back up, October stays $80.75 paid, and the next run charges $95;
  - a class that ends: on Jan 1 the billing run puts the other class back to $115;
  - with a 10% staff discount: $72.67, and the charges' amounts and descriptions are checked.
- `npm run build`: builds.
- Browser tests on a fresh local database (`tests/e2e/serve.sh`), in order, on the final build:
  - `enroll-journey.mjs`: **passes unchanged**. Maya is the only child, so nothing changes for her, and the $40 scholarship flow is intact.
  - `trial-journey.mjs`: **passes**. Ben's season review says "Ava’s remaining monthly payments also drop to $80.75." The account lists Ava's 2 later months at $80.75 with "Family discount (15%): −$14.25". The Nov 1 billing run charges $80.75 with a receipt naming it. The 390 px checks pass, and the season review page is now checked at 390 px too.
  - `content-editor.mjs`: **passes**.
- **Billing script.** On the same local database, a family was added: Ava in Intro to Theater, monthly, with Hannah's 10% "Scholarship" every month; then Ben in Performance Troupe, monthly. Then `npm run -s billing:run -- --today 2026-11-01`:
  ```
  [test charge] $97.75 · November tuition: Ben, LC/Geode Performance Troupe (Family discount (15%): −$17.25)
  [test charge] $72.67 · November tuition: Ava, Intro to Theater (Family discount (15%): −$14.25, Scholarship: −$8.08)
  { today: '2026-11-01', lateFees: 0, due: 2, charged: 2, pending: 0, failed: 0, errors: 0, remaining: 0 }
  ```
  These match. Ben: $115 − 15% = $97.75. Ava: $95 − 15% = $80.75, less 10% ($8.075, rounded up to $8.08) = $72.67. Before Ben joined, Ava's months were $85.50 ($95 less $9.50).
- **Migration backfill.** A database was migrated to 0006, given three old-style payments, then migrated to 0007. Results:
  - one child, no 15%, with a $40 staff discount: regular $95;
  - two children with 15% at checkout ($161.50): regular $190;
  - a $115 class with 15% ($97.75): regular $115.
- **Screenshots** (`.orchestration/family-discount/shots/`, desktop and 390 px; no sideways scroll on any page):
  - `trial/t7-review-season*`: the review sentence;
  - `trial/t8-account-continued*`: the account with the family discount lines;
  - `staff-payments-ava*`: the staff payments page with its columns;
  - `staff-stop-check*`: the Stop payments check;
  - `account-family-discount-ended*`: the account after the discount ended.
- No request went to Stripe or any outside service. Every run used the local stand-in.
- CI (`.github/workflows/ci.yml`) runs on the push. I didn't watch its result.

## Decisions

1. **Regular price column, and how it's filled.** `regular_amount_cents` is set from the order's locked-in schedule at checkout, never from the catalog, so a later price edit can't change an existing enrollment.
   - Existing rows: the site isn't live, so they are demo and test data. If the order's checkout lines include the 15% line, regular = round(base / 0.85), which is exact for whole-dollar prices (all current prices). Otherwise regular = base.
   - For an order confirmed but not yet paid when this deploys, regular falls back to the agreed amount. The worst case is in the family's favor.
2. **What counts.** Status `active`, `program.kind === 'class'` (as at checkout today), and the class hasn't ended (`session.endDate >= today`).
   - The end date is the only marker of "a child's enrollment ends". There is no withdrawal status.
   - The checkout count (`otherClassEnrollments`) uses the same rule, so what checkout charges and what the refresh keeps always agree. Small change: a sibling whose class has ended, or whose payments were stopped, no longer gives 15% at checkout.
3. **"Stopped" means the order has a cancelled payment.** Only Stop payments cancels payments. I didn't mark enrollments cancelled: that would change rosters and capacity, and roster changes are on hold for the back-office plan. Simple to switch later.
4. **Rounding.** 15% off with the cent in the family's favor, `familyDiscounted`. Checkout's monthly installments use the same function, so they never disagree by a cent. No current price changes.
5. **The family discount is derived** (regular − base), not stored separately, so it can't drift from the amounts.
6. **Stop payments is check-then-stop** (a server-rendered panel) instead of the browser's confirm box, because a confirm box can't show a table of changes. It works without JavaScript.
7. **The refresh runs inside `fulfillOrder`'s transaction**, so the enrollment and the new amounts commit together. The catalog is read before the transaction, because the embedded database has one connection. The audit entry is written after it: `family_discount.refresh` on the household, by the family, staff, or null for the billing run.
8. **A payment whose class was removed from the catalog** still follows the family discount: it's a monthly class payment. Its enrollment doesn't count, as at checkout today.
9. **`stopRemainingPayments` returns `{ stopped, familyDiscount }`** instead of a number. Its one caller and its test are updated.
10. **On `/admin/billing`, long words in table cells now wrap** (`overflow-wrap: anywhere`). The page scrolled sideways by 28 px at 390 px with "LC/Geode Performance Troupe" before this change. My panel's buttons use their own class, because the site-wide `.actions` (the editor's sticky save bar) leaks into this page.

## Open points

1. **For Hannah: when a family drops below two, their unpaid months go back up.** Staff see it before confirming Stop payments. The family sees new amounts and a note in their account, and the next receipt. They get no email at the moment the amount goes up.
   - *Recommendation:* add a short email to the family when Stop payments raises another child's payments ("Ava's remaining payments are now $95, because the family discount needs two or more enrolled"), so nobody is surprised on the 1st. I didn't build it; it's a small follow-up.
2. **A child who paid the season in full and then withdraws** keeps counting until their class ends: Stop payments has nothing to stop, and there's no withdraw action yet. Their sibling keeps the 15% (in the family's favor).
   - *Recommendation:* fine for launch. Handle it with the back-office "withdraw" action.
3. **Geode Adult Improv nights** (single $25 drop-ins) are `kind: class`, so they count as a weekly class, as they did before this change. An adult drop-in would give a child's class 15% off for as long as the night hasn't passed.
   - *Recommendation:* count only month-priced classes. Hannah to confirm before I change the published behavior.
4. **Should families get an email when the discount starts?**
   - *Recommendation:* no. The review page tells them before they pay, and receipts and the account show it.

## Follow-up candidates

- The review page's plan card still says "Pay for the season in full: $252.06 today, 10% off" when the 15% applies. That copy predates this unit.
- The order confirmation email's autopay line gives the amounts at checkout and doesn't mention the other child's lower months.
- The checkout discount line for the first month (paid at checkout) still rounds the 15% to the nearest cent, not in the family's favor. This makes no difference for whole-dollar prices.
- The site-wide `.actions` save-bar style still leaks into `/admin/billing`'s table cells (sticky positioning, negative margins). I only fixed the overflow.
- A browser test for Stop payments' check step. It's covered by unit tests and was checked in the browser by hand (the screenshots).
- CI still doesn't run the browser tests.

## Handoff

- **Migration number:** `0007_family_discount`. If another unit also adds a 0007, renumber one of them and regenerate the drizzle meta snapshot.
- **`src/server/family.ts`:**
  - my changes are the import, `otherClassEnrollments`, a new `familyDiscountEffect` right after `priceOrder`, and `fulfillOrder`;
  - `createDraftOrder` and `checkPicks` are untouched, so the class-dates unit should merge cleanly. If it changes `priceOrder`'s return shape, `familyDiscountEffect` reads only `program`, `plan` and `students`.
- **`/admin/billing`:** anything posting `action=stop` still stops directly. The page's buttons now post `action=check-stop` first.
- **Seed and drafts:** no seed wording or `src/content/seo-draft/` changes, so `seo:review` doesn't need re-running.

Compaction: none occurred.
