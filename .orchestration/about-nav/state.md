# about-nav: state

Branch: `claude/review-about-nav` (from `claude/blissful-archimedes-enun5m` at f7b07cb).

## Commits
- Checkpoint 1: About split into /about/team and /about/schools, About dropdown + Contact in the menu, footer regrouped. check, test (300), build pass; menu/keyboard script 47/47.

## Decisions
- New page keys `team` (/about/team) and `schools` (/about/schools). Each keeps its old group (`team`, `schools`) with the same fields and text, so the editor form looks as before and draft paths stay `team.social`, `schools.lede`, `schools.body` (only the draft's page id changes).
- `/about` shows two small cards where the sections were, built from the new pages' own eyebrow, heading and intro (no new wording besides the link labels).

## Open questions
- (none)

## Next action
- Run both browser tests on a fresh database, then write report.md.
- Phone menu switches on below 1000px (was 960px): with Contact and the About button the desktop row overflowed by ~29px at 961px. Tightened spacing below 1180px too.
- Server: a page added after the database was first filled (team, schools) now gets its seed row on start (pages can't be deleted, so a missing row is never intentional). Unit test added.
- Home page "Meet the whole team" button now goes to /about/team.
