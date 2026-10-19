# Journey audit: owner and teacher (October 19)

Branch `claude/bo-foundation`, on a fresh local database filled by the enrollment and free-trial browser tests (made-up families). The walk-through was scripted with Playwright, then I checked the screenshots by eye. Script: `.scratch/audit.mjs` (not committed); its log is `walkthrough-log.md`.

- **Hannah on her phone:** an iPhone 13 profile at 390 px with touch: sign in, Today, Classes, a roster, Search, Alerts, Payments, a family's payments, Messages & sign-ups, a PDF download, the website editor, the install page, Sign out.
- **Hannah on a computer** (1280 px): the same sections, the search box, and the keyboard.
- **A teacher** whose email isn't on `ADMIN_EMAILS`, on a phone.

## Hannah on her phone

| # | What she hits | How bad | Whose |
|---|---|---|---|
| 1 | **The Classes list and a roster don't fit a phone.** The tables are 126 px and 213 px too wide, so the phone zooms the whole page out. The "Roster" links sit at the right edge and **couldn't be tapped**. **On a roster, the bottom tabs couldn't be tapped**: the zoomed-out page covers them. | Blocks the most-used screen | Moved pages (unchanged); Classes unit. Small enough to fix now with `.data-table` |
| 2 | **Parents' phone numbers on the roster aren't tap-to-call or text links.** | High: Hannah calls parents from class | Classes unit (`telHref` / `smsHref` are ready in `src/lib/contacts.ts`) |
| 3 | **Three names for one place:** the tab says "Payments", the phone's title bar says "Billing", and the heading says "Monthly autopay". Likewise "Classes" → "Rosters" → "Roster: Intro to Theater". | Medium: confusing | Moved pages kept their old titles; a one-line fix each |
| 4 | **Payments on a phone:** "Stop payments" and "Payments & discounts" break mid-word ("Stop paym / ents"). Black lines sit above each button: the page's `.actions` class collides with the editor's sticky save bar style. | Medium: looks broken | Was already there; Payments unit, or a quick class rename |
| 5 | **Classes lists 23 rows,** including one-off dates that have passed (Parents' Night Out Sep 25, the free class on Oct 15). | Medium: clutter | Classes unit |
| 6 | **Search and Alerts, 2 of the 4 tabs, are "coming soon" placeholders.** So is Families on the computer. | Expected until the Search and Today units merge | Search, Today |
| 7 | **Sign out lands on the family home page.** In the installed app that leaves the app's pages, so the browser bar shows. | Low | Foundation: send staff to `/admin` (the sign-in) |
| 8 | **The roster has two back links:** "‹ Classes" in the title bar and "← All rosters" (27 px tall) on the page. | Low | Classes unit |
| 9 | **The website editor works on a phone** and shows "works best on a computer". Its ↑ ↓ reorder buttons are 30 px. | Fine for Phase 1 | — |
| ✓ | **These worked well:** a family's payments page (adding a discount reads well), Messages & sign-ups as cards, the PDF downloading on the phone, the menu, the install page, and no page errors. | | |

## Hannah on a computer

- **Everything fits,** with no sideways scrolling.
- **The keyboard focus ring** (teal) is dim against the dark top bar. *Fix:* a yellow focus ring inside `.staff-top`. *Whose:* Foundation.
- **The "Rosters" button on her family account page** (`/account`) now opens Today. *Fix:* label it "Staff". *Whose:* Foundation (one word on a page that only staff see).
- **Search goes to the placeholder,** as expected for now.

## A teacher

The Studio Director answers say teachers sign in, and teachers want their rosters and attendance on a phone. That's planned for Phase 2 (teacher logins). In Phase 1:

1. **A teacher who signs in at `/admin` gets a blank page that says only "Not found".** It has no explanation, no sign-out and no way back. `requireStaff` answers before the page draws. *Fix:* keep the 404 status, but show the shell's existing "This is for Little Characters staff. Sign out" panel. *Whose:* Foundation.
2. **Signing in quietly makes the teacher a family account.** `/account` then greets them with "Welcome to Little Characters!".
3. **The only way to give a teacher rosters today is to add them to `ADMIN_EMAILS`.** That opens everything: every family's medical notes, payments and discounts, downloads, and the website editor. Recommend: don't, until teacher logins exist. Meanwhile Hannah can share a class list by printing it (the Classes unit builds `classPrint`).
4. **Taking attendance:** nothing exists before Phase 2, so teachers keep sending Hannah a note.

## Recommended now (my unit, small)

1. **Rosters and the Classes list:** switch to `.data-table` with labels, so the links and tabs work on a phone (finding 1), and give the moved pages titles that match their tabs (finding 3). I left these pages alone because the brief said "moved pages keep their content", but finding 1 blocks the main phone task.
2. **The teacher's "Not found":** a friendly staff-only page with Sign out (teacher finding 1).
3. **Sign out** returns staff to the staff sign-in (finding 7). **The focus ring** in the dark bar. **The "Staff" label** on the account page.

The rest belongs to the Classes, Payments, Search and Today units, as noted.
