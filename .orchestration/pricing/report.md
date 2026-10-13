# Pricing unit: report

Branch `claude/review-pricing` (from `claude/blissful-archimedes-enun5m` at c197dbc). No compaction or restart happened in this session. Nobody typed into this session directly.

## Result

### What changes for families
- **Stories and Songs has a free first class** (any Little Characters weekly class priced per session; not Geode, not drop-in nights). A family that stays on pays for the classes left: classes left ÷ classes in the session × $160, plus the $30 fee. The home page promise ("Nothing is due when you enroll") is now true for ages 4–6, so the home page lines are unchanged.
- **A class that starts mid-month charges only that month's classes.** Acting Studio from Tue Oct 20: 2 of October's 4 Tuesdays, so $47.50 + $30 fee today, then $95 on Nov 1 and Dec 1 (was $95 + $30). Late joiners are charged as before. Each tuition line names its class count: "Ava: October tuition, 3 classes (prorated)".
- **Readable prices.** Per-session prices read "$160 for 9 weeks ($17.78 a class)" on class cards, the finder, the class page's Cost row, the phone sticky bar ("$160 for 9 weeks" / "$17.78 a class · Ages 4–6") and the enrollment sidebar. Monthly prices still read "$95/mo".
- **"Joining now, per student"** on each weekly class page's "Choose a time" card, for the chosen date. It comes from the same quote checkout uses, with today's date. Intro to Theater today: "Nothing today; the first class is free. / Or $71.25 + $30 fee today, then $95 on Nov 1 and Dec 1. / Or $235.12 + $30 fee for the rest of the season."
- **Review page.**
  - New students start on "Try the first class free". Monthly and the season are one tap away. Students who already had their free class start on monthly.
  - The season line names the discount it really gets. With the 15%: "$252.06 today with the 15% family discount, and you're done. It's the same total as paying monthly." With the 10%: "$265.12 today, 10% off, and you're done. You save $26.13 over paying monthly."
  - The first month's 15% line is rounded in the family's favor.
- **The family discount counts session-priced weekly classes** (Stories and Songs, Homeschool) toward the two. So a family with Stories and Songs and a monthly class now gets 15% off the monthly payments. Drop-in nights don't count, and never get the 15%, even for two adults in one improv-night sign-up.
- **Whole families.**
  - "Enroll another child or class" appears on the review and confirmation pages. It goes back to the class finder, still signed in, with the age the family last picked in the finder.
  - Details confirmed within the year show as one line ("Allergies: Peanuts · photos OK") with **Edit**, not the form.
  - The confirmation page shows a **Your family** box: paid today across today's sign-ups, and the autopay total from the next 1st. It's read from orders and payments.
  - The confirmation email says when another child's payments went down ("Ava's remaining monthly payments also drop to $80.75 with the 15% family discount.").

### What changes for Hannah
- In the editor: nothing.
- The staff guide (`docs/staff-billing.md`) now says session-priced classes count toward the family discount, and drop-in nights never get it.
- The "family discount ended" email now says "two or more students or classes in our weekly classes". The words "paid monthly" are gone.

### By file
- `src/lib/pricing.ts`:
  - `hasFreeFirstClass` and `availablePlans` (the free class on session-priced classes);
  - `defaultPlan`, `isWeeklyTuitionClass`;
  - `monthlySchedule` (mid-month first month, class counts);
  - `quote`: `trialStudentIds` proration, class counts in labels, no 15% on one-date sessions, 15% rounded with `familyDiscounted`, `discountCents` never −0;
  - new `sessionPriceParts`, `joiningNow`, `planCopy`.
- `src/lib/format.ts`: `priceLabel`.
- `src/lib/class-summary.ts`, `src/components/ProgramCard.astro`, `ProgramRow.astro`, `SessionLine.astro`, `portal/EnrollShell.astro`: use `priceLabel`.
- `src/pages/programs/[slug].astro`: the Cost row, the joining-now box, the sticky bar. The price note ("8 weeks") is hidden when the session label already says the length.
- `src/pages/programs/index.astro`: remembers the chosen age in sessionStorage (in a try/catch).
- `src/components/portal/AnotherChild.astro`: new.
- `src/pages/enroll/review.astro`: `planCopy`, `loweredLines`, the another-child link.
- `src/pages/enroll/details.astro` and `src/lib/student-details.ts` (new): the details on file summary.
- `src/pages/enroll/confirmation.astro`: family totals and the another-child link.
- `src/server/family.ts`:
  - `priceOrder`: the default plan and `trialStudentIds`;
  - `familyDiscountEffect`: any weekly tuition class, any paid plan;
  - `loweredLines` and the confirmation email line;
  - `familyTotals`;
  - `detailsFresh` delegates to `detailsOnFile`.
