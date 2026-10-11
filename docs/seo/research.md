# Search plan for littlecharacters.org

October 11, 2026. Written for the SEO draft (see `docs/seo/log.md`). This plan sets the targets for all the new wording. It changes nothing on the site by itself.

**Who uses which part**

| Session | Read |
|---|---|
| Wording for site pages (home, `/programs`, `/camps`, `/events`, `/about`, `/geode`, `/faq`, `/give`, `/contact`) | §0, §1, §3.1, §4, §6, §7 |
| Wording for classes, camps, events and FAQs | §0, §1, §3.2, §3.3, §4, §6, §7 |
| Google Business Profile kit | §0, §1, §2, §4, §5, §6, §7 |

## 0. Ground rules for everyone who writes from this plan

1. **Say "Athens, GA" or "Athens, Georgia" in the title or the description of every page (both where they fit).** Where a 40-character title has no room for "GA", the description carries it. Every search for "kids theater Athens" returned results for Athens, Ohio; Athens, Alabama; the Athens Theatre in DeLand, Florida; Athens, Tennessee; and Athens, Greece. The state is what tells Google (and the parent scanning results) which Athens this is. In body text, "Athens" alone is fine once the page has said "Athens, GA".
2. **Use the words parents type, in the brand's voice.** Parents type "kids", "acting", "drama", "theater camp", "birthday party", "special needs", "homeschool", "teen", "voice lessons". The site says "Little Characters", "students", "friends", "differently-abled". Keep the brand's warmth, and make sure the plain search word appears at least once in the heading or first paragraph. Don't repeat a phrase to pad a page.
3. **"Theater", not "theatre".** The brand spells it "Theater" (Little Characters Theater Troupe). Google treats the two as the same word.
4. **Ages on every class.** Age is the first filter parents use. Put the age range in the search title or the first sentence of the description of every class and camp.
5. **Only facts from the seed.** Every number, price, date and claim below comes from `src/content/seed/*.ts`. Anything else is a question in §6. Don't write "the only…", "the best…", "award-winning", student counts or towns served until Hannah answers §6.
6. **"First class free" only where it's true.** The rule (`hasFreeFirstClass` in `src/lib/pricing.ts`) is: Little Characters weekly classes with monthly tuition. Today that is Intro to Theater, Yes, And… Improv, Produce a Show, LC/Geode Performance Troupe and Film Creation. It is **not** true for Stories and Songs, the Homeschool Class (8-week price), Athens Academy Enrichment, Geode: Acting Studio (Geode brand), camps, parties or lessons. Pages that cover many programs say "most weekly classes", as the site already does.
7. **How titles are built today.** `src/layouts/Base.astro` renders `<title>` as `{seo.title or page title} · Little Characters`. The ending " · Little Characters" is 20 characters, so **a title field must be 40 characters or fewer** to keep the full title within 60. The home page with no title field renders "Little Characters Theater Troupe · Athens, GA" (the site name is "Little Characters Theater Troupe", from `src/config/site.ts`, not "Theater Co."). Each target in §3 gives the field value and the full title as it would appear. The Google setup unit (`claude/seo-google-setup`) may change how titles are assembled ("place in page titles"); if it does, recount against its rule before loading drafts.
8. **Where the fields live.** Site pages have an `seo` group (title max 70, description max 300 in the editor; this plan keeps to 60/155). Programs and events have no `seo` group yet; today a program page uses its `title` and `summary`. The Google setup unit is adding search fields for class pages. Until it lands, the program targets below are for those new fields, not for `title` or `summary` (the visible name "Stories and Songs" stays).

## 1. Search demand

**No search-volume tool was available.** Every volume judgement below is an estimate, based on: the size of the market (Athens-Clarke County has roughly 130,000 people, many of them UGA students without children; the families are a smaller slice, plus nearby Oconee, Madison, Jackson, Oglethorpe and Barrow counties); how many local businesses compete for each need (seen in §2); whether local parent sites publish a guide for that need (Macaroni KID Athens publishes yearly summer camp, fall classes, birthday party and school-break camp guides, a good sign of steady demand); and general patterns in how parents search for children's activities. Treat "higher" and "lower" as relative to each other, not as numbers.

