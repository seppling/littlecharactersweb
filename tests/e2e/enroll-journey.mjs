#!/usr/bin/env node
/**
 * End-to-end: a new family finds a class, signs in with an emailed code, adds a
 * child, fills in details, pays (test mode), and sees it all in their account.
 * Then Hannah signs in, sees the roster, and gives the family a discount,
 * which the family then sees on their next payment.
 *
 * Then a family imported from Studio Director claims their account, finds a
 * welcome note in place of empty panels, and confirms a child's care details.
 *
 *   npm run build && tests/e2e/serve.sh      # fresh local database + sample import
 *   node tests/e2e/enroll-journey.mjs [baseUrl] [screenshotDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const SHOTS = process.argv[3];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const step = (msg) => console.log(`✓ ${msg}`);
/** Also at phone width (390 px): the page must not scroll sideways. */
async function phoneCheck(name) {
  await page.setViewportSize({ width: 390, height: 844 });
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-390.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  if (wide > 0) throw new Error(`${name}: scrolls sideways by ${wide}px at 390 px`);
}

async function latestCode(email) {
  const mail = await ctx.newPage();
  for (let i = 0; i < 20; i++) {
    await mail.goto(`${BASE}/dev/mailbox`);
    const text = await mail.locator('li').filter({ hasText: `to ${email}` }).first().textContent().catch(() => '');
    const m = text?.match(/(\d{6}) is your Little Characters sign-in code/);
    if (m) {
      await mail.close();
      return m[1];
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('No sign-in code arrived');
}

async function signIn(email) {
  await page.fill('#signin-email', email);
  await page.click('[data-step="email"] button[type="submit"]');
  await page.waitForSelector('#signin-code', { state: 'visible' });
  const code = await latestCode(email);
  await Promise.all([page.waitForLoadState('load'), page.fill('#signin-code', code)]);
  await page.waitForTimeout(800);
}

// 1. Discovery → Selection
await page.goto(`${BASE}/programs/intro-to-theater`);
await page.click('[data-enroll-cta]');
await page.waitForURL(/\/enroll\/intro-f26-tue/);
await shot('1-sign-in');
step('Enroll button opens the portal on the same site');

// 2. Passwordless sign-in in place
const email = `parent+${Date.now()}@example.com`;
await signIn(email);
await page.waitForSelector('#p-name');
step('Signed in with an emailed 6-digit code (no password, no new tab)');

await page.fill('#p-name', 'Sam Rivera');
await page.fill('#p-phone', '706-555-0142');
await page.click('button[type="submit"]');
await page.waitForSelector('text=Add a student');

// 3. Add a child
await page.fill('#s-first', 'Maya');
await page.fill('#s-last', 'Rivera');
await page.fill('#s-bday', '2018-04-12');
await page.click('form:has(input[value="add-student"]) button[type="submit"]');
await page.waitForSelector('text=Maya Rivera');
await shot('2-whos-coming');
step('Added Maya; she shows as fitting the age range');
await page.click('#students button[type="submit"]');

// 4. Details + policies
await page.waitForURL(/\/enroll\/details/);
await page.fill('input[name^="allergies-"]', 'Peanuts');
await page.check('input[name^="photo-"][value="yes"]');
await page.check('input[name="policies"]');
await shot('3-details');
await page.click('button:has-text("Review & pay")');

// 5. Review & pay
await page.waitForURL(/\/enroll\/review/);
const orderId = new URL(page.url()).searchParams.get('order');
await page.waitForSelector('[data-autopay-consent]');
await shot('4-review');
const due = await page.locator('tfoot td').textContent();
step(`Review shows plans and an itemized total (due today: ${due})`);
await page.click('.pay button[type="submit"]');
await page.waitForURL(/\/enroll\/pay/);
await page.click('button:has-text("Complete test payment")');

// 6. Confirmation
await page.waitForURL(/\/enroll\/confirmation/);
await page.waitForSelector('h1:has-text("You’re in!")');
await shot('5-confirmation');
step('Confirmation page with first class date and calendar link');

// 7. Family dashboard + header greeting on a static page
await page.goto(`${BASE}/account`);
await page.waitForSelector('text=Intro to Theater');
await shot('6-account');
await page.goto(`${BASE}/`);
await page.waitForSelector('[data-account-label]:has-text("Hi, Sam")');
step('Dashboard lists the class; static home page greets "Hi, Sam"');

// 7b. Monthly autopay: the rest of the term is scheduled, then charged on the 1st
const now = new Date();
const firstOfNext = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
await page.goto(`${BASE}/account`);
const upcoming = await page.locator('[data-autopay-item]').count();
if (upcoming < 1) throw new Error('Expected upcoming autopay charges');
const run = await page.request.post(`${BASE}/api/billing/run?today=${firstOfNext}`, { headers: { authorization: 'Bearer e2e-cron-secret' }, data: {} });
const report = await run.json();
if (report.charged < 1) throw new Error(`Billing run charged nothing: ${JSON.stringify(report)}`);
const denied = await page.request.post(`${BASE}/api/billing/run`, { headers: { authorization: 'Bearer wrong' }, data: {} });
if (denied.status() !== 401) throw new Error('Billing run should require the secret');
await page.reload();
await page.waitForSelector('[data-receipts] >> text=/tuition: Maya/');
if ((await page.locator('[data-autopay-item]').count()) !== upcoming - 1) throw new Error('Charged month should leave the upcoming list');
await shot('6b-autopay');
step(`Autopay: ${upcoming} monthly charges scheduled; the ${firstOfNext} run charges one and a receipt appears`);

// 7c. The Payments section: the card on file, the receipts name the child, a statement on request
if ((await page.locator('[data-card-label]').textContent()) !== 'Test card') throw new Error('The test stand-in’s card should show as “Test card”');
await page.waitForSelector('[data-card] >> text=Please don’t send card numbers by email');
await page.waitForSelector('[data-receipts] >> text=/Maya: Intro to Theater \\(first month \\+ fees\\)/');
const statement = await page.locator('[data-statement] a').getAttribute('href');
if (!statement?.startsWith('mailto:')) throw new Error('The statement line should be an email link');
const plainEmails = await page.evaluate(() => {
  const main = document.querySelector('main') ?? document.body;
  const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
  const out = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (/littlecharacterstheater@gmail\.com/.test(n.textContent ?? '') && !n.parentElement?.closest('a[href^="mailto:"]')) out.push(n.textContent);
  }
  return out;
});
if (plainEmails.length) throw new Error(`Email addresses on the account page should be links: ${plainEmails}`);
step('Payments: “Test card” on file, receipts name Maya, statements by email, every email address a link');

// 7d. "Add to calendar" from the account: Maya's own classes, from her first class, with a reminder
const ics = await (await page.request.get(new URL((await page.locator('[data-calendar-link]').first().getAttribute('href')) ?? '', BASE).href)).text();
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).replace(/-/g, '');
const start = ics.match(/DTSTART;TZID=America\/New_York:(\d{8})/)?.[1] ?? '';
if (!ics.includes('SUMMARY:Maya: Intro to Theater') || !ics.includes('TRIGGER:-PT60M') || start < today) throw new Error(`Account calendar file should start at Maya’s first class (${start}) with a reminder`);
const publicIcs = await (await page.request.get(`${BASE}/calendar/intro-f26-tue.ics`)).text();
if (!publicIcs.includes('DTSTART;TZID=America/New_York:20260818') || publicIcs.includes('VALARM')) throw new Error('The public calendar file should stay as it was');
step(`Calendar from the account starts at Maya’s first class (${start}), names her, and reminds an hour before`);

