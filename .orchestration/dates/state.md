# Unit: dates — state

Branch: `claude/review-dates` (from `claude/blissful-archimedes-enun5m` @ 7f607ac).

## Commits
- (none yet)

## Decisions
- Rule lives in `src/lib/session-dates.ts`; Athens local time compared as "YYYY-MM-DDTHH:MM" strings.
- Camp-week rule = multi-day session of a program whose kind is `camp`; every other multi-day session uses the late-joining cut-off.
- Public pages list only sessions families can act on (sign-ups open by date and status not `closed`); sessions whose sign-ups closed by date are not listed (the editor shows them).

## Open questions
- none yet

## Next action
- Write the rule + unit tests, then wire class page, cards, finder, camps grid, enrollment, account, editor.
