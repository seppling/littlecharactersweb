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
