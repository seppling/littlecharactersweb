# facts unit: state

Branch: claude/review-facts (from claude/blissful-archimedes-enun5m @ a3adbd2)

## Commits
- start state file
- part 1+2: ages from class data, PNO price, FAQ payment answers, parking PDF link removed
- part 3: Policies page
- part 4: contact form
- report, screenshots

## Decisions
- Home pathway and About "Who it's for": headings come from `agesSpan()` of the linked classes; each class shows its own `ageLabel`. Open-ended when any class's label ends in "+" (class pages show "Ages 9+"), so the home/About agree with class pages.
- About labels starting "Ages" are computed when the group links classes; others ("Homeschool families") stay as typed.
- `price()` says "$30 first child, $10 each additional" for any per-child price with an additional-child price; PNO's starting price now carries `additional: 10` instead of a note. The event seed keeps its own string (events aren't this unit's), set to the same words.
- Students per teacher: "about 7–8" (FAQ, About ×2) wins over "about 7" (home).
- "Doesn't fill" FAQ: "about two weeks into the season" (the old Sep 1 date was ~2 weeks after the Aug 17 start, which is why students are "only charged for the first month"). Hannah to confirm.
- Parking guide: link, seed URL, editor field and the SEO draft that emptied it are removed.
- Dropped the SEO draft for "How much do classes cost?" (its only change was a class-finder link; the new answer has one).

- Contact copy: a signed-in parent writing from their own verified email gets their message repeated back. Anyone else gets a short "on its way" note with none of their words in it, at most 3 a day per address (the form takes any address, so a full copy would let strangers send our email with their text in it).
- Reply time: new optional site setting `contact.replyTime`, empty by default; shown under the form, in the success message and in the sender's note only when set.
- Policies draft note: in the editor as the help on the page's first group (a page's `intro` isn't shown on its edit form).
- POLICY_VERSION bumped to '2026-fall-policies-page'.
- Account page: a "Missing a class?" link on each upcoming class, which prefills the absence topic.

## Open questions
- See report.md → Open points.

## Next action
- Done. Waiting for the coordinator to review and merge.
