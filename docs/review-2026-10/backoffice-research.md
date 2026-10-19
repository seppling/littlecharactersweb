# Back-office research (October 19, 2026)

Notes from three research passes that shaped the staff back office plan (Stephen's copy: https://claude.ai/code/artifact/d286c39d-0260-4827-bf89-9456b1f32c51). Mostly vendor help pages; review sites blocked direct reading, so review quotes are from search excerpts. Treat vendor claims as claims.

## Research 1: staff back offices (condensed, Oct 19)
Coverage: Jackrabbit (JR), iClassPro (iCP), Sawyer (SW), Class Manager (CM), Amilia (AM), Studio Pro (DSP), Pike13 (P13); thinner: Studio Director (TSD), Akada, ClassJuggler, Mindbody. TSD help center JS-only; its report list from Reports FAQ PDF (2013-14 examples: a floor).

1 Home: JR dashboard widgets (KPIs, birthdays, waitlists with openings, to-dos, aged accounts, revenue YoY; no failed-payment widget). iCP dashboard + Alerts Hub (bell with count; items link to pre-filtered pages; billing-run failure alerts always on). P13 Failed Transactions (7 days) tile; Unconfirmed Attendance view. MB failed-autopays alert (customers ran the report ~18x/month before). SW lands on Upcoming calendar with booked/capacity, waitlist count. Copy: Today panel + one Needs-attention queue linking to filtered lists. Avoid making failed payments something to go look for.
2 Class page: JR tabs Summary/Enroll/Drop/Attendance/Waitlist/Instructors/Skills/Notes; Enroll student, Class roll print, Email/Text class; max size/wait, age cutoff warning overridable. JR All Classes grid charts (openings, waitlists, drops 21d, absences 14d), bulk message, copy class. SW roster Booked/Waitlist/Canceled, expandable cards (contacts, allergies, form answers), labels (Free trial, Allergy, Drop-in, New, Birthday); transfer, remove, add with/without charge. iCP indicators (medical, new 30d, birthday ±4d, balance, trial, waitlist, upcoming drop, notes, expected absence). Roll sheet options. Waitlist: iCP notify + approve; SW "Invite to register" link, first to pay gets spot, optional invite-only.
3 Search: JR header boxes family/class; DSP one box everywhere incl. phone/email; iCP partial matches. Results usable as mailing list.
4 Records: JR family summary with Problem Account flag, balance colored, contacts, transactions, billing info, notes (tagged), policies. Student tabs incl. Medical tab turns red; sizes; absences. Email history on family record 365 days. Photo waiver blocks photos (iCP).
5 Billing: SW retries daily; iCP preview → wait 1h → process, summary to owner; Account Updater. Refunds: iCP one button void-or-refund, partial; SW Refund / Cancel order (refund+remove+stop) / Cancel booking (no refund). iCP mass credits with preview; blackout schedules (billing/closure/both, prorate). Drop-in = single-day enrollment with fee, Save & charge.
6 Reports: TSD list (Charges Summary/List/Detail; Payment Summary/List; Deposit Summary/List; Overdue List; Season Charges Trend; Charges/Payments Summary; Family Charges/Payments Summary; Aging/Collections; Class Payments Summary; View Transactions; Family List; Student List; Student Contact List; Retention List; Class Schedule; Class List; Class Resource Block; Class Roster; Daily Class Schedule/Instructor Work Schedule; Mailing Labels; Summary Invoice; Statement Letter; Transaction Detail; E-mail to a Group; plus attendance (missed classes), instructor timesheets, skill charts/report cards, email open history). Table stakes (3+ products): class roster/sign-in sheet; daily schedule; class list capacity/openings/waitlist; enrollment counts/trends; new enrollments; drops; retention; waitlist; trials/drop-ins; attendance; attendance not taken; birthdays; medical/allergy + emergency; contact lists/labels; waiver acceptance; skills; costume sizes; aged receivables; family balances incl. credits; statements; payments by method; charges by category; revenue by class; YoY trend; card transactions/declines; autopay/expiring cards; refunds/adjustments (weak); tax/FSA annual receipts (partial: iCP Family Annual Total Receipts); instructor schedule/hours; room/teacher conflicts; sent email log; SMS consent. Reports UX: keyword search, favorites (JR), presets + CSV/PDF (iCP); TSD names reports by questions ("Which families owe me money?"). Recommendation: Hannah screenshots TSD Reports tab, exports the ones she runs.
7 Comms: JR class email recipients toggles (waitlist, future), preview list with uncheck, templates, attachments, send later, log on family. TSD targets by class/season/tags, open tracking, bounce opt-out, drip birthdays. SMS US 10DLC (Twilio, fees from Aug 1 2025): brand $4.50 (sole prop / low-volume) or $46 standard + $15 campaign vetting; monthly $1.50-$10; per-message carrier fees; opt-in proof required. JR resells: up to $69 setup, $4.90/mo/number, $0.02 per text sent or received, 200/day, days to 2 weeks setup. iCP $0.03/credit.
8 Settings: studio profile; seasons and holiday/closure calendar; pricing (tuition, proration, discounts, fees); payment methods; class defaults (max size, waitlist, age cutoff); drop and absence reasons; custom fields; policies/waivers incl. photo; email templates (receipt, failed payment, waitlist opening); SMS hours; alerts; staff roles/permissions.

Top 10 to copy: Today + Needs-attention home; roster chips; medical turns red + allergies wherever attendance is taken; waitlist Offer spot (link, first to pay); drop-in as enrollment type with fee; attendance completion tracking + roll not taken alert; header quick search incl. phone/email, results messageable; class email composer (toggles, preview-uncheck, schedule, templates, logged); closure calendar driving proration/credits with preview; refund/credit flows (void-or-refund; drop+refund+stop autopay vs drop only) + searchable reports with favorites.
Pitfalls: too many clicks/cluttered menus; not intuitive (needs tutorials); UI redesigns; teacher logouts (JR ~10 re-logins in 5h; iCP 1h idle); inflexible reports; reports that undercount (exact-match categories); metrics that disagree; archived data hard to reach; failed payments buried; thin logs/permissions.

Key sources: help.jackrabbitclass.com (executive-dashboard-overview, class-record, waitlist-enrollments, email-a-class, set-up-text-messaging-twilio, family-record, student-record), support.iclasspro.com (218570358 reports, 41768717835159 alerts hub, 1500007990901 waitlist, 4403428708631 indicators, 115008378188 refunds, 34646022065175 billing, 360053393413 blackouts, 360037812853 single-day), app.thestudiodirector.com/html/help/ReportsFAQ.pdf, thestudiodirector.com/product-features, help.hisawyer.com (roster, messages, refund, waitlist invite), help.classmanager.com/en/reports, support.twilio.com/hc/en-us/articles/1260803965530

## Research 2: teacher phone access and home-screen web apps (condensed, Oct 19)

Evidence mostly vendor help pages; independent teacher reviews scarce.

## Teacher apps
- Jackrabbit Staff Portal: responsive web, saved to home screen (same approach as ours). Opens on today's classes. Present/Absent + Late/Left early/Observing; mark all present/absent; admin chooses partial save allowed or every student required; roll notes. Shows photo, allergy icon, birthday icon, trial/first-time, missed last class, family info, absence history. Email student/family. Time clock to payroll. Substitutes per class meeting ("My Substitutions", emails to both teachers). Visibility: own classes / all today / location / none. Staff portal login log.
- iClassPro Staff Portal: dashboard Attendance/Skills/Time Clock/My Schedule; own classes by default; green check when attendance taken, gray when not; set all then adjust; Tardy/Left Early/Excused; filter "students with critical notes"; indicator icons (medical, birthday) view-only; tap name: guardians, phone/email, policy acceptance, emergency contacts. Photos only if photo waiver accepted. Optional "show balance on roster" (counterexample). Time clock warning. Signs out after 1h idle unless "Save Login". Native app 2.1 stars: sign-in failures, "does the minimum", few features vs desktop.
- Class Manager (vendor): own classes only, attendance in a couple of taps, medical flags/behaviour notes/emergency contacts, message parents without looking up emails, financials hidden.
- Akada: roles with attendance access and messaging permissions per role.
- Pike13: staff dashboard (upcoming classes, management notes); Limited Staff role: own rosters only, no billing, private notes only.
- Brightwheel (childcare best in class): Select All, then Check In/Out/Absent buttons; Room Device Mode for shared tablets; authorized pickups shown at checkout; teachers see own room only; complaints: login glitches, no printable attendance in outages.
- Procare: batch check-in; pickup PINs + photos.
- Adoption drivers: mark-all-present then fix exceptions; visible done/not-done status; login friction kills adoption; bad signal matters; short teacher-only scope (not cut-down admin).

## Privacy/security
- Teachers default to assigned classes; substitute access per class meeting. No billing for teachers.
- Flags on roster, details on tap (read-only). Respect photo consent (initials when not consented).
- Sessions: NIST 800-63B-4 low assurance: reauth at least every 30 days; OWASP: absolute timeout, server-side logout, visible sign-out, Secure/HttpOnly/SameSite cookies, new session ID after sign-in. Suggestion: teachers ~30 days rolling on own phone; "shared device" option = 1h idle; fresh code before billing/refunds/exports for director.
- Audit: log sign-ins, failed permission checks, viewed medical details, attendance edits (old/new), exports, role changes; no raw session IDs.
- On-device: cache only today's assigned rosters + flags + emergency numbers; clear on sign-out and after the day.
- Not researched: COPPA, Georgia licensing.

## PWAs 2026
- iOS 26: any site added to Home Screen opens as web app by default ("Open as Web App" toggle); manifest not required but used. Path: Safari … → Share → Add to Home Screen. No install prompt on iOS → own illustrated instructions. Third-party browsers can add to Home Screen since 16.4.
- iOS push: since 16.4, Home Screen apps only; permission from a tap; every push must show a notification or permission is revoked; APNs, no Apple developer account; Declarative Web Push (18.4+). Re-save subscription on each open (stale subscriptions reported).
- Badges: setAppBadge works in Home Screen apps since 16.4.
- Offline: service workers + IndexedDB work; Background Sync NOT on iOS → retry on open/foreground/online. Safari 27 (Sept 17 2026) IndexedDB reliability fixes.
- Storage: ~60% disk quota; LRU eviction under pressure; persist() heuristic; Home Screen apps have separate 7-day counter; server-set cookies exempt → keep session in HttpOnly server cookie.
- Home Screen app has separate cookies from Safari (by design): sign in separately; email links open Safari, not the app → type the code in the app (our 6-digit code already does this). autocomplete="one-time-code", inputmode="numeric"; put the code in the email subject.
- Camera: prefer file input with capture over getUserMedia in standalone.
- No browser back button in standalone → in-app back navigation; safe areas.
- Android Chrome: install criteria (HTTPS, manifest with name, 192/512 icons, start_url, display; engagement) → beforeinstallprompt → own Install button; WebAPK; in-scope links open the app; push + Background Sync supported; keep manifest stable.

## Responsive admin patterns
- Phone bottom tab bar 3-5 labeled destinations, no "More" tab; badges for critical info only. List-detail one at a time on phones, side by side on desktop. Tap targets ≥44pt (WCAG 2.2 min 24px). Safe-area padding.
- Desktop-only: billing setup and refunds, season/class setup, reports/exports, imports, permissions.
- Director's phone: Today (attendance status across classes), Families (look up, call/text), Messages, alerts. Avoid "does the minimum".

## Recommended teacher phone screen
1. Today (opens on launch): offline banner; one card per class/rehearsal (time, name, room, count); status chip Not taken / Saved on phone, sending… / Done ✓; "Covering for X" tag.
2. Class roster: header with "Present 9/12" and big Mark all present; safety strip ("2 allergy/medical · 1 pickup note"); rows: photo if consented else initials, preferred name + last initial, icons (allergy/medical, pickup restriction, no photos, new/trial), big Present/Absent toggle, Late/Left early in row menu; tap row → student sheet (allergy/medical read-only, authorized pickups/restrictions, emergency contacts + guardians with Call/Text, photo consent, recent attendance); Note to director box (replaces texts); Submit with confirmation.
3. Tabs: Today · Schedule · Me. Teachers never see billing, addresses, other classes, reports.

## PWA checklist
Code typed in app; one-time-code autocomplete; HttpOnly SameSite cookie same host; separate sign-in Safari vs app; iOS install page + Android install button; manifest (name, icons, start_url, display standalone, id); in-app back + safe areas; push permission after install from a tap; visible notification per push; re-save subscription each open; badge = classes still needing attendance; attendance taps to IndexedDB with phone-generated IDs; idempotent server endpoint; sync on open/foreground/online (Background Sync Android only); clear sync status; device data is a cache; clear on sign-out; file input capture for photos; test on real iOS 26/27 and Android.

Key sources: help.jackrabbitclass.com/help/attendance-in-the-staff-portal-overview, help.jackrabbitclass.com/help/substitutes, support.iclasspro.com/hc/en-us/articles/360053153673, apps.apple.com/us/app/iclasspro-staff-portal/id1476746632, classmanager.com/features/attendance-tracking, help.pike13.com/hc/en-us/articles/360029378352-Staff-Member-Permissions-Guide, intercom.help/brightwheel/en/articles/1031829-attendance-mode, cheatsheetseries.owasp.org (Session Management, Logging), pages.nist.gov/800-63-4/sp800-63b/aal/, webkit.org/blog/13878 (web push iOS), webkit.org/blog/14112 (badging), webkit.org/blog/16535 (declarative web push), webkit.org/blog/17333 (Safari 26), webkit.org/blog/18325 (Safari 27), webkit.org/blog/14403 (storage policy), caniuse.com/background-sync, web.dev/articles/install-criteria, developer.apple.com/design/human-interface-guidelines/tab-bars, w3.org/WAI/WCAG22/Understanding/target-size-minimum.html

## Research 3: performance-studio features, staff reviews, switching, pricing (condensed, Oct 19)

Method: web only; Capterra/G2/GetApp blocked direct fetches (quotes from search excerpts); Reddit unverified.

## Performance features
- Show setup: SD event timeline (gaps between performances), tickets, recital charges. Jackrabbit drag-drop show order, cue sheets, check-in sheets, Word export for program. Class Manager routines + PDF play book. Studio Pro acts, conflicts, quick-change flags.
- Casting/roles: dance tools put students on routines, no roles. Theater tools (Cast98, Outcoach) model roles, role offers, cast lists to families.
- Rehearsals/conflicts: only theater tools (Cast98 conflict calendar on audition form, schedule suggestions, rehearsal attendance; StageHub conflicts in app, blackout during tech week). SD has only room/instructor double-booking report.
- Costumes: SD/Jackrabbit/Studio Pro vendor size charts, orders, fees; theater = stock inventory.
- Performance fees: SD charge categories "Event/Recital Fee", "Costume Balance"; added charges attach to classes/groups.
- Tickets: SD and Studio Pro built in; theater platforms OnTheStage, Ludus, CUR8 (ex-ShowTix4U).
- Volunteer sign-ups, performer bios, photo-permission feature: not found in dance tools (unverified absence).
- Skills: SD skill charts, report cards, entry from staff mobile app; tags on students/families used to target email. Jackrabbit skills per level, progress report cards.

## Staff reviews (patterns)
1. Support is the top praise everywhere. 2. Billing setup/errors top complaint. 3. Forced UI redesigns mid-season break habits (SD 2024 redesign spread one page across tabs; users begged for old UI). 4. Weak teacher mobile (attendance, skills). 5. Rigid fee structures / hard-coded fields. 6. No Gmail/Google integration. 7. No "one child at a glance" view (SD user wants to click a child and see missed classes).
- SD: roll "super simple"; complaints: redesign, 3-week billing issue, "too many options for views that don't apply", hard to add a drop-in, payment confirmations not itemized, mobile "functional but not optimized". SD texting: conflicting claims.
- Jackrabbit: support praised; cost, hard-coded filters, can't tie fees to classes, not mobile friendly for skills.
- Studio Pro: unintuitive tuition setup; mobile app lacks features. iClassPro: manual billing time-consuming, too many drop-downs, limited reporting.

## Switching from SD
- SD Reports FAQ PDF (app.thestudiodirector.com/html/help/ReportsFAQ.pdf): most reports have an Excel button; Aging/Collections no Excel; Student Contact List shows only currently enrolled; archived seasons restored by SD support.
- SD report catalog:
  - Financial: Charges Summary/List/Detail; Payment Summary/List; Deposit Summary/List; Overdue List (family balances +/-); Charges/Payments Summary; Family Charges/Payments Summary; Aging/Collections (0-30/31-60/61-90/90+); Class Payments Summary; Season Charges Trend; View Transactions (card/ACH incl. failures).
  - Student: Student List; Student Contact List; Retention List.
  - Class: Class Schedule; Class List; Class Resource Block; Class Roster; Daily Class Schedule / Instructor Work Schedule.
  - Letters: Summary Invoice; Statement Letter; Transaction Detail; E-mail to a Group.
  - Newer: dashboards, report cards, skill charts, missed-class attendance, instructor timesheets, email open tracking, weekly insight emails.
- Pitfalls: migrate balance due at a cutover date (not "unpaid by category"); reconcile family by family; saved cards belong to the processor (Stripe can copy customers/cards between accounts if studio owns the account; else re-enter); sibling links hard; export before giving notice; keep SD until first new billing cycle reconciles.
- SD plans month-to-month, 30-day money-back; notice period and data-after-cancel not published. Ask SD support in writing for a full export after restoring archived seasons.

## Pricing (~100-150 students)
- SD $119/mo software-only (101-250 tier); $65 at <=100 students. Jackrabbit ~$89; Studio Pro $49/$79/$165; iClassPro $139-299; Akada $60; Class Manager $0 + 3.9%+30c; Outcoach ~$105-149. Custom build saves ~$1,430/yr in SD fees.

## Must / nice / skip for a children's theater
- Must: family/student/guardian/emergency/medical/pickup; tags (show, role, cast group, camp, PNO) as filters everywhere; enrollment for classes/camps/PNO/parties with capacity/ages/waitlist; family ledger with charge categories (tuition, performance fee, costume, drop-in, camp, PNO, party); refunds and credits; paid drop-ins; performance fee auto-charged on cast add; shows: cast, roles as tags, rehearsal calendar; mobile-first attendance (classes + rehearsals) and per-child missed-classes view; SD core reports with CSV export on every report; one-click copy of email/phone lists by class or tag (Gmail BCC, group text); photo-permission flag on rosters/cast lists; skills/levels/progress reports.
- Nice: rehearsal conflict collection; costume sizes per student; bios + cast export for program; volunteer sign-ups per show; dashboard/retention/aging.
- Skip: built-in ticketing (use CUR8/Ludus/OnTheStage), dance show auto-ordering, vendor costume auto-sizing, two-way SMS, drip campaigns, branded store app, POS.

Key sources: thestudiodirector.com (/pricing, /product-features), app.thestudiodirector.com/html/help/ReportsFAQ.pdf, capterra.com/p/92419/The-Studio-Director/reviews, g2.com/products/the-studio-director/reviews, activitymessenger.com/blog/a-mobile-first-the-studio-director-alternative-for-clubs-and-studios (competitor), jackrabbitdance.com/pricing, help.jackrabbitclass.com/help/data-after-cancellation-faq, gostudiopro.com/pricing, help.classmanager.com/en/recital-manager, cast98.com/features/theatre-management, outcoach.io, dancestudiomanager.com/switch-dance-studio-software-without-losing-data, opus1.io/resources/dance-studio-software-migration, support.stripe.com/questions/data-that-can-be-copied-between-stripe-accounts
