# Reports unit: report

Branch `claude/bo2-reports` (from `claude/blissful-archimedes-enun5m` at 27b2e95). No compaction or restart happened in this session.

## Result

**What changes for Hannah:** a **Reports** link in the top bar and the phone menu opens a dashboard of the numbers that matter (money, enrollment, growth, safety), each opening the report table behind it. **All reports** opens a library of 28 reports grouped by the question they answer, each with its Studio Director name ("was: Retention List"), a star, filters, a sortable table, and CSV and PDF downloads. **Nothing changes for families.** Reports only read.

**New files**
- `src/server/reports/common.ts`: report shape (`ReportResult`), cell formatting, sorting, seasons (`thisSeason`, `lastSeason`, `seasonsOf`), filters.
- `src/server/reports/money.ts`: payments received, money by month, next charge day, committed ahead, who owes (aging), charges by type and season, charged vs paid by class, discounts, refunds, drop-ins.
- `src/server/reports/enrollment.ts`: fill rate, children this season, sign-ups by week, classes at risk, waitlists, drops with reasons, free class to paid, coming back.
- `src/server/reports/growth.ts`: how new families heard about us, ZIP codes, new families by month.
- `src/server/reports/safety.ts`: care details on file, missed two in a row, attendance taken, absences with reasons, allergy and medical list (decrypted through the audited roster), photo permission by class or show.
- `src/server/reports/teachers.ts`: who teaches what and when, attendance taken per teacher.
- `src/server/reports/library.ts`: the registry of every report, `Loads` (each data load once per request), `runReport`, the "On other pages" links.
- `src/server/reports/dashboard.ts`: tiles, panels, comparisons.
- `src/server/reports/favorites.ts`, `page.ts`, `downloads.ts`.
- `src/pages/admin/reports/index.astro` (dashboard), `library.astro`, `[key].astro`, `[key].csv.ts`, `[key].pdf.ts`, `favorite.ts`.
- `src/components/admin/reports/BarChart.astro`, `LineChart.astro`, `HowCounted.astro`, `StarButton.astro`; `src/lib/chart.ts`; `src/styles/reports.css`.
- `tests/unit/reports.test.ts` (26 tests), `tests/e2e/staff-reports.mjs`.

**Shared files (own lines only)**
- `src/lib/admin-links.ts`: `reports()`, `reportsLibrary()`, `report(key, params?)`, `reportFavorite()`.
- `src/components/admin/AdminShell.astro`: `'reports'` section; **Reports** in the top bar and the phone menu (after Payments).
- `docs/back-office.md`: four rows in §1's link table; new **§25 Reports** (the coordinator renumbers at merge).
- `README.md`: the `staff-reports.mjs` line, last in the browser-test list.
- `tests/e2e/staff-foundation.mjs` line 88: the top bar's expected sections now include Reports. My new menu link broke that one check of the old order; nothing else in the test changed.

## Proof

All on the final commit's code, Stripe keys blanked.

