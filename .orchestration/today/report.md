# Today unit: report

## Result

**For Hannah:** `/admin` is now a real home page. It shows the date, then today's classes. Each class has its time, class, location, teacher and "8 of 12", and links to the class page. On a day with no classes it says "No classes today" and names the next day that has classes. Below that is the top of "Needs attention", then quick links. `/admin/attention` (the phone's Alerts tab) has the full list, grouped by kind with counts. A red count of urgent items (alerts and warnings) sits next to Today in the top bar and on the Alerts tab. Signing out from a staff page now leads back to the staff sign-in, so the installed app stays in the app. A signed-in person who isn't staff now sees a "Staff only" panel instead of a bare "Not found". The keyboard focus ring in the dark top bar is now yellow.

**For families:** nothing changes. Sign-out from the family pages still lands on the home page.

| File | Change |
|---|---|
| `src/server/today.ts` (new) | `todayClasses`, `attentionItems`, `attentionCount`. Their pure halves are `classesOn`, `nextClassDay`, `attentionFrom`, `attentionGroups` and `todaysAttention`. Also `devDay`, and one query, `enrolledChildren`. |
| `src/components/admin/AttentionList.astro` (new) | The "Needs attention" rows. |
| `src/pages/admin/index.astro` | Today, replacing the placeholder. |
| `src/pages/admin/attention.astro` | Needs attention, replacing the placeholder. |
| `src/components/admin/AdminShell.astro` | The urgent count beside Today (top bar) and Alerts (tab). Sign-out forms send `next=/admin`. The staff-only panel gets new wording, Sign out (back to the same address, which then shows the staff sign-in) and "Go to your family account". |
| `src/server/staff.ts` | `requireStaff` refuses non-staff with a 404 that has no body (see Decisions). |
| `src/pages/404.astro` | On `/admin` addresses, for a signed-in person who isn't staff, it renders the shell's "Staff only" panel. Everyone else gets the usual 404 page. |
| `src/pages/account/sign-out.ts` | Reads `next` and uses it only if `safeStaffPath` accepts it. Otherwise it goes to `/` as before. |
| `src/styles/admin.css` | `--focus: var(--yellow)` inside `.staff-top` only, plus `.attention-item--good` and `.staff-count`. |
| `tests/unit/today.test.ts` (new) | 22 tests. |
| `tests/e2e/staff-today.mjs` (new) | The browser test, run after the others. |
| `docs/back-office.md` | Routes, §6 (non-staff panel, sign-out), §3 styles, and a new §11 for Today and Needs attention. |

## Proof

