# Contacts unit: report

Branch `claude/bo-contacts`. No compaction or restart happened in this session.

## Result

**For families**
- The details step (`/enroll/details`) has a **Your family** part, asked once per family: emergency contacts (at least one, up to 4: name, relationship, phone), who else may pick up (optional, up to 4, phone optional; "Parents always may"), ZIP code (required), and "How did you hear about us?" (optional, a short list plus "Something else" with a text box, asked only while the family has no answer). It says who sees the details: Little Characters staff, and from spring the teachers of their children's classes.
- A family whose details were confirmed within a year gets one line with **Edit** in place of the form: "Emergency contact: Jordan Park (aunt) · Pickup: 2 people · ZIP 30601".
- The account page has a **Family details** section: the lists and ZIP, **Edit** (opens `/account/family`), and "Are these still right? … **Looks right**" when the details are older than a year or came from Studio Director. When something required is missing, it asks them to add it instead.
- The per-child field "Who else may pick up?" is now "Pickup notes for {name}" (for something about one child, like "only Dad on Tuesdays"); the child's page links to the family details for the list.
- The Studio Director welcome note now reads "Please check your family details and each child's details below."
- Policies: an unpublished wording draft for Hannah (privacy paragraphs 1–3), naming the new details, "just your ZIP code", and that teachers see contacts from spring.

**For Hannah**
- The staff link on her account page reads **Staff** and opens Today (`today()` from `admin-links.ts`, not edited).
- The import brings over emergency contacts and ZIP when the export has those columns.

**By file**
- `src/lib/family-details.ts` (new): `EMERGENCY_CONTACT_REQUIRED`, `HEARD_ABOUT`, `heardAboutLabel`, `familyDetailsComplete`, `familyDetailsOnFile`, `familySummary`, `personLine`, `familyDetailsInput`, `readFamilyForm`.
- `src/server/family.ts`: `getFamilyDetails`, `updateFamilyDetails`, `confirmFamilyDetails` (audit-logged as `household.details.update` / `household.details.confirm`, with no details in the log).
- `src/components/portal/FamilyDetailsFields.astro` (new): the shared fields. Shows rows for the people on file plus one empty row; "+ Add another" opens more, up to 4. Without scripts, saving brings a new empty row.
- `src/pages/enroll/details.astro`, `src/pages/account/index.astro`, `src/pages/account/family.astro` (new), `src/pages/account/students/[id].astro`.
- `src/lib/account.ts`: the welcome note's wording.
- `src/server/studio-director.ts`: new `FIELDS` (`emergencyName/Phone/Relationship`, a second set `emergency2…`, `zip`), `parseZip`; `ImportFamily.emergencyContacts`/`zip`. `scripts/import-studio-director.ts` needed no change: it prints the new fields from `FIELDS`.
- `src/content/seo-draft/pages.ts` (Policies draft), `docs/seo/review.md` regenerated.
- Docs: `docs/portal.md`, `docs/security.md`, `docs/back-office.md` (a paragraph for later units), `README.md` (the new browser test).
- Tests: `tests/unit/family-details.test.ts` (new), `tests/unit/studio-director.test.ts` (4 new), `tests/unit/account.test.ts` (wording). `tests/e2e/staff-contacts.mjs` (new). `tests/e2e/enroll-journey.mjs` and `trial-journey.mjs` fill in the new required fields, with a comment on each change. `tests/e2e/fixtures/studio-director-families.csv` now has made-up ZIP and emergency contact columns.

## Proof

- `npm run check`: 0 errors, 0 warnings.
- `npm test`: 24 files, 494 tests passed.
- `npm run build`: complete.
- Browser tests, all on one fresh `tests/e2e/serve.sh` server with the final build, in order: enroll-journey (23 checks), trial-journey (15), content-editor (11), navigation (64), staff-foundation (86), staff-contacts (27). All passed.
- staff-contacts covers: the required emergency contact (the browser stops on the first one; with the `required` attributes removed, the server says "Add at least one emergency contact" and keeps what was typed); "Add another"; "Something else"; a second enrollment showing the one-line summary, with "Edit" opening the form and the question not asked again; the account's Family details, an invalid phone caught next to its field, then saving; the imported family's "Looks right"; "Staff" for staff only; at 390 px, no sideways scrolling and 44 px or taller controls on each changed page.
- Policies screenshot: I loaded the drafts into the local test database (`APP_ENV=development PGLITE_DIR=.data/e2e npm run seo:load-drafts -- --commit`), then took the editor's Preview. Nothing is published.
- Screenshots in `.orchestration/contacts/shots/`:
  - `1-details-new-family(-390)`: the details step for a new family. `1b-details-filled`: filled in.
  - `2-details-on-file(-390)`: the summary line.
  - `3-account-family(-390)`, `3-account-390`: the account's Family details. `3b-account-family-edit(-390)`: the edit page.
  - `4-imported-family(-390)`: "Looks right" for an imported family.
  - `5-policies-preview(-390)`, `5-policies-draft`: the Policies line.
  - `0-enroll-journey-details`: the details step in the main journey.