- `src/server/family-discount.ts`: counts `isWeeklyTuitionClass`; the email wording; `effects` exported.
- Docs: `docs/portal.md` (billing rules, journey table, family discount), `docs/staff-billing.md`.
- Tests:
  - `tests/unit/pricing.test.ts`, `family-discount.test.ts`, `bookings.test.ts`;
  - new `student-details.test.ts`;
  - `tests/e2e/enroll-journey.mjs`, `trial-journey.mjs`.

## Proof

- `npm run check`: 0 errors (177 files).
- `npm test`: 17 files, **415 tests pass** (388 before). New unit tests:
  - a free class on Stories and Songs, then staying on the day after it (8 of 9 classes: $142.22 + $30). Also end to end through `priceOrder` on the real seed.
  - Acting Studio from Oct 20: 2 of 4 Tuesdays, $47.50; its season from the same shares.
  - late joiners unchanged (Sep 22: $38; first week: full $95).
  - family-discount counting: Stories and Songs lowers a sibling's months to $80.75; a drop-in night and a Stories and Songs trial don't count.
  - drop-in nights: no 15% for two in one sign-up, nor with other classes.
  - plan labels with the 10% (names the saving) and with the 15% (names it, "same total as paying monthly", no "10%").
  - joining-now lines equal to `quote` (monthly with a free class, mid-month Geode, per session, late per session; none for drop-ins, waitlist, or ended).
  - the details-step skip (within a year, over a year, never, Edit).
  - the free class pre-selected for new students, and monthly for returning ones.
  - the confirmation email's lowered-payments sentence.
  - `familyTotals`.
- `npm run build`: complete.
- Browser tests, fresh database (`tests/e2e/serve.sh`), in order: `enroll-journey.mjs` ✓, `trial-journey.mjs` ✓, `content-editor.mjs` ✓, `navigation.mjs` ✓.
  - Changes in `enroll-journey.mjs`, each explained in the test:
    - starts at `/programs?age=7-10`;
    - checks the joining-now box;
    - checks the free class is pre-selected at $0, then taps monthly;
    - checks checkout equals the class page's joining-now total ($101.25);
    - new step: "Enroll another child or class" lands on `/programs?age=7-10`, signed in.
  - Changes in `trial-journey.mjs`:
    - the free class is pre-selected (no tap needed);
    - details on file show as a summary, and Edit opens the form;
    - the season label names the 15% and "same total";
    - the family-discount sentence has its new wording;
    - the confirmation family totals ($353.31 for 3 sign-ups, $80.75 a month from Nov 1);
    - the email mentions Ava's drop;
    - Acting Studio's mid-month price is worked out from the dates: $47.50, and here less 15% because Ava and Ben are enrolled, so $70.37.
  - The 390 px checks found no sideways scrolling on the changed pages.
- **Billing script** (keys blanked, separate local database `.data/billing-check`): a family set up through the real checkout code.
  - Ava, Intro to Theater, monthly: October $71.25 (3 classes) + $30 fee = $101.25. Nov 1 and Dec 1 at $95.
  - Leo, Stories and Songs: $160 − 15% ($24, Ava counts) + $30 fee = $166. Ava's Nov 1 and Dec 1 then dropped to $80.75 (regular $95).
  - `npm run billing:run -- --today 2026-11-01`: due 1, charged 1, errors 0. Same on 2026-12-01. Ava's two months are paid at $80.75, which matches the review page and the rule.
- Screenshots in `.orchestration/pricing/shots/` (desktop and `-390`):
  - `ss-class-page*`, `ss-top-closeup`, `ss-sticky-bar-390`, `ss-finder-card*`, `home-cards*`: a session-priced class's card and page.
  - `0-class-joining-now*`, `intro-joining-now-closeup`, `acting-class-page*`: the joining-now box.
  - `4a-review-trial-preselected*`: the free class pre-selected.
  - `t7-review-season*`: the review page with the 15%.
  - `5b-another-child*`, `5-confirmation*`: "Enroll another child or class".
  - `t7b-confirmation-family-totals*`: family totals.
  - `t5b-details-on-file`: the details summary.
- CI (`.github/workflows/ci.yml`): green on 6baefa9 (all code changes). The later commits change only tests, docs and the report, and their CI was still running when this report was written.

## Decisions

