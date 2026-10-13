# Pricing unit: state

Branch `claude/review-pricing`, from `claude/blissful-archimedes-enun5m` at c197dbc.

## Plan
1. `src/lib/pricing.ts`: free class on LC session-priced weekly classes; continuing after it prorates the classes left; mid-month first month; class counts on tuition lines; drop-ins never get the 15%; 15% line rounded in the family's favor; price label and joining-now helpers.
2. `src/server/family-discount.ts`: session-priced weekly classes count; drop-ins and free classes don't.
3. `src/server/family.ts`: trial pre-selected for new students; trial continuation flag; family totals; confirmation email line.
4. Pages: class card, class page Cost row + joining-now + sticky bar, EnrollShell, review plan labels + "Enroll another child or class", details summary for fresh students, confirmation family totals.
5. Tests (unit + browser), billing script, docs, screenshots, report.

## Commits
(none yet)

## Decisions
(see report)

## Open questions
(none yet)

## Next action
Implement step 1.
