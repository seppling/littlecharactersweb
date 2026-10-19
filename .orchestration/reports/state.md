# Reports unit: state

Branch `claude/bo2-reports`, from `claude/blissful-archimedes-enun5m` (27b2e95).

## Plan
1. `src/server/reports/`: common.ts (types, seasons, filters), money.ts, enrollment.ts, growth.ts, safety.ts, teachers.ts, library.ts (the registry: every report's key, group, question, "was", how counted, filters, load), favorites.ts, dashboard.ts.
2. Pages: `/admin/reports` (dashboard), `/admin/reports/library`, `/admin/reports/<key>` (+ `.csv`, `.pdf`), POST `/admin/reports/favorite`.
3. Charts: server-rendered SVG components with a data table toggle.
4. Unit tests `tests/unit/reports.test.ts`; browser test `tests/e2e/staff-reports.mjs`.
5. Docs: `docs/back-office.md` §25; README test list.

## Decisions
(see report.md when done)

## Commits
- none yet

## Next action
Write src/server/reports/*.
