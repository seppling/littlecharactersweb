# class-page: state

Unit: the top of the class page (`src/pages/programs/[slug].astro`). Branch `claude/review-class-page`.

## Done
- Summary carries day/time (from sessions), address + map link; hero photo removed; card beside the summary on desktop, right after it on phones.
- Card repeats only what differs between sessions (dates and spots always; time, place, price only when they differ).
- "The finale" → Performance / Performances; "Ask Hannah" → "Ask us".
- Helpers in `src/lib/class-summary.ts` (used only by the class page) with `tests/unit/class-summary.test.ts`.

## Next
- Render check with several sessions / waitlist (temporary seed edit, not committed), full checks, browser tests, screenshots, report.

## Open questions
- None yet.
