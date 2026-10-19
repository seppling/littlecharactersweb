# Calendar unit: report

Branch `claude/bo2-calendar` (from `claude/blissful-archimedes-enun5m` at acfb1b2). No compaction or restart occurred.

## Result

**For Hannah**
- **Calendar** (top bar after Classes; phone menu): every class with its time, title and "8/12", the site's events, and days off (a red band for every class; a struck-through class for its own). Today is outlined. Month grid on a computer, the same month as a list of days on a phone, and a Week view with each class's class page and that date's Attendance link. Filters: program, location, teacher. Downloads (fresh sign-in): Daily Class Schedule and Class Schedule, CSV and PDF.
- **Settings → Days off** (a tile on Settings): add a date or a range, every class or some, and a reason; "Check what changes" shows every class (children), each monthly payment now and lowered by one class, "Already paid: give a credit", "No change" (paid up front, by the session, free first class, no charge), drop-ins booked, and refuses a class whose attendance was taken. She must pick "Lower that month's payments by one class" or "Don't change payments" before Save (fresh sign-in). The list shows upcoming and past days off, what was done about payments, the families to credit, and Remove (with a preview of the payments that go back up).
- **A class's page:** a Dates part: every meeting, days off struck through with the reason, past dates greyed, "N classes left", and "Add a day off" that ticks that class.
- **Today:** "No classes today: Thanksgiving" on an every-class day off; "Day off: reason" on a class's own.

**For families**
- One short email per family: "No class Dec 8", each child and class, and "your December payment is now $36 (was $55)" when it changed. Only for dates today or later.
- Account: "No class Dec 8 (Snow day)" under each class in Coming up ("Next" skips days off); a lowered month shows "Day off Dec 8 (Snow day): −$19".
- The class's public page lists "No class …" under each date; both calendar files (.ics) leave days off out (EXDATE).
- Prices, `meetings()`, proration and a new family's first month are unchanged.

**Files**
- New: `src/server/days-off.ts`, `src/server/calendar.ts`, `src/pages/admin/calendar.astro`, `calendar.csv.ts`, `calendar.pdf.ts`, `src/pages/admin/settings/days-off.astro`, `tests/unit/days-off.test.ts` (19), `tests/unit/calendar.test.ts` (5), `tests/e2e/staff-calendar.mjs`.
- Changed: `src/server/adjustments.ts` (target installment, `closureId`, `insertAdjustments(tx, …)`; exported `reapply`, `draft`, `checkInput`, `logSettled`, `Tx`; `addAdjustment` behaves as before), `src/lib/pricing.ts` (`classDaysInMonth` exported only), `src/lib/admin-links.ts` (`calendar`, `classDayRoster`, `settingsDaysOff`), `AdminShell.astro` (Calendar section/menu), `src/server/today.ts` (`TodayClass.sessionId`/`dayOff`, `todayClasses().closed`), `src/pages/admin/index.astro`, `src/pages/admin/classes/[sessionId].astro`, `src/pages/admin/settings/index.astro`, `src/pages/account/index.astro`, `src/pages/programs/[slug].astro`, `src/lib/ics.ts` + both `.ics` routes, `docs/back-office.md` (§18 + link table), `docs/staff-billing.md` ("Days off"), `README.md` (test list), `tests/e2e/staff-foundation.mjs` (one line: the top-bar section list now includes Calendar).

## Proof

- `npm run check`: 0 errors, 0 warnings.
- `npm test`: 34 files, 642 tests pass (618 before + 24 new).
- `npm run build`: succeeds.
- Fresh database (`tests/e2e/serve.sh`), every README browser test in order: enroll-journey, trial-journey, content-editor, navigation, staff-foundation, staff-contacts, staff-classes, staff-families, staff-payments, staff-today, staff-messages (with SERVER_LOG), staff-roster, staff-settings, staff-calendar: all 14 pass.
- Billing check: copy of `.data/e2e` after the two journeys, `APP_ENV=development PGLITE_DIR=<copy> npm run -s billing:run -- --today 2026-12-01` (keys blank): `$80.75 · December tuition: Ava…` and `$55 · December tuition: Maya…`.
- In `staff-calendar.mjs`: Dec 8 day off for Intro to Theater with "Lower": preview Maya $55 → $36 (−$19 = $95 ÷ 5 December Tuesdays, after her $40 scholarship); Ava listed as "Already paid: give a credit" $16.15 (staff-payments had marked her December paid earlier in the run); email in the dev mailbox; Maya's account shows "No class Dec 8 (Snow day)" and $36; December's billing run on a copy charges `$36` and not `$55`; Remove puts it back to $55; an every-class "Don't change payments" day off; calendar band; Today "No classes today: Winter break"; downloads; 390 px with no sideways scroll and 44 px tap targets.
- Screenshots: `.orchestration/calendar/shots/` (month desktop, phone agenda, class dates desktop and phone, day-off preview desktop and phone, days off desktop and phone, family account).

