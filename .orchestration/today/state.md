# Today unit: state

## Commits
- (1) Today, Needs attention, shell fixes: code and unit tests.

## Decisions
- One new query (`enrolledChildren` in `src/server/today.ts`) for emergency contacts, care details, sign-ups and birthdays, instead of `familyDirectory`: the directory has no birthdates, confirmation dates or enrollment dates and statuses, and costs four queries over every family.
- The count on the Alerts tab and on Today: three queries (billing overview, class counts, enrollments), cached per request by `Astro.locals` (a WeakMap), shared with the page's own list.
- Staff-only panel: `requireStaff` returns a 404 with no body; Astro then renders `src/pages/404.astro` (status kept), which shows the shell's "Staff only" panel on `/admin` addresses for signed-in non-staff.
- Dev-only `?on=YYYY-MM-DD` on Today and Needs attention, for browser tests (ignored in production via `isProd`).

## Open questions
- none yet

## Next
- build, browser tests, `staff-today.mjs`, screenshots, report.
