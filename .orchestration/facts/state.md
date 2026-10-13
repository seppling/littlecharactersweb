# facts unit: state

Branch: claude/review-facts (from claude/blissful-archimedes-enun5m @ a3adbd2)

## Commits
- start state file
- part 1+2: ages from class data, PNO price, FAQ payment answers, parking PDF link removed

## Decisions
- Home pathway and About "Who it's for": headings come from `agesSpan()` of the linked classes; each class shows its own `ageLabel`. Open-ended when any class's label ends in "+" (class pages show "Ages 9+"), so the home/About agree with class pages.
- About labels starting "Ages" are computed when the group links classes; others ("Homeschool families") stay as typed.
- `price()` says "$30 first child, $10 each additional" for any per-child price with an additional-child price; PNO's starting price now carries `additional: 10` instead of a note. The event seed keeps its own string (events aren't this unit's), set to the same words.
- Students per teacher: "about 7–8" (FAQ, About ×2) wins over "about 7" (home).
- "Doesn't fill" FAQ: "about two weeks into the season" (the old Sep 1 date was ~2 weeks after the Aug 17 start, which is why students are "only charged for the first month"). Hannah to confirm.
- Parking guide: link, seed URL, editor field and the SEO draft that emptied it are removed.
- Dropped the SEO draft for "How much do classes cost?" (its only change was a class-finder link; the new answer has one).

## Open questions
- (see report)

## Next action
- Policies page, then contact form, then checks/screens/report.