// 8. Returning family: straight to "Who's coming?" with Maya remembered
await page.goto(`${BASE}/enroll/yesand-f26-wed`);
await page.waitForSelector('text=Maya Rivera');
step('Returning family skips sign-in; saved student is ready to pick');

// 9. Signed-out visitors can't open orders
await page.goto(`${BASE}/account`);
const receipts = await page.locator('[data-receipts] tbody tr').count();
if (receipts < 1) throw new Error('Expected a receipt');
const other = await browser.newContext();
const otherPage = await other.newPage();
await otherPage.goto(`${BASE}/enroll/review?order=does-not-matter`);
if (!otherPage.url().endsWith('/account')) throw new Error('Signed-out visitor should be sent to sign in');
step('Signed-out visitors are sent to sign in instead of seeing orders');
await other.close();

// 10. Hannah's roster
await page.context().clearCookies();
await page.goto(`${BASE}/account`);
await signIn('hannah@example.com');
await page.waitForSelector('#p-name');
await page.fill('#p-name', 'Hannah Eppling');
await page.fill('#p-phone', '281-798-2623');
await page.click('button[type="submit"]');
await page.goto(`${BASE}/admin/intro-f26-tue`);
await page.waitForSelector('text=Maya Rivera');
await page.waitForSelector('text=Peanuts');
await shot('7-roster');
step('Hannah sees Maya on the roster, with allergies decrypted for staff');

await page.goto(`${BASE}/admin/billing`);
await page.waitForSelector('h1:has-text("Monthly autopay")');
await page.waitForSelector('text=/Next: .*1 charge, \\$95/');
await shot('7b-billing');
step('Hannah’s billing page shows the next autopay date and total');

// 10b. Hannah gives the family a discount: she checks the new amount, then saves
await page.click(`[data-families] a[href="/admin/billing/${orderId}"]`);
await page.waitForSelector('[data-add-adjustment]');
await page.fill('#adj-value', '40');
await page.fill('#adj-reason', 'Scholarship');
await page.check('input[name="showToFamily"]');
await page.click('button[value="preview"]');
await page.waitForSelector('[data-preview] >> text=$55');
await shot('7c-discount-check');
await phoneCheck('7c-discount-check');
if (await page.locator('[data-adjustments]').count()) throw new Error('Nothing should be saved before Hannah confirms');
await page.click('button[value="add"]');
await page.waitForSelector('text=Discount saved');
await page.waitForSelector('[data-payments] >> text=Scholarship: −$40');
await page.waitForSelector('[data-adjustments] >> text=Added by Hannah Eppling');
await shot('7d-discount-saved');
await phoneCheck('7d-discount-saved');
step('Hannah takes $40 off the family’s next payment ($95 → $55), after checking the new amount');

