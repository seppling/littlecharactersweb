# To-do

A running checklist for the new site and family portal. Check items off in a commit or a PR as they're done.

## Decisions made (Sep 2026)

- [x] **Design direction:** keep "House Lights & Spike Tape" (bright rehearsal room, spike-tape labels, the logo's four colors).
- [x] **Pricing conflicts on the old site:** default to the monthly price. Geode Acting Studio is now $95/month + $30 performance fee.
- [x] **Phase 2:** build our own family portal on the same site (see `portal-phase-2.md` and `infrastructure.md`).

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

## Phase 2: family portal

- [ ] Add Stripe **test** keys as environment variables (`STRIPE_SECRET_KEY`, `PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`) and run through a test enrollment.
- [ ] Export families, students and enrollments from Studio Director as CSV and run the import (`npm run import:studio-director`). Keep the CSVs out of git.
- [ ] Decide the billing details still open: monthly auto-draft vs pay-as-you-go, refund/transfer wording, camp payment plans, early access for returning families.
- [ ] Write the privacy policy and terms (templates are linked in `security.md`).
- [ ] Soft launch with a handful of families for one billing cycle, then switch `site.portal.mode` to `'native'`.