- `npm run check`: 0 errors, 0 warnings.
- `npm test`: 27 files, **546 tests passed**, 22 of them new in `today.test.ts`. They cover:
  - the edges of the "under 5" window (14 days before and after the first class pass; 15 days before and after don't);
  - one-off nights never count as "under 5";
  - birthdays: today, tomorrow, day 6 and day 7, the day before, across New Year, and Feb 29 in a common year;
  - the 7-day windows for sign-ups and leads, one minute either side;
  - care details confirmed just under and just over a year ago;
  - kind order, the urgent count, and the per-kind limits on Today.
- `npm run build`: complete.
- Browser tests on a fresh database (`tests/e2e/serve.sh`), in order:
  - all eight existing tests exit 0: enroll-journey, trial-journey, content-editor, navigation, staff-foundation, staff-contacts, staff-classes, staff-families;
  - then `staff-today.mjs` passes. It checks:
    - Tuesday Oct 20's three classes, with times, teachers and "N of M", and the link to the class page;
    - "No classes today" with the next class day on Dec 25;
    - "See all", each group's count matching its items, and every action link returning 200;
    - the top bar count equals the alert and warning items on the full list (2), and the Alerts tab shows the same;
    - the focus ring is 3 px with 10.8:1 contrast against the bar;
    - sign-out from `/admin/classes` lands on `/admin` with the staff sign-in;
    - a signed-in parent gets a 404 with the panel, their email, Sign out and the family link at `/admin`, `/admin/attention`, `/admin/classes` and a class page;
    - signing out from the panel shows the staff sign-in;
    - no sideways scrolling at 390 px on Today, Needs attention and the panel;
    - no page errors.
- **Failures on the way, all fixed:**
  - My first version put the count inside the Today link, which changed the link's text, so staff-foundation's check of the top bar's link text failed. The count now sits beside the link.
  - staff-families timed out in that same run. That run had shared the database with the failed staff-foundation run. On a fresh database, all of them pass.
  - My own test read the count's text with the screen-reader words included, and assumed the first Tab lands in the bar (it lands on the skip link first). I fixed both in the test.
- Screenshots in `.orchestration/today/shots/`:
  - `today-desktop.png`, `today-phone.png`;
  - `attention-desktop.png`, `attention-phone.png`;
  - `staff-only-desktop.png`, `staff-only-phone.png`;
  - `focus-ring.png`.

## Decisions

- **One new query instead of `familyDirectory`.** `enrolledChildren()` joins active and trial enrollments to students and households. It feeds emergency contacts, care details, sign-ups and birthdays. `familyDirectory` has no birthdates, no confirmation dates, and no enrollment dates or statuses (its class labels mix the status into the text). It also costs four queries over every family. `classRows` and `sessionCounts` (behind `classList`), `billingOverview` and `staffLeads` are reused as they are.
- **The count was added.** It costs three queries per staff page (billing overview, class counts, active enrollments), run in parallel and cached per request in a WeakMap keyed by `Astro.locals`. Today and Needs attention share the cache, so the count adds no queries there. Leads load only for the lists.
- **The staff-only panel goes through the 404 page.** `requireStaff` takes only `locals`, so it can't render a page. A 404 without a body makes Astro render `src/pages/404.astro` and keep the status. That one place covers every staff page, with no change to the 31 callers. Downloads get an empty 404 instead of the text "Not found".
- **Sign-out from the panel** returns to the same address, which then shows the staff sign-in, for a teacher about to use a staff email. The family account link is `/account`.
- **"This week" for birthdays** means today and the next 6 days, not Monday to Sunday, so on a Sunday the list still looks ahead.
- **"Under 5":** one summary item, linking to `classes()?under5=1` as asked. It leaves out one-off sessions (see Open points). The window is measured to the first meeting date (`meetings(session)[0]`).
- **Sign-ups** count active and trial enrollments in classes that haven't ended, grouped by class. Waitlist joins aren't included.
- **Payments:** one item per installment. A failed payment with "Pay now" opened and no retry reads "Payment on hold". Processing reads "Payment still processing". The reasons are written for staff ("card declined"), not `failureReason`'s family wording.
- **Today shows** up to 3 of each kind (5 for missing emergency contacts), with "See all (n)" and "N more on the full list".
- **Test dates:** `?on=YYYY-MM-DD` works on both pages only when not `isProd`, and the page adds "(test date)" after the date. The count in the shell always uses the real date.
- **No audit entry** for Today and Needs attention. They show names, birthdays and family names but no care details, like Search, which isn't logged either.
- **The focus ring:** only `.staff-top` changes `--focus`, to yellow, the same as the search box's focus. Focus styles elsewhere are unchanged.

## Open points

1. **`classRows` counts one-off "class" nights (Adult Improv) as under 5,** so `/admin/classes?under5=1` can list more than Today's item. Recommended: the Classes unit adds `!isOneOff(session)` to `under5` in `src/server/classes.ts`. I didn't change their file.
2. **The "Classes under 5" group shows a count of 1 when there are 2 classes** (one summary item). Recommended: leave it. The item's title gives the number of classes.
3. **`EMERGENCY_CONTACT_REQUIRED`:** missing emergency contacts are flagged even if it's switched off. Recommended: keep it that way. Hannah still wants to know.
4. **The waitlist-opening item doesn't take open offers into account** (a place already offered still counts as open). Recommended: the Roster changes unit subtracts open `waitlist_offer`s when it adds offers.

## Follow-up candidates

- Phase 2's dashboard can build on `attentionFrom` and `todayClasses`.
- Teacher logins: the staff-only panel is where a teacher without staff access would land.
- "Missed two in a row" and "attendance not taken" would fit as new kinds once attendance exists.

## Handoff

- **Routes:** `today()` → `/admin` and `attention()` → `/admin/attention`. Both accept `?on=YYYY-MM-DD` in development only.
- **`todayClasses(content, now?, date?)`** returns `{ date, classes: TodayClass[], next: { date, classes } | null }`. A `TodayClass` is `{ start, time, title, label, location, teacher, places, href, kind: 'class'|'event' }`.
- **`attentionItems(content, now?, key?, date?)`** returns `AttentionItem[]`. An item is `{ kind, tone, title, detail, action: { label, href } }`:
  - kinds: `payments | waitlist | under5 | emergency | care | signups | leads | birthdays`, in that order;
  - tones: `alert | warning | neutral | good`.
- **`attentionCount(content, now?, key?)`** counts the alert and warning items. Pass `Astro.locals` as `key` to share the queries.
- **Constants:** `ATTENTION_KINDS`, `UNDER5_WINDOW_DAYS = 14`, `RECENT_DAYS = 7`, `BIRTHDAY_DAYS = 7`.
- **`<AttentionList items />`** shows the rows.
- **Shell:** `.staff-count[data-staff-count]` sits beside the links (a sibling of the `<a>`, inside the `li`), so the links' text is unchanged.
- **Sign-out** (`POST /account/sign-out`) accepts `next`, used only when `safeStaffPath` accepts it.
- **Non-staff:** `requireStaff` returns `new Response(null, { status: 404 })`. Any new staff page gets the panel automatically.

## Compaction

None occurred.
