# Roster changes: report

Branch `claude/bo-roster` (from `claude/blissful-archimedes-enun5m` at 45bc452). No compaction or restart occurred.

## Result

**What changes for Hannah.** On a class's page:
- **Add a child.** Find a child by name, then either:
  - **Send a sign-up link:** an email with `/enroll/<class>`; the family pays as usual.
  - **Add without charge:** needs a fresh sign-in, a reason and a confirm.
- **Remove**, under each child. Choose **Remove and stop payments** or **Remove only**, see exactly what changes, then confirm.
- **Offer the spot**, on each waitlisted child. The family has 48 hours. The row then shows "Offered …, expires …" and **Withdraw offer**. Once the time runs out it shows "Expired: offer to the next family".
- No-charge places show as "No charge, added by staff: <reason>" on the roster, on the family page and in a new **No charge** list on Payments.
- Today's "Waitlist openings" no longer counts places that are on offer.

**What changes for families.**
- They may get a sign-up link or an offer email ("A place opened in <class>. Sign up by <day and time> to take it.").
- With an open offer and a free place, they can pick the waitlisted child even when the class is full or set to waitlist only.
- When they pay, the child moves from the waitlist to the roster (the same enrollment, no duplicate).
- If the offer has ended, the link's page explains it kindly and the child stays on the waitlist.
- Nobody else's payments change.

**By file:**
- `src/server/roster-changes.ts` (new): all the logic (see Handoff).
- `drizzle/0010_roster_changes.sql` (+ snapshot, journal): two additive, nullable columns, `enrollment.no_charge_reason` and `audit_log.detail`.
- `src/server/db/schema.ts`: those two columns.
- `src/server/records.ts`: `audit()` takes an optional `detail`.
- `src/server/billing.ts`: `cancelRemainingInstallments(tx, orderId)` is pulled out of `stopRemainingPayments`. It is the same query, and `stopRemainingPayments` now calls it. Nothing else changed.
- `src/server/family-discount.ts`:
  - `countingEnrollments` skips no-charge enrollments: `!e.noChargeReason`, the one new rule.
  - `plan()` gets a `removing` enrollment.
  - New `previewRemovalEffect`.
- `src/server/family.ts`:
  - `checkPicks` lets a waitlisted child with an open offer through while a place is free. Otherwise it says the place was taken.
  - `priceOrder` ignores "waitlist only" when every child in the order holds an offer.
  - `fulfillOrder`: its enrollment upsert also clears `noChargeReason` and returns ids, and it marks open or expired offers for those enrollments `accepted` with the order id.
  - New `offeredStudents`, `placesFree`, `placeTakenNote`.
- `src/server/classes.ts`, `src/server/admin.ts`:
  - `RosterChild` gets `offer` (latest open or expired offer) and `noChargeReason`.
  - Offers past their time are marked expired when the roster is read.
  - The roster CSV says "Enrolled (no charge)".
- `src/server/today.ts`: `AttentionInput.offers`. "Waitlist openings" subtracts open offers (`openOfferCounts`, one more query in `loadCore`).
- `src/server/families.ts`: the family page's classes carry `noChargeReason`.
- Pages:
  - `src/pages/admin/classes/[sessionId].astro`: the three places, now visible.
  - `src/pages/admin/families/[householdId].astro`: the no-charge line.
  - `src/pages/admin/payments/index.astro`: the **No charge** list, shown only when there is one.
  - `src/pages/enroll/[sessionId].astro`: the offer note and the pickable offered child.
- Docs:
  - `docs/back-office.md`: §14, plus §8, §9 and §12 updated.
  - `docs/staff-billing.md`: Remove, Add and Offer, for Hannah.
  - `docs/portal.md`: the offer link; "Waitlist offer emails" taken off "Not built yet".
  - `docs/security.md`: the one free-text field in the audit log.
  - `README.md`: the new test.
- Tests:
  - `tests/unit/roster-changes.test.ts` (new, 14 tests).
  - `tests/e2e/staff-roster.mjs` (new).
  - `tests/e2e/staff-classes.mjs`: 2 lines changed (see Decisions).

## Proof

