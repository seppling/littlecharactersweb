# Drop-ins unit: report

Branch `claude/bo2-drop-ins`, from `claude/blissful-archimedes-enun5m` (acfb1b2). No compaction or restart happened in this session.

## Result

A family can book and pay for one date of a weekly class. The child is on that day's roster with a **Drop-in** badge, and Hannah can add a drop-in (pay link or no charge) and cancel one. **$25 a class is a placeholder** that Hannah should confirm. She can change it in Site settings → Drop-ins.

**For families**
- A weekly class's page shows a quiet **"Drop in for one class · $25"** link under the sign-up button. It appears once the class has started or starts within 14 days. A class past its sign-up cut-off that is still running gets its own link.
- The flow:
  1. `/drop-in/<session>`: sign in or make an account, then add a child (as enrollment does). Pick a date: days off show "No class that day" and full dates show "Full"; today's class is offered only until it starts. Then pick the child: a child already in the class is greyed out.
  2. The enrollment's details step: care details, the family's part, and drop-in policies.
  3. `/drop-in/pay`: one line, "Drop-in: Intro to Theater, Tue, Oct 20 (Remy)", paid through the existing embedded checkout (the test-payment button locally).
  4. `/drop-in/confirmation`: date, time, place, how to arrive, and "Book another date". A "Drop-in booked" email goes to the parents.
- The family account lists upcoming drop-ins and has a "Drop in for one class" list of weekly classes. Receipts show the order line.
- No discounts, no late fee, and a drop-in never counts toward the 15% family discount.

**For Hannah** (class page)
- **Roster:** "Drop-ins on <date>" picks the date (the next class by default). That day's drop-ins join the roster with the **Drop-in** badge and their care details. The heading reads "Roster (8 + 1 drop-in)".
- **Drop-ins list:** Coming up and Past, each with Date, Child, Family and Paid.
  - Paid says "Paid $25", "No charge: …", "Pay link sent, $25 not paid yet" or "Cancelled: …".
  - **Over the limit** marks a drop-in paid after the date filled up.
  - **Cancel** asks for a reason and says "Refund it in the Stripe dashboard for now".
  - CSV and PDF downloads.
- **Add a drop-in:** find the child, then either
  - **Send a pay link**: the family gets an email, and nothing is held until they pay; or
  - **No charge**: a fresh sign-in, a date and a reason; booked at once with no Stripe call.
- The family's page lists each child's drop-ins.
- Today counts the day's drop-ins in "8 of 12".
- The website editor has the site price and switch (Site settings → Drop-ins), plus a per-session price or "No drop-ins for this class" beside the session's price.

**By file**
- `src/server/drop-ins.ts` (new): prices and which classes, dates, booking, `readyDropIn`, `fulfillDropIn`, the confirmation email, the staff list, the roster for a date, pay link, no charge, cancel and Today's counts.
- `src/pages/drop-in/[sessionId].astro`, `pay.astro`, `confirmation.astro` (new): the family flow.
- `src/pages/admin/classes/[sessionId]/drop-ins.ts`, `drop-ins.csv.ts`, `drop-ins.pdf.ts` (new): a redirect to the list, and its downloads.
- `src/pages/dev/drop-in-day-off.ts` (new): test-only, development only.
- `src/server/family.ts`: `fulfillOrder` hands `drop_in` orders to `fulfillDropIn`. This is one line, after the amount check; the enrollment path is unchanged.
- `src/server/db/schema.ts`: `order.plan` gains `drop_in`. This is a TypeScript enum only; `npm run db:generate` reports "No schema changes".
- `src/content/types.ts`, `pages.ts`, `collections.ts`, `site-content.ts`, `seed/pages.ts`: the settings, `SiteInfo.dropIns`, `dropInSetting`.
- `src/pages/enroll/details.astro`: the drop-in branch (policies, next step, back link; the date is checked on the pay step instead).
- `review.astro`, `pay.astro`, `confirmation.astro`: drop-in orders are sent to the drop-in pages.
- `src/components/portal/EnrollShell.astro`: an optional `dropInCents` that shows "Drop-in: $25 for one class".
- `src/pages/programs/[slug].astro`: the link.
- `src/pages/account/index.astro`: drop-ins and offers; the receipt label.
- `src/pages/admin/classes/[sessionId].astro`: roster date, Add a drop-in, the Drop-ins list.
- `src/pages/admin/families/[householdId].astro`: the Drop-ins table, and the plan label.
- `src/pages/admin/payments/[orderId].astro`, `src/server/payments-admin.ts`: plan labels.
- `src/lib/badges.ts`: the `drop-in` badge (`dropIn` input).
- `src/server/classes.ts`: `RosterChild.dropInId?`.
- `src/server/today.ts`: an optional `dropIns` on `classesOn`, used by `todayClasses`.
- `src/lib/admin-links.ts`: `classDropIns(sessionId)`.
- `src/middleware.ts`: `drop-in` added to the portal paths, so the session is read and the pages aren't cached.
- `src/pages/robots.txt.ts`: `Disallow: /drop-in`.
- Docs: `docs/back-office.md` §18 (plus the link and badge rows), `docs/staff-billing.md` → Drop-ins, and short additions to `docs/portal.md`, `docs/content-editor.md` and `docs/security.md`.
- README: the new browser test is added to the list.
- Tests: `tests/unit/drop-ins.test.ts` (new, 23 tests), `tests/unit/badges.test.ts` (+1), `tests/e2e/staff-drop-ins.mjs` (new).

