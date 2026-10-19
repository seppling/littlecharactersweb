# Messages unit: report

## Result

Hannah can email a class or one family from the site, see what was sent, retry failures, and copy a class's emails or phone numbers for Gmail and group texts.

**New files**
- `src/server/messages.ts`: who gets it (`classAudience`, `familyAudience`, `pickRecipients`), copy lists (`emailList`, `phoneList`), writing (`paragraphs`, `paragraphHtml`, `composeEmail`, `footerFor`, `checkDraft`), sending (`sendTest`, `sendMessage`, `retryFailed`, paced 600 ms), the log (`messageResult`, `earlierMessages`).
- `src/server/message-composer.ts`: the write → review → sent steps (`composerStep`, `blankState`, `sentHere`).
- `src/components/admin/MessageComposer.astro`: the page (who gets it with ticks and the waitlist switch, copy buttons with a fallback box, subject, message, "Review", "Send me a test"; review; sent with "Try again for the failed ones"; earlier emails).
- `src/pages/admin/classes/[sessionId]/email.astro` (`classEmail(id)`): Email the class.
- `src/pages/admin/families/[householdId]/email.astro` (`familyEmail(id)`): Email this family.
- `tests/unit/messages.test.ts` (14 tests), `tests/e2e/staff-messages.mjs`.

**Changed files**
- `src/lib/admin-links.ts`: **added `familyEmail(id)`** → `/admin/families/<id>/email` (+ its line in `tests/unit/admin-links.test.ts`).
- `src/pages/admin/families/[householdId].astro`: one "Email this family" button in the header (`data-email-family`), and its import. Nothing else.
- `src/server/email.ts` (compatible): `Email.to` may be a list; `emailHtml` paragraphs may be `{ html }` (already safe); `escapeHtml` exported; the dev mailbox stores a list as "a, b" and its log line adds `reply-to=` when given. Resend behavior is unchanged except passing a list through as `to`.
- `docs/back-office.md` (§1 table, new §11), `docs/security.md` (Resend now also receives staff emails), `README.md` (the new browser test).

**For Hannah:** "Email the class" on a class page opens the composer: every enrolled and trial family ticked, the waitlist one switch away, a test to herself, a review that says "Sending to 12 families", then one email per family to all its parents, from the site with replies going to `EMAIL_REPLY_TO`. Failed families show "Didn't send" with a retry button. Earlier emails are listed on the composer and on each family's page. "Copy emails" and "Copy phone numbers" give her the lists for Gmail BCC and group texts.
**For families:** one email per family (both parents on the same email), ending "Sent by Little Characters about <class>. Reply to this email to reach us."

## Proof

