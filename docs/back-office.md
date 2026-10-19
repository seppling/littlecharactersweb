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
| `classDropIns(sessionId)` | `/admin/classes/<id>/drop-ins` | A class's Drop-ins list (on its page; the address redirects there). Pass to `downloads()` for `drop-ins.csv` and `.pdf` (§20) |
| `search(q?)` | `/admin/search?q=` | Search (placeholder) |
| `family(householdId)` | `/admin/families/<id>` | A family's page (§10) |
| `familyEmail(householdId)` | `/admin/families/<id>/email` | Email this family (§13) |
| `familyLists()` | `{ children, contacts, notes }` | The family downloads' list paths, for `downloads()` (§10) |
| `payments(show?, month?)` | `/admin/payments`, `?show=failed` or `upcoming`, `?month=2026-10` | Payments (§11) |
| `paymentsOrder(orderId)` | `/admin/payments/<id>` | One family's payments for a class |
| `refundPage(orderId, installmentId?)` | `/admin/payments/<id>/refund?installment=` | Refund one payment (§21) |
| `creditsPage(householdId)` | `/admin/families/<id>/credits` | A family's credits (§21) |
| `familyStatement(householdId, year)` | `/admin/families/<id>/statement?year=` | Pass to `downloads()` for the yearly statement (§21) |
| `leads()` | `/admin/leads` | Messages & sign-ups |
| `content()` | `/admin/content` | The website editor |
| `install()` | `/admin/install` | Put the app on your phone (teachers too) |
| `settings()` | `/admin/settings` | Settings: a tile per settings page (§15) |
| `settingsStaff()` | `/admin/settings/staff` | Settings → Staff (§15) |
| `settingsStaffMember(staffId)` | `/admin/settings/staff/<id>` | One staff member: role, classes, substitute dates, turn off (§15) |
| `teachHome()` | `/admin/teach` | The teacher app's home (§18) |
| `teachRoster(sessionId, date, on?)` | `/admin/teach/<id>/<YYYY-MM-DD>` | One class date: roster and attendance (§18); the calendar links to it |
| `teachMe()` | `/admin/teach/me` | The teacher app's Me tab (§18) |
| `classAttendance(sessionId)` | `/admin/classes/<id>/attendance` | A class's attendance, for `downloads()` (CSV and PDF only, §18) |
| `calendar(month?, params?)` | `/admin/calendar?month=2026-11` (`view=week&week=`, `program`, `location`, `teacher`) | The calendar (§19) |
| `settingsDaysOff(sessionId?)` | `/admin/settings/days-off` (`?class=<id>&which=some` pre-fills a class) | Settings → Days off (§19) |
| `shows()` | `/admin/shows` | Shows: each show's cast and rehearsals (§23) |
| `show(slug)` | `/admin/shows/<slug>` | One show: cast, roles, rehearsals. Pass `` `${show(slug)}/program` `` or `/cast-sheet` to `downloads()` (§23) |
| `showEmail(slug)` | `/admin/shows/<slug>/email` | Email the cast (§23) |
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
- **Phone (760 px and narrower):** the page title with the optional back link and a Menu button at the top; a tab bar at the bottom: Today, Classes, Search, Alerts. The current tab follows the address (a family's page lights Search). The menu holds Take attendance (the teacher app, §18), Families, Payments, Messages & sign-ups, Website, Settings, "Put the app on your phone" and Sign out.
- **Teachers** get a smaller shell: one section, "Your classes" (`teachHome()`), no search; on a phone, two tabs, Today and Me (`.teach-tabs`), and the menu holds only "Put the app on your phone" and Sign out.
- **Signing out** from any staff page also clears the teacher app's copy of today's classes on that phone (§18).
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
| `drop-in` | Drop-in | neutral | here for that one date: a booked drop-in (§20) |
| `missed2` | Missed the last two | warning | the child's last two marks in this class were Absent (§18) |

The input is yes/no facts (`hasAllergies`, `hasMedicalNotes`, `hasPickupNote`, `restrictedPickup`, `photoConsent`, `firstEnrolledAt`, `trial`, `dropIn`, `missedLastTwo`, `birthdate`), so the notes never reach the HTML. Decrypt with `readStudentNotes`, turn into booleans on the server, and pass only those.

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
- **A service worker for the teacher app only** (`public/admin/teach-sw.js`, scope `/admin/teach`; §18). The rest of `/admin` and the family site have none and are never cached. Chrome's install criteria don't ask for one (web.dev, "What does it take to be installable?", updated September 2024: HTTPS, a manifest with a name, 192 and 512 px icons, `start_url` and `display`, and some engagement).
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
| `attendance` | warning | a class date with children expected and no `class_report`: today's once the class ended 2 hours ago, or any in the last 7 days; not on a day off. One item per class date (§18) | `teachRoster` |
| `missed2` | warning | a child absent at their last two marked dates in a current class; one item per child (§18) | `family` |
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

**The teacher app** (`/admin/teach`) is §18.

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

## 18. The teacher app (Phase 2)

Teachers take attendance on their phones, with or without signal, and send Hannah a note. Data and rules in `src/server/attendance.ts`; the phone side in `src/scripts/teach.ts` and `public/admin/teach-sw.js`.

**Pages** (all `requireTeacherOrOwner`, `<AdminShell teachers section="teach">`):

- **Today** (`teachHome()`, `src/pages/admin/teach/index.astro`): "Hi, <first name>", then one card per class today (`teachCards`): time, class, location, "12 children" (`classDay(...).expected`), "Assisting", "Covering for <name>" (or "Substitute"), "<Sub> is covering", and a chip: **Not taken**, **Saved on this phone, sending…** (taps on this phone not sent yet) or **Done ✓** (a `class_report`). A day off is a grey card, "No class: <reason>", with no link. No classes: "No classes today" and "Your next class is …" (`nextTeachingDay`). **This week**: the next 7 days' classes, each opening its roster (read-only). **Classes you teach** below. Owners see every class meeting today; their week is their own classes. The app icon's badge counts today's classes not done (`navigator.setAppBadge`, where supported).
- **A class date** (`teachRoster(id, date)`, `src/pages/admin/teach/[sessionId]/[date].astro`): class, date, time, location, "Present 9 of 12", **Mark all present**; the safety strip ("2 allergy or medical · 1 pickup note"; a tap shows only those children, and back); one row per child expected (`teachRoster`): initials, "Maya R.", badges, a Present / Absent toggle (48 px), **More** with Late, Left early and a short note (200 characters); a tap on the name opens the child's sheet (a `<dialog>`): allergies and medical (red), who may pick up, parents with **Call** and **Text**, emergency contacts, photos. Nothing about payments or addresses. Then **Note to Hannah** and **Submit attendance** (until everyone's marked: "Mark everyone first (2 left)"); after: "Done ✓ Hannah has it." and **Send changes**. Read-only states say why: "No class today: <reason>", a future date, "<Sub> is covering", "Attendance was sent … Ask Hannah", or closed (more than 7 days ago).
- **Me** (`teachMe()`): who's signed in, Sign out, what "This is a shared device" does, "Put the app on your phone".
- `?on=YYYY-MM-DD` sets "today" on all three and on the sync endpoint in development only (`devDay`).

