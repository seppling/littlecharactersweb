#!/usr/bin/env node
/**
 * End-to-end: the family's part of the details (emergency contacts, who may
 * pick up, ZIP code, how they heard about us), asked once per family.
 *
 * - A first enrollment needs an emergency contact and a ZIP code; the step
 *   works at 390 px with no sideways scrolling and 44 px tap targets.
 * - A second enrollment shows the family part as one line with "Edit".
 * - The account's Family details: shown, edited, saved.
 * - The imported Studio Director family checks theirs with "Looks right".
 * - Staff see "Staff" (not "Rosters") on their own account page.
 *
 * Run after the other five browser tests, on the same server:
 *
 *   npm run build && tests/e2e/serve.sh      # fresh local database + sample import
 *   node tests/e2e/staff-contacts.mjs [baseUrl] [screenshotDir]
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
const shot = async (name, target = page) => SHOTS && target.screenshot({ path: `${SHOTS}/${name}.png`, ...(target === page ? { fullPage: true } : {}) });
const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const phone = () => page.setViewportSize({ width: 390, height: 844 });
const desktop = () => page.setViewportSize({ width: 1280, height: 900 });

/** At 390 px: a screenshot, no sideways scrolling, and every visible control in `scope` at least 44 px tall. */
async function phoneCheck(name, scope) {
  await phone();
  await shot(`${name}-390`);
  const wide = await sideways();
  const small = scope
    ? await page.$$eval(`${scope} :is(input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), select, button, a.btn)`, (els) =>
        els.filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.id || e.textContent?.trim()),
      )
    : [];
  await desktop();
  check(wide <= 0 && !small.length, `${name} at 390 px: no sideways scrolling${scope ? ', tap targets 44 px or more' : ''}${small.length ? ` (too small: ${small.join(', ')})` : ''}`);
}

async function codeFor(email) {
  const mail = await ctx.newPage();
  try {
    for (let i = 0; i < 20; i++) {
      await mail.goto(`${BASE}/dev/mailbox`);
      const text = await mail.locator('li').filter({ hasText: `to ${email}` }).first().textContent().catch(() => '');
      const code = text?.match(/(\d{6}) is your Little Characters sign-in code/)?.[1];
      if (code) return code;
      await new Promise((r) => setTimeout(r, 250));
    }
  } finally {
    await mail.close();
  }
  throw new Error('No sign-in code arrived');
}

async function signIn(email) {
  await page.fill('#signin-email', email);
  // Every browser test signs in from the same address, so the 5-codes-a-minute
  // limit can be hit right after the other tests. Wait it out, like a person would.
  for (let tries = 0; ; tries++) {
    await page.click('[data-step="email"] button[type="submit"]');
    await page.waitForSelector('#signin-code:visible, [data-error]:visible');
    if (await page.locator('#signin-code').isVisible()) break;
    const error = await page.textContent('[data-error]');
    if (tries >= 2 || !/Too many tries/.test(error)) throw new Error(`Sign-in failed: ${error}`);
    console.log('· waiting a minute for the sign-in rate limit');
    await page.waitForTimeout(61_000);
  }
  const code = await codeFor(email);
  await Promise.all([page.waitForNavigation(), page.fill('#signin-code', code)]);
}

async function signOut() {
  await ctx.clearCookies();
}

/** Picks Nia for a class and goes on to the details step. */
async function startOrder(sessionId) {
  await page.goto(`${BASE}/enroll/${sessionId}`);
  await page.locator('label.pick:has-text("Nia Park") input[name="studentId"]').check();
  await Promise.all([page.waitForURL(/\/enroll\/details/), page.click('#students button[type="submit"]')]);
}

