# Infrastructure: hosting, data, email, content, maintenance

Goal: a setup one part-time maintainer can run safely for years. That means no servers to patch, managed services that handle backups and encryption, and every change going through git, where it can be reviewed and rolled back.

## The stack at a glance

| Job | Recommendation | Why | Rough cost |
|---|---|---|---|
| Hosting (site + portal) | **Netlify** (or Vercel) | Serverless: no operating system to patch, automatic HTTPS, a preview URL for every branch, one-click rollback | Free tier to start; ~$9–20/mo paid tier |
| Database | **Neon** (serverless Postgres) | Standard Postgres, so there's no lock-in. Encrypted at rest, point-in-time restore, scales to zero between visits | Free tier to start; ~$5–20/mo for longer restore history |
| Sign-in | **Better Auth** (open-source library, runs inside our app) | Accounts live in *our* database. No per-user fees and no third-party identity vendor holding family data | $0 |
| Email | **Resend** | Simple API, good deliverability, verified-domain sending from `@littlecharacters.org` | Free up to 3,000/mo (100/day); $20/mo above that |
| Payments | **Stripe** (already have an account) | Card numbers never reach us; Apple Pay, Google Pay and bank (ACH) payments; saved cards for monthly tuition | 2.9% + 30¢ per card payment; ACH 0.8% (max $5) |
| Code + CI | **GitHub** (this repo) | Every change reviewed and tested before it deploys; Dependabot flags vulnerable packages | $0 |
| Uptime alert | Better Stack or UptimeRobot (free) | Texts or emails you if the site or sign-in goes down | $0 |

**Expected total: $0–60/month** plus Stripe's per-payment fees, depending on how many free tiers you stay within. Prices change, so check each vendor's pricing page when you sign up.

### Why not Vercel's free plan?
Vercel's Hobby plan is for non-commercial use only; a business needs Pro ($20/user/month). Netlify's free and personal plans allow commercial sites. Otherwise they're equivalent for us, so either is fine.

### If you'd rather run a plain server
The app is currently built with Astro's Node adapter, so it runs as-is on **Render**, **Railway** or **Fly.io** (~$5–7/month for an always-on instance). The trade-off is a long-running server, which needs a restart for updates and has somewhat more to configure. Serverless is the better fit for a small team.

## How the pieces connect

```
Family's browser ──HTTPS──▶ Netlify (littlecharacters.org)
                             ├─ static pages (/, /programs, /camps…)   from the CDN, no server work
                             └─ functions (/enroll, /account, /admin, /api)
                                   ├──TLS──▶ Neon Postgres      families, students, orders, sessions
                                   ├──TLS──▶ Resend             sign-in codes, confirmations
                                   └──TLS──▶ Stripe             checkout, saved cards
Stripe ──signed webhook──▶ /api/stripe/webhook   confirms payments even if the tab was closed
```

The card form is Stripe's own iframe inside our page (Embedded Checkout), so the family never leaves the site and card data never touches our code.

## Where customer login data lives

There's no separate identity vendor. Better Auth stores four tables in our Postgres:

| Table | What's in it | What's *not* in it |
|---|---|---|
| `user` | name, email, phone, whether the email is verified | no passwords (sign-in is by emailed code) |
| `session` | a random token per signed-in device, its expiry (90 days, renewed on use), IP and browser | the token is only in an `HttpOnly` cookie, invisible to page scripts |
| `verification` | pending sign-in codes, **hashed**, 10-minute expiry, 5 tries | the code itself |
| `rate_limit` | request counters per IP for the sign-in endpoints | — |

Family data (households, students, orders, enrollments) sits in the same database, with allergy and medical notes **encrypted field-by-field** (AES-256-GCM) using a key that is stored with the host, not in the database. A leaked database backup doesn't reveal children's health information.

**Why not Auth0, Clerk or Supabase Auth?** They work, but they add a monthly per-user bill, a second place family data lives, and a login page that looks like someone else's app. Passwordless codes are the easiest option for families who sign in three times a year, and Better Auth does that inside our own app. If we ever need more (for example passkeys or Google sign-in), they're plugins for the same library.

## Content management

There are two kinds of content, and they belong in different places.

