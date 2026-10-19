# p2-foundation: report

Branch `claude/bo2-foundation` (from `claude/blissful-archimedes-enun5m` at 6a5394d). No compaction or restart happened during this unit.

## Result

**For Hannah:**
- **Settings in the menu.** A new **Settings** section appears on the computer and in the phone menu, with **Staff** under it.
- **Adding people.** She can add a teacher or another owner by name and email. Nothing is emailed to them.
- **Each person's page.** She can:
  - choose their classes: Not teaching, Teaches or Assists, for every current or upcoming class;
  - add substitute dates: class, date, and optionally who they cover for;
  - change their name and role;
  - turn them off, or back on.
- **Confirming first.** Every change asks her to confirm it's her (a new code) if she signed in more than 15 minutes ago.
- **Owners set on the host** (the `ADMIN_EMAILS` emails) are listed as "Owner (set by the site)". They can't be turned off on the site. Their name can be changed, and they can be given classes.
- **Shared devices.** The staff sign-in now has a "This is a shared device" box. When it's ticked, the session ends after an hour without use.

**For teachers:**
- **Signing in.** They sign in at `/admin` with the emailed code and land on `/admin/teach`. That page shows "Hi, Riley", today's classes (marked Assisting, Substitute or Day off) and "Classes you teach". It's a placeholder: the teacher app unit adds rosters and attendance there.
- **What they're kept out of.** Every owner page shows them the Staff only panel (404) with a **Go to your classes** button. That covers payments, families, search, classes (their own included), the editor, settings, Needs attention and every download.
- **The installed app.** They can open "Put the app on your phone".

**For families:** nothing changes.

**By file:**
- `drizzle/0011_phase2.sql` (+ meta), `src/server/db/schema.ts`:
  - 19 new tables: staff, class_teacher, class_cover, attendance, class_report, closure, drop_in, tag, student_tag, household_tag, skill, student_skill, progress_note, show_cast, show_rehearsal, credit, refund, report_favorite, staff_setting;
  - 4 new columns: `session.shared_device`, `enrollment.cancelled_at`, `enrollment.drop_reason`, `billing_adjustment.closure_id`;
  - exported types for all of them.
- `src/server/staff.ts`:
  - `roleFor`, `staffMember`, `isOwner`, `isEnvOwner`;
  - `requireTeacherOrOwner`, `markSharedDevice`, `SHARED_IDLE_MINUTES`;
  - `readSession` now returns `role`, `staffId` and `sharedDevice`. The idle rules cover teachers, and shared devices get the 1-hour rule.
- `src/middleware.ts`, `src/env.d.ts`: `locals.staffRole` and `locals.staffId`. `locals.isAdmin` still means owner.
- `src/server/teachers.ts` (new): `teacherSessions`, `canTeach`, `classTeachers`, `coversFor`, `teacherClasses`, `meetsOn`.
- `src/server/staff-settings.ts` (new): the list, add, update, turn off and on, classes, substitute dates; all audited.
- Settings pages: `src/pages/admin/settings/index.astro`, `staff/index.astro`, `staff/[staffId].astro`.
- `src/pages/admin/teach/index.astro`: the teacher placeholder.
- `src/pages/api/staff/shared-device.ts`.
- `src/components/admin/AdminShell.astro`:
  - the Settings section;
  - a `teachers` prop;
  - a smaller shell for teachers (no search, no tabs, one section);
  - the panel's wording for teachers;
  - the shared-device box on the sign-in.
- `src/components/portal/SignInPanel.astro`: the `sharedDevice` option. `src/pages/admin/confirm.astro` offers it too, and its wording now covers changes as well as downloads.
- `src/pages/admin/index.astro` sends teachers to `/admin/teach`. `src/pages/admin/install.astro` is open to teachers.
- `src/server/adjustments.ts`: the owner check now uses `isOwner`, so an owner added on the site can give discounts. The money logic is unchanged; only `closureId: null` was added to the draft row's type.
- **Cleanups from Phase 1:**
  - `classes.ts`: one-off nights don't count as "under 5".
  - `admin-links.ts`: new `classSignInSheet`, `familyLists`, `settings`, `settingsStaff`, `settingsStaffMember` and `teachHome`. `FAMILY_LISTS` was removed and its uses switched.
  - The badge workarounds are removed from the class page, the classes list, the family page and the composer.
  - The 5 content-editor pages now use `requireStaff`.
  - `roster-changes.ts` sets `cancelled_at` when it removes a child. `family.ts` (`fulfillOrder`) clears `cancelled_at` and `drop_reason` when the child signs up again. No money logic changed.