## Proof

Stripe keys were blanked for every command.

- `npm run check`: 0 errors, 0 warnings.
- `npm test`: 33 files, 642 tests passed (618 before, plus 24).
- `npm run build`: completes.
- `npm run db:generate`: "No schema changes, nothing to migrate".
- Browser tests, all in README order on one fresh database (`tests/e2e/serve.sh`), staff-messages with `SERVER_LOG`: see "Full browser run" below for the final run's outcome.
- Billing check: `.data/e2e` was copied right after enroll-journey and trial-journey, then `APP_ENV=development PGLITE_DIR=<copy> npm run -s billing:run -- --today 2026-12-01` was run.
  - It charged **$80.75** (Ava, family discount) and **$55** (Maya, scholarship): due 2, charged 2, failed 0.
- My first full run failed only in `staff-drop-ins.mjs`. After signing in on `/drop-in/…` the page still showed the sign-in, because the middleware reads the session only on portal paths. I added `drop-in` to them.
  - A phone check then found a 22 px family link in the Drop-ins table; it is now 44 px.
  - The test passed alone on a fresh database before the final full run.
- Unit tests cover:
  - Which classes take drop-ins: weekly only, the site switch, the session's `off`, the override price, and the seed's classes.
  - The dates offered: days off, full dates, already enrolled or booked, and today after the class started.
  - The 15% discount: a drop-in never counts (`countingEnrollments`).
  - The order's line and total, and the Stripe line item.
  - Paying exactly once when two `fulfillOrder` calls arrive together with the same payment. There is one `drop_in.booked` audit entry and no enrollment.
  - A wrong amount books nothing.
  - An abandoned checkout holds no place: it is not in `dropInsOn`, `classDay` or the lists.
  - Booked over the limit, and a second payment for the same child and date (`PAID_TWICE`).
  - Staff: no charge, a full date needing "add anyway", pay link once per token, cancel, the CSV row.
  - Today's "10 of 12".

### Full browser run (final)

See the end of this file.

## Decisions

1. **The content price is in dollars, not cents.** Every other price in the content is dollars, and the editor's money field edits dollars, so Hannah types 25, not 2500.
   - The content is `site.dropIns = { price: 25, open: true }` and `session.dropIn = { price?, off? }`.
   - `SiteInfo.dropIns = { priceCents, open }` gives the code cents.
   - Easy to reverse: rename the fields if the coordinator wants `priceCents` in the content.
2. **The pending row and draft order are written when the family picks the date and child (step 1), not when the checkout opens.** The date has to be stored somewhere through the details step, and the order has no date column. The row is `pending` and holds nothing, so nothing else changes. The pay step checks the date and child again before the checkout.
3. **The details step reuses `/enroll/details`** with a drop-in branch: care details, family details and policies "as enrollment does", without a copy. It skips the late-joining cut-off, since drop-ins are fine after it, and the pay step checks the date instead.
4. **The return from Stripe stays `/enroll/confirmation`.** `createEmbeddedCheckout` is unchanged, and that page sends drop-in orders on to `/drop-in/confirmation` with the same query string. No change to how Stripe is called.
5. **Drop-in policies** reuse wording that already exists rather than inventing business rules: "A drop-in is one class, on the date you picked, paid today. Missed classes aren't refunded." and the door-lock line.
6. **The class page's roster takes a date** (`?date=`, the next class by default). Phase 1's roster had no date, and drop-ins are for one date.
   - Drop-in children are added in the same list with their care details. They are logged as `admin.roster.drop_ins` with the date.
   - They have no Remove; they are cancelled under Drop-ins.
7. **Pay link for a full date: refused. No charge for a full date: "If the date is full, add anyway".** This matches Phase 1, where a family can't pay into a full class.
8. **Over the limit** is worked out when shown, in booking order (paid time, or creation for no charge), against the enrolled count now. There is no stored flag and no migration.
9. **A second payment for a child already booked that date** is kept `cancelled` with "Paid twice for the same date. Refund one in the Stripe dashboard." This honours the unique booked index and never refuses money already taken.
10. **A staff pay link the family pays after Hannah cancelled it is booked anyway**, because the money was taken. The pay page refuses to open a checkout for a cancelled one.
11. **Staff pay links show in the Drop-ins list**: a pending row made by someone outside the family. Families' own unfinished checkouts are hidden.
12. **Which classes:** `isWeeklyTuitionClass`, plus none for registration elsewhere and none while `coming-soon` or `closed`. A "waitlist only" class still takes drop-ins, limited by each date's places.
13. **Ages:** as enrollment, a year either side, else greyed out with "Ask us".
14. **The family account:** a collapsed "Drop in for one class" list (only classes not every child is in) under Coming up. The account has no list of classes to put a link beside.
15. **No confirmation email for a no-charge drop-in**: Hannah adds it and tells the family. A pay link goes by `sendMessage`, so it is on the family's "Emails sent".
16. **Middleware:** `/drop-in` joins the portal paths. This was needed to see who's signed in, and it also gives private, no-store caching. `robots.txt` disallows it.
17. **The test-only day off** (`POST /dev/drop-in-day-off`). Days off are the calendar unit's; this only inserts a `closure` for the browser test.