All with Stripe keys blanked, no `RESEND_API_KEY` (dev mailbox; unit test asserts `usesDevMailbox` is true; the server log shows `[dev mailbox]` lines for every email).
- `npm run check`: 0 errors, 0 warnings (9 hints, existing).
- `npm test`: 27 files, 538 tests passed.
- `npm run build`: complete.
- Browser tests on a fresh `tests/e2e/serve.sh`, in order: enroll-journey, trial-journey, content-editor, navigation, staff-foundation, staff-contacts, staff-classes, staff-families all passed; then `SERVER_LOG=<server output> node tests/e2e/staff-messages.mjs`: 46 checks passed, including: untick a family; Copy emails fills the clipboard; a refused clipboard shows the box with the phone numbers; test reaches only Hannah; review shows subject, message, "Sending to N families"; a double click on Send gives one email per ticked family, to all its parents, with the footer; reply-to `littlecharacterstheater@gmail.com` on each (from the server log); a reload and a re-POST of the same form send nothing (`&again=1`); Earlier emails row with families and sender; the family page lists the email per address; "Email this family" sends one email; 390 px with no sideways scroll and tap targets ≥ 44 px on composer, review, sent and family composer; no page errors.
- Note: an earlier run of the suite failed because I hadn't stopped the previous server (it reset the database under a running server). After stopping it by PID, the whole suite passed on a fresh server. That's the run reported above.
- Screenshots in `.orchestration/messages/shots/`: composer, review, sent (desktop and phone), family page's email list (desktop and phone), family composer (phone).
- Not tested in the browser: a failed send and the retry button (the dev mailbox can't fail). Covered by unit tests (`records a failed family as "didn't send", and tries again only for the failed ones`).

## Decisions

- **The one-time token is the `message` row's id.** The review form gets a random UUID; Send inserts the message with that id (`on conflict do nothing`). A second send finds the row and sends nothing. No migration, no memory state, survives restarts.
- **Retry claims rows first** (`failed` → `sent` in one update, then sends; back to `failed` on error), so two clicks can't send twice.
- **Rows written `sent` before sending, set `failed` on error.** If the server died mid-send, families not yet reached would show as sent. Chosen over the opposite (risking a second email to a family). Rare with ~15 families a class.
- **Sending happens in the request,** one at a time, 600 ms apart (Resend's default is 2 requests a second); no pause in development. 30 families ≈ 18 s. Simple; a background queue can come later if classes grow.
- **The composer shows family names and parent emails only, no children**, so opening it isn't audit-logged (the roster already is). Sends, tests and retries are logged without the text.
- **"Send me a test" isn't a `message` row** (it would show on no family page and count nowhere). Audit `admin.message.test`.
- **Family email footer:** "Sent by Little Characters." (the brief only gave the class wording).
- **Earlier emails on the family composer** list only that family's own (`kind: 'family'`) emails; the family page already lists all.
- **Reply-to proof in the browser test** comes from the server's dev-mailbox log line (optional `SERVER_LOG`), because the dev mailbox table has no reply-to column and a migration wasn't allowed. The unit tests assert reply-to on every send.
- **The waitlist switch** keeps the waitlist families' ticks in the form but the server ignores them unless the switch is on; JS hides that list while it's off.
- **Families without a parent email** are listed but can't be ticked.

## Open points

1. **The message sender's display name** comes from `user.name` ("Hannah Eppling"). Fine as is. Recommended: keep.
2. **Should unticked families be remembered per class?** Recommended: no for Phase 1 (each email starts with everyone ticked).
3. **`admin.css` badge tones** are still overridden by the base `.badge` rule (reported by earlier units). I restated the three tones in the composer's own styles, like the class and family pages do. Recommended: fix the order in `admin.css` once, then drop the page-level copies.

## Follow-up candidates

- Attachments, scheduled sends, texting from the site (out of Phase 1).
- A background queue for large sends (whole-term announcements to every family).
- "Email everyone this term" (all classes) using the same composer.
- Show failed sends on Needs attention.
- Resend webhooks for bounces (a "sent" row means Resend accepted it, not that it was delivered).

## Handoff

- **Routes:** `classEmail(id)` → `/admin/classes/<id>/email`; `familyEmail(id)` → `/admin/families/<id>/email` (new in `admin-links.ts`). `?sent=<messageId>` shows one sent email (only for that class or family); `&again=1` = already sent; `&retried=1` after a retry.
- **POST actions** (form field `action`): `test`, `review`, `edit`, `send` (needs `token`, `subject`, `body`, `family`[] for a class, `waitlist=1`), `retry` (`message`).
- **Functions (`src/server/messages.ts`):** `classAudience(sessionId)` / `familyAudience(householdId)` → `AudienceFamily { householdId, name, parents: { name, email, phone }[], waitlist }`; `pickRecipients(audience, { includeWaitlist, selected })`; `sendMessage({ token, kind, sessionId?, subject, body, footer, families, staffId }, { send?, paceMs? })` → `{ messageId, duplicate }`; `retryFailed(messageId, staffId, footer, opts)` → `{ retried }`; `messageResult(id)` → message + `families: { householdId, name, emails, failed }[]` + `failed`; `earlierMessages({ sessionId } | { householdId })` → `{ id, subject, sentAt, sender, families, failed }[]`. `send` is injectable for tests.
- **Data:** `message.id` = the form token. `message_recipient` one row per address; `status` `sent` | `failed`; `error` holds the email service's reason (≤200 characters). Audit actions: `admin.message.class`, `admin.message.family`, `admin.message.retry`, `admin.message.test` (entity `message`, id = message id; none for the test).
- **Today / Needs attention** could count `message_recipient` rows with `status = 'failed'` from the last week and link to `classEmail(sessionId) + '?sent=' + messageId`.
- **`sendEmail`** accepts `to: string | string[]`.

## Compaction

No compaction or restart occurred.
