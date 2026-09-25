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
| Account | `/account` | Coming up (next class per child), students and their care-details status, receipts, sign out. Signed in for 90 days, renewed on each visit. |
| Staff | `/admin`, `/admin/<sessionId>` | For `ADMIN_EMAILS` only: counts per class, and rosters with ages, allergies, medical notes, pickup, photo consent and parent contacts. Every view is logged. |

The Enroll buttons on every page go through one switch: `site.portal.mode` in `src/config/site.ts`.
- `'native'` sends families to this portal.
- `'studio-director'` sends them to Studio Director.

Partner programs with their own registration (a school's system) keep linking out. Google Forms programs (Parents' Night Out, adult improv) now use this checkout.

## Billing rules

Implemented in `src/lib/pricing.ts` (pure functions, unit-tested in `tests/unit/pricing.test.ts`):

- **Monthly classes:** the first month is due at registration and the rest on the 1st. Joining more than 7 days into the term prorates the first month by the meetings left.
- **Pay in full:** 10% off the term.
- **Multiple classes or students:** 15% off tuition. **Discounts don't stack**; the bigger one applies (`PRICING.stackDiscounts`).
- **One-time fees** (performance, materials): per student, at registration.
- **Free first class** for new students in Little Characters classes (not Geode). Nothing is due, and "Continue after the trial" on the account page leads to paid tuition in the same spot.
- **Per-child pricing:** Parents' Night Out is $30 for the first child and $10 for each additional.
- **Capacity:** default 20 per class (override per session). When full, the only option is the waitlist, with nothing due.
- **Price conflicts** on the old site resolved to the monthly price.

**Not built yet** (decide first, see `todo.md`):
- Charging months 2+ automatically. The card is saved; the choice is Stripe subscriptions vs monthly invoices vs "pay from your account".
- Late fees and the "paused after the 15th" rule.
- Payment-method surcharges. We recommend dropping these: Stripe's ACH is 0.8%, and card surcharges carry disclosure rules.
- Waitlist offer emails.
- Reminders before the first class.
- Refunds and transfers. Use the Stripe dashboard for now.

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
  payments.ts       Stripe Embedded Checkout
  crypto.ts         field encryption for care notes
  email.ts          Resend, or the dev mailbox at /dev/mailbox
  admin.ts          rosters (logged)
  studio-director.ts  CSV import + invitations
src/lib/pricing.ts  every billing rule, pure and tested
src/pages/enroll/   the journey;  src/pages/account/  dashboard;  src/pages/admin/  rosters
src/pages/api/      auth, /api/me, Stripe webhook
drizzle/            SQL migrations (npm run db:generate after schema changes)
tests/unit/         pricing, import, access control (npm test)
tests/e2e/          the full journey in a real browser
```
