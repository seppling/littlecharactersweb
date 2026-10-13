# Unit: dates (state)

Branch: `claude/review-dates` (from `claude/blissful-archimedes-enun5m` @ 7f607ac). No compaction.

## Commits
- Class dates retire on their own: rule, wiring, editor badges, tests (checkpoint)
- Wording fixes, docs, screenshots, report (final)

## Decisions
See `report.md` → Decisions. In short:
- The rule is in `src/lib/session-dates.ts`; Athens local time is compared as "YYYY-MM-DDTHH:MM".
- Camp week = a multi-day session of a `camp` program; other multi-day sessions use the cut-off (`site.signups.lateJoinWeeks`, default 4).
- Public pages list only dates that are open by date; the editor marks the rest "Sign-ups closed" or "Ended".
- Checkout is refused before payment; a payment already made is honoured.

## Open questions (for the coordinator / Hannah)
- Confirm the 4-week cut-off.
- Per-session-priced classes (Stories & Songs, Homeschool): keep the late-joining cut-off, or close at start?

## Next action
- None: done. Report in `report.md`.
