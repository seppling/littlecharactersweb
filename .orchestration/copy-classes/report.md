# copy-classes: report

Wording drafts for the 17 programs, the upcoming events and the FAQs. Branch `claude/seo-copy-classes`. No code, seed or other docs changed.

## Result

**41 drafts, 82 edits.**

| File | Drafts | Edits |
|---|---|---|
| `src/content/seo-draft/programs.ts` | 17 (all programs) | 61 |
| `src/content/seo-draft/events.ts` | 9 (every event still upcoming on Oct 11) | 10 |
| `src/content/seo-draft/faqs.ts` | 5 new questions + 10 changed answers | 11 edits (+5 new entries) |
| `docs/seo/review.md` | regenerated (41 drafts) | |

**Programs.** Every program gets `seo.title` and `seo.description` (from §3.2, adjusted where §6 answers or the staleness rule said to), plus small edits to `description.0`/`.1`:
- the missing search words (§7 item 7), where they're true: "pre-K and kindergarten" on Stories and Songs (the wording the class finder already uses); "birthday parties" on Parties; "special needs" beside "differently-abled" on Ovation; "singing (voice) lessons" on Private Lessons; "teens"/"tweens", ages 11 to 17 and "beginners are welcome" on Geode Acting Studio (answer 19); "improv night for adults", "beginner-friendly" on Adult Improv Night; "acting class", "improv class for kids and teens", "youth theater troupe", "filmmaking class", "homeschool drama class", "summer theater camp in Athens" and "playwriting" on their pages;
- the ages in the text, and "Athens" where it helps;
- links by need (§7 item 10): each class to its next step, camps to `/camps`, Ovation to the class buddies and `/faq`, Geode pages to `/geode`, Athens Academy to `/about#schools`, the free class to `/programs`;
- Ovation: "continues, with new dates to come: ask us about the next ones" (answer 7). Its search description leaves out the $15 price, because answer 7 says the price is still to be set.
- **Summaries: none changed.** The search wording went into `seo.description` and the page text instead, so the course description Google reads stays as Hannah wrote it.

**Events** (summaries are plain text on the ticket):
- Free class (Oct, Nov), Improv Night (Oct, Nov, Dec), Parents' Night Out (Oct, Nov, Dec): one shared summary per kind, naming "our W Broad St space in Athens", plus the ages 4–12 for Parents' Night Out (answer 12) and "No experience needed" for the improv night.
- Fall 2026 Variety Show: `venue` = **"Marigold Auditorium for Arts and Culture, 373 N Church St, Winterville"**, and the summary says it "comes to Winterville, just outside Athens".
  - Where I found it: the City of Winterville's page (cityofwinterville.com/marigold-auditorium) gives the official name "Marigold Auditorium for Arts and Culture" but no street address. The address 373 N Church St, Winterville, GA 30683 comes from a web search where the venue listings agreed (Vivid Seats, The Vendry, a Red & Black event preview, a Patch calendar), and it matches §4 of the research plan, which read it off the old site.
- Past events (`parents-night-out-sep`, `jack-and-the-beanstalk`): not drafted.

**FAQs.**
- New (all "Not published yet"): "What age can my child start?", "Does my child need acting experience?", "Do you serve families outside Athens?" (Greater Athens area, Watkinsville, Winterville, Bogart, Statham, answer 1), "Can I stay and watch?" (the lobby, from the parking guide and the About page), "Do you have summer camps?".
- "Do you offer parties?" becomes "Do you host birthday parties?", and its answer says "birthdays" and links to `/programs/parties`. The entry's id stays `do-you-offer-parties`.
- Links added to 9 existing answers (Geode, class finder, Ovation, contact, give, events, camps, mini camps, summer camp, parties). "How do camps work?" also spells out "Clarke County School District (CCSD)". No facts changed.

## Proof

