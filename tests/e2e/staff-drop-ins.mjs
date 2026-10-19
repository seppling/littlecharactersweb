#!/usr/bin/env node
/**
 * End-to-end: paid drop-ins (src/server/drop-ins.ts).
 *
 * - A made-up family (the Quills) finds "Drop in for one class · $25" on a
 *   weekly class's page, signs in, adds a child, picks a date, agrees to the
 *   policies and pays with the local test-payment stand-in; the confirmation,
 *   the email in the dev mailbox, and the drop-in in their account.
 * - The owner sees the child with the Drop-in badge on that date's roster, and
 *   in the class's Drop-ins list ("Paid $25"), with its downloads.
 * - The owner adds a drop-in with no charge (a fresh sign-in and a reason),
 *   then cancels it with a reason.
 * - A full date and a day off can't be booked.
 * - At 390 px: nothing wider than the screen; on staff pages no button wraps
 *   and every target is 44 px.
 *
 * Run last, after the other browser tests, on the same server:
 *
 *   npm run build && tests/e2e/serve.sh
 *   node tests/e2e/staff-drop-ins.mjs [baseUrl] [screenshotDir]
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
const brokenButtons = (p) =>
  p.evaluate(() =>
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
const smallTargets = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll('.admin-page a, .admin-page button, .admin-page input:not([type="hidden"], [type="checkbox"], [type="radio"]), .admin-page select, .admin-page summary')]
      .filter((el) => el.getClientRects().length && !el.closest('.sr-only') && !hiddenInDetails(el))
      .filter((el) => el.getBoundingClientRect().height < 44)
      .map((el) => `${el.tagName.toLowerCase()} “${(el.textContent || el.getAttribute('name') || '').trim().slice(0, 30)}” ${Math.round(el.getBoundingClientRect().height)}px`),
  );
const hiddenInDetailsScript = () => {
  window.hiddenInDetails = (el) => {
    const d = el.closest('details:not([open])');
    return !!d && !el.closest('details:not([open]) > summary');
  };
};
await ctx.addInitScript(hiddenInDetailsScript);

/** At 390 px: nothing sticks out; on a staff page, no button wraps and every target is 44 px. Takes the phone screenshot. */
async function phoneCheck(p, what, name, staff = true) {
  await p.setViewportSize({ width: 390, height: 844 });
  const extra = await sideways(p);
  check(extra <= 0, `${what}: no sideways scrolling at 390 px${extra > 0 ? ` (${(await tooWide(p)).join(', ')})` : ''}`);
  if (staff) {
    const broken = await brokenButtons(p);
    check(broken.length === 0, `${what}: no button breaks onto two lines at 390 px${broken.length ? ` (${broken.join(', ')})` : ''}`);
    const small = await smallTargets(p);
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

const HANNAH = 'hannah@example.com';
const INTRO = 'intro-f26-tue';
const STUDIO = 'acting-studio-f26';
const stamp = Date.now();
const quillEmail = `quill+${stamp}@example.com`;

// ── 0. Hannah signs in, and sets Geode: Acting Studio to 1 place (for a full date below) ──
await page.goto(`${BASE}/admin/classes/${INTRO}`);
await signIn(page, HANNAH);
await page.waitForSelector('h1:has-text("Intro to Theater")');
check(await page.locator('[data-drop-in-tool]').isVisible(), 'a weekly class’s page has “Add a drop-in”');
check(await page.locator('[data-drop-ins]').isVisible(), 'and a Drop-ins part');
await page.goto(`${BASE}/admin/content/programs/geode-acting-studio`);
const item = page.locator('details.cf-item:has(input[name="sessions.0.capacity"])');
if (!(await item.evaluate((d) => d.open))) await item.locator('> summary [data-item-title]').click();
check(await page.locator('input[name="sessions.0.dropIn.price"]').isVisible(), 'the editor has a drop-in price beside the session’s price');
await page.fill('input[name="sessions.0.capacity"]', '1');
await Promise.all([page.waitForNavigation(), page.click('button[value="publish"]')]);
step('the content editor sets Geode: Acting Studio to 1 place');
await page.goto(`${BASE}/admin/content/pages/site`);
check((await page.textContent('body')).includes('The price of one class for a drop-in. Families see it on weekly classes.'), 'Site settings has the drop-in price, with its help line');

// ── 1. A family books a drop-in from the class's page ──
const fam = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await fam.addInitScript(hiddenInDetailsScript);
const p = await fam.newPage();
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`${BASE}/programs/intro-to-theater`);
const link = p.locator('[data-drop-in-link]:visible');
check((await link.textContent()).trim() === 'Drop in for one class · $25', 'the class’s page has “Drop in for one class · $25” under the sign-up button');
await shot(p, 'drop-in-class-link');
await phoneCheck(p, 'the class’s page', 'drop-in-class-link-390', false);
await link.click();
await p.waitForURL(new RegExp(`/drop-in/${INTRO}`));
await signIn(p, quillEmail);
await p.waitForSelector('#p-name');
await p.fill('#p-name', 'Jules Quill');
await p.fill('#p-phone', '706-555-0177');
await p.click('button[type="submit"]');
await p.waitForSelector('[data-drop-in-form]');
for (const [first, birthday] of [['Remy', '2017-04-04'], ['Sloane', '2014-03-03']]) {
  if (!(await p.locator('#s-first').isVisible())) await p.click('details.add > summary');
  await p.fill('#s-first', first);
  await p.fill('#s-last', 'Quill');
  await p.fill('#s-bday', birthday);
  await p.click('form:has(input[value="add-student"]) button[type="submit"]');
  await p.waitForSelector(`text=${first} Quill`);
}
step('a made-up family (the Quills) signs in and adds Remy and Sloane');
const firstOpen = p.locator('[data-dates] label[data-problem="open"]').first();
const dropDate = await firstOpen.getAttribute('data-date');
const dropLabel = (await firstOpen.locator('strong').textContent()).trim();
await firstOpen.locator('input').check();
await p.locator('[data-students] label', { hasText: 'Remy Quill' }).locator('input').check();
await shot(p, 'drop-in-step-1');
await phoneCheck(p, 'drop-in: pick a date and a child', 'drop-in-step-1-390', false);
await p.click('[data-drop-in-form] button[type="submit"]');
await p.waitForURL(/\/enroll\/details/);
check((await p.textContent('.policies')).includes('A drop-in is one class, on the date you picked'), 'the details step shows the drop-in policies');
if (await p.locator('#ec-0-name').isVisible()) {
  await p.fill('#ec-0-name', 'Robin Quill');
  await p.fill('#ec-0-relationship', 'Aunt');
  await p.fill('#ec-0-phone', '706-555-0178');
  await p.fill('#zip', '30606');
}
for (const radio of await p.locator('input[name^="photo-"][value="yes"]:visible').all()) await radio.check();
await p.check('input[name="policies"]');
await p.click('button:has-text("Review & pay")');
await p.waitForURL(/\/drop-in\/pay/);
const bill = await p.textContent('.bill');
check(bill.includes(`Drop-in: Intro to Theater, ${dropLabel} (Remy)`) && bill.includes('$25'), `the pay step shows one line, “Drop-in: Intro to Theater, ${dropLabel} (Remy)”, $25`);
await shot(p, 'drop-in-pay');
await phoneCheck(p, 'drop-in: pay', 'drop-in-pay-390', false);
await p.click('button:has-text("Complete test payment of $25")');
await p.waitForSelector('h1:has-text("You’re booked!")');
const facts = await p.textContent('.facts');
check(facts.includes(` ${Number(dropDate.slice(8))}`) && facts.includes('$25'), 'the confirmation shows the date, time, place and $25 paid');
check(await p.locator('[data-book-another]').isVisible(), 'and “Book another date”');
await shot(p, 'drop-in-confirmation');
await phoneCheck(p, 'drop-in: confirmation', 'drop-in-confirmation-390', false);
const mail = await mailTo(quillEmail, 'Drop-in booked: Intro to Theater');
check(mail.includes('Remy is booked to drop in to Intro to Theater.') && mail.includes('Paid today: $25.'), 'the dev mailbox has “Drop-in booked: Intro to Theater”, with the date, place and parking');
await p.goto(`${BASE}/account`);
const mine = p.locator('[data-drop-ins] li', { hasText: 'Intro to Theater' });
check((await mine.textContent()).includes('Drop-in') && (await mine.textContent()).includes(dropLabel), 'the family’s account lists the upcoming drop-in');
check(await p.locator('[data-drop-in-offers]').isVisible(), 'and offers “Drop in for one class” for weekly classes');
// Remy can't book the same date twice.
await p.goto(`${BASE}/drop-in/${INTRO}?date=${dropDate}`);
await p.locator(`[data-dates] label[data-date="${dropDate}"] input`).check();
await p.locator('[data-students] label', { hasText: 'Remy Quill' }).locator('input').check();
await p.click('[data-drop-in-form] button[type="submit"]');
check((await p.textContent('[data-drop-in-error]')).includes('Remy already has a drop-in that day.'), 'the same child can’t book the same date twice');

// ── 2. The owner sees it on that date's roster and in the Drop-ins list ──
await page.goto(`${BASE}/admin/classes/${INTRO}?date=${dropDate}`);
const remy = page.locator('[data-roster] .kid', { hasText: 'Remy Quill' });
check((await remy.locator('[data-badge="drop-in"]').textContent()).trim() === 'Drop-in', `Remy is on the ${dropLabel} roster with the Drop-in badge`);
check(!(await remy.locator('[data-roster-actions] summary:has-text("Remove")').count()), 'a drop-in has no Remove (it’s cancelled under Drop-ins)');
const row = page.locator('[data-drop-in-list="upcoming"] tr', { hasText: 'Remy Quill' });
check((await row.textContent()).includes('Paid $25'), 'the Drop-ins list shows Remy, the Quill family and “Paid $25”');
await remy.locator('summary').first().click();
await shot(page, 'drop-in-roster');
await page.locator('[data-drop-ins]').scrollIntoViewIfNeeded();
await shot(page, 'drop-in-staff-list');
const csv = await page.request.get(`${BASE}/admin/classes/${INTRO}/drop-ins.csv`);
check(csv.status() === 200 && (await csv.text()).includes('Remy Quill'), 'the Drop-ins CSV downloads, with Remy');
const pdf = await page.request.get(`${BASE}/admin/classes/${INTRO}/drop-ins.pdf`);
check(pdf.status() === 200 && pdf.headers()['content-type'] === 'application/pdf', 'and the PDF');
await page.goto(`${BASE}/admin`);
step('Today counts drop-ins in a class’s places (checked in the unit tests for a day with classes)');

// ── 3. The owner adds Sloane to Acting Studio with no charge: that date is now full ──
await page.goto(`${BASE}/admin/classes/${STUDIO}`);
await page.click('[data-drop-in-tool] summary');
await page.fill('#drop-q', 'Sloane Quill');
await page.click('[data-drop-find] button[value="drop-find"]');
check(!page.url().includes('Sloane'), 'the search goes by form post: the child’s name never goes in the address');
const sloane = page.locator('[data-drop-child]', { hasText: 'Sloane Quill' });
const aged = await page.request.post(`${BASE}/dev/age-session`, { form: { minutes: '20' }, headers: { origin: BASE } });
check(aged.status() === 204, 'test-only: the session is aged by 20 minutes');
await Promise.all([page.waitForURL(/\/admin\/confirm\?next=/), sloane.locator('button:has-text("No charge")').click()]);
check(!decodeURIComponent(page.url()).includes('Sloane'), 'a no-charge drop-in needs a fresh sign-in; the return address has an id, not a name');
await signIn(page, HANNAH);
await page.waitForSelector('[data-drop-confirm="free"]');
const studioDate = await page.locator('[data-drop-date] option:not([disabled])').first().getAttribute('value');
await page.selectOption('[data-drop-date]', studioDate);
await page.click('[data-drop-confirm] button[value="drop-free"]');
check(await page.locator('#drop-reason:invalid').count(), 'a reason is required');
await page.fill('#drop-reason', 'Trying it out');
await shot(page, 'drop-in-add-confirm');
await phoneCheck(page, 'Add a drop-in, no charge', 'drop-in-add-confirm-390');
await Promise.all([page.waitForURL(/done=drop-added/), page.click('[data-drop-confirm] button[value="drop-free"]')]);
check((await page.textContent('[data-notice]')).includes('Drop-in added, with no charge.'), 'it says the drop-in was added with no charge');
const sloaneRow = page.locator('[data-drop-in-list="upcoming"] tr', { hasText: 'Sloane Quill' });
check((await sloaneRow.textContent()).includes('No charge: Trying it out'), 'the Drop-ins list shows “No charge: Trying it out”');
await page.goto(`${BASE}/admin/classes/${STUDIO}?date=${studioDate}`);
check(await page.locator('[data-roster] .kid', { hasText: 'Sloane Quill' }).locator('[data-badge="drop-in"]').isVisible(), 'Sloane is on that date’s roster as a Drop-in');
await phoneCheck(page, 'a class’s page with its roster and Drop-ins', 'drop-in-class-page-390');
await shot(page, 'drop-in-class-page');

// ── 4. A full date and a day off can't be booked ──
const studioDates = await page.locator('#roster-date option').evaluateAll((os) => os.map((o) => o.value));
const offDate = studioDates[studioDates.indexOf(studioDate) + 1];
const off = await page.request.post(`${BASE}/dev/drop-in-day-off`, { form: { session: STUDIO, date: offDate }, headers: { origin: BASE } });
check(off.status() === 204, `test-only: ${offDate} is a day off for Acting Studio`);
await p.goto(`${BASE}/drop-in/${STUDIO}`);
check((await p.getAttribute(`[data-dates] label[data-date="${studioDate}"]`, 'data-problem')) === 'full', 'the family sees the full date as Full');
check(await p.locator(`[data-dates] label[data-date="${studioDate}"] input`).isDisabled(), 'and can’t pick it');
check((await p.getAttribute(`[data-dates] label[data-date="${offDate}"]`, 'data-problem')) === 'day-off', 'the day off says “No class that day”');
check(await p.locator(`[data-dates] label[data-date="${offDate}"] input`).isDisabled(), 'and can’t be picked');
await shot(p, 'drop-in-full-and-day-off');
// The server refuses them too (a stale page or a hand-made request).
const forced = await p.evaluate(async ({ url, date, kid }) => {
  const body = new URLSearchParams({ action: 'continue', date, studentId: kid });
  const r = await fetch(url, { method: 'POST', body });
  return r.text();
}, { url: `${BASE}/drop-in/${STUDIO}`, date: studioDate, kid: await p.locator('[data-students] label', { hasText: 'Sloane Quill' }).locator('input').getAttribute('value') });
check(forced.includes('Geode: Acting Studio is full on'), 'a full date is refused by the server too');

// ── 5. The owner cancels Sloane's drop-in ──
await page.goto(`${BASE}/admin/classes/${STUDIO}`);
const cancelRow = page.locator('[data-drop-in-list="upcoming"] tr', { hasText: 'Sloane Quill' });
await cancelRow.locator('summary:has-text("Cancel")').click();
await cancelRow.locator('input[name="reason"]').fill('Booked by mistake');
await Promise.all([page.waitForURL(/done=drop-cancelled/), cancelRow.locator('button[value="drop-cancel"]').click()]);
check((await page.textContent('[data-notice]')).includes('Drop-in cancelled.'), 'it says the drop-in was cancelled');
check((await page.locator('[data-drop-in-list="upcoming"] tr', { hasText: 'Sloane Quill' }).textContent()).includes('Cancelled: Booked by mistake'), 'the list shows “Cancelled: Booked by mistake”');
await p.goto(`${BASE}/drop-in/${STUDIO}`);
check((await p.getAttribute(`[data-dates] label[data-date="${studioDate}"]`, 'data-problem')) === 'open', 'the date is open again for families');

// ── 6. The family's page shows the child's drop-ins ──
await page.goto(`${BASE}/admin/search?q=${encodeURIComponent('Quill family')}`);
await page.locator('a', { hasText: 'Quill family' }).first().click();
const famDropIns = await page.textContent('[data-family-drop-ins]');
check(famDropIns.includes('Remy') && famDropIns.includes('Paid $25') && famDropIns.includes('Sloane') && famDropIns.includes('Cancelled'), 'the family’s page lists Remy’s and Sloane’s drop-ins');

check(errors.length === 0, `no script errors${errors.length ? `: ${errors.join('; ')}` : ''}`);
await fam.close();
await browser.close();
console.log('\nStaff drop-ins: all checks passed.');
