# The staff back office

Hannah's side of the site: classes, families, payments, messages and the website editor, on a computer and on a phone. This page covers the shared pieces every staff screen builds on. The plan is in `docs/review-2026-10/log.md` ("Back-office plan drafted"); billing is in `staff-billing.md`.

## 1. Routes and the link contract

Every staff address comes from `src/lib/admin-links.ts`. Link with these functions, never with typed paths.

| Function | Address | Page |
|---|---|---|
| `today()` | `/admin` | Today (a placeholder until the Today unit) |
| `attention()` | `/admin/attention` | Needs attention (placeholder) |
| `classes()` | `/admin/classes` | Classes list (the old rosters list) |
| `classPage(sessionId)` | `/admin/classes/<id>` | A class (the old roster page) |
| `classPrint(sessionId)` | `/admin/classes/<id>/print` | A class's roster, ready to print (§9) |
| `classEmail(sessionId)` | `/admin/classes/<id>/email` | (Messages unit) |
| `search(q?)` | `/admin/search?q=` | Search (placeholder) |
| `family(householdId)` | `/admin/families/<id>` | (Search and families unit) |
| `payments(show?, month?)` | `/admin/payments`, `?show=failed` or `upcoming`, `?month=2026-10` | Payments (§11) |
| `paymentsOrder(orderId)` | `/admin/payments/<id>` | One family's payments for a class |
| `leads()` | `/admin/leads` | Messages & sign-ups |
| `content()` | `/admin/content` | The website editor |
| `install()` | `/admin/install` | Put the app on your phone |
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
| `section` | `today`, `classes`, `families`, `payments`, `leads` or `content` (the default): which section is lit on a computer |
| `back` | `{ href, label }`: a back link in the phone's top bar. Give it to every page below a list: the installed app has no back button |
| `wide` | More width (the editor) |
| `signIn` | `{ heading, intro }` for the sign-in shown to signed-out visitors (the confirm page uses it) |

- **Computer:** a dark top bar with the search box (it sends `GET /admin/search?q=`), the staff member's email and Sign out, then the sections: Today, Classes, Families, Payments, Messages & sign-ups, Website. Families goes to Search until there's a families list.
- **Phone (760 px and narrower):** the page title with the optional back link and a Menu button at the top; a tab bar at the bottom: Today, Classes, Search, Alerts. The current tab follows the address (a family's page lights Search). The menu holds Families, Payments, Messages & sign-ups, Website, "Put the app on your phone" and Sign out.
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
| `.attention-list`, `.attention-item` (+ `--alert`, `--warning`, `--neutral`), `__title`, `__detail`, `__action` | A "Needs attention" row with its next step |
| `.notice`, `.notice--error` | Saved / error messages |
| `.tiles`, `.tile` | Big links (Today's placeholder) |

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

- **`requireStaff(locals)`** at the top of every staff page and endpoint:
  ```ts
  const { staff, response } = requireStaff(Astro.locals);
  if (response) return response; // signed-in non-staff: "Not found"
  // staff is null when signed out: AdminShell shows the staff sign-in.
  ```
- **A fresh sign-in.** `signedInRecently(locals, 15)` is true when the session was made in the last 15 minutes. `requireFreshStaff(locals, url)` uses it: downloads now, refunds and staff changes later. Otherwise staff go to `/admin/confirm?next=…`, which says "Confirm it's you before downloading", fills in their email, and runs the normal 6-digit code sign-in (a new session). For a download it then starts the file and offers "Back to the list"; for anything else it goes straight to `next`.
- **Idle limit.** A staff session not renewed for 30 days counts as signed out, and is deleted. Families keep 90 days. `readSession` (used by `src/middleware.ts`) reads the session without renewing it first, so an idle one is seen as idle, then renews it once a day as before.
- **Tests** age a session with `POST /dev/age-session` (`minutes` or `days`), which exists only in development, like `/dev/mailbox`.
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

`src/lib/contacts.ts` has the zod inputs (`emergencyContactsInput`, `pickupPeopleInput`: names up to 80 characters, relationships up to 40), `normalizePhone` (US numbers as 10 digits, others as `+digits`), `formatPhone` ("(706) 555-0142"), `telHref` and `smsHref`. Who sees the new data: `security.md`.

Families fill these in on the details step and at `/account/family` (`portal.md`). Read them with `getFamilyDetails(householdId)` (`src/server/family.ts`); `familySummary` and `personLine` (`src/lib/family-details.ts`) write them out, and `heardAboutLabel` turns the stored `heard_about` key (`friend`, `search`, `social`, `school`, `event`, `flyer`, or `other: …`) into words. `EMERGENCY_CONTACT_REQUIRED` there switches the required emergency contact off.

## 9. Classes (`src/server/classes.ts`)

- **The Classes list** (`/admin/classes`): one row per session the site takes sign-ups for, by term: when, teacher, places filled ("8 of 12": enrolled plus trials), openings and the waitlist. Current and upcoming by default; ended ones, past one-off dates included, under "Ended". Filters are links: `?openings=1`, `?waitlist=1`, `?under5=1` (weekly classes short of the 5 they need to run), `?term=Fall 2026`, `?show=ended`. `classFilters(params)` reads them and `filterQuery(f)` writes them. Downloads: `classes.csv.ts`, `classes.pdf.ts` ("Class List"), as filtered.
- **A class's page** (`/admin/classes/<id>`): the roster by last name with badges and the parents' Call, Text and Email links; tapping a child opens their care details in place (allergies and medical notes in red, pickup, emergency contacts, photos); the waitlist in the order families joined, with "Offered <date>" for an open offer. Empty `data-roster-tools`, `data-roster-actions` and `data-waitlist-actions` elements mark where the Roster changes unit's buttons go.
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
| Student / Class List | `downloads(FAMILY_LISTS.children)` | Child, Age, Family, Current classes |
| Student Contact List | `downloads(FAMILY_LISTS.contacts)` | Child, Family, Parents, Emails, Phones, Emergency contacts |
| Family Notes | `downloads(FAMILY_LISTS.notes)` | Family, About, Note, Written by, When |

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