| Need | Example searches | Ready to sign up, or browsing? | When searches peak | Estimated volume (relative) | Page that should answer |
|---|---|---|---|---|---|
| **Classes by age** | kids acting classes Athens GA · theater classes for kids near me · drama classes for 7 year olds · preschool theater class Athens · after school activities Athens GA | Mixed: "near me" and age searches are close to ready; "after school activities" is browsing | July–early September (fall term starts Aug 17); December–January (spring term) | Medium. The steadiest demand; competes with dance, gymnastics and art | `/programs` (all), each class page for age searches, home for the broad search |
| **Summer camp** | summer camps Athens GA 2027 · theater camp Athens GA · drama camp for kids Athens · performing arts camp Athens Georgia · half day summer camp Athens | Browsing in January–February (building a list), ready in March–May | January–May, highest February–April; a small second wave in late May for gaps | **Highest** of all the groups. Every local parent site runs a camp guide | `/camps` (theater camps in general), `/programs/summer-camp` (summer 2027 dates and sign-up) |
| **Holiday and break camps** | fall break camp Athens GA · thanksgiving break camp Athens · winter break camp Athens GA · teacher workday camp Athens · spring break camp Athens | Ready: a parent with a date to cover | 2–4 weeks before each CCSD break (fall break, Thanksgiving, winter break, MLK Day, spring break) | Low to medium, in short spikes | `/programs/mini-camps-and-workshops`, `/camps#mini` |
| **Birthday parties** | kids birthday party places Athens GA · birthday party venue Athens GA · unique kids party ideas Athens · theater birthday party | Ready (a date is set) | All year; slightly more in spring and before the winter holidays | Medium. Many competitors (trampoline parks, art studios) | `/programs/parties` |
| **Homeschool** | homeschool drama class Athens GA · homeschool theater Athens · homeschool PE/arts enrichment Athens · homeschool co-op Athens GA | Ready; homeschool families plan by semester | July–August and December–January | Low, but few competitors (no Athens homeschool drama class showed up at all) | `/programs/homeschool-class` |
| **Teens** | teen acting classes Athens GA · drama classes for teenagers Athens · teen theater camp Athens · acting classes for 12 year olds | Mixed. Often the parent searches; sometimes the teen | July–September; February–April for teen camps | Low to medium | `/geode`, `/programs/geode-acting-studio`, `/programs/performance-troupe` |
| **Inclusive and special needs (Ovation)** | special needs theater class Athens GA · adaptive drama class · autism friendly activities Athens GA · inclusive kids activities Athens | Ready: parents of children with disabilities search hard, because options are scarce | All year | Low, but a high-value search: few pages answer it, and the family often stays for years | `/programs/ovation`, with the inclusion section of `/about` and the FAQ "Can you support my child's specific needs?" |
| **Private lessons** | private acting lessons Athens GA · voice lessons for kids Athens GA · audition coaching Athens · singing lessons Athens GA | Ready | Before audition seasons (school musicals in winter; summer productions in spring); also all year | Low for acting; **medium for voice/singing lessons** (many music teachers compete) | `/programs/private-lessons` |
| **Adult improv (Geode)** | improv classes Athens GA · adult improv Athens · things to do in Athens GA at night · fun classes for adults Athens GA | Browsing; "things to do" is impulse | All year; more in January (new-year hobbies) | Low to medium. Flying Squid Comedy is the main competitor | `/programs/geode-adult-improv`, `/geode#improv` |
| **Parents' Night Out** | parents night out Athens GA · kids night out Athens · date night childcare Athens GA · drop off childcare Athens Friday night | Ready (a date night in mind) | A week or two before each date; before Valentine's Day and in December | Low; no Athens, GA result appeared at all, so the field is open | `/programs/parents-night-out` |
| **Shows and events** | kids events Athens GA this weekend · children's theater Athens GA · family things to do Athens · free kids activities Athens GA | Browsing | Weekly, especially Thursday–Saturday; around shows (December, May) and festivals | Medium for "things to do with kids"; low for "children's theater" | `/events`; `/programs/free-community-class` for "free" searches |
| **The brand itself** | little characters athens · little characters theater · geode athens improv | Ready: they already know the name | All year | Low but must win #1 | Home, `/geode` |

**What this means for the launch date.** The site goes live in mid-November. The first demand it meets is Thanksgiving and winter-break camps, then spring classes in December–January, then the summer camp season from January. **The summer camp page must be live, indexed and showing "Summer 2027" before January**, even before dates are set, with the email sign-up as the call to action.

## 2. Who shows up today

**How this was done, and its limits.** Sixteen searches through a web search tool on October 11, 2026 (the queries are in the report). The tool returns ordinary web results, not Google's map pack, ads or "near me" results, and it isn't located in Athens. **I could not see the map results (Google Business Profile)**, which for "near me" and "kids theater classes Athens GA" usually appear above the regular results on phones. Nothing was opened that needed a sign-in; no one was contacted.

### Who appears, by need

| Need | Who appears | Which of their pages | Why they probably rank |
|---|---|---|---|
| Kids theater classes | The Studio Athens (dance and musical theater, ages 2.5–18); Rose of Athens Theatre Academy (old listings); Athens Creative Theatre (Athens-Clarke Leisure Services); Little Characters | Macaroni KID Athens directory pages; Patch community posts; the county's ACC page | Listed in local directories; Patch and Macaroni KID have strong domains and name "Athens" and the state. Out-of-state Athens results crowd the page |
| Summer and theater camp | Athens Creative Theatre (Youth Tech, Youth Performance, Teen Performance camps, ages 8–17, at the Morton Theatre); UGA Summer Academy acting camp (ages 11–17) and UGA Drama Dawgs; The Stage Oconee (Watkinsville, grades K–12); Athens Academy summer camps; **Little Characters' old `/camp` page** | Macaroni KID "2026 Summer Camp Guide" directory; ACC "Camps & Classes" and MyRec program pages; ActiveKids camp listings; littlecharacters.org/camp | A page for exactly that need with "summer camp" in the title; strong government and university domains; listing in the Macaroni KID camp guide |
| Holiday camps | Rocksprings Community Center (ACC); Athens YMCA (Dynamic Days); Canopy Studio; Athens Academy | Macaroni KID "Thanksgiving break camps in Athens and Oconee" and "Winter break camps in Athens and Oconee" articles | Macaroni KID writes a roundup before each break, and it ranks for the break name |
| Birthday parties | Pump It Up, 'Brella Studio, RUSH Trampoline Park, Chuck E. Cheese, Showtime Bowl, ARTini's, Board and Brush, Frog Stomp, Treehouse Kid & Craft | Macaroni KID "Birthday Party Planning Guide" (2024 and 2025 editions); Peerspace venue lists | Reviews (Yelp, Google); being in the Macaroni KID party guide; pages titled "birthday parties" |
| Homeschool | Firefly Homeschool Community; Masterpiece Art Instruction; Athens Academy drama (a school program) | TheHomeSchoolMom local listings | **No Athens homeschool drama class appeared.** A clear opening |
| Teens | UGA Summer Academy (acting, ages 11–17); Athens Creative Theatre (Teen Performance Camp); Circle Ensemble Theatre (old adult classes) | UGA Georgia Center pages; TeenLife listing | University domains; a page per camp |
| Special needs | Athens Creative Theatre's "Monologues & More" for teens and adults with cognitive disabilities (it won a Georgia Recreation and Park Association award, per Patch) | Patch community posts | The only Athens page that names the need. Ovation's page doesn't appear yet |
| Private lessons | Nothing local in Athens, GA. Results were Athens Theatre in DeLand, Florida, and out-of-state theaters | — | No local page targets "private acting lessons Athens GA"; voice teachers likely appear in the map results instead |
| Adult improv | Flying Squid Comedy (Level 1 and Level 2 classes, CrowdWork pages); **Little Characters/Geode adult classes on ActiveKids** (an acting and improv class at Science and Art, Feb–Mar 2026, and "Theater After Hours" at the Harrison Center, Sep 2026; neither is in the seed, see §6) | CrowdWork class pages; ActiveKids listings; Ticket Tailor event pages | One page per class with dates and a sign-up button |
| Parents' Night Out | No Athens, GA result. Athens, Ohio and DeKalb County results instead | — | **Open field**: a clear page titled "Parents' Night Out in Athens, GA" should rank quickly |
| Kids events, things to do | Macaroni KID Athens; ActivityHero Athens page; Flagpole calendar; ACC Leisure Services | Calendars and guides | Fresh, dated listings; local news domains |
| The brand | Macaroni KID article "Little Characters Theatre Troupe" (founded 2022, Hannah Eppling); a UGA Grady Newsource story; GigSalad "Children's Theatre" listing | Articles | Third-party mentions; the site itself ranks for its name |

