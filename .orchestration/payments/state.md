# Payments unit: state

Branch `claude/bo-payments`, from `claude/blissful-archimedes-enun5m` at ccd1070.

## Done
- Baseline before any change: `npm run build`, `tests/e2e/serve.sh`, all 8 browser tests pass. Database snapshot taken after them.
- Billing script on copies of that snapshot (keys blanked): `--today 2026-11-01` charges nothing (the journeys already charged Nov 1); `--today 2026-12-01` charges $80.75 (Ava, family 15%) and $55 (Maya, scholarship).

## Decisions
- (filled in as the work goes)

## Open questions
- none yet

## Next action
- Write `src/server/payments-admin.ts`, move the pay-now email into `sendPayLinkEmail`, rebuild both pages, downloads, tests.