- `npm run check` (astro check): **0 errors, 0 warnings** (15 hints, none in the new files).
- `npm test`: **41 files, 818 tests pass**, including `tests/unit/reports.test.ts` (26): seasons and filters; collected net of refunds; charges by type and season (stopped and future charges left out); discounts by kind as a share of full price; refunds by season; aging buckets at 30/31, 60/61, 90/91; a child in two classes counted once; fill rate with no capacity; drops by reason; free class to paid; coming back from the site, from the baseline, and with neither; sign-ups per week beside last season; classes at risk; new families and ZIP codes (imported families aren't new); care details on file; attendance taken (day off left out); teachers; chart scale and comparison wording; with the database: **every dashboard tile's total equals its report's total for the tile's filters**, money by month equals Payments received, every report runs with rows the width of its columns, favorites per staff member, teachers and families refused.
- `npm run build`: completes.
- **Browser tests**, `tests/e2e/serve.sh` on a fresh database, every test in README order (run 3): **all 20 pass**, the 19 existing ones and then `staff-reports.mjs` (49 checks): six tiles with numbers, each opening its report with the same total; every panel; a chart's "Show the numbers"; the library's groups and Studio Director names; starring puts a report first and under the tiles; sorting; CSV (same rows as the page) and PDF after a fresh sign-in; the allergy list asks for a fresh sign-in, then a class; a teacher gets the Staff only panel; 390 px with no sideways scroll, no wrapped button, 44 px targets on the dashboard, library and a report.
- Run 1 stopped at `staff-foundation.mjs`'s top-bar order check (my Reports link); I updated that one line. Run 2 passed the 19 existing tests and caught 22 px links in my report table at 390 px, which I fixed; run 3 is the clean one. `staff-roster.mjs`'s known intermittent tap-size check didn't fail in any run.
- **Screenshots** (`.orchestration/reports/shots/`): `dashboard-desktop.png`, `dashboard-390.png`, `library-desktop.png`, `library-390.png`, `report-children-desktop.png`, `report-children-390.png`, `report-classes-desktop.png`, `chart-with-table.png`.

## Decisions

1. **One function per number.** The dashboard runs each report through `runReport` with the same filters as the tile's link and shows its `total`, so the tile and the report can't disagree; a unit test checks every tile against its report.
2. **"Enrolled" = active or free trial**, as the Classes list counts places filled. The plan says "an active enrollment"; trials hold a place, so leaving them out would make fill rate and children disagree with Classes. A child in two classes counts once.
3. **"Last season" = the latest term that ended before this one began.** An overlapping long term (Fall 2026 – Spring 2027) isn't last season to Fall 2026. "This season" reuses the family page's rule (weekly classes running today, else the next to start).
4. **Comparisons:** last season on the site first, then Settings → Last season (`reports.baseline`), else "No earlier season yet". Collected this month compares with the same month a year earlier (site, else baseline). "Coming back" from the baseline shows `returning of children` with no names.
5. **Money by month counts from one load** (`collectedIn`) instead of calling `paymentsReceived` 24 times; a unit test checks the two agree. "Collected this month" itself uses `paymentsReceived`.
6. **Free first classes are counted, not priced,** in Discounts: no price is recorded for a free class, and estimating one would be inventing a number.
7. **New families** = first sign-up that season and not imported from Studio Director (`household.source`): imported families were already Little Characters families.
8. **Sorting is server-side** (`?sort=&dir=`), so the CSV and PDF keep the page's order, and it works without script. On phones (where the header row is screen-reader-only) a "Sort by" select does the same.
9. **Charts:** inline SVG with HTML words around it (SVG text would shrink to unreadable at 390 px), a tooltip per mark (`<title>`), "Show the numbers" tables. The two series colors (purple `#8040b8`, teal `#0f9e8e`) passed the palette validator (colour-blind separation, 3:1 contrast); the second line is also dashed.
10. **Teacher reports live in `teachers.ts`,** a fifth file beside the four named areas, since they don't fit money, enrollment, growth or safety.
11. **Empty states** say words ("None yet", "No one enrolled yet", "No sign-ups yet this season"), never a zero that looks like a result.
12. **Audit:** reports that name children write `admin.report.view` (the key, the filters in words); the allergy list also writes the roster's `admin.report.allergies` for the class; downloads write `admin.download.csv|pdf` with list `report:<key>`.

## Open points

1. **Discounts "share of full price"** counts sign-ups' tuition lines and each monthly charge's regular amount as full price. Recommended: keep; it's what families would have paid without any discount.
2. **Teacher attendance** credits a class's teachers (Settings → Staff), not who pressed Submit (a substitute's date counts for the regular teacher). Recommended: keep for now; a per-submitter column can come later if Hannah wants it.
3. **Children this season counts free trials.** Recommended: keep (matches Classes' places filled); the table shows each child's classes.

## Follow-up candidates

- A "Reports" tile or link on Today for owners.
- Season-over-season trend lines once two seasons have run on the site (Studio Director's Season Charges Trend as a chart).
- Charged vs paid **by season** as its own summary (the class report filtered to a season covers it today).
- Absence reasons fill in once the settings unit's absence reasons are used by the teacher app.

## Handoff

- **Routes:** `/admin/reports` (dashboard), `/admin/reports/library`, `/admin/reports/<key>` (+ `.csv`, `.pdf`), `POST /admin/reports/favorite` (`key`, `on` = `1`|`0`, `next`). Links: `reports()`, `reportsLibrary()`, `report(key, params)`, `reportFavorite()`.
- **Report keys:** money: `payments-received`, `money-by-month`, `next-charge-day`, `upcoming-autopay`, `who-owes`, `charges`, `class-payments`, `discounts`, `refunds`, `drop-ins`; enrollment: `classes`, `children`, `signups-by-week`, `at-risk`, `waitlists`, `drops`, `free-class`, `coming-back`; growth: `heard-about`, `zip-codes`, `new-families`; safety: `care-details`, `missed-two`, `attendance-taken`, `absences`, `allergies`, `photo-permission`; teachers: `teacher-classes`, `teacher-attendance`.
- **Adding a report:** a pure function returning `ReportResult` in the area's file, and an entry in `REPORTS` (`library.ts`) with `title`, `was`, `how`, `filters`, `namesChildren`/`fresh` as needed. It then appears in the library with filters, CSV and PDF.
- **Filters** (`readFilters`): `season` (a term, or `all` where `allSeasons`), `month` (`YYYY-MM`), `program` (slug), `location` (id), `class` (session id), `show` (slug), `week` (any date), `who` (`new`|`all`), `sort`, `dir`.
- **Settings unit:** the dashboard reads `getSetting('reports.baseline')`: `season`, `children`, `returning` (of last season's children, how many came back), and `monthly` (month, collected cents, shown a year later as "A year before"). `classes` isn't used yet.
- **Drops** read `enrollment.drop_reason` and `cancelled_at`; **absences** read `attendance.reason`. Whatever wording Settings saves there is what the reports show.
