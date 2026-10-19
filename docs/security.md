# Security and privacy

We hold parents' contact details, children's names and birthdays, and sometimes children's allergy and medical notes. Card numbers are the one thing we deliberately *don't* hold. This page covers what we protect, how, and what's still open.

*Not legal advice. Have the privacy policy and terms reviewed before launch.*

## What we store, and what we don't

| Data | Why we need it | Protection |
|---|---|---|
| Parent name, email, phone | Sign-in, receipts, reaching you during class | Access limited to your household and staff |
| Child first/last name, birthday | Rosters, age fit | Same |
| Allergies, medical notes | Safety in class | **Encrypted per field** (AES-256-GCM); decrypted only for your family, on staff rosters and on the family's staff page; every view logged |
| Pickup notes, photo consent | Safety, marketing permission | Household-scoped |
| Staff list (name, email, role) and class assignments | Who may open which class | Owners only. Changes audit-logged (`admin.staff.*`) |
| Emergency contacts and pickup people (name, relationship, phone; up to 4 each) | Reaching someone when parents can't be reached; knowing who may collect a child | Household-scoped: the family and staff (the forms tell families that, from spring, the teachers of their children's classes will see them too). Saves and "Looks right" are audit-logged as `household.details.update` / `household.details.confirm`, without the details. **Not encrypted** (like parents' phones), but never put in URLs, logs or the audit log |
| ZIP code, how the family heard about us | Knowing where families come from (two of Studio Director's reports) | Household-scoped; staff see it on the family's page. The family sees and edits their ZIP; "How did you hear about us?" is asked once and stored as a short key (`friend`, `search`, …) or `other: <their words>` |
| Staff notes about a family or a child | Staff remembering what matters | **Staff only**; families never see them. Never in URLs or logs |
| Staff emails sent from the site, and to whom | The log on each family's page | Staff only |
| Attendance (present, absent, late, left early, a short note) and teachers' notes to Hannah | Safety, "missed two in a row", Hannah knowing how class went | Staff: owners, and the teacher of that class (a substitute on their date only). Every change after the first save is audit-logged with the old and new status; notes are never care details. The teacher app keeps today's rosters on the teacher's phone for the day (`back-office.md` §18), cleared on sign-out, when someone else signs in and the next day |
| Waitlist offers | Offering a place to a waitlisted child | The family and staff |
| Orders and enrollments | What you signed up and paid for | Household-scoped |
| Card numbers | **Not stored.** Stripe holds them; we keep only Stripe's customer and card IDs, and the card's brand, last four digits and expiry month and year (shown to the family as "Visa ending 4242, expires 4/2030") | PCI scope stays at the lightest level (SAQ A). Without the full card number, brand, last four and expiry can't be used to pay; they're copied from Stripe's own response, never typed into our forms |
| Passwords | **None exist.** Sign-in is a 6-digit code emailed to you | Nothing to leak or reuse |

Data minimization rules we follow:
- Don't ask for anything we don't use: no street addresses, school, gender or insurance unless a program truly needs it. Emergency contacts and pickup people are capped at 4 each; ZIP code is the only part of an address we keep.
- The Studio Director import brings over only names, emails, phones, birthdays and care notes.

## OWASP Top 10 (2025) and what we do about each

| # | Risk | In this app | What's in place | Still to do |
|---|---|---|---|---|
| A01 | **Broken access control** | One family viewing or changing another's children, orders or medical notes; non-staff opening rosters | Every family query takes the household ID from the signed-in session, never from the URL or form (`src/server/family.ts`). Students can only be added to an order by their own household. Staff pages and the content editor only work for owners (a verified email on `ADMIN_EMAILS`, or added as an owner in Settings → Staff): signed-out visitors get the staff sign-in, signed-in families and teachers get a 404, and every editor action re-checks on the server. Teachers (added in Settings → Staff) open only the teacher app, filtered to their own classes and substitute dates (`canTeach`, `src/server/teachers.ts`); every roster and every attendance tap checks it on the server (`teachAccess`, `src/server/attendance.ts`, unit-tested in `tests/unit/attendance.test.ts`); turning someone off removes their access at their next request. Unpublished drafts are only shown to staff, never cached. Covered by unit tests (`tests/unit/family-access.test.ts`) and the end-to-end journey. | — |
| A02 | **Security misconfiguration** | Debug tools left on; missing headers; test payments in production | The app fails closed: it refuses to start in production without every secret, and test payments and the dev mailbox are impossible there. Security headers on every page: CSP, HSTS, nosniff, frame-ancestors none, referrer policy, permissions policy. Portal pages are `no-store` and `noindex`. | Add `public/_headers` for static pages when the host is chosen (`infrastructure.md`) |
| A03 | **Software supply chain failures** | A compromised npm package | Lockfile committed. Few dependencies, all widely used (Astro, Better Auth, Drizzle, Stripe, Zod). CI on every push, Dependabot security updates. The only third-party script is Stripe.js, on the payment page. | Turn on GitHub secret scanning and Dependabot alerts in repo settings |
| A04 | **Cryptographic failures** | Leaked backups exposing health data; cookies stolen over plain HTTP | HTTPS everywhere, with HSTS. Postgres encrypted at rest by Neon, TLS in transit. Allergy and medical notes are additionally encrypted with our own key. Sign-in codes are stored hashed. Session cookies are `HttpOnly`, `Secure`, `SameSite=Lax`. | Keep `DATA_ENCRYPTION_KEY` backed up in a password manager |
| A05 | **Injection** | SQL injection through forms; script injection through names | All database access goes through Drizzle's parameterized queries, with no hand-built SQL from input. Every form is validated with Zod (lengths, formats). Astro escapes all output by default, and email templates escape too. Text from the content editor is escaped; its only markup is links, bold and highlights, and links must be web, site, email or phone addresses (no `javascript:`). Uploaded photos are decoded and re-encoded (size and pixel limits, metadata removed), never served as uploaded. | — |
| A06 | **Insecure design** | Paying $49 for a $400 plan; enrolling past capacity; double charges | Prices are computed only on the server from the catalog, never taken from the browser. The chosen plan is re-checked against the plans allowed for that family. A Stripe payment only counts if it matches the order total exactly, and old checkouts are expired when the plan changes. Enrolling is idempotent and race-safe (the webhook and the confirmation page can't double-enroll or double-email). Monthly autopay can't double-charge (claimed in the database first, payment id saved before confirming, idempotency keys, retries paused while the family pays by hand), and only counts payments of the exact amount due. The class-full check moves families to the waitlist. | Review billing rules with Hannah before live payments (`todo.md`) |
| A07 | **Authentication failures** | Guessing codes; flooding inboxes; stolen sessions | Codes are 6 digits, expire in 10 minutes, allow 5 tries, and are single-use. Per-IP limits, stored in the database so they hold across servers: 5 code requests and 10 sign-in attempts a minute. Imported accounts stay unverified until their owner proves the email. Sign-out deletes the session server-side. Staff sessions end after 30 days without use (families: 90), or after 1 hour on a device marked "This is a shared device" at sign-in. Staff downloads and staff changes (and later refunds) need a sign-in from the last 15 minutes, with a new emailed code otherwise (`back-office.md` → Signing in). | A "sign out everywhere" button |
| A08 | **Software or data integrity failures** | Forged "payment succeeded" calls | The Stripe webhook verifies Stripe's signature, and the confirmation page re-checks the payment with Stripe's API. Database changes go through versioned migrations in git. | — |
| A09 | **Logging and alerting failures** | Not noticing misuse | `audit_log` records sign-ups, data changes, payments, staff discounts (added and removed), amount mismatches, imports, invitations, **every roster view** (the teacher app's too, with the date), attendance changes (old and new status), every view of a family's page, staff notes and staff edits to care details and contacts (added, changed, deleted), every staff download, drop-ins (booked, added, cancelled, and each view of a date's drop-ins with their care details, `admin.roster.drop_ins`), and roster changes (children added, removed or offered a place; the reason staff type for a no-charge place is the one piece of text kept, in `audit_log.detail`, and staff are asked not to put care details in it). Every published content change is kept with who published it (`content_version`). Logs hold IDs, not names or notes (apart from that reason). | Uptime alert; a monthly look at the audit log (`infrastructure.md`) |
| A10 | **Mishandling of exceptional conditions** | Errors leaking internals, or failing *open* | Missing configuration stops the app instead of running insecurely. A bad webhook signature returns 400. Payment problems leave the order unpaid rather than enrolling. Production error pages don't show stack traces. | — |

CSRF: Astro's `checkOrigin` rejects cross-site form posts, and cookies are `SameSite=Lax`.

## Payments and PCI

**Cards on file.** Saving a card for later charges requires the cardholder's agreement.
- The review page shows the exact amount and months with an authorization line.
- Stripe's form shows its own save-card notice.
- Every autopay charge is followed by an emailed receipt.
- Families can stop future charges by withdrawing.
- The family account shows which card is on file (brand, last four, expiry). To switch cards, families email us, and are told not to send card numbers by email.

The daily billing endpoint only runs with the `CRON_SECRET` bearer token (compared in constant time), and it can't choose the date or the amount.


Stripe Embedded Checkout puts Stripe's own card form (an iframe served from Stripe) inside our page. Card data goes from the family's browser straight to Stripe, which keeps us eligible for **PCI DSS SAQ A**, the shortest self-assessment.
- Once a year, Stripe asks you to confirm it in the dashboard.
- Keep that eligibility by never adding analytics, chat widgets or other third-party scripts to `/enroll/*` pages.

## Children's data

- **COPPA** covers collecting personal information *from* children under 13 online. Here parents create the account and enter their children's details, and children don't sign in, so the site is aimed at parents rather than directed at children. Keep it that way: no child logins, no kid-facing forms.
- The privacy policy should say what we collect about children, why, who we share it with (only the vendors below), how long we keep it, and how a parent can see or delete it.
- **Photo consent** is a per-child yes/no that staff see on the roster. Confirm with Hannah that it covers photos on this site.

## Vendors that process family data (for the privacy policy)

| Vendor | What they receive |
|---|---|
| Netlify (or chosen host) | Page requests, IP addresses |
| Neon | The database (encrypted at rest) |
| Resend | Parent email addresses and message content (codes, confirmations, and staff emails to a class or a family) |
| Stripe | Parent name, email, payment details |

## Retention and deletion

- **Default:** keep a family while they're active; delete households with no enrollment or sign-in for **3 years**. Keep payment records Stripe needs for 7 years for tax purposes (Stripe keeps them, so we don't need to).
- **On request:** a parent can email to have their family deleted. Deleting the household removes its students, enrollments and orders (database cascade), and deleting the user removes their sessions. Record the request in the audit log.
- **Studio Director exports:** they contain every family's data.
  - Keep them on one computer, not email or shared drives.
  - Run the import, then delete the CSVs.
  - `*.csv` is git-ignored, so they can't be committed by accident.

## Secrets

- They live only in the host's environment settings and one password-manager entry. Never put them in git, chat, email or screenshots.
- Use Stripe **test** keys until launch day, with separate live and test webhooks.
- Rotate a secret if it's ever pasted somewhere it shouldn't be:
  - `BETTER_AUTH_SECRET`: rotating it signs everyone out.
  - Stripe and Resend keys: roll them in the vendor's dashboard.
  - `DATA_ENCRYPTION_KEY` can't simply be replaced. Re-encrypt the notes first; ask before changing it.

## If something goes wrong

1. **Contain:** roll back the deploy on the host, or rotate the leaked key.
2. **Assess:** use the audit log and host logs to see what was accessed and when.
3. **Notify:** Georgia's breach law (O.C.G.A. § 10-1-912) requires notifying affected people without unreasonable delay when certain personal information is exposed. Talk to a lawyer promptly.
4. **Fix and write down** what happened and what changed.

## Privacy policy and terms: starting points

- **Privacy policy:** Termly, iubenda or the FTC's plain-language guidance, customized with the tables above.
- **Terms and registration policies:** Hannah's existing tuition guidelines (withdrawals, refunds, late fees, photo policy). The 3-bullet summary at checkout links to the full text.
