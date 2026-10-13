# Hannah's website review (October 2026): plan and log

Stephen and Hannah reviewed the site together on October 13. This is the record of the changes that came out of it. Each change is done by a separate Claude session on its own branch, then checked and merged into `claude/blissful-archimedes-enun5m`, the branch of pull request #10.

## Decisions (October 13)

- **Hosting budget:** $120 a month. The estimate was $35–60, so there is room for a host that doesn't sleep, and for backups. Recommended: set up the real hosting now on a private address, so Hannah's edits in the editor are kept. Edits on the preview are lost at each rebuild.
- **One-off discounts:** a staff adjustment on an enrollment, set by Hannah in the admin area: a percentage or a dollar amount, once or every month, with a reason. Families see it on their bill, and every change is logged. Not Stripe coupons or promo codes.
- **Teachers:** their own logins, which see rosters only (all parent and child information), not billing or the editor. **On hold (October 13):** roster changes wait for a wider plan for the staff back office, designed around how Hannah uses Studio Director.
- **About:** Team, and Schools & partners, become their own pages. An About dropdown in the top menu also holds the FAQ. Our story and mission stay on `/about`.
- **Playful class-page copy:** written as drafts that Hannah approves.
- **Later, after launch:** a calendar invite email from a Little Characters address; downloadable statements in the family account.
- **Open:** the Studio Director roster's column headings (to match the roster), and whether class emails from the roster are needed before launch.

## Plan

| # | Unit | Wave | Needs | Branch |
|---|---|---|---|---|
| 1 | Wording and cards: "semester" becomes "season" everywhere, "The finale" becomes "Performances" on the camps page, "Theater Troupe" bigger in the logo, street addresses on event cards | 1 | — | `claude/review-wording` |
| 2 | Class page: day, time and address in the top summary; no hero photo; registration card higher; "The finale" becomes "Performance(s)"; "Ask Hannah" becomes "Ask us" | 1 | — | `claude/review-class-page` |
| 3 | Staff discounts: adjustments on enrollments, applied in billing | 1 | — | `claude/review-discounts` |
| 4 | Registration: grey out children outside a class's ages; check "First class free" end to end | 2 | — | `claude/review-enrollment` |
| 5 | Teacher logins: rosters only (**on hold**, part of the back-office plan) | — | — | — |
| 6 | About pages, the About dropdown, Contact in the main menu, footer layout | 2 | — | `claude/review-about-nav` |
| 7 | Playful class-page copy, as drafts | 3 | 1, 2 | `claude/review-copy` |
| 8 | Class dates retire on their own: a past or closing date can't be booked or shown, whatever its status | 3 | 4 | `claude/review-dates` |
| 9 | The 15% family discount covers the whole family: a second weekly-class enrollment lowers every child's remaining monthly payments | 3 | 3, 4 | `claude/review-family-discount` |

## Log

Each merged unit gets an entry here.

### Back-office plan (October 13)

Stephen asked for a wider plan for the staff back office, designed around how Hannah uses Studio Director. Decided:

- **Two phases.**
  - **By launch (mid-November):**
    - a staff home page (today's classes, problem payments, new sign-ups, waitlist openings);
    - a class page in the admin area with an enrollment tab like Studio Director's: add or drop a student, the waitlist, slots filled and average age, print, email the class;
    - family and student lookup, with edits;
    - payments: autopay, discount adjustments, each family's history;
    - spreadsheet downloads.
  - **By spring:**
    - attendance, make-ups and drop-ins;
    - instructors and teacher logins;
    - a class calendar, search and reports;
    - group email;
    - one-off charges, refunds and statements;
    - staff settings.
- **Switching over:** fall classes finish in Studio Director (no new data typed into it after launch). New sign-ups and spring are on the new site. Studio Director is cancelled in February, after a clean month of spring billing and a full export.
- **Hannah's input:** a short online form asks how often she uses each Studio Director screen, plus 8 questions. The back-office pieces are designed from her answers.
- **Staff discounts:** continue now. Their admin screen moves into the new payments area later.

### Wave 1 merged (October 13)

Units 1, 2 and 3 are merged. On the merged branch: type check clean, 295 unit tests pass, the site builds, and both browser tests pass (the enrollment journey now includes Hannah adding a $40 discount and the family seeing it).

- **Wording and cards** (unit 1). Families now read "season" everywhere: home, camps, the class finder, the FAQ, class pages, checkout and the family account. Term names such as "Fall 2026" are unchanged. The camps page fact reads "Performances". The logo was re-exported with "THEATER TROUPE" 1.8× larger, in the lockup's own lettering, and the phone logo is a little wider. Event cards show the place, its street address and a Map link. The SEO drafts were updated to match, so they still load.
- **Class page** (unit 2).
  - The top summary shows the day and time, the place with its street address and a Map link, the cost, the teachers and "Performance(s)". The "Choose a time" card sits beside the summary from the top, and comes right after it on phones.
  - The hero photo is gone. The class photo is still used for link previews and on class cards elsewhere.
  - The card repeats a time, place or price only when sessions differ.
  - "Ask Hannah" now reads "Ask us".
- **Staff discounts** (unit 3).
  - **For Hannah:** Monthly autopay → Payments & discounts → Add a discount → check the new amounts → Save discount. Remove undoes it.
  - **Kinds:** a dollar amount or a whole percentage, on the next payment or every remaining month.
  - **What families see:** "Discount: −$40", or the reason itself if Hannah ticks "Show the reason to the family".
  - **What changes:** only unpaid months change. A month being charged, or with the pay-now form open in the last 2 hours, catches up at the next billing run. A month the discount covers completely is not sent to Stripe.
  - **Records:** every change is in the audit log. How-to for Hannah: `docs/staff-billing.md`.
  - **Checked:** with the billing script on a local database, November charged $55 instead of $95.
- **Fixed at merge:**
  - the last two "semester" phrases, on the class page and in the free-class note;
  - the Stripe pay-now form leaves out a $0 tuition line when a discount covers the month and only the late fee is due.
- **Reported by the discounts session:** during its first billing-script run, before it blanked the keys, one request reached Stripe's test mode. It failed ("No such PaymentMethod"). No money moved; it was test mode. Every later run blanked the keys.
- **Open, for Hannah:**
  - Should families get an email when a discount is added? Today they see it in their account and on the next receipt.
  - A discount on a class already paid in full, or on the first month paid at checkout, is a refund in the Stripe dashboard (documented).
- **Follow-ups noted:**
  - Parents' Night Out still lists Sep 25 as open, which is in the past. Hannah can close it in the editor, or the page could hide past one-night dates on its own.
  - The footer's "Theater Troupe" could grow to match the header logo.

### Class dates retire on their own (decided October 13)

Shows and events already leave the site once they're over. Their show pages stay up, with a note that the show has ended. Class dates still need Hannah to mark them "closed": a past date left "open" can still be booked (Parents' Night Out still offers Sep 25). Decided:

- **The dates decide, and Hannah's status only adds limits.** "Open" never keeps a past date bookable. Full, waitlist and closed still apply.
- **One-night dates** (Parents' Night Out, workshops, the free class): sign-ups close when it starts.
- **Weekly classes:** families can join late (the first month is prorated) until a cut-off before the season ends. It's a setting in the editor, **4 weeks by default; Hannah to confirm.**
- **Camp weeks:** sign-ups close when the week starts.
- **Nothing is deleted.** Past dates stay in the editor marked "Ended", because enrollments and payments point to them.
- **When:** unit 8, after unit 4 is merged, since both change the enrollment page.

### Wave 2 merged (October 13)

Units 4 and 6 are merged. On the merged branch: type check clean, 305 unit tests pass, the site builds, and all three browser tests pass (the new free-class test runs between the enrollment journey and the editor test).

- **Registration** (unit 4).
  - **Ages:** a child outside a class's ages is greyed out and can't be ticked. A line says why ("Ages 7–10. Leo is 5.") with an "Ask us" link, which opens the contact form already filled in with the class name. The server refuses such a child too, at the start of the order and again before payment. The age rule itself is unchanged (one year either side): Hannah's age questions are still open.
  - **Bug fixed:** the server didn't refuse a child already enrolled in the class, so a stale page could start a second paid order.
  - **Bug fixed:** a brother or sister already enrolled in the same class now counts toward the 15% multi-student discount. Before, siblings who took the free class together and continued one at a time didn't get it. The published rule is unchanged ("multiple classes or students: 15% off"); these families now pay what it promises.
  - **The free first class is proven end to end** by a new browser test (`tests/e2e/trial-journey.mjs`). It checks five things:
    - the trial costs $0 and never calls Stripe;
    - the confirmation, the email and the account say the class is free;
    - no child gets a second free class;
    - continuing monthly charges the prorated month plus the $30 fee, then $95 on the 1st;
    - continuing for the season takes off 10%, or 15% with a sibling.
    - It also checks that Geode classes offer no free class.
- **About pages and menus** (unit 6).
  - **New pages:** `/about/team` and `/about/schools`, each with its own page in the editor (the same fields and words as before). `/about` links to them with two cards.
  - **Old links still work:** old `/about#team` and `/about#schools` links go to the new pages, and the old site's `/team` now redirects to `/about/team`.
  - **Top menu:** an About dropdown (Our story, Team, Schools & partners, FAQ) and Contact. It works with a keyboard, a mouse and touch; 47 checks passed. To make room, the phone menu now starts below 1000 px wide instead of 960 px.
  - **Footer:** regrouped into Programs, About and Families. The address, phone and email sit under the logo, and the email no longer breaks mid-word.
  - **Starting text for new pages:** when the server starts, any page with no saved row gets its starting text, so a database filled before this change still gets the new pages. It never overwrites a saved page.
- **Open, for Hannah:**
  - **A trial holds a spot until the end of the term** if the family never continues. Should it expire, for example a week after the free class?
  - **Class counts:** `/admin` counts trials toward capacity but not in "Enrolled". The new staff class page should show both.
  - **Continuing early:** a family that continues on the day of the free class, before it starts, pays for that class in the prorated month (a few dollars). Left as is for launch.
- **Follow-ups noted:**
  - **Same-time checkouts:** two checkout forms open at once for the same child could both be paid. Recommended: refuse the second at payment and flag it for a refund.
  - **CI:** CI doesn't run the browser tests yet.
  - **Phone menu:** it could close on Escape, like the desktop dropdown.
  - **Draft wording:** one draft's reason still says "the schools list above".

### The 15% family discount covers the whole family (decided October 13)

Siblings in separate weekly classes already count toward the 15% (a unit test now proves it). Until now, though, only the child who enrolled second got the discount, so a family signing up at different times paid more than one signing up together. Decided:

- **Who gets it:** once a family has two or more active weekly-class enrollments, all of their remaining monthly payments are 15% off, whatever order the children signed up in.
- **What doesn't change:** paid months and seasons paid in full. There are no refunds, and the 10% still doesn't combine with the 15%.
- **Hannah's own discounts** apply on top of the family discount.
- **If the family drops back to one class,** the remaining payments return to the regular price. Staff see that before they confirm the drop.
- **When:** unit 9, started now.

### Units 8 and 7 merged (October 13)

On the merged branch: type check clean, 335 unit tests pass, the site builds, and all three browser tests pass.

- **Class dates retire on their own** (unit 8).
  - **The rule:** one rule (`src/lib/session-dates.ts`) decides what can be booked, everywhere: the class page, class cards, the class finder, the Geode page, the camps grid and every enrollment step, on the server too.
    - One-night dates close at their start time.
    - Camp weeks close when they start.
    - Weekly classes take late joiners until the cut-off.
    - Past dates disappear.
    - Hannah's status still applies on top. The server now also refuses "coming soon" dates.
  - **The cut-off:** a setting in **Site content → Announcement & site settings → Class sign-ups**, 4 weeks by default.
  - **What Hannah sees:** the editor marks sessions "Ended" or "Sign-ups closed". Nothing is deleted.
  - **What families see:** an old sign-up link shows a friendly "Sign-ups are closed" page. A payment already made when a date closes is still honored.
  - **Today:** Parents' Night Out offers Oct 24, Nov 14 and Dec 19 (Sep 25 is gone). The Homeschool Class (ends Oct 30) says sign-ups have closed and offers the email signup.
- **Playful wording, as drafts** (unit 7).
  - **Class wording:** 29 edits across 12 classes, camps and workshops are drafts in the editor, unpublished until Hannah publishes them. Seven of them replace an earlier SEO draft and keep its search words.
  - **Fixed wording:** 26 numbered lines (C1–C26) for the class page, the sign-up steps and the confirmation email are in `docs/review-2026-10/copy-drafts.md`. They're applied once Hannah approves them.
  - Every price, date, age and policy stays the same.
- **Open, for Hannah:**
  - **The cut-off:** confirm 4 weeks.
  - **Per-session classes:** Stories & Songs and the Homeschool Class are priced per session, not monthly, so a late joiner pays the full price. Should they close at their start instead?
  - **C1:** says "unless your child wants to stay" where the page says "until you decide to stay".
  - **C26:** adds a sign-off to the confirmation email.
- **Follow-up:** the browser tests use Intro to Theater, which passes its cut-off on Nov 20. Point them at a spring session when spring dates are added.