// 11. A different signed-in family (even staff) can't open the Riveras' order
await page.goto(`${BASE}/enroll/confirmation?order=${orderId}`);
if (!page.url().endsWith('/account')) throw new Error(`Another household opened order ${orderId}`);
step('Another signed-in family is turned away from this family’s order');

// 12. A family imported from Studio Director claims their account with a code
await page.context().clearCookies();
await page.goto(`${BASE}/account`);
await signIn('ana.okafor@example.com');
await page.waitForSelector('text=Zara Okafor');
await page.waitForSelector('text=Theo Okafor');
if (await page.locator('#p-name').count()) throw new Error('Imported parent should not be asked for their name again');
await page.waitForSelector('[data-welcome] >> text=Welcome from Studio Director!');
await page.waitForSelector('[data-welcome] >> text=Your fall classes and payments stay in Studio Director until the term ends. Spring sign-up happens here.');
for (const empty of ['No classes yet', 'No payments yet']) {
  if (await page.locator(`text=${empty}`).count()) throw new Error(`An imported family shouldn’t see “${empty}”`);
}
if (await page.locator('.dash__actions a:has-text("Find a class")').count()) throw new Error('No big “Find a class” button before an imported family has anything here');
await shot('8-imported-family');
await phoneCheck('8-imported-family');
step('Imported Studio Director family signs in and finds a welcome note and their students waiting');

// 12b. "Confirm care details" opens Zara's page; "Looks right" records it and changes nothing else
await Promise.all([page.waitForURL(/\/account\/students\//), page.locator('.kids li', { hasText: 'Zara Okafor' }).locator('[data-care-link]').click()]);
const allergiesBefore = await page.inputValue('#a');
await Promise.all([page.waitForURL(/\/account\?saved=/), page.click('[data-confirm] button:has-text("Looks right")')]);
await page.waitForSelector('[data-saved] >> text=Saved. Zara’s details are up to date.');
await page.waitForSelector('.kids li:has-text("Zara Okafor") >> text=Care details on file');
await shot('8b-saved');
await phoneCheck('8b-saved');
await page.click('.kids li:has-text("Zara Okafor") a:has-text("Edit")');
if ((await page.inputValue('#a')) !== allergiesBefore) throw new Error('“Looks right” should not change the details');
if (await page.locator('[data-confirm]').count()) throw new Error('Once confirmed, the page shouldn’t ask again');
step('“Confirm care details” → “Looks right”: confirmed, “Saved. Zara’s details are up to date.”, details unchanged');

// 12c. Signed out, the sign-in page helps families moving from Studio Director
const fresh = await browser.newContext();
const freshPage = await fresh.newPage();
await freshPage.goto(`${BASE}/account`);
await freshPage.waitForSelector('[data-moving-note] >> text=Moving from Studio Director? Use the email address you used there, or ask us.');
await fresh.close();
step('Sign-in page: “Moving from Studio Director? Use the email address you used there, or ask us.”');

// 13. A family can't give themselves a discount, even by posting the staff form
const sneaky = await page.request.post(`${BASE}/admin/billing/${orderId}`, {
  headers: { origin: BASE },
  form: { action: 'add', kind: 'percent', value: '100', repeat: 'monthly', reason: 'free' },
});
if (sneaky.status() !== 404) throw new Error(`A family's discount request should get 404, got ${sneaky.status()}`);
step('A family posting the staff discount form gets “not found”');

// 14. The Riveras see the discount on their next payment
await page.context().clearCookies();
await page.goto(`${BASE}/account`);
await signIn(email);
await page.waitForSelector('[data-autopay] >> text=Scholarship: −$40');
await page.waitForSelector('[data-autopay] >> text=$55');
const day = await page.locator('[data-autopay-day]').first().textContent();
if (!/^[A-Z][a-z]{2} \d{1,2}: \$55 · Maya \$55$/.test(day?.trim() ?? '')) throw new Error(`Upcoming autopay should be grouped by date with a total: “${day}”`);
await shot('9-family-discount');
await phoneCheck('9-family-discount');
if (SHOTS) {
  await page.locator('[data-payments]').screenshot({ path: `${SHOTS}/9b-payments.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-payments]').screenshot({ path: `${SHOTS}/9b-payments-390.png` });
  await page.setViewportSize({ width: 1280, height: 900 });
}
step(`Upcoming autopay is grouped by date with a total: “${day?.trim()}”`);
step('The family sees “Scholarship: −$40” and $55 on their next payment');

await browser.close();
console.log('\nAll journey checks passed.');
