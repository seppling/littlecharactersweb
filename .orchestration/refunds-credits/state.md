# Refunds, credits and statements: state

Branch `claude/bo2-refunds-credits`, from `claude/blissful-archimedes-enun5m` (3ab1c0a).

## Commits
- (none yet)

## Decisions
- No migrations. Day-off credits are marked given by a fixed credit id (`dayoff-<closure id>-<household id>`), so a second press inserts nothing.
- Every refund locks its order row in the transaction that checks what's left, so two refunds at once can't pass the check together.
- Card payments' last four on statements are read from Stripe per payment (cached per download); "Card" when unknown.

## Open questions
- none

## Next action
- Write src/server/refunds.ts, credits.ts, day-off-credits.ts, statements.ts, then the pages.
