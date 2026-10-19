#!/usr/bin/env node
/**
 * End-to-end: refunds, credits and the yearly statement (src/server/refunds.ts,
 * credits.ts, day-off-credits.ts, statements.ts).
 *
 * - Maya Rivera's family (the enrollment journey) paid their sign-up with the
 *   local test-payment stand-in. Hannah refunds part of it from the family's
 *   page: the form, more than is left refused, the preview, then "Refund $5".
 *   The family's page and the order page say "Partly refunded", and the
 *   family's email is in the dev mailbox.
 * - The month staff-payments marked "Paid by cash/check": "Record a refund
 *   given by cash or check", and Payments received lists the refund.
 * - A credit on the Riveras' page: where it goes before saving, their next
 *   payment lowered, "Credit: −$10, Missed class" in their own account, then
 *   removed and the payment back.
 * - Days off: "Give these credits" for Winter break (staff-calendar), once.
 * - The family's statement, downloaded by staff and by the family.
 * - At 390 px: nothing wider than the screen; on staff pages no button wraps
 *   and every target is 44 px.
 *
 * Run last, after every other browser test, on the same server:
 *
 *   npm run build && tests/e2e/serve.sh
 *   node tests/e2e/staff-refunds.mjs [baseUrl] [screenshotDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const SHOTS = process.argv[3];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const step = (msg) => console.log(`✓ ${msg}`);
function check(ok, msg) {
  if (!ok) throw new Error(`✗ ${msg}`);
  step(msg);
}
const shot = async (p, name) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const sideways = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const tooWide = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && el.getClientRects().length)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`),
  );
/** Buttons whose words wrap onto a second line. */
const brokenButtons = (p, scope = '.admin-page') =>
  p.evaluate((scope) =>
    [...document.querySelectorAll(`:is(${scope}) .btn`)]
      .filter((el) => el.getClientRects().length && !hiddenInDetails(el))
      .filter((el) => {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        const tops = new Set();
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (n.parentElement.closest('.sr-only') || !n.textContent.trim()) continue;
          const r = document.createRange();
          r.selectNodeContents(n);
          for (const x of r.getClientRects()) if (x.width > 0) tops.add(Math.round(x.top));
        }
        return tops.size > 1;
      })
      .map((el) => el.textContent.trim()),
  scope);
/** Links, buttons and fields in the page (not the shell) shorter than 44 px. */
const smallTargets = (p, scope = '.admin-page') =>
  p.evaluate(
    (scope) =>
      [...document.querySelectorAll(`:is(${scope}) :is(a, button, input:not([type="hidden"], [type="checkbox"], [type="radio"]), select, summary)`)]
        .filter((el) => el.getClientRects().length && !el.closest('.sr-only') && !hiddenInDetails(el))
        .filter((el) => el.getBoundingClientRect().height < 44)
        .map((el) => `${el.tagName.toLowerCase()} “${(el.textContent || el.getAttribute('name') || '').trim().slice(0, 30)}” ${Math.round(el.getBoundingClientRect().height)}px`),
    scope,
  );
await ctx.addInitScript(() => {
  window.hiddenInDetails = (el) => {
    const d = el.closest('details:not([open])');
    return !!d && !el.closest('details:not([open]) > summary');
  };
});

/** At 390 px: nothing sticks out; on a staff page, no button wraps and every target is 44 px (in `scope`: this unit's parts of a shared page). Takes the phone screenshot. */
async function phoneCheck(p, what, name, staff = true, scope = '.admin-page') {
  await p.setViewportSize({ width: 390, height: 844 });
  const extra = await sideways(p);
  check(extra <= 0, `${what}: no sideways scrolling at 390 px${extra > 0 ? ` (${(await tooWide(p)).join(', ')})` : ''}`);
  if (staff) {
    const broken = await brokenButtons(p, scope);
    check(broken.length === 0, `${what}: no button breaks onto two lines at 390 px${broken.length ? ` (${broken.join(', ')})` : ''}`);
    const small = await smallTargets(p, scope);
    check(small.length === 0, `${what}: links, buttons and fields are at least 44 px tall at 390 px${small.length ? ` (${small.join('; ')})` : ''}`);
  }
  if (name) await shot(p, name);
  await p.setViewportSize({ width: 1280, height: 900 });
}

