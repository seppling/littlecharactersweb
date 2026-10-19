# p2-foundation: state

Branch `claude/bo2-foundation`, from `claude/blissful-archimedes-enun5m` at 6a5394d.

## Plan
1. Schema + migration `0011_phase2` (staff, class_teacher, class_cover, session.shared_device, and every later unit's tables).
2. Roles: `staff.ts`, middleware, `Astro.locals.staffRole/staffId`, shared-device idle hour.
3. `src/server/teachers.ts` + unit tests.
4. Settings → Staff page, shell menu "Settings", teacher placeholder `/admin/teach`, sign-in "shared device".
5. Phase 1 cleanups (under 5, link functions, badge workarounds, content editor requireStaff, sharp).
6. Docs, `tests/e2e/staff-settings.mjs`, all checks, screenshots, report.

## Commits
(none yet)

## Decisions
(see report as they're made)

## Open questions
(none)

## Next action
Write schema + migration.
