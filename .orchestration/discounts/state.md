# Unit: staff discount adjustments (`claude/review-discounts`)

## Status
Done; see report.md. Started from `claude/blissful-archimedes-enun5m` (0b44eaf).

## Commits
- Staff discount adjustments: table, billing, admin page, family view, tests
- Docs, e2e steps, the billing run's test charge line, order tie-break, report

## Decisions
See report.md → Decisions.

## Open questions
See report.md → Open points (refunds for paid-in-full/first month; the 2-hour pay-now lock; whether to email families). None block this unit.

## Note
One accidental request reached Stripe's test mode (failed, no money moved); see report.md → Proof.

## Next action
None. Waiting for the coordinator to review and merge.
