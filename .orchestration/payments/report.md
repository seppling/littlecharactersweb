# Payments unit: report

Branch `claude/bo-payments`. No compaction or restart happened during this unit.

## Result

### By file
- `src/server/payments-admin.ts` (new): the reads the Payments pages need (`paymentsAttention`, `upcomingAutopay`, `upcomingCharges`, `byDate`, `autopayFamilies`, `paymentsReceived`), `sendPayLink`, staff wording for failures (`staffReason`, `nextStep`), the three download tables, and `paymentsDownload`.
- `src/server/billing.ts`: the only change is that the "pay now" email moved into `sendPayLinkEmail(i, today)`. `markInstallmentFailed` calls it. `notify` now returns how many parents it emailed. Nothing else changed: no amounts, no schedule, no late fee, no billing run, no Stripe calls.
- `src/pages/admin/payments/index.astro` (rewritten): titled "Payments". It has view chips (Everything / Needs attention / Upcoming autopay) and four sections:
  - **Needs attention:** the family links to the family's page; the item shows the month and class, the amount with any late fee, days overdue, the reason, the next try and "Pay link sent <date>". Buttons: Send a pay link, Paid by cash/check, Waive late fee, and the two-step Stop payments.
  - **Upcoming autopay:** grouped by date, with a total per date.
  - **Families on autopay:** links to the family's page and to Payments & discounts, plus Stop payments.
  - **Payments received:** a month picker (previous/next links and a month box).

  Buttons redirect back to the page with `?done=`, so reloading never repeats an action.
- `src/pages/admin/payments/[orderId].astro`:
  - The title is "<family>: <class>", with a **Family page** button.
  - The breadcrumb is removed, so the shell's back link is the only one.
  - Failure reasons use the staff wording.
  - On phones, buttons stay on one line and the choice chips and toggle are 44 px.
  - The discount code is unchanged.
- `src/pages/admin/payments.csv.ts`, `payments.pdf.ts` (new): the Payments List for `?month=`, the Overdue List (`?show=failed`) and Upcoming Autopay (`?show=upcoming`, next 90 days). Each needs a fresh sign-in and is written to the audit log.
- `src/pages/dev/fail-charge.ts` (new, development only, staff only): declines an order's next scheduled charge through the real `markInstallmentFailed`, for the browser test.
- `src/lib/admin-links.ts`: `payments(show?, month?)`. The extra parameter is optional, so existing calls are unchanged.
- Tests:
  - `tests/unit/payments-admin.test.ts` (new);
  - `tests/unit/admin-links.test.ts`: +2 lines;
  - `tests/e2e/staff-payments.mjs` (new);
  - `tests/e2e/enroll-journey.mjs`: 2 lines changed, because they checked the old page's "Monthly autopay" title and "Next: … 1 charge, $95" heading. They now check "Payments" and the upcoming day's "1 charge · $95".
- Docs: `staff-billing.md` (a new "The Payments page" section for Hannah, and the renamed places), `back-office.md` §11 and the link table, `portal.md`, `README.md` (the new browser test).

### For Hannah
- **One "Payments" page, with the same name as its tab.** Failed charges come first. Each has **Send a pay link**, which emails the family the same "pay now" message and then shows "Pay link sent Oct 19" on the item.
- **Clearer sections:** upcoming autopay by date with totals, and a new list of payments received by month, with how each was paid ("Card" or "Cash or check, marked by Hannah Eppling").
- **Three downloads:** the Overdue List, Upcoming Autopay and the Payments List, as CSV or PDF.
- **Works on her phone:** no sideways scrolling, no buttons broken mid-word, 44 px targets, and no black line from the editor's save bar.

### For families
- Nothing changes in what they're charged or when.
- They may now get the "pay now" email again when Hannah sends a pay link. It has the same words as the one a failed charge sends.

## Proof

