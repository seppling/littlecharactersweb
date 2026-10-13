# Report: account (family account, giving, old links)

Branch `claude/review-account`, started from `claude/blissful-archimedes-enun5m` (c197dbc). No compaction or restart happened. Nobody typed into this session.

## Result

### For families
- **Imported from Studio Director:** until a family has anything here (an enrollment, an order or a payment), the account shows **"Welcome from Studio Director!"** with the agreed text, in place of "No classes yet" and "No payments yet". The big "Find a class" button is hidden for them. (The site header's own "Find a class" stays: the header is off-limits.) The note adds "…until the term ends on December 18" once Hannah sets the date.
- **"Confirm care details" / "Add care details"** is now a link to the child's page. That page asks "Are Zara's details still right?" with a **Looks right** button. It records the confirmation and changes nothing else.
- **Saved message:** after saving a child's page or tapping Looks right, the account shows "Saved. Zara's details are up to date. Our staff see them on the class roster." (True: the admin roster shows allergies, medical notes, pick-up and photo choice.)
- **Sign-in page** (`/account`, signed out): "Moving from Studio Director? Use the email address you used there, or ask us." ("ask us" opens the contact page.)
- **Payments:**
  - **Card on file** for families on autopay (or with a failed payment): "Visa ending 4242, expires 4/2030"; "Test card" with the local stand-in; "Card saved at checkout" for a card saved before this change. Under it: "To switch cards, email us. Please don't send card numbers by email; we'll send you a secure link."
  - **Upcoming autopay** is grouped by date, with a heading row per date ("Dec 1: $55 · Maya $55"; with two children "Nov 1: $175.75 · Ava $80.75, Kai $95"). The per-child lines, the family-discount and staff-discount lines are unchanged.
  - **Receipts** name the child: first-payment rows now read "Maya: Intro to Theater (first month + fees)" (monthly rows already did: "November tuition: Maya, Intro to Theater"). Under them: "Need a statement for taxes or an FSA? Email us at littlecharacterstheater@gmail.com."
  - Every studio email address on the page is a mailto link. (The parent's own address in "Signed in as …" stays plain text; see Decisions.)
- **"Can't make it?"** on each class under Coming up (it was "Missing a class?"). It opens the contact form on "My child will miss a class", with the child, class and next date filled in (that part already existed).
- **Add to calendar** from the account now gives that child's own file: it starts at the child's first class (the first class on or after the day they enrolled), is titled "Ava: Intro to Theater", and has a reminder an hour before each class. The public `/calendar/<session>.ics` files are unchanged (no reminder, from the session's first day).
- **Give page:** with no donation link the button reads **"Email us to give"** and opens an email to the site address. With a link, "Give now" goes there. An optional tax note shows under the buttons.
- **Old links:** see the redirect list below.

### For Hannah (two settings in Site settings, both empty by default)
- **Giving → Donation link:** where "Give now" goes. Empty means "Email us to give". The old-site link was removed from the starting content, and the editor now refuses any link to www.littlecharacters.org ("For a page on this site, use just its path, like /give").
- **Giving → Tax note:** optional line under the button. The site doesn't state whether gifts are tax-deductible; that's for Hannah to write.
- **Moving from Studio Director → Studio Director billing ends on:** optional date added to the welcome note.

### Old addresses now redirected (301), in `src/lib/redirects.ts`
| Old address | Goes to | Where the old site linked it |
|---|---|---|
| `/s/Fall-2026-LCTT-Tuition-Guidelines.pdf` | `/policies` | classes page (`/classes-1`) |
| `/s/Little-Characters-Theater-Troupe-Tuition-Guidelines-2025.pdf` | `/policies` | Spring 2025 Athens classes (`/athens2024`) — the 2025 version on the site's own address |
| `/s/Little-Characters-Theater-Troupe-Tuition-Guidelines-2026.pdf` | `/policies` | `/classes` |
| `/s/Little-Characters-Tuition-Guidlines-Spring-2025.pdf` | `/policies` | Spring 2025 Winterville classes |
| `/s/Variety-Show-Program.pdf` | `/events` | a past variety show |
| `/spring2024`, `/athens2024`, `/winterville2024` | `/programs` | past seasons' class pages |
| `/services`, `/store` | `/` | Squarespace template pages never filled in |

Note: the live FAQ's "Financial Guidelines" link points at a `static1.squarespace.com` file (the 2025 guidelines), not at littlecharacters.org, so no redirect can catch it; it stops working when Squarespace is cancelled. The seed has no link to any old-site address now (unit test).

### By file
- `src/pages/account/index.astro` — welcome note, care-details link, saved message, sign-in line, card on file, autopay by date, receipts with names, statement line, mailto links, "Can't make it?", per-child calendar link, mobile styles.
- `src/pages/account/students/[id].astro` — "Looks right" form; saves redirect to `/account?saved=<id>`.
- `src/pages/account/calendar/[enrollmentId].ics.ts` (new) — the child's calendar file (signed-in, own household only).
- `src/pages/calendar/[sessionId].ics.ts` — same output, now built by `src/lib/ics.ts` (new).
- `src/lib/account.ts` (new) — card label, autopay grouping, names list, welcome text.
- `src/server/family.ts` — `householdAccount`, `confirmStudentDetails`, `getEnrollment`.
- `src/server/payments.ts` — `completeCheckout` expands `payment_intent.payment_method` in the call it already makes; `rememberCard` stores brand/last four/expiry (`cardOnFile`).
- `src/server/db/schema.ts`, `drizzle/0008_card_on_file.sql` (+ meta) — four nullable columns on `household`.
- `src/content/pages.ts`, `types.ts`, `site-content.ts`, `fields.ts`, `seed/pages.ts` — tax note and billing-end settings, empty donation link, self-link guard (`SELF_LINK`, `offSiteLink`), editor validation.
- `src/pages/give.astro` — "Email us to give" fallback, tax note.
- `src/lib/redirects.ts` — the redirects above.
- `src/pages/contact.astro` — a comment only.
- Tests: `tests/unit/account.test.ts` (new, 23 tests); `tests/e2e/enroll-journey.mjs`, `content-editor.mjs`, `trial-journey.mjs` (selector change).
- Docs: `docs/portal.md`, `docs/security.md`, `docs/content-editor.md`.

## Proof
All with Stripe keys blanked.
- `npx astro check` → 0 errors, 0 warnings.
- `npm test` → 17 files, **411 tests passed** (388 before + 23 new: card label and Stripe card fields, autopay grouping, welcome text and empty setting, calendar start date and reminder and unchanged public file, donation link and editor refusal, no self-links in seed and drafts, every `/s/*.pdf` the old site linked on its own address is redirected, Looks right changes only `detailsConfirmedAt`, and not for another family).
- `npm run build` → complete.
- Browser tests, fresh database (`tests/e2e/serve.sh`), in order — all passed:
  - `enroll-journey.mjs` → "All journey checks passed." New steps: Payments ("Test card", receipts name Maya, statement mailto, no plain-text studio email), account calendar file (starts 2026-10-13, titled "Maya: Intro to Theater", 60-minute reminder; public file still starts 2026-08-18 without one), imported family welcome (no "No classes yet"/"No payments yet", no Find-a-class button, no sideways scroll at 390 px), Confirm care details → Looks right → "Saved. Zara's details are up to date." and allergies unchanged, sign-in line, grouped autopay "Dec 1: $55 · Maya $55".
  - `trial-journey.mjs` → "All free-class checks passed."
  - `content-editor.mjs` → "All editor checks passed." New step: "Email us to give" by default, old-site link refused, link + tax note published and shown, no sideways scroll at 390 px.
  - `navigation.mjs` → "Navigation, finder and accessibility checks passed."
- Screenshots in `.orchestration/account/shots/` (desktop 1280 and 390 px): `8-imported-family`, `9b-payments`, `8b-saved`, `give-no-link`, `give-with-link`. I looked at each; a too-narrow date heading on phones was fixed and re-shot.
- Not run: a real Stripe test-mode checkout (no outside calls allowed). The card-details path is covered by the unit test of `cardOnFile`; the expand string is Stripe's documented nested expand.

## Decisions
- **No new marker for imported families:** `household.source = 'studio-director'` already exists (set by the import). No migration for it.
- **Welcome note shows only while the family has nothing here** (no enrollment, order or payment). Once they sign up for spring, the normal panels return. Reason: the confusion is the empty panels.
- **Hid the account's "Find a class" button** in that state, to avoid double enrolling in fall. The header's button stays (off-limits).
- **Card details in the call already made:** expanding `payment_intent.payment_method` in the existing `checkout.sessions.retrieve` instead of a second Stripe call. Same for the webhook (it uses the same function). Only brand, last four, expiry month and year are stored.
- **One migration, `0008_card_on_file`.** The pricing session may add its own 0008; whoever merges second should renumber (drizzle journal + snapshot).
- **"Test card"** is shown for any saved card id that isn't a Stripe `pm_…` id (the stand-in uses `test_card`). Cards saved before this change show "Card saved at checkout".
- **Autopay date heading:** "Mon D: total · Child $x, …"; a payment for siblings in one class is named "Kai and Ava"; one child's several classes on one date are added together. Table rows stay per payment.
- **The parent's own address** in "Signed in as …" stays plain text: a mailto to themselves helps no one. Every studio address is a link.
- **"Ask us" in the sign-in line** goes to `/contact` (the person isn't signed in; the form works for them).
- **Saved message wording:** "Our staff see them on the class roster." Teacher logins are on hold, so it says staff, not teachers.
- **Looks right** is offered whenever details aren't fresh (never confirmed or older than a year), including for children with no photo choice yet. It only touches `detailsConfirmedAt` (and the row's automatic `updatedAt`), and writes `student.confirm` to the audit log.
- **Child's first class** = first class on or after the day the enrollment was created (Athens time). A free trial that continues keeps its original date, so the file starts at the trial.
- **Old links I added beyond the two asked:** the 2026 and Spring 2025 tuition PDFs, the variety-show program, three past class pages and two template pages. `/services` and `/store` go home since they never had content.
- **Self-link guard at runtime too:** a saved donation link on www.littlecharacters.org is ignored (shows "Email us to give"), so a preview database that kept the old value can't loop.

## Open points
1. **"We'll send you a secure link" (switching cards):** there's no card-update page yet. Staff can send a Stripe-hosted link from the Stripe dashboard today. Recommended: a self-serve "update card" page in the back-office spring phase; until then, document the dashboard steps in `docs/staff-billing.md`.
2. **Donation link, tax note, Studio Director end date:** for Hannah. Recommended: fill the donation link before the domain moves; the tax note only with wording she confirms.
3. **Migration number clash** with the pricing unit (see Decisions). Recommended: renumber at merge.
4. **The live FAQ's Squarespace-hosted 2025 PDF** can't be redirected. Recommended: nothing on the new site; mention in the launch checklist that old FAQ links to it die with Squarespace.

## Follow-up candidates
- Downloadable statements in the account (already on the "later" list) would replace the "email us" line.
- The staff family page could show "details confirmed on …" and the imported-family state.
- Calendar files could skip holidays once the catalog has skip dates.

## Handoff
Everything is committed and pushed to `claude/review-account`. Merge notes: possible `drizzle/0008_*` clash with pricing; `tests/e2e/trial-journey.mjs` line 280 now uses `[data-autopay-item]` (the autopay table has a date heading row per date). Nothing touched `src/pages/enroll/*`, the class page, the header, the FAQ or the Policies text, prices or billing rules.

Compaction: none.