## Decisions

- **Days added together are one group** (same `closure.created_at`), listed and removed together: a week's break is one line. Simple, no migration.
- **The choice is stored as `closure.adjusted_at`** (set = lowered; null = don't change), as the brief said.
- **"Already paid: give a credit" is recorded** in the audit log (`admin.day_off.credit_due`, entity order, detail = closure id) and shown on the Days off list, for the credits unit.
- **A payment being charged right now** counts as already paid (no adjustment), so Hannah never sees a lowered amount that was charged in full. A failed one with the pay-now page open is lowered and catches up at the billing run, as adjustments already do.
- **Attendance taken blocks the whole save**; she unticks that class (or picks classes instead of every class). Simpler than partial every-class rows.
- **Booked drop-ins are listed, not cancelled** (the drop-ins unit owns cancelling); their families get the "No class" email.
- **Emails only for dates today or later**; a past day off is a record.
- **Removing a day off doesn't email families.**
- **A paid month's day-off adjustment is kept (not marked removed)** on removal, since it's what was charged; its `closure_id` goes null with the row.
- **`classDayRoster(sessionId, date)`** added to `admin-links.ts` for the teacher app's `/admin/teach/<id>/<date>` (that unit may have its own name for it).
- **Every class means staff sessions** (`staffSession`); one row per date, including dates with no class.
- **The month view on a phone is the list** (CSS), so 390 px is the agenda by default with no extra parameter.

## Open points

1. **Email when a day off is removed?** Recommend: yes, a short "Class is back on Dec 8" with the amount, in a later pass; today nothing is sent.
2. **Public `/calendar` page** doesn't exist (only `/calendar/<id>.ics`); the .ics files leave days off out. Recommend: nothing more until there is a public calendar page.
3. **Trial on a closed date:** a free first class booked for a day off is listed under "No change: Free first class"; Hannah moves it by hand. Recommend: fine for now.
4. **Family discount changing after a day off:** the day-off amount is fixed when saved (computed from that month's base then). Recommend: keep; it's rare and always in the family's favor or neutral.
5. **Overlapping days off:** a class with its own day off and a later every-class one on the same date: the class is skipped in the second; removing the first leaves the class off (by the second) without an adjustment. Recommend: accept; noted in docs.

## Follow-up candidates

- Credits unit: read `admin.day_off.credit_due` (or recompute) to turn "give a credit" into credits.
- Drop-ins unit: offer "Cancel and refund" from the day-off preview.
- Teacher app: leave classes with `TodayClass.dayOff` out of "Not taken"; use `dayOffOn` to refuse attendance (already in §17).
- Show rehearsals (`show_rehearsal`) on the calendar when the shows unit lands.

## Handoff

- Routes: `/admin/calendar` (`?month=YYYY-MM`, `view=week&week=YYYY-MM-DD`, `program`, `location`, `teacher`), `/admin/calendar.csv|.pdf` (`report=classes` for the Class Schedule), `/admin/settings/days-off` (`?class=<id>&which=some` prefill, `?step=check&…` preview, `?remove=<closure id>`).
- Links: `calendar(month?, params?)`, `classDayRoster(sessionId, date)`, `settingsDaysOff(sessionId?)`.
- `src/server/days-off.ts`: `previewDayOff`, `addDayOff`, `previewRemoval`, `removeDayOff`, `daysOffList`, pure `planDayOff`, `familyNotices`, `oneClassCents`, `noClassLine`, `datesLabel`. Adjustments: reason "Day off Nov 26 (Thanksgiving)", `kind amount`, `repeat once`, `installment_id` = that month's, `closure_id` set, shown to the family.
- `src/server/adjustments.ts`: `AdjustmentInput.installmentId?` / `closureId?`; `insertAdjustments(tx, staff, inputs, now)` for several on one order in the caller's transaction (credits can use it).
- `src/server/calendar.ts`: `calendarRange`, pure `calendarDays`, `teachersBySession`, schedule tables.
- `src/server/today.ts`: `TodayClass.sessionId`, `TodayClass.dayOff`; `todayClasses()` returns `closed` (an every-class `DayOff` or null).
- Shared-file additions: README test line, `docs/back-office.md` §18 (renumber at merge), admin-links (3 functions), AdminShell (Calendar entries), today.ts (fields above). No migrations.
- `tests/e2e/staff-calendar.mjs` runs after staff-settings and depends on its state (Ava's December paid, Maya's declined); it clears its own leftover days off, so it can be re-run.
