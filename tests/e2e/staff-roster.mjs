#!/usr/bin/env node
/**
 * End-to-end: roster changes on a class's page (src/server/roster-changes.ts).
 *
 * - Remove a child: the preview says which charges stop, the confirm removes
 *   them; the Payments page no longer lists the family on autopay, and the
 *   family page shows the class as cancelled.
 * - Add a child without charge: a fresh sign-in, a reason, then the child is
 *   on the roster and "No charge, added by staff: …" is on Payments and the
 *   family page.
 * - Send a sign-up link: the email in the dev mailbox.
 * - Offer the spot: a waitlisted family gets the email, signs up through its
 *   link although the class is waitlist-only, and is on the roster; the
 *   waitlist shows "Offered …, expires …"; Withdraw offer takes it back.
 * - At 390 px: nothing wider than the screen, buttons whole, 44 px targets.
 *
 * Makes its own made-up families (the Lanes and the Marsh family). Run last,
 * after the other browser tests, on the same server:
 *
 *   npm run build && tests/e2e/serve.sh
 *   node tests/e2e/staff-roster.mjs [baseUrl] [screenshotDir]
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
const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const tooWide = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && el.getClientRects().length)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`),
  );
/** Buttons whose words wrap onto a second line. */
const brokenButtons = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.admin-page .btn')]
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
  );
/** Links, buttons and fields in the page (not the shell) shorter than 44 px. */
const smallTargets = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.admin-page a, .admin-page button, .admin-page input:not([type="hidden"], [type="checkbox"], [type="radio"]), .admin-page summary')]
      .filter((el) => el.getClientRects().length && !el.closest('.sr-only') && !hiddenInDetails(el))
      // 43.99, not 44: a button still sliding back from its hover lift measures 43.99999 px (a sub-pixel transform).
      .filter((el) => el.getBoundingClientRect().height < 43.99)
      .map((el) => `${el.tagName.toLowerCase()} “${(el.textContent || el.getAttribute('name') || '').trim().slice(0, 30)}” ${Math.round(el.getBoundingClientRect().height)}px`),
  );
// Inside a closed <details> (not its summary), Chromium keeps boxes it doesn't show: leave those out of the checks.
await ctx.addInitScript(() => {
  window.hiddenInDetails = (el) => {
    const d = el.closest('details:not([open])');
    return !!d && !el.closest('details:not([open]) > summary');
  };
});
const phone = () => page.setViewportSize({ width: 390, height: 844 });
const desktop = () => page.setViewportSize({ width: 1280, height: 900 });

