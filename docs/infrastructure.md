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

**Chosen (October 2026):** Render hosts the site and its Postgres database, set up from `render.production.yaml` (see [Production on Render](#production-on-render)). About $45 a month: the website $25, the database $19, storage about $1.50. Resend, Stripe and GitHub are as in the table. The table above is the original comparison.

### Why not Vercel's free plan?
Vercel's Hobby plan is for non-commercial use only; a business needs Pro ($20/user/month). Netlify's free and personal plans allow commercial sites. Otherwise they're equivalent for us, so either is fine.

### If you'd rather run a plain server
The app is currently built with Astro's Node adapter, so it runs as-is on **Render**, **Railway** or **Fly.io** (~$5–7/month for an always-on instance). The trade-off is a long-running server, which needs a restart for updates and has somewhat more to configure. Serverless is the better fit for a small team.

## How the pieces connect

```
Family's browser ──HTTPS──▶ Netlify (littlecharacters.org)
                             ├─ photos, scripts, styles     from the CDN, no server work
                             └─ functions (every page, /api)
                                   ├──TLS──▶ Neon Postgres      site content, families, students, orders
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

Everything families read (classes and their sessions, events, FAQs, the team, testimonials, locations, every page's text, contact details and the announcement bar) is in the database, and staff edit it at **`/admin/content`**. The guide for Hannah is [`content-editor.md`](content-editor.md).

- **Drafts and publishing.** Edits are drafts until someone presses Publish. Staff can preview drafts on the real site; families only ever see published content. Every published version is kept (`content_version`), so anything can be restored, including deleted items.
- **Rendering.** Pages are rendered on request from an in-memory copy of the content. Each running server checks a revision number at most every 2 seconds and reloads when it changes, so a publish shows up everywhere within a couple of seconds. Public pages send `Cache-Control: public, max-age=0, must-revalidate`, so browsers and CDNs always check back.
- **Photos.** Built-in photos (`src/assets/`) are resized into static files at build time. Uploads are shrunk in the browser, then resized once on the server (WebP at 360–1280px, camera location data removed) and stored in the database, served from `/media/<id>/<width>` with year-long caching. They're small (about 300 KB per photo for every size together), so even hundreds fit well inside Neon's free storage.
- **Starting content.** `src/content/seed/` is copied into an empty database the first time the site runs. After that the database is the source of truth; editing the seed files doesn't change a running site.
- **Safeguards.** Sessions families signed up for can't be removed (close them instead), published web addresses are fixed, and anything still used elsewhere can't be deleted. Price changes only affect new enrollments; families keep the charges they agreed to at checkout.
- **Layout and design** stay in code. Adding a field to the editor is a few lines in `src/content/collections.ts` or `pages.ts` plus the template that shows it.

## Backups and recovery

| What | How | Recovery |
|---|---|---|
| Database | Render point-in-time recovery: any moment in the past 3 days on the Hobby workspace, 7 on Pro. The database's **Recovery** page | Restore to a new database from the Recovery page, check it, then point the site at it |
| Extra safety | Once a month: on the database's **Recovery** page, **Create export** and download it (Render keeps exports 7 days). Store it encrypted, e.g. in 1Password or on an encrypted drive | Restore the export into a new database |
| Payments | Stripe is the system of record for money | Nothing to back up; the dashboard has everything |
| Code | GitHub | Every version, with one-click rollback on the host |
| Site content and photos | In the database, so covered by the backups above. Every published version is also kept, so staff can restore past versions themselves | History → Restore in the editor |
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

## Production on Render

`render.production.yaml` describes the real site: an always-on website (1 CPU, 2 GB) and a Postgres database (0.5 CPU, 1 GB, 5 GB of storage), both in Virginia, the region closest to Athens.
- **Secrets:** Render generates `BETTER_AUTH_SECRET`, `DATA_ENCRYPTION_KEY` and `CRON_SECRET` itself, so they never pass through chat or email.
- **Database:** connected over Render's private network. It accepts no connections from the internet.
- **Deploys:** each merge to `main` deploys once GitHub's checks pass. Database migrations run before each new version starts (`npm run db:migrate`).
- **Search engines:** until the domain moves, the site answers at its `….onrender.com` address and sends `X-Robots-Tag: noindex`, so search results never show that copy. Only `littlecharacters.org` and `www.littlecharacters.org` are indexed (`isLiveHost` in `src/lib/seo.ts`).

### Setting it up (about 30 minutes, in this order)

1. **Resend (email):**
   - **Done October 19:** the account, and the sending domain `mail.littlecharacters.org` (US East). Its DNS records go in Squarespace Domains, which manages littlecharacters.org: Resend → Domains → `mail.littlecharacters.org` → **Auto configure**.
     - A subdomain keeps the site's email separate from the main domain and its Google mail; the website doesn't change.
     - Open and click tracking are off.
     - The site sends as `Little Characters <hello@mail.littlecharacters.org>` (`EMAIL_FROM`), and replies go to the studio's Gmail (`EMAIL_REPLY_TO`).
   - **Still to do,** when setting up Render: in Resend → **API Keys**, create a key with **Sending access**, limited to `mail.littlecharacters.org`, and paste it straight into Render as `RESEND_API_KEY`.
2. **Stripe (test mode):** copy the two test keys (Developers → API keys).
3. **Render:**
   - Choose **New → Blueprint**, then pick this repository and the branch `main`.
   - **Blueprint Path:** `render.production.yaml`.
   - When it asks, enter:
     - `ADMIN_EMAILS`: the staff emails, comma-separated;
     - the two Stripe test keys;
     - the Resend key.
   - Leave `STRIPE_WEBHOOK_SECRET` empty for now, then apply.
   - The first start stops with `Missing required production settings: STRIPE_WEBHOOK_SECRET`. That's expected: the site refuses to run without every setting.
4. **Stripe webhook:** follow [The Stripe webhook](#the-stripe-webhook) with the address Render shows (`https://littlecharacters-site….onrender.com/api/stripe/webhook`). Then paste the signing secret into Render → littlecharacters-site → **Environment** as `STRIPE_WEBHOOK_SECRET`, and save. Render redeploys.
5. **Back up the secrets:** in Render → **Environment**, reveal `DATA_ENCRYPTION_KEY` and copy it into the password manager entry "Little Characters production". Losing it makes allergy and medical notes unreadable.
6. **Wording drafts:** once the site is up, open Render → littlecharacters-site → **Shell** and run `npm run seo:load-drafts -- --commit` once. It loads Hannah's drafts as unpublished changes, as described in `docs/seo/drafts.md`.
7. **Try it:** sign in with an `ADMIN_EMAILS` address (the code arrives by email), then enroll a test child with Stripe's card `4242 4242 4242 4242`.

**Running a script against production** (for example the Studio Director import): use Render's **Shell** tab, which already has the settings. To run one from a laptop instead, add your IP address under the database's **Networking** settings for the session, and remove it afterwards.

**Launch day:**
- Add `SITE_URL` = `https://www.littlecharacters.org`, and add the domain under the service's **Custom Domains**.
- Switch Stripe to live keys and a live webhook.
- Set up the daily autopay run ([The daily autopay run](#the-daily-autopay-run)) with `BILLING_URL` on the real domain.

## Setting it up elsewhere (about an afternoon)

The original steps for Netlify and Neon, if the site ever moves:


1. **Neon:** create a project (region: US East). Copy the pooled connection string. From a laptop, run `DATABASE_URL=… npm run db:migrate` once.
2. **Resend:** add `littlecharacters.org`, then add the DNS records it shows (SPF, DKIM) where the domain is managed. Create an API key.
3. **Stripe (test mode first):**
   - Copy the test keys.
   - Add the webhook endpoint (next section) once the site has a public URL.
   - Turn on Apple Pay and Google Pay under Settings → Payment methods.
4. **Host:** connect this GitHub repo, then switch the adapter. For Netlify: `npx astro add netlify` (replaces `@astrojs/node` in `astro.config.mjs`), and add the security headers for static files in `public/_headers` (snippet below). Build command `npm run build`. Add the environment variables and deploy. Photo uploads are resized with `sharp`, which Netlify's functions support; the editor shrinks photos in the browser first, so uploads stay under Netlify's 6 MB request limit.
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

**Created the service by hand** (New → Web Service) instead of from the Blueprint? It skips `render.yaml`'s settings, so the site runs as production. With no production database or keys, every portal page (`/account`, `/enroll`, forms) returns a blank error, and the log says `Missing required production settings`. Delete it and use the Blueprint, or copy the Blueprint's settings by hand:
- **Settings → Build Command:** `npm ci && npm run build && npm run db:prepare-preview`
- **Environment:**
  - `APP_ENV` = `development`
  - `PGLITE_DIR` = `.data/pglite`
  - `ADMIN_EMAILS` = your email
  - `MALLOC_ARENA_MAX` = `2` (keeps photo uploads well inside the memory limit)
  - Optionally, `STRIPE_SECRET_KEY` and `PUBLIC_STRIPE_PUBLISHABLE_KEY` (test keys only)

Then choose **Save, rebuild, and deploy**.

**Why the preview ships a ready-made database.** The preview's database is PGlite, the same Postgres that local development uses, running inside the server. Creating a new database briefly needs 550–700 MB of memory, over the free plan's 512 MB. That limit applies to the build as well as the running server, and Render stops anything that goes over. Opening an existing database needs far less: the build step peaks around 350–410 MB (it also copies in the starting content and makes the demo data, with Node's heap capped at 128 MB in `package.json`), and the server around 370 MB through the enrollment journey, the editor test and three full-size photo uploads (about 300 MB clicking through the demo data). So `npm run db:prepare-preview` unpacks `scripts/pglite-empty.tar.gz`, a brand-new empty database, into the project folder (not `/tmp`, which doesn't survive from build to start), then applies migrations. If an `@electric-sql/pglite` upgrade moves to a new Postgres version, CI's "Render preview database" step fails. To fix it, run `npm run db:snapshot` on a laptop and commit the new file.

What to expect on the preview:
- **Demo data** (`scripts/demo-data.ts`, plan in `docs/plans/preview-demo-data.md`): 30 made-up families with 36 children, and a term of made-up activity from August to the day it was built. That covers sign-ups, monthly payments (two failed, one paid by check), a refund, credits, days off, attendance, a drop-in, tags, skills, the fall show and last season's numbers. Sign in as:
  - `owner@example.com` at `/admin` (Hannah's view: Today, Reports, every staff page);
  - `teacher@example.com` or `teacher2@example.com` at `/admin/teach` (the teacher app; best on a phone);
  - `parent@example.com` at `/account` (a family with two children).
- The dates count from the day the preview was built, so after a few weeks without a deploy "today" drifts away from the data. To refresh it: Render dashboard → the preview → **Manual Deploy → Deploy latest commit**.
- Sign-in codes appear at `/dev/mailbox`.
- Without Stripe keys, payment is a "test payment" button.
- Data resets whenever the preview sleeps (after 15 idle minutes on the free plan) or redeploys. That includes anything changed in the content editor: the preview is for trying the editor, not for real edits.
- Anyone with the link can read `/dev/mailbox`, so use made-up family details only.

Each push to that branch redeploys the preview automatically.

**For production on any proxy-fronted host** (Render, Fly, a VPS): set `SITE_URL` before building. Astro only trusts the proxy's forwarded domain for the hosts it knows at build time; otherwise every form is rejected as cross-site. Netlify's adapter doesn't need this.

### The Stripe webhook

**What it is:** Stripe calling our site to say "this payment went through" (or "this checkout expired"). The site already checks with Stripe itself when a family lands on the confirmation page. The webhook covers the times that doesn't happen:
- a family closes the tab mid-redirect;
- a bank payment settles later;
- a "pay now" form expires unused, so automatic retries can resume;
- a refund Hannah made finishes later, or fails.

**Why it waits for deployment:** Stripe has to reach the site over the internet, so it needs the real (or preview) URL. It can't reach a laptop or this development environment. Until then, nothing breaks: test enrollments work without it.

**Setting it up (about 3 minutes, once per mode):**
1. In the Stripe dashboard, open **Developers → Webhooks**. Newer dashboards call this **Workbench → Webhooks → Add destination**.
2. Endpoint URL: `https://littlecharacters.org/api/stripe/webhook` (or the preview URL while testing).
3. Select these 6 events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.expired`
   - `payment_intent.succeeded`
   - `refund.updated` and `refund.failed` (a refund made from the staff pages finishes, or fails, after Stripe first said "pending")
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

`public/_headers` for Netlify (static files such as the built-in photos; every page sets its own headers in `src/middleware.ts`):

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
| Monthly (the 2nd) | Check `/admin/payments` for charges that need a person, and the Stripe dashboard for disputes. Glance at the host's error log and the audit log. Download the monthly database export. | 20 min |
| Each term | Hannah adds the new sessions in the editor (copy last term's, change the dates) and closes the old ones. Run one test enrollment. | 30 min |
| Yearly | Review `ADMIN_EMAILS`. Rotate `BETTER_AUTH_SECRET` (signs everyone out once). Delete families with no activity in 3 years (see `security.md`). Renew the domain. | 1 hr |