// ── 1. A new family's first enrollment ──
const email = `contacts+${Date.now()}@example.com`;
await page.goto(`${BASE}/enroll/intro-f26-tue`);
await signIn(email);
await page.fill('#p-name', 'Robin Park');
await page.fill('#p-phone', '706-555-0161');
await page.click('button[type="submit"]');
await page.waitForSelector('text=Add a student');
if (!(await page.locator('details.add').evaluate((d) => d.open))) await page.click('details.add summary');
await page.fill('#s-first', 'Nia');
await page.fill('#s-last', 'Park');
await page.fill('#s-bday', '2017-03-01');
await page.click('form:has(input[value="add-student"]) button[type="submit"]');
await page.waitForSelector('label.pick:has-text("Nia Park")');
await startOrder('intro-f26-tue');

check(await page.locator('[data-family-form] legend:has-text("Your family")').isVisible(), 'details step: a first-time family gets the “Your family” part');
check(await page.locator('[data-family-form] >> text=Little Characters staff see these, and from spring, the teachers of your children’s classes.').isVisible(), 'it says who sees the details');
check(await page.locator('#heard').isVisible(), '“How did you hear about us?” is asked');
await shot('1-details-new-family');
await phoneCheck('1-details-new-family', '[data-family-form]');

// The emergency contact is required: the browser asks first, and the server checks too.
await page.check('input[name^="photo-"][value="yes"]');
await page.fill('#zip', '30601');
await page.check('input[name="policies"]');
await page.click('button:has-text("Review & pay")');
check(page.url().includes('/enroll/details') && (await page.locator('#ec-0-name:invalid').count()) === 1, 'without an emergency contact, the browser stops on the first one');
await page.$$eval('[data-family-form] [required]', (els) => els.forEach((e) => e.removeAttribute('required')));
await Promise.all([page.waitForLoadState('load'), page.click('button:has-text("Review & pay")')]);
await page.waitForSelector('[data-family-form] .error:has-text("Add at least one emergency contact")');
check(page.url().includes('/enroll/details') && (await page.inputValue('#zip')) === '30601', 'the server asks for an emergency contact too, and keeps what was typed');

// Fill it in: one emergency contact, two pickup people ("Add another" opens a second row), "Something else".
await page.fill('#ec-0-name', 'Jordan Park');
await page.fill('#ec-0-relationship', 'Aunt');
await page.fill('#ec-0-phone', '706-555-0142');
await page.fill('#pu-0-name', 'Sam Ortiz');
await page.fill('#pu-0-relationship', 'Neighbor');
check(await page.locator('#pu-1-name').isHidden(), 'one empty pickup row to start');
await page.locator('[data-people="pu"] [data-add-person]').click();
await page.fill('#pu-1-name', 'Lou Park');
await page.fill('#pu-1-relationship', 'Grandpa');
await page.fill('#pu-1-phone', '(706) 555-0177');
check(await page.locator('#heard-other').isHidden(), 'the “Something else” box waits until it’s chosen');
await page.selectOption('#heard', 'other');
await page.fill('#heard-other', 'The farmers market');
await page.check('input[name^="photo-"][value="yes"]');
await page.check('input[name="policies"]');
await shot('1b-details-filled');
await Promise.all([page.waitForURL(/\/enroll\/review/), page.click('button:has-text("Review & pay")')]);
step('with an emergency contact and ZIP, the family goes on to Review & pay');

// ── 2. A second enrollment skips the family part ──
await startOrder('yesand-f26-wed');
const summary = (await page.textContent('[data-family-on-file] .summary'))?.trim();
check(summary === 'Emergency contact: Jordan Park (aunt) · Pickup: 2 people · ZIP 30601', `second enrollment: one line in place of the form (“${summary}”)`);
check(!(await page.locator('[data-family-form]').count()) && !(await page.locator('#heard').count()), 'no family form, and “How did you hear about us?” isn’t asked again');
await shot('2-details-on-file');
await phoneCheck('2-details-on-file', '[data-family-on-file]');
await Promise.all([page.waitForURL(/edit=family/), page.click('[data-family-on-file] a:has-text("Edit")')]);
check((await page.inputValue('#ec-0-phone')) === '(706) 555-0142' && (await page.inputValue('#pu-1-name')) === 'Lou Park', '“Edit” opens the form with what’s on file');
check(!(await page.locator('#heard').count()), 'the question stays answered');
await page.check('input[name="policies"]');
await Promise.all([page.waitForURL(/\/enroll\/review/), page.click('button:has-text("Review & pay")')]);