**Who sees what** (`teachAccess`, pure; `classDateFor` reads what it needs):

| Who | Sees | Marks |
|---|---|---|
| Owner | any class, any date it meets | any date up to today |
| Teacher (lead or assistant) | their classes, any date they meet (`canTeach`) | today; a missed date up to 7 days back (`LATE_DAYS`) until it's submitted; after submitting, changes on the class's own day only |
| Substitute | that class on their cover date only | that date, as above |
| The regular teacher on a cover date | read-only, "<Sub> is covering" (the cover names them, or names nobody and they're the lead) | no |
| Anyone else, a turned-off teacher, a date the class doesn't meet | the Staff only panel (404) | no |

Nobody marks a day off (`dayOffOn`) or a future date. The server applies the same rule to every tap.

**Who's expected on a date** (`expectedOn`): active and trial enrollments, booked drop-ins (`dropInsOn`, §17), and anyone already marked that date. `teachRoster` reads them with care details decrypted (`readStudentNotes`) and writes `teach.roster.view` (or `teach.roster.cache` when the phone stores it for offline) with the date in `detail`.

**Taps and submitting** (`POST /api/teach/sync`, JSON `{ by, taps, reports }`):

- A tap is `{ clientId, sessionId, date, studentId, status, note, markedAt }`; `status` is `present`, `absent`, `late` or `left_early` (Late and Left early count as there). A report is `{ clientId, sessionId, date, note, at }` (the note to Hannah, up to 2000 characters).
- `saveTaps`: idempotent. A `client_id` already saved → `same`; the child's row has a newer `marked_at` → `older` (one upsert on (class, date, child) with `marked_at < excluded.marked_at`); else `saved`. The phone's time is held to the server's now. Refused: no access, a day off, a closed date, a child not expected (`refused` with `why`). A change to an existing mark writes `teach.attendance.change` (entity `student`, `detail` "<class> <date>: absent → present"). Tapped on the class's day and sent the next morning still counts as that day.
- `saveReports`: one `class_report` per class date. Submitting again updates it (`teach.attendance.resubmit`); an older submission arriving late changes nothing; a changed note clears `note_read_at`, so it shows on Today again.
- Responses: 401 signed out (the phone keeps the taps), 409 when `by` isn't the signed-in person (taps made by someone else are never saved under them), 403 non-staff or another site's origin.

**Offline** (`src/scripts/teach.ts`, `public/admin/teach-sw.js`):

- Each tap goes to IndexedDB (`lc-teach`: `queue` of unsent taps and submissions, `marks` for the newest mark seen per child, `meta.who`), then is sent: on the tap, when the app opens or comes back to the front, on `online`, every 20 s while something waits, and by Background Sync (`teach-sync`) where the browser has it (Android; iPhones don't).
- The status line: "Saved on this phone · sending when you have signal", "All sent ✓", "Saved on this phone · sign in again to send", or "Not saved: … Ask Hannah." for a refused tap.
- The service worker (scope `/admin/teach`) fetches pages from the network first (4 s, then the saved copy) and keeps a page only when it sends `X-Teach-Cache: <today in Athens>`: the home page and today's rosters the person teaches or covers (an owner's only when they're on that class). The home page asks it to store today's rosters ahead (`X-Teach-Prefetch: 1`). It also keeps the pages' own scripts, styles, fonts and icons. Pages from another day are dropped. Cache keys are addresses (ids), never names.
- Cleared: on sign-out from any staff page (AdminShell), when a signed-out page comes back (`X-Teach-Signed-Out`), when another person opens the app on the phone (`claimPhone`), and the next day. Unsent taps stay until their person signs in again (dropped after 8 days); the session stays in its HttpOnly cookie, never in the cache.

**What Hannah sees:**

- **Today:** "Attendance done ✓" on a class with a report, "Not taken" once a class has ended without one (`attendanceState`), nothing before; **Notes from teachers** ("Note from <teacher>: …", linking to the roster) until **Mark read** (`POST /api/teach/note-read`, `markNoteRead`, `admin.attendance.note_read`); a **Take attendance** tile and menu link.
- **Needs attention:** `attendance` and `missed2` (§12), from `attentionAttendance(today)` (reports, days off and drop-ins over the last 7 days; `missedTwo` over 60 days).
- **A class's page:** **Attendance**: each date so far (and any later date already marked), newest first: "9 of 12 present · taken by <teacher>", "Not taken", or "No class: <reason>", each opening that date's roster. Downloads (fresh sign-in; `admin.attendance.csv|pdf`): a row per child, a column per date (P, A, L, LE), Present and Absent totals (`attendanceTable`, `attendancePdf`, "Attendance: <class>").
- **Rosters and the family page:** the `missed2` badge; the family page adds "Missed 2 classes this season" per child (`childAttendance`, the current term).

**Substitutes:** adding a cover in Settings → Staff (`addCover`) emails the substitute ("You're covering <class> on <date>") and, when Hannah said whom they cover for, that teacher ("<Sub> is covering <class> on <date>"), each with a link to `/admin/teach` (`sendCoverEmails`). A failed email doesn't undo the cover.

**Not built here:** push reminders ("Attendance not taken"), absence reasons (`attendance.reason`, from Settings later), children's photos on the roster (initials only).


## 19. Calendar and days off

Hannah's class calendar and days off (Studio Director's class calendar and each class's dates). The guide for Hannah is `staff-billing.md` → "Days off".

**The calendar** (`/admin/calendar`, `src/server/calendar.ts`; owners). In the top bar after Classes, and in the phone menu (not a tab).

- **Month** (the default): a grid, Sunday to Saturday, on a computer; at 760 px and narrower the same month as a list of the days with something on them. Each class shows its start time, title and "8/12" (enrolled and trials, of the places); events from the content are yellow; a day off for every class is a red band with the reason, and a class with its own day off is struck through. Today has a purple outline. Arrows and a month box, as on Payments.
- **Week** (`?view=week&week=YYYY-MM-DD`, any date in the week): the seven days as a list, each class with its class page (`classPage`) and that date's attendance roster (`teachRoster`).
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

## 20. Drop-ins (`src/server/drop-ins.ts`)

A child comes to one class of a weekly class and pays for that date. Hannah's guide is in `staff-billing.md` → Drop-ins. Not the same as Geode's "drop-in nights" (one-date sessions with their own price).

**Which classes and what price.**
- `dropInPrice(site, program, session)` → cents, or null when the class takes none: weekly classes only (`isWeeklyTuitionClass`: not camps, workshops, parties, Parents' Night Out, Ovation or one-date sessions), not registration elsewhere (`externalUrl`), not `coming-soon` or `closed`, and not when the site setting is off or the session's `dropIn.off` is ticked.
- **The price** is the session's own (`session.dropIn.price`, dollars) or the site's (`site.dropIns`: **$25, a placeholder Hannah will confirm**). In the content, both are dollars like every other price (`SiteSettings.dropIns = { price, open }`, a money field and a tick box in Site settings → Drop-ins, with the help line "The price of one class for a drop-in. Families see it on weekly classes."; the session's group sits beside its price in the editor). `SiteInfo.dropIns` turns it into `{ priceCents, open }` (`dropInSetting`; a price that isn't a sensible amount closes drop-ins).
- **No discounts:** no 15% family discount, no pay-in-full discount, no late fee. A drop-in isn't an enrollment, so it never counts toward the family discount (`countingEnrollments` reads enrollments only; unit-tested).

**Where families see it.**
- **The class's page:** "Drop in for one class · $25", a quiet link under the sign-up button, for the date picked above it; one per class past its sign-up cut-off but still running. Shown when `dropInsOffered`: the class takes drop-ins, has started or starts within 14 days (`DROP_IN_LEAD_DAYS`), and has a class ahead.
- **The family account:** upcoming drop-ins under "Coming up" (`[data-drop-ins]`), and "Drop in for one class" (`dropInClasses`): the weekly classes taking drop-ins that not every child of theirs is in. Paid drop-ins appear in Payments as their order line.

**The flow** (one child and one date per checkout; "Book another date" after paying):

| Step | Address | What happens |
|---|---|---|
| 1 | `/drop-in/<sessionId>` | Sign in or make an account and add a child, as enrollment does. Pick a date (`dropInDates`: the class's meetings ahead, today's only until it starts; a day off says "No class that day", a full date "Full") and a child (one already enrolled or on a trial in the class is greyed out; outside the ages as enrollment). `startDropIn` checks again and makes the order (`plan: 'drop_in'`, `draft`, one line "Drop-in: Intro to Theater, Tue, Oct 20 (Ava)", total = price, no discount) and a **`pending`** `drop_in` row with the price and the order. It holds no place |
| 2 | `/enroll/details?order=` | The enrollment's details step: care details and the family's part when not on file, and the drop-in policies. Then step 3 |
| 3 | `/drop-in/pay?order=` | `readyDropIn` checks the date (ahead, not a day off, not full) and the child again and sets the order `pending_payment`; then the existing embedded checkout (`createEmbeddedCheckout`, `saveCardForMonthly: false`). Signed out (a staff pay link), it shows the sign-in first. Without Stripe keys, the test-payment button |
| 4 | `/drop-in/confirmation?order=` | Stripe returns to `/enroll/confirmation`, which sends drop-in orders here. The class, date and time, place, how to arrive (`arrivalLines` with the site's parking), "Book another date" |

- **Paying:** `fulfillOrder` hands a `drop_in` order to `fulfillDropIn` after its usual amount check. Whoever claims the order first (webhook or confirmation page) marks it paid and the row **`booked`**, once (`drop_in.booked` in the audit log), and sends the email "Drop-in booked: <class>" to the parents. A date that filled up meanwhile is **booked anyway** and shows to staff as **Over the limit**. A pay link staff cancelled but the family paid anyway is booked too. A second payment for a child already booked that date is kept `cancelled` with `PAID_TWICE` for a refund.
- **Abandoned checkouts** leave their row `pending`, which everything ignores (class-day helpers, rosters, counts, the family's lists). Unpaid `draft` orders are never shown.
- `/enroll/review` and `/enroll/pay` send a drop-in order to `/drop-in/pay`.

**On the class's page** (`classPage`), owners only:
- **The roster for a date:** "Drop-ins on <date>" (`?date=YYYY-MM-DD`, any of the class's dates; the next class by default, `rosterDate`) adds that day's drop-ins to the roster with the **Drop-in** badge and their care details (`dropInRoster`, logged as `admin.roster.drop_ins` with the date). They have no Remove; they're cancelled under Drop-ins. The heading counts them: "Roster (8 + 1 drop-in)".
- **Drop-ins** (`[data-drop-ins]`, `classDropIns`): "Coming up" and "Past", each with date, child (and **Over the limit**), family (to their page) and **Paid** (`dropInStatus`: "Paid $25", "No charge: <reason>", "Pay link sent, $25 not paid yet", "Cancelled: <reason>"). A family's unfinished checkout isn't listed; a staff pay link is (a pending row made by someone outside the family). **Cancel** asks for a reason (`cancelDropIn`: `cancelled`, `cancelled_at`, `cancel_reason`; `admin.drop_in.cancel` with the date and reason) and says "Refund it in the Stripe dashboard for now" until the refunds unit. Downloads `drop-ins.csv` / `.pdf` (a fresh sign-in; `admin.download.csv|pdf`, entity `list`, id `drop-ins:<sessionId>`): Date, Child, Family, Status, Paid ($), Over the limit. No care details.
- **Add a drop-in** (`[data-drop-in-tool]`), as Add a child (§14): find a child by form post (`findChildren`), then
  - **Send a pay link** (`sendDropInPayLink`): pick a date (not a day off, not full); the order and a `pending` row are made and the parents get "Drop-in: <class>, <date>" with `/drop-in/pay?order=<id>`, sent and logged through `sendMessage` (kind `family`, one-time token) plus `admin.drop_in.pay_link`. It holds no place until they pay.
  - **No charge** (`addDropInWithoutCharge`): a fresh sign-in (back to `?dropAdd=<studentId>`), a date and a reason (up to 300 characters): `booked` at once, price 0, `no_charge_reason`, no order, never a Stripe call; `admin.drop_in.add_no_charge` with the date and reason. A full date needs "If the date is full, add anyway".
  - A child in the class (enrolled or trial), or already booked that date, is refused.
- **The family's page** lists each child's drop-ins (booked and cancelled) under **Drop-ins**.
- **Today** counts the day's booked drop-ins in a class's "8 of 12" (`classesOn`'s optional `dropIns`, from `dropInsToday`).

**For later units.**
- **Reports:** `drop_in.price_cents` is what was charged (0 for no charge) and equals the order's one line and total; a paid order has `plan = 'drop_in'`, `paid_at`, and `student_ids` = the child. Count `booked` rows (and `cancelled` ones whose order is paid, for refunds). Payments received already lists paid drop-in orders ("Drop-in").
- **The teacher app:** `dropInsOn(sessionId, date)` (§17) for who drops in; `dropInRoster` returns them as `RosterChild` with `dropInId` set and `enrollmentId` empty; `attendance.drop_in_id` links a mark to the booking.
- **The calendar:** a day off added on a date with booked drop-ins isn't handled here; list them with `dropInsOn`.
- **Refunds:** a cancelled drop-in with a paid order is the one to refund (`dropInStatus` says "(paid $25)").
- **Test-only:** `POST /dev/drop-in-day-off` (`session`, `date`; staff, development only) adds a day off for `tests/e2e/staff-drop-ins.mjs`.


## 21. Refunds, credits and statements

Hannah refunds and gives credits on the site instead of the Stripe dashboard; families download a yearly statement. Owners only; every change needs a fresh sign-in (`requireFreshStaff` on the whole page). Hannah's guide is `staff-billing.md` → Refunds, Credits, Statements.

**Refunds** (`src/server/refunds.ts`; page `src/pages/admin/payments/[orderId]/refund.astro`, `refundPage()`):

- **A payment** (`Payment`, `loadPayment({ orderId, installmentId? })`, `familyPayments(householdId)`, `orderPayments(orderId)`): a paid order over $0 (a sign-up or a drop-in, key `o-<id>`) or a paid monthly charge over $0 (`i-<id>`), with its `refund` rows and `leftCents`. `via` says how it was paid: `card` (a `pi_` payment or `cs_` checkout), `cash` (marked "Paid by cash/check", `lastError = 'paid outside Stripe'`), `test` (the local stand-in) or `none`.
- **The most:** `refundLeft(paid, refunds)` = paid less pending and succeeded refunds. Checked again in `createRefund`'s transaction with the order's row locked (`for update`), so two refunds at once can't both pass.
- **Card:** the row is inserted `pending`, then the `Refunder` is called (`stripeRefunder` in `stripe.ts`: a sign-up's PaymentIntent is read from its checkout session; `refunds.create` with `metadata.refundId` and idempotency key `refund-<row id>`). Its answer is saved: `succeeded`, `pending` or `failed` (with Stripe's message). Stripe not answering leaves it `pending` with a note; **Try again** (`retryRefund`) sends the same key. The webhook's `refund.updated` / `refund.failed` call `settleRefund` (found by `metadata.refundId`, else the Stripe id).
- **Cash or check:** recorded `succeeded` with no Stripe id ("Record a refund given by cash or check"). **Test payments:** the same, only where `testRefundsAllowed()` (no Stripe keys, never in production).
- **The family's email** (ticked by default): "Refund of $X for <what>", "It takes 5–10 days to reach your card" (cash: "given back by cash or check"). Not sent for a failed refund.
- **Where:** the family's page (**Payment history**, `FamilyMoney.astro`), the order page (**Payments made**), a class's cancelled paid drop-ins (**Refund**), and after a removal ("Refund part of a payment", `?order=` on the notice). Refunded payments show `refundNote()`: "Refunded $25", "Partly refunded: $10 of $25", "(… pending)", there and on the family's receipts. Payments received lists each pending or succeeded refund as its own line, below $0, on the day it was made (`method: 'refund'`, `signedCents`, `receivedCount`), so the month's total is net.
- **Audit:** `admin.refund.add` (entity refund, the amount and method in `detail`), `admin.refund.retry`, `refund.succeeded|pending|failed`, `refund.email`. The reason stays in the row.

**Credits** (`src/server/credits.ts`; page `src/pages/admin/families/[householdId]/credits.astro`, `creditsPage()`):

- **Applied** through `insertAdjustments`: a one-time amount on the family's next payment that can change (`creditTargets`: scheduled or failed, not locked, over $0, earliest due date first, across their orders), labelled for the family `creditLabel()` ("Credit · Day off Dec 8 (Thanksgiving)", or "Credit" for a private reason). The credit row gets `adjustment_id`, `applied_to_installment_id`, `applied_at`. A credit bigger than the payment keeps what fits; the rest is a new row, "Rest of the credit from Oct 19", applied to the next payment (`planCredit` is the pure half, used by the preview).
- **Waiting credits:** `applyWaitingCredits(householdId?)` applies them. Called from `fulfillOrder` after a monthly sign-up makes its payments, and at the start of `runBilling` after `reapplyPendingAdjustments`, before anything is charged. It first puts back to waiting a credit whose payment was cancelled (Stop payments), and splits one a payment shrank under (the family discount started).
- **Remove** (`removeCredit`): a waiting one, or one on a payment not paid yet (its adjustment is removed and the payment re-applied). A paid one, one being charged, or one under an open pay-now form is refused. On the order page, a credit's adjustment links to Credits instead of **Remove**.
- **Lists:** `familyCredits(householdId)` → `CreditRow` with `state` (`waiting`, `applied`, `used`, `removed`) and its payment; `creditStatus()` words it.
- **Audit:** `admin.credit.add` (the amount, or "day off <date>"), `admin.credit.remove`, `credit.applied` (the installment in `detail`), `credit.rest`, `credit.returned`.

**Day-off credits** (`src/server/day-off-credits.ts`): the Days off list shows, under a day off with `admin.day_off.credit_due` entries, each family and date with one class's worth (`oneClassCents` of that month's payment, or the next month's when the first month was paid at sign-up; two classes that day add up), and **Give these credits**. Each is one credit per family and date, reason "Day off Dec 15 (Winter break)", shown to the family, id `dayoff-<closure id>-<household id>`: a second press inserts nothing, which is how they're marked done.

**The yearly statement** (`src/server/statements.ts`): every payment that year (date, child, what, "card ending 4242" read from Stripe per payment, "card" when unknown, or "cash/check"), each refund that year (pending and succeeded), and Total paid, Refunds, Total paid less refunds. The heading: the site's name, HQ's address, the contact email, and the optional `site.statements` (`{ taxId?, note? }`, Site settings → Payment statements; empty lines are left out). `buildStatement` is pure; `statementTable` gives both files the same rows; `pdfResponse` takes a new optional `madeFor` (the family's name).

| Download | Address | Who |
|---|---|---|
| Statement (CSV, PDF) | `downloads(familyStatement(id, year))` | Staff, from the family's page: a fresh sign-in, audit `admin.statement.csv|pdf` (entity household, the year in `detail`) |
| Statement (CSV, PDF) | `/account/statement.csv|pdf?year=` | The family, from their account's **Statements**: their own household only (`householdForUser`), audit `statement.csv|pdf` |

**Families see:** **Credits** in their account ("Credit: −$19, Day off Dec 8 · comes off your Dec 1 payment"), the credit on the payment as discounts show, "Partly refunded" on receipts, and **Statements** with each year they paid in.

**Test:** `tests/e2e/staff-refunds.mjs`, after every other browser test.

## 22. Tags, skills and progress notes

Studio Director's tags, "Class Skills Worksheet", "Student Skills" and "Report Card". Server code in `src/server/tags.ts`, `src/server/skills.ts` and `src/server/progress-notes.ts`; tests in `tests/unit/tags-skills.test.ts` and `tests/e2e/staff-tags-skills.mjs`. Tables as in §16; no migration.

**Links** (`src/lib/admin-links.ts`):

| Function | Address | Page |
|---|---|---|
| `settingsTags()` | `/admin/settings/tags` | Settings → Tags (a tile on Settings) |
| `tagList(tagId)` | `/admin/settings/tags/<id>` | Pass to `downloads()` for the tag's CSV and PDF; the address itself redirects to `searchTag` |
| `tagEmail(tagId)` | `/admin/settings/tags/<id>/email` | Email a tag |
| `searchTag(tagId)` | `/admin/search?tag=<id>` | Search by tag |
| `familyTags(householdId)` | `/admin/families/<id>/tags` | Where the family page's tag forms post |
| `classTags(sessionId)` | `/admin/classes/<id>/tags` | Where a roster's "Tag selected" posts |
| `settingsSkills(programSlug?)` | `/admin/settings/skills?program=` | Settings → Skills (a tile on Settings) |
| `classSkills(sessionId)` | `/admin/classes/<id>/skills` | Pass to `downloads()` for the Class Skills Worksheet; the address redirects to the class page's Skills part |
| `teachSkills(sessionId, date, on?)` | `/admin/teach/<id>/<date>/skills` | The teacher app's Skills view |
| `progressNote(noteId)` | `/admin/progress-notes/<id>` | A note: edit, preview, send, or see what was sent |
| `newProgressNote(studentId, sessionId?, back?)` | `/admin/progress-notes/new?student=&class=&back=` | Write a note |

**Tags** (owners only; never shown to families or teachers).

- **Kinds:** `child` and `family`. A name is 1 to 40 characters, unique per kind in any case (the table's `tag_kind_name_idx`; `createTag` and `renameTag` say so in words first). `findOrCreateTag` is "pick or type a new one": an existing name in other capitals is the same tag.
- **Settings → Tags:** each kind's tags A to Z with how many carry each (`listTags`), Add, Rename, Delete (asks first; the joins cascade, so it comes off everyone). Each row has See who, Email and the CSV/PDF.
- **Tagging:** the family page has the family's tags and each child's (`TagEditor.astro`: ✕ to remove, "Add a tag" with the kind's tags in a `datalist`). A class roster has **Tag children**: tick children (each row's checkbox belongs to the form `tag-selected`), pick or type a tag, **Tag selected** (`tagStudents`; only children of that class count). Redirects carry `?tags=` / `?tagged=` or `?tagError=<code>` (`TAG_ERRORS`), never a name.
- **Showing:** `TagChips.astro` (outlined `.tag-chip`, apart from the badges) on the class roster, the family page and search results. `tagsForStudents(ids)`, `tagsForHouseholds(ids)` → `Map<id, { id, name }[]>`.
- **Filtering:** the roster's **Show** `?tag=<id>` (`withTag`, pure); search by tag (`tagMembers(tag, catalog)` → children with family and current classes, or families with parents, children and classes); **Email a tag** (`tagAudience(tag)` → `AudienceFamily[]`, the families of tagged children or the tagged families).
- **Email a tag** uses the composer (§13) with `kind: 'tag'`: `message.kind` gained `'tag'` (a TypeScript enum on a text column, so no migration) and `message.session_id` holds the tag's id for those rows; `earlierMessages({ tagId })` lists them. Families see these emails in "Emails sent".
- **Downloads** (fresh sign-in; `admin.download.csv|pdf`, entity `list`, id `tag:<id>`): child tag: Child, Age, Family, Current classes; family tag: Family, Parents, Emails, Phones, Children, Current classes (`tagTable`).
- **Audit:** `admin.tag.create`, `.rename`, `.delete` (entity `tag`), `admin.tag.add` / `.remove` (entity `student` or `household`, the tag id in `detail`).

**Skills.**

- **Settings → Skills** (owners): programs (weekly classes first) with their counts; one program (`?program=`): its skills in order (`programSkills(slug, { retired })`), Add (`addSkill`, at the end; names don't repeat in a program, any case), Rename, ↑ ↓ (`moveSkill`, renumbers the active list 0, 1, 2…), Retire (`setSkillActive(…, false)`: progress stays, the teacher's list and the class grid drop it) and Bring back (at the end). Audit `admin.skill.*` (entity `skill`, the program in `detail`).
- **Statuses:** `not_yet` (no `student_skill` row), `working`, `got_it`; `SKILL_LABELS` Not yet · Working on it · Got it.
- **Who ticks** (`skillAccess`, pure; `skillDateFor(viewer, sessionId, date, catalog, today)` reads it): the people of `teachAccess` (§18). A teacher who `canTeach` that class on that date (a substitute only on their cover date; turned off: never) ticks on any date it meets up to today, not a day off; future dates are read-only. Owners open any date the class meets and tick at any time. Being covered or having submitted attendance doesn't matter: skills aren't per date.
- **The Skills view** (`teachSkills`, `src/pages/admin/teach/[sessionId]/[date]/skills.astro`; an **Attendance · Skills** switch, `.teach-views`, sits on both pages): the children expected that date (`expectedOn`, as attendance) by first name, each a card with "1 got it · 1 working on it", and per active skill a three-step control (48 px). No tags and no care details (`skillRoster`, logged `teach.skills.view` with the date). Not cached by the service worker.
- **Saving** needs signal: each tap posts `{ by, sessionId, date, studentId, skillId, status }` to `POST /api/teach/skills` (`setSkill`: access, the class's own active skill, the child on that date's roster; 401/403/409 as `/api/teach/sync`). Offline, the page says "Needs signal to save", keeps the tick on screen and sends it on `online` or every 20 s. A change writes `teach.skill.change` (entity `student`, `detail` "<class> <date> <skill id>: working → got_it").
- **Hannah sees:** the class page's **Skills** part (`ClassSkills.astro`): the grid of enrolled and trial children × active skills (`classSkillGrid`), "Write a progress note" per child, and the downloads `skills.csv` / `.pdf` ("Class Skills Worksheet: <class>", `skillGridTable`, `skillGridPdf`; fresh sign-in; `admin.download.csv|pdf`, id `skills:<sessionId>`). The family page: each child's **Skills and progress notes** (`ChildSkills.astro`, `childSkills(ids, catalog)`): every program they're signed up for that has skills, each skill's status with when and by whom (the name in Settings → Staff first), retired skills only where there's progress.

**Progress notes** (`progress_note`).

- **Drafts** (`shared_at` empty) hold only the note's words. A teacher writes one per child and class from the Skills view ("Note for Hannah", `saveTeacherDraft`, same access as ticking; saving again changes it; `teach.progress_note.draft`). Hannah writes one from the family page or the class grid (`saveDraft`, `admin.progress_note.draft|edit`), or deletes a draft (`admin.progress_note.delete`). The class page lists **Progress notes to send** (`draftsForClass`).
- **Sending** (owners, `src/pages/admin/progress-notes/[noteId].astro`): the note, then the child's Got it and Working on it skills in the note's class (`skillChoices`), each ticked; **Preview** (`?preview=1&got=&work=`, skill ids only) shows the email (`previewNote`: subject "Mila's progress in Intro to Theater", the note with "Got it:" and "Working on it:" lists, the class's footer) and the parents' addresses; **Send** (`sendProgressNote`, the review form's one-time token) sends through `sendMessage` (kind `family`, so it's on "Emails sent"), writes the composed text into `body` and sets `shared_at` and `message_id`. A sent note can't be changed or sent again. Audit `admin.progress_note.send`.
- **Families** see shared notes in their account under the child ("Mila's progress notes", `ProgressNotes.astro`, `sharedNotesFor(householdId)`: their own household, shared only).
- The note box says "Families read this. Leave out medical details".

**For later units:** reports can count `student_skill` by status and program, and `progress_note` with `shared_at` by month. Shows don't use tags (a show's cast is `show_cast`).

## 23. Shows: cast lists, roles, rehearsals (`src/server/shows.ts`)

Each show (the content's events of kind `show`) gets a cast list and rehearsals. Studio Director has nothing for a cast. **No money:** casting charges nothing, because the performance fee is charged at sign-up.

**Shows** (`shows()`, owners; in the top bar after Calendar and in the phone menu, not a tab): the shows coming up (soonest first, undated last), then past ones. Each shows its dates ("Date to come (December 2026)" for a `tba` show), the classes performing (`performers`) and "12 in the cast" (`castCounts`: children, not roles). Functions: `showList(events, counts, content, today)` (pure), `showDatesLabel`, `findShow`, `showUpcoming`.

**A show's page** (`show(slug)`, `src/pages/admin/shows/[slug].astro`):
- **Cast** (`castList(slug)` → `CastRow[]`, by `position`): each child with role, group, number in the order, and photo permission read from `student.photo_consent` (`photoPermission`: `yes` / `no` / `not-asked`, the badge "Photos: yes", "No photos", "Photos: not asked"; never copied into `show_cast`). Role and group are edited in place (`updateCast`; one child can't have the same role twice). ↑ and ↓ swap with the neighbor and renumber positions 0, 1, 2… (`moveCast`). **Another role** adds a row for the same child with an empty role (`addToCast`); **Remove** takes off one role (`removeCast`). The child's name links to their family's page.
- **Add to the cast:** the performing classes' current sessions first (`performingSessions(event, content, today)`: the performing programs' staff sessions not ended by today; for a past show, the ones running on its first date), with each enrolled or trial child (`castSuggestions`) and **Add everyone from <class>**. **Find any child by name** (a form post, `findForCast`, the staff search). New rows go at the end, with an empty role.
- **Copy emails / Copy phone numbers** of the cast's families, and **Email the cast** (`showEmail(slug)`): the Phase 1 composer with `castAudience(slug)`. The messages are logged as kind `class` with `session_id` = `showMessageKey(slug)` (`show:<slug>`), so the composer, its earlier emails and each family page's "Emails sent" work unchanged. `MessageComposer` takes an optional `emptyText`.
- **Downloads** (a fresh sign-in; audit `admin.download.csv|pdf`, entity `list`, id `cast-program:<slug>` or `cast-sheet:<slug>`):

| Download | Address | Columns |
|---|---|---|
| Cast list for the program | `downloads(`${show(slug)}/program`)` | Name, Role, Group (one row per role, in the cast's order) |
| Staff cast sheet | `downloads(`${show(slug)}/cast-sheet`)` | Name, Role, Group, Photos, Class (the performing class), Parents' phones. No care details |

- **Audit:** `admin.cast.add`, `.update`, `.move`, `.remove` (entity `student`, the show's slug in `detail`). Cast changes don't need a fresh sign-in (no money, no care details); viewing the page isn't logged (no care details on it).

**Rehearsals** (`show_rehearsal`; on the show's page):
- **Add, Change, Remove:** date, start and end (Athens time; stored as instants by `athensInstant(date, time)`, read back by `athensParts`; correct on both sides of the daylight-saving change), place (the content's locations, optional), a note (300 characters) and the classes that rehearse (`session_ids`; none ticked = the whole cast). Audit `admin.rehearsal.add|update|remove` (entity `show_rehearsal`, slug and date in `detail`).
- **Who's called** (`rehearsingSessions`): the ticked classes, or for the whole cast the performing classes' current sessions on that date. A child is called (`childCalled`) when the rehearsal is for the whole cast, or they're enrolled (active or trial) in a ticked class.
- **Calendar** (§19): a `rehearsal` entry (teal), "Rehearsal: <show>", the classes or "Whole cast", the place, linking to `show(slug)`; month, week and phone list; in the Daily Class Schedule download too. Filters: program and teacher by the rehearsing classes, location by its place. `calendarRehearsals(content, from, to)`; `CalendarData.rehearsals` is optional.
- **The teachers' Today** (§18): `teacherRehearsals(viewer, date, content)` → `RehearsalCard[]`, beside `teachCards` (which is unchanged): a read-only card with time, show, place, classes and note, for teachers who lead or assist a rehearsing class (`teacherSeesRehearsal`); owners see every rehearsal that day. No cast, no attendance. Teachers can't open `/admin/shows`.
- **Families:** the account's "Coming up" shows, for each child in the cast of an upcoming show, "Juniper: Narrator, Moon, in Fall 2026 Variety Show", its dates, and each rehearsal from now on that the child is called to: "Rehearsal: Sat, Nov 14, 10 am–12 pm, HQ · W Broad St" and its note (`familyShows`, `roleLine`). Nothing about other children in the cast. The class's calendar file (`/account/calendar/<enrollment>.ics`) adds those rehearsals as one-off events (`classCalendar`'s `extras`, `childRehearsals`). The show's public page is unchanged.
- **Telling families about a change:** after Change or Remove, the notice offers **Email the families about this change**: `showEmail(slug)?about=changed|removed&start=&end=&loc=&classes=` (and `r=` for a change; times and ids only, built by `changeQuery`). The composer opens filled in (`changeEmail`: "Rehearsal changed: <show>" / "Rehearsal cancelled: <show>") with only the families called to the old or new rehearsal ticked (`rehearsalFamilies`). Nothing is sent until staff review and send it.

**Not built here:** tickets, conflicts, rehearsal attendance, rehearsals in the teacher app's "This week", tags (the tags unit's).

