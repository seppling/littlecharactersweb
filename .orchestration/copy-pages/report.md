# copy-pages: report

Wording drafts for the 10 site pages. **10 entries, 44 edits.** No code, seed or other draft files changed. No compaction or restart happened.

## Result

- `src/content/seo-draft/pages.ts`: one draft per page.
  - **site** (1 edit). The site description now names kids 4 and up, teens and adults, "Athens, GA" and the Greater Athens area. It drops "ages 4 to 100" in favor of "4 and up" (answer 9).
  - **home** (9 edits):
    - search title and description;
    - a plain opening line in the hero ("Theater classes, camps and shows for ages 4 and up in the Greater Athens area.");
    - tuition in the free-trial text, through `{tuitionRange}`;
    - an Ovation link on the 1 : 1 fact;
    - "Parties" becomes "Birthday parties";
    - CCSD is spelled out on the "At your school" card;
    - the four towns, once, at the end of the first "Our story" paragraph;
    - a `[summer camp](/camps)` link in the email signup.
  - **about** (8 edits):
    - search title and description;
    - "in Athens" and the four towns in the second story paragraph;
    - Ovation's founding partner, It's Good to See You Productions (from the Ovation page), with a link;
    - a Macaroni KID Athens link in the team's social line;
    - CCSD spelled out;
    - Barrow and Timothy Elementary added to the schools text and to the "Schools" key fact.
  - **camps** (4 edits):
    - search title and description;
    - "half-day summer camp", the Clarke County School District spelled out, and "Past mini camps have covered fall break, Thanksgiving and MLK Day" (all past camps in the seed);
    - a Geode link on the teen intensives card.
  - **geode** (6 edits):
    - search title and description (including "beginner-friendly");
    - "Teen & adult theater in Athens, GA" in the small label at the top;
    - the hero intro adds "in Athens", a private-lessons link, and "New to acting? Beginners are welcome in the Acting Studio" with a link;
    - the classes heading becomes "Acting & improv classes this fall";
    - improv night time and price (6:30–8:30 pm, $25).
  - **give** (4 edits):
    - search title and description (scholarships and pay-what-you-can places);
    - the intro says "Little Characters is a small local business" (answer 6) and uses "Greater Athens area";
    - an FAQ link in the scholarship box.
  - **contact** (3 edits): search title and description; the intro names the W Broad St space in Athens and the four towns, once.
  - **faq** (3 edits): search title and description; a plain opening that leads with the Greater Athens area and names the four towns, once.
  - **classes** (3 edits): search title and description; the intro adds "acting", "Athens, GA", ages 4 and up, `{tuitionRange}` and an FAQ link.
  - **events** (3 edits): search title and description; the intro adds "Student shows and family events in Athens, GA" and links the Parents' Night Out, free class and adult improv pages.
- `docs/seo/review.md`: regenerated (10 drafts, plus any from other units at the time of my run).
- `.orchestration/copy-pages/`: this report, `state.md`, and screenshots in `shots/`.

## Proof

- **Lengths**, counted by a script that imports `pages.ts`:
  - Titles are 36–40 characters, so 56–60 with " · Little Characters".
  - Descriptions are 131–155 characters; the site description is 151.
  - Browser preview `<title>` lengths: home 59, about 59, camps 56, geode 60, give 56, contact 60, faq 56, classes 60, events 60.
