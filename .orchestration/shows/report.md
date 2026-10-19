# Shows unit: report

Branch `claude/bo2-shows`, from `claude/blissful-archimedes-enun5m` (3ab1c0a). No compaction or restart happened in this session.

## Result

Each show now has a cast list with roles, groups, order and photo permission, a program download, and rehearsals. Rehearsals appear on the staff calendar, on teachers' Today and in families' accounts. Casting creates no charge of any kind, and there is no new migration.

**By file**
- `src/server/shows.ts` (new): the shows list, cast suggestions from the performing classes, cast changes (add, edit role and group, move, another role, remove), downloads (program, staff sheet), rehearsals (add, change, remove; Athens time ↔ instants), who sees which rehearsal (teachers, families, the calendar file), the change email and the cast audience. Every change writes to the audit log with ids only.
- `src/pages/admin/shows/index.astro`, `[slug].astro`, `[slug]/email.astro`, and `[slug]/program.csv|pdf.ts`, `[slug]/cast-sheet.csv|pdf.ts` (new).
- `src/components/admin/RehearsalFields.astro` (new): the rehearsal form's fields.
- `src/lib/admin-links.ts`: `shows()`, `show(slug)`, `showEmail(slug)`.
- `src/components/admin/AdminShell.astro`: **Shows** after Calendar in the top bar and the phone menu (not a tab); `StaffSection` gains `shows`.
- `src/server/calendar.ts`, `src/pages/admin/calendar.astro`: the `rehearsal` entry type (teal), in month, week and the phone list, with filters; `calendarRehearsals`. Rehearsals also appear in the Daily Class Schedule download.
- `src/pages/admin/teach/index.astro`: a read-only rehearsal card on Today (`teacherRehearsals`).
- `src/pages/account/index.astro`: under "Coming up", "Juniper: Narrator, Moon, in Fall 2026 Variety Show", its dates, and each rehearsal the child is called to, with its note.
- `src/lib/ics.ts`, `src/pages/account/calendar/[enrollmentId].ics.ts`: the class's calendar file adds the child's rehearsals for that class as one-off events (`extras`).
- `src/components/admin/MessageComposer.astro`: an optional `emptyText` prop (default unchanged).
- `docs/back-office.md` §1 (three link rows) and a new **§21 Shows**; `docs/security.md` gets one row; `README.md` adds `staff-shows.mjs` to the test list.
- Tests: `tests/unit/shows.test.ts` (22 tests) and `tests/e2e/staff-shows.mjs`.

**For Hannah:** Shows in the menu lists every show with "N in the cast". On a show's page she can:
- add a whole performing class with one tap, or find any child by name;
- type roles and groups in place, and order the cast with ↑ ↓;
- give a child a second role, and see photo permission at a glance;
- copy the cast's emails or phones, or Email the cast;
- download the cast list for the program, and a staff sheet with photos, class and parents' phones;
- add, change or remove rehearsals. After a change she can tap "Email the families about this change": the composer opens filled in, with only the families affected ticked.

**For teachers:** a rehearsal card on Today for their classes (time, place, note). They see no cast and can't open the show's page.

**For families:** their child's role in each upcoming show and the rehearsals they're called to, in their account and in the class's calendar file. They see nothing about other children. The show's public page is unchanged.

## Proof

- `npm run check`: 0 errors, 0 warnings (14 hints, the same deprecation hints as before in the existing browser tests).
- `npm test`: 37 files, **732 tests pass** (710 before, plus the 22 new ones in `shows.test.ts`).
- `npm run build`: complete.
- Browser tests, baseline on the starting branch: all 16 pass, in the README's order.
- Browser tests on this branch, every test in the README's order on one fresh database, `staff-shows.mjs` last: **all 17 pass** (second full run).
  - **The first full run** had 3 failures:
    - `staff-foundation.mjs` checks the exact list of top-bar sections. I added "Shows" to that one line, the only check of the old menu.
    - My own `staff-shows.mjs` assumed Juniper was the only Stories and Songs child, but earlier tests add others. The check now says the Penwicks are ticked and Zara's family isn't.
    - `staff-families.mjs` timed out waiting for the Family Notes download after a fresh sign-in. That code is untouched by this unit, and the test passed in the baseline and in the second run, so I take it as a timing flake. Untouched.
- `staff-shows.mjs` covers:
  - Shows in the top bar and the phone menu;
  - Add everyone from Stories and Songs, finding a child by name (a form post), roles and groups, a second role, photo permission, up and down;
  - the program CSV's columns and order, the PDF, and the staff sheet;
  - a teacher added for Stories and Songs, then a rehearsal for that class (shown in Athens time), on the calendar's month, phone list and week;
  - the teacher's phone Today (read-only, no cast; the show's page is a 404 for them);
  - the family's account: role line, rehearsal, no other children, and the calendar file;
  - a change offering a filled-in email with only the families called to it ticked;
  - 390 px: no sideways scrolling, no wrapped buttons, 44 px targets.
