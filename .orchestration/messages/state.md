# Messages unit: state

## Done
- `src/server/messages.ts`: audience, recipient picking, compose (paragraphs, links), sendTest, sendMessage (token = message id), retryFailed, messageResult, earlierMessages.
- `src/server/message-composer.ts`: the write → review → sent steps.
- `src/components/admin/MessageComposer.astro`, pages `classes/[sessionId]/email.astro`, `families/[householdId]/email.astro`.
- `familyEmail(id)` added to admin-links; "Email this family" link on the family page.
- `sendEmail`: `to` may be a list (compatible); `emailHtml` takes `{ html }` paragraphs; `escapeHtml` exported.
- Unit tests: tests/unit/messages.test.ts (pass). check passes. npm test passes (538).

## Decisions
- One-time token = the message row's id (insert on conflict do nothing). No migration, survives restarts.
- Composer shows family names and parents' emails only, no children: no audit for viewing it.
- Recipient rows are written `sent` before sending and changed to `failed` on error.

## Next
- Build, e2e test tests/e2e/staff-messages.mjs, screenshots, docs §11, report.
