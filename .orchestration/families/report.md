# Families unit: report

Branch `claude/bo-families` (from `claude/blissful-archimedes-enun5m` at 5094d9b). No compaction or restart occurred.

## Result

**For Hannah:** one box finds a family by a parent's name, email or phone (in any format), by a child's name, or a class. The Families section lists every family A to Z. A family's page has everything on one screen: parents with Email, Call and Text, each child's care details, emergency contacts and pickup people, classes, payments, staff notes, and emails sent. She can fix a child's allergies or a family's contacts from there, and keep notes. Four Studio Director reports can be downloaded as a spreadsheet or a PDF: Family List, Student / Class List, Student Contact List and Family Notes.

**For families:** nothing changes on their pages. A staff edit to care details or contacts shows in their account, and doesn't count as their yearly confirmation.

By file:
- `src/server/families.ts` (new): everything this unit reads and writes.
  - Search: `searchStaff`, `containsPattern`, `phoneDigits`.
  - The list and its downloads: `familyDirectory` (one load shared by the list and three downloads), `familiesPage`, `familiesTable`, `childrenTable`, `contactsTable`.
  - Notes: `addNote`, `editNote`, `deleteNote`, `familyNotes`, `allNotes`, `notesTable`.
  - Staff edits: `staffUpdateCareDetails`, `staffUpdateContacts`, `contactRows`.
  - A family's page: `familyPage`, `paymentSummary`, `currentTerm`, `familyEmails`.
  - Also `FAMILY_LISTS` and `FamilyEditError`.
- `src/server/family-downloads.ts` (new): `familyDownload(list, format, ctx)`. Each download checks for a fresh sign-in, builds its rows, writes an audit entry and returns the file.
- `src/pages/admin/search.astro`: replaces the placeholder. It shows the Families list (title "Families") or search results (title "Search").
- `src/pages/admin/families/[householdId].astro` (new): a family's page, with small forms on the page.
- Download routes (new): `src/pages/admin/search.csv.ts` and `search.pdf.ts`, plus `src/pages/admin/search/{children,contacts,notes}.{csv,pdf}.ts`.
- `tests/unit/families.test.ts` (new): 16 tests.
- `tests/e2e/staff-families.mjs` (new): 64 checks after the journeys (61 on a fresh database, where the enrolled-family step skips).
- Docs: `docs/back-office.md` §9 (new), `docs/security.md` (what the audit log records), `README.md` (the browser test run order).
- `.orchestration/families/shots/`: screenshots.

## Proof

- `npm run check`: 0 errors, 0 warnings, 7 hints (the same 7 as before this unit; none from these files).
- `npm test`: 24 files, 495 tests pass, the 16 new ones included:
  - phone numbers in 5 formats;
  - letter case and parts of words;
  - a child's first name, and first plus last;
  - class titles;
  - `%` and `_` in a query;
  - no medical text in results;
  - A-to-Z order and paging, past the end included;
  - the three download tables;
  - notes: only the author edits or deletes them, other families are refused, all three changes are logged;
  - a staff care-details edit leaves `detailsConfirmedAt` unchanged and is stored encrypted;
  - a contacts edit uses the shared rules and leaves `contactsConfirmedAt` unchanged;
  - viewing a family's page is logged.
- `npm run build`: builds.
- Browser tests, run in order on a fresh `tests/e2e/serve.sh` database:
  - `enroll-journey` passes (23 checks);
  - `trial-journey` passes (15);
  - `content-editor` passes (11);
  - `navigation` passes (64);
  - `staff-foundation` passes (86);
  - `staff-families` passes (64).
- `staff-families` alone on a fresh database passes (61; the enrolled-family step skips, as designed).
- `staff-families` covers:
  - search by email (any case), by a phone number written with dots, and by a child's first name;
  - opening the family; Email, Call and Text links; care details open on a computer and on a tap on a phone, red for an allergy;
  - "No emergency contact on file";
  - adding, editing and deleting a note;
  - changing allergies and seeing the change; adding an emergency contact; a contact without a phone refused with a reason;
  - the Families list, and a family with classes and payments, linking to the class and payments pages;
  - all four downloads, with the notes download asking for a new sign-in once the session is 20 minutes old;
  - 404 for a signed-in parent;
  - nothing wider than 390 px on any of these pages.
