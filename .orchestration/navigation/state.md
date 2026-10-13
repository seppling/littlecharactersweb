# Navigation unit: state

Branch: `claude/review-navigation` (from `claude/blissful-archimedes-enun5m` at a3adbd2).

## Commits
- Navigation, class finder and accessibility fixes (menus, phone header, finder sort, h1s, contrast, footer logo name, browser test).

## Decisions
- Parents' Night Out and Parties go in a "Shows & Events" dropdown (where the audit's parent looked); Parking & drop-off ends the About dropdown; Give is a quiet link before "Family login" (desktop) and an item in the phone menu.
- Desktop bar: the compact spacing now runs 1001–1260 px (was up to 1180) with a 170 px logo, a narrower header gutter and Give without its heart icon. Fits on one row at every 5 px from 1001 to 1440.
- Phone menu drops "Classes" (kept "Find a class"). Escape closes and returns focus to Menu; focus leaving the panel, or a tap outside, closes it.
- Finder sort rule in `src/lib/finder.ts` (tested). "School-only" and "school hours" are derived from the dates, not a new editor field (no seed change allowed).
- Phone + age chosen: Type/Focus/More behind a "Filters" button; the intro paragraph hides; less padding.
- `--teal-ink` darkened #0b7a6e → #0a7469 (4.85:1 on the teal tint).
- Sign-in panel takes `level="h1"` on /account and /enroll; staff sign-in keeps h2 (the editor test looks for it).

## Open questions
- none blocking

## Next action
Write report.md and push.
