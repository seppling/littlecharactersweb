# Enrollment unit: state

Branch `claude/review-enrollment`, from `claude/blissful-archimedes-enun5m` at f7b07cb.

## Commits
- (none yet)

## Decisions
- Server check goes in `createDraftOrder` and again in `confirmOrder` (so an old draft order can't slip through).
- "Ask us" links to `/contact?topic=class&class=<title>`; the contact page's existing topic script also pre-fills the message with the class name.

## Open questions
- (none yet)

## Next action
- Implement the age rule on the picker and the server, then the trial browser test.