### Lessons for Little Characters

- **Directories carry most local searches.** Macaroni KID Athens appears for camps, classes, parties and holiday camps. Being in its guides (and on ActivityHero, ActiveKids and the county's lists where allowed) matters as much as the site's own wording. See §5.
- **The old `/camp` address still ranks for summer camp.** `docs/content-inventory.md` lists the 301 redirect `/camp` → `/camps`; it must ship on launch day, or that ranking is lost.
- **Little Characters' main local competitor on price is Athens Creative Theatre** (county-run, ages 8+ only). The site's real differences, all in the seed: ages 4–7 programs, small classes (8–12 kids, about 7 per teacher), original student-written shows, Ovation and one-on-one class buddies, a first class free, and its own 5,000 sq ft space on W Broad St. Say these plainly; don't compare by name.
- **Several needs have almost no local answer:** homeschool drama, Parents' Night Out, private acting lessons, adaptive theater for children. These are the fastest wins.

## 3. Page-by-page targets

Each target gives: the main phrase; 1–3 secondary phrases; the **title field** (40 characters or fewer) and the **full title** as Google would show it today; the **description** (155 characters or fewer, with a reason to click); and the **gaps** in the current wording. All lengths were counted with a script (see the report).

### 3.1 Site pages

#### Home `/`
- **Main:** kids theater classes Athens GA
- **Secondary:** children's theater Athens Georgia · acting classes and camps for kids Athens · Little Characters Athens
- **Title field:** `Kids Theater Classes & Camps, Athens GA`
- **Full title:** `Kids Theater Classes & Camps, Athens GA · Little Characters`
- **Description:** `Acting, improv and film classes, camps and shows for ages 4 and up in Athens, GA. Small classes, a show every term, and new students try most classes free.`
- **Gaps:**
  - The hero eyebrow says "Athens, GA" but the headline and intro don't say "kids", "classes" or "camps". Add a plain line near the top, such as "Theater classes, camps and shows for kids, teens and adults in Athens, Georgia".
  - "Camps" appears only in the sign-up box. Mention summer camp and holiday mini camps in the body with a link to `/camps`.
  - No mention of birthday parties by that word ("Parties"): in "More ways to play", say "Birthday parties".
  - "At your school" links to `/about#schools`; also name the schools in a sentence (they're in the seed) so school-name searches can find the page.
  - Answer, in a sentence each: what ages, where (1635 W Broad St, about a mile from downtown), how much (from $85 a month), and whether there's a trial.
  - Links to add: `/programs/ovation` (from the 1:1 class buddies fact), `/programs/homeschool-class`.

#### Find a class `/programs`
- **Main:** acting classes for kids Athens GA
- **Secondary:** drama classes for kids Athens · after school theater classes Athens GA · theater classes by age
- **Title field:** `Kids Acting & Theater Classes, Athens GA`
- **Full title:** `Kids Acting & Theater Classes, Athens GA · Little Characters`
- **Description:** `Weekly acting, improv, film and homeschool theater classes for ages 4–17 in Athens, GA. See times and prices, and try most weekly classes free.`
- **Gaps:**
  - The intro ("Start with your child's age…") has no place name and no "acting" or "drama". Add "in Athens, GA" and "acting".
  - Add one sentence per age band (4–6, 7–10, 9+, 11–17, adults) that names the class, so the page reads as text, not only as cards.
  - Say what tuition is ("$85–$115 a month, by class length") and that every class ends in a show.
  - Links: `/faq` (tuition, discounts), `/camps`, `/geode`.

#### Camps `/camps`
- **Main:** theater camp Athens GA
- **Secondary:** summer camps Athens GA · drama camp for kids Athens · school holiday camps Athens GA
- **Title field:** `Theater Camps for Kids in Athens, GA`
- **Full title:** `Theater Camps for Kids in Athens, GA · Little Characters`
- **Description:** `Summer theater camp for ages 4–17, plus mini camps on CCSD school holidays. Half days, 9 am–1 pm, about $50 a day, and camp weeks end in a show.`
- **Gaps:**
  - The eyebrow already says "Theater camps in Athens, GA". Good: keep it.
  - Add the words "summer camp" and "half-day camp" in the hero intro (it says "camp" and "summer" but never "summer camp").
  - Name the breaks: fall break, Thanksgiving break, winter break, MLK Day, spring break. Parents search by the break's name. Only name a break as an offer when a camp is scheduled; otherwise say "we run mini camps on many CCSD school holidays" and list past ones (the seed's "Recent favorites" already include Thanksgiving, MLK Day and fall break).
  - Questions to answer: what to bring (a lunch), after-camp (until 3 pm, $30 a day, Monday–Thursday), scholarships, ages for teens (Geode intensives).
  - Links: `/programs/summer-camp`, `/programs/mini-camps-and-workshops`, `/geode`.

#### Shows & events `/events`
- **Main:** kids events Athens GA
- **Secondary:** children's theater shows Athens · family things to do Athens GA · free kids activities Athens
- **Title field:** `Kids Shows & Family Events in Athens, GA`
- **Full title:** `Kids Shows & Family Events in Athens, GA · Little Characters`
- **Description:** `Student shows, Parents' Night Out, a free monthly theater class and adult improv nights in Athens, GA. See what's coming up and save your spot.`
- **Gaps:**
  - The intro has no place name. Add "in Athens".
  - Each event needs a date, place and price in text (structured data for events is the Google setup unit's job).
  - Link each recurring item to its program page (Parents' Night Out, free class, adult improv); the free class already does.

#### About `/about`
- **Main:** children's theater Athens GA
- **Secondary:** Little Characters Theater Troupe · Hannah Eppling theater · theater for kids of all abilities Athens
- **Title field:** `About Our Children's Theater, Athens GA`
- **Full title:** `About Our Children's Theater, Athens GA · Little Characters`
- **Description:** `Founded in 2022 by Hannah Eppling, Little Characters is a children's theater in Athens, GA: small classes, original shows and room for every ability.`
- **Gaps:**
  - The page is already strong (summary, facts list, schools). Keep it.
  - The facts list should keep the full address and phone, matching the Business Profile exactly (§4).
  - Name the inclusion partners in full text: the UGA Speech and Hearing Clinic (already there) and It's Good to See You Productions (on the Ovation page only).
  - Don't add student counts or "the only…" claims until §6 is answered.

#### Geode `/geode`
- **Main:** teen acting classes Athens GA
- **Secondary:** adult improv Athens GA · acting classes for adults Athens · Geode Athens
- **Title field:** `Teen Acting & Adult Improv in Athens, GA`
- **Full title:** `Teen Acting & Adult Improv in Athens, GA · Little Characters`
- **Description:** `Geode is theater for tweens, teens and adults in Athens, GA: an acting studio for ages 11–17, a performance troupe and monthly adult improv nights.`
- **Gaps:**
  - The hero ("For when you're still a character, but not so little") never says "teen", "adult" or "Athens" until the intro. Add "tweens, teens and adults in Athens, GA" to the first sentence.
  - Say "acting class" and "improv class" in plain words in the classes section.
  - The improv section says "First Friday Improv Nights are back… on the third Thursday": give the time and price in text (6:30–8:30 pm, $25, 18+).
  - Links: `/programs/geode-acting-studio`, `/programs/geode-adult-improv`, `/programs/performance-troupe`, `/programs/private-lessons` (the hero says Geode offers private lessons).

#### Parent FAQ `/faq`
- **Main:** Little Characters tuition and FAQ (a page for families comparing and deciding)
- **Secondary:** how much are kids theater classes Athens · theater class scholarships Athens GA · do kids perform
- **Title field:** `Parent FAQ: Classes, Camps & Tuition`
- **Full title:** `Parent FAQ: Classes, Camps & Tuition · Little Characters`
- **Description:** `Class sizes, tuition, discounts, scholarships, parking and performances: straight answers for families at Little Characters in Athens, GA.`
- **Gaps:**
  - Questions parents search that the FAQ lacks: "What ages do you teach?" (partly in "Who do you serve?"), "Do you have summer camps?" (in "How do camps work?"), "What should my child wear or bring?", "Do I stay during class?" (the parking text says you can wait in the lobby), "Do you offer birthday parties?" (exists; say "birthday").
  - "Who do you serve?" says pre-K–5th grade for Little Characters and grades 6–12 for Geode, while the Geode page says 11 and up. Pick one (already listed in `docs/content-inventory.md` as discrepancy 8).
  - Link answers to pages: scholarships → `/give`; needs → `/programs/ovation`; camps → `/camps`; parties → `/programs/parties`.

#### Give `/give`
- **Main:** donate to kids theater Athens GA
- **Secondary:** theater scholarship fund Athens · volunteer kids theater Athens · donate costumes Athens GA
- **Title field:** `Donate to Kids Theater in Athens, GA`
- **Full title:** `Donate to Kids Theater in Athens, GA · Little Characters`
- **Description:** `Your gift pays for scholarships so any child in Athens, GA can take the stage. $30 covers a performance fee; $250 covers a week of summer camp.`
- **Gaps:**
  - Whether gifts are tax-deductible (nonprofit status) is not in the repository. Donors search for it and ask. Question for Hannah (§6); don't say "tax-deductible" until answered.
  - "Give now" has no real donation link yet (`site.links.giving` TODO). A give page without a way to give will lose donors.
  - Link to `/programs/ovation` and `/faq` (scholarship answer).

#### Contact `/contact`
- **Main:** Little Characters Athens address / phone
- **Secondary:** 1635 W Broad St Athens GA · Little Characters parking
- **Title field:** `Contact & Directions, W Broad St, Athens`
- **Full title:** `Contact & Directions, W Broad St, Athens · Little Characters`
- **Description:** `Find us at 1635 W Broad St, Athens, GA, about a mile from downtown. Call, email or send a note, and see where to park and drop off.`
- **Gaps:**
  - The address, phone and email must match the Business Profile character for character ("1635 W Broad St, Athens, GA 30606", "(281) 798-2623").
  - The hero says "Contact us!"; add one line with the address and the email in text.
  - Hours aren't in the repository (§6).

### 3.2 Class, camp and program pages (`/programs/<slug>`)

All 17 programs in `src/content/seed/programs.ts` are covered, in seed order.

#### `/programs/stories-and-songs` · Stories and Songs (ages 4–6)
- **Main:** preschool theater class Athens GA
- **Secondary:** drama class for 4 year olds · kids music and acting class Athens · kindergarten theater class
- **Title field:** `Theater Class for Ages 4–6 in Athens, GA`
- **Full title:** `Theater Class for Ages 4–6 in Athens, GA · Little Characters`
- **Description:** `An 8-week Tuesday class where 4- to 6-year-olds act out favorite books, sing songs and play in the costume box, then perform in our December show.`
- **Gaps:** No "preschool", "pre-K" or "kindergarten" (the About page uses "Pre-K and kindergarten"; reuse it). No place name. Answer "Does my child need experience?" (no) and "Can I watch?" (the Variety Show; 2 free tickets per student). Link to `/programs/intro-to-theater` as the next step, and `/events` for the Variety Show.

#### `/programs/intro-to-theater` · Intro to Theater (ages 7–10)
- **Main:** acting classes for kids Athens GA
- **Secondary:** drama class for 7 year olds · beginner theater class kids · after school acting class Athens
- **Title field:** `Acting Class for Kids 7–10 in Athens, GA`
- **Full title:** `Acting Class for Kids 7–10 in Athens, GA · Little Characters`
- **Description:** `A Tuesday acting class for ages 7–10: voice, movement and character, with games, a mid-semester showcase and a big show. Your first class is free.`
- **Gaps:** No "acting", "beginner" or "no experience needed" (the FAQ says some students are "tiptoeing on stage for the first time"). No place name. Link to `/programs/yes-and-improv` and `/programs/produce-a-show`.

#### `/programs/yes-and-improv` · Yes, And… Improv (ages 8+)
- **Main:** improv class for kids Athens GA
- **Secondary:** kids improv comedy class · confidence building activities for kids Athens · teen improv class Athens
- **Title field:** `Improv Class for Kids 8+ in Athens, GA`
- **Full title:** `Improv Class for Kids 8+ in Athens, GA · Little Characters`
- **Description:** `Fast-paced games and unscripted scenes that build confidence and creativity. A Wednesday improv class for ages 8 and up. Try the first class free.`
- **Gaps:** "Confidence" is there; add "shy kids" only if Hannah agrees it fits (parents search "activities for shy kids"). No place name. The day conflict (Wednesday vs Monday) is open in `docs/content-inventory.md`; the seed says Wednesday. Link to `/programs/performance-troupe` and `/geode`.

#### `/programs/produce-a-show` · Produce a Show (ages 7+)
- **Main:** kids theater production class Athens
- **Secondary:** playwriting class for kids · kids write their own play · technical theater for kids Athens
- **Title field:** `Write & Stage a Show: Kids 7+, Athens GA`
- **Full title:** `Write & Stage a Show: Kids 7+, Athens GA · Little Characters`
- **Description:** `Students write an original play, design sets and costumes, and stage it for an audience. Mondays, August to March, for ages 7 and up in Athens, GA.`
- **Gaps:** Say "playwriting" and "script writing" (it says "script writing" once; good). Mention Emily Greene designs sets and costumes (team seed) only if she works with this class; ask Hannah. Age conflict (7+ vs 8+) is open in the inventory. Link to `/programs/film-creation`.

#### `/programs/performance-troupe` · LC/Geode Performance Troupe (ages 9+)
- **Main:** youth theater troupe Athens GA
- **Secondary:** performing opportunities for kids Athens · advanced acting class for kids · youth theater company Athens
- **Title field:** `Youth Theater Troupe (9+) in Athens, GA`
- **Full title:** `Youth Theater Troupe (9+) in Athens, GA · Little Characters`
- **Description:** `For ages 9+ with some stage experience: short shows around Athens this fall, then a full-length spring production, with Hannah Eppling and CC Conner.`
- **Gaps:** "Youth theater" and "audition" don't appear; say whether there's an audition (the seed says only "for students who have worked in theater before"). Name a real past performance (Jack and the Beanstalk at the Botanical Garden's Insectival, from `events.ts`). Link to `/events` and `/geode`.

#### `/programs/film-creation` · Film Creation (ages 9+)
- **Main:** filmmaking class for kids Athens GA
- **Secondary:** video production class for kids · kids film camp Athens · acting on camera class kids
- **Title field:** `Film Class for Kids 9+ in Athens, GA`
- **Full title:** `Film Class for Kids 9+ in Athens, GA · Little Characters`
- **Description:** `Kids ages 9+ write, direct, act and shoot short films with green-screen effects and basic editing. Thursdays in Athens, GA. Try the first class free.`
- **Gaps:** "Filmmaking" and "green screen" are missing from the description (the photos show a green screen; the About page says "act and shoot on a green screen"). Say films screen at the Variety Show. Link to `/programs/produce-a-show`.

#### `/programs/homeschool-class` · LC Homeschool Class (ages 6+)
- **Main:** homeschool drama class Athens GA
- **Secondary:** homeschool theater class · homeschool enrichment Athens GA · homeschool arts class Athens
- **Title field:** `Homeschool Theater Class in Athens, GA`
- **Full title:** `Homeschool Theater Class in Athens, GA · Little Characters`
- **Description:** `An 8-week Friday afternoon theater class for homeschoolers ages 6 and up: acting, props and costumes, ending in a show. $200, prorated after Sep 11.`
- **Gaps:** The page is tied to the fall dates (show on October 30). After Oct 30, 2026 the page needs the next session or a "spring dates coming" note, or it goes stale just as homeschool families plan for spring. Say "drama" once. Link to `/programs/private-lessons` and `/camps`. (The seed has no teacher for this class; fine.)

#### `/programs/athens-academy-enrichment` · Athens Academy Enrichment (Lower School)
- **Main:** Athens Academy after school theater
- **Secondary:** Athens Academy enrichment drama · Lower School theater Athens Academy
- **Title field:** `Athens Academy Lower School Theater`
- **Full title:** `Athens Academy Lower School Theater · Little Characters`
- **Description:** `After-school theater for Athens Academy Lower School: voice, movement, character and improv over 8 weeks, ending in a show. Register through the school.`
- **Gaps:** Small audience, already reached by the school. Keep it simple. (The one page without "GA" in its title or description: the school's name places it.) Make clear registration is through Athens Academy (ActiveKids). Link to `/about#schools` for other schools.

#### `/programs/summer-camp` · Summer Camp (ages 4–17)
- **Main:** summer camp Athens GA 2027
- **Secondary:** summer theater camp Athens · half day summer camp Athens GA · drama camp ages 4–10
- **Title field:** `Summer Theater Camp 2027 in Athens, GA`
- **Full title:** `Summer Theater Camp 2027 in Athens, GA · Little Characters`
- **Description:** `Half-day theater camp weeks for ages 4–10 (9 am–1 pm, about $250 a week) and teen intensives through Geode. Summer 2027 dates coming soon: get on the list.`
- **Gaps:**
  - This page and `/camps` both want "summer camp". Split them: `/camps` owns "theater camp" in general (summer and holidays); this page owns "summer camp 2027" (the year, the weeks, registration). Each links to the other near the top. See §8, F2.
  - Change "2027" to the next year each fall; change "dates coming soon" once weeks are added.
  - Answer: what a day looks like (the `/camps` "A day at camp" timeline), after-camp until 3 pm, what to bring, scholarships, how old for teen intensives.
  - Name the camp week themes when they're set: parents search themes ("Bluey camp", "Harry Potter camp"); the old site's past themes include The Games of Bluey Day Camp and a Wizarding School workshop.

#### `/programs/mini-camps-and-workshops` · Mini Camps & Workshops
- **Main:** school holiday camps Athens GA
- **Secondary:** thanksgiving break camp Athens · winter break camp Athens GA · musical theater workshop for kids Athens
- **Title field:** `School Holiday Mini Camps in Athens, GA`
- **Full title:** `School Holiday Mini Camps in Athens, GA · Little Characters`
- **Description:** `Half-day theater mini camps on CCSD school holidays and weekend workshops in Athens, GA, about $50 a day. Most end with a short show at pickup.`
- **Gaps:** Name the breaks in plain words (see `/camps`). When a camp is scheduled, put the break name and dates in the session label ("Thanksgiving Break Mini Camp, Nov 23–24"). No 2026–27 dates exist yet (inventory: "None are announced yet"); Thanksgiving and winter break are the first searches after launch, so dates are worth announcing early.

#### `/programs/free-community-class` · Free Community Theater Class (all ages)
- **Main:** free kids activities Athens GA
- **Secondary:** free theater class Athens · free things to do with kids Athens GA
- **Title field:** `Free Monthly Theater Class in Athens, GA`
- **Full title:** `Free Monthly Theater Class in Athens, GA · Little Characters`
- **Description:** `Once a month, a free one-hour theater class for all ages with a different teacher each time. Next: Thu, Oct 15 and Mon, Nov 2 at our W Broad St space.`
- **Gaps:** The description names dates, so update it each month, or use the evergreen version: `Once a month, a free one-hour theater class for all ages, with a different teacher each time, at our space on W Broad St in Athens, GA.` Registration link still missing (inventory). Link to `/programs` ("liked it? find a weekly class").

#### `/programs/parents-night-out` · Parents' Night Out (ages 4–12)
- **Main:** parents night out Athens GA
- **Secondary:** kids night out Athens · date night childcare Athens GA · drop off childcare Athens
- **Title field:** `Parents’ Night Out in Athens, GA`
- **Full title:** `Parents’ Night Out in Athens, GA · Little Characters`
- **Description:** `Drop the kids off for games, crafts, snacks and theater fun, 5–8 pm once a month, while you head downtown, a mile away. $30, $10 each extra child.`
- **Gaps:** The page doesn't say "childcare" in plain words beyond "Childcare is on us!"; fine. Add ages in text (the seed says 4–12, and the label says "All kids welcome": ask Hannah which is right). Say whether dinner is served (only "snack" is in the seed). List dates in text.

#### `/programs/private-lessons` · Private Lessons (all ages)
- **Main:** private acting lessons Athens GA
- **Secondary:** voice lessons for kids Athens GA · audition coaching Athens · playwriting tutor
- **Title field:** `Private Acting & Voice Lessons in Athens`
- **Full title:** `Private Acting & Voice Lessons in Athens · Little Characters`
- **Description:** `One-on-one acting, singing and audition coaching, plus playwriting help, booked by the hour for kids, teens and adults in Athens, GA.`
- **Gaps:** The page is one sentence long. It lacks a price, who teaches, where (HQ?), and what an audition-prep lesson covers. Each is a question for Hannah (§6). "Voice lessons" is the more searched word; the seed says "singing lessons". Use both. Link to `/geode` (Geode offers private lessons too).

#### `/programs/parties` · Parties (any occasion)
- **Main:** kids birthday party places Athens GA
- **Secondary:** birthday party venue Athens GA · theater themed birthday party · unique kids party Athens
- **Title field:** `Kids Theater Birthday Parties, Athens GA`
- **Full title:** `Kids Theater Birthday Parties, Athens GA · Little Characters`
- **Description:** `Two-hour birthday parties on our stage in Athens, GA, with theater games, your own party coordinator, a dance party and tables for cake. Ask for a date.`
- **Gaps:** **The word "birthday" doesn't appear on the page.** It says "Name the occasion"; keep that, and add "birthday" in the first sentence. Missing facts parents compare: price, how many kids, ages, what's included for food (§6). Add photos when there are party photos with consent.

#### `/programs/ovation` · Ovation (all ages and abilities)
- **Main:** special needs theater class Athens GA
- **Secondary:** adaptive drama class · inclusive activities for kids with disabilities Athens · autism friendly activities Athens GA
- **Title field:** `Special Needs & Adaptive Theater, Athens`
- **Full title:** `Special Needs & Adaptive Theater, Athens · Little Characters`
- **Description:** `Our adaptive theater class in Athens, GA, for all ages and abilities, caregivers welcome: games, movement and costumes. $15, with scholarships available.`
- **Gaps:**
  - The current summary already says "special needs"; keep it. Use "autism" or "Down syndrome" only if Hannah confirms who Ovation serves; don't guess.
  - Ovation has no dates on the current schedule (inventory). An evergreen page that says "ask about the next dates" is still worth having, since the search is all year.
  - Mention the one-on-one class buddies (UGA Speech and Hearing Clinic) so parents of a child who would join a regular class find it here too. Link to the FAQ answer and `/about`.

#### `/programs/geode-acting-studio` · Geode: Acting Studio (ages 11–17)
- **Main:** teen acting class Athens GA
- **Secondary:** acting classes for tweens · drama class for middle schoolers Athens · teen theater Athens
- **Title field:** `Acting Class for Teens 11–17 in Athens`
- **Full title:** `Acting Class for Teens 11–17 in Athens · Little Characters`
- **Description:** `A weekly Tuesday acting class for tweens and teens 11–17: improv, scene work and character, ending in our December Variety Show. In Athens, GA.`
- **Gaps:** "Teen", "tween" and "middle school" in text (the seed says "tweens and teens"; good). Say what level (beginners welcome?), a question for Hannah. Link to `/programs/performance-troupe` and `/geode`.

#### `/programs/geode-adult-improv` · Geode: Adult Improv Night (18+)
- **Main:** adult improv class Athens GA
- **Secondary:** improv night Athens GA · things to do in Athens GA at night · beginner improv Athens
- **Title field:** `Adult Improv Night in Athens, GA (18+)`
- **Full title:** `Adult Improv Night in Athens, GA (18+) · Little Characters`
- **Description:** `Low-stakes improv games for grown-ups on the third Thursday of each month, 6:30–8:30 pm. No experience needed; BYOB with a 21+ ID. $25.`
- **Gaps:** Add "beginner" ("no experience needed" is in the highlights; put it in the text). Say "Athens, GA". The price conflict ($25 vs $20) is open in the inventory; the seed says $25.

### 3.3 Events and FAQs (for the classes-and-events wording session)

- **Events** have no pages of their own; they show on `/events` and the home call sheet. Each event's `summary` should name the place in text (venue name, or "our W Broad St space"), the age, the price and what happens, in one or two sentences. Example: the Variety Show summary should give the venue once it's set. Repeating events (Parents' Night Out, improv night, free class) keep one consistent summary each.
- **FAQs** are where long, question-style searches land ("how much are theater classes for kids", "what age can kids start acting"). Keep answers short and factual, start each with the direct answer, and name Athens only where it's natural. Suggested new questions, all answerable from the seed:
  - "What age can my child start?" (4, with Stories and Songs; Geode from 11; adults 18+)
  - "Does my child need acting experience?" (No, except the Performance Troupe)
  - "Do you have summer camps?" (Yes: 3–5 weeks each summer, ages 4–17, 9 am–1 pm, about $50 a day)
  - "Do you host birthday parties?" (Rename "Do you offer parties?")
  - "Can I stay and watch?" (You can wait in the lobby; families watch at showcases and shows)

## 4. Local signals

**Places in the seed and the old site (use these):**
- **HQ: 1635 W Broad St, Athens, GA 30606**, "between Rocksprings and Alps, on the south side of the street", about a mile from downtown (`locations.ts`, `faqs.ts`). Use the exact same address everywhere (site, Business Profile, directories).
- **Athens Academy, Harrison Center, 1281 Spartan Ln, Athens, GA 30606** (enrichment classes).
- **Schools where programs ran:** Athens Academy, Athens Montessori School, Oglethorpe Ave. Elementary School, Love.Craft Athens (`pages.ts`, about). The inventory notes this list may be dated.
- **CCSD:** "a verified CCSD school vendor"; mini camps on "CCSD school holidays". Spell out "Clarke County School District" once per page where CCSD appears, since parents search for the full name too.
- **Downtown Athens:** "about a mile from downtown" (Parents' Night Out, HQ).
- **State Botanical Garden of Georgia** (Theater in the Woods, Insectival performance) and **UGA** (the Speech and Hearing Clinic partnership; several teachers study there).
- **Winterville:** the old site shows Spring 2025 classes at the Winterville Cultural Center, summer and holiday camps at the Winterville Campus for Arts and Culture, and variety shows at the Marigold Auditorium (373 N Church St), plus Geode at the Winterville Marigold Festival. Families from Winterville clearly came. Mention Winterville only as history ("we've performed at the Marigold Auditorium in Winterville") unless Hannah confirms current programs or families there (§6). Don't build a Winterville page while nothing runs there.

**Areas not shown in the repository (ask first, §6):** Watkinsville and Oconee County, Bogart, Jefferson, Commerce, Madison and Oglethorpe counties, and in-town neighborhoods (Normaltown, Five Points, Boulevard, Cobbham, Westside). Normaltown and the Westside are near W Broad St, but there's no evidence in the repository that families come from there, so don't name them.

**What I couldn't see:** the map results ("local pack"). They rank by relevance, distance from the searcher and prominence (reviews, links, listings). Distance can't be changed; relevance comes from the Business Profile's categories and services; prominence comes from reviews and listings. The Business Profile kit should treat these as its main levers.

## 5. Listings worth having (for the Business Profile session)

All of these appeared in the searches above. "Have" means the search showed Little Characters already listed; check it's current.

| Listing | Why | Status |
|---|---|---|
| **Google Business Profile** | The map results for every "near me" and local search | Unknown from here; ask (§6) |
| **Macaroni KID Athens**: directory listing, Summer Camp Guide (2027 edition), Fall Classes & Activities guide, Birthday Party Planning Guide, Thanksgiving and winter break camp roundups | Appears for camps, classes, parties and holiday camps | Has a 2023 article about Little Characters; listing in the 2026 guides is unknown. Ask for the 2027 camp guide in **December–January** |
| **ActiveKids / ACTIVE** (activekids.com) | Shows Little Characters' Athens Academy and adult classes; ranks for class names | Have (via Athens Academy). Keep listings tidy and dated |
| **ActivityHero** (Athens, GA page) | A camp and class marketplace that ranks for "kids activities Athens GA" | Not seen |
| **Bing Places** and **Apple Business Connect** | Maps on iPhones and Bing; the same facts as the Business Profile | Not seen |
| **Yelp** | Appears for parties and "best of" searches; feeds Apple Maps | Not seen |
| **Facebook page** | Already exists (`site.social.facebook`); keep its address, hours and phone the same | Have |
| **Flagpole calendar** and **Explore Georgia / Visit Athens GA calendars** | Event listings for shows and Parents' Night Out | Not seen; post shows there |
| **TheHomeSchoolMom** (Athens listings) | The only page that appeared for homeschool arts in Athens | Not seen |
| **Patch (Athens)** community calendar | Ranks for Athens kids events and classes | Not seen |
| **GigSalad** | Appeared for "Little Characters" (children's theater, Athens) | Appeared; check whether it's theirs |
| **Nextdoor business page** | Parents ask neighbors for camp and party recommendations | Not seen (can't search Nextdoor without signing in) |

## 6. Questions for Hannah

Each is a fact the wording would need that the repository doesn't give. Suggested answers or defaults are in the report.

1. **Towns and areas served.** Which towns do families come from (Watkinsville/Oconee, Winterville, Bogart, Jefferson, others)? May the site name them?
2. **Winterville today.** Does anything still run in Winterville (classes, camps, shows at the Marigold Auditorium)? Where will the Fall 2026 Variety Show be?
3. **Numbers.** Students served each year or in total (a 2023 Macaroni KID article says 150+ students in the first year; is there a current number?), number of shows, number of camp weeks run, years of teaching. May we use them?
4. **Awards and press.** Any awards, grants, or press (the UGA Grady Newsource story, Macaroni KID, Flagpole)? May we link them?
5. **"Only" claims.** Is it true, and may we say, that Little Characters is "the only…" anything (inclusive youth theater, theater for ages 4–7, etc.)? Note: Athens Creative Theatre runs "Monologues & More" for teens and adults with cognitive disabilities, so "the only inclusive theater program in Athens" is likely untrue. My advice: make no "only" claims.
6. **Nonprofit status.** Is Little Characters a nonprofit, and are gifts tax-deductible?
7. **Ovation.** Does it continue? When are the next dates? Who is it for (which disabilities, which ages)? Is it still $15?
8. **Adult classes on ActiveKids.** "Theater After Hours" (Harrison Center, Sep 2026, Hannah) and an adult acting and improv class at Science and Art (Feb–Mar 2026) aren't in the seed. Should the site list adult classes beyond the improv night?
9. **Toddlers.** The old site had "Mommy and Me Toddler Theatrics" and classes for ages 3–17. Will there be anything under age 4?
10. **Parties.** Price, number of guests, ages, food rules, and which days and times.
11. **Private lessons.** Price, who teaches, where, and whether voice lessons are taught by a singer.
12. **Parents' Night Out ages.** The seed says ages 4–12 and also "All kids welcome". Which? Is dinner served?
13. **Summer 2027.** When will dates and themes be set? (Search demand starts in January.)
14. **Holiday mini camps for 2026–27.** Any planned for Thanksgiving, winter break or MLK Day?
15. **Performance Troupe.** Is there an audition, or is "worked in theater before" enough?
16. **Hours.** Office or phone hours for the Business Profile.
17. **Google Business Profile.** Is there one? Who owns it, what's its category, and how many reviews does it have?
18. **Schools list.** Is "Athens Academy, Athens Montessori School, Oglethorpe Ave. Elementary School and Love.Craft Athens" current?
19. **Geode Acting Studio.** Are beginners welcome?
20. **Emily Greene.** Does she design for specific classes (Produce a Show) or for shows in general?

## 7. What matters most

The ten changes with the largest expected effect, in order.

1. **Ship the 301 redirects on launch day**, especially `/camp` → `/camps` and `/classes-1` → `/programs`. The old `/camp` page still ranks for "summer camp Athens GA"; without the redirect the new site starts from zero just as camp season begins. (Google setup unit.)
2. **Set up and complete the Google Business Profile** with the right category, every service, photos, and the exact address and phone. Map results sit above everything else for local searches about children's activities, and they depend on the profile, not on the site's wording. (Business Profile unit.)
3. **Put "Athens, GA" and the age range in every title and description**, as in §3. "Athens" alone competes with four other states and Greece; the age is the first thing a parent checks.
4. **Have the summer camp pages ready for January** (`/camps` and `/programs/summer-camp` with "Summer 2027", the email sign-up, and dates as soon as they're set). Summer camp is the largest search group and is booked January–April.
5. **Get into the Macaroni KID Athens 2027 summer camp guide** and its fall classes, birthday party and break-camp roundups. It appears for nearly every local need. (Business Profile unit's listings.)
6. **Ask families for Google reviews** after shows and camp weeks (with a short request message). Reviews drive the map ranking and the click. The seed already has warm testimonials, which shows families are willing.
7. **Add the missing search words to the pages that own them:** "birthday" on Parties, "summer camp" on Camps, "preschool/pre-K" on Stories and Songs, "special needs/adaptive" on Ovation, "teen" and "adult" at the top of Geode, "voice lessons" on Private Lessons. Small edits, each opening a whole group of searches.
8. **Win the open fields first**: Parents' Night Out, homeschool drama, private acting lessons and adaptive theater had no real Athens, GA answer in the results. Clear, factual pages for these can rank within weeks.
9. **Keep dated pages current**: the homeschool class (ends Oct 30), the free class dates, Parents' Night Out dates, mini camps. Stale dates send families away and tell Google the page is old. Announce Thanksgiving and winter-break mini camps early if they'll run.
10. **Link pages to each other by need**: every class to the next step on the pathway, every camp page to `/camps`, needs and scholarships to Ovation and `/give`, and each FAQ answer to its page. It helps parents decide and helps Google understand which page answers what.

## 8. Follow-up candidates (outside this unit)

None of these is needed before the wording drafts; no whole search group lacks a page.

- **F1. Event pages.** Shows have no page of their own (only `/events` anchors), so "Little Characters Variety Show" or a show title can't rank on its own page. Worth a page per show once there are dates and venues.
- **F2. Two pages for summer camp.** `/camps` and `/programs/summer-camp` overlap. The split in §3.2 works with wording alone; if they still compete after launch, consider a canonical link or merging (a code change for the Google setup unit).
- **F3. Home title ending.** The home page's search title currently ends with " · Little Characters" once a title field is set. A brand-first home title ("Little Characters · Kids Theater Classes in Athens, GA") would need a code change in `Base.astro`.
- **F4. Programs with fixed dates in their wording.** The homeschool class ("a show on October 30", "prorated after September 11") and the free class description go stale. Session fields could carry these instead of the description.
- **F5. Search fields for events and FAQs.** Not needed now (§3.3).