- `npm run check`: 0 errors, 0 warnings.
- `npm test`: 30 files, **584 tests passed**. The new money tests in `roster-changes.test.ts`:
  - removing the only child stops that order's 3 charges, and a preview saves nothing;
  - removing one of two children on an order leaves its charges scheduled and the preview names the sister;
  - "Remove only" leaves every payment identical;
  - the discount ends when a removal drops the family to one (Ava back from $80.75 to $95), the preview lists it in both modes first, and the "ended" email goes out;
  - a no-charge enrollment is never in `countingEnrollments`, adding one leaves every installment identical, and a later paid class still starts the discount normally;
  - an accepted offer gives one enrollment (same id), active with the order id, and the offer is `accepted` with that order id;
  - an expired offer is refused ("already on the waitlist"), shows as expired, and is marked expired when read;
  - a full class refuses an offer ("Sorry, the place … has been taken…"), and accepts it once a place frees;
  - also: withdrawn offers, the sign-up link logged as a `family` message and not sent twice, reason checks, full-class second confirm, a removed no-charge child who later pays (reason cleared), and Today's subtraction.
- **Browser tests:** `npm run build`, then `tests/e2e/serve.sh` on a fresh database, then every test in README order. All 12 pass: enroll-journey, trial-journey, content-editor, navigation, staff-foundation, staff-contacts, staff-classes, staff-families, staff-payments, staff-today, staff-messages (with `SERVER_LOG`), then staff-roster.
  - Before the fix, `staff-classes` failed at `maya.locator('summary')`: each child now has a second `<summary>` (Remove).
  - `staff-roster` covers:
    - a made-up family signs up monthly;
    - Add without charge, after a fresh-sign-in redirect whose address has an id, not a name; the reason is required; the child is on the roster with "No charge, added by staff: Scholarship", and on Payments;
    - the sign-up link email in the dev mailbox;
    - a child already in the class is refused;
    - Remove and stop payments: the preview reads "These charges are cancelled: Nov 1 $95, Dec 1 $95."; after the confirm the family is gone from "Families on autopay", and the family page shows Cancelled;
    - Offer then Withdraw on one waitlisted child, Offer on another; the family follows the emailed link to the waitlist-only class, pays, and the child is on the roster;
    - 390 px checks (no sideways scroll, no wrapped buttons, 44 px targets) on the add step, the Remove choices, the remove preview, and the class page with Offer open.
- **Billing script, Stripe keys blanked:**
  - Before my change, on a fresh database after enroll-journey and trial-journey, `npm run -s billing:run -- --today 2026-12-01` charged **$80.75 (Ava, family discount) and $55 (Maya, scholarship)**, matching your reference.
  - After: the same database, copied before that run and migrated by the new code, gave **$80.75 and $55**, identical.
  - On the database after the whole suite (staff-roster last), only Maya's $55 is due. Ava's December was marked paid by cash/check by `staff-payments.mjs` at 06:43, before staff-roster ran: the audit shows `installment.failed`, `pay_link_sent`, `paid_manually`, and her amount is still $80.75. So no family my test didn't touch changed.
- **Screenshots:** `.orchestration/roster-changes/shots/staff-roster/`. Desktop: add-find, add-confirm, remove-preview, waitlist-offered, class-after, family-page, offer-link. 390 px: add-confirm, remove-choices, remove-preview, class.

## Decisions

- **How a no-charge place is stored:** an enrollment with no order and `no_charge_reason` set. A new order plan would touch every reader of `order.plan` and would show the family a $0 receipt. The column also lets reports tell these apart.
- **`audit_log.detail`:** the task asks for the reason to be kept in the audit log, and the enrollment's copy is cleared if the family later pays. It is the only free text in the audit log; the form asks staff to leave out medical details.
- **The rule for the discount:** a no-charge enrollment never counts toward the 15% family discount. It is one line in `countingEnrollments` and tested.
- **The offer itself is the permission;** the `?offer=` link only adds the note. Sign-in doesn't carry query strings, and a family may sign in from elsewhere. Checkout's capacity check still decides, and offers don't hold places at checkout ("the first family to pay"). Today does subtract them.
- **An offer that ran out while the family was paying still counts** at fulfilment (marked accepted), like the checkout honours a payment already handed to Stripe.
- **Removing:**
  - Remove and stop runs in one transaction: cancel the enrollment, cancel the charges (shared helper), refresh the discount once. There is at most one "discount ended" email.
  - **Who counts as "still in the class":** an active or trial child on the same order. When the discount ends for a remaining sibling on the same order, the preview leaves out "for their other classes".
  - **Removing doesn't need a fresh sign-in,** like Stop payments.
- **Who can be added:**
  - **Refused:** a child already enrolled or on a trial ("already in this class").
  - **A waitlisted child:** gets Offer the spot instead of a link; Add without charge takes them off the waitlist and withdraws an open offer.
  - **A sign-up link to a full class** is allowed after "Send anyway". The warning says the family can only join the waitlist until a place opens: the checkout's capacity rule is unchanged.