- **Types:** `npm run check` showed 0 errors and 0 warnings (the 9 hints were there before).
- **Unit tests:** `npm test` passed all 534 tests in 27 files. The existing tests are unchanged. The new `payments-admin.test.ts` proves:
  - a failed charge's email, word for word, with a pinned text, goes to both parents;
  - `sendPayLink` sends exactly the same emails (`toEqual`) and writes one audit row with Hannah's id;
  - `markInstallmentFailed` still emails the pay link itself;
  - no email is sent for a paid or scheduled month;
  - payments received are grouped by month (Athens time, checked at 11:30 PM on Oct 31), with "card" or "cash or check, marked by Hannah Eppling";
  - the upcoming grouping, totals and date range, the Needs attention fields, and the download rows.
- **Build:** `npm run build` succeeded.
- **Browser tests:** `npm run build && tests/e2e/serve.sh`, then the 8 existing tests in order, all exit 0, then `staff-payments.mjs`, exit 0.
  - Before my change, on the unchanged code, the same 8 tests also passed.
  - `staff-payments.mjs` checks:
    - a declined charge shows under Needs attention, with the family link, amount, reason and next try;
    - "Send a pay link" adds the same "pay now" email to `/dev/mailbox` (1 → 2), shows "Pay link sent Oct 19", and a reload doesn't send it again;
    - `?show=failed` and `?show=upcoming` each show only their section;
    - each upcoming date's total equals the sum of its rows;
    - Payments received defaults to this month and its total adds up; the previous-month link and the month box both work;
    - Paid by cash/check moves the charge from Needs attention to Payments received;
    - after the session is aged 20 minutes, the Overdue CSV goes to the confirm page and downloads after a new code; all three CSVs and PDFs download;
    - the order page has the right title, the family link, no breadcrumb, the back link to Payments on a phone, and Add a discount;
    - at 390 px, both pages and `?show=failed` have no sideways scrolling, no button that wraps onto two lines, and every link, button and field is at least 44 px tall;
    - a signed-in parent gets 404 on every Payments address, the pay-link post and `/dev/fail-charge`;
    - there are no page errors.
- **Billing script, with the Stripe keys blanked:** `APP_ENV=development PGLITE_DIR=<copy> npm run -s billing:run -- --today <date>`. The before run used the unchanged code on the database snapshot taken after the 8 journeys. The after runs used the new code on the same snapshot, and on a second snapshot made by the new code's own journey run.

  | Run | `--today 2026-11-01` | `--today 2026-12-01` |
  |---|---|---|
  | Before (old code) | due 0, charged 0 | $80.75 (Ava, family 15%) and $55 (Maya, scholarship); due 2, charged 2 |
  | After (new code, same snapshot) | due 0, charged 0 | the same two charges |
  | After (new code, its own snapshot) | due 0, charged 0 | the same two charges |

  Nov 1 charges nothing because the journeys already run billing for Nov 1. I added the Dec 1 run so the comparison covers real charges.
- **Screenshots** in `.orchestration/payments/shots/`:
  - `payments-everything-desktop.png` and `-390.png`;
  - `payments-failed-desktop.png` and `-390.png`;
  - `payments-upcoming-desktop.png`;
  - `order-desktop.png` and `order-390.png`.

  The bottom tab bar shows partway down the full-page phone shots because it is fixed to the screen. That is how the screenshot tool draws it, not a layout bug.

## Decisions

- **The pay link email is shared through `sendPayLinkEmail`, a thin wrapper on the existing `notify(i, 'failed')`.** Both paths therefore run the very same code. It's the smallest change to `billing.ts`.
- **Needs attention uses `billingOverview().needsAttention` (failed and charging).** It matches Today's count. Charges in progress show without buttons, since cash/check and stop wouldn't apply to them.
- **"Pay link sent" shows only links staff sent,** read from the audit log (`installment.pay_link_sent`). The automatic emails are described in the page's text instead.
- **Failure reasons have staff wording** ("Card declined", "No card on file"). `failureReason` is written to the family ("your bank…") and stays as it is for emails.
- **Buttons use post, redirect, get (`?done=`).** A reload can't send a second pay link or repeat an action. Stop payments keeps its check step, which renders in place.
- **Stop payments on Families on autopay instead of each upcoming row.** Upcoming now spans three months, so a button per row would repeat it for the same class.
- **Payments received:**
  - It counts paid installments with an amount over $0, plus paid orders over $0.
  - Months a discount covered completely are left out, because nothing came in.
  - Sign-ups are always "Card", because only Stripe (or the local stand-in) pays orders.
  - Cash/check is recognised by billing's existing marker (`lastError = 'paid outside Stripe'`), with who marked it from the audit log.
  - Months are in Athens time.