- `src/pages/dev/age-session.ts`: a new `idleMinutes` option, for development only.
- `package.json`, `package-lock.json`: sharp 0.35.5.
- **Docs:**
  - `docs/back-office.md`: the routes, shell and signing-in sections are updated; new §15 (roles and teachers) and §16 (Phase 2 data, unit by unit);
  - `docs/security.md`, `docs/content-editor.md` and `README.md` are updated.
- **Tests:**
  - new `tests/unit/staff-roles.test.ts` (23 tests);
  - additions to `classes`, `admin-links` and `roster-changes` tests;
  - new `tests/e2e/staff-settings.mjs`;
  - one line changed in `staff-foundation.mjs` (below).

## Proof

All runs used blanked Stripe keys.

- **Types:** `npm run check` gives 0 errors and 0 warnings. There are 11 hints, all already there before (deprecation hints, mostly `waitForNavigation` in the browser tests).
- **Unit tests:** `npm test` passes 31 files and 608 tests (584 before).
- **Build:** `npm run build` completes.
- **Browser tests:** `npm run build && tests/e2e/serve.sh` on a fresh database, then every test in README order. All 13 pass:

  | Test | Checks |
  |---|---|
  | enroll-journey | 23 |
  | trial-journey | 15 |
  | content-editor | 11, including "Uploaded a photo and used it" with sharp 0.35.5 |
  | navigation | 64 |
  | staff-foundation | 86 |
  | staff-contacts | 27 |
  | staff-classes | 59, including the Allergy badge still red (rgb(253, 227, 223)) after the workaround was removed |
  | staff-families | 64 |
  | staff-payments | 68 |
  | staff-today | 39 |
  | staff-messages | 46, with `SERVER_LOG` |
  | staff-roster | 48 |
  | staff-settings | 43 |

  This was run on the final code. An earlier full run before the last fixes also passed.
- **The Render preview step:** on an empty folder, `PGLITE_DIR=.data/preview-check npm run db:prepare-preview` says "Demo database ready (peak memory 384 MB)". All 19 new tables and 4 new columns are present afterwards.
- **A fresh database:** unit tests (in-memory PGlite) and `serve.sh` both migrate from scratch.
- **Dependencies:** `npm audit` no longer lists sharp. It still lists http-cache-semantics and source-map-js (follow-ups).
- **Not run:** I didn't re-run the coordinator's December billing check ($80.75 and $55). No billing code changed.
- **Screenshots** in `.orchestration/p2-foundation/shots/`:
  - Settings → Staff and a person's page, at desktop and 390 px;
  - the teacher's home, at desktop and 390 px;
  - the shared-device sign-in and the teacher's Staff only panel, at 390 px.

## Decisions

1. **Who the `staff` table points at.**
   - Assignments (`class_teacher`, `class_cover`, `report_favorite`) use `staff.id`, because a teacher can be assigned before they've ever signed in.
   - "By" columns (marked_by, created_by…) use `user.id`, like the rest of the schema.
   - There is no `staff.user_id`. Staff rows match users by lowercase email.
2. **Owners from `ADMIN_EMAILS` get a `staff` row the first time they're seen.** This lets Hannah be put on classes and star reports. `ADMIN_EMAILS` always wins over the row's role and on/off.
3. **"Deactivate" is called "Turn off" on screen.** It's plainer for Hannah. Their sessions aren't deleted: the role check on every request removes their access, and a person who is also a parent keeps their family sign-in.
4. **Owners can't lock themselves out.** You can't turn yourself off or drop your own owner role.
5. **A teacher at any owner page gets the panel, even for a class they teach.** The owner class page has payments, remove and add controls and downloads. Their roster belongs in the teacher app, and `canTeach` is ready for it. The panel's button takes them to their classes.
6. **A cover keeps the original teacher's access.** The cover adds access for the substitute; it doesn't take any away.
7. **Settings pages ask for a fresh sign-in.** When the sign-in is older than 15 minutes, the forms are replaced by "Confirm it's you" instead of throwing away what Hannah typed. A POST without one is still redirected to confirm.
8. **Shared-device sessions are marked as used at most every 5 minutes.** This keeps the 1-hour idle rule without a database write on every request.
9. **A person's own page, `/admin/settings/staff/<id>`, besides the list.** It's clearer on a phone than one long page.
10. **Extra data, added now because later units can't add migrations:**
    - `attendance.reason`, for absence reasons from Settings;
    - `progress_note`, for "progress notes to families";
    - `staff_setting`, for email wording and reasons;
    - `enrollment.cancelled_at` and `drop_reason`, for drop reports and drop reasons;
    - `billing_adjustment.closure_id` and `credit.adjustment_id`, so days off and credits go through the existing `adjustments.ts` instead of new billing paths;
    - `credit.removed_at` and `removed_by`;
    - `refund.error`;
    - `closure.adjusted_by`;
    - `show_cast.position`;
    - `skill.created_by`.
