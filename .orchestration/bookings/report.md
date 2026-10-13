# Bookings unit: report

Branch `claude/review-bookings`, from `claude/blissful-archimedes-enun5m` at a3adbd2. Audit notes 3, 4 and 8.

## Result

### 1. One booking path
- **`src/lib/events.ts`**
  - `eventSession` links an event to its class date. It uses the event's existing **Class page** field (`programSlug`) and the session whose single date equals the event's date. No new field was needed.
  - `eventAction` picks the event's button from that date:
    - **Register**, which opens `/enroll/<sessionId>`;
    - **Join waitlist**;
    - **Get notified**, which opens the class page's notify form;
    - no button once sign-ups have closed or Hannah closes the date.
  - An event with no matching date keeps its own button.
- **`src/components/EventTicket.astro`** uses `eventAction`, which covers the home page, `/events` and `/geode`.
- **Seed** (`events.ts`, `programs.ts`):
  - Both Google Form URLs are removed.
  - The nights' fallback button is now "Details", which opens the class page.
  - The Parents' Night Out and improv sessions no longer carry the form as an external link.
- **`src/pages/programs/[slug].astro`:** the "Registration is a short online form." note is gone.
- **`src/content/collections.ts`:** the help text on **Class page** and **Button** now says how booking works.

### 2. Nothing past, nothing broken
- **`src/lib/call-sheet.ts`** removes a card when:
  - its new optional **Take down after** date has passed;
  - it links to an event that is over, using `isUpcoming`;
  - it links to a class with no dates left, using `offeredSessions`;
  - it links to an event or class that doesn't exist.
- **`src/pages/index.astro`** uses that filter. The row now fits up to 4 cards.
- **`src/content/pages.ts`** adds the **Take down after** field.
- **Seed call sheet:**
  - Jack and the Beanstalk is replaced by the free class (Oct 15 & Nov 2).
  - A Variety Show card is added.
  - "Registration is open" comes down after Nov 19. That is the 4-week cut-off before Dec 18.
  - "Starts Tue, Oct 20" comes down after Oct 20.
- **The free class:**
  - Both dates are now **open** in the seed.
  - "Registration opens soon." is removed from the event summary. The SEO draft's `from` and `to` are updated, and `docs/seo/review.md` is regenerated.
- **`/camps`:** the free class has its own block, "Free". It isn't a mini camp, and the mini-camp text ("about $50 a day, a short show at pickup") doesn't fit it.

### 3. Show pages (`src/pages/events/[slug].astro`)
- **Where** always shows. It gives one of:
  - our location, with its address and map link;
  - a typed-in venue, with a Google Maps search link;
  - "Venue to be announced".
- **Tickets** always shows. It gives the event's price text, or its button link, or "Each enrolled student gets 2 free tickets; tickets for guests will be announced here." That wording is already a fact in the seed summary and in the FAQ.
- **Variety Show seed:** the placeholder price "Date and tickets coming soon" is removed, so the Tickets fallback shows.
- **Undated show:** a "Tell me when the date and tickets are announced" form. It reuses the existing notify lead form, with the show's slug as the program.
  - `/admin/leads` now shows the show's name for these sign-ups.
- **New event field, "Classes performing"** (`performers`):
  - The Variety Show lists Stories and Songs, Acting Studio and Film Creation. Their own pages say they perform or screen at the Variety Show.
  - The show page links to each.
- **What Hannah sets in the editor:**
  - **venue:** **Where** (a location) or **Or another venue**;
  - **ticket text:** **Price or tickets**;
  - **ticket link:** **Button**.
  - Help texts explain each. Only `performers` is a new field.

### 4. Program pages and confirmations
- **`src/lib/program-fit.ts`** sorts each program into a kind, from its kind, price and dates: weekly, school, free, drop-in, night, camp, party, lesson or adaptive. From that it chooses:
  - **The tag:** Adult Improv Night shows **"Monthly drop-in"**, because its dates are one a month in a row. This is on the class page, on `ProgramCard` and on `ProgramRow`, and only the tag text changed.
  - **Pricing lines:**
    - 15% off shows only on weekly classes with tuition. That is the rule checkout uses.
    - Pay-what-you-can shows on paid youth classes, camps and Ovation.
    - The free class shows "Free".
    - The school class shows "Set by the school".
    - Parents' Night Out shows "$30 for the first child, $10 for each additional child".
    - The adult night shows "$25 a night".
    - Parties and lessons get no box.
  - **FAQs by type:**
    - no tuition or unenroll answers on the free, school, adult, night and party pages;
    - no parking answer on the school class;
    - no answers about children on the adult night, and its heading reads "Questions people ask".
  - **The highlights heading:**
    - "What's included" on parties;
    - "What to expect" on Parents' Night Out and the adult night;
    - "What we can help with" on lessons;
    - "At a glance" on the free class.