/** The newest email to `to` whose text contains `has`, from the dev mailbox. */
async function mailTo(to, has) {
  const mail = await ctx.newPage();
  try {
    for (let i = 0; i < 20; i++) {
      await mail.goto(`${BASE}/dev/mailbox`);
      const text = await mail.locator('li').filter({ hasText: `to ${to}` }).filter({ hasText: has }).first().textContent().catch(() => '');
      if (text) return text;
      await new Promise((r) => setTimeout(r, 250));
    }
  } finally {
    await mail.close();
  }
  return '';
}
const codeFor = async (email) => (await mailTo(email, 'is your Little Characters sign-in code')).match(/(\d{6}) is your Little Characters sign-in code/)?.[1];

/** Types the email (unless it's filled in already) and the code, waiting out the 5-codes-a-minute limit. */
async function signIn(p, email) {
  if (!(await p.inputValue('#signin-email'))) await p.fill('#signin-email', email);
  for (let tries = 0; ; tries++) {
    await p.click('[data-step="email"] button[type="submit"]');
    await p.waitForSelector('#signin-code:visible, [data-error]:visible');
    if (await p.locator('#signin-code').isVisible()) break;
    const error = await p.textContent('[data-error]');
    if (tries >= 2 || !/Too many tries/.test(error)) throw new Error(`Sign-in failed: ${error}`);
    console.log('· waiting a minute for the sign-in rate limit');
    await p.waitForTimeout(61_000);
  }
  const code = await codeFor(email);
  await Promise.all([p.waitForEvent('load'), p.fill('#signin-code', code)]);
  await p.waitForTimeout(800);
}
const money = (s) => Number(s.replace(/[^\d.]/g, ''));

const HANNAH = 'hannah@example.com';
const YEAR = new Date().getFullYear();

