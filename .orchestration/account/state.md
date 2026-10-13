# Unit: account (branch claude/review-account)

## Status
Started 2026-10-13. Reading done; implementing.

## Findings
- Imported households are already marked: `household.source = 'studio-director'` (set by src/server/studio-director.ts). No new marker or migration needed for that.
- "Missing a class?" absence link already exists on the account page (facts unit); only the wording changes to "Can't make it?".
- Donation link setting already exists (Site settings → Giving → Donation link); its seed value is the old-site /giving-page URL.

## Decisions
(see report)

## Commits
(none yet)

## Open questions
(none)

## Next action
Implement sections 1–5.