**1. Marketing copy** (About, FAQs, team bios, photos, event blurbs) changes a few times a term.
- *Today:* typed files in `src/data/`. A typo in a field name fails the build instead of breaking the page. Stephen (or Claude) edits them, and every change gets a preview URL before it goes live.
- *When Hannah wants to edit directly:* add **Keystatic**, a free, open-source editor at `/keystatic` that saves to GitHub. There's no new vendor or database, and edits get the same preview and rollback. It's about a day of work to wire up to the existing data files.
- A hosted CMS (Sanity, Contentful) is more than this site needs.

**2. The class catalog** (sessions, dates, prices, capacity) is operational data. It changes every term and is what families pay for.
- *Today:* also in `src/data/programs.ts`. Enrollments point at each session's stable `id`, so opening a new term means adding sessions and deploying, which takes about 2 minutes.
- *Next step (recommended once the portal is live):* move sessions into Postgres with an **admin editor** in `/admin`, so Hannah can open registration, change capacity or add a date without a deploy. The pages already read the catalog through one module, so this swap doesn't touch the design.

## Backups and recovery

| What | How | Recovery |
|---|---|---|
| Database | Neon point-in-time restore (free tier keeps a short window; paid keeps 7–30 days) | Restore to any second in the window, or branch the database to inspect it first |
| Extra safety | Once a month: `pg_dump "$DATABASE_URL" > lc-YYYY-MM.sql`, stored encrypted (e.g. in 1Password or an encrypted drive) | `psql` it into a new Neon project |
| Payments | Stripe is the system of record for money | Nothing to back up; the dashboard has everything |
| Code and content | GitHub | Every version, with one-click rollback on the host |
| Secrets | A password manager entry ("Little Characters production") with every environment variable | Paste back into the host |

## Environment variables

Set these in the host's dashboard (never in git). `.env.example` has the full list with comments.