// ── 0. Hannah signs in and opens the Riveras' page ──
await page.goto(`${BASE}/admin/search?q=Maya%20Rivera`);
await signIn(page, HANNAH);
await page.goto(`${BASE}/admin/search?q=Maya%20Rivera`);
await Promise.all([page.waitForURL(/\/admin\/families\//), page.locator('[data-results="children"] .hit').first().click()]);
const familyUrl = page.url();
const parentEmail = (await page.locator('[data-parents] .person .muted').first().textContent()).split('·')[0].trim();
check(/@example\.com$/.test(parentEmail), `the Riveras’ page, parent ${parentEmail}`);

// ── 1. Refund part of the sign-up payment ──
const signUpRow = page.locator('[data-payment-history] tr', { hasText: 'Sign-up: Intro to Theater' }).first();
check(await signUpRow.isVisible(), 'Payment history lists the sign-up payment');
const paid = money(await signUpRow.locator('td[data-label="Amount"]').textContent());
await Promise.all([page.waitForURL(/\/refund/), signUpRow.locator('[data-refund-link]').click()]);
const refundUrl = page.url();
check((await page.textContent('[data-payment]')).includes('Test payment'), 'the refund form shows the payment, paid by the test stand-in');
check((await page.textContent('[data-refund-form]')).includes(`All of it ($${paid % 1 ? paid.toFixed(2) : paid} left to refund)`), `“All of it ($${paid} left to refund)”`);
await shot(page, 'refund-form-desktop');
await phoneCheck(page, 'The refund form', 'refund-form-phone');

// More than is left: refused, nothing saved.
await page.check('input[name="how"][value="part"]');
await page.fill('#refund-amount', (paid + 1).toFixed(2));
await page.fill('#refund-reason', 'Testing the limit');
await page.click('button[value="preview"]');
check((await page.textContent('[data-refund-error]')).includes('more than is left to refund'), 'more than is left is refused');
check(!(await page.locator('[data-refunds]').count()), '… and nothing was saved');

// $5: the preview, then Refund $5.
await page.fill('#refund-amount', '5');
await page.fill('#refund-reason', 'Missed the first class');
await page.click('button[value="preview"]');
const preview = await page.textContent('[data-refund-preview]');
check(preview.includes('Refund $5 to the card') && preview.includes('“Refund of $5 for Sign-up: Intro to Theater (first month)”'), 'the preview shows the amount and the family’s email');
await shot(page, 'refund-preview-desktop');
await phoneCheck(page, 'The refund preview', 'refund-preview-phone');
await Promise.all([page.waitForURL(/done=/), page.click('[data-refund-confirm]')]);
check((await page.textContent('[data-refund-done]')).includes('Refunded $5.'), '“Refunded $5.”');
check((await page.textContent('[data-left]')).includes(`$${(paid - 5) % 1 ? (paid - 5).toFixed(2) : paid - 5}`), 'what’s left goes down by $5');
const mail = await mailTo(parentEmail, 'Refund of $5 for');
check(mail.includes('Refund of $5 for Sign-up: Intro to Theater (first month)') && mail.includes('5–10 days'), 'the family’s email is in the dev mailbox');

await page.goto(familyUrl);
const note = await page.locator('[data-payment-history] tr', { hasText: 'Sign-up: Intro to Theater' }).first().locator('[data-refunded]').textContent();
check(note.startsWith('Partly refunded: $5 of'), `the family’s page: “${note}”`);
await page.locator('[data-payment-history]').scrollIntoViewIfNeeded();
await shot(page, 'refunded-payment-desktop');
await phoneCheck(page, 'The family’s page (payment history, credits, statements)', 'refunded-payment-phone', true, '[data-payment-history], [data-family-credits], [data-statements]');
const orderUrl = new URL(refundUrl);
orderUrl.pathname = orderUrl.pathname.replace(/\/refund$/, '');
orderUrl.search = '';
await page.goto(orderUrl.toString());
check((await page.textContent('[data-payments-made]')).includes('Partly refunded: $5 of'), 'the order page says “Partly refunded”');

// ── 2. A cash payment: Record a refund given by cash or check ──
await page.goto(`${BASE}/admin/payments#received`);
const cashRow = page.locator('[data-received-list] tr', { hasText: 'Cash or check, marked by' }).first();
check(await cashRow.isVisible(), 'Payments received has the month staff-payments marked paid by cash or check');
const cashFor = (await cashRow.locator('td[data-label="For"]').textContent()).trim();
await Promise.all([page.waitForURL(/\/admin\/families\//), cashRow.locator('td[data-label="Family"] a').click()]);
const cashPayment = page.locator('[data-payment-history] tr', { hasText: cashFor }).first();
check((await cashPayment.textContent()).includes('Cash or check'), `the family’s page shows “${cashFor}” as cash or check`);
await Promise.all([page.waitForURL(/\/refund/), cashPayment.locator('[data-refund-link]').click()]);
check((await page.textContent('[data-refund-form] h2')).includes('Record a refund given by cash or check'), 'the form offers “Record a refund given by cash or check”');
await page.check('input[name="how"][value="part"]');
await page.fill('#refund-amount', '10');
await page.fill('#refund-reason', 'Gave $10 back in cash');
await page.uncheck('input[name="email"]');
await page.click('button[value="preview"]');
check((await page.textContent('[data-refund-preview]')).includes('Record $10 given back by cash or check'), 'the preview says it’s recorded, not sent to Stripe');
await Promise.all([page.waitForURL(/done=/), page.click('[data-refund-confirm]')]);
check((await page.textContent('[data-refund-done]')).includes('Recorded: $10 given back by cash or check.'), 'the cash refund is recorded');
await page.goto(`${BASE}/admin/payments#received`);
const refundLine = page.locator('[data-received-list] tr', { hasText: 'Refund by cash or check' }).first();
check((await refundLine.locator('td[data-label="Amount"]').textContent()).includes('−$10'), 'Payments received lists the refund as its own line, −$10');
check(/refunds?, /.test(await page.textContent('[data-received-total]')), 'the month’s total counts it');

// ── 3. A credit: where it goes, the payment lowered, the family sees it, removed ──
await page.goto(familyUrl);
await Promise.all([page.waitForURL(/\/credits$/), page.click('[data-add-credit]')]);
await page.fill('#credit-amount', '10');
await page.fill('#credit-reason', 'Missed class');
await page.check('input[name="show"]');
await shot(page, 'credit-form-desktop');
await phoneCheck(page, 'The credit form', 'credit-form-phone');
await page.click('button[value="preview"]');
const piece = page.locator('[data-credit-piece]').first();
const before = money(await piece.locator('td[data-label="Now"]').textContent());
const after = money(await piece.locator('td[data-label="After saving"]').textContent());
check(before - after === 10, `the preview: the next payment goes from $${before} to $${after}`);
await shot(page, 'credit-preview-desktop');
await phoneCheck(page, 'The credit preview', 'credit-preview-phone');
await Promise.all([page.waitForURL(/done=applied/), page.click('[data-save-credit]')]);
check((await page.textContent('[data-credits]')).includes('Comes off the'), 'the credit comes off the next payment');
await page.goto(familyUrl);
check((await page.textContent('[data-family-credits]')).includes('$10 Missed class'), 'the family’s page lists the credit');

// The family's own account.
const fam = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await fam.addInitScript(() => {
  window.hiddenInDetails = () => false;
});
const fp = await fam.newPage();
fp.on('pageerror', (e) => errors.push(e.message));
await fp.goto(`${BASE}/account`);
await signIn(fp, parentEmail);
await fp.goto(`${BASE}/account#pay-title`);
check((await fp.textContent('[data-credits]')).includes('Credit: −$10, Missed class'), 'the family sees “Credit: −$10, Missed class”');
check((await fp.textContent('[data-payments]')).includes('Credit · Missed class: −$10'), '… and on the payment it comes off');
check((await fp.locator('[data-receipts] [data-refunded]').first().textContent()).startsWith('Partly refunded: $5 of'), '… and the refund on the receipt');
await fp.locator('[data-credits]').scrollIntoViewIfNeeded();
await shot(fp, 'account-credit-desktop');
await phoneCheck(fp, 'The family’s account', 'account-credit-phone', false);
check((await smallTargets(fp, '[data-statement]')).length === 0, 'the statement links are 44 px tall');

// Removed: the payment goes back up.
await page.goto(familyUrl.replace(/\/?$/, '/credits'));
page.once('dialog', (d) => d.accept());
await Promise.all([page.waitForURL(/done=removed/), page.locator('[data-credit="applied"] [data-remove-credit]').first().click()]);
check(!(await page.locator('[data-credits] [data-credit="applied"]').count()), 'the credit is removed');
await fp.goto(`${BASE}/account`);
check(!(await fp.locator('[data-credits]').count()) && !(await fp.textContent('[data-payments]')).includes('Credit · Missed class'), 'the family’s payment is back as it was');

// ── 4. Days off: Give these credits (Winter break, from staff-calendar) ──
await page.goto(`${BASE}/admin/settings/days-off`);
const winter = page.locator('.off', { hasText: 'Winter break' }).first();
check((await winter.locator('[data-day-off-credits]').count()) === 1, 'Winter break lists the families already paid, with one class’s worth each');
await Promise.all([page.waitForURL(/done=credits/), winter.locator('[data-give-credits]').click()]);
check(/\d+ credits? given\./.test(await page.textContent('[data-notice]')), 'the credits are given');
check((await page.locator('.off', { hasText: 'Winter break' }).first().locator('[data-credits-given]').count()) === 1 && !(await page.locator('.off', { hasText: 'Winter break' }).first().locator('[data-give-credits]').count()), '… and can’t be given twice');
const credited = await page.locator('.off', { hasText: 'Winter break' }).first().locator('[data-credit-row="given"] a').first();
await Promise.all([page.waitForURL(/\/admin\/families\//), credited.click()]);
check((await page.textContent('[data-family-credits]')).includes('Day off Dec 15 (Winter break)'), 'the family’s page shows “Day off Dec 15 (Winter break)”');

// ── 5. The statement: staff and the family ──
await page.goto(familyUrl);
const staffCsv = await page.request.get(`${BASE}${new URL(familyUrl).pathname}/statement.csv?year=${YEAR}`);
const csv = await staffCsv.text();
check(staffCsv.ok() && csv.includes('Date,Child,For,Paid with,Amount ($)') && csv.includes('Refund: Sign-up: Intro to Theater') && csv.includes('Total paid less refunds'), 'staff download the statement (CSV): payments, the refund, the total');
const staffPdf = await page.request.get(`${BASE}${new URL(familyUrl).pathname}/statement.pdf?year=${YEAR}`);
check(staffPdf.ok() && (await staffPdf.body()).subarray(0, 4).toString() === '%PDF', '… and the PDF');
const famPdf = await fp.request.get(`${BASE}/account/statement.pdf?year=${YEAR}`);
check(famPdf.ok() && (await famPdf.body()).subarray(0, 4).toString() === '%PDF', 'the family downloads their own statement (PDF)');
const famCsv = await (await fp.request.get(`${BASE}/account/statement.csv?year=${YEAR}`)).text();
check(famCsv === csv, '… the same statement staff see');
if (SHOTS) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(`${SHOTS}/statement.pdf`, await famPdf.body());
}
const other = await browser.newContext();
check((await (await other.newPage()).request.get(`${BASE}/account/statement.csv?year=${YEAR}`)).status() === 401, 'signed out, there’s no statement');

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join('; ')}` : ''}`);
await browser.close();
console.log('\nAll refund, credit and statement checks passed.');