- **Download amounts are plain numbers ("80.75") under "Amount ($)",** so a spreadsheet can add them. The PDF subtitle carries the count and total.
- **One pair of download endpoints** (`payments.csv.ts`, `payments.pdf.ts`) chooses the list with `?show=` or `?month=`. This follows `downloads(listPath)`, which the existing admin-links test already expected for `payments('failed')`.
- **A dev-only `/dev/fail-charge` route** creates the failed charge in the browser test. The local stand-in never declines, and the server holds the only database connection. It's like `/dev/age-session`: 404 in production and for non-staff.
- **Downloads write `admin.download.csv|pdf`** (entity `list`, id `payments-<list>`), like the family downloads, because they hold children's first names (in the month labels).
- **The `.actions` class was renamed `.pay-actions`** on these pages. `admin.css` was not touched.

## Open points

- **Should "Pay link sent" also count the automatic emails a failed charge sends?** Recommended: no. The page already says families are emailed at each failure, and the line is meant to show what staff did.
- **Should Send a pay link also pause the automatic retries?** Recommended: no, which is what this unit does. Retries keep running, and the family's pay-now page pauses them itself when they open it.

## Follow-up candidates

- A "who's been sent what" history on the family's page, read from `installment.pay_link_sent`.
- Refunds: the page still points to the Stripe dashboard.
- The Today unit could link its failed-payments count to `payments('failed')`. That address now shows only Needs attention.

## Handoff

- **Routes:** `/admin/payments` (`?show=failed|upcoming`, `?month=YYYY-MM`), `/admin/payments/<orderId>`, `/admin/payments.csv` and `/admin/payments.pdf` (the same parameters), and `POST /dev/fail-charge` (development only).
- **Links:** `payments(show?, month?)`. `downloads(payments('failed'))` is the Overdue List, `downloads(payments('upcoming'))` is Upcoming Autopay, and `downloads(payments(undefined, month))` is the Payments List.
- **Functions (`src/server/payments-admin.ts`):**
  - `paymentsAttention(today)` → `AttentionItem[]` `{ id, orderId, householdId, family, sessionId, label, dueDate, status, amountCents, lateFeeCents, reason, attempts, retryOn, held, daysOverdue, payLinkSentAt }`;
  - `sendPayLink(installmentId, staffId, today?)` → the number of parents emailed, or null;
  - `upcomingAutopay(today)` → `{ nextDue, through, days: { date, charges, totalCents }[] }`;
  - `upcomingCharges(from, through)`;
  - `autopayFamilies()` → `{ orderId, householdId, sessionId, family, remaining, adjusted, next }[]`;
  - `paymentsReceived(month)` → `{ key, paidAt, householdId, family, sessionId, orderId, what, amountCents, method: 'card'|'staff', markedBy }[]`;
  - `staffReason(code)`, `nextStep(item)`, `receivedMonth`, `shiftMonth`, `monthName`.
- **`billing.ts`:** `sendPayLinkEmail(installment, today?)` returns the number of parents emailed. `billingOverview` is unchanged.
- **Audit actions:** `installment.pay_link_sent` (staff id, installment id), and `admin.download.csv|pdf` with list ids `payments-received|overdue|upcoming`.
- **Data markers for tests:** `[data-attention]`, `[data-attention-item=<installmentId>]`, `[data-pay-link-sent]`, `[data-upcoming]`, `[data-upcoming-day=<date>]`, `[data-day-total]`, `[data-families]`, `[data-received]`, `[data-received-list]`, `[data-received-total]`, `[data-month-picker]`, `[data-month-prev]`, `[data-month-next]`, `[data-views]`, `[data-notice]`, and `[data-family-link]` on the order page.