11. **Uniqueness rules for later units:**
    - `drop_in`: one booking per child, class and date, counting only bookings with status `booked`;
    - `closure`: one per date and class, and one "every class" day off per date;
    - `tag`: unique per kind, ignoring case.
12. **The teacher placeholder shows day offs already.** It reads `closure`, so the calendar and teacher app units see days off the same way.
13. **The confirm page says** "We ask for a new code before changes like this one" when it isn't a download.

## Open points

- **The owner's name shows as their email until edited.** An `ADMIN_EMAILS` owner's row starts with their account name, and new sign-ins have none. Recommendation: Hannah sets her name once on her Settings page.
- **Should teachers see their own class's page?** Recommendation: no. The teacher app unit builds its own roster page, guarded by `canTeach`.
- **The address in the "Add a person" note.** It says "They sign in at littlecharacters.org/admin". Recommendation: keep it; it's right for production.

## Follow-up candidates

- `npm audit fix` for http-cache-semantics and source-map-js. Both have non-breaking fixes; they weren't in this unit's scope.
- A short guide for Hannah to Settings → Staff, in the style of `staff-billing.md`.
- "Last sign-in" per staff member and family (a Studio Director report): it can come from the newest `session.created_at`.
- Email bounces: `message_recipient.status` is plain text, so a `bounced` value needs no migration.

## Handoff

- **Routes** (`admin-links.ts`):
  - `teachHome()` → `/admin/teach`;
  - `settings()`, `settingsStaff()`, `settingsStaffMember(id)`;
  - `classSignInSheet(id)`, `familyLists()`.
  - The teacher app adds its own pages under `/admin/teach/…` with `<AdminShell teachers section="teach">` and `requireTeacherOrOwner`. Settings pages go under `/admin/settings/…` with `section="settings"`, plus a tile on `settings/index.astro`.
- **Locals:**
  - `staffRole` is `'owner' | 'teacher' | null`;
  - `staffId` is a `staff.id`;
  - `isAdmin` means owner.
- **Checks:**
  - `requireStaff` is for owners;
  - `requireTeacherOrOwner(locals)` returns `{ staff: { …user, role, staffId }, response }`;
  - `requireFreshStaff` is for owners' sensitive steps;
  - `isOwner(person)` is for server functions that change money.
- **Teachers:**
  - `teacherSessions(staffId, date, catalog?)` returns `{ sessionId, program, session, as: 'lead'|'assistant'|'cover', coveringForStaffId, dayOff }[]`;
  - `canTeach(staffId, sessionId, date)`;
  - `classTeachers(sessionId)`, `coversFor(sessionId, date?)`, `teacherClasses(staffId)`, `meetsOn(session, date)`.
  - **The teacher app must call `canTeach` on every class and date it shows, and log roster views.**
- **Data rules per table** are in `docs/back-office.md` §16. The most important:
  - attendance upserts on (session, date, student). A tap whose `client_id` is already stored changes nothing. Apply a change only when its `marked_at` is newer than the row's. Refuse days off.
  - Days off and credits lower charges through `billing_adjustment` (with `closure_id`, or linked from `credit.adjustment_id`), never a new billing path.
  - Refunds write a `pending` row first and use its id as Stripe's idempotency key.
  - A drop-in's price is stored at booking.
  - `staff_setting` keys are documented by the unit that owns them.
- **Tests:** `/dev/age-session` takes `idleMinutes`. `?on=YYYY-MM-DD` works on `/admin/teach`. The new browser test runs last.
- **Existing test changed:** `tests/e2e/staff-foundation.mjs` line 88. The expected top-bar sections now end with "Settings", because this unit adds that section. Nothing else in the existing browser tests changed. The content editor's family check didn't need a change: its visitor isn't signed in, so they still see the sign-in.
