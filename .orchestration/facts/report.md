# facts unit: report

Branch `claude/review-facts`, from `claude/blissful-archimedes-enun5m` @ a3adbd2. No compaction or restart happened.

## Result

### What changes for families
- **Ages agree everywhere.** The home page's "Where does my kid start?" and About's "Who it's for" now take their ages from the class data. Each class is shown with its own age ("Film Creation 9+", "Yes, And… Improv 8+", "Acting Studio 11–17"), and each group heading spans its classes ("Ages 7+", "Ages 9+").
- **The Performance Troupe** is described as shared by Little Characters and Geode, for ages 9 and up: on the home Geode card, in About, and on `/geode`. `/geode` no longer says "Now it's 11 and up".
- **Prices:** no page states a price that no class charges.
  - The FAQ says "Most weekly classes are $95–$115 a month" (filled in from the class data), says that a few run as 8-week sessions with one price, and links to the class finder.
  - About's "Tuition" fact says the same.
  - Parents' Night Out reads "$30 first child, $10 each additional" everywhere: home, class cards, the class page and its sessions, and event cards.
- **The FAQ describes today's checkout:**
  - autopay to the saved card on the 1st, or the season up front for 10% off;
  - the first month and the one-time fee are paid at sign-up;
  - a $15 late fee after the 10th;
  - the free first class;
  - card only, with card numbers handled by Stripe, and "Ask us about other ways to pay".
  - These are gone: auto-draft or manual payment, the 3%/1% fees, cash/check/Zelle/Venmo, "due October 1", and "by September 1".
  - The class pages show the same answers, because they read the same FAQ entries.
- **Withdrawing:** "at least 5 days before the 1st" everywhere: the FAQ, the policies, enrollment, review, and now the family account too.
- **New `/policies` page** with three parts: Enrollment and payments, Privacy, and Photos. Sign-in, the enrollment "policies" link, the footer ("Policies & privacy"), the FAQ and the sitemap link to it.
- **Contact form:**
  - **New topics:**
    - "My child will miss a class" asks for the child's name, the class (a list) and the date, and the message becomes optional;
    - "School or organization partnership" is pre-selected from the Schools page's link (`?topic=schools`).
  - **Signed-in parents:** their name and email are filled in.
  - **On-its-way email:** the sender gets one after sending (see Decisions).
  - **Reply time:** a line appears only once Hannah sets it.
  - **Parking:** the old parking-guide PDF link is gone; the guide is on the page.
- **Family account:** each upcoming class has a "Missing a class?" link. It opens the absence form already filled in with the child, the class and the next class date.

### What changes for Hannah
- **Editor → Pages → Policies page:** a new page, marked as a draft for her to read before launch.
- **Editor → Site settings → Contact:** a new **"When families can expect a reply"** field, empty by default.
- **The home age steps and About groups:**
  - a step's "Ages" text is only used when it has no classes;
  - an About label starting with "Ages" is filled in from the linked classes.
  - The help text says both.
- **The parking-guide PDF field is gone** from the editor.

### By file
- `src/lib/format.ts`:
  - `agesSpan()` and `agesShort()` are new. A span is open-ended if any class is shown as "N+".
  - `price()` says "$X first child, $Y each additional" for any per-child price that has an additional-child price.
- `src/pages/index.astro`, `src/pages/about.astro`: ages come from the class data.
- `src/pages/geode.astro`: comment only.
- `src/content/seed/pages.ts`:
  - **Seed text:** the pathway fallbacks, "about 7–8 per teacher", PNO and Geode cards, About labels and the Tweens text, the Tuition fact, the Geode heading and paragraph, and the Schools link.
  - **Removed:** the parking-guide URL.
  - **New:** the `policies` seed.
