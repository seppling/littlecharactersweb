# Enrollment unit: report

Branch `claude/review-enrollment` (from `claude/blissful-archimedes-enun5m` at f7b07cb). No compaction or restart happened in this session.

## Result

### What changed, by file

- `src/pages/enroll/[sessionId].astro` ("Who's coming?"):
  - A child outside the class's ages is greyed out, the same way "Already enrolled" children are. Their checkbox is disabled and has an "Outside the ages" badge, and a line says why: "Ages 7–10. Kai is 12. **Ask us** if you think it's still a fit."
  - **Ask us** goes to `/contact?topic=class&class=<class name>`.
  - A child who doesn't fit is never pre-ticked. A newly added child who doesn't fit is saved to the family, then shown greyed out and unticked.
  - If every saved child is outside the ages, a note says so plainly ("Intro to Theater is for ages 7–10, and Leo is outside that range. You can add another student below, or ask us…"). "Add a student" opens by itself, and the Continue button is hidden.
  - If the server refuses a child, its message shows on the picker.
- `src/server/family.ts`:
  - **New `pickProblem`**: the single place that decides whether a child can be signed up. A child already enrolled or on the waitlist can't. A child outside the ages can't (it uses the existing `fitsAges` and `ageOn`, unchanged). A child after a free trial can continue, but only within the ages.
  - **The server enforces it twice:** in `createDraftOrder` (when the order is started) and again in `confirmOrder` (just before payment). Both refuse with a clear `PickError` message.
  - **Bug fixed:** the server did **not** refuse an already-enrolled child before. A stale page or a hand-made request could start and pay a second order for a child already in the class.
  - **Bug fixed:** a brother or sister already in the same class now counts toward the 15% multi-student discount (`otherClassEnrollments`). Before, siblings who took the free class together and then continued one at a time never got the discount. They only got it if both continued in one order, or were in different classes.
- `src/pages/contact.astro`: the existing topic script also starts the message with "About <class name>: " when the link carries `class=`. It's a 4-line addition to the script; nothing else on the page changed.
- `tests/unit/family-access.test.ts`: 5 new tests:
  - an outside-ages child is refused, and a child within one year of the ages still fits;
  - an already-enrolled child is refused;
  - the check runs again at confirm;
  - a trial child who turned 12 before continuing is refused;
  - the sibling discount applies when siblings continue one at a time. This test fails without the fix (checked).
- `tests/e2e/trial-journey.mjs` (new browser test, run after `enroll-journey.mjs`): the free first class and the age rule end to end (see Proof).
- `README.md` lists the new test in the run order. `docs/portal.md` describes the age rule on the picker, one free class per student, and the sibling rule.

### What changes for families

- They can't tick a child who's outside a class's ages, and they see why, with an easy way to ask.
- A brother or sister continuing after the free class gets the same 15% sibling discount as a family that signs up both at once.

### What changes for Hannah

- Nothing in the admin area.
- A family who thinks a class still fits writes through the contact form. The message starts with the class name, and the topic is "Help picking a class".

### The free first class, in plain words (for Hannah)

1. **Who gets it:** a new student (one with no class history on the site) in a Little Characters weekly class with monthly tuition. Geode classes and 8-week sessions don't offer it.
2. **Signing up:** the family picks the class and their children, fills in care details and agrees to the policies. On "Review & pay" they choose **Try the first class free**. The bill shows "Ava: first class free · $0" and "Due today $0", and the button says **Confirm enrollment**.
3. **What's charged:** nothing. There is no payment step, Stripe is never called, and no card is saved.
4. **What the family sees afterwards:**
   - the confirmation page says "You're in!" and shows the first class date with "Today: Your first class is free";
   - every parent gets an email that says "Your first class is free. After it, you can continue with monthly tuition or pay for the season from your family account.";
   - the account shows the child as "Free trial class" with a **Continue after the trial** link, and a $0 receipt "Intro to Theater (free trial)".
