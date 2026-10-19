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
- **Revised October 19** from Hannah's answers: see "Studio Director answers" at the end of this log.

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

### Customer journey audit (October 13)

Eleven personas, 38 tasks, 33 pages, plus a baseline on the live site. Summary and ranked fixes: [cx-audit.md](cx-audit.md). The four blockers:
1. Give now loops after the domain move.
2. "First class free" isn't true for ages 4–6.
3. The show has no date, place or tickets.
4. Two booking systems for Parents' Night Out and the improv nights.

### Fix wave from the audit (decided October 13)

Stephen approved fixing every site-side note from the audit. Decisions:

- **Stories and Songs gets a free first class,** like the monthly classes. A family that continues pays for the remaining weeks, prorated from the 8-week price. This keeps the home page promise true for ages 4–6.
- **A class that starts mid-month** charges only for the classes in that first month, the same way late joiners are charged. Before, it charged a full month.

| # | Unit | Notes | Branch | When |
|---|---|---|---|---|
| 10 | Bookings and dated content: one booking path, call sheet, show page rows, program template by kind, one-off confirmations, Geode tag contrast | 3, 4, 8 | `claude/review-bookings` | now |
| 11 | Navigation: menu items, phone sign-in, finder sort and filters, keyboard and heading fixes | 11 | `claude/review-navigation` | now |
| 12 | Facts and policies: ages from data, FAQ payment answers, Policies page, contact form topics | 6 (FAQ), 9, 10 | `claude/review-facts` | now |
| 13 | Prices and checkout: price labels, joining-now total, discount label, mid-month proration, Stories and Songs free class, another child, family totals | 2, 6, 7 | `claude/review-pricing` | after unit 9 |
| 14 | Account basics and old links: imported-family welcome, card on file, receipts, saved message, Give link setting, old PDF redirects | 1 (site part), 5, 12, 13 | `claude/review-account` | after unit 9 |

### Units 9–12 merged (October 13)

On the merged branch: type check clean, 388 unit tests pass, the site builds, and all four browser tests pass (the new navigation test included). A December billing run on the test database charged the expected amounts: Ava $80.75 (family discount, her brother paid the season in full), and Maya $55 ($95 less a $40 scholarship).

- **The family discount covers the whole family** (unit 9).
  - **How it works:** each monthly payment keeps its regular price from checkout (migration `0007_family_discount`). Whenever enrollments change, and in every billing run, the 15% is recomputed on payments that can still change. Hannah's discounts then apply on top.
  - **What families see:** the review page says when another child's payments drop; the account, receipts and charges show "Family discount (15%)".
  - **What staff see:** "Stop payments" shows which other payments go back up before it stops anything.
  - **When it ends:** the family gets an email.
  - **What counts:** only monthly-priced weekly classes, not session-priced classes or drop-in nights.
  - **Confirmed by Stephen (October 13):** the end-of-discount email, and a paid-in-full withdrawal still counting until the class ends. Changed by Stephen: weekly classes priced per session (Stories and Songs, Homeschool) also count toward the two; drop-in nights don't. Two or more students in one sign-up keep the 15% whatever the price type, except drop-in nights. Unit 13 makes these changes.
- **One booking path** (unit 10).
  - **Booking:** Parents' Night Out and improv-night "Register" buttons go to the site's own sign-up. The Google Forms are gone from the seed.
  - **Dates:** the home call sheet shows only upcoming items. The free class dates are open for sign-up.
  - **Show pages:** they always show "Where" and "Tickets", and offer "tell me when" for an undated show.
  - **Program pages:** pricing lines, questions and "What's included" depend on the type of program, and adult improv shows as a monthly drop-in.
  - **Confirmations:** one-off bookings are confirmed in one-off words, with policies that fit.
  - **Accessibility:** the Geode tags are readable, and event links say which event they're for.
- **Navigation** (unit 11).
  - **Menu:** Give, Nights out & parties, and Parking are in the menu, and the phone header has a sign-in link.
  - **Class finder:** it sorts by age fit (Acting Studio leads for 14–17, school-only and homeschool classes come last), and on phones the filters fold away once an age is picked.
  - **Accessibility:** the phone menu closes with Escape and keeps keyboard focus; the account and sign-up pages have a main heading; the contrast fixes are in.
