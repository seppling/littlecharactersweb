# Security and privacy

We hold parents' contact details, children's names and birthdays, and sometimes children's allergy and medical notes. Card numbers are the one thing we deliberately *don't* hold. This page covers what we protect, how, and what's still open.

*Not legal advice. Have the privacy policy and terms reviewed before launch.*

## What we store, and what we don't

| Data | Why we need it | Protection |
|---|---|---|
| Parent name, email, phone | Sign-in, receipts, reaching you during class | Access limited to your household and staff |
| Child first/last name, birthday | Rosters, age fit | Same |
| Allergies, medical notes | Safety in class | **Encrypted per field** (AES-256-GCM); decrypted only for your family and on staff rosters; every roster view logged |
| Pickup notes, photo consent | Safety, marketing permission | Household-scoped |
| Orders and enrollments | What you signed up and paid for | Household-scoped |
| Card numbers | **Not stored.** Stripe holds them; we keep only Stripe's customer ID | PCI scope stays at the lightest level (SAQ A) |
| Passwords | **None exist.** Sign-in is a 6-digit code emailed to you | Nothing to leak or reuse |

Data minimization rules we follow:
- Don't ask for anything we don't use: no addresses, school, gender, insurance or second emergency contact unless a program truly needs it.
- The Studio Director import brings over only names, emails, phones, birthdays and care notes.

## OWASP Top 10 (2025) and what we do about each

| # | Risk | In this app | What's in place | Still to do |
|---|---|---|---|---|
| A01 | **Broken access control** | One family viewing or changing another's children, orders or medical notes; non-staff opening rosters | Every family query takes the household ID from the signed-in session, never from the URL or form (`src/server/family.ts`). Students can only be added to an order by their own household. Admin pages return 404 unless the verified email is on `ADMIN_EMAILS`. Covered by unit tests (`tests/unit/family-access.test.ts`) and the end-to-end journey. | Teacher accounts that see only their own classes, if teachers get logins |
| A02 | **Security misconfiguration** | Debug tools left on; missing headers; test payments in production | The app fails closed: it refuses to start in production without every secret, and test payments and the dev mailbox are impossible there. Security headers on portal pages: CSP, HSTS, nosniff, frame-ancestors none, referrer policy, permissions policy. Portal pages are `no-store` and `noindex`. | Add `public/_headers` for static pages when the host is chosen (`infrastructure.md`) |
| A03 | **Software supply chain failures** | A compromised npm package | Lockfile committed. Few dependencies, all widely used (Astro, Better Auth, Drizzle, Stripe, Zod). CI on every push, Dependabot security updates. The only third-party script is Stripe.js, on the payment page. | Turn on GitHub secret scanning and Dependabot alerts in repo settings |
| A04 | **Cryptographic failures** | Leaked backups exposing health data; cookies stolen over plain HTTP | HTTPS everywhere, with HSTS. Postgres encrypted at rest by Neon, TLS in transit. Allergy and medical notes are additionally encrypted with our own key. Sign-in codes are stored hashed. Session cookies are `HttpOnly`, `Secure`, `SameSite=Lax`. | Keep `DATA_ENCRYPTION_KEY` backed up in a password manager |
| A05 | **Injection** | SQL injection through forms; script injection through names | All database access goes through Drizzle's parameterized queries, with no hand-built SQL from input. Every form is validated with Zod (lengths, formats). Astro escapes all output by default, and email templates escape too. | — |
| A06 | **Insecure design** | Paying $49 for a $400 plan; enrolling past capacity; double charges | Prices are computed only on the server from the catalog, never taken from the browser. The chosen plan is re-checked against the plans allowed for that family. A Stripe payment only counts if it matches the order total exactly, and old checkouts are expired when the plan changes. Enrolling is idempotent and race-safe (the webhook and the confirmation page can't double-enroll or double-email). Monthly autopay can't double-charge (claimed in the database first, payment id saved before confirming, idempotency keys, retries paused while the family pays by hand), and only counts payments of the exact amount due. The class-full check moves families to the waitlist. | Review billing rules with Hannah before live payments (`todo.md`) |
| A07 | **Authentication failures** | Guessing codes; flooding inboxes; stolen sessions | Codes are 6 digits, expire in 10 minutes, allow 5 tries, and are single-use. Per-IP limits, stored in the database so they hold across servers: 5 code requests and 10 sign-in attempts a minute. Imported accounts stay unverified until their owner proves the email. Sign-out deletes the session server-side. | Optional: ask for a fresh code before an admin opens rosters (step-up), and a "sign out everywhere" button |
| A08 | **Software or data integrity failures** | Forged "payment succeeded" calls | The Stripe webhook verifies Stripe's signature, and the confirmation page re-checks the payment with Stripe's API. Database changes go through versioned migrations in git. | — |
| A09 | **Logging and alerting failures** | Not noticing misuse | `audit_log` records sign-ups, data changes, payments, amount mismatches, imports, invitations and **every roster view**. Logs hold IDs, not names or notes. | Uptime alert; a monthly look at the audit log (`infrastructure.md`) |
| A10 | **Mishandling of exceptional conditions** | Errors leaking internals, or failing *open* | Missing configuration stops the app instead of running insecurely. A bad webhook signature returns 400. Payment problems leave the order unpaid rather than enrolling. Production error pages don't show stack traces. | — |

CSRF: Astro's `checkOrigin` rejects cross-site form posts, and cookies are `SameSite=Lax`.

## Payments and PCI

**Cards on file.** Saving a card for later charges requires the cardholder's agreement.
- The review page shows the exact amount and months with an authorization line.
- Stripe's form shows its own save-card notice.
- Every autopay charge is followed by an emailed receipt.
- Families can stop future charges by withdrawing.

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
| Resend | Parent email addresses and message content (codes, confirmations) |
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