- CI: pushed. I didn't wait for the run.

## Decisions

1. **Emergency contact required** (`EMERGENCY_CONTACT_REQUIRED = true` in `src/lib/family-details.ts`). This is a policy choice made for Hannah: **she should confirm it.** Setting the constant to false makes it optional everywhere: the forms, the "on file" rule, and the account's "please add" note.
2. **The rule applies on the account too**, not only at enrollment. Otherwise a parent could clear the list on the account and be asked again at the next sign-up. Reason: one rule is easier to explain.
3. **"On file" means complete and confirmed within a year** (ZIP plus, while required, an emergency contact). An imported or incomplete family gets the form. Reason: it's the same rule as the children's details, and it means nothing is missing.
4. **"How did you hear about us?" is a select menu**, not radio buttons. Reason: it keeps the step short on a phone. The answer is stored as a key (`friend`, `search`, `social`, `school`, `event`, `flyer`) or `other: <their words>` (up to 100 characters), so Reports can count it. A skipped answer stays empty, so the question comes back the next time the form is shown.
5. **Saving the family form confirms it** (`contacts_confirmed_at = now`), like saving a child's details.
6. **The per-child field was renamed** "Pickup notes for {name}". The column is the same; only the label and placeholder changed. Reason: the family's list now answers "who may pick up", and the task keeps the child's notes for restrictions about one child.
7. **The import never overwrites** contacts or a ZIP that a household already has. A contact with no usable phone is skipped and reported by row number only. Up to 4 contacts per family, one per phone number. A missing relationship is stored as `''`: the summary leaves out the brackets, and the form asks for it when the family edits. Plain "Relationship" isn't matched: it could be the parent's.
8. **No new migration**: everything uses the `0009_back_office` columns.
9. **`src/lib/contacts.ts`**: no real problem found, so it's unchanged.

## Open points

1. **Required emergency contact**: Hannah should confirm it. My recommendation: keep it required. Rosters need someone to call, and it's one row.
2. **Length of the step for a first-time family**: on a phone the family part adds about 8 fields below the child's (see `1-details-new-family-390.png`). It still feels like one step, but if Hannah finds it long, I recommend showing only "+ Add someone" for pickup people (no empty row) until it's tapped. That saves 3 fields on most first sign-ups.
3. **"How did you hear about us?" options**: only the six asked for, plus "Something else". Options Hannah might add (the site mentions these, but not as ways families find us): "Our newsletter", "A camp or Parents' Night Out", "A Geode class" (via a family member). I recommend waiting a season and adding whatever shows up often under "Something else".
4. **Policies "Who sees it" line**: the draft says teachers will see contacts from spring. Hannah should check it matches her plan for teacher rosters.

## Follow-up candidates

- Staff Reports: counts by ZIP and by `heard_about`. Use `heardAboutLabel` for the words.
- Teacher rosters (spring): emergency contacts with `telHref`/`smsHref`, and pickup people.
- An "Add someone" toggle for pickup people, if open point 2 is taken up.

## Handoff

- **Routes:** `/account/family` (GET form, POST save → `/account?saved=family#family`). `/account` POST `action=confirm-family` ("Looks right"). `/enroll/details?order=…&edit=family` opens the family form.
- **Server:** `getFamilyDetails(householdId)` → `{ emergencyContacts, pickupPeople, zip, heardAbout, contactsConfirmedAt }`. `updateFamilyDetails(householdId, input, userId)` and `confirmFamilyDetails(householdId, userId)`, both audit-logged.
- **Display:** `familySummary(f)` gives the one line; `personLine(p)` gives "Jordan Park, Aunt, (706) 555-0142"; `heardAboutLabel(stored)` gives the words.
- **Data shapes:** phones are stored by `normalizePhone` (10 digits for US numbers). ZIP is 5 digits (ZIP+4 is cut to 5). `heard_about` is a key or `other: …`.
- **Form field names:** `ec-<i>-name|relationship|phone`, `pu-<i>-…` (i from 0 to 3), `zip`, `heard`, `heard-other`. Parse them with `readFamilyForm(formData, { askHeard })`.
- **Import:** `FIELDS` gains `emergencyName`, `emergencyPhone`, `emergencyRelationship`, `emergency2Name/Phone/Relationship` and `zip` (also usable with `--map`).
- **Shared fixture:** `tests/e2e/fixtures/studio-director-families.csv` now has Zip and emergency contact columns (made-up). The Okafor family imports with "Femi Okafor, Uncle" and ZIP 30605, unconfirmed.

## Compaction

None.