- **Facts and policies** (unit 12).
  - **Ages and prices:** taken from the class data, so the home page age guide, About and Geode now agree.
  - **FAQ:** its payment answers match checkout.
  - **Parents' Night Out:** priced one way everywhere.
  - **Withdrawing:** one rule (5 days before the 1st).
  - **Policies page:** new and editable in the editor; a draft for Hannah to read.
  - **Contact form:** new topics (a missed class, a school partnership); signed-in parents are prefilled; a copy is emailed to the sender; a reply-time setting appears only when Hannah sets it.
- **For Hannah to confirm:**
  - the free class sign-ups being open;
  - a cancellation line for one-night bookings;
  - the FAQ sentences (checks or cash by arrangement? the timing for cancelling small classes);
  - the whole Policies page (how long data is kept, what the photo permission covers, and a lawyer's read of the privacy part);
  - the reply time;
  - the wording of the end-of-discount email.

### Units 13 and 14 merged (October 13)

On the merged branch: type check clean, 438 unit tests pass, the site builds, and all four browser tests pass. November and December billing runs on the test database charged the expected amounts: Ava $80.75 (family discount), Maya $95, then $55 after a $40 scholarship.

- **Prices and checkout** (unit 13).
  - **Free first class:** Stories and Songs (and any Little Characters weekly class priced per session) now has one. Families who continue pay for the classes left, out of the session price.
  - **Mid-month starts:** a class that starts mid-month charges only that month's classes (Acting Studio from Oct 20: $47.50), and tuition lines name their class count.
  - **Prices:** session prices read "$160 for 9 weeks ($17.78 a class)". Each weekly class page shows "Joining now, per student", from the same quote checkout uses.
  - **Review page:**
    - new students start on the free first class;
    - the season option names the discount it really gets ("same total as paying monthly" with the 15%);
    - "Enroll another child or class" appears there and on the confirmation page;
    - details on file show as one line with Edit;
    - the confirmation page shows family totals, and the email says when another child's payments went down.
  - **Family discount:** session-priced weekly classes count toward it; drop-in nights never get the 15%.
- **Family account, giving and old links** (unit 14).
  - **Imported families:** they see "Welcome from Studio Director!" instead of empty panels. "Confirm care details" leads to a "Looks right" button, and the sign-in page says "Moving from Studio Director?".
  - **Payments:** the card on file shows (brand, last four, expiry; migration `0008_card_on_file`), with a "don't email card numbers" note. Autopay is grouped by date with totals, receipts name the child, and there's a statement line.
  - **Other account changes:**
    - a "Saved" message;
    - "Can't make it?" on each class;
    - per-child calendar files that start at the child's first class, with a reminder.
  - **Giving:** the Give page uses a donation-link setting. Until Hannah sets it, the button reads "Email us to give". The editor refuses links to the old site.
  - **Old links:** the old tuition PDFs, a show program, past class pages and template pages now redirect.
- **For Hannah:**
  - **Stories and Songs runs 9 Tuesdays (Oct 20 – Dec 15), but its text says 8 weeks.** Is a week off (which one), or is it 9 weeks? Once she answers, add "no class" dates or update the wording.
  - The donation link, the tax note, and the Studio Director billing end date (Site settings).
- **For Stephen:** should a last month that ends mid-month also be charged only for its classes? Today it's a full month.

### Studio Director answers (October 19)

Hannah's check-in form is complete. No family names were given.

- **Used weekly:** home, class calendar, classes list, the enrollment tab, attendance, each class's instructors and dates, emailing a class, communications, search.
- **Monthly:** waitlist, adding a student, tags, skills, instructors, charges, reports, settings.
- **Rarely:** families, students (she finds people through search), print, clone. **Never:** none.
- **Her answers:**
  - **Attendance:** teachers take it on their phones and send Hannah a note. She wants teachers to see their rosters and take attendance in a phone app.
  - **Make-ups:** none. **Drop-ins:** yes, a child can drop in to one class and pay for it; tracked through payments.
  - **"Performing":** she doesn't know it. Dropped.
  - **Tags and skills:** not used yet, but they will be.
  - **Reports:** everything Studio Director has. We need the list of its reports.
  - **Messages:** weekly, by Gmail and group texts.
  - **Charges besides tuition:** the performance fee. Refunds and credits would be nice to have in the portal.
  - **Who signs in:** teachers.
  - **Cost:** $120 a month.
  - **Keep:** the layout built around performance businesses.
  - **Fix:** easy screens for her and the teachers, so they actually use them, and a phone app.
  - **Asked:** whether Claude can connect to Studio Director to see it. It has no public API or connector that we could find, so we asked for screenshots of its Reports page instead (no family data on it).
- **The plan, revised:**
  - **By launch:** unchanged, plus one search box for families, students and classes, and email the class (used weekly, so it's needed at launch). Built phone-first.
  - **By the first spring class,** in this order:
    1. teacher logins with a phone screen for today's class: the roster, and attendance in one tap; instructors on each class;
    2. the class calendar, with each class's dates and days off;
    3. paid drop-ins to a single class;
    4. refunds and credits;
    5. tags and skills;
    6. reports matching Studio Director's;
    7. staff settings.
  - **Dropped:** make-ups, "Performing", cloning classes.
  - **Later:** group texts need a paid texting service; families keep the current group texts for now.
- **Open:**
  - **For Stephen:** the phone app: an app that installs from the website to the phone's home screen (recommended), or one in the app stores.
  - **For Hannah:** the drop-in price for a single class, and screenshots of the Reports page.

### Back-office plan drafted (October 19)

Stephen asked for research into the best studio portals first, then a plan for web and phone. The plan is a shared document: [Staff back office plan: web and phone](https://claude.ai/code/artifact/d286c39d-0260-4827-bf89-9456b1f32c51). The research notes are in `backoffice-research.md`.

- **Phone access:** a home-screen web app (Stephen chose it over an app-store app). Same site, phone layout, sign-in by the emailed code.
- **Phase 1, by launch:** Today with a "Needs attention" list, Classes, a class's roster and waitlist, email the class, one search box, a family's page, payments, downloads, the phone app shell.
- **Phase 2, by the first spring class:** teacher logins and phone attendance (works offline), class teachers and substitutes, calendar and days off, paid drop-ins, refunds and credits, tags, skills, shows, reports matching Studio Director's, settings.
- **Waiting on:** Stephen's approval of Phase 1, and the questions listed at the end of the plan.

### Phase 1 started, and how reports will work (October 19)

- **Approved:** Stephen approved Phase 1. Building started with the foundation unit (`claude/bo-foundation`): the data for all of Phase 1, the staff shell for computer and phone, the link contract, badges, CSV and PDF downloads, a fresh sign-in for downloads, and the phone app shell.
- **Family details:** add emergency contacts and a list of who may pick up the children to the family's forms, in Phase 1. ZIP code and "How did you hear about us?" are asked once per family, for two of Studio Director's reports.
- **Drop-in price:** to be decided before Phase 2's drop-ins.
- **Reports (Stephen):** a dashboard of the most important numbers, plus a library of report tables, each downloadable as CSV and PDF. The CSV and PDF helpers are built in Phase 1, so every Phase 1 list gets them. The dashboard and library come in Phase 2.
- **The dashboard's numbers, with how each is counted,** are listed in the plan document:
  - money: collected this month, booked for the next 1st, committed ahead, problem payments, discounts given;
  - enrollment: children this season, fill rate, classes at risk (under the 5 students a class needs), waitlists, sign-up pace;
  - growth: free class to paid, coming back, how new families found us;
  - safety and operations: care details on file, missed two in a row, attendance taken.
- **Open for Stephen:** load last season's class counts and totals from Studio Director once, as a starting point for comparisons (recommended).
- **Studio Director's reports:** the full list from Hannah's account is matched in `studio-director-reports.md`. Questions for Hannah: pre-approved classes, sales tax, merchandise.

### Back office foundation merged (October 19)

The foundation unit (`claude/bo-foundation`) is merged.
- **Proof on the merged branch:**
  - type check clean;
  - 479 unit tests pass;
  - the site builds;
  - all five browser tests pass on a fresh database (the four journeys, then the new `staff-foundation.mjs`).
- **What's in it:**
  - migration `0009_back_office`:
    - household emergency contacts, pickup people, contacts confirmed, ZIP, how they heard;
    - staff notes, the staff email log and waitlist offers;
  - the staff shell: a dark top bar with search on computers; on phones, the title, a back link, a Menu and tabs (Today, Classes, Search, Alerts);
  - the link contract (`src/lib/admin-links.ts`), badges, and CSV and PDF downloads (pdfkit, Helvetica);
  - a fresh sign-in (15 minutes) before downloads, at `/admin/confirm`, and a 30-day idle limit for staff sessions;
  - the staff app manifest and icons, and `/admin/install`.
  - Rosters moved to `/admin/classes` and autopay to `/admin/payments`; the old addresses redirect. `/admin/search` and `/admin/attention` are placeholders until their units merge.
  - The contract for the next units is `docs/back-office.md`.
- **A walk-through as Hannah on a phone** (Stephen asked the worker for it) found these. They went into the next units' prompts:
  - the moved roster and Classes list are too wide for a phone;
  - phone numbers aren't tap-to-call;
  - titles don't match the tabs;
  - Payments buttons break mid-word;
  - Classes lists past one-off dates.
  - **Still open:** sign-out should return staff to the staff sign-in; a teacher who isn't on the staff list sees a bare "Not found" (show the staff-only panel with Sign out); the focus ring in the dark bar is too faint. These go to the Today unit.
- **Open points kept for later:**
  - the content editor should 404 signed-in families like other staff pages;
  - a dependency update before launch (`npm audit` lists sharp and http-cache-semantics advisories).
- **Next:** classes (`claude/bo-classes`), families (`claude/bo-families`) and contacts (`claude/bo-contacts`) started at 03:19Z.

### Classes, families and family details merged (October 19)

Three units are merged: contacts (`claude/bo-contacts`), classes (`claude/bo-classes`) and families (`claude/bo-families`).
- **Proof on the merged branch:**
  - type check clean;
  - 524 unit tests pass;
  - the site builds;
  - all eight browser tests pass on one fresh database: the four journeys, then `staff-foundation`, `staff-contacts`, `staff-classes` and `staff-families`.
- **Family details:**
  - the details step and the account ask once per family for emergency contacts (at least one), who may pick up, ZIP, and how they heard about us;
  - families with details confirmed within a year see one summary line;
  - the Studio Director import brings emergency contacts and ZIP when the export has them;
  - a Policies wording draft for Hannah names the new details.
- **Classes:**
  - the Classes list has filters (openings, waitlist, under 5, term, ended);
  - a class's page has the roster with badges, care details on tap, Call, Text and Email, the waitlist, a print page, roster and list CSV/PDF, and a sign-in sheet PDF.
- **Families:**
  - one search box for families, parents (any phone format), children and classes;
  - the Families list;
  - a family's page with everything, notes, and staff edits that don't count as the family's confirmation;
  - four Studio Director reports as CSV/PDF: Family List, Student / Class List, Student Contact List, Family Notes.
- **Coordinator fixes at merge:**
  - `admin.css`: the badge tones come after the base badge rule, because allergy badges showed green; the header's action row no longer stacks;
  - two journey tests look for the new roster;
  - the classes and families browser tests expect the new family details.
- **For Hannah:**
  - keep one emergency contact required (`EMERGENCY_CONTACT_REQUIRED`);
  - the "How did you hear about us?" options;
  - the Policies draft line that teachers see contacts from spring;
  - teacher names are missing on some sessions in the editor (Homeschool, Geode Acting Studio, Parents' Night Out, the free class).
- **Follow-ups:**
  - a `classSignInSheet` and a `familyLists` link function in `admin-links.ts`;
  - remove the scoped badge workarounds now that `admin.css` is fixed;
  - search emergency contacts and pickup people by name.
- **Next:** today (`claude/bo-today`), payments (`claude/bo-payments`) and messages (`claude/bo-messages`) started at 04:40Z. Roster changes come after.

### Payments, Today and staff email merged (October 19)

Three units are merged: payments (`claude/bo-payments`), today (`claude/bo-today`) and messages (`claude/bo-messages`).
- **Proof on the merged branch:**
  - type check clean;
  - 570 unit tests pass;
  - the site builds;
  - all 11 browser tests pass on one fresh database.
  - On a fresh database after the two family journeys, December's billing run charges $80.75 (Ava, family discount) and $55 (Maya, scholarship), the same as before these units.
- **Payments:**
  - one Payments page with Needs attention first. "Send a pay link" re-sends the same pay-now email a failed charge sends, and `billing.ts` only moved that email into `sendPayLinkEmail`;
  - upcoming autopay by date, families on autopay, and payments received by month;
  - Overdue List, Upcoming Autopay and Payments List as CSV/PDF;
  - phone layout fixed.
- **Today:**
  - today's classes and Needs attention: failed payments, waitlist openings, classes under 5 near their start, no emergency contact, care details to confirm, new sign-ups, form messages, birthdays;
  - an urgent count beside Today and Alerts;
  - staff sign-out returns to the staff sign-in;
  - signed-in non-staff see a Staff only panel (404 status);
  - a yellow focus ring in the top bar.
- **Staff email:**
  - Email the class and Email this family: tick families, send a test, review, send one email per family with replies to Hannah;
  - no double sends, failed families can be retried, and emails are logged on each family's page;
  - Copy emails and Copy phone numbers.
- **Open, recommended as is:**
  - "Pay link sent" counts only staff sends;
  - Send a pay link doesn't pause the automatic retries;
  - unticked families aren't remembered between emails.
- **Follow-ups:**
  - one-off nights shouldn't count as "under 5" on the Classes list (`classes.ts`);
  - failed staff emails on Needs attention;
  - bounces from the email service.
- **Next:** roster changes (`claude/bo-roster`) started at 05:53Z: add a child (sign-up link, or without charge), remove a child (with or without stopping payments), Offer the spot.

### Roster changes merged; Phase 1 complete (October 19)

The roster changes unit (`claude/bo-roster`) is merged, and Phase 1 of the staff back office is complete.
- **Proof on the merged branch:**
  - type check clean;
  - 584 unit tests pass;
  - the site builds;
  - all 12 browser tests pass on one fresh database.
  - December billing after the family journeys charges $80.75 (Ava, family discount) and $55 (Maya, scholarship), as before.
- **What's in it:**
  - **Remove** a child from a class:
    - "Remove and stop payments" or "Remove only", with a preview;
    - an order that covers a sibling who stays keeps its payments, and Hannah is pointed to a discount;
    - the family discount is refreshed.
  - **Add** a child:
    - by sending a sign-up link (the family pays as usual);
    - or without charge, with a fresh sign-in and a reason (`enrollment.no_charge_reason`, migration 0010).
  - **Offer the spot:** a waitlisted family gets a 48-hour offer. The first family to pay gets the place, and their waitlist entry becomes the enrollment. Today subtracts open offers.
- **For Stephen to confirm:** a no-charge place never counts toward the 15% family discount (recommended).
- **For Hannah to confirm:** offers last 48 hours (`OFFER_HOURS`).
- **Not built:**
  - refunds and a last-month proration after a removal (Stripe's dashboard for now);
  - "Take off the waitlist".

**Phase 1 by unit** (all on `claude/blissful-archimedes-enun5m`):

| Unit | What it does |
|---|---|
| foundation | Data, staff shell, link contract, badges, CSV/PDF downloads, fresh sign-in, staff idle limit, phone app shell |
| contacts | Emergency contacts, pickup people, ZIP, how they heard |
| classes | Classes list, class pages, print, sign-in sheets |
| families | Search, family pages, notes |
| payments | Payments pages and Send a pay link |
| today | Today and Needs attention |
| messages | Class and family email |
| roster changes | Add, remove, offer the spot |

### Phase 2 started (October 19)

- **Stephen's inputs:**
  - a test teacher account: his own email, kept out of the repository and added on the Settings page once it's live;
  - $25 as a placeholder drop-in price, a site setting that Hannah can change.
- **Order:**
  1. **Foundation** (`claude/bo2-foundation`):
     - staff roles (owner, teacher) and teachers on classes, with substitutes;
     - the Settings → Staff page and a shared-device sign-in;
     - every Phase 2 table in one migration (0011);
     - Phase 1 cleanups (one-off nights aren't "under 5", link helpers, the content editor's staff check, a `sharp` update).
  2. **The teacher app, the calendar and days off, drop-ins.**
  3. **Refunds and credits, tags and skills, shows.**
  4. **Reports (the dashboard and the library), and the rest of Settings.**
- **Shows:** the performance fee is already charged at sign-up, so casting creates no new charge until Stephen decides otherwise.


### Phase 2 foundation merged (October 19)

The foundation unit (`claude/bo2-foundation`) is merged.
- **Proof on the merged branch:**
  - type check clean;
  - 618 unit tests pass;
  - the site builds;
  - all 13 browser tests pass on one fresh database (the new `staff-settings` runs last);
  - December billing after the family journeys charges $80.75 (Ava, family discount) and $55 (Maya, scholarship), as before;
  - the Render preview's database step migrates from empty.
- **What's in it:**
  - **Staff roles.** Owners (the `ADMIN_EMAILS` emails, or added as an owner on the site) and teachers. Every Phase 1 page stays owner-only. A teacher who opens `/admin` lands on `/admin/teach`. Any owner page shows a teacher the Staff only panel.
  - **Settings → Staff:**
    - add a teacher or an owner;
    - choose their classes (teaches or assists) and substitute dates;
    - change a name or role;
    - turn someone off.

    Each change asks for a fresh sign-in and is written to the audit log. Owners can't turn themselves off.
  - **"This is a shared device"** on the staff sign-in: the session ends after an hour without use.
  - **The data for the rest of Phase 2,** in migration 0011: attendance, attendance done, days off, drop-ins, tags, skills, progress notes, casts, rehearsals, credits, refunds, favorite reports and staff settings.
  - **Phase 1 cleanups:**
    - one-off nights aren't "under 5";
    - link helpers;
    - the content editor uses the staff check;
    - `sharp` 0.35.5 (its `npm audit` advisory is gone).
- **Coordinator additions at the merge:**
  - **Migration 0012:** a no-charge reason and a cancel reason on drop-ins, a `pending` drop-in status for open checkouts, and "note read" on a teacher's note to Hannah;
  - **`src/server/class-day.ts`** (with unit tests), so the next three units agree on days off and who's expected on a class date.
- **Stephen's test teacher account:** added on Settings → Staff once the site is deployed; not in the repository.
- **Next:** the teacher app, the calendar and days off, and drop-ins ($25 placeholder), in parallel.

### Merged to main (October 19)

Stephen approved it. [Pull request #15](https://github.com/seppling/littlecharactersweb/pull/15) brought Phase 1 of the back office and the Phase 2 foundation into `main` (merge commit 648503a), after GitHub's checks passed. Nothing deployed: the production Blueprint isn't set up yet.

**Stephen's steps to set it up** (`docs/infrastructure.md` → Production on Render):
1. Resend.
2. The Stripe test keys.
3. The Render Blueprint (`render.production.yaml`, branch `main`).
4. The Stripe webhook.
5. Back up `DATA_ENCRYPTION_KEY`.
6. Delete the two duplicate Render services.

**Optional:** last season's totals from Studio Director, as a starting point for the dashboard's comparisons. Totals only, no family names; needed by the reports unit.

### Resend set up (October 19)

Stephen connected Resend to Claude and chose a subdomain.
- **The domain:** `mail.littlecharacters.org`, US East, sending only, with open and click tracking off.
- **The site's sender** is now `Little Characters <hello@mail.littlecharacters.org>`, in the code's default, `.env.example` and `render.production.yaml`. Replies still go to the studio's Gmail.
- **DNS:** littlecharacters.org's DNS is at Squarespace Domains, which supports Resend's one-click setup. The main domain already has Google mail and a DMARC record (`p=none`); neither changes.
- **Waiting on Stephen:**
  - **Auto configure** in Resend, then verification;
  - a sending-only key, limited to the subdomain, pasted straight into Render when the Blueprint is set up. It isn't created here, so it never passes through chat.
