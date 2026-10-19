# Foundation unit: state

## Done
- Migration `0009_back_office` (household contact columns, household_note, message, message_recipient, waitlist_offer).
- `src/lib/contacts.ts`, `src/lib/badges.ts`, `src/lib/csv.ts`, `src/lib/admin-links.ts`, `src/server/downloads.ts` (pdfkit), `src/server/staff.ts` (+ middleware uses `readSession`).
- Unit tests for each.

## Next
- Shell (AdminShell + admin.css), page moves and redirects, Today placeholder, leads CSV/PDF, confirm page, dev session ager, manifest/icons/install page, docs, browser test, screenshots.

## Decisions
- US phones stored as 10 digits (leading 1/+1 dropped); other countries as +digits.
- Birthday badge: 3 days either side; Feb 29 birthdays fall on Feb 28 in other years.
- PDF uses Helvetica: pdfkit fails to subset the site's variable fonts (fontkit RangeError).
- Staff idle check reads the session with `disableRefresh`, then renews as Better Auth does.

## Open questions
- none yet
