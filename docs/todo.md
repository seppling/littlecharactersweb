# To-do

A running checklist for the new site and family portal. Check items off in a commit or a PR as they're done.

## Decisions made (Sep 2026)

- [x] **Design direction:** keep "House Lights & Spike Tape" (bright rehearsal room, spike-tape labels, the logo's four colors).
- [x] **Pricing conflicts on the old site:** default to the monthly price. Geode Acting Studio is now $95/month + $30 performance fee.
- [x] **Phase 2:** build our own family portal on the same site. Built: sign-in by emailed code, enrollment, Stripe checkout, dashboard, staff rosters (`portal.md`).
- [x] **Studio Director data:** import families and students, then send a one-time "your account is ready" email (`portal.md` → Moving families over).
- [x] **Stack:** Netlify (or Vercel) + Neon Postgres + Better Auth (logins in our own database) + Resend + Stripe (`infrastructure.md`, `security.md`).

## Hannah: content gaps

- [ ] Fall 2026 Variety Show date, times and ticket link (shows as "date coming soon" on `/events`).
- [ ] Summer 2027 camp weeks, ages and prices. Add them as sessions labeled "Week 1", "Week 2"… and the week grid on `/camps` appears on its own.
- [ ] Does Ovation continue? If so, the next dates. If not, remove it from `src/data/programs.ts`.
- [ ] A donation link (Stripe Payment Link, Givebutter, PayPal…) for `site.givingUrl`.
- [ ] 3–5 more testimonials from families, with permission to use a first name.
- [ ] Remaining non-price conflicts on the old site (Carley Pedan vs Peden; Yes, And… on Monday or Wednesday; Produce a Show teachers; the 7:1 vs 8:1 ratio). See `content-inventory.md`.
- [ ] Adult improv night: $25 (Fall 2026 page) or $20 (Geode page)? There's no monthly option, so this one needs a call.
- [ ] Confirm photo consent covers the new site for the children shown.
- [ ] Is the school partners list (Athens Montessori, Oglethorpe Ave. Elementary, Love.Craft) still current?

## Launch checklist (Phase 1 site)

- [ ] Create hosting, database and email accounts (see `infrastructure.md`) and add their keys as environment variables.
- [ ] Hook up the contact, newsletter and "notify me" forms.
- [ ] Set `site.preview = false`.
- [ ] Add 301 redirects from old Squarespace URLs (listed in `content-inventory.md`).
- [ ] Point littlecharacters.org at the new host, then cancel Squarespace after a quiet month.
- [ ] Delete the stray `/services` interior-design demo page on the old site in the meantime.

## Family portal

Setup (Stephen):
- [ ] Add Stripe **test** keys as environment variables in the Claude Code environment settings, never in chat: `STRIPE_SECRET_KEY`, `PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`. Then run a test enrollment with card 4242 4242 4242 4242.
- [ ] Create Netlify, Neon and Resend accounts; set the environment variables; run `npm run db:migrate`; verify the email domain (`infrastructure.md` → Setting it up).
- [ ] In GitHub repo settings, turn on Dependabot alerts and secret scanning.
- [ ] Store `DATA_ENCRYPTION_KEY` and the other secrets in a password manager.

Decisions (together):
- [ ] Months 2+ of tuition: automatic charge on the 1st (Stripe subscription or invoice), or families pay from their account?
- [ ] Keep the $15 late fee and "paused after the 15th"? Keep or drop payment-method surcharges (we suggest dropping them)?
- [ ] Refund, transfer and withdrawal wording for the policy checkbox (`POLICY_VERSION` in `src/server/family.ts`).
- [ ] Should performance/materials fees be charged at registration (current) or on Oct 1?
- [ ] Class capacity per session (default 20), and whether the free first class applies to every Little Characters class.
- [ ] Camp payment plans (deposit + installments)? Early access for returning families?

Migration (Hannah + Stephen):
- [ ] Export families and students from Studio Director as CSV into `imports/` (git-ignored).
- [ ] Preview, then import: `npm run import:studio-director -- imports/*.csv`, then again with `--commit`. Delete the CSVs.
- [ ] Send invitations in batches: `npm run invite:imported -- --send 50`.
- [ ] Write the privacy policy and terms (starting points in `security.md`).

Launch:
- [ ] Soft launch with a handful of families on Stripe live keys for one billing cycle. `site.portal.mode` is already `'native'`; set it to `'studio-director'` if the site goes live before the portal does.
- [ ] Run Studio Director and the portal side by side for one term, then cancel Studio Director.

Next features (after launch):
- [ ] Move the class catalog into the database with an admin editor, so a new term doesn't need a deploy.
- [ ] Waitlist offers by email, reminders before the first class, "sign out everywhere", optional passkeys.
- [ ] Keystatic editor for FAQs, team and events, if Hannah wants to edit copy herself.
