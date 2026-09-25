# Phase 2: family portal (design notes, not built)

The goal is for enrolling to feel like part of the website, not a trip to a different app. Families move through **Discovery → Selection → Enrollment → Payment → Confirmation** without changing domains, without a separate "create an account" step, and returning families skip straight to the review screen.

This note records the seams already in the Phase 1 site and the direction we recommend. Features, pricing rules and admin tools get decided together before any portal code is written.

## What Phase 1 already does to prepare

| Seam | Where | Phase 2 behavior |
|---|---|---|
| One switch for all enrollment links | `site.portal.mode` in `src/config/site.ts`; `enrollHref()` in `src/lib/enroll.ts` | Change `'studio-director'` → `'native'` and every Enroll button goes to `/enroll/<sessionId>` |
| Stable session IDs | `Session.id` in `src/data/programs.ts` | Become the enrollment keys in the database |
| Data shapes that match the portal | `src/data/types.ts` (Program → Session, Location, Event) | The catalog moves into the database; pages read it from the portal API instead of files |
| Account slot in the header | `data-account-slot` on `AccountLink.astro` | Swapped client-side for "Hi, Sam · 2 upcoming" |
| Session hooks on buttons | `data-enroll` / `data-session-id` on every session line | Personalized labels like "Enroll Maya" and "Maya is enrolled ✓" |
| Session picker on program pages | "Choose a time" panel in `src/pages/programs/[slug].astro` | Gains a "Who's coming?" step with saved students' checkboxes |
| Stable `/account` URL | `src/pages/account.astro` | Becomes the family dashboard |

## Recommended architecture

**Same domain, same codebase.** Marketing pages stay prerendered (fast, cheap, cacheable). `/enroll/*`, `/account/*` and `/api/*` are server-rendered routes in the same Astro project, using an adapter (Node, Vercel or Netlify). Because everything is served from `littlecharacters.org`, one first-party cookie covers both the site and the portal.

```
littlecharacters.org
├── /, /programs, /camps, /events …   prerendered (Phase 1)
├── /enroll/[sessionId]               server: selection → details → pay → confirm
├── /account                          server: family dashboard
└── /api/me, /api/cart, /api/stripe…  server endpoints
```

- **Database:** Postgres (Supabase or Neon). Main tables: household, guardian, student, program, session, enrollment, waitlist_entry, order, payment, discount_rule, credit (scholarships), consent.
- **Payments:** Stripe. The Payment Element covers cards, Apple Pay and Google Pay. Saved payment methods handle one-tap checkout for returning families, subscriptions handle monthly class tuition, and payment intents handle camp deposits and balances.
- **Email and SMS:** Postmark or Resend for receipts, confirmations and reminders. Twilio is optional for texts the day before camp.
- **Admin for Hannah:** rosters, attendance, waitlist offers, refunds and credits, and class and session editing. This replaces the hand-edited `src/data` files.

## Persistent login ("remember me" that actually works)

Families log in a few times a year, so passwords are the wrong tool: they get forgotten and turn into support emails.

1. **No account wall for browsing.** Prices, times and open spots are always public.
2. **Identify at checkout.** Clicking "Continue to enrollment" asks only for an email address. We send a 6-digit code and a magic link (either works). A new email creates the household on the spot; an existing email loads the saved family.
3. **Stay signed in.** A long-lived, rotating refresh token is stored in an `HttpOnly; Secure; SameSite=Lax` cookie on `littlecharacters.org`, with a rolling 90-day expiry (renewed on each visit). Access tokens are short-lived.
4. **Passkeys (optional).** After the first login, offer "Use Face ID next time" through WebAuthn.
5. **Step-up only when it matters.** Changing the saved card, adding authorized pickup people or viewing medical notes requires a login from the last 15 minutes. Enrolling with a saved card does not.
6. **Personalize without breaking caching.** Marketing pages stay static. A small `GET /api/me` call, or an Astro server island, fills the header slot and turns "Enroll" into "Enroll Maya" when a saved student's age fits.

Net effect: a returning parent taps **Enroll** on a class page and lands on the review screen with their student, saved card and discounts already filled in. One tap on "Pay $95" and they're done.

## The journey, step by step

| Step | What the family sees | Notes |
|---|---|---|
| Discovery | Age-first finder, program pages with times, price, spots left and "ends in a show" | Built in Phase 1 |
| Selection | Pick a session; logged-in families also tick which child(ren) | Multi-child, multi-session cart |
| Enrollment | Student details (pre-filled when returning): birthday, allergies and medical notes, pickup people, photo consent. One consent checkbox for policies, with a 3-bullet summary and a link to the full text | New students fill this in once; after that we ask once a year "Is this still right?" |
| Payment | Full price, deposit (camps) or monthly (classes); sibling, multi-class and scholarship credits applied automatically; Apple Pay, Google Pay, saved card | All-in total shown before the pay button; no surprise fees |
| Confirmation | Page and email with per-child summary, "Add to calendar" for sessions and the showcase, what to bring, a map link and the receipt | Reminders 7 days and 1 day before |

Waitlists: when a session is full, the Enroll button becomes "Join waitlist" in the same spot, and families can see their position. When a spot opens, the next family is offered it by email or text and has 24–48 hours to claim it in one tap.

## Current billing rules the portal has to handle

These come from the Fall 2026 tuition guidelines, and the Phase 2 flow has to support all of them.

- **Trials.** A first class is free: families pick "trial/drop-in", and no tuition is due until after that class.
- **When tuition is due.**
  - Full-semester sign-ups pay the first month at registration.
  - After that, tuition is due on the 1st of each month, by auto-draft or manual payment.
  - Payments after the 10th carry a $15 late fee.
  - Students are paused from class if the balance isn't paid by the 15th.
- **Proration.** Late starters are prorated. Some 8-week classes have a single session price instead of monthly tuition.
- **One-time fees.** Performance and materials fees ($20–$50) are due Oct 1.
- **Discounts and scholarships.**
  - 10% off for paying the semester in full.
  - 15% off for multiple classes or multiple students.
  - Pay-what-you-can rates through a scholarship application.
- **Payment method surcharges.**
  - Card: 3%.
  - Bank: 1%.
  - Cash, check, Zelle or Venmo: +$5 a month.

  Show these before checkout; with Stripe, card fees are lower and bank (ACH) payments cost less than 1%.
- **Minimum class size.** A class needs 5 students by Sep 1 to run, otherwise students are moved to another class or charged only the first month.
- **Withdrawals.** Families must give notice 5 days before the next billing cycle, and there are no refunds for missed classes.
- **Show tickets.** Each student gets 2 free tickets to their shows. This could be a ticket allotment attached to the student's enrollment.

Parents' Night Out and adult improv currently register through Google Forms. Phase 2 folds them into the same checkout.

## Migration from Studio Director

1. Export families, students, enrollments and open balances as CSV.
2. Import into the new database, matching families by guardian email.
3. Send each family a "Your new family account is ready" email with a magic link. They don't need to set a password.
4. Run both systems in parallel for one term; new enrollments go only to the new portal.

## To decide together before building

- Class billing: monthly auto-charge, per term, or both?
- Refund, transfer and withdrawal rules to show at checkout.
- Payment plans for camps (for example, a deposit plus 2 installments)?
- Early access for returning families or donors before public registration?
- Teacher logins for rosters and attendance?
- Text-message reminders?
- Build it ourselves, or put a custom front end on a registration platform with an API (Sawyer, Jackrabbit, Amilia, Pike13)? A platform means less admin to build but less control over the flow. Our current lean is custom-lite on Stripe, because the flows are simple and a seamless experience is the whole point.
