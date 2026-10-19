# teacher-app: report

Branch `claude/bo2-teacher-app`, from `claude/blissful-archimedes-enun5m` (acfb1b2). No new migrations. No compaction or restart happened in this session.

## Result

**For teachers:** on a phone, `/admin/teach` opens on today's classes. Each class shows the time, the location, how many children are expected, and a status chip: Not taken, Saved on this phone, sending…, or Done ✓. Days off are greyed out. Below that is the coming week. A tap opens the class: Mark all present, a big Present / Absent toggle on each child, and Late, Left early and a short note under More. A tap on a name opens that child's care details, who may pick them up, the parents with Call and Text, and the emergency contacts. At the bottom are the note to Hannah and Submit attendance. All of this works with no signal: taps are saved on the phone and sent when signal comes back, and the page reopens offline. The phone tabs are Today and Me.

**For Hannah:**
- Today shows "Attendance done ✓", or "Not taken" once a class has ended. Notes from teachers stay on Today until she marks them read.
- Needs attention has two new warnings: "Attendance not taken", and children who missed the last two classes.
- Each class page has an Attendance list, with CSV and PDF downloads.
- Family pages show "Missed N classes this season".
- Rosters show the badge "Missed the last two".
- Adding a substitute emails both teachers.
- "Take attendance" is in the phone menu and among Today's quick links.

**By file**
- `src/server/attendance.ts` (new):
  - the access rule `teachAccess` and `classDateFor`;
  - the roster for one date: `expectedOn` and `teachRoster`;
  - idempotent saves `saveTaps` and `saveReports`, with `syncInput`;
  - the home page: `teachCards` and `nextTeachingDay`;
  - Hannah's side: `reportsOn`, `reportKeys`, `attendanceState`, `endedHoursAgo`, `unreadNotes`, `markNoteRead`, `classAttendance`, `attendanceTable`, `attendancePdf`, `missedTwo` / `missedTwoFrom`, `childAttendance`, `attentionAttendance`;
  - the substitute emails: `sendCoverEmails`.
- `src/pages/api/teach/sync.ts`: phones send taps and reports here, as JSON. `src/pages/api/teach/note-read.ts`: an owner marks a note read.
- `src/pages/admin/teach/index.astro`: rewritten from the placeholder. New pages: `src/pages/admin/teach/[sessionId]/[date].astro` (the roster) and `src/pages/admin/teach/me.astro`.
- `src/scripts/teach.ts` (new): the IndexedDB queue, sending, clearing the cache, and registering the service worker. `public/admin/teach-sw.js` (new): the service worker, with scope `/admin/teach` only.
- `src/pages/admin/classes/[sessionId]/attendance.csv.ts` and `.pdf.ts` (new).
- Additions to shared files:
  - `src/components/admin/AdminShell.astro`: the teacher tabs (`.teach-tabs`), "Take attendance" in the owner menu, and sign-out clearing the phone's copy;
  - `src/styles/admin.css`: the `.teach-tabs` styles;
  - `src/lib/admin-links.ts`: `teachRoster`, `teachMe`, `classAttendance`;
  - `src/lib/badges.ts`: the `dropIn` and `missedLastTwo` inputs, with the keys `drop-in` and `missed2`;
  - `src/server/today.ts`: the kinds `attendance` and `missed2` in `attentionFrom`, `AttentionInput.attendance`, `TodayClass.sessionId/end`, and the attendance query in `loadCore`;
  - `src/pages/admin/index.astro`: the attendance chips, Notes from teachers, and the Take attendance tile;
  - `src/server/classes.ts`: the `missed2` badge in `classRoster`;
  - `src/pages/admin/classes/[sessionId].astro`: the Attendance part;
  - `src/server/families.ts` and `src/pages/admin/families/[householdId].astro`: classes missed this season, and the badge;
  - `src/server/staff-settings.ts`: one call to `sendCoverEmails` in `addCover`.
- Tests: `tests/unit/attendance.test.ts` (44 tests) and `tests/e2e/staff-teach.mjs`.
- Docs: `docs/back-office.md` has a new §18 and additions to §1, §2, §4, §7, §12 and §15. Also `docs/security.md` and the test list in `README.md`.

## Proof

- `npm run check`: 0 errors, 0 warnings.
- `npm test`: 33 files, 662 tests passed.
- `npm run build`: passed.
- Browser tests: a fresh build and a fresh database (`tests/e2e/serve.sh`), then every test in `README.md`, in its order, with `staff-teach.mjs` last. All 14 pass on the final commit: enroll-journey 23 checks, trial-journey 15, content-editor 11, navigation 64, staff-foundation 86, staff-contacts 27, staff-classes 59, staff-families 64, staff-payments 68, staff-today 41, staff-messages 46 (with `SERVER_LOG`), staff-roster 48, staff-settings 43, staff-teach 53.
  - **An earlier run failed in `staff-today`:** "signing out from the panel shows the staff sign-in". The cause was mine: sign-out held the form back until it had cleared the phone's copy, so the test looked before the page moved on. Fixed in my code, not in the test. Sign-out now goes on at once, and the staff sign-in page clears the copy once it loads (`clearWhenSignedOut`). No existing browser test was edited.