1. **Continuing after the free class prorates only for those students** (`trialStudentIds`). The proration counts the meetings on or after today. Joining in the first week without a free class still pays the whole session, as before. It's per student, so mixed sign-ups price correctly.
2. **The mid-month denominator uses the session's own days** (any of its weekdays in the calendar month). It applies only to the session's first month. A late joiner in that first month is measured the same way (classes left that month ÷ class days in the calendar month). Every later month keeps today's late-joiner rule. A last month that ends mid-month stays a full month (not decided; see Follow-ups).
3. **Drop-in nights never get the 15%** (not in a sign-up for two, and not from a family's other classes). A drop-in is a `kind: 'class'` program on a one-date session. This is the simplest reading of decisions 3 and 4.
4. **Session-priced classes keep getting 15% at checkout** when the family has another counting class, as they did before. "They just count" is read as: there are no monthly payments of theirs to change.
5. **Class counts come from the session's real meetings**, as asked. For Stories and Songs that is **9** Tuesdays (Oct 20 – Dec 15). See Open point 1. On the class page, the seed's price note ("8 weeks") is hidden where the computed label already says the length. Otherwise it would read "$160 for 9 weeks · 8 weeks".
6. **The 15% line is rounded with `familyDiscounted`** (ceil of the 15%). The 10% stays `Math.round`, as before.
7. **"Same total as paying monthly" applies when paying up front saves under $1.** With the 15% the two differ only by rounding cents.
8. **Joining-now** is shown only for weekly classes with tuition, not for waitlist dates or ended ones, and is quoted for one new student with no family discount. Its lines are exactly the plans checkout offers a new student, in the same order.
9. **The review page keeps the plan radios auto-submitting**, as before. The trial is just the default.
10. **"Enroll another child or class"** remembers the finder's age in sessionStorage, for this tab only. Without it, the finder opens unfiltered. On the review page a note says "This sign-up isn't booked until you pay or confirm above." There's no basket; each sign-up is still paid on its own.
11. **The details skip is per student.** The policy checkbox is still asked on each sign-up (it's recorded per order). A summarized student's details aren't re-saved, so the yearly reconfirmation date isn't pushed forward without the family looking.
12. **Family totals** count orders paid on today's Athens date as "this visit", and sum the payments due on the next 1st that are scheduled or failed. The box shows only when there's more than this one sign-up to add up.
13. **The confirmation email** puts the lowered-payments sentence right after the autopay line, also for season or per-session sign-ups that have no autopay line.

## Open points

1. **Stories and Songs: 8 weeks or 9?** The seed copy says "8-week class", "Tuesdays for 8 weeks" and a note of "8 weeks". The session's dates (Tue Oct 20 – Tue Dec 15) hold 9 Tuesdays, so the site now shows "$160 for 9 weeks ($17.78 a class)" and prorates by 9. **Recommended:** ask Hannah. If a week is off (Thanksgiving week, Nov 24, is a guess, not a fact), add "no class" dates to sessions (a small follow-up) so the counts, per-class price, proration and calendar all agree. If it really is 9 weeks, the wording below needs updating.
2. **Seed wording that states the old rule or the 8-week count.** Listed, not changed:
   - `src/content/seed/programs.ts` (Stories and Songs): summary "An 8-week class…", description "This 8-week class…", `duration` "Tuesdays for 8 weeks", `priceFrom.note` "8 weeks". All depend on point 1.
   - `src/content/seed/faqs.ts:42` and `src/content/seed/pages.ts:343`: "a few run as 8-week sessions with one price". Depends on point 1.
   - `src/content/seed/pages.ts:518` (Give page): "$160 · All 8 weeks of Stories and Songs". Depends on point 1.
   - `src/content/seed/faqs.ts:47` and `src/content/seed/pages.ts:566`: "you pay the first month (prorated if you join after the first week)". Still true, but it doesn't mention that a class starting mid-month is also prorated. **Recommended:** add "or the class starts mid-month". The FAQ and Policies pages were off-limits to this unit.
   - The home page free-class lines ("most weekly classes", "Nothing is due when you enroll") stay true. Left as is.
3. **Staying on the same day as the free class** still pays for that class (already noted for monthly classes in the log). For a session-priced class it's one class's share, $17.78. **Recommended:** leave it for launch. Later, the free class's date could be left out of the proration.
4. **A last month that ends mid-month** (Dec 1, 8 and 15) is still a full $95 month. It wasn't decided, and changing it would change what already-enrolled families pay, so it was left alone. **Recommended:** Stephen decides whether the mid-month rule should cover the last month too.

## Follow-up candidates

- "No class" dates on sessions (holidays). Meetings, proration and per-class prices would use them.
- A basket for several sign-ups with one payment (today "Enroll another child or class" means one payment per sign-up).
- An unfinished sign-up could be offered again on the class page or in the account (the account page belonged to another unit).
- The account page's free-trial wording for session classes. It says "Continue after the trial", which is fine, but it wasn't touched here.
- A paid-in-full or per-session order with lowered sibling payments could also show those on the confirmation page (today they're in the email and on the review page).

## Handoff

- All work is on `claude/review-pricing`, pushed. No seed or draft text changed, so `npm run seo:review` wasn't needed.
- Merge notes:
  - The review page now defaults new students to the free class. Any other branch whose browser test pays on the review page without choosing a plan must tap monthly first.
  - `familyDiscountEffect` now needs `session` on its argument.
  - `monthlySchedule` entries gained `classes`.
  - Tuition line labels changed ("October tuition, 3 classes (prorated)"), which also changes the Stripe line description.
- No Stripe requests were made: keys were blanked for every script, the server and the tests.
