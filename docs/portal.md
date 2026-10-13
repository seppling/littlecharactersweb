# Family portal

Enrolling feels like part of the website, not a trip to another app. Families go **Discovery → Selection → Enrollment → Payment → Confirmation** on `littlecharacters.org` without creating a password, and returning families skip straight to picking which child is coming.

**Status (Sep 2026):** built and tested end to end in development, with Stripe in test mode. Before real families use it, it needs:
- hosting and keys (`infrastructure.md`)
- the Studio Director import
- the billing decisions in `todo.md`

## The journey

| Step | URL | What the family sees |
|---|---|---|
| Discovery | `/programs`, `/programs/<slug>` | Static pages: age-first finder, times, prices, "ends in a show". Each weekly class page says what joining now costs one new student, today and after ("Joining now, per student", `joiningNow` in `src/lib/pricing.ts`, from the same quote as checkout). The header says "Hi, Sam" if this browser has signed in before. |
| Selection | `/enroll/<sessionId>` | **Signed out:** email → 6-digit code, typed in the same tab, so there's no trip to the inbox and back. First time: name and phone, then add a child. **Signed in:** saved children as checkboxes with an age-fit badge; enrolled ones, and children outside the class's ages ("Ages 7–10. Maya is 5." with an **Ask us** link to the contact form), are greyed out and can't be picked; after a free trial, "continue". The server refuses the same children (`pickProblem` in `src/server/family.ts`) when the order is started and again when it's confirmed. A date that can't be booked (past, past its sign-up cut-off, or closed by staff; `src/lib/session-dates.ts`) gets a "Sign-ups are closed" page with a link back to the class, at this step and at every later step of an unpaid order; the server refuses it too (`checkBookable`). A payment already handed to Stripe is honoured. |
| Details | `/enroll/details` | Per child: allergies, medical notes (encrypted), pickup people, photo consent. Details confirmed within the past year show as a one-line summary with **Edit** instead of the form (`src/lib/student-details.ts`); older or missing details get the form. Then a 3-bullet policy summary with one checkbox. |
| Review | `/enroll/review` | Plan choice with live totals (free first class, pre-selected for new students · monthly · pay in full · waitlist), an itemized bill with class counts, what's due later, discounts applied automatically, and "Enroll another child or class" (back to the class finder with the age the family last chose there). |
| Payment | `/enroll/pay` | Stripe's card form embedded in the page. Apple Pay and Google Pay appear automatically. Cards are saved for monthly tuition. |
| Confirmation | `/enroll/confirmation` | "You're in!", the first class date, time and place, **Add to calendar** (`.ics`), what to bring, and a confirmation email to every parent in the household (it says when this sign-up lowered another child's monthly payments). When the family signed up more than once today, or has other autopay, a **Your family** box adds up today's payments and the autopay total on the next 1st, read from the family's orders and payments (`familyTotals`). **Enroll another child or class** goes back to the finder. |
| Account | `/account` | Coming up (next class per child), students and their care-details status, **upcoming autopay charges**, anything that needs paying, receipts, sign out. Signed in for 90 days, renewed on each visit. |
| Pay now | `/account/pay/<id>` | Linked from a "we couldn't charge your card" email: pay that month with any card, which also becomes the saved card. |
| Staff | `/admin`, `/admin/<sessionId>` | For `ADMIN_EMAILS` only: counts per class, and rosters with ages, allergies, medical notes, pickup, photo consent and parent contacts. Every view is logged. |
| Staff billing | `/admin/billing` | Failed charges that need a person, the next autopay date and total, **Paid by cash/check**, **Stop payments** when a family withdraws, and every family on monthly autopay. |
| Family payments | `/admin/billing/<orderId>` | One family's monthly payments for one class, and **discounts** (staff adjustments) on them. See below and `staff-billing.md`. |

The Enroll buttons on every page go through one switch: `site.portal.mode` in `src/config/site.ts`.
- `'native'` sends families to this portal.
- `'studio-director'` sends them to Studio Director.

Partner programs with their own registration (a school's system) keep linking out. Google Forms programs (Parents' Night Out, adult improv) now use this checkout.

## Billing rules

Implemented in `src/lib/pricing.ts` (pure functions, unit-tested in `tests/unit/pricing.test.ts`):

- **Monthly classes:** the first month is due at registration. The rest are **charged automatically to the saved card on the 1st** (see Monthly autopay below). Joining more than 7 days into the term prorates the first month by the meetings left.
- **A class that starts mid-month** (decided Oct 13, 2026): its first month is charged for the classes in it, classes that month ÷ the times the class's day falls in that calendar month. Acting Studio from Tue Oct 20 is 2 of October's 4 Tuesdays, $47.50. Late joiners are prorated as before. Each tuition line says how many classes it pays for ("Ava: October tuition, 3 classes (prorated)"). Only the first month is affected; a last month that ends mid-month is still a full month.
- **Classes priced per session** (Stories and Songs, the Homeschool Class): one price for the whole session, shown as "$160 for 9 weeks ($17.78 a class)", counted from the session's real meetings (`sessionPriceParts`). Joining more than 7 days in, or staying on after the free first class, pays for the classes left: classes left ÷ classes in the session × the price, plus the one-time fee.
- **Pay in full:** 10% off the term.
- **Multiple classes or students:** 15% off tuition, the cent rounded in the family's favor. **Discounts don't stack**; the bigger one applies (`PRICING.stackDiscounts`). The review page's season-in-full line names the discount it really gets and says when paying up front costs the same as paying monthly (`planCopy`). **Drop-in nights** (one-date sessions such as Geode Adult Improv) never get the 15%, even with two people in one sign-up. Since Oct 13, 2026 it covers the **whole family**: once a family has two or more active weekly-class enrollments, all their remaining monthly payments for weekly classes are 15% off, whatever order the children signed up in (see Family discount below).
- **One-time fees** (performance, materials): per student, at registration.
- **Free first class** for new students in Little Characters weekly classes, monthly or priced per session (since Oct 13, 2026, Stories and Songs too; not Geode, not drop-in nights). The review page **starts on it** for new students (`defaultPlan`); monthly and the season stay one tap away, and students who already had their free class start on monthly. Nothing is due, and "Continue after the trial" on the account page leads to paid tuition in the same spot. One free class per student. A brother or sister already in the same class counts for the multi-student discount, so siblings who continue one at a time still get it, and the first one's later months drop too.
- **Per-child pricing:** Parents' Night Out is $30 for the first child and $10 for each additional.
- **Capacity:** default 20 per class (override per session). When full, the only option is the waitlist, with nothing due.
- **Price conflicts** on the old site resolved to the monthly price.

**Not built yet** (decide first, see `todo.md`):
- The "paused from class after the 15th" rule. Staff can see unpaid months on `/admin/billing`.
- A self-serve "update my card" button. Today a family pays a failed month with a new card (which becomes the saved card), or emails us.
- Payment-method surcharges. We recommend dropping these: Stripe's ACH is 0.8%, and card surcharges carry disclosure rules.
- Waitlist offer emails.
- Reminders before the first class.
- Refunds and transfers. Use the Stripe dashboard for now.

## Monthly autopay

Decided Sep 2026: charge monthly tuition automatically on the 1st, retry failed charges on the 4th and 7th, and add a $15 late fee to months still unpaid on the 11th.

**What the family agrees to.**
- The review page states it plainly: "$95 today, then charged automatically on the 1st of each month", plus the exact months.
- A consent line under the pay button authorizes saving the card and charging it through the end of the term.
- Stripe's card form adds its own "save this card" notice.
- The policy summary says the same, and `POLICY_VERSION` records which wording each family agreed to.

**How it works** (`src/server/billing.ts`):
1. At checkout, the remaining months are locked in on the order (dates, amounts, discounts), and the card is saved with Stripe (`setup_future_usage: off_session`).
2. When the first payment succeeds, each remaining month becomes an `installment` row, due on the 1st.
3. Every morning a scheduler (`.github/workflows/billing.yml`, or the host's cron) calls `POST /api/billing/run`. The site charges what's due to the saved card, then emails a receipt.
4. **A failed charge** emails the family a link to pay with any card, and is retried automatically on the 4th and the 7th.
   - Cards whose bank insists on approval by the cardholder (3-D Secure) aren't retried; only the family can finish those.
   - After 3 tries it waits for the family and shows on `/admin/billing`.
   - The failure email says to pay by the 10th to avoid the late fee.
5. **Late fee** (decided Sep 2026): a month still unpaid on the **11th** gets a one-time **$15** fee, added by that morning's run.
   - The family is emailed the new total and a pay link. The next charge or payment collects tuition and fee together.
   - A family who opened "pay now" before the 11th and pays the tuition alone isn't charged the fee.
   - Staff can **Waive late fee** on `/admin/billing`.
6. **Withdrawals:** staff click **Stop payments**, check what changes (including any family discount that ends), then confirm. The remaining months are cancelled. Refunds are issued in the Stripe dashboard.

**Never charges twice.**
- Each charge is claimed in the database before Stripe is called.
- The payment's id is saved before it's confirmed, so a run that crashes halfway is finished (not repeated) by the next one.
- Stripe gets an idempotency key per attempt.
- While a family has the pay-now form open, automatic retries pause; they resume if the form expires unused.

All of this is covered by unit tests (`tests/unit/billing.test.ts`), including two runs overlapping.

**Tested with Stripe (test mode, Sep 25 2026).** Three families with Stripe's test cards, charged by the real billing run:

| Test card | Oct 1 | Oct 4 | Oct 7 | Oct 11 |
|---|---|---|---|---|
| 4242 (works) | charged $95, receipt emailed | — | — | — |
| 0341 (declines) | declined, email with pay link | retried, declined | retried, declined, waits for family | $15 late fee, email |
| 3184 (needs cardholder approval) | failed, email with pay link | not retried | not retried | $15 late fee, email |

- "Pay now" created a Stripe checkout for $110 ($95 tuition + $15 late fee as its own line).
- Stripe's webhooks (`payment_intent.succeeded`, `checkout.session.expired`) arrived through the Stripe CLI, passed signature checks and returned 200.
- Not covered here: typing a card into Stripe's form in a browser. That's Stripe's own page, and it doesn't load reliably through this development environment's network proxy. Do one real test enrollment on the preview site before launch.

**Why not Stripe subscriptions?** Stripe Billing would do the scheduling and retries, but:
- it adds 0.7% of billing volume on top of card fees;
- our discounts, proration and term end dates would have to be rebuilt as Stripe coupons and schedules.

Charging saved cards directly keeps the pricing rules in one place (`src/lib/pricing.ts`) and costs only the normal card fee.

## Staff discounts (adjustments)

Decided Oct 13, 2026 (Stephen and Hannah): staff give one family a discount on their monthly payments, for scholarships, pay-what-you-can, deals and credits. No Stripe coupons or promo codes: the site works out each charge and Stripe only collects it. Hannah's guide is `staff-billing.md`.

**What an adjustment is** (`billing_adjustment`, `src/server/adjustments.ts`, math in `src/lib/adjustments.ts`):
- one order (a family's class), a percentage (whole, 1–100) or a dollar amount, **once** (the next payment that can change, chosen when it's added) or **every month** (every unpaid one);
- a required reason, private to staff unless **shown to the family**; who added it and when; who removed it and when. Rows are never deleted.

**How it's applied.**
- Each `installment` keeps `regularAmountCents` (the month's price, fixed at checkout) and `baseAmountCents` (the regular price less the 15% family discount when it applies; see below). `amountCents`, which autopay, pay-now and receipts use, is the base less the adjustments in force, and `adjustments` lists them as the family sees them ("Scholarship: −$40").
- After the 15% family discount, in the order added; a percentage comes off what's left. The cent rounds in the family's favor. Never below $0, and a remainder under 50¢ (Stripe's minimum) is taken off too.
- Tuition only: the late fee is added on top and never discounted.
- Adding or removing recomputes the order's payments from scratch, so removing restores what it took off the unpaid ones.
- A season paid in full has no later payments; its 10% (or 15%) was taken at checkout.

**Which payments change.**
- `scheduled`: yes. `failed`: yes; the next retry or pay-now form charges the new amount.
- Not while the family may have the pay-now form open (opened in the last 2 hours, `payNowOpenedAt`): Stripe's form holds the old amount, and a payment that doesn't match isn't counted. The daily billing run catches such a month up before charging it.
- `processing` (the payment already exists in Stripe), `paid`, `cancelled`: never. A paid month keeps the adjustments it was charged with, even after one is removed.
- A month at $0 isn't sent to Stripe: the run marks it paid and emails "Nothing to pay". A failed month brought to $0 with no late fee is settled right away.
- Changes lock the order's payments (`SELECT … FOR UPDATE`), so the billing run can't claim one mid-change.
- Orders paid in full (or one-time) have no later payments, so there's nothing to adjust; give money back as a Stripe refund.

**Access and record.** Only staff (`isAdmin`, checked on the page and again in `src/server/adjustments.ts`). Adding and removing write `adjustment.add` / `adjustment.remove` to `audit_log`. Tested in `tests/unit/adjustments.test.ts` and the end-to-end journey.

## Family discount (15%, whole family)

Decided Oct 13, 2026 (Stephen): the published rule, "15% off for multiple students or classes", applies to the whole family. Before, it was worked out once, when an order was priced, so the child who enrolled second got 15% off and the first child's monthly payments stayed at full price. Hannah's guide is `staff-billing.md`.

**The rule** (`src/server/family-discount.ts`):
- Once a family has **two or more active weekly-class enrollments**, every monthly payment for their weekly classes that can still change is 15% off (`familyDiscounted` in `src/lib/pricing.ts`, the cent rounded in the family's favor).
- **What counts:** enrollments that are `active` in a weekly class with tuition priced by the month or by the session (`isWeeklyTuitionClass` in `src/lib/pricing.ts`; decided Oct 13: classes priced by the session, like Stories & Songs, count too, with no monthly payments of their own to change; drop-in nights like Geode Adult Improv don't), whose class hasn't ended (`session.endDate`), and whose payments staff haven't stopped. Checkout uses the same count for the family's other enrollments; children in the same order still count together, as before. Each child in each class counts once; two children in one order count as two. Not free trials, waitlists, camps, workshops, parties, Parents' Night Out or Ovation.
- A season **paid in full counts**, but isn't changed: no refunds, and its 10% pay-in-full discount still doesn't combine with the 15%.
- **When the family drops below two** (a class ends, or staff stop a child's payments), the remaining payments of their other classes go back to the regular price. Paid months never change. The family is **emailed** the new amounts ("Your family discount has ended", `emailFamilyDiscountEnded`), logged as `family_discount.ended_email`.

**How it's applied.**
- Each payment keeps its regular price (`regularAmountCents`, migration `0007`), fixed at checkout from the order's locked-in schedule, so a later price change in the editor never changes an existing enrollment.
- `refreshFamilyDiscount(tx, householdId, …)` counts the family's enrollments, sets each changeable payment's `baseAmountCents` to the regular price (less 15% when the family qualifies), and re-applies staff adjustments the way `reapply` does, so `amountCents` is always what's charged. It locks the family's unpaid payments (`SELECT … FOR UPDATE`).
- Which payments change: the same as for staff adjustments (`lockedReason`): `scheduled`; `failed` unless the pay-now form was opened in the last 2 hours; never `processing`, `paid` or `cancelled`.
- It runs after an order is fulfilled (including "continue after the free class"), after **Stop payments**, and in the daily billing run before anything is charged (which catches up skipped months and classes that have ended).
- Each refresh that changes amounts writes `family_discount.refresh` (household) to `audit_log`.

**What people see.**
- **Review page:** when the enrollment lowers another child's payments, it says so ("Ava’s remaining monthly payments also drop to $80.75.").
- **Family account, pay-now page, receipts and the card charge:** "Family discount (15%): −$14.25", before any staff discount line. The account also explains when the discount ends.
- **Staff:** the family's payments page (`/admin/billing/<orderId>`) shows the regular price, the family discount and staff discounts in separate columns. **Stop payments** on `/admin/billing` shows which other payments go back up, and by how much, before staff confirm.

Tested in `tests/unit/family-discount.test.ts` and the free-class browser test (`tests/e2e/trial-journey.mjs`).

## Persistent login

1. **No account wall for browsing.** Prices, times and open spots are always public.
2. **Identify at checkout with an emailed code.** An existing email loads the saved family; a new one creates it. There's no separate "sign up".
3. **Stay signed in for 90 days**, renewed once a day while in use, in an `HttpOnly; Secure; SameSite=Lax` cookie on our own domain (`lc.session_token`).
4. **Static pages stay static.** A tiny non-secret hint cookie (`lc_signed_in=1`) tells the header to ask `/api/me` who you are. People who've never signed in make no request at all.

Optional later: passkeys ("Use Face ID next time") and a fresh code before staff open rosters. Both are Better Auth plugins.

## Moving families over from Studio Director

**Recommendation: import, then invite.**
- Importing means returning families find their children already set up, and the first sign-in is one code rather than a form.
- The invite is a short "your account is ready" email, sent in batches. It doubles as the migration announcement.
- A pure re-registration campaign (no import) is simpler but asks every family to retype what you already have, and some won't.

### Steps

1. **Export from Studio Director** as CSV: families (parent names, emails, phones) and students (names, birthdays, allergies and medical notes). One combined roster works too.
   - Skip anything we don't use (addresses, balances, notes fields you don't need).
   - Save the files somewhere private, like `imports/`, which git ignores.
2. **Preview** (writes nothing). This shows which columns it recognized and lists any rows to fix:
   ```bash
   DATABASE_URL=… DATA_ENCRYPTION_KEY=… npm run import:studio-director -- imports/families.csv imports/students.csv
   ```
   - If a column isn't recognized, point a field at it, e.g. `--map email="Primary Email"`.
   - Rows without a parent email are skipped; those families can sign up fresh.
3. **Import:** run the same command with `--commit`. Re-running is safe: existing parents and children are matched, not duplicated. Then **delete the CSVs**.
4. **Invite** in batches (Resend's free tier sends 100 a day):
   ```bash
   npm run invite:imported              # how many are waiting
   npm run invite:imported -- --send 50
   ```
   - Each parent is emailed once, and only while they haven't signed in.
   - The email explains the move, how to sign in, and asks them to check their children's details.
   - It isn't marketing. It still gives a reply-to address and offers deletion on request.
5. **Run both systems for one term.** Current classes stay in Studio Director until they end; new enrollments go only to the new portal.

Imported accounts are **unverified until claimed**: nobody can use one without a code sent to that email. Imported care notes are encrypted and marked "please confirm", so each family re-checks them on their next enrollment.

## Code map

```
src/server/
  env.ts            configuration; fails closed in production
  db/schema.ts      tables: Better Auth (user, session, verification, rate_limit), household,
                    household_member, student, order, enrollment, installment, billing_adjustment, lead, audit_log,
                    dev_email, and site content (content_entry, content_version, media)
  content.ts        site content: cached reads for pages, drafts, publish, history, safeguards
  media.ts          photo uploads: resized once, stored in the database
  auth.ts           Better Auth: email codes, 90-day sessions, rate limits, isAdmin()
  family.ts         household-scoped data access, orders, fulfillment, confirmation email
  payments.ts       Stripe Embedded Checkout, saved-card charges, finishing checkouts
  billing.ts        monthly autopay: daily run, retries, pay now, staff tools
  adjustments.ts    staff discounts on a family's monthly payments
  family-discount.ts  the 15% family discount across all of a family's weekly classes
  crypto.ts         field encryption for care notes
  email.ts          Resend, or the dev mailbox at /dev/mailbox
  admin.ts          rosters (logged)
  studio-director.ts  CSV import + invitations
src/lib/pricing.ts  every billing rule, pure and tested
src/pages/enroll/   the journey;  src/pages/account/  dashboard;  src/pages/admin/  staff pages and the content editor
src/pages/api/      auth, /api/me, Stripe webhook, /api/billing/run (daily autopay)
drizzle/            SQL migrations (npm run db:generate after schema changes)
tests/unit/         pricing, autopay, import, access control, content editing (npm test)
tests/e2e/          the full journey, the free first class (trial-journey.mjs), staff editing the site, and the menus and class finder (navigation.mjs), in a real browser
```