## Open points

1. **The price.** $25 is a placeholder. *Recommended:* Hannah confirms it, or changes it in Site settings → Drop-ins.
2. **The drop-in policy line** ("Missed classes aren't refunded") is reused from the tuition policies. *Recommended:* Hannah confirms a drop-in isn't refunded when missed, or gives the rule (for example, moving it to another date).
3. **Content field names** (`price` in dollars rather than `priceCents`). *Recommended:* keep dollars, for consistency with every other price in the editor.
4. **`staff-settings.mjs` still says "(last)"** in the README list, since I didn't change others' lines. *Recommended:* drop "(last)" at the merge; `staff-drop-ins.mjs` runs after it.

## Follow-up candidates

- **Calendar unit:** when Hannah adds a day off on a date with booked drop-ins, list them (`dropInsOn`) with "Refund or move".
- **Refunds unit:**
  - a Refund button on a cancelled, paid drop-in (`dropInStatus` already says "(paid $25)");
  - and on `PAID_TWICE` rows.
- **Reports unit:** drop-ins by month and class from `drop_in` (booked, `price_cents`) joined to `order.paid_at`.
- **Nice to have:**
  - several dates or children in one checkout;
  - a "move to another date" for staff;
  - a drop-in reminder email the day before.

## Handoff

- **Routes:**
  - Family flow: `/drop-in/<sessionId>` (step 1), then `/enroll/details?order=` (drop-in branch), then `/drop-in/pay?order=`, then `/drop-in/confirmation?order=` (Stripe's return via `/enroll/confirmation`).
  - Staff: `classDropIns(id)` = `/admin/classes/<id>/drop-ins`, a redirect to the class page's `#drop-ins-h`, with `drop-ins.csv` and `drop-ins.pdf`.
  - Class page query parameters: `?date=YYYY-MM-DD` and `?dropAdd=<studentId>` (back from a fresh sign-in).
- **Functions** (`src/server/drop-ins.ts`):
  - Prices and classes: `dropInPrice`, `dropInsOffered`, `dropInClasses`.
  - Dates: `upcomingMeetings`, `dropInDates` / `dropInDatesFrom`, `rosterDate`.
  - Booking and paying: `startDropIn`, `dropInOrder`, `readyDropIn`, `fulfillDropIn`, `sendDropInConfirmation`, `dropInDetails`.
  - Lists: `familyDropIns`, `classDropIns`, `overLimitIds`, `dropInStatus`, `dropInTable`, `dropInRoster`.
  - Staff: `sendDropInPayLink`, `addDropInWithoutCharge`, `cancelDropIn`.
  - Today and constants: `dropInsToday`, `DROP_IN_LEAD_DAYS`, `PAID_TWICE`.
- **Data shapes:**
  - Order: `plan: 'drop_in'`, one `tuition` line "Drop-in: <class>, <Tue, Oct 20> (<first name>)", total = `drop_in.price_cents`, discount 0, no schedule.
  - `drop_in`:
    - `pending`: an open checkout or pay link; holds nothing.
    - `booked`: paid, or no charge with price 0 and `no_charge_reason`.
    - `cancelled`: with `cancelled_at` and `cancel_reason`.
  - Audit entries:
    - families: `drop_in.booked` and `drop_in.paid_twice` (entity `drop_in`);
    - staff: `admin.drop_in.pay_link`, `admin.drop_in.add_no_charge` and `admin.drop_in.cancel` (detail "<date>: <reason>");
    - roster views: `admin.roster.drop_ins` (entity session, detail the date);
    - downloads: `admin.download.csv|pdf` with id `drop-ins:<sessionId>`.
- **Teacher app:** `dropInRoster(sessionId, date, viewerId)` returns `RosterChild[]` with `dropInId` set, `enrollmentId` empty and the `drop-in` badge. `childBadges` takes `dropIn: true`.
- **Shared files touched with added lines only:**
  - `src/lib/badges.ts`: the `drop-in` key already existed; the doc comment was updated.
  - `src/lib/admin-links.ts`, `src/server/today.ts` (`classesOn` gains an optional last argument), `src/server/classes.ts` (`RosterChild.dropInId?`).
  - The seed, `src/content/types.ts`, the README test list, and `docs/back-office.md` §18.
  - `src/middleware.ts`: one word in `PORTAL`.