- **The Offer button is a disclosure** ("Offer the spot", then "Send the offer") rather than one tap, so a slip doesn't email a family.
- **`staff-classes.mjs` lines 161 and 229:** `locator('summary')` became `locator('.kid__care > summary')`. The old selector became ambiguous because of my Remove disclosure; what it checks is unchanged.

## Open points

1. **`OFFER_HOURS = 48`**: Hannah to confirm. Recommended: keep 48; 24 is tight for working parents.
2. **No-charge places and the 15% discount:** Stephen to confirm that they never count. Recommended: confirm; otherwise a scholarship child would lower a sibling's paid tuition.
3. **Offers don't reserve a place at checkout.** Recommended: keep. Hannah offers one family per opening, and the Today count already subtracts them.
4. **Refunds and the last month after a removal:** none from the site. The preview says "Nothing already paid is refunded here. To give money back, refund it in the Stripe dashboard." Recommended: Hannah refunds part of the last paid month in Stripe when she wants to; build refunds in Phase 2.
5. **Removing a waitlisted child** isn't offered (it wasn't asked for). Recommended: add a "Take off the waitlist" in Phase 2 if Hannah needs it.

## Follow-up candidates

- A family-facing line in their account for an open offer ("A place is held for Olive until …").
- A "Take off the waitlist" action.
- A unit test with a session marked "waitlist only" in a test catalog. `priceOrder`'s `byOffer` branch is only covered by the browser test (Stories and Songs is waitlist-only there).
- `enroll-journey.mjs` line 226 clicks `[data-child]:has-text("Maya Rivera") summary` with `page.click`. That isn't strict, so it still picks the care details (first match); a tighter selector would be safer.

## Handoff

**Routes.** No new routes. Everything posts back to `classPage(id)` with an `action` field:
- `remove-check`, `remove` (`enrollmentId`, `mode` = `stop`|`only`);
- `find` (`q`);
- `add-check` (`studentId`, `way` = `link`|`free`), `add-free` (`studentId`, `reason`, `overFull`), `send-link` (`studentId`, `token`, `overFull`);
- `offer` (`enrollmentId`), `withdraw` (`offerId`).

Results come back as `?done=removed|removed-only|added|link|link-again|offered|withdrawn|gone`, with `n` and `fd`. After a fresh sign-in, staff return to `?add=<studentId>`.

**`src/server/roster-changes.ts`:**
- `OFFER_HOURS`, `REASON_MAX`, `RosterError`.
- `previewRemoval(enrollmentId, sessionId, mode)` returns `RemovalPreview` `{ enrollmentId, householdId, child, family, mode, orderId, staying: string[], stops, stopping: {dueDate, amountCents}[], effects: FamilyDiscountEffect[] }`.
- `removeChild(enrollmentId, sessionId, mode, staffId)` returns `{ stopped, familyDiscount }`, or null.
- `findChildren(q, sessionId, catalog)` and `addCandidate(studentId, sessionId, catalog)` return `AddCandidate` `{ studentId, householdId, name, firstName, family, age, status, ageNote }`; `addCandidate` adds `full`. `addProblem(c, way)`.
- `sendSignUpLink({ sessionId, studentId, staffId, overFull, token })`, `addWithoutCharge({ …, reason })`, `checkReason`, `noChargeLabel`, `noChargePlaces(catalog)`.
- `offerSpot({ enrollmentId, sessionId, staffId, now? })`, `withdrawOffer(offerId, sessionId, staffId)`, `expireOffers(now?, sessionId?)`, `offerStates(enrollmentIds)` (returns `Map<enrollmentId, OfferState>`), `openOfferCounts()` (returns `Record<sessionId, n>`), `familyOffer(offerId, householdId, sessionId)`, `offerDeadline(date)`.

**Elsewhere:**
- `family.ts`: `offeredStudents(householdId, sessionId)`, `placesFree(program, session)`, `placeTakenNote`.
- `billing.ts`: `cancelRemainingInstallments(tx, orderId)`.
- `family-discount.ts`: `previewRemovalEffect(householdId, enrollmentId, stoppingOrderId?)`.

**Audit actions:** `admin.roster.remove`, `admin.roster.remove_stop`, `installment.stop`, `admin.roster.add_no_charge` (with `detail` = reason), `admin.roster.signup_link`, `admin.waitlist.offer`, `admin.waitlist.withdraw`, `waitlist_offer.accepted`. Emails go through `sendMessage` (kind `family`).

**Data:** a no-charge place is `enrollment.status = 'active'`, `order_id` null, `no_charge_reason` set. Reports should treat `no_charge_reason is not null` as no charge.