- Screenshots are in `.orchestration/teacher-app/shots/`:
  - the teacher's Today: `teach-today-phone`, `teach-today-desktop`;
  - a roster: `teach-roster-sent-phone`, `teach-roster-desktop`, `owner-roster-desktop`;
  - the child sheet: `teach-child-sheet-phone`, `-desktop`;
  - offline and sent: `teach-roster-offline-phone`, `-desktop`, `teach-roster-back-online-phone`, `teach-roster-sent-desktop`;
  - Hannah's Today with a note: `owner-today-note-desktop`, `-phone`;
  - also `owner-class-attendance-desktop`, `owner-attention-desktop` and `teach-me-phone`.

## Decisions

- **"Preferred first name":** the `student` table has no such column, so rows show the first name and the last initial ("Maya R."). Adding the column would need a migration.
- **Late and Left early** are statuses of their own (`attendance.status` holds one value). Both count as there in "Present 9 of 12".
- **Submit needs every child marked** ("Mark everyone first (2 left)"). Mark all present makes that one tap. This is checked on the phone only; the server accepts a partial submission. Simpler, and a partial roll is still recorded.
- **The regular teacher on a cover date** is read-only when the cover names them, or when it names nobody and they're the lead. An assistant who still comes can keep marking.
- **"Same day" for teachers** is the class date. A tap made on the class date and sent the next morning still counts as made that day (judged by its time on the phone, which is never later than the server's now).
- **Old submissions:** an older report arriving late never replaces a newer one. A changed note clears `note_read_at`, so it returns to Today.
- **Change audit:** any update to an existing mark writes `teach.attendance.change` with the old and new status. First marks aren't logged one by one: the submission is logged.
- **The cache:** a page is kept only when it sends `X-Teach-Cache: <today>`. That covers the teacher's home and today's rosters the person teaches or covers; an owner's rosters only when the owner is on that class. Days are judged in real Athens time, so `?on=` test days still expire. Network first, falling back to the saved copy after 4 seconds.
- **Unsent taps from another person** stay on the phone. They're sent only under that person's own session (the server answers 409 otherwise), and dropped after 8 days.
- **What the phone stores:** the taps queue in IndexedDB, and the latest marks seen, keyed by ids. When a page opens from the cache, it shows marks newer than the cached copy.
- **The 7-day windows** count back from today: the alert covers today −7 through today, and teachers can still submit up to 7 days late.
- **A class with nobody** enrolled or booked never raises "Attendance not taken".
- **The class page's attendance** lists dates up to today, plus any later date already marked, so a test day shows.
- **Owners on the teacher home:** Today shows every class. This week shows only their own classes.
- **Background Sync** in the service worker deletes what the server answered, including refused taps. The page only reports refusals it sent itself. This keeps the worker small.

## Open points

1. **Alerts at launch:** when this deploys, every class in the previous 7 days shows "Attendance not taken", because no attendance exists yet. I recommend accepting the one week of noise, or setting a start date (a constant in `attentionFrom`) at deploy.
2. **Which classes need attendance:** one-off sessions (Parents' Night Out, workshops) also raise the alert when they have children. I recommend keeping this for classes and camps and dropping it for `workshop` and parties, but that's Hannah's call.
3. **Absence reasons** (`attendance.reason`) aren't asked for yet. I recommend adding them with the Settings unit's list of absence reasons.
4. **Preferred names:** a `preferred_name` column needs a migration. I recommend it for a later wave if Hannah wants it.

## Follow-up candidates

- Push reminders to teachers: "Attendance not taken".
- Children's photos on the roster, when the parent consented. Initials are shown today.
- Rehearsal attendance, for the shows unit.
- A teacher's own attendance history page.

## Handoff

- Routes:
  - `teachHome()` = `/admin/teach`;
  - `teachRoster(sessionId, date, on?)` = `/admin/teach/<id>/<date>`;
  - `teachMe()`;
  - `classAttendance(sessionId)` = `/admin/classes/<id>/attendance` (downloads only);
  - `POST /api/teach/sync` with `{ by, taps[], reports[] }` returns `{ results: [{ clientId, result: saved|same|older|refused, why? }] }`;
  - `POST /api/teach/note-read` with `reportId` and `next`.
- The access rule is `teachAccess` (pure), read through `classDateFor(viewer, sessionId, date, catalog, today)`. Use it for any later screen that marks a class date (rehearsals, skills).
- Data: `attendance` holds one row per child, class and date (the upsert keeps the newest `marked_at`). `class_report` means "attendance done", with the note and `note_read_at`.
- Reports unit: use `classAttendance(session)`, `attendanceTable`, `missedTwo(...)` and `childAttendance(...)` for the attendance, absences and "missed two in a row" reports. `attentionAttendance(today)` feeds Needs attention.
- Calendar unit: days off come from `class-day.ts` (`dayOffOn`, `daysOffBetween`). The roster shows "No class today: <reason>" and the server refuses taps on a day off.
- Drop-ins unit: booked drop-ins appear on the roster through `dropInsOn`, with the `drop-in` badge (`BadgeInput.dropIn`). If your branch also adds `dropIn` to `badges.ts`, keep one of the two.
- Audit actions: `teach.roster.view|cache`, `teach.attendance.change|submit|resubmit`, `admin.attendance.note_read|csv|pdf`.

## Compaction

None occurred.
