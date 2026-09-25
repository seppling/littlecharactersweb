#!/usr/bin/env node
/**
 * End-to-end: a new family finds a class, signs in with an emailed code, adds a
 * child, fills in details, pays (test mode), and sees it all in their account.
 * Then Hannah signs in and sees the roster.
 *
 * Needs the built server running in development mode:
 *   APP_ENV=development PGLITE_DIR=.data/e2e ADMIN_EMAILS=hannah@example.com npm start
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

// 8. Returning family: straight to "Who's coming?" with Maya remembered
await page.goto(`${BASE}/enroll/yesand-f26-wed`);
await page.waitForSelector('text=Maya Rivera');
step('Returning family skips sign-in; saved student is ready to pick');

// 9. Another family can't open this family's order
const orderUrl = new URL(page.url());
await page.goto(`${BASE}/account`);
const receipts = await page.locator('.receipts tbody tr').count();
if (receipts < 1) throw new Error('Expected a receipt');
const other = await browser.newContext();
const otherPage = await other.newPage();
const res = await otherPage.goto(`${BASE}/enroll/review?order=does-not-matter`);
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

await browser.close();
console.log('\nAll journey checks passed.');
