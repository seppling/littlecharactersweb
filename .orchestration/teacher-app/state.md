# teacher-app: state

Branch `claude/bo2-teacher-app`, from `claude/blissful-archimedes-enun5m` (acfb1b2).

## Plan
1. Server: `src/server/attendance.ts` (access rule, roster for a date, idempotent taps, class report, alerts data, missed-two), `/api/teach/sync`, note-read endpoint.
2. Pages: `/admin/teach` (Today + This week), `/admin/teach/{sessionId}/{date}` (roster), `/admin/teach/me`; shell tabs for teachers; owner menu link.
3. Offline: `public/admin/teach-sw.js` (scope /admin/teach), IndexedDB queue in the pages' script.
4. Owner side: Today chips + notes, `attendance` and `missed2` attention kinds, class page Attendance + CSV/PDF, family page missed counts, badge.
5. Cover emails. 6. Unit tests, e2e `staff-teach.mjs`, docs §18, report.

## Commits
(none yet)

## Decisions
(see report.md when written)

## Open questions
none

## Next action
Write src/server/attendance.ts.
