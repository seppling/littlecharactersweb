# Family portal

Enrolling feels like part of the website, not a trip to another app. Families go **Discovery → Selection → Enrollment → Payment → Confirmation** on `littlecharacters.org` without creating a password, and returning families skip straight to picking which child is coming.

**Status (Sep 2026):** built and tested end to end in development, with Stripe in test mode. Before real families use it, it needs:
- hosting and keys (`infrastructure.md`)
- the Studio Director import
- the billing decisions in `todo.md`

## The journey

| Step | URL | What the family sees |
|---|---|---|
| Discovery | `/programs`, `/programs/<slug>` | Static pages: age-first finder, times, prices, "ends in a show". The header says "Hi, Sam" if this browser has signed in before. |
| Selection | `/enroll/<sessionId>` | **Signed out:** email → 6-digit code, typed in the same tab, so there's no trip to the inbox and back. First time: name and phone, then add a child. **Signed in:** saved children as checkboxes with an age-fit badge; enrolled ones are greyed out; after a free trial, "continue". |
| Details | `/enroll/details` | Per child: allergies, medical notes (encrypted), pickup people, photo consent. Pre-filled, and only asked again when older than a year. Then a 3-bullet policy summary with one checkbox. |
| Review | `/enroll/review` | Plan choice with live totals (free first class · monthly · pay in full · waitlist), an itemized bill, what's due later, and discounts applied automatically. |
| Payment | `/enroll/pay` | Stripe's card form embedded in the page. Apple Pay and Google Pay appear automatically. Cards are saved for monthly tuition. |
| Confirmation | `/enroll/confirmation` | "You're in!", the first class date, time and place, **Add to calendar** (`.ics`), what to bring, and a confirmation email to every parent in the household. |
| Account | `/account` | Coming up (next class per child), students and their care-details status, **upcoming autopay charges**, anything that needs paying, receipts, sign out. Signed in for 90 days, renewed on each visit. |
| Pay now | `/account/pay/<id>` | Linked from a "we couldn't charge your card" email: pay that month with any card, which also becomes the saved card. |
| Staff | `/admin`, `/admin/<sessionId>` | For `ADMIN_EMAILS` only: counts per class, and rosters with ages, allergies, medical notes, pickup, photo consent and parent contacts. Every view is logged. |
| Staff billing | `/admin/billing` | Failed charges that need a person, the next autopay date and total, **Paid by cash/check**, and **Stop payments** when a family withdraws. |

The Enroll buttons on every page go through one switch: `site.portal.mode` in `src/config/site.ts`.
- `'native'` sends families to this portal.
- `'studio-director'` sends them to Studio Director.

Partner programs with their own registration (a school's system) keep linking out. Google Forms programs (Parents' Night Out, adult improv) now use this checkout.

## Billing rules

Implemented in `src/lib/pricing.ts` (pure functions, unit-tested in `tests/unit/pricing.test.ts`):

- **Monthly classes:** the first month is due at registration. The rest are **charged automatically to the saved card on the 1st** (see Monthly autopay below). Joining more than 7 days into the term prorates the first month by the meetings left.
- **Pay in full:** 10% off the term.
- **Multiple classes or students:** 15% off tuition. **Discounts don't stack**; the bigger one applies (`PRICING.stackDiscounts`).
- **One-time fees** (performance, materials): per student, at registration.
- **Free first class** for new students in Little Characters classes (not Geode). Nothing is due, and "Continue after the trial" on the account page leads to paid tuition in the same spot.
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
6. **Withdrawals:** staff click **Stop payments**, and the remaining months are cancelled. Refunds are issued in the Stripe dashboard.

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
                    household_member, student, order, enrollment, audit_log, dev_email
  auth.ts           Better Auth: email codes, 90-day sessions, rate limits, isAdmin()
  family.ts         household-scoped data access, orders, fulfillment, confirmation email
  payments.ts       Stripe Embedded Checkout, saved-card charges, finishing checkouts
  billing.ts        monthly autopay: daily run, retries, pay now, staff tools
  crypto.ts         field encryption for care notes
  email.ts          Resend, or the dev mailbox at /dev/mailbox
  admin.ts          rosters (logged)
  studio-director.ts  CSV import + invitations
src/lib/pricing.ts  every billing rule, pure and tested
src/pages/enroll/   the journey;  src/pages/account/  dashboard;  src/pages/admin/  rosters
src/pages/api/      auth, /api/me, Stripe webhook, /api/billing/run (daily autopay)
drizzle/            SQL migrations (npm run db:generate after schema changes)
tests/unit/         pricing, autopay, import, access control (npm test)
tests/e2e/          the full journey in a real browser
```