| Variable | What | Where it comes from |
|---|---|---|
| `SITE_URL` | `https://littlecharacters.org` | — |
| `DATABASE_URL` | Postgres connection string (use Neon's **pooled** URL, with `sslmode=require`) | Neon dashboard |
| `BETTER_AUTH_SECRET` | Signs session cookies | `openssl rand -base64 32` |
| `DATA_ENCRYPTION_KEY` | Encrypts allergy and medical notes | `openssl rand -base64 32`. **Back this up; losing it makes those notes unreadable.** |
| `ADMIN_EMAILS` | Who sees rosters, e.g. `hannah@…` | — |
| `STRIPE_SECRET_KEY`, `PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe API keys (use `sk_test_…`/`pk_test_…` until launch) | Stripe → Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Verifies Stripe's webhook calls | Created by Stripe when you add the webhook endpoint (see below) |
| `CRON_SECRET` | Lets the daily scheduler start the autopay run | `openssl rand -base64 32`; the same value goes in the GitHub secret |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | Sending email | Resend dashboard, after verifying the domain |

The app **fails closed**: unless it's explicitly told it's in development, it refuses to start without the database, secrets, Stripe and email settings. Test payments and the dev mailbox can't be switched on in production.

## Setting it up (about an afternoon)

1. **Neon:** create a project (region: US East). Copy the pooled connection string. From a laptop, run `DATABASE_URL=… npm run db:migrate` once.
2. **Resend:** add `littlecharacters.org`, then add the DNS records it shows (SPF, DKIM) where the domain is managed. Create an API key.
3. **Stripe (test mode first):**
   - Copy the test keys.
   - Add the webhook endpoint (next section) once the site has a public URL.
   - Turn on Apple Pay and Google Pay under Settings → Payment methods.
4. **Host:** connect this GitHub repo, then switch the adapter. For Netlify: `npx astro add netlify` (replaces `@astrojs/node` in `astro.config.mjs`), and add the security headers for static pages in `public/_headers` (snippet below). Build command `npm run build`. Add the environment variables and deploy.
5. **Try it on the preview URL:** enroll a test child with Stripe's test card `4242 4242 4242 4242`.
6. **Go live:** switch Stripe to live keys and a live webhook, point the domain at the host, and set up the uptime check on `/` and `/account`.

### A clickable preview (Render, free)

`render.yaml` sets up a throwaway preview of the whole site and portal:
1. Sign in at [render.com](https://render.com) with GitHub, then choose **New → Blueprint**.
2. Pick this repository and the branch to preview (`main` once PR #5 is merged).
3. Fill in the prompts:
   - `ADMIN_EMAILS`: your email, for the staff pages.
   - Optionally, the two Stripe **test** keys, to try Stripe's real card form.
4. Deploy (about 5 minutes).
5. Open the `…onrender.com` address it shows.

**Created the service by hand** (New → Web Service) instead of from the Blueprint? It skips `render.yaml`'s settings, so the site runs as production. With no production database or keys, every portal page (`/account`, `/enroll`, forms) returns a blank error, and the log says `Missing required production settings`. To fix it, open the service's **Environment** tab, add the lines below, then **Save, rebuild, and deploy**:
- `APP_ENV` = `development`
- `PGLITE_DIR` = `/tmp/pglite`
- `ADMIN_EMAILS` = your email
- Optionally, `STRIPE_SECRET_KEY` and `PUBLIC_STRIPE_PUBLISHABLE_KEY` (test keys only)

What to expect on the preview:
- Sign-in codes appear at `/dev/mailbox`.
- Without Stripe keys, payment is a "test payment" button.
- Data resets whenever the preview sleeps (after 15 idle minutes on the free plan) or redeploys.
- Anyone with the link can read `/dev/mailbox`, so use made-up family details only.

Each push to that branch redeploys the preview automatically.

**For production on any proxy-fronted host** (Render, Fly, a VPS): set `SITE_URL` before building. Astro only trusts the proxy's forwarded domain for the hosts it knows at build time; otherwise every form is rejected as cross-site. Netlify's adapter doesn't need this.

### The Stripe webhook

**What it is:** Stripe calling our site to say "this payment went through" (or "this checkout expired"). The site already checks with Stripe itself when a family lands on the confirmation page. The webhook covers the times that doesn't happen:
- a family closes the tab mid-redirect;
- a bank payment settles later;
- a "pay now" form expires unused, so automatic retries can resume.

**Why it waits for deployment:** Stripe has to reach the site over the internet, so it needs the real (or preview) URL. It can't reach a laptop or this development environment. Until then, nothing breaks: test enrollments work without it.

**Setting it up (about 3 minutes, once per mode):**
1. In the Stripe dashboard, open **Developers → Webhooks**. Newer dashboards call this **Workbench → Webhooks → Add destination**.
2. Endpoint URL: `https://littlecharacters.org/api/stripe/webhook` (or the preview URL while testing).
3. Select these 4 events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.expired`
   - `payment_intent.succeeded`
4. Save, then click **Reveal** under *Signing secret*. It starts with `whsec_`.
5. Put it in the **host's** environment settings as `STRIPE_WEBHOOK_SECRET` and redeploy.

Test mode and live mode each have their own endpoint and their own secret, so do this again when you switch to live keys.

**For local testing** without a public URL, the Stripe CLI relays events: `stripe listen --forward-to localhost:4321/api/stripe/webhook` prints a temporary `whsec_…` for that session.

### The daily autopay run

The site charges monthly tuition when something asks it to, once a day. `.github/workflows/billing.yml` does the asking, for free, from GitHub:
1. Pick a `CRON_SECRET` (`openssl rand -base64 32`) and set it in the host's environment.
2. In GitHub, go to **Settings → Secrets and variables → Actions** and add two repository secrets:
   - `CRON_SECRET`: the same value.
   - `BILLING_URL`: `https://littlecharacters.org/api/billing/run`.
3. Run it once from the **Actions** tab (**Monthly autopay → Run workflow**) to check it. It prints how many charges were due.

After that it runs every morning. It skips itself until those secrets exist, and if a run fails, GitHub emails the repo owner.

To run it by hand against production: `DATABASE_URL=… STRIPE_SECRET_KEY=… npm run billing:run`.

`public/_headers` for Netlify (static pages; portal pages set their own stricter headers):

```
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

## Keeping it healthy

| When | What | Time |
|---|---|---|
| Automatically | GitHub CI runs type checks, unit tests and a build on every push. Dependabot opens a pull request when a dependency has an update or a security fix. | — |
| Weekly | Merge green Dependabot pull requests (the host deploys them). | 5 min |
| Monthly (the 2nd) | Check `/admin/billing` for charges that need a person, and the Stripe dashboard for disputes. Glance at the host's error log and the audit log. Take the extra database dump. | 20 min |
| Each term | Add the new sessions (or, later, in the admin editor). Run one test enrollment on a preview deploy. | 30 min |
| Yearly | Review `ADMIN_EMAILS`. Rotate `BETTER_AUTH_SECRET` (signs everyone out once). Delete families with no activity in 3 years (see `security.md`). Renew the domain. | 1 hr |
