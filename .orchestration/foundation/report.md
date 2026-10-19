# Foundation unit: report

Branch `claude/bo-foundation`, started from `claude/blissful-archimedes-enun5m`. No compaction or restart happened during this unit.

## Result

### What changes for families
Nothing they can see. The family site's pages, enrollment, checkout, billing and prices are unchanged. Their sessions still last 90 days. The database has new, empty places for emergency contacts, pickup people, ZIP code and how the family heard about Little Characters; the Family contacts unit adds the forms.

### What changes for Hannah
- **Staff pages have their own look.** On a computer there's a dark top bar with the sections (Today, Classes, Families, Payments, Messages & sign-ups, Website), a search box, her email and Sign out. On a phone there's the page title at the top with a back link and a Menu, and tabs at the bottom: Today, Classes, Search, Alerts. The family site's header and footer are gone from staff pages.
- **New addresses:** rosters are under Classes (`/admin/classes`), monthly autopay under Payments (`/admin/payments`). Old links and bookmarks still work.
- **`/admin` is now Today**, a placeholder for now, with links to Classes and Payments.
- **Messages & sign-ups downloads** as a spreadsheet (CSV) and a PDF, and both have the same rows as the page. A download within 15 minutes of signing in just works. Later, she's asked for a new emailed code first ("Confirm it's you before downloading").
- **The phone app:** "Put the app on your phone" (in the phone menu) shows how to add "LC Staff" to the home screen.
- **Staff sign-in now lapses after 30 days without use** (it was 90 days, like families).

### By file
- **Data:** `src/server/db/schema.ts`, `drizzle/0009_back_office.sql` (+ snapshot, journal). New household columns `emergency_contacts`, `pickup_people`, `contacts_confirmed_at`, `zip`, `heard_about`. New tables `household_note`, `message`, `message_recipient`, `waitlist_offer`, with relations and exported types (`Household`, `HouseholdNote`, `Message`, `MessageRecipient`, `WaitlistOffer`, and `New…` insert types).
- **`src/lib/contacts.ts`:** zod inputs, `normalizePhone`, `formatPhone`, `telHref`, `smsHref`, and the types `EmergencyContact` and `PickupPerson`.
- **`src/lib/admin-links.ts`:** the link contract, plus `downloads(listPath)` and `safeStaffPath(next)`.
- **`src/lib/badges.ts`**, **`src/components/admin/Badges.astro`:** the badges.
- **`src/lib/csv.ts`**, **`src/server/downloads.ts`**, **`src/components/admin/DownloadLinks.astro`:** downloads. The `pdfkit` dependency is added.
- **`src/server/staff.ts`:** `requireStaff`, `requireFreshStaff`, `signedInRecently`, `staffSessionIdle`, `readSession`.
  - `src/middleware.ts` reads sessions through `readSession`.
  - `src/server/auth.ts` exports the session lengths.
  - `src/env.d.ts`: `locals.session` has `createdAt` and `updatedAt`.
- **The shell:** `src/components/admin/AdminShell.astro` (rewritten) and `src/styles/admin.css` (the shell, plus the shared styles).
  - `src/layouts/Base.astro` gets three small hooks: `chrome`, `themeColor` and a `head` slot.
  - `src/components/portal/SignInPanel.astro` gets an optional `email` prop.
- **Moved pages** (git renames, content unchanged apart from the shell props, `requireStaff` and the contract links):
  - `admin/index.astro` → `admin/classes/index.astro`;
  - `admin/[sessionId].astro` → `admin/classes/[sessionId].astro`;
  - `admin/billing.astro` → `admin/payments/index.astro`;
  - `admin/billing/[orderId].astro` → `admin/payments/[orderId].astro`.