5. **Continuing:** **Continue after the trial** goes through the same steps. The free class is no longer offered for that child, so they choose:
   - **Monthly:** today they pay the rest of this month, prorated by the classes left (for example, on Oct 13: 3 of October's 4 Tuesdays = $71.25), plus the one-time $30 performance fee. Then $95 is charged automatically on the 1st of each remaining month.
   - **Season up front:** the rest of the season less 10%, or less 15% if a sibling is already in a class (the bigger discount wins), plus the $30 fee.
6. **Hannah sees:**
   - on `/admin`, the "Trials" count per class;
   - on the class roster, the child with status "trial", then "active" after they continue;
   - once a family is on monthly autopay, their payments on `/admin/billing` like any other family's.
   - A trial child holds a spot in the class (counted toward capacity) until they continue.

## Proof

All commands ran in this container with the Stripe keys blanked.

- `npm run check`: 0 errors, 0 warnings.
- `npm test`: 11 files, **300 tests passed** (295 before, plus 5 new).
- `npm run build`: completed.
- Browser tests, on a fresh database (`tests/e2e/serve.sh`), in order:
  - `node tests/e2e/enroll-journey.mjs`: all journey checks passed (16 steps).
  - `node tests/e2e/trial-journey.mjs http://localhost:4321 .orchestration/enrollment/shots`: all free-class checks passed (13 steps):
    - an only child outside the ages: greyed out, the plain note, "Add a student" open, "Ask us", no Continue button;
    - Kai (12) and Leo (5) greyed out with "Ages 7–10. Kai is 12."; the newly added Kai is not ticked;
    - "Ask us" opens the contact form with topic "Help picking a class" and "About Intro to Theater: ";
    - a re-enabled checkbox for Kai is refused by the server with "Intro to Theater is for ages 7–10, and Kai is 12.";
    - the free class: $0, never visits `/enroll/pay`; the confirmation page and email say the first class is free;
    - account: "Free trial class" twice, two "Continue after the trial" links, a $0 receipt, no autopay;
    - Hannah's roster shows both children as "trial";
    - no second free class: not offered, and neither `?plan=trial` nor a hand-edited `plan=trial` post makes it free;
    - Ava continues monthly: $71.25 (October prorated 3/4) + $30 = **$101.25** today, then $95 a month;
    - Ben pays for the season: $261.25 less 15% (Ava is in the class) + $30 = **$252.06**;
    - account: both enrolled, with Ava's 2 later months at $95 on autopay;
    - Geode Acting Studio: Leo, Ava and Ben are greyed out (ages 11–17); Kai is offered monthly or the season, no free class;
    - the 2026-11-01 billing run (through `/api/billing/run`) charges Ava's month at **$95**, with a receipt.
    - The test works out the expected amounts itself from the class dates and today's date, not from `src/lib/pricing.ts`.
  - `node tests/e2e/content-editor.mjs`: all editor checks passed (10 steps).
- **Billing script:** I stopped the server and ran it on that same database:
  - command: `APP_ENV=development PGLITE_DIR=.data/e2e npm run -s billing:run -- --today 2026-12-01`;
  - `[test charge] $95 · December tuition: Ava, Intro to Theater`;
  - `[test charge] $55 · December tuition: Maya, Intro to Theater (Scholarship: −$40)`;
  - report `due: 2, charged: 2, failed: 0, errors: 0`, exit 0. It used the local test charger; nothing went to Stripe.
- **Last re-runs:** after the last code change, I re-ran the browser tests once more, all three in order, on a fresh database: 39 steps passed. The final screenshot fix touched only the test file. After it, I re-ran `trial-journey.mjs` on its own, on a fresh server, and it passed.
- **Screenshots** in `.orchestration/enrollment/shots/`:
  - the picker with greyed-out children: `t2-picker-greyed.png` (desktop) and `t2-picker-greyed-390.png`;
  - only child outside the ages: `t1-none-fit.png`;
  - the trial: `t3-review-trial.png`, `t4-trial-confirmation.png` (desktop) and `t4-trial-confirmation-390.png`;
  - the account: `t5-account-trial.png`, `t8-account-continued.png`;
  - continuing: `t6-review-monthly.png`, `t7-review-season.png`.
  - No page scrolls sideways at 390 px; the test checks this.
- CI runs on the push to this branch. I didn't watch its result from here.

## Decisions

- **The rule is enforced in `createDraftOrder` and again in `confirmOrder`.** The first catches a stale page or a hand-made request. The second catches a draft started before the child was enrolled by another order.
- **One function (`pickProblem`) for the picker and the server,** so the two can't drift apart. The picker shows the short line; the server's message is a full sentence.
- **"Ask us" carries the class name:** `/contact?topic=class&class=…`, read by the contact page's existing script. It is the smallest change to a page other sessions may touch.
- **Continue is hidden when no child can be picked,** so the family isn't sent to an error.
- **The sibling-discount fix is in `family.ts`, not in `src/lib/pricing.ts`.** The rule ("Multiple classes or students: 15% off; discounts don't stack") is unchanged. The code just now sees a brother or sister in the same class, as the rule says. **Please check this one:** it changes what such families pay (lower).
- **A new browser test file** rather than more steps in `enroll-journey.mjs`. It's clearer, and it runs on its own too. If sign-in codes are rate limited (5 a minute per address), it waits a minute and tries again; that happens when it runs right after `enroll-journey.mjs`.
- **CI has no browser-test step** (it runs types, unit tests, build and script start-up only), so there was no order there to add the test to. I didn't add a browser job; see Follow-up.
- **The waitlist uses the same picker and the same server check,** so it is covered.
- **The account page:**
  - adding a child there isn't enrolling, so the age rule doesn't apply;
  - its "Continue after the trial" link leads to the picker, which applies the rule;
  - the admin area has no "add a student to a class" yet, so there was nothing to change there.

## Open points

1. **Continuing before the free class has happened:** if a family continues on the day of the free class, before it starts, the first month counts that class as paid.
   - Recommendation: leave it for launch. It's rare and only a few dollars, and fixing it means changing the proration rule. If Hannah wants it, start the paid month after the trial class.
2. **A trial child who never continues keeps their spot** (counted toward capacity) through the end of the term.
   - Recommendation: Hannah decides how long a trial holds a spot (for example, a week after the free class). Show trials on her new staff home page.
3. **`/admin`'s "Enrolled 3 / 20" doesn't include trials, but capacity does.** A class can look less full than it is.
   - Recommendation: show "Enrolled + trials / capacity" in the back-office class page planned for launch.
4. **The ages themselves** are still open with Hannah. The rule is unchanged: one year either side, and a child with no birthday fits.
   - Recommendation: keep it until she answers. Any change is one line in `fitsAges`.

## Follow-up candidates

- Add a CI job that builds, starts `tests/e2e/serve.sh` and runs the three browser tests. It needs `npx playwright install chromium` on the GitHub runner.
- Two payments for the same child can still both go through if two checkout forms are open at once. The second payment then isn't enrolled twice; it overwrites the enrollment's order and adds a second set of monthly payments.
  - Recommendation: in `fulfillOrder`, refuse a child already active under another order and flag it for a refund.
- The roster's status column shows raw values ("trial", "active"). Friendlier labels belong in the back-office work.

## Handoff

- **Ready to merge.** Branch head: see `git log`. Code commits: `ea6dec7` (rule, server checks, sibling fix, unit tests), then the commit with the browser test, the docs and this report.
- **Possible overlaps:** no seed text, SEO drafts, pricing rules, late fees, discount code, class page, header or footer changed. `src/pages/contact.astro` changed only in its script block; watch for a merge overlap with the About/navigation unit if it edits that page.

## Compaction

None occurred.