- **Banned words.** A script found no "nonprofit", "charity", "tax-deductible", "501", "best" or "award-winning" in any `to` or `why`. Its one hit is "only pay if your child wants to stay", existing seed text in the home trial box and not a claim.
- **Checks:**
  - `npm test`: 8 files, 201 tests passed (each draft applies to the seed and passes the editor's checks, and review.md is current).
  - `npm run seo:review`: wrote review.md.
  - `npm run check`: 0 errors, 0 warnings, 6 hints.
  - `npm run build`: passed.
- **The real look.** I made a fresh local database (`PGLITE_DIR=.data/look` and the Studio Director fixture import), then ran `npm run seo:load-drafts -- --commit`: "Saved as unpublished drafts (10)… Nothing was published."
  - I signed in as hannah@example.com with the code from `/dev/mailbox`, then opened each of the 9 page entries.
  - Each showed "Unpublished changes". **Preview** showed the purple preview bar, the new `<title>` and the new meta description.
  - At 1280 px and at 390 px, the horizontal overflow (`scrollWidth − innerWidth`) was **0** on all 9 pages.
  - Screenshots in `shots/`: the home hero (desktop and phone), the home 1 : 1 fact with its Ovation link, the home cards at phone width, the Geode hero, the camps hero at phone width, and the About schools section. Headings and cards wrap cleanly, and nothing breaks the layout.
- **Browser tests:** on a fresh database from `tests/e2e/serve.sh`, `node tests/e2e/enroll-journey.mjs` printed "All journey checks passed." and `node tests/e2e/content-editor.mjs` printed "All editor checks passed."
- **CI:** run 66 on commit 5d23103 passed (https://github.com/seppling/littlecharactersweb/actions/runs/38113814290). The report commit triggers another run.

### Web checks (October 11)

- **Macaroni KID Athens:** https://athens.macaronikid.com/articles/64cdb2aabfe2815b16aec3f8/little-characters-theatre-troupe
  - WebFetch was refused (403). A `curl` with a browser user agent returned HTTP 200, with the page title "Little Characters Theatre Troupe | Macaroni KID Athens".
  - The text names Hannah Eppling as founder ("Founded in 2022 by local mom and theater educator, Hannah Eppling…").
  - The article id's timestamp dates it to August 2023. **This link is used.**
- **UGA Grady Newsource:** I found **no story about Little Characters**.
  - Searches ran for "Grady Newsource Little Characters" and for "Little Characters" with "Eppling" on gradynewsource.uga.edu.
  - The site's own search feeds (`/search/little+characters/feed/rss2/` and `/search/eppling/feed/rss2/`) list no relevant item.
  - The two Grady results the search tool offered (`?p=49948`, `?p=49945`) are 2019 photos of Athens Little Playhouse, a different company.
  - **Not used.** See open points.
- **Flagpole and awards:** searches found no Flagpole article and no award for Little Characters. Nothing was named.
- **School names:**
  - NCES-based directories (SchoolDigger NCES ids 0117000458 and 0117000444; allk12) list "Barrow Elementary School" (100 Pinecrest Dr, 30605) and "Timothy Elementary School" (1900 Timothy Rd, 30606).
  - Wikipedia's list of Clarke County schools gives "David C. Barrow Elementary School" and "Timothy Road Elementary School".
  - The district's own site (clarke.k12.ga.us) loads its school list with JavaScript, and its school subdomains failed through the proxy (502), so I couldn't read the district's own spelling.

## Decisions

- **School names:** "Barrow Elementary School" and "Timothy Elementary School". These are the federal (NCES) names, they match Hannah's own wording ("Timothy Elementary and Barrow Elementary"), and they match the plain style of the existing list. Easy to change; see open points.
- **Press placement:** the Macaroni KID link goes in the About team section's social line ("…or read Macaroni KID Athens's story about us"). It's a one-line change, and the key-facts list can't take a new item without a whole-list edit.
- **Towns:** named once each on home (story paragraph), About (story), Contact (hero intro) and FAQ (hero intro), always after "the Greater Athens area". The home hero says only "the Greater Athens area", to keep the most-seen line short.
- **Prices:** `{tuitionRange}` (it fills in from class prices) on home and the class finder, so the wording follows price changes. The editor's help text lists this placeholder only for the key facts, but it works in every rich-text field (the preview shows "$85–$115 a month").
- **Give page:** says "a small local business" (answer 6) and never "nonprofit". The search title uses "Donate", which is a common search word and makes no claim about tax status.
- **Camps:** no break is offered as upcoming (answer 14 is open). Only past mini camps are named (fall break, Thanksgiving, MLK Day; all from "Recent favorites"). Winter break and spring break aren't named, because the seed has no camp for them.
- **Geode description:** "Geode, theater for tweens…" (not "Geode is…") to stay within 155 characters.
- **Home description:** "most weekly classes start free", in place of the plan's "try most classes free", to follow rule 6 ("most weekly classes").
- **Not done:**
  - Homeschool link on home: no text field fits it without a new card.
  - Spelling out the age bands on the class finder: the hero intro is the only text field there.
  - A real donation link: that's a site-settings link, not wording.

## Open points (with my recommendation)

1. **Grady Newsource story.** Not found. **Recommend:** Hannah sends the link if she has it; it can be added to the same About line.
2. **School names.** Does Hannah prefer the longer forms ("David C. Barrow Elementary School", "Timothy Road Elementary School")? **Recommend:** keep the short forms parents use, unless the district's materials use the long ones.
3. **"Small local business" on Give.** This comes from answer 6. **Recommend:** keep it; it answers donors' unspoken tax question honestly. Hannah can drop the clause if she'd rather not say it.
4. **Awards.** None found publicly. **Recommend:** name none until Hannah points to a public source.
5. **Improv price and time in the Geode text** (6:30–8:30 pm, $25) duplicate the class entry. **Recommend:** keep (adults look for it), and update both together if the price changes.
6. **"Ages 4 to 100" in the site description** became "kids 4 and up, teens and adults". It's a playful line Hannah may love. **Recommend:** the new wording, because it's plainer for search and keeps the founding year.

## Will go stale

- Geode: "Acting & improv classes this fall" (a seasonal heading; the "this fall" was already there).
- Camps: "Past mini camps have covered fall break, Thanksgiving and MLK Day" stays true, but should change to an offer when 2026–27 mini camps are set.
- Geode improv: "$25" and "6:30–8:30 pm".
- Give description: "$30 covers a performance fee; $250, a week of camp" (from the page's own amounts).
- Camps description: "about $50 a day".

## Follow-up candidates

- Add `{tuitionRange}` and the other placeholders to the editor's help text for all rich fields (code; another unit).
- A homeschool and Ovation mention on home once there's a field or card for it.
- Age-band sentences on `/programs` would need a new field on the class finder page.
- The real donation link (`site.links.giving`) before launch.

## Handoff

- `pages.ts` touches only page fields. It doesn't touch FAQ entries, programs or events, so it shouldn't conflict with the classes unit's files. `docs/seo/review.md` is generated: regenerate it after merging both (`npm run seo:review`).
- The about-page draft edits `facts.items.12.text` and `differences.items.2.body` by index. If the seed's About lists are reordered before loading, those edits will be skipped (safely), not misapplied.
- Whoever loads drafts on a local server: sign-in needs `localhost`, not `127.0.0.1` (Better Auth rejects the IP origin).

## Compaction

None occurred.