- Screenshots are in `.orchestration/shows/shots/`, at desktop and 390 px: the shows list, a show's cast, the rehearsal form, the calendar with a rehearsal, the teacher's Today and the family's account.

## Decisions

1. **Cast emails are logged as `kind: 'class'` messages with `session_id = 'show:<slug>'`** (`showMessageKey`). This needs no schema change (no migrations allowed), and the composer, "Earlier emails" and the family page's "Emails sent" all work unchanged. It's easy to reverse if a `show` kind is added later.
2. **Cast changes don't need a fresh sign-in; downloads do.** Cast changes touch no money and no care details. Every change is still audit-logged.
3. **Viewing a show's page isn't audit-logged.** It has no care details: only names, roles and the photo yes/no. Rosters are logged because they show care details.
4. **"Current sessions" of a performing class** are its staff sessions that haven't ended by today. For a past show, they're the sessions running on its first date.
5. **Whole-cast rehearsals:** every child in the cast is called. Teachers of the performing classes' current sessions see the rehearsal. Owners see every rehearsal on the teacher app's Today.
6. **Rehearsal cards come from `teacherRehearsals` in `shows.ts`, not inside `teachCards`.** This keeps the `TeachCard` shape and the attendance code unchanged (this unit doesn't touch attendance). The page shows both.
7. **New cast rows start with an empty role.** "Another role" adds a second row for the same child; one child can't have two empty roles, so the empty one gets named first.
8. **The program download has one row per role** ("Juniper Penwick, Narrator" and "Juniper Penwick, Moon"), in the cast's order, because a program lists each role.
9. **The family's change email ticks the families called to the old or new rehearsal.** Everyone else in the cast stays unticked but can be ticked. The change address carries times and ids only.
10. **Rehearsals in the calendar file:** the child's rehearsals called for that class, plus whole-cast ones. Their ids are per rehearsal and child, so importing two classes' files doesn't make duplicates.

## Open points (with recommended answers)

1. **Should rehearsals show in the teacher app's "This week" too?** Recommended: yes, in a later small change. Today only for now, as asked.
2. **Should a staff Today (`/admin`) show today's rehearsals?** Recommended: yes, beside today's classes. Not built here, to stay out of `today.ts`.
3. **The Daily Class Schedule download now includes rehearsal rows,** with the classes in brackets and no student count. Recommended: keep them, since the download matches the calendar.
4. **Photo permission "Not asked":** children added through the account (not the details step) have no answer. Recommended: Hannah asks those families. The cast and the sheet show "Not asked".

## Follow-up candidates

- Rehearsal attendance in the teacher app (`attendance` is per class date today).
- Rehearsal conflicts collected from families (the research's "nice to have").
- A "Cast" filter in the tags unit's lists (kept apart here on purpose).
- The cast on a child's row of the family page (staff side).
- The same `show:<slug>` key could label cast emails on a family's page as "Email the cast: <show>".

## Handoff

- **Routes:** `/admin/shows` (`shows()`), `/admin/shows/<slug>` (`show(slug)`), `/admin/shows/<slug>/email` (`showEmail(slug)`); downloads `downloads(`${show(slug)}/program`)` and `/cast-sheet`.
- **Functions** (`src/server/shows.ts`):
  - cast: `castList(slug)` → `CastRow { id, studentId, householdId, firstName, lastName, family, role, group, position, photo }`, `castSuggestions`, `addToCast`, `updateCast`, `moveCast`, `removeCast`, `castAudience` (an `AudienceFamily[]`), `programTable`, `castSheet`;
  - shows: `performingSessions(event, content, on)`;
  - rehearsals: `rehearsalsFor`, `rehearsalsBetween(from, to)`, `rehearsingSessions`, `childCalled`, `teacherSeesRehearsal`, `teacherRehearsals`, `familyShows`, `childRehearsals`, `rehearsalFamilies`;
  - time: `athensInstant`, `athensParts`, `rehearsalWhen`, `rehearsalLine`.
- **Data:** `show_cast.role` is `''` until named; `position` is renumbered 0…n on each move. `show_rehearsal.session_ids` `[]` = the whole cast.
- **Audit actions:** `admin.cast.add|update|move|remove` (entity `student`, `detail` slug); `admin.rehearsal.add|update|remove` (entity `show_rehearsal`, `detail` "slug date"); `admin.download.csv|pdf` with id `cast-program:<slug>` / `cast-sheet:<slug>`.
- **Messages:** cast emails are `message.kind = 'class'` with `session_id = 'show:<slug>'`. Reports counting class emails should leave out `session_id` values that start with `show:`.
- **Calendar:** `CalendarEntry.kind` can now be `'rehearsal'`; `CalendarData.rehearsals` is optional, so existing callers are fine.
- **Shared files touched (own lines only):** `README.md` (one test line), `docs/back-office.md` (§1 rows, §21: renumber at merge), `src/lib/admin-links.ts`, the shell's menu, `src/server/calendar.ts`, the account page, `MessageComposer.astro` (optional prop).

## Compaction

None.
