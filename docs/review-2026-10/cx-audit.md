# Customer journey audit (October 13, 2026)

Eleven made-up personas tried 38 tasks on the new site (as of commit b356846), mostly on phones. All 33 pages were checked at phone and desktop size. The same tasks were timed, read-only, on today's live site. Times come from a standard human-time model (decisions, taps, typing, reading, scanning), and page loads were measured on a slow 4G phone and a broadband desktop.

The full report, with charts and tables, is a private page shared by Stephen. The raw results stay outside the repository.

## Results

- **Tasks:** 18 done, 15 partly done, 5 not done; 20 of 38 within their target time.
- **Today's live site:** 5 done, 5 partly, 2 not done on the 12 tasks it shares with the new site. It sends a family to up to nine places (the site, a separate Squarespace login, Studio Director, six Google Forms, Eventbrite, PDFs, email, four payment methods). Its pages are 2.0–2.5 MB, and the parking PDF takes 40 s on a phone.
- **New site:** 250–410 KB a page; the main content shows in about a second on a slow phone connection.

## Fix before launch (ranked)

**Blockers**
1. **Give now loops after the domain move:** it links to the old `/giving-page`, which the new site redirects to `/give`. Needs a donation link from Hannah. Add Give to the menu.
2. **"First class free" isn't true for ages 4–6:** Stories and Songs is priced per session and has no trial. Checkout also pre-selects "Pay monthly" where the free class exists. Decision: offer a trial, or reword the promise to "most weekly classes, ages 7+".
3. **The fall show has no date, place or tickets** (it isn't on the live site either). The home call sheet still shows the Sep 27 show, and its link goes nowhere.
4. **Two booking systems:** Parents' Night Out and the improv nights use Google Forms in some places and the site's own sign-up in others.

**Major**
5. **Imported Studio Director families see an empty account** ("No classes yet"). Needs a welcome note and a working "confirm care details".
6. **Prices are hard to read:**
   - "$160/session" is unclear;
   - no "joining now" total before sign-up;
   - "10% off" is shown even when the 15% applies;
   - a class that starts mid-month charges a full first month;
   - the FAQ payment answers contradict checkout.
7. **One class at a time:** no "enroll another child", the details step and the card are asked again, and there's no family total.
8. **Dates that have passed, and template text that doesn't fit:**
   - the FAQ says "due October 1" and "by September 1";
   - the free class says "Registration opens soon";
   - one-off dates are confirmed as weekly classes;
   - "15% off" appears on free and quote-only programs.
9. **Facts that disagree:** ages on the home page and About, tuition ranges, Parents' Night Out prices, the improv nights "11 and up".
10. **No policies or privacy page.**
11. **Hard to find on a phone:** Give, Parties, Parents' Night Out and Parking aren't in the menu; no sign-in in the header; filters fill the first screen; the teen class is buried; the Geode tags have 1.2:1 contrast.
12. **Account basics:** the card on file isn't shown; no absence reporting; receipts don't name the child; no "Saved" message; two withdrawal deadlines.
13. **Old links:** the tuition PDFs aren't redirected; the parking-guide link points at the old site.

**On the live site now:** publish the fall show; fix the Contact email link (it goes to `email@example.com`); remove or relabel the Squarespace "Login"; turn off the pop-up.

**Content from Hannah:**
- show details;
- the donation link;
- 4–6 testimonials and a reviews link;
- a party price and guest limit;
- the summer window and teen intensive price;
- a reply time;
- a tax-deductibility note;
- a staff safety line, if true;
- the Schools page content.
