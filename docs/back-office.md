# The staff back office

Hannah's side of the site: classes, families, payments, messages and the website editor, on a computer and on a phone. This page covers the shared pieces every staff screen builds on. The plan is in `docs/review-2026-10/log.md` ("Back-office plan drafted"); billing is in `staff-billing.md`.

## 1. Routes and the link contract

Every staff address comes from `src/lib/admin-links.ts`. Link with these functions, never with typed paths.

| Function | Address | Page |
|---|---|---|
| `today()` | `/admin` | Today (§12) |
| `attention()` | `/admin/attention` | Needs attention, the phone's Alerts tab (§12) |
| `classes()` | `/admin/classes` | Classes list (the old rosters list) |
| `classPage(sessionId)` | `/admin/classes/<id>` | A class (the old roster page) |
| `classPrint(sessionId)` | `/admin/classes/<id>/print` | A class's roster, ready to print (§9) |
| `classEmail(sessionId)` | `/admin/classes/<id>/email` | Email the class (§13) |
| `classSignInSheet(sessionId)` | `/admin/classes/<id>/sign-in-sheet.pdf` | A class's sign-in sheet (§9) |
| `search(q?)` | `/admin/search?q=` | Search (placeholder) |
| `family(householdId)` | `/admin/families/<id>` | A family's page (§10) |
| `familyEmail(householdId)` | `/admin/families/<id>/email` | Email this family (§13) |
| `familyLists()` | `{ children, contacts, notes }` | The family downloads' list paths, for `downloads()` (§10) |
| `payments(show?, month?)` | `/admin/payments`, `?show=failed` or `upcoming`, `?month=2026-10` | Payments (§11) |
| `paymentsOrder(orderId)` | `/admin/payments/<id>` | One family's payments for a class |
| `leads()` | `/admin/leads` | Messages & sign-ups |
| `content()` | `/admin/content` | The website editor |
| `install()` | `/admin/install` | Put the app on your phone (teachers too) |
| `settings()` | `/admin/settings` | Settings: a tile per settings page (§15) |
| `settingsStaff()` | `/admin/settings/staff` | Settings → Staff (§15) |
| `settingsStaffMember(staffId)` | `/admin/settings/staff/<id>` | One staff member: role, classes, substitute dates, turn off (§15) |
| `calendar(month?, params?)` | `/admin/calendar?month=2026-11` (`view=week&week=`, `program`, `location`, `teacher`) | The calendar (§18) |
| `classDayRoster(sessionId, date)` | `/admin/teach/<id>/<date>` | One class date's attendance roster (the teacher app's page; the calendar links to it) |
| `settingsDaysOff(sessionId?)` | `/admin/settings/days-off` (`?class=<id>&which=some` pre-fills a class) | Settings → Days off (§18) |
| `teachHome()` | `/admin/teach` | The teacher app's home (§15) |
| `confirm(next)` | `/admin/confirm?next=` | Sign in again, then go on |
| `downloads(listPath)` | `{ csv, pdf }` | A list's two downloads |

`safeStaffPath(next)` returns `next` only when it's a staff path on this site (`/admin` or below), else null. Use it for any return address that comes from the browser.

Ids in addresses are database or catalog ids. Children's names and notes never go in a URL.

**Moved in October 2026.** The old addresses redirect for good (301; 308 for a form post), via `src/server/moved.ts`:
`/admin/<session>` → `/admin/classes/<session>`, `/admin/billing` → `/admin/payments`, `/admin/billing/<order>` → `/admin/payments/<order>`. Unknown classes and orders are "Not found" for staff, and signed-in families get "Not found" as before.

## 2. The staff shell

`src/components/admin/AdminShell.astro` wraps every staff page.

```astro
<AdminShell title="Intro to Theater" section="classes" back={{ href: classes(), label: 'Classes' }}>
  <div class="admin-page">…</div>
</AdminShell>
```

| Prop | What it does |
|---|---|
| `title` | The browser tab, and the title in the phone's top bar |
| `section` | `today`, `classes`, `families`, `payments`, `leads`, `content` (the default), `settings` or `teach`: which section is lit on a computer |
| `back` | `{ href, label }`: a back link in the phone's top bar. Give it to every page below a list: the installed app has no back button |
| `wide` | More width (the editor) |
| `signIn` | `{ heading, intro }` for the sign-in shown to signed-out visitors (the confirm page uses it) |
| `teachers` | The page is part of the teacher app: teachers may open it (with `requireTeacherOrOwner`). Without it, only owners get the shell |