- CI runs on the push; I haven't looked at its result.
- Screenshots in `.orchestration/families/shots/`, desktop and 390 px:
  - search results;
  - the Families list;
  - a family's page (the imported family, and an enrolled family with payments);
  - a note being added.

## Decisions

- **Download addresses.** The Family List is the search page's own `downloads(search())`. The other three are at `/admin/search/children|contacts|notes`, built from `search()` in `FAMILY_LISTS`, because `admin-links.ts` is off limits. The first three are on the Families list, not on search results; Family Notes is on each family's page. Each download covers everything, and the query doesn't filter it.
- **"This season"** is the term of the weekly class running today, else the next one to start. The content's terms ("Fall 2026") are what families call a season.
- **Back link** on a family's page: it returns to the search results when the browser says that's where staff came from (a same-site Referer), else to Families. This keeps the search words, which may be a child's name, out of the family page's address. After a save it falls back to Families.
- **Families in results:** a family is found by its name, a parent or a child, and lists who matched. Children are listed again in their own group, as the spec asks.
- **The pickup list alone gives no "Pickup note" badge:** it lists who else may collect a child, not a restriction. `restrictedPickup` is left unset.
- **Note authors** show the staff member's name, else their email ("hannah@example.com", since sign-in by code leaves the name empty).
- **Care details** start open on a computer and closed on a phone. A few lines of script do this; without script they start closed.
- **The page's own search box** shows on phones only. On a computer the top bar has one.
- **Staff write helpers are in `families.ts`, not `family.ts`.** `staffUpdateCareDetails` is like `updateStudentDetails` but doesn't set `detailsConfirmedAt`, and photo permission can be left unanswered.

## Open points

1. **Foundation bug: every badge is green on every staff page.** In `src/styles/admin.css`, the "Status badges" `.badge` rule (about line 316) comes after `.badge--neutral|good|warning|alert` (line 248) and sets its own green background. They have the same specificity, so the tones lose. My page restates the tones in scoped styles. **Recommended:** the foundation or coordinator moves the four tone rules after `.badge` (or drops `background`/`color` from `.badge`). My scoped lines can then go.
2. **Download addresses in `admin-links.ts`?** **Recommended:** add `familyLists()` there (children, contacts, notes) when someone next touches it. `FAMILY_LISTS` can then point to it.
3. **"This season".** **Recommended:** keep the term of the weekly class running today, and confirm with Hannah if she means the school year.

## Follow-up candidates

- Search parents' emergency contacts and pickup people too (staff may remember a grandparent's name).
- Filters on the Families list ("no emergency contact", "details not confirmed this year"): these belong to Today's "Needs attention".
- Show the staff name on notes once staff accounts have names (a name field on first sign-in).

## Handoff

- **Routes:**
  - `search(q)`: results;
  - `search()` and `?page=N`: the Families list;
  - `family(id)`: a family's page.
  - Its forms POST to the page itself with `action` set to `note-add`, `note-edit`, `note-delete`, `care` or `contacts`. A save returns with `?saved=…`.
- **Data shapes:**
  - `familyPage(householdId, content, viewerId)` returns `{ household, parents, children[{ id, firstName, name, age, birthdate, badges, allergies, medicalNotes, pickupNotes, photoConsent, detailsConfirmedAt }], classes[{ id, sessionId, orderId, child, title, term, current, status }], payments{ card, hasSavedCard, next, problems[], term, paidCents, orders[] }, notes[], emails[] }`, or null.
  - It decrypts care details and logs the view, so call it only for a page that shows them.
- **For Messages:** the "Emails sent" list reads `message_recipient` rows by `householdId`, joined to `message` (subject, `sentByUserId`), newest first, at most 100. Write `householdId` on each recipient row and they appear. A failed row shows "Didn't send".
- **For Today / Needs attention:** `familyDirectory(content)` lists every family with parents, emergency contacts, children and current classes. Its `emergencyContacts.length === 0` gives "no emergency contact".
- **Audit actions:** `admin.family.view`, `admin.note.add|edit|delete`, `admin.student.update`, `admin.household.contacts`, and `admin.download.csv|pdf` (entity `list`, id `families|children|contacts|notes`).
- **Off limits, untouched:** `src/server/family.ts`, `billing.ts` and `adjustments.ts` (read only), the shell, `admin-links.ts`, `admin.css`, and family pages.
