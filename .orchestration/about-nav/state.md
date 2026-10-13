# about-nav: state

Branch: `claude/review-about-nav` (from `claude/blissful-archimedes-enun5m` at f7b07cb).

## Commits
- Checkpoint 1: About split into /about/team and /about/schools; About dropdown and Contact in the menu; footer regrouped; drafts and review.md updated.
- Final: browser test follows the team photo to /about/team and checks the new pages in the editor; report, menu-check script and screenshots.

## Checks (final tree)
check 0 errors · test 300 passed · build ok · enroll-journey passed · content-editor passed · nav-check 47/47.

## Decisions
See report.md → Decisions. In short: page keys `team` and `schools` keep their old groups; /about shows cards built from those pages' own words; phone menu starts below 1000px (was 960px); missing page rows get seeded at server start.

## Open questions
See report.md → Open points (preview-database edits to the old sections, one draft's "why" wording, the short Schools page). None blocks the merge.

## Next action
- Done. Waiting for the coordinator's review.