// ── 3. The account's Family details ──
await page.goto(`${BASE}/account`);
const fam = page.locator('[data-family]');
await fam.locator('text=Jordan Park, Aunt, (706) 555-0142').waitFor();
check(await fam.locator('text=Lou Park, Grandpa, (706) 555-0177').isVisible(), 'account: Family details lists the emergency contact and who may pick up');
check(!(await fam.locator('[data-family-confirm]').count()), 'just confirmed, so no “Looks right” yet');
check((await page.locator('.dash__actions a:has-text("Staff")').count()) === 0, 'families don’t get the staff link');
await shot('3-account-family', fam);
await phone();
await shot('3-account-family-390', fam);
await desktop();
await phoneCheck('3-account', '[data-family]');

await Promise.all([page.waitForURL(/\/account\/family/), fam.locator('[data-family-edit]').click()]);
await page.fill('#ec-0-phone', '706 555 0143');
await page.fill('#pu-0-phone', 'not a phone');
await Promise.all([page.waitForLoadState('load'), page.click('button:has-text("Save")')]);
await page.waitForSelector('.error:has-text("Enter a phone number, like 706-555-0142")');
step('a phone number that isn’t one is caught, next to its field');
await page.fill('#pu-0-phone', '');
await shot('3b-account-family-edit');
await phoneCheck('3b-account-family-edit', 'form.card');
await Promise.all([page.waitForURL(/\/account\?saved=family/), page.click('button:has-text("Save")')]);
await page.waitForSelector('[data-saved]:has-text("Saved. Your family details are up to date.")');
check(await fam.locator('text=Jordan Park, Aunt, (706) 555-0143').isVisible(), 'edits save and show on the account');

// ── 4. The imported family checks their details with "Looks right" ──
await signOut();
await page.goto(`${BASE}/account`);
await signIn('ana.okafor@example.com');
await page.waitForSelector('[data-welcome] >> text=Please check your family details and each child’s details below.');
await fam.locator('text=Femi Okafor, Uncle, (706) 555-0109').waitFor();
check(await fam.locator('dd:has-text("30605")').isVisible(), 'imported family: the emergency contact and ZIP from Studio Director are there');
check(await fam.locator('[data-family-confirm] >> text=Are these still right?').isVisible(), 'imported details aren’t confirmed: “Are these still right?”');
await shot('4-imported-family', fam);
await phoneCheck('4-imported-family', '[data-family]');
await Promise.all([page.waitForURL(/saved=family/), fam.locator('button:has-text("Looks right")').click()]);
await page.waitForSelector('[data-saved]:has-text("Saved. Your family details are up to date.")');
check(!(await fam.locator('[data-family-confirm]').count()) && (await fam.locator('text=Femi Okafor, Uncle, (706) 555-0109').isVisible()), '“Looks right” confirms them and changes nothing');

// ── 5. Staff see "Staff" on their account page ──
await signOut();
await page.goto(`${BASE}/account`);
await signIn('hannah@example.com');
if (await page.locator('#p-name').count()) {
  await page.fill('#p-name', 'Hannah Eppling');
  await page.fill('#p-phone', '706-555-0100');
  await page.click('button[type="submit"]');
}
const staffLink = page.locator('.dash__actions a:has-text("Staff")');
await staffLink.waitFor();
check((await staffLink.getAttribute('href')) === '/admin' && !(await page.locator('.dash__actions a:has-text("Rosters")').count()), 'staff: the account’s link reads “Staff” and opens Today');

check(!errors.length, `no script errors${errors.length ? `: ${errors.join('; ')}` : ''}`);
await browser.close();
console.log('\nAll family details checks passed.');
