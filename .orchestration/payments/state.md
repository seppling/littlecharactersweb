# Payments unit: state

Branch `claude/bo-payments`, from `claude/blissful-archimedes-enun5m` at ccd1070. No compaction or restart.

## Done
- Baseline before any change: build, `serve.sh`, all 8 browser tests pass; database snapshot taken after them; billing script on copies (keys blanked).
- `src/server/payments-admin.ts` (new reads, Send a pay link, downloads); `sendPayLinkEmail` shared in `billing.ts`; both Payments pages rebuilt; `payments.csv.ts` / `payments.pdf.ts`; dev-only `/dev/fail-charge`; `payments(show?, month?)` in admin-links.
- Tests: `tests/unit/payments-admin.test.ts`, one line in `admin-links.test.ts`, two lines in `enroll-journey.mjs` (old title and heading), new `tests/e2e/staff-payments.mjs`.
- Checks: `npm run check` 0 errors; `npm test` 534 passed; `npm run build` ok; 9 browser tests pass; billing script charges the same amounts before and after.
- Docs: `staff-billing.md`, `back-office.md` §11, `portal.md`, `README.md`.

## Decisions
See report.md → Decisions.

## Open questions
See report.md → Open points (none blocking).

## Next action
- None: unit finished, report written. Waiting for the coordinator.
