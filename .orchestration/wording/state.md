# Wording unit: state

- Branch: `claude/review-wording` (from `claude/blissful-archimedes-enun5m` at 0b44eaf)
- Status: done; report in `report.md`.
- Commits: one commit with all four changes, the regenerated `docs/seo/review.md`, screenshots, this file and the report.

## Decisions
- Logo: the lockup is an image with the words baked in. Re-exported it (same 2196×570 canvas, so layout and proportions don't change) with "THEATER TROUPE" scaled 1.8× from its own pixels, so the typeface and color are exactly the original's. Phone width of the lockup 150 → 170 px.
- Event cards: the place moved from the end of the time line to its own line: name, street address, "Map". Free-text venue shows as typed, with no address or map.
- Off-limits files keep "semester" (see report, Open points).

## Open questions
- `src/lib/pricing.ts:165` (family-facing trial note) and `src/pages/programs/[slug].astro:133` still say "semester": owned by the discounts and class-page sessions.

## Next action
- None. Waiting for the coordinator.