- **Computer:** a dark top bar with the search box (it sends `GET /admin/search?q=`), the staff member's email and Sign out, then the sections: Today, Classes, Families, Payments, Messages & sign-ups, Website, Settings. Families goes to Search until there's a families list.
- **Phone (760 px and narrower):** the page title with the optional back link and a Menu button at the top; a tab bar at the bottom: Today, Classes, Search, Alerts. The current tab follows the address (a family's page lights Search). The menu holds Families, Payments, Messages & sign-ups, Website, Settings, "Put the app on your phone" and Sign out.
- **Teachers** get a smaller shell: one section, "Your classes" (`teachHome()`), no search and no tab bar; the phone menu holds only "Put the app on your phone" and Sign out.
  - **Why a menu rather than links on Today:** it's on every page, so Payments is two taps away wherever Hannah is, and Today stays about today.
- **The website editor** shows "The website editor works best on a computer." on phones, and stays usable.
- The family site's header and footer aren't shown on staff pages (`Base.astro`'s `chrome={false}`).

## 3. Shared styles (`src/styles/admin.css`)

Use these instead of page-level styles.

| Class | Use |
|---|---|
| `.admin-page` | The page's column, with spacing |
| `.admin-head`, `.admin-head__actions`, `.admin-intro`, `.admin-crumbs` | Page header: title and a line on the left, buttons on the right |
| `.staff-card`, `.staff-cards` | A bordered card; a grid of them |
| `.data-table` | A table that becomes stacked cards on phones. Give every `td` a `data-label` (the column name), and wrap a cell's content in one element when it has more than one; `.num` right-aligns numbers |
| `.badge` + `.badge--neutral`, `--good`, `--warning`, `--alert`; `.badges` | Status labels (not buttons), in a row |
| `.chip` (site-wide) + `.chip-row`, `.chip--good`, `--warning`, `--alert` | Filter buttons, with `aria-pressed` |
| `.btn` (site-wide), `.btn--primary`, `--outline`, `--sm`, `.btn--danger` | Buttons. On phones `.btn--sm` grows to 44 px |
| `.empty-state` | "Nothing here yet": a `strong` title and a line |
| `.attention-list`, `.attention-item` (+ `--alert`, `--warning`, `--neutral`, `--good`), `__title`, `__detail`, `__action` | A "Needs attention" row with its next step |
| `.notice`, `.notice--error` | Saved / error messages |
| `.tiles`, `.tile` | Big links (Today's quick links) |
| `.staff-count` | The count of urgent items on Today and the Alerts tab |

## 4. Badges

`childBadges(input, today)` in `src/lib/badges.ts` returns a child's badges in a fixed order. `src/components/admin/Badges.astro` shows them.

| Key | Label | Tone | When |
|---|---|---|---|
| `medical` | Allergy, else Medical | alert | allergies or medical notes filled in |
| `pickup` | Pickup note | warning | a pickup note, or a restricted pickup list |
| `no-photos` | No photos | neutral | the parent said no to photos |
| `new` | New | good | first enrollment created in the last 30 days |
| `trial` | Trial | neutral | this enrollment is a free trial |
| `birthday` | Birthday | good | birthday within 3 days either side of today (Feb 29 counts as Feb 28 in other years) |

`drop-in` is reserved for Phase 2. The input is yes/no facts (`hasAllergies`, `hasMedicalNotes`, `hasPickupNote`, `restrictedPickup`, `photoConsent`, `firstEnrolledAt`, `trial`, `birthdate`), so the notes never reach the HTML. Decrypt with `readStudentNotes`, turn into booleans on the server, and pass only those.

## 5. Downloads: CSV and PDF

Every list downloads as a spreadsheet and a PDF.

- **The pattern:** a list page at `/admin/x` gets `src/pages/admin/x.csv.ts` and `x.pdf.ts`. All three call one server function for their rows, so they always agree. The working example is Messages & sign-ups: `staffLeads()` and `leadsTable()` in `src/server/leads.ts`, used by `leads.astro`, `leads.csv.ts` and `leads.pdf.ts`.
- **Each endpoint starts with** `const stop = requireFreshStaff(locals, url); if (stop) return stop;`.
- **On the page:** `<DownloadLinks {...downloads(leads())} what="messages and sign-ups" />`. Filters in the list's query string carry over to both files.
- **`toCsv(headers, rows)`** (`src/lib/csv.ts`): RFC 4180 quoting, CRLF line ends, a UTF-8 byte-order mark for Excel, and a leading `'` on any cell starting with `=`, `+`, `-`, `@`, a tab or a carriage return, so it can't run as a formula.
- **`csvResponse(filename, csv)`, `pdfResponse(filename, { title, subtitle, columns, rows, orientation })`** (`src/server/downloads.ts`): attachments, `Cache-Control: private, no-store`. Columns are `{ header, weight?, align? }`; weights share the page width. Landscape is the default above 5 columns.
- **The PDF** is made on the server with [pdfkit](https://pdfkit.org) (pure JavaScript, maintained, no browser needed, so it builds on Render as is): a header with the title, the filters and "Made <date> for Little Characters", a table whose long cells wrap and whose header row repeats on each page, and page numbers. It adds 17 packages, about 25 MB in `node_modules` (mostly pdfkit's own browser builds and font data, never loaded), and 5 KB to the server bundle. It uses PDF's built-in Helvetica: pdfkit can't subset the site's variable fonts (Figtree, Bricolage Grotesque).

## 6. Signing in, for staff (`src/server/staff.ts`)

- **Roles** are in §15. In short: `requireStaff` means **owner**, and stays on every Phase 1 page; teacher-app pages use `requireTeacherOrOwner`.
- **`requireStaff(locals)`** at the top of every owner page and endpoint:
  ```ts
  const { staff, response } = requireStaff(Astro.locals);
  if (response) return response; // signed-in non-staff: 404 with the "Staff only" panel
  // staff is null when signed out: AdminShell shows the staff sign-in.
  ```
- **Signed in, but not an owner** (a parent, a teacher, someone turned off): the 404 has no body, so Astro renders `src/pages/404.astro` with the status kept; on an `/admin` address that page shows the shell's panel: "This page is for Little Characters staff. You're signed in as …", Sign out, and a link to the family account (for a teacher: "Go to your classes"). The content editor's pages use `requireStaff` too. Downloads get an empty 404.
- **Signing out** from a staff page sends `next=/admin` to `/account/sign-out`, so staff land on the staff sign-in and the installed app stays in the app. The route accepts only a `safeStaffPath`; families' forms send nothing and land on the home page as before.
- **A fresh sign-in.** `signedInRecently(locals, 15)` is true when the session was made in the last 15 minutes. `requireFreshStaff(locals, url)` uses it: downloads and staff changes now, refunds later. Otherwise staff go to `/admin/confirm?next=…`, which says "Confirm it's you before downloading", fills in their email, and runs the normal 6-digit code sign-in (a new session). For a download it then starts the file and offers "Back to the list"; for anything else it goes straight to `next`.
- **Idle limit.** A staff session (owner or teacher) not renewed for 30 days counts as signed out, and is deleted. Families keep 90 days.
- **"This is a shared device"** is a tick box on the staff sign-in and the confirm page (`SignInPanel`'s `sharedDevice`). After signing in, the page posts to `/api/staff/shared-device`, which sets `session.shared_device` on the signed-in person's own session. Such a session ends after 1 hour without use (`SHARED_IDLE_MINUTES`); `readSession` marks it as used every 5 minutes while it's in use. `readSession` (used by `src/middleware.ts`) reads the session without renewing it first, so an idle one is seen as idle, then renews it once a day as before.
- **Tests** age a session with `POST /dev/age-session` (`minutes` or `days`; `idleMinutes` for the shared-device hour), which exists only in development, like `/dev/mailbox`.
- **Sign-in inside the installed app** works by typing the code: nothing on staff pages relies on opening a link from an email.

## 7. The phone app

A home-screen web app; no app store.

- **Manifest:** `public/admin/app.webmanifest`. "Little Characters Staff" ("LC Staff"), `start_url`, `scope` and `id` `/admin`, standalone, ink `#1c1826` theme and white background. It's a static file, so it loads without signing in (browsers fetch manifests without cookies).
- **Icons:** `public/admin/icons/` (192, 512, maskable 512, Apple 180): the logo mark on ink, made once by `npx tsx scripts/make-staff-icons.ts`.
- **Only staff pages** link the manifest and the Apple icon and title (through `Base.astro`'s `head` slot). The family site is unchanged.
- **No service worker.** Chrome's install criteria no longer ask for one (web.dev, "What does it take to be installable?", updated September 2024: HTTPS, a manifest with a name, 192 and 512 px icons, `start_url` and `display`, and some engagement). Offline attendance in Phase 2 will add one.
- **`/admin/install`:** iPhone steps (Safari, Share, Add to Home Screen) with simple drawings; Android's "Install app" button when Chrome offers it, with Chrome's menu as the fallback; "You're using the app now" when it's open as the app. Linked from the phone menu.

## 8. Data added for the back office (migration `0009_back_office`)

| Table / column | Holds | Types |
|---|---|---|
| `household.emergency_contacts` | Up to 4 `{ name, relationship, phone }` besides the parents | `EmergencyContact` (`src/lib/contacts.ts`) |
| `household.pickup_people` | Up to 4 `{ name, relationship, phone? }` who may pick up | `PickupPerson` |
| `household.contacts_confirmed_at` | When a parent last confirmed the lists | |
| `household.zip`, `household.heard_about` | ZIP code; how they heard about us | |
| `household_note` | Staff notes about a family or one child (`student_id`) | `HouseholdNote` |
| `message`, `message_recipient` | Staff emails (`class` or `family`) and each address's `sent` / `failed`; indexed by household for the family page | `Message`, `MessageRecipient` |
| `waitlist_offer` | A place offered to a waitlisted enrollment: `offered`, `accepted`, `withdrawn`, `expired` | `WaitlistOffer` |
| `enrollment.no_charge_reason` (migration `0010_roster_changes`) | Why staff added the child without charge (§14); null for everyone else | |
| `audit_log.detail` (`0010`) | A staff-written reason on the audit entries that need one (a no-charge add), or the class and date a staff change concerns (`admin.staff.*`). Never care details | |

`src/lib/contacts.ts` has the zod inputs (`emergencyContactsInput`, `pickupPeopleInput`: names up to 80 characters, relationships up to 40), `normalizePhone` (US numbers as 10 digits, others as `+digits`), `formatPhone` ("(706) 555-0142"), `telHref` and `smsHref`. Who sees the new data: `security.md`.

Families fill these in on the details step and at `/account/family` (`portal.md`). Read them with `getFamilyDetails(householdId)` (`src/server/family.ts`); `familySummary` and `personLine` (`src/lib/family-details.ts`) write them out, and `heardAboutLabel` turns the stored `heard_about` key (`friend`, `search`, `social`, `school`, `event`, `flyer`, or `other: …`) into words. `EMERGENCY_CONTACT_REQUIRED` there switches the required emergency contact off.

## 9. Classes (`src/server/classes.ts`)

- **The Classes list** (`/admin/classes`): one row per session the site takes sign-ups for, by term: when, teacher, places filled ("8 of 12": enrolled plus trials), openings and the waitlist. Current and upcoming by default; ended ones, past one-off dates included, under "Ended". Filters are links: `?openings=1`, `?waitlist=1`, `?under5=1` (weekly classes short of the 5 they need to run; a one-off night of a class never counts), `?term=Fall 2026`, `?show=ended`. `classFilters(params)` reads them and `filterQuery(f)` writes them. Downloads: `classes.csv.ts`, `classes.pdf.ts` ("Class List"), as filtered.
- **A class's page** (`/admin/classes/<id>`): the roster by last name with badges and the parents' Call, Text and Email links; tapping a child opens their care details in place (allergies and medical notes in red, pickup, emergency contacts, photos); the waitlist in the order families joined, with "Offered <date>, expires <date and time>" for an open offer. Add a child, Remove and Offer the spot are in §14.
- **Print** (`/admin/classes/<id>/print`): the roster ready to print, landscape.
- **Downloads**, each needing a fresh sign-in: `/admin/classes/<id>.csv` and `.pdf` ("Class Roster", with care details), and `/admin/classes/<id>/sign-in-sheet.pdf` ("Student Sign-in Sheets": names and the next 8 class dates, no care details).
- **One query:** `classRoster(sessionId, staffId, action)` feeds the page, print, CSV and both PDFs. Each call writes `admin.roster.<action>` to the audit log (`view`, `print`, `csv`, `pdf`, `sign-in-pdf`); the list's downloads write `admin.classes.csv` / `.pdf`.

## 10. Search and a family's page

Queries in `src/server/families.ts`; pages `src/pages/admin/search.astro` and `src/pages/admin/families/[householdId].astro`.

- **Search (`search(q)`):** one box. Plain SQL `ILIKE` ("contains, any case") on family names, parents' names and emails, children's first, last and full names; phone numbers compare digits only (`706.555.0101`, `+1 706 555 0101` and `(706) 555-0101` all match). Class titles come from the content. No index: about 300 families scan in milliseconds. Results are grouped Families, Children, Classes, 50 of each at most, and never show allergies or medical notes.
- **Families (`search()` with no words):** every family A to Z, 50 a page (`?page=2`), with parents, the number of children and their current classes (enrollments not cancelled, in a class that hasn't ended).
- **A family's page (`family(id)`):** parents with Email, Call and Text; each child's badges and care details (open on a computer, a tap on a phone, red when there's something medical to know); emergency contacts and pickup people; every class, current first; a payments summary (card, next charge, failed or overdue payments, paid this season, each order linking to `paymentsOrder`); staff notes; emails sent (`message_recipient`). The phone back link returns to the search results when staff came from them, else to Families. Viewing the page is logged (`admin.family.view`), like a roster.
- **Staff edits on the page,** each logged: care details (`admin.student.update`; the same encryption; `detailsConfirmedAt` unchanged, so a parent still confirms), contacts (`admin.household.contacts`; the shared rules in `src/lib/contacts.ts`; `contactsConfirmedAt` unchanged), notes (`admin.note.add|edit|delete`; only the author edits or deletes their own).
- **"This season"** is the term of the weekly class running today, else the next to start (`currentTerm`).

| Download | Address | Columns |
|---|---|---|
| Family List | `downloads(search())` | Family, Parents, Emails, Phones, ZIP, Heard about us, Children |
| Student / Class List | `downloads(familyLists().children)` | Child, Age, Family, Current classes |
| Student Contact List | `downloads(familyLists().contacts)` | Child, Family, Parents, Emails, Phones, Emergency contacts |
| Family Notes | `downloads(familyLists().notes)` | Family, About, Note, Written by, When |

All four go through `familyDownload` (`src/server/family-downloads.ts`): a fresh sign-in, then an audit entry (`admin.download.csv|pdf`, entity `list`, id `families|children|contacts|notes`). The first three are on the Families list; Family Notes is on each family's page.

## 11. Payments (`src/server/payments-admin.ts`)

Pages `src/pages/admin/payments/index.astro` and `[orderId].astro`; Hannah's guide is `staff-billing.md`. Reads only, plus "Send a pay link": amounts, schedules and charging stay in `billing.ts`.

- **Needs attention** (`paymentsAttention(today)`): `billingOverview`'s `needsAttention` (failed and charging), with the amount owed (`totalDue`), staff wording for the reason (`staffReason`), the next try (`nextStep`), days overdue, `held` (failed, no more automatic tries) and `payLinkSentAt`.
- **Send a pay link** (`sendPayLink(installmentId, staffId)`): only for a failed charge; calls `sendPayLinkEmail` in `billing.ts`, the same function `markInstallmentFailed` sends with (same words, every parent), and writes `installment.pay_link_sent` to the audit log.
- **Upcoming autopay** (`upcomingAutopay(today)`): scheduled charges from the next charge day through two months later, `byDate` with a total per date. The download covers the next 90 days (`upcomingCharges(from, through)`).
- **Families on autopay** (`autopayFamilies()`): each order with payments left, the family's id and next charge.
- **Payments received** (`paymentsReceived(month)`): paid monthly charges (not months a discount covered completely) and paid sign-up orders over $0, in the Athens month, newest first. `method` is `card`, or `staff` for **Paid by cash/check** (`markedBy` from the audit log).
- **Buttons** post back to the page and redirect with `?done=` (so a reload doesn't repeat them). Stop payments stays two steps.
- **The order page:** titled "<family>: <class>", a **Family page** link, the shell's back link to Payments.
- **Test-only:** `POST /dev/fail-charge` (`order=<id>`, staff, development only) declines an order's next scheduled charge through `markInstallmentFailed`, for `tests/e2e/staff-payments.mjs`.

| Download | Address | Columns |
|---|---|---|
| Payments List | `downloads(payments(undefined, month))` | Date, Family, Class, For, Amount ($), How paid |
| Overdue List | `downloads(payments('failed'))` | Due, Family, Class, For, Amount ($), Late fee ($), Days overdue, What happened, Next, Pay link sent |
| Upcoming Autopay | `downloads(payments('upcoming'))` | Date, Family, Class, For, Amount ($) (the next 90 days) |

All three go through `paymentsDownload` (`payments.csv.ts`, `payments.pdf.ts`): a fresh sign-in, then an audit entry (`admin.download.csv|pdf`, entity `list`, id `payments-received|overdue|upcoming`). Amounts are plain numbers ("80.75") so a spreadsheet can add them up.

## 12. Today and Needs attention (`src/server/today.ts`)

- **Today (`/admin`):** the date; the classes meeting today (every staff session whose `meetings(session)` include today, plus the site's events that day not booked through one of those sessions), each with time, class, location, teacher and "8 of 12", linking to `classPage`; "No classes today" with the next day that has classes; the top of Needs attention with "See all"; quick links (Classes, Families, Payments, and "Put the app on your phone", hidden when it runs as the app).
- **Needs attention (`/admin/attention`):** every item, grouped by kind with counts, most urgent first:

| Kind | Tone | When | Link |
|---|---|---|---|
| `payments` | alert | `billingOverview().needsAttention`: failed (or on hold: the family is paying it themselves) and processing | `payments('failed')` |
| `waitlist` | warning | a current class with a waitlist and a place open, not counting places with an open offer (§14) | `classPage` |
| `under5` | warning | weekly classes (kind `class`, not one-off) short of 5, from 14 days before their first class to 14 days after; one item for all | `classes()?under5=1` |
| `emergency` | warning | families with an active or trial enrollment in a class that hasn't ended, and no emergency contact | `family` |
| `care` | neutral | the same children, care details not confirmed by a parent within a year (`detailsOnFile`), one item per family | `family` |
| `signups` | good | active and trial enrollments made in the last 7 days, one item per class | `classPage` |
| `leads` | neutral | messages and sign-ups from the site's forms in the last 7 days, one item | `leads()` |
| `birthdays` | good | enrolled children with a birthday today or in the next 6 days | `family` |

- Today shows the first 3 of each kind (5 families without an emergency contact) and links the rest.
- **The functions:** `todayClasses(content, now, date?)` → `{ date, classes: TodayClass[], next }`; `attentionItems(content, now, key?, date?)` → `AttentionItem[]` (`{ kind, tone, title, detail, action: { label, href } }`); `attentionCount(content, now, key?)`. Their pure halves (`classesOn`, `nextClassDay`, `attentionFrom`, `attentionGroups`, `todaysAttention`) take plain data and a date; Phase 2's dashboard can build on them.
- **The count** on the Alerts tab and on Today in the top bar is the alert and warning items. It costs three queries (billing overview, class counts, active enrollments), cached per request by `Astro.locals` and shared with the page's own list. Leads are loaded only for the list.
- **Tests:** `?on=YYYY-MM-DD` sets the day on both pages in development only (`devDay`, ignored when `isProd`).
- The rows come from `<AttentionList items={…} />` (`src/components/admin/AttentionList.astro`), on `.attention-item--alert|warning|neutral|good`.

## 13. Staff email: "Email the class" and "Email this family"

Hannah emails a class, or one family, from the site instead of Gmail. Sending and the log are in `src/server/messages.ts`; the steps (write → review → sent) in `src/server/message-composer.ts`; the page in `src/components/admin/MessageComposer.astro`, used by `src/pages/admin/classes/[sessionId]/email.astro` (`classEmail(id)`) and `src/pages/admin/families/[householdId]/email.astro` (`familyEmail(id)`, linked as "Email this family" on the family's page).

- **Who gets it:** every family with an enrolled or trial child in the class, ticked. "Also send to the waitlist" adds the families whose children are only on the waitlist. Untick a family to leave them out. Families without a parent email can't be ticked. The page shows family names and parents' emails, never children's details, so opening it isn't logged.
- **Writing:** a subject (up to 200 characters) and a plain-text message. A blank line starts a new paragraph; web addresses become links in the HTML version. Every email ends "Sent by Little Characters about <class>. Reply to this email to reach us." (one family: "Sent by Little Characters.").
- **Steps:** "Send me a test" sends `[Test] <subject>` to the staff member's own address (not logged as a message; audit `admin.message.test`). "Review" shows the subject, the message and "Sending to 12 families". "Send" sends, then shows "Sent to 12 families." or "Didn't send to 2 families" with "Try again for the failed ones".
- **Each email:** one per family, to all of that family's parent addresses together, from `EMAIL_FROM` with reply-to `EMAIL_REPLY_TO`. Sent one at a time, 600 ms apart (Resend's default limit is 2 a second); no pause in development.
- **No double sends:** the review form carries a one-time token (a random UUID) that becomes the `message` row's id. A second send with the same token inserts nothing and sends nothing; the page says "This email was already sent." A retry claims the failed rows before sending, so two clicks can't send twice either.
- **The log:** one `message` row (`kind` `class` with `sessionId`, or `family`), one `message_recipient` row per address with `householdId` and `sent` / `failed` (and the email service's reason in `error`), and an audit entry `admin.message.class|family` (and `admin.message.retry`) without the text. Rows are written `sent` and changed to `failed` when the send throws. Family pages list these rows ("Emails sent"); the composer lists earlier emails to the class (or the family's own emails): date, subject, who sent it, families, and how many didn't send, each opening its sent view (`?sent=<message id>`, only for a message of that class or family).
- **Copy buttons:** "Copy emails" (the ticked families' parent emails, comma-separated, for Gmail's BCC) and "Copy phone numbers" (for a group text). If the browser won't allow copying, a box with the text appears to select and copy.
- **`sendEmail`** (`src/server/email.ts`) now takes `to` as one address or a list, and `emailHtml` takes `{ html }` paragraphs that the caller has made safe (`paragraphHtml` escapes the text first). The dev mailbox stores a list as "a, b" and its log line shows the reply-to when one is given.
- **Not in Phase 1:** attachments, scheduling, texting from the site.

## 14. Roster changes: add, remove, offer the spot

Three actions on a class's page (`classPage(id)`), in `src/server/roster-changes.ts`. Buttons post back to the page; each change redirects with `?done=` so a reload doesn't repeat it. Children's names are searched by form post, never put in the address.

**Remove** (on each child, `[data-roster-actions]`): two steps, a preview (`previewRemoval(enrollmentId, sessionId, mode)`) then the change (`removeChild(…, staffId)`).

| Choice | The enrollment | The child's order | When to use it |
|---|---|---|---|
| **Remove and stop payments** (`stop`) | cancelled | its scheduled and failed charges are cancelled, unless another child on the same order stays in the class: then they continue, and the preview says "Payments for this order continue, because Ava is still in the class. To lower them, add a discount on the order page" | a family withdraws |
| **Remove only** (`only`) | cancelled | unchanged | a child moved to another class and Hannah handles the payments herself |

- Both refresh the 15% family discount in the same transaction (a removal can end it for the family's other classes); the preview shows that change in the Payments page's stop-preview words, and the family gets the usual "Your family discount has ended" email.
- Stopping uses `cancelRemainingInstallments(tx, orderId)` in `billing.ts`, the query **Stop payments** runs (`stopRemainingPayments` now calls it too).
- No refunds and no proration of the last month: the preview says "Nothing already paid is refunded here. To give money back, refund it in the Stripe dashboard."
- The child leaves the roster; the family page shows the class as Cancelled. Audit: `admin.roster.remove_stop` or `admin.roster.remove` (entity `enrollment`), plus `installment.stop` when charges stopped.

**Add a child** (under the header, `[data-roster-tools]`): find a child by name (`findChildren(q, sessionId, catalog)`, the staff search's children), then one of:

- **Send a sign-up link** (`sendSignUpLink`): emails the parents "Sign up for <class>" with `/enroll/<sessionId>`. The family pays through the normal checkout, so prices and discounts apply as usual (a phone sign-up). Sent and logged through `sendMessage` (kind `family`, so it's on the family page's "Emails sent"), plus `admin.roster.signup_link`. The form's one-time token means a double click sends once.
- **Add without charge** (`addWithoutCharge`): a scholarship, a staff child, a trade. Needs a fresh sign-in (`requireFreshStaff`; staff come back to the child's confirm step at `?add=<studentId>`), a reason (up to 300 characters) and a confirm. The child is an active enrollment with no order and no payments; `enrollment.no_charge_reason` holds the reason, and the audit entry `admin.roster.add_no_charge` keeps it in `detail`. It shows as "No charge, added by staff: <reason>" on the roster, on the family page and in Payments' **No charge** list (`noChargePlaces`); the roster CSV says "Enrolled (no charge)".
- **The rule:** a no-charge enrollment never counts toward the 15% family discount (`countingEnrollments`), so adding one changes nothing anyone else pays. If the child later signs up and pays, the enrollment becomes an ordinary one (the reason is cleared).
- **Both ways:** a child already in the class (enrolled or trial) is refused; a waitlisted child gets Offer the spot instead of a link (Add without charge takes them off the waitlist). A full class shows a warning and needs "Add anyway" / "Send anyway" ticked; with a link, the family can only join the waitlist until a place opens, because the checkout's capacity check still applies. A child outside the class's ages is a warning ("Ages 7–10. Maya is 5."), not a block.

**Offer the spot** (on each waitlisted child, `[data-waitlist-actions]`):

- `offerSpot` creates a `waitlist_offer` that ends after `OFFER_HOURS` (48) and emails the parents: "A place opened in <class>. Sign up by Wed, Oct 21 at 3:15 pm to take it.", with `/enroll/<sessionId>?offer=<offerId>`. Logged like a staff email (kind `family`), plus `admin.waitlist.offer`. One open offer per child at a time.
- The waitlist shows "Offered Oct 19, 2026, expires Wed, Oct 21 at 3:15 pm" and **Withdraw offer** (`withdrawOffer`, `admin.waitlist.withdraw`). An offer past its time is marked `expired` when anything reads it (`expireOffers`; no scheduled job) and shows "Expired: offer to the next family"; the child can be offered again.
- **The family's side:** while the offer is open and a place is free, the family can pick that child on `/enroll/<sessionId>`, even when the class shows as full or waitlist-only (`offeredStudents` and `placesFree` in `family.ts`, checked by `checkPicks` and `priceOrder`). The open offer is the permission; the `?offer=` link only adds the note ("A place is held for Olive until …", or "This offer has ended… Olive is still on the waitlist", or "Sorry, the place … has been taken"). The first family to pay gets the place: offers don't hold places at checkout.
- **When they pay,** `fulfillOrder` turns the waitlist enrollment active (the same row: one enrollment per child and class) and marks the offer `accepted` with the order id (`waitlist_offer.accepted` in the audit log).
- **Today's "Waitlist openings"** leaves out places with an open offer (`openOfferCounts`).


## 15. Staff roles and teachers (Phase 2 foundation)

**Roles** (`src/server/staff.ts`):

| Role | Who | Sees |
|---|---|---|
| `owner` | every email in `ADMIN_EMAILS` (always, and can't be changed or turned off on the site), and anyone added as an owner in Settings → Staff | everything |
| `teacher` | added as a teacher in Settings → Staff, and not turned off | the teacher app (`/admin/teach`) for their own classes and their substitute dates; nothing else |
| none | families, people turned off, signed-out visitors | the Staff only panel (404) on any staff page, or the sign-in |

- **`Astro.locals`:** `staffRole` (`'owner' | 'teacher' | null`), `staffId` (their `staff` row) and `isAdmin` (still means owner, so every Phase 1 page is unchanged). Set by `readSession` in the middleware: one more query per staff request.
- **`roleFor(person, row, adminEmails)`** is the pure rule; **`staffMember(person)`** reads the table and gives an `ADMIN_EMAILS` owner a row the first time they're seen (named from their account, else their email; they can change the name in Settings), so owners can be put on classes too. **`isOwner(person)`** is for server functions that change money (`adjustments.ts` uses it, so an owner added on the site can give discounts).
- **The checks:** `requireStaff` (owners) on every owner page and endpoint; `requireTeacherOrOwner(locals)` → `{ staff: { …user, role, staffId } | null, response }` on teacher-app pages, with `<AdminShell teachers>`. A teacher at `/admin` is sent to `teachHome()`. A teacher at any owner page (a class's page included, even their own class) gets the Staff only panel with "Go to your classes".
- **What a teacher may see, and the teacher app must enforce:** before showing a class, `canTeach(staffId, sessionId, date)`. For those classes: the roster with badges, care details on tap (log views with `audit`, as `classRoster` does), emergency contacts and pickup people, parents' names with Call and Text. Never payments, other classes, reports, downloads, the editor or search across families. Owners pass every check through their own pages and don't need `canTeach`.
- **Turning someone off** (`staff.active = false`): their role is gone at their next request; their records stay. They can be turned back on.

**Teachers on classes** (`src/server/teachers.ts`), all by `staff.id`:

| Function | Returns |
|---|---|
| `teacherSessions(staffId, date, catalog?)` | `TeachingSession[]`: the classes they teach (`as: 'lead' \| 'assistant'`, if the class meets that date) or cover (`as: 'cover'`, `coveringForStaffId`) on that date, by start time, with `dayOff` (a `closure` reason) or null. Empty for someone turned off |
| `canTeach(staffId, sessionId, date)` | Their own class on any date, or a class they cover on that date. False when turned off |
| `classTeachers(sessionId)` | `{ staffId, name, email, role, active }[]`, leads first |
| `coversFor(sessionId, date?)` | Substitutes for a class (one date, or all), with who they cover for |
| `teacherClasses(staffId, catalog?)` | Every class they're on, with the content's program and session |
| `meetsOn(session, date)` | The class meets that date by its days and dates (days off not counted) |

The content's `session.teacher` text stays the public name on the site. Settings → Staff shows it next to each class ("On the site: …").

**Settings → Staff** (`src/server/staff-settings.ts`; pages `src/pages/admin/settings/`): owners only; changes need a fresh sign-in (until then the page shows "Confirm it's you"). The list (name, email, role, number of classes, can sign in); **Add a person** (name, email, Teacher or Owner; nothing is emailed); each person's page: name and role, **Classes they teach** (per current or upcoming class: Not teaching / Teaches / Assists), **Substitute dates** (class, date it meets, optionally who they cover for), **Turn off** / **Turn back on**. Owners can't turn themselves off or drop their own owner role. Audit: `admin.staff.add`, `.update`, `.deactivate`, `.reactivate`, `.class_add`, `.class_role`, `.class_remove`, `.cover_add`, `.cover_remove` (entity `staff`, the class and date in `detail`). Later settings pages go under `/admin/settings/` with a tile on `settings()`.

**The teacher app's home** (`/admin/teach`) is a placeholder: "Hi, <first name>", today's classes (`teacherSessions`, with Assisting / Substitute / Day off), and "Classes you teach". `?on=YYYY-MM-DD` picks the day in development.

## 16. Data for Phase 2 (migrations `0011_phase2` and `0012_phase2_extras`)

Every table Phase 2 needs is in these migrations, so later units don't add migrations. `0012` adds four columns the coordinator found missing before wave 2 (marked below). Types are exported from `src/server/db/schema.ts` (`Staff`, `Attendance`, `NewAttendance`, …). "By" columns are user ids (`locals.user.id`), as elsewhere; class assignments and favorites use staff ids. Session and show ids are the content's ids (no foreign key, like `enrollment.session_id`).

| Table / column | Holds | Used by | Must respect |
|---|---|---|---|
| `staff` | email (lowercase, unique), name, role, active, created by | foundation | Never delete a row; turn it off. `ADMIN_EMAILS` overrides it |
| `class_teacher` | session, staff, `lead` / `assistant` (primary key session + staff) | foundation, teacher app, calendar (teacher schedules), reports | Removing a person's class deletes the row; turning them off keeps it |
| `class_cover` | session, date, covering staff, covering for (optional), created by; unique per session, date and staff | foundation, teacher app (substitutes) | Only dates the class meets (`meetsOn`); access that day only |
| `session.shared_device` | "This is a shared device" | foundation | Set only through `markSharedDevice` |
| `attendance` | one row per child, class and date: status `present` / `absent` / `late` / `left_early`, `reason` (an absence reason from Settings), `note` (short), enrollment or drop-in, marked by and at (`marked_at` is the phone's tap time); `client_id` unique | teacher app; reports (attendance, absences, missed two in a row) | Upsert on (session, date, student). A replayed tap whose `client_id` exists changes nothing; apply a change only when its `marked_at` is newer than the row's. Refuse dates with a `closure`, and dates the teacher can't teach. Notes are never care details |
| `class_report` | "attendance done" for a class and date: submitted by and at, an optional note to Hannah; unique per session and date | teacher app; Today / dashboard (attendance taken) | Submitting twice updates the row. `note_read_at` / `note_read_by` (0012): an owner marked the note read, and it leaves Today |
| `closure` | a day off: date, session (null = every class that day), reason, created by, `adjusted_at` / `adjusted_by`; unique per date and session | calendar; teacher app (blocks attendance) | The charge adjustment is a `billing_adjustment` with `closure_id` set (made through `adjustments.ts`, not a new billing path); set `adjusted_at` when done; deleting a day off should remove those adjustments first |
| `billing_adjustment.closure_id` | the day off a discount was made for | calendar | Set null if the day off is deleted |
| `drop_in` | one class date booked for a child: session, date, student, household, price in cents at booking, order (the payment), `pending` / `booked` / `cancelled`, `cancelled_at`; `no_charge_reason` and `cancel_reason` (0012); one booking per child, class and date while booked | drop-ins; teacher app (on the roster that day, `attendance.drop_in_id`); reports | Price from the site setting at booking, stored here; never recomputed. `pending` while a checkout or pay link is open: it holds no place and is ignored everywhere but its own checkout. The payment is an `order` with its own plan, `drop_in` (`order.plan` is plain text, so adding a value needs no migration). Not counted toward the 15% family discount. Read it through `src/server/class-day.ts` |
| `tag`, `student_tag`, `household_tag` | a name and kind (`child` / `family`; unique per kind, any case); the joins, with who added them | tags | Staff only; never shown to families or teachers unless the unit decides so |
| `skill`, `student_skill` | skills per program (slug, name, order, active); a child's `working` / `got_it`, marked by and at | skills | Retire a skill (`active = false`) rather than delete it, so progress stays |
| `progress_note` | a note to a family about one child: body, class (optional), author, `shared_at` (families see it once set), the email that carried it (`message_id`) | skills (progress notes) | Staff only until shared |
| `show_cast` | a child's role in a show (event slug), optional group, order, created by; unique per show, child and role | shows | Photo permission comes from `student.photo_consent`, never copied here |
| `show_rehearsal` | a show's rehearsal: start and end (instants; enter and show them in Athens time), location id, note, the classes that rehearse (`session_ids`, empty = whole cast) | shows, calendar | |
| `credit` | money a family is owed: amount, reason, show to family, created by; `applied_to_installment_id`, `adjustment_id`, `applied_at` once used; `removed_at` / `removed_by` | refunds and credits | Comes off the next charge through `adjustments.ts` (a `billing_adjustment`, linked by `adjustment_id`), so the billing run is unchanged. Applied once |
| `refund` | money given back through Stripe: order or installment, amount, reason, `stripe_refund_id` (unique), `pending` / `succeeded` / `failed`, error, created by | refunds | Write `pending` first and use the row id as Stripe's idempotency key; fresh sign-in; never more than was paid less earlier refunds |
| `report_favorite` | a staff member's starred report keys | reports | |
| `staff_setting` | key → JSON value, updated by | settings (email wording, drop and absence reasons) | The owning unit documents each key's shape here |
| `enrollment.cancelled_at`, `enrollment.drop_reason` | when a child dropped (set by Remove), and why | settings (drop reasons), reports (drops) | Cleared when the child signs up again (`fulfillOrder`). Older cancellations have no date |

## 17. One class date (`src/server/class-day.ts`)

Shared by the teacher app, the calendar and drop-ins, so all three agree on days off and who's expected. Read-only, with no children's details (names and care details come from the audited roster reads). Units may add to the file; keep these signatures.

| Function | Returns |
|---|---|
| `dayOffFrom(daysOff, sessionId, date)` | Pure: the day off for that class and date, its own first, then an every-class one; or null |
| `daysOffBetween(from, to)` | `DayOff[]` (`{ id, date, sessionId, reason }`), by date, every-class ones first |
| `dayOffOn(sessionId, date)` | The day off that applies, or null. Attendance and drop-ins are refused then |
| `classDates(session)` | Each `meetings(session)` date with its day off, if any. Prices and `meetings()` never change for a day off |
| `dropInsOn(sessionId, date)` | `BookedDropIn[]`: booked only (not `pending` or `cancelled`), oldest first |
| `dropInCounts(from, to, sessionIds?)` | `` `${sessionId} ${date}` `` → booked drop-ins |
| `classDay(program, session, date)` | `ClassDay`: `meets`, `dayOff`, `enrolled` (active and trial, as the roster stands), `dropIns`, `expected`, `capacity`, `placesLeft` |
| `classDayFrom(input)` | Pure half of `classDay` |

`teacherSessions` (§15) takes its `dayOff` from `dayOffFrom`.

## 18. Calendar and days off

Hannah's class calendar and days off (Studio Director's class calendar and each class's dates). The guide for Hannah is `staff-billing.md` → "Days off".

**The calendar** (`/admin/calendar`, `src/server/calendar.ts`; owners). In the top bar after Classes, and in the phone menu (not a tab).

- **Month** (the default): a grid, Sunday to Saturday, on a computer; at 760 px and narrower the same month as a list of the days with something on them. Each class shows its start time, title and "8/12" (enrolled and trials, of the places); events from the content are yellow; a day off for every class is a red band with the reason, and a class with its own day off is struck through. Today has a purple outline. Arrows and a month box, as on Payments.
- **Week** (`?view=week&week=YYYY-MM-DD`, any date in the week): the seven days as a list, each class with its class page (`classPage`) and that date's attendance roster (`classDayRoster`).
- **Filters:** program (slug), location (id), teacher (a name: Settings → Staff's `class_teacher`, leads first, else the content's teacher). Events are hidden when filtering by teacher.
- **Downloads** (a fresh sign-in): `calendar.csv` / `.pdf` with the month and filters: the **Daily Class Schedule** (Date, Time, Class, Location, Teacher, Students, Day off) and with `report=classes` the **Class Schedule** (Class, Time, Location, Teacher, Students, Classes, Dates, Days off). Audit `admin.download.csv|pdf`, entity `list`, id `calendar-daily|calendar-classes`, the month in `detail`.
- **Functions:** `calendarRange(content, from, to, filters)` → `{ days: CalendarDay[], options }`; the pure `calendarDays(data, dates, filters, content)` (`CalendarDay` = `{ date, dayOff, entries: CalendarEntry[] }`, an entry has `kind`, `time`, `title`, `places`, `teacher`, `sessionId`, `href`, `rosterHref`, `dayOff`); `monthGrid`, `calendarWeek`, `teachersBySession`; `dailyScheduleTable`, `classScheduleTable`.

**A class's dates:** the class page has a **Dates** part: every `meetings(session)` date (`classDates`), days off struck through with "No class: <reason>", past dates greyed, "N classes left" (from today, days off not counted), and **Add a day off**, which opens Days off with the class ticked.

**Days off** (`/admin/settings/days-off`, `src/server/days-off.ts`; owners; a tile on Settings).

- **Add:** a date or a range (up to 31 days), every class or some (current and upcoming classes), and a reason (up to 80 characters; families see it). "Check what changes" is a GET (`?step=check&from=&to=&which=&class=&reason=`), so the fresh sign-in can return to it.
- **The preview** (`previewDayOff(staff, catalog, request)` → `DayOffPlan`): `classes` (each class and date, children, `refused` when attendance was taken), `alreadyOff` (left as they are), `lowered` (each monthly payment: before, after, each date's one-class amount, `later` when locked), `alreadyPaid` ("give a credit": a paid month, one being charged right now, or the month paid at sign-up), `noChange` (paid the season up front, pays by the session, free first class, no charge, payments stopped), `dropIns` (booked; "cancel and refund in Stripe for now"), `blockers`. The pure half is `planDayOff(data)`.
- **The choice:** "Lower that month's payments by one class" or "Don't change payments", with no default, then Save (fresh sign-in). `addDayOff` works the plan out again inside one transaction and refuses when there are blockers (attendance taken; an every-class day off already there).
- **Rows:** one `closure` per date (every class: `session_id` null) or per class and date. Rows added together share `created_at`; the list shows them as one, and Remove removes them together. "Lower" sets `adjusted_at` / `adjusted_by` on each row; "Don't change" leaves them null: that is how the choice is kept.
- **One class's worth** (`oneClassCents`): the month's `installment.base_amount_cents` (the 15% family discount in it, Hannah's discounts not) ÷ `classDaysInMonth(session, month)` (now exported from `pricing.ts`: every time the class's weekdays fall in that calendar month), rounded up to the cent. $95 for four Thursdays: $23.75; $95 for five Tuesdays: $19.
- **The adjustment:** one `billing_adjustment` per family's order and date: `amount`, `once`, on **that month's** installment (`installmentId`), reason "Day off Nov 26 (Thanksgiving)", shown to the family, `closure_id` set. It's made through `insertAdjustments(tx, staff, inputs, now)` in `adjustments.ts` (which `addAdjustment` now uses too), so it applies after Hannah's discounts, never below $0, and a locked payment (the pay-now form open) catches up at the billing run (`reapplyPendingAdjustments`). A payment being charged right now isn't adjusted; it's listed under "Already paid".
- **Email:** one per family (all parents together), for dates from today on: "No class Dec 8", each child, class and date, and when their payment changed, "your December payment is now $36 (was $55)". Audit `admin.day_off.email` (entity household).
- **Remove** (`previewRemoval`, `removeDayOff`): the payments that go back up, then confirm. Only the group's adjustments on payments still `scheduled` or `failed` are removed (and those payments re-applied); paid ones stay, with their adjustment kept. Families aren't emailed. The `closure` rows are deleted (`billing_adjustment.closure_id` goes null on any kept ones).
- **The list** (`daysOffList(catalog, today)` → `{ upcoming, past }` of `DayOffGroup`): dates, classes ("Every class" or titles), reason, what was done ("Lowered 2 payments by $35.15 in all" / "Payments not changed"), who, the families with "Already paid, give a credit", and Remove.
- **Audit:** `admin.day_off.add` and `admin.day_off.remove` (entity `closure`, the date and class in `detail`), `adjustment.add` / `adjustment.remove` (`detail` "day off"), and `admin.day_off.credit_due` (entity `order`, the closure id in `detail`): the record of payments already made, for the credits unit.

**Elsewhere:**

- **Today:** a day off for every class today shows "No classes today: <reason>" with the next classes; a class with its own day off shows "Day off: <reason>". `TodayClass` has `sessionId` and `dayOff` (the reason or null): leave closed classes out of "Not taken".
- **Families:** the account's "Coming up" shows "No class Nov 26 (Thanksgiving)" for each day off to come, and "Next" skips them; a lowered month shows "Day off Nov 26 (Thanksgiving): −$23.75". The class's public page lists "No class …" under each date shown. Both calendar files (`/calendar/<id>.ics`, the account's) leave days off out (`EXDATE`, `classCalendar`'s `skip`).
- **Unchanged:** prices, `meetings()`, proration and a new family's first month never change for a day off. The attendance and drop-in refusals read `dayOffOn` (§17).