/** At 390 px: nothing sticks out, no button wraps, every target is 44 px. Takes the phone screenshot. */
async function phoneCheck(what, name) {
  await phone();
  const extra = await sideways();
  check(extra <= 0, `${what}: no sideways scrolling at 390 px${extra > 0 ? ` (${(await tooWide()).join(', ')})` : ''}`);
  const broken = await brokenButtons();
  check(broken.length === 0, `${what}: no button breaks onto two lines at 390 px${broken.length ? ` (${broken.join(', ')})` : ''}`);
  const small = await smallTargets();
  check(small.length === 0, `${what}: links, buttons and fields are at least 44 px tall at 390 px${small.length ? ` (${small.join('; ')})` : ''}`);
  if (name) await shot(page, name);
  await desktop();
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

/** The details step: the family's part only when it's asked for; then the policies. */
async function details(p) {
  await p.waitForURL(/\/enroll\/details/);
  if (await p.locator('#ec-0-name').isVisible()) {
    await p.fill('#ec-0-name', 'Robin Lane');
    await p.fill('#ec-0-relationship', 'Aunt');
    await p.fill('#ec-0-phone', '706-555-0190');
    await p.fill('#zip', '30606');
  }
  for (const radio of await p.locator('input[name^="photo-"][value="yes"]:visible').all()) await radio.check();
  await p.check('input[name="policies"]');
  await p.click('button:has-text("Review & pay")');
  await p.waitForURL(/\/enroll\/review/);
}

/** A new family on the site: sign in, name and phone, their children. Returns the family's page. */
async function newFamily(email, name, kids, sessionId) {
  const fam = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await fam.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(`${BASE}/enroll/${sessionId}`);
  await signIn(p, email);
  await p.waitForSelector('#p-name');
  await p.fill('#p-name', name);
  await p.fill('#p-phone', '706-555-0189');
  await p.click('button[type="submit"]');
  await p.waitForSelector('text=Add a student');
  for (const [first, last, birthday] of kids) {
    if (!(await p.locator('#s-first').isVisible())) await p.click('details.add > summary');
    await p.fill('#s-first', first);
    await p.fill('#s-last', last);
    await p.fill('#s-bday', birthday);
    await p.click('form:has(input[value="add-student"]) button[type="submit"]');
    await p.waitForSelector(`text=${first} ${last}`);
  }
  return { fam, p };
}

/** Tick exactly these children on the "Who's coming" step and go on. */
async function pick(p, names) {
  for (const box of await p.locator('#students input[name="studentId"]:not([disabled])').all()) await box.uncheck();
  for (const n of names) await p.locator('label.pick', { hasText: n }).locator('input').check();
  await p.click('#students button[type="submit"]');
}

const HANNAH = 'hannah@example.com';
const INTRO = 'intro-f26-tue';
const STORIES = 'stories-songs-f26';
const stamp = Date.now();

// ── 0. Hannah signs in ──
await page.goto(`${BASE}/admin/classes/${INTRO}`);
await signIn(page, HANNAH);
await page.waitForSelector('h1:has-text("Intro to Theater")');
check(await page.locator('[data-roster-tools]').isVisible(), 'the class page has “Add a child”');

// ── 1. The Lanes sign Ivy up for Intro to Theater, paying monthly. Theo and Wren are saved too. ──
const laneEmail = `lane+${stamp}@example.com`;
const lane = await newFamily(laneEmail, 'Casey Lane', [['Ivy', 'Lane', '2017-06-01'], ['Theo', 'Lane', '2018-02-02'], ['Wren', 'Lane', '2017-09-09']], INTRO);
await pick(lane.p, ['Ivy Lane']);
await details(lane.p);
await lane.p.check('input[name="plan"][value="monthly"]');
await lane.p.waitForURL(/plan=monthly/);
await lane.p.click('.pay button[type="submit"]');
await lane.p.waitForURL(/\/enroll\/pay/);
await lane.p.click('button:has-text("Complete test payment")');
await lane.p.waitForSelector('h1:has-text("You’re in!")');
step('a made-up family (the Lanes) signs Ivy up for Intro to Theater, monthly');

// ── 2. Add a child without charge: Theo ──
await page.goto(`${BASE}/admin/classes/${INTRO}`);
await page.click('[data-roster-tools] summary:has-text("Add a child")');
await page.fill('#find-q', 'Theo Lane');
await page.click('[data-find] button[value="find"]');
check(!page.url().includes('Theo'), 'the search goes by form post: the child’s name never goes in the address');
const theo = page.locator('[data-add-child]', { hasText: 'Theo Lane' });
check(await theo.isVisible(), 'the staff search finds Theo Lane, with his age and family');
await shot(page, 'roster-add-find');
// After 15 minutes, a no-charge add asks Hannah to confirm it's her first.
const aged = await page.request.post(`${BASE}/dev/age-session`, { form: { minutes: '20' }, headers: { origin: BASE } });
check(aged.status() === 204, 'test-only: the session is aged by 20 minutes');
await Promise.all([page.waitForURL(/\/admin\/confirm\?next=/), theo.locator('button:has-text("Add without charge")').click()]);
check(!decodeURIComponent(page.url()).includes('Theo'), 'Add without charge needs a fresh sign-in; the return address has an id, not a name');
await signIn(page, HANNAH);
await page.waitForSelector('[data-add-confirm="free"]');
check((await page.textContent('[data-add-confirm] h2')).includes('Add Theo Lane without charge?'), 'back on the class page, at Theo’s confirm step');
await page.click('[data-add-confirm] button[value="add-free"]');
check(await page.locator('#add-reason:invalid').count(), 'a reason is required');
await page.fill('#add-reason', 'Scholarship');
await shot(page, 'roster-add-confirm');
await phoneCheck('the add confirm step', 'roster-add-confirm-390');
await Promise.all([page.waitForURL(/done=added/), page.click('[data-add-confirm] button[value="add-free"]')]);
check((await page.textContent('[data-notice]')).includes('Added to the class, with no charge.'), 'it says Theo was added with no charge');
const theoRow = page.locator('.kid', { hasText: 'Theo Lane' });
check((await theoRow.locator('[data-no-charge]').textContent()).trim() === 'No charge, added by staff: Scholarship', 'Theo is on the roster: “No charge, added by staff: Scholarship”');
await page.goto(`${BASE}/admin/payments`);
const noCharge = page.locator('[data-no-charge-list] tr', { hasText: 'Theo Lane' });
check((await noCharge.textContent()).includes('No charge, added by staff: Scholarship'), 'Payments lists Theo under “No charge”');

// ── 3. A sign-up link: Wren ──
await page.goto(`${BASE}/admin/classes/${INTRO}`);
await page.click('[data-roster-tools] summary:has-text("Add a child")');
await page.fill('#find-q', 'Wren Lane');
await page.click('[data-find] button[value="find"]');
await page.locator('[data-add-child]', { hasText: 'Wren Lane' }).locator('button:has-text("Send a sign-up link")').click();
await page.waitForSelector('[data-add-confirm="link"]');
await Promise.all([page.waitForURL(/done=link/), page.click('[data-add-confirm] button[value="send-link"]')]);
check(/Sign-up link sent to 1 parent\./.test(await page.textContent('[data-notice]')), 'it says the sign-up link went to 1 parent');
const linkMail = await mailTo(laneEmail, 'Sign up for Intro to Theater');
check(linkMail.includes(`/enroll/${INTRO}`) && linkMail.includes('Wren'), 'the dev mailbox has “Sign up for Intro to Theater” with the class’s sign-up link');
// A child already in the class can't be added again.
await page.click('[data-roster-tools] summary:has-text("Add a child")');
await page.fill('#find-q', 'Ivy Lane');
await page.click('[data-find] button[value="find"]');
check((await page.locator('[data-add-child]', { hasText: 'Ivy Lane' }).textContent()).includes('Ivy is already in this class.'), 'a child already in the class can’t be added again');

// ── 4. Remove Ivy: preview, then confirm; her payments stop ──
await page.goto(`${BASE}/admin/payments`);
check((await page.locator('[data-families] tr', { hasText: 'Lane' }).count()) === 1, 'before: the Lanes are on autopay');
await page.goto(`${BASE}/admin/classes/${INTRO}`);
const ivy = page.locator('.kid', { hasText: 'Ivy Lane' });
await ivy.locator('summary:has-text("Remove")').click();
await phoneCheck('the Remove choices', 'roster-remove-choices-390');
await ivy.locator('button[value="stop"]').click();
await page.waitForSelector('[data-remove-check="stop"]');
const preview = await page.textContent('[data-remove-check]');
check(preview.includes('Remove Ivy Lane from Intro to Theater?'), 'the preview names the child and class');
check(/These charges are cancelled: (\w{3} \d+ \$95, )*\w{3} \d+ \$95\./.test(preview), `the preview lists the charges that stop (“${preview.match(/These charges[^.]*\./)?.[0]}”)`);
check(preview.includes('No other payment changes.'), 'and says nothing else changes (Theo’s no-charge place doesn’t count toward the family discount)');
await shot(page, 'roster-remove-preview');
await phoneCheck('the remove preview', 'roster-remove-preview-390');
await Promise.all([page.waitForURL(/done=removed/), page.click('[data-remove-check] button[value="remove"]')]);
check(/Removed from the class\. \d+ upcoming charges? stopped\./.test(await page.textContent('[data-notice]')), `it says “${(await page.textContent('[data-notice]')).trim()}”`);
check((await page.locator('.kid', { hasText: 'Ivy Lane' }).count()) === 0, 'Ivy is off the roster');
await page.goto(`${BASE}/admin/payments`);
check((await page.locator('[data-families] tr', { hasText: 'Lane' }).count()) === 0, 'after: the Lanes are no longer on autopay (Ivy’s payments stopped)');
await page.goto(`${BASE}/admin/search?q=${encodeURIComponent('Lane family')}`);
await page.locator('a', { hasText: 'Lane family' }).first().click();
const ivyClass = page.locator('[data-classes] tr', { hasText: 'Ivy' });
check((await ivyClass.textContent()).includes('Cancelled'), 'the family page shows Ivy’s class as cancelled');
check((await page.locator('[data-classes] tr', { hasText: 'Theo' }).textContent()).includes('No charge, added by staff: Scholarship'), 'and Theo’s as “No charge, added by staff: Scholarship”');
await shot(page, 'roster-family-page');

// ── 5. Offer the spot: the Marsh family is on the Stories & Songs waitlist ──
await page.goto(`${BASE}/admin/content/programs/stories-and-songs`);
const item = page.locator('details.cf-item:has(select[name="sessions.0.status"])');
if (!(await item.evaluate((d) => d.open))) await item.locator('> summary [data-item-title]').click();
if ((await page.inputValue('select[name="sessions.0.status"]')) !== 'waitlist') {
  await page.selectOption('select[name="sessions.0.status"]', 'waitlist');
  await Promise.all([page.waitForNavigation(), page.click('button[value="publish"]')]);
}
const marshEmail = `marsh+${stamp}@example.com`;
const marsh = await newFamily(marshEmail, 'Dana Marsh', [['Olive', 'Marsh', '2021-05-05'], ['Pip', 'Marsh', '2021-05-05']], STORIES);
await pick(marsh.p, ['Olive Marsh', 'Pip Marsh']);
await details(marsh.p);
await marsh.p.click('.pay button[type="submit"]');
await marsh.p.waitForSelector('h1:has-text("You’re on the waitlist.")');
step('a made-up family (the Marshes) puts Olive and Pip on the Stories & Songs waitlist (it’s waitlist-only)');

await page.goto(`${BASE}/admin/classes/${STORIES}`);
const waitRow = (n) => page.locator('[data-waiting]', { hasText: `${n} Marsh` });
// Offer Pip the place, then withdraw it.
await waitRow('Pip').locator('summary:has-text("Offer the spot")').click();
await Promise.all([page.waitForURL(/done=offered/), waitRow('Pip').locator('button[value="offer"]').click()]);
check(/Offered \w{3} \d+, \d{4}, expires \w{3}, \w{3} \d+ at \d+:\d\d [ap]m/.test(await waitRow('Pip').locator('[data-offered]').textContent()), `Pip’s row says “${(await waitRow('Pip').locator('[data-offered]').textContent()).trim()}”`);
await Promise.all([page.waitForURL(/done=withdrawn/), waitRow('Pip').locator('button[value="withdraw"]').click()]);
check((await waitRow('Pip').locator('[data-offered]').count()) === 0 && (await waitRow('Pip').locator('summary:has-text("Offer the spot")').count()) === 1, 'Withdraw offer takes it back; Pip stays on the waitlist and can be offered again');
// Offer Olive the place.
await waitRow('Olive').locator('summary:has-text("Offer the spot")').click();
await Promise.all([page.waitForURL(/done=offered/), waitRow('Olive').locator('button[value="offer"]').click()]);
check(await waitRow('Olive').locator('[data-offered]').isVisible(), 'Olive’s row shows the open offer');
await shot(page, 'roster-waitlist-offered');
await waitRow('Pip').locator('summary:has-text("Offer the spot")').click();
await phoneCheck('the class page with the waitlist, Offer the spot open', 'roster-class-390');
const offerMail = await mailTo(marshEmail, 'A place opened in Stories and Songs');
const offerLink = offerMail.match(/https?:\/\/\S+\?offer=[0-9a-f-]{36}/)?.[0];
check(/A place opened in Stories and Songs\. Sign up by \w{3}, \w{3} \d+ at \d+:\d\d [ap]m to take it\./.test(offerMail) && !!offerLink, 'the family gets “A place opened in Stories and Songs. Sign up by … to take it.” with a link');

// The family follows the link and signs Olive up, though the class is waitlist-only.
await marsh.p.goto(offerLink.replace(/^https?:\/\/[^/]+/, BASE));
await marsh.p.waitForSelector('[data-offer-note="open"]');
check((await marsh.p.textContent('[data-offer-note]')).includes('A place is held for Olive until'), 'the link’s page says a place is held for Olive, and until when');
check(await marsh.p.locator('label.pick', { hasText: 'Olive Marsh' }).locator('input').isEnabled(), 'Olive can be picked although she’s on the waitlist');
check(await marsh.p.locator('label.pick', { hasText: 'Pip Marsh' }).locator('input').isDisabled(), 'Pip (no offer) still can’t');
await shot(marsh.p, 'roster-offer-link');
await pick(marsh.p, ['Olive Marsh']);
await details(marsh.p);
check((await marsh.p.locator('input[name="plan"][value="waitlist"]').count()) === 0, 'checkout offers paid plans, not the waitlist');
const once = marsh.p.locator('input[name="plan"][value="once"]');
if (await once.count()) {
  await once.check();
  await marsh.p.waitForURL(/plan=once/);
}
await marsh.p.click('.pay button[type="submit"]');
await marsh.p.waitForURL(/\/enroll\/(pay|confirmation)/);
if (/\/enroll\/pay/.test(marsh.p.url())) await marsh.p.click('button:has-text("Complete test payment")');
await marsh.p.waitForSelector('h1:has-text("You’re in!")');
step('the Marshes sign Olive up through the offer link and pay');

await page.goto(`${BASE}/admin/classes/${STORIES}`);
check((await page.locator('.kid', { hasText: 'Olive Marsh' }).count()) === 1, 'Olive is on the roster');
check((await waitRow('Olive').count()) === 0 && (await waitRow('Pip').count()) === 1, 'and off the waitlist, where Pip still is');
await shot(page, 'roster-class-after');

check(errors.length === 0, `no script errors${errors.length ? `: ${errors.join('; ')}` : ''}`);
await lane.fam.close();
await marsh.fam.close();
await browser.close();
console.log('\nStaff roster changes: all checks passed.');