- Title and description lengths, counted with a script: 17 titles of 32–40 characters (52–60 with " · Little Characters"); 17 descriptions of 120–155 characters. Every program has "Athens, GA" or "Athens GA" in its title or description, except Athens Academy (the school's name places it, as §3.2 allows).
- `npm test`: 8 files, **232 tests passed**. This includes the draft test, which applies every draft to the seed and runs the editor's checks.
- `npm run seo:review`: "Wrote docs/seo/review.md (41 drafts)." Committed.
- `npm run check`: 0 errors, 0 warnings.
- `npm run build`: passed.
- **A real look in the editor:**
  - I loaded the drafts into a fresh local database (`import-studio-director` fixture, then `npm run seo:load-drafts -- --commit`). All 41 were saved. A dry run afterwards skipped all 41 as "already has unpublished changes", so nothing gets applied twice.
  - I started the built server and signed in as hannah@example.com with the code from `/dev/mailbox`. A script opened each of the 41 entries in the editor and pressed **Preview** at 1280 px. Each showed "Unpublished changes" or "Not published yet" and the purple preview bar.
  - Every program preview had the drafted `<title>` and meta description.
  - Rechecked at 390 px: **no horizontal overflow on any of the 41 previews**, no raw `](/` link markup, and 0 page errors.
  - I looked at screenshots of Ovation, Parties, Stories and Songs, Summer Camp, the Variety Show and Parents' Night Out tickets, and the FAQ page, at desktop and phone widths. A few are in `.orchestration/copy-classes/shots/`.
  - The look led to two fixes: the Variety Show summary had repeated the full venue shown on the line above it, and "Find a class by age" had appeared in two neighbouring FAQ answers.
- **Not run:** the e2e browser tests (`enroll-journey.mjs`, `content-editor.mjs`). This unit changes only draft data, which those tests don't load.
- **CI passed** on both pushes: run 65 (`fa10731`, the drafts) and run 67 (`8375812`, the fixes and this report). This commit changes only this report.

## Decisions

1. **No event-to-program links.** Event summaries render as plain text (`EventTicket.astro`), so a link there would show as raw markup. The only link is the button, and for Parents' Night Out and the improv night that button is the registration form. Replacing it would break sign-up. The free class's button already links to its program page. This is a follow-up (code).
2. **Events drafted:** those upcoming on Oct 11. Oct 15, Oct 24, Nov 2 and Nov 14 will be past by the mid-November launch (see Open points).
3. **Summer 2027 only in the search fields.** The year is in `seo.title` and `seo.description` (the page must say it before January, per §1), and the body text stays evergreen. So only two fields need the year changed each fall.
4. **"Voice lessons":** the seed says "singing lessons" and the home page says "singing"; voice lessons and singing lessons are the same service. I wrote "singing (voice) lessons" in the text and "Voice Lessons" in the title. The research plan's question 11 (whether the teacher is a singer) is still open, but the draft claims nothing about the teacher.
5. **No "3–5 weeks" in new text.** The new summer-camp FAQ leaves out the seed's camp-week count, keeping the rule against counts of camp weeks. The existing sentence on the Summer Camp page is unchanged (only "summer theater camp in Athens" was added to it).
6. **"First class free"** appears only in the search descriptions of Intro to Theater, Yes, And… Improv and Film Creation (all on the §0 item 6 list). It isn't on Produce a Show's or the Troupe's, for length.
7. **"No experience needed"** on Stories and Songs and Intro to Theater, and the new FAQ's "No", rest on the seed's "some are tiptoeing on stage for the first time" and §3.3's suggested answer (no, except the Performance Troupe).

## Open points (each with my recommendation)

1. **Free community class: "All ages" vs "ages 4 and up".** The seed says "All ages welcome" (with a minimum age of 4), and answer 9 says "ages 4 and up". I kept "all ages" in the drafts, to match the page's label and the seed. *Recommend:* Hannah decides; if the free class is 4+, change its age label in the editor.
2. **Parents' Night Out label "All kids welcome" vs ages 4–12.** The drafts say 4–12 (answer 12). The age label on the card still reads "All kids welcome" (I didn't change it: ages are Hannah's). *Recommend:* change the label to "Ages 4–12".
3. **Events that will be past at launch.** Drafts for `free-class-oct`, `improv-night-oct`, `parents-night-out-oct`, `free-class-nov` and `parents-night-out-nov` are useful on the preview now but wasted at a mid-November launch. *Recommend:* remove the past ones from `events.ts` just before the launch load. A repeating event added later needs its own copy of the shared summary (the constants at the top of `events.ts`).
4. **Ovation: who it's for and the price.** I wrote "people of all ages with special needs", which is the seed summary's own wording, and left out $15 and any named conditions. *Recommend:* once Hannah sets dates and price, add the price to the search description.
5. **Who do you serve: grades 6–12 vs Geode from 11.** This is the existing discrepancy 8 in the content inventory. My new FAQ says "Tweens and teens from 11", matching the Geode programs. *Recommend:* Hannah picks one, then align "Who do you serve?".
6. **"What should my child wear or bring?"** (suggested in §3.2) is not drafted, because nothing in the seed says what to wear for class; only "bring a lunch" for camp. *Recommend:* Hannah answers it, then add it as a FAQ.

## Stale-date list (fixed dates in the wording)

- **Homeschool class** (existing, unchanged): "a show on October 30", "prorated after September 11", in the summary, `description.1`, highlights and showcase. It goes stale after Oct 30, 2026. The draft adds a link to the same paragraph but doesn't touch the dates; its search description has no dates.
- **Summer camp search fields** (new): "2027" in `seo.title` and `seo.description`. Change it each fall.
- **Ovation** (existing): "Spring 2026 Variety Show".
- **Free community class:** the search description is evergreen (no dates). The dates live in sessions and events, not the wording.
- **Event summaries:** the free class's "Registration opens soon" (existing) will read oddly once registration opens.
- **New wording adds no other fixed dates.**

## Follow-up candidates

- **A link from each event ticket to its program page** (code in `EventTicket.astro`: link the title, or render the summary as rich text), as §3.3 asks.
- **Move the homeschool dates into session fields** (research F4).
- **A page per show** (research F1). The Variety Show's venue is ready for it.
- **A past-performance line on the Troupe page** (Jack and the Beanstalk at the Insectival), once there's a way to keep it current.

## Handoff

- `docs/seo/review.md` is regenerated from all drafts on this branch. The pages session regenerates it too; at merge, run `npm run seo:review` once on the combined branch and commit.
- The FAQ page's heading and intro belong to the pages session. My new FAQs go in the existing sections: "Getting started" (4) and "Camps & parties" (1). Program pages show the first 5 FAQs of their sections, so the new "Do you have summer camps?" appears on camp and party pages as the third "Camps & parties" question.
- My wording uses "the Greater Athens area" and the four towns only in the new FAQ, so the pages session can use them on home, About and Contact without repeating it.

**Compaction:** none occurred in this session.