- `src/content/seed/faqs.ts`: five answers rewritten (cost, when due, unenroll, doesn't fill, how to pay). Questions and their order are unchanged, so ids and the class-page blocks stay the same.
- `src/content/seed/programs.ts`: PNO's starting price carries `additional: 10` instead of a note.
- `src/content/seed/events.ts`: the PNO price string is set to the same words.
- `src/content/pages.ts`, `src/content/types.ts`: the `policies` page definition (with the draft note), `contact.replyTime`, the removed `parking.guideUrl`, and help text.
- `src/content/site-content.ts`: `site.contact.replyTime`.
- `src/pages/policies.astro`: new.
- `src/pages/sitemap.xml.ts`, `src/components/SiteFooter.astro` (one link), `src/components/portal/SignInPanel.astro`, `src/pages/enroll/details.astro` (the link only), `src/pages/faq.astro`: links to the Policies page.
- `src/lib/contact-topics.ts`: new. The topic list, shared by the page and the server.
- `src/pages/contact.astro`: the topics, the absence fields, prefill, the reply-time line, and no PDF link.
- `src/server/leads.ts`: absence fields (the date is checked as YYYY-MM-DD), topic labels in the email to Hannah, and the sender's email.
- `src/pages/api/leads.ts`: passes the signed-in user and the site settings to the lead handler.
- `src/pages/api/me.ts`: `?for=contact` returns the user's own name and email (all `/api` responses are `no-store`).
- `src/pages/account/index.astro`: the 5-day withdraw wording and the "Missing a class?" link.
- `src/server/family.ts`: `POLICY_VERSION` → `2026-fall-policies-page`.
- **Wording drafts:**
  - `src/content/seo-draft/pages.ts`: the schools `from`/`to` link is now `topic=schools`, and the edit that emptied `parking.guideUrl` is dropped.
  - `src/content/seo-draft/programs.ts`: the PNO description `to` now says "$30 first child, $10 each additional".
  - `src/content/seo-draft/faqs.ts`: the "how much do classes cost" draft is dropped; it only added a class-finder link, which the new answer has.
  - `docs/seo/review.md` is regenerated.
- `docs/content-editor.md`: Policies is in the Pages list.
- **Tests:**
  - `tests/unit/format.test.ts`: new.
  - `tests/unit/leads.test.ts`: 4 new tests. One existing assertion now finds Hannah's email by its recipient, since a second email follows it.
  - `tests/e2e/content-editor.mjs`: checks the Policies page's edit link, its place in the editor list, and the draft note.

## Proof
All commands ran with the Stripe keys blanked.

| Command | Result |
|---|---|
| `npm run check` | 0 errors, 0 warnings (166 files) |
| `npm test` | 13 files, 347 tests passed |
| `npm run seo:review` | Wrote `docs/seo/review.md` (52 drafts); committed |
| `npm run build` | Complete |
| `tests/e2e/serve.sh` + `node tests/e2e/enroll-journey.mjs` | All journey checks passed |
| `node tests/e2e/trial-journey.mjs` | All free-class checks passed |
| `node tests/e2e/content-editor.mjs` | All editor checks passed, including the new Policies checks |
| Extra browser script (scratchpad, not committed) | 40 checks passed (list below) |

The extra script checked:
- every changed page at 1280 px and 390 px, with no sideways scroll;
- the home and About ages;
- the FAQ has no old payment system or past dates;
- a class page shows the new FAQ block;
- `/policies` is up, has no "draft" text, and is in the sitemap;
- the contact topics, `?topic=schools`, the absence fields and their prefill;
- sending an absence note puts an "on its way" email in the dev mailbox;
- a signed-in imported parent (Ana Okafor) gets their name and email filled in.

Screenshots are in `.orchestration/facts/shots/` (desktop and `-390`):
- `home-age-guide`
- `about-who-its-for`
- `faq-payments`, `faq-payments-2`
- `policies`
- `contact-absence`
- `contact-signed-in`

In the About shot at 390 px, the site's sticky header covers part of the second card. That comes from Playwright's element screenshot, not from the page layout.

CI runs on this push; I didn't wait for it.

## Decisions
1. **Ages come from the classes, as the class pages show them.** Class pages use label overrides ("Ages 9+", "Ages 8+"), so a group heading is open-ended ("Ages 7+") when any of its classes is. The other choice, "Ages 7–17", would contradict the class pages.
2. **Group labels are computed only when they start with "Ages" and link classes.** "Homeschool families" and "Every ability" stay as Hannah writes them. This is a simple rule, and the field's help text explains it.
3. **One way of saying the PNO price, from the price data.** `price()` formats any per-child price that has an additional-child price. The event seed has its own text field, so it's set to the same words; events belong to another session.
4. **"About 7–8 students per teacher"** is used everywhere: 3 places said 7–8 and 1 said 7.
5. **"Doesn't fill" date:** "about two weeks into the season" instead of the brief's example, "about two weeks before it starts".
   - The old rule (Sep 1, for an Aug 17 start) was about two weeks *after* the start.
   - That is why students who don't move "are only charged for the first month".
   - A "before it starts" date would contradict that line.
6. **The sender's email.**
   - The form accepts any address, so repeating the message would let anyone send Little Characters email with their own text to a stranger.
   - So only a signed-in parent writing from their own verified address gets their message copied back.
   - Anyone else gets a short "on its way" note with nothing they typed in it, at most 3 a day per address.
   - If the sender's email fails, the form still says the message was sent (it did reach Hannah).
7. **No promised reply time.** The setting is empty by default, and the line appears only when it's set.
8. **The parking-guide PDF field is removed entirely,** not just hidden: link, seed value, editor field and type, and the draft that emptied it. The old PDF address still redirects to `/contact#parking`.
9. **The Policies draft note is in the editor.**
   - It's the help text on the page's first section, and also the page's intro, because a page's intro isn't shown on its edit form.
   - The public page has no draft banner.
10. **Gaps are listed here and in the editor's note, not on the public page.** The brief rules out a "draft" banner, so the page doesn't show visible "[gap]" markers either.
11. **`POLICY_VERSION` is bumped,** so the records show which families agreed after the full policies page existed.
12. **"Missing a class?" on the family account.** It's a small link that completes the absence topic (audit note 12, "no absence reporting"). It doesn't touch pricing or billing.

## Open points (sentences for Hannah to confirm, with my recommendation)

**FAQ** (also shown on class pages):
1. "Most weekly classes are {$95–$115 a month}, by class length. A few, like Stories and Songs, run as 8-week sessions with a single price. Every class shows its price in the class finder." *Recommend: keep.*
2. "When you sign up, you pay the first month (prorated if you join after the first week) and the one-time performance or materials fee. After that, monthly tuition is charged automatically to your saved card on the 1st of each month. Or pay for the whole season up front and save 10%. A month still unpaid after the 10th has a $15 late fee. Trying the first class free? Nothing is due until you decide to stay." *Recommend: keep; this is what the code does.*
3. "By card, when you sign up on this site. For monthly tuition, we keep the card on file and charge it automatically on the 1st; email us to switch cards. Card numbers go straight to Stripe… Ask us about other ways to pay." *Hannah: do you still take checks or cash by arrangement? The wording neither promises nor denies it.*
4. "Let us know at least 5 days before the 1st, and we'll stop the next monthly charge." *Recommend: keep.*
5. "If a class doesn't have 5 [students] about two weeks into the season, it's cancelled…" *Hannah: confirm the timing (see Decision 5).*

**Home and About:**
6. "with about 7–8 students per teacher" (home; was "about 7"). *Recommend: keep 7–8.*
7. Home Geode card: "Acting Studio for ages 11–17, Third Thursday Improv Nights for adults, and the Performance Troupe, shared with Little Characters, for ages 9 and up."
8. About, Tweens: "…The Performance Troupe, for ages 9 and up, is shared by Little Characters and Geode."
9. About, Tuition fact: "$95–$115 a month for most weekly classes, by class length; a few run as 8-week sessions with one price; camps about $50 a day."

**Geode:**
10. `/geode`: "Geode used to be just for adults. Now it's for tweens and teens too." and "…and the Performance Troupe, for ages 9 and up, is shared by Little Characters and Geode."

**Account and contact:**
11. Account: "To switch cards, email us before the 1st. To withdraw, tell us at least 5 days before the 1st."
12. Contact: the reply time. *Hannah to fill in **Site settings → Contact → When families can expect a reply**, or leave it empty.*

**The whole Policies page** (draft):
13. *Hannah to read every line.* The parts not taken from an existing site sentence:
    - "We email you a link to pay, and try your card again a few days later" (billing retries on the 4th and 7th).
    - The privacy paragraphs, written from `docs/security.md`, including "No one else gets it" (only the host, database, email and Stripe receive data).
    - "Stripe keeps its own records of past payments."
14. **Gaps for Hannah** (not on the page):
    - **How long we keep a family's information after they leave.** `docs/security.md` suggests 3 years; it isn't automated.
    - **What "OK to share photos online" covers:** this site only, or Instagram and Facebook too?
    - **Have a lawyer read the privacy part before launch** (`docs/security.md`).

## Follow-up candidates
- **Event prices:** the event collection has its own text price. It could be generated from the linked program's price, which needs a change to the event pages (another session's).
- **Prose ages:** ages in prose (Geode paragraphs, SEO drafts such as "for ages 9 and up") are still typed. A placeholder like `{ages.performance-troupe}` would remove the last place they can drift.
- **"Do you offer discounts?"** still types "10%" and "15%". It could use `{payInFullDiscount}` and `{multiDiscount}` like About does, and should change with the family-discount unit's wording.
- **Unconfirmed FAQ draft:** the new-FAQ draft "What age can my child start?" says "Tweens and teens from 11 can join Geode". That's true of the Acting Studio, but it could mention the shared troupe from 9.
- **Absence notes:** they're in `/admin/leads` and Hannah's inbox. The back-office class page could show them by class and date.
- **Contact form spam:** a per-IP limit on `/api/leads` would add a second guard for the contact form.

## Handoff
- **Merge risk:**
  - `src/lib/format.ts` `price()`: a two-line addition. The pricing session may also edit `price()` (for "$160/session").
  - `src/pages/account/index.astro`: two small spots.
  - `src/components/SiteFooter.astro`: one added `<li>`.
- **Files I didn't touch:** `SiteHeader.astro`, the class finder, `programs/[slug].astro`, event pages, pricing, billing, and the review and pay pages. Only the link line in `enroll/details.astro` changed.
- **After merging:** run `npm run seo:review` again if any other unit changed drafts or quoted seed text.
- **No compaction or restart occurred** during this unit.
