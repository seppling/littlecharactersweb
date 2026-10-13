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