- **Tag contrast:** the "What they'll practice" tags now use dark ink (#1c1826) on the tint, on every colour. On the Geode colour that is about 15:1, up from 1.23:1. The site has no dark theme, so there is only one theme to fix.
- **One-date bookings** (`startDate === endDate`):
  - **Confirmation page** (`confirmation.astro`): one **When** line, "Saturday, October 24, 5–8 pm (drop-off from 5, pick-up by 8)". The checklist is headed "Before you come".
  - **Confirmation email** (`sendOrderConfirmation`): the same line, with no "starting".
  - **Details step** (`details.astro`): one-off policies replace the monthly-tuition rules. They say:
    - pay once, no autopay; or "It's free" for the free class;
    - the drop-off window, for nights out;
    - "Everyone taking part must be 18 or older", for adults;
    - the door rule, for a kids' class;
    - "Can't make it? Let us know."
  - **Sidebar** (`EnrollShell.astro`): no "Dates: Fall 2026" row, and "Price" instead of "Tuition".
- **Adults** are no longer told to walk their child in, on the confirmation page or in the email.
- **`/events` accessible names:** each Register, Map and Add to calendar link names its event, for example "Register for Parents' Night Out, Sat Oct 24". All 25 names are unique.

### For families
- Parents' Night Out, improv nights and the free class can be booked in one place only: the site's own sign-up.
- The home page no longer shows the September show.
- The free class can be booked now.
- The Variety Show page always says where and what about tickets, and offers an email when it's announced.
- Class pages only show pricing and FAQs that apply.
- One-night bookings are confirmed as one night.

### For Hannah (to review in the editor)
- **Free class dates:** Oct 15 and Nov 2 are now **Open** in the seed (they were Coming soon). Close them if sign-ups shouldn't open yet.
- **Call sheet:** cards have an optional **Take down after** date, and cards about a past event or class come down on their own. The seed cards were changed as listed above.
- **Variety Show:**
  - set **Where**, **Price or tickets** and **Button** once known;
  - the placeholder price was removed;
  - **Classes performing** lists 3 classes; adjust it as needed.
- **Google Forms:** the Parents' Night Out and improv forms are no longer linked anywhere. Retire them, so no one books through an old link.

## Proof
- `npm run check`: 0 errors, 0 warnings.
- `npm test`: 13 files, **351 passed**. That includes 16 new tests in `tests/unit/bookings.test.ts`, covering:
  - the event-to-session link and its statuses;
  - the call-sheet filter by date, plus every seed link resolving;
  - the free class being open;
  - the kind, tag, pricing lines, FAQs and heading of each program;
  - the one-off date line, policies and arrival lines.
- **Two existing tests updated:**
  - `content.test.ts`: the call-sheet titles changed in the seed.
  - `family-access.test.ts`: the "coming soon is refused" test used to rely on the free class being coming-soon in the seed. It now sets that status in the editor (save and publish), checks the refusal, then reopens the date and books it.
- `npm run build`: complete.
- `npm run seo:review`: regenerated `docs/seo/review.md` (53 drafts).
- **Browser tests** on a fresh database (`tests/e2e/serve.sh`), run twice, the second time after the last change:
  - `enroll-journey.mjs`: all journey checks passed;
  - `trial-journey.mjs`: all free-class checks passed;
  - `content-editor.mjs`: all editor checks passed.
  - None follows an event's Register link, so none needed changes.
- **Scratch walk-through** (Playwright, not committed): 50 of 51 checks passed.
  - **Home:** 4 call-sheet cards, each link returns 200, and the home event buttons go to `/enroll/…`.
  - **`/events`:** 8 Register links go to enrollment, no Google links, unique accessible names.
  - **`/geode`:** Register goes to `/enroll/adult-improv-…`.
  - **Variety Show:** venue TBA, tickets fallback, performers, and the notify signup works.
  - **Class pages:** the free class, parties, Parents' Night Out and Athens Academy show the right pricing lines and FAQs. The free class has its own block on `/camps`.
  - **Parents' Night Out booked from `/events` and paid** (local test payment): one-off policies, and the one-off confirmation on the page and in the email.
  - **Free class booked for $0:** no payment step, and a one-off confirmation.
  - **Adult night booked:** no "walk your child".
  - No sideways scroll at 390 px on any page checked.
  - **The 1 failed check is a false positive in the script:** "Weekly class" appears on the adult improv page only in the related Acting Studio card and the footer. The page's own tag reads "Monthly drop-in".
- **Screenshots** in `.orchestration/bookings/shots/`, at desktop and 390 px:
  - home call sheet;
  - `/events`;
  - Variety Show;
  - Parents' Night Out details and confirmation;
  - adult confirmation;
  - free class;
  - party;
  - Geode tags (adult improv);
  - `/camps` free class.
  - The "Spring Showcase" in the `/events` shot was added by the editor browser test, not by the seed.
- **CI:** it runs on push; I didn't watch its result.

## Decisions
- **Link by `programSlug` + date, with no new field.** The data already has it, an event can't drift from its session, and Hannah has nothing extra to fill in. An event with more than one date, or no session that day, keeps its own button.
- **A matched date that is closed or has started shows no button,** rather than falling back to the event's own link. A fallback would bring back a second booking path.
- **The free class's "Details" now reads "Register"** when its date is open, as asked ("every Register… goes to enrollment").
- **Call sheet:** an optional date per card, plus rules from the link. Free-text "When" can't be read reliably. Links outside events and classes always count as current.
- **"Registration is open" until Nov 19,** from the default 4-week cut-off. If Hannah changes the cut-off, she changes this date by hand.
- **Free text venues get a Google Maps search link.** There's no address field for them, and adding a Location gives the full address and map.
- **The Variety Show's placeholder price is removed** so the Tickets fallback shows. It only repeated "date and tickets coming soon".
- **Classes performing is a field, not text matching** on "Variety Show". Its seed is limited to classes whose own pages name the Variety Show.
- **15% shows only where checkout applies it:** weekly classes, monthly or per-session. Camps no longer show it, because checkout doesn't give it to camps.
- **Pay-what-you-can is hidden for adults,** because its line speaks of students, and for nights out, parties, lessons, the school and the free class.
- **FAQs are chosen by group plus keyword filters on the question,** with no FAQ field. Another session owns the FAQ, so I left its data alone. If its questions are renamed, the filters fall back to the group.
- **No door-lock line for nights out**, because they have a drop-off window. Adults get their own parking line, written from the parking facts in the seed. The email's adult line was changed the same way.
- **Kind tag: only "class" kinds meeting on single dates** get a rhythm. Parents' Night Out keeps "Parties & nights out".
- **Weekly wording is unchanged,** so the copy drafts C1–C26 still match today's text. Their file line numbers have shifted.

## Open points
1. **Free class open now?** I recommend yes, as the brief says. Hannah confirms or closes the dates in the editor.
2. **pricing.ts still gives 15% to two people booking one adult improv night together**, because it is a "class" with a price. The page no longer advertises that. I recommend the pricing session limits the discount to weekly classes (month or session units).
3. **One-off refund or cancellation policy:** the site states none for one-night bookings. I wrote only "Can't make it? Let us know as soon as you can." I recommend Hannah gives a line; it can go into the Policies page that another session is making.
4. **The call-sheet free-class card text says "Thu, Oct 15 & Mon, Nov 2"** and stays up until Nov 2, so it lists Oct 15 after that date. I recommend Hannah edits the text after Oct 15, or accepts it.

## Follow-up candidates
- Give event cards the same map-search link for typed-in venues (Jack and the Beanstalk's card has none).
- Monthly-rhythm tags for Parents' Night Out ("Monthly night out").
- The adult improv page's "You might also like" shows Acting Studio (ages 11–17). Related classes could skip ages that don't overlap.
- Point the browser tests' journeys at an event Register link (Parents' Night Out from `/events`), like the scratch walk-through.

## Handoff
- **Pushed to `claude/review-bookings`:** 2 commits.
- **Files that may conflict with the parallel sessions:**
  - `ProgramCard.astro` and `ProgramRow.astro`: one tag line each, plus an import.
  - `src/pages/programs/[slug].astro`: the pricing box and the FAQ block.
  - `src/content/seed/pages.ts`: the call sheet only.
- **Untouched:** SiteHeader, the class finder, FAQ seed text, About, the contact form, and `pricing.ts`, `billing.ts`, `adjustments.ts`.

## Compaction
No compaction or restart happened in this session.