- **Redirects:** `admin/[sessionId].ts`, `admin/billing.ts`, `admin/billing/[orderId].ts`, `src/server/moved.ts`.
- **New pages:**
  - `admin/index.astro` (Today placeholder);
  - `admin/search.astro` and `admin/attention.astro` (placeholders, so the tabs don't land on 404 before the Search and Today units merge);
  - `admin/confirm.astro`, `admin/install.astro`;
  - `admin/leads.pdf.ts`;
  - `dev/age-session.ts` (development only).
- **Leads:** `admin/leads.astro`, `admin/leads.csv.ts`, `src/server/leads.ts` (`staffLeads`, `leadsTable`, `LEAD_LABELS`, `leadWhen`).
- **Phone app:** `public/admin/app.webmanifest`, `public/admin/icons/*.png`, `scripts/make-staff-icons.ts`.
- **Docs:**
  - new `docs/back-office.md`;
  - `docs/security.md` (new data and who sees it, the staff session rules);
  - address updates in `docs/portal.md`, `docs/staff-billing.md`, `docs/infrastructure.md`, `docs/todo.md`.
- **Tests:**
  - unit: `tests/unit/contacts.test.ts`, `badges.test.ts`, `downloads.test.ts`, `admin-links.test.ts`, `staff-session.test.ts`;
  - browser: `tests/e2e/staff-foundation.mjs`;
  - one changed line in `tests/e2e/enroll-journey.mjs`: the selector `a[href="/admin/billing/<id>"]` became `/admin/payments/<id>`, because the payments list now links to the new address. A redirect can't change an `href` on the page.
- **Screenshots:** `.orchestration/foundation/shots/`.

## Proof

All with the Stripe keys blanked.

- **`npm run check`:** 0 errors, 0 warnings (7 hints, all in existing browser tests).
- **`npm test`:** 23 files, 479 tests passed. 39 of them are new: contacts 8, badges 10, CSV/PDF 7, link contract 6, session rules 8.
  - The session tests sign in for real through Better Auth with an emailed code. They show that a staff session idle for 29 days is renewed, that one idle for 31 days reads as signed out (and is deleted), and that a family idle for 60 days stays signed in.
- **`npm run build`:** completes.
- **`npm run db:generate`** (`drizzle-kit generate --name back_office`): I read the SQL. It has four `CREATE TABLE`, five `ALTER TABLE household ADD COLUMN` (jsonb defaults `'[]'::jsonb NOT NULL`), the foreign keys with the asked-for cascade or set null, and six indexes. The migration applied on:
  - each fresh local database (the unit tests and three fresh `serve.sh` databases);
  - the Render preview step: `APP_ENV=development PGLITE_DIR=.data/ci-preview npm run db:prepare-preview` printed "Demo database ready … (peak memory 377 MB)", under CI's 450 MB limit.
  - `billing:run --today 2026-10-01` on an in-memory database also ran.
- **Browser tests,** on a fresh database (`tests/e2e/serve.sh`), in order:
  - `enroll-journey` 23 checks, `trial-journey` 15, `content-editor` 11, `navigation` 64: all passed;
  - `staff-foundation`: 86 checks passed (85 when there are no orders yet, because the old-order redirect check needs one).
  - It covers sign-in, the top bar, the tab bar and menu at 390 px (tabs 64 px tall, menu items at least 44 px), the search box, every redirect, unknown ids returning 404, the manifest's JSON and icons without cookies, `/admin/install` (including the "using the app" message in standalone mode), and the leads CSV and PDF.
  - On the downloads: they work right after sign-in; after aging the session 20 minutes, the CSV asks for a new code with the email filled in, and downloads after it. A formula-like message comes out as `'=SUM…`.
  - It also checks that signed-out PDF links go to confirm, that a 31-day idle staff session is signed out, and that a signed-in parent gets 404 at 14 staff addresses.
  - **Rate limit:** every test signs in from 127.0.0.1, and the 5-codes-a-minute limit was hit when `staff-foundation` ran right after `navigation`. The new test waits one minute and retries when the panel says "Too many tries". It printed "waiting a minute" once in the clean run.
- **Screenshots** (`.orchestration/foundation/shots/`):
  - the shell with the top bar: `shell-desktop.png`, `leads-desktop.png`;
  - the phone tab bar: `shell-phone-today.png`, `shell-phone-menu.png`, `shell-phone-class.png`, `leads-phone.png`;
  - the install page: `install-desktop.png`, `install-phone.png`;
  - the confirm page: `confirm-desktop.png`, `confirm-phone.png`;
  - the leads PDF: `leads.pdf`, with page 1 rendered as `leads-pdf-page-1.png`. It's landscape, with the title, "All forms, newest first · 3 entries", "Made Oct 18, 2026 for Little Characters", a table with a ruled header row, and "Page 1 of 1".
  - In full-page phone shots the fixed tab bar shows mid-image; that's how the screenshot tool draws fixed bars, not a layout fault.
- **CI:** green on the first two pushes (runs 163 and 164). The last run (report, a CSS wrapping fix, screenshots) was still queued when I ended the turn.
- **Not checked:** Installing on a real iPhone or Android phone is also unchecked: there's no device here. Chrome's install prompt can't fire on `http://localhost` in headless tests, so the Install button was checked only in its hidden state.

## Decisions

1. **The phone menu, not Today, carries Payments, Messages & sign-ups and Website.** It's on every page, so each is two taps away wherever Hannah is, and Today stays about today. It also holds Families, "Put the app on your phone" and Sign out.
2. **Families (computer top bar) links to Search** until there's a families list. That's how Hannah finds people today ("she finds people through search").
3. **Placeholders for `/admin/search` and `/admin/attention`,** so the tab bar never lands on a 404 between merges. The Search and Today units replace them.
4. **Phone breakpoint at 760 px.** On a computer the top bar is two rows: brand, search and account, then the sections. Six sections and a search box don't fit one row below about 1,100 px.
5. **Staff pages drop the family site's header and footer** (`chrome={false}`), so the installed app looks like an app. The staff bar is ink (`#1c1826`) like the site's existing staff button, and that's the manifest's theme color.
6. **pdfkit for PDFs.** It's pure JavaScript, maintained (0.20.2, September 2026), with no browser or native build, so it builds on Render as is. It adds 17 packages, about 25 MB in `node_modules` (mostly its own browser builds and font data), and a 5 KB server chunk. **Fonts:** Helvetica, a standard PDF font. Embedding Figtree failed: fontkit throws a RangeError when subsetting the variable font, and the site only ships variable Figtree and Bricolage Grotesque. Helvetica covers English and accented Latin text; emoji or non-Latin scripts in a message wouldn't show in the PDF (the CSV keeps them).
7. **The CSV and PDF of Messages & sign-ups now match the page:** all forms, newest first. The page shows up to 1,000 entries (it was 300) so the three agree. Before, the CSV exported only newsletter, notify and camp sign-ups with four columns. It now has When, Form, Name, Email, About and Message, and the Email column still imports into an email tool. Dates in the files are `2026-10-19 14:05` (Athens), which sorts in a spreadsheet.
8. **No `download` attribute on download links.** When a new code is needed, the link must open the confirm page rather than save it as a file. After confirming, the confirm page starts the file and offers "Back to the list". For a non-download `next` (refunds later) it goes straight on.
9. **The idle limit is checked before renewal.** Better Auth renews a session as it reads it, which would hide a 31-day gap. `readSession` reads with `disableRefresh`, deletes an idle staff session, and otherwise renews once a day exactly as Better Auth's rule does. That's two reads at most once a day, one otherwise.
10. **The old-address redirects:**
    - 301 for GET and 308 for posts.
    - Signed-in non-staff get 404 before any redirect.
    - Unknown classes return 404 directly. Unknown orders return 404 for staff, after a lookup.
    - Signed-out visitors are redirected without a lookup, so they learn nothing about which orders exist.
11. **Phones:** US numbers are stored as 10 digits (a leading 1 or +1 is dropped), others as `+digits`. Extensions are refused. `telHref` and `smsHref` add `+1`.
12. **Badges:**
    - "New" means first enrollment within the last 30 days, counted in Athens days.
    - "Birthday" means within 3 days either side; a February 29 birthday is on the 28th in other years.
    - The `drop-in` key is reserved in the type.
13. **Icons:** the logo mark on ink. Purple on ink is the weakest pair but reads at home-screen size. The maskable icon keeps the mark in the middle 50%.
14. **The content editor's own sign-in gate is unchanged.** It shows "Staff only" to signed-in families with a 200, not a 404. Switching it to `requireStaff` was outside "moved pages keep their content", and its browser test passes as is.
15. **`/dev/age-session`** follows `/dev/mailbox`: it answers 404 when `isProd`. It can only make your own session older.

## Open points

1. **The roster page is 212 px too wide for a phone.** It moved unchanged, and the test notes it rather than failing. *Recommended:* the Classes unit rebuilds it with `.data-table` (it's replacing that page anyway).
2. **Should the content editor 404 signed-in families like the other staff pages?** *Recommended:* yes, in a small follow-up using `requireStaff`, with its browser test's family check updated.
3. **The confirm step leaves the older session in the database** until it expires (the cookie moves to the new one). *Recommended:* fine for now. A "sign out everywhere" button (already on `security.md`'s list) would tidy it.
4. **Should the preview site keep `/dev/age-session`?** It runs with `APP_ENV=development`, like the dev mailbox. *Recommended:* keep it. It can only shorten your own session.
5. **`npm audit`** reports existing advisories, including sharp below 0.35.5 (high, librsvg) and http-cache-semantics. pdfkit adds none. *Recommended:* a separate dependency update before launch.

## Follow-up candidates

- Offline attendance in Phase 2 needs a service worker. Chrome no longer needs one to install the app: web.dev's install criteria, updated September 2024, list HTTPS, a manifest with a name, 192 and 512 px icons, `start_url` and `display`, and some engagement, and no service worker. That's why none was added.
- An "Add to Home Screen" check on a real iPhone and Android phone once the preview is up (Stephen or Hannah).
- Embed Figtree in PDFs if pdfkit or fontkit fixes variable-font subsetting, or if static Figtree files are added.
- Swap the old payments and roster tables to `.data-table` when the Payments and Classes units touch them.

## Handoff (for the screen units)

Read `docs/back-office.md`; the essentials are below.

- **The check:** every staff page starts with `const { staff, response } = requireStaff(Astro.locals); if (response) return response;` (`@/server/staff`). `staff` is null when signed out, and `AdminShell` then shows the sign-in.
- **Downloads and sensitive steps** start with `const stop = requireFreshStaff(locals, url); if (stop) return stop;`.
- **Links:** only through `@/lib/admin-links`:
  - `today()`, `attention()`, `classes()`, `classPage(id)`, `classPrint(id)`, `classEmail(id)`, `search(q?)`, `family(id)`;
  - `payments(show?)`, `paymentsOrder(id)`, `leads()`, `content()`, `install()`, `confirm(next)`;
  - `downloads(listPath)` → `{ csv, pdf }`;
  - `safeStaffPath(next)`.
- **Shell:** `<AdminShell title section back? wide? signIn?>`. Sections: `today | classes | families | payments | leads | content`. Give `back={{ href, label }}` to every page below a list. Wrap content in `<div class="admin-page">`.
- **Styles** (`admin.css`):
  - `.admin-head` + `.admin-head__actions`, `.staff-card(s)`;
  - `.data-table` (each `td` gets a `data-label` and one child element);
  - `.badge--neutral|good|warning|alert`, `.badges`, `.chip-row`, `.chip--good|warning|alert`, `.btn--danger`;
  - `.empty-state`;
  - `.attention-list` / `.attention-item--alert|warning|neutral` with `__title`, `__detail`, `__action`.
- **Badges:** `childBadges({ hasAllergies, hasMedicalNotes, hasPickupNote, restrictedPickup?, photoConsent, firstEnrolledAt, trial, birthdate }, today?)` → `{ key, label, tone }[]`. Render with `<Badges badges={…} />`. Pass booleans only; decrypt with `readStudentNotes` on the server.
- **Downloads:** list page `/admin/x` + `x.csv.ts` + `x.pdf.ts`, all calling one row-building function. Use `toCsv(headers, rows)` with `csvResponse(filename, csv)`, and `pdfResponse(filename, { title, subtitle, columns: [{ header, weight?, align? }], rows, orientation? })`. On the page, `<DownloadLinks {...downloads(path)} what="…" />`. The example is `staffLeads` / `leadsTable` in `src/server/leads.ts`.
- **Data shapes:**
  - `household.emergencyContacts: EmergencyContact[]` (`{ name, relationship, phone }`);
  - `household.pickupPeople: PickupPerson[]` (`{ name, relationship, phone? }`);
  - `household.contactsConfirmedAt`, `household.zip`, `household.heardAbout`;
  - validate contacts with `emergencyContactsInput` / `pickupPeopleInput` from `@/lib/contacts`; show phones with `formatPhone`, `telHref`, `smsHref`;
  - `householdNote { id, householdId, studentId?, body, authorUserId?, createdAt, updatedAt }`;
  - `message { id, kind: 'class'|'family', sessionId?, subject, body, sentByUserId?, createdAt }`;
  - `messageRecipient { id, messageId, householdId?, email, status: 'sent'|'failed', error?, createdAt }`;
  - `waitlistOffer { id, enrollmentId, householdId, sessionId, offeredByUserId?, offeredAt, expiresAt?, status: 'offered'|'accepted'|'withdrawn'|'expired', orderId? }`.
- **Placeholders to replace:** `src/pages/admin/index.astro` (Today), `admin/attention.astro` (Today unit), `admin/search.astro` (Search unit).
- **Browser tests:** sign in through `/dev/mailbox` codes. Age a session with `POST /dev/age-session` (`minutes` or `days`, with an `origin` header). Expect the 5-codes-a-minute limit when tests run back to back. `staff-foundation.mjs` shows the wait-and-retry.

## Compaction

None occurred.
