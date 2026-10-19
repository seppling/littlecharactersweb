#!/usr/bin/env node
/**
 * End-to-end: the staff Classes list and a class's page (docs/back-office.md → Classes).
 *
 * - Hannah signs in; the Classes list with its filters (links, so Today can use them).
 * - A class's page: Maya (from the enrollment journey) with her badges, her
 *   care details opening on tap, and her parent's Call, Text and Email links;
 *   the Lee children from the trial journey.
 * - The waitlist: Hannah marks Stories & Songs "waitlist only" in the editor
 *   and a new family joins it.
 * - The print page, and the roster CSV and PDF, the sign-in sheet and the
 *   class list's downloads right after signing in; later, they ask again.
 * - Phone (390 px): nothing wider than the screen, the whole class card opens
 *   the class, and the bottom tabs can be tapped on a class's page.
 *
 * Run after the other five browser tests, on the same server:
 *
 *   npm run build && tests/e2e/serve.sh      # fresh local database + sample import
 *   node tests/e2e/staff-classes.mjs [baseUrl] [screenshotDir]
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const SHOTS = process.argv[3];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const step = (msg) => console.log(`✓ ${msg}`);
function check(ok, msg) {
  if (!ok) throw new Error(`✗ ${msg}`);
  step(msg);
}
const shot = async (name, fullPage = true) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });
const sideways = (p = page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const phone = () => page.setViewportSize({ width: 390, height: 844 });
const desktop = () => page.setViewportSize({ width: 1280, height: 900 });

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

/** Types the email and the code. Every browser test signs in from one address, so wait out the 5-codes-a-minute limit if needed. */
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
  await Promise.all([p.waitForLoadState('load'), p.fill('#signin-code', code)]);
  await p.waitForTimeout(800);
}

const HANNAH = 'hannah@example.com';
const INTRO = 'intro-f26-tue';
const STORIES = 'stories-songs-f26';

// ── 1. Hannah signs in on Classes ──
await page.goto(`${BASE}/admin/classes`);
await signIn(page, HANNAH);
await page.waitForSelector('h1:has-text("Classes")');
check((await page.title()).startsWith('Classes'), 'the Classes page is titled “Classes”, like its tab');

// ── 2. A waitlist: Stories & Songs is marked "waitlist only", and a new family joins it ──
await page.goto(`${BASE}/admin/content/programs/stories-and-songs`);
const item = page.locator('details.cf-item:has(select[name="sessions.0.status"])');
if (!(await item.evaluate((d) => d.open))) await item.locator('> summary [data-item-title]').click();
await page.selectOption('select[name="sessions.0.status"]', 'waitlist');
await Promise.all([page.waitForNavigation(), page.click('button[value="publish"]')]);
const fam = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const parent = await fam.newPage();
const parentEmail = `waitlist+${Date.now()}@example.com`;
await parent.goto(`${BASE}/enroll/${STORIES}`);
await signIn(parent, parentEmail);
await parent.waitForSelector('#p-name');
await parent.fill('#p-name', 'Jordan Okoro');
await parent.fill('#p-phone', '706-555-0177');
await parent.click('button[type="submit"]');
await parent.waitForSelector('text=Add a student');
await parent.fill('#s-first', 'Juniper');
await parent.fill('#s-last', 'Okoro');
await parent.fill('#s-bday', '2021-03-03');
await parent.click('form:has(input[value="add-student"]) button[type="submit"]');
await parent.waitForSelector('text=Juniper Okoro');
await parent.click('#students button[type="submit"]');
await parent.waitForURL(/\/enroll\/details/);
// A new family gives one emergency contact and a ZIP code (the family details step).
await parent.fill('#ec-0-name', 'Robin Okoro');
await parent.fill('#ec-0-relationship', 'Grandparent');
await parent.fill('#ec-0-phone', '706-555-0178');
await parent.fill('#zip', '30605');
await parent.check('input[name^="photo-"][value="yes"]');
await parent.check('input[name="policies"]');
await parent.click('button:has-text("Review & pay")');
await parent.waitForURL(/\/enroll\/review/);
await parent.click('.pay button[type="submit"]');
await parent.waitForSelector('h1:has-text("You’re on the waitlist.")');
await fam.close();
step('a new family joins the Stories & Songs waitlist through the site');

// ── 3. The Classes list ──
await page.goto(`${BASE}/admin/classes`);
const listed = await page.$$eval('[data-session]', (as) => as.map((a) => a.dataset.session));
check(listed.includes(INTRO) && listed.includes(STORIES), `the list has ${listed.length} classes, Intro to Theater and Stories & Songs among them`);
const intro = page.locator(`[data-session="${INTRO}"]`);
check(/\d+ of \d+/.test(await intro.locator('[data-label="Places"]').textContent()), `places filled read “${(await intro.locator('[data-label="Places"]').textContent()).trim()}”`);
check((await intro.locator('[data-label="Teacher"]').textContent()).trim().length > 0, 'each row names the teacher');
check((await page.locator('.term h2').count()) >= 1, `grouped by term: ${(await page.$$eval('.term h2', (hs) => hs.map((h) => h.textContent.trim()))).join(', ')}`);
await shot('classes-desktop');

await Promise.all([page.waitForURL(/\/admin\/classes\?waitlist=1$/), page.click('[data-filter="waitlist"]')]);
const waiting = await page.$$eval('[data-session]', (as) => as.map((a) => a.dataset.session));
check(waiting.includes(STORIES) && !waiting.includes(INTRO), '“Has a waitlist” is a link (?waitlist=1) and shows only classes with a waitlist');
check((await page.getAttribute('[data-filter="waitlist"]', 'aria-pressed')) === 'true', 'the chosen filter is marked');
check((await page.getAttribute('[data-download="csv"]', 'href')) === '/admin/classes.csv?waitlist=1', 'the list’s downloads keep the filter');
await page.goto(`${BASE}/admin/classes?show=ended`);
const ended = await page.$$eval('[data-session]', (as) => as.map((a) => a.dataset.session));
check(ended.length > 0 && !ended.some((id) => listed.includes(id)), `“Ended” shows ${ended.length} ended dates, none of them in the default list`);

// ── 4. A class's page ──
await page.goto(`${BASE}/admin/classes/${INTRO}`);
check((await page.locator('h1').textContent()).trim() === 'Intro to Theater', 'the class page is titled with the class’s name');
check(!(await page.locator('text=All rosters').count()), 'no second back link on the page');
check(/places filled/.test(await page.textContent('[data-counts]')) && /on the waitlist/.test(await page.textContent('[data-counts]')), `header: “${(await page.textContent('[data-counts]')).trim()}”`);
check((await page.getAttribute('[data-print-link]', 'href')) === `/admin/classes/${INTRO}/print`, 'Print link');
check((await page.getAttribute('[data-email-link]', 'href')) === `/admin/classes/${INTRO}/email`, 'Email the class link');
check(await page.locator('.safety', { hasText: 'medical notes' }).isVisible(), 'the note that rosters include medical notes and views are logged');
const maya = page.locator('[data-child]', { hasText: 'Maya Rivera' }).first();
await maya.waitFor();
check(await maya.locator('[data-badge="medical"]', { hasText: 'Allergy' }).isVisible(), 'Maya has the Allergy badge');
const badgeRed = await maya.locator('[data-badge="medical"]').evaluate((el) => getComputedStyle(el).backgroundColor);
check(badgeRed === 'rgb(253, 227, 223)', `and it’s red (${badgeRed})`);
check(!(await maya.locator('text=Peanuts').isVisible()), 'her allergy itself stays out of sight until tapped');
const call = await maya.locator('.kid__family [data-call]').first().getAttribute('href');
const text = await maya.locator('.kid__family [data-text]').first().getAttribute('href');
check(call === 'tel:+17065550142' && text === 'sms:+17065550142', `her parent’s Call and Text links (${call}, ${text})`);
check((await maya.locator('[data-email]').first().getAttribute('href')).startsWith('mailto:parent+'), 'and Email');
check(/^\/admin\/families\/[\w-]+$/.test(await maya.locator('.family-link').getAttribute('href')), 'a link to the family’s page');
await maya.locator('summary').click();
check(await maya.locator('[data-care] >> text=Peanuts').isVisible(), 'tapping Maya opens her care details in place: Peanuts');
const red = await maya.locator('[data-medical="yes"]').evaluate((el) => getComputedStyle(el).backgroundColor);
check(red === 'rgb(253, 227, 223)', `allergies are shown in red (${red})`);
// The enrollment journey gives Maya's family an emergency contact (Rosa Rivera, the family details step).
check(await maya.locator('[data-care]', { hasText: 'Rosa Rivera' }).isVisible() && !(await maya.locator('[data-no-emergency]').count()), 'her family’s emergency contact shows in her care details');
// The trial journey ends with Ava continuing after her free class, so she's no longer a trial by now.
const lee = await page.locator('[data-child]').filter({ has: page.locator('.kid__name', { hasText: /^(Ava|Ben) Lee$/ }) }).count();
check(lee >= 1, `the trial journey’s Lee children are on the roster (${lee})`);
const names = await page.$$eval('[data-roster] .kid__name', (ns) => ns.map((n) => n.textContent.trim().split(' ').at(-1)));
check(names.every((n, i) => i === 0 || names[i - 1].localeCompare(n) <= 0), `the roster is by last name (${names.join(', ')})`);
await shot('class-desktop-open');

await page.goto(`${BASE}/admin/classes/${STORIES}`);
check(await page.locator('.empty-state', { hasText: 'No one enrolled yet.' }).isVisible(), 'a class with no one enrolled says “No one enrolled yet.”');
const wait = page.locator('[data-waitlist] [data-waiting]', { hasText: 'Juniper Okoro' });
check(await wait.isVisible() && (await wait.textContent()).includes('Joined'), 'the waitlist lists Juniper with the date her family joined');
check((await wait.locator('[data-call]').getAttribute('href')) === 'tel:+17065550177', 'with her parent’s Call link');
await shot('class-waitlist-desktop');

// ── 5. The print page ──
await page.goto(`${BASE}/admin/classes/${INTRO}/print`);
check(await page.locator('[data-print-roster] >> text=Peanuts').isVisible(), 'the print page has the roster with care details');
check((await page.getAttribute('[data-download="pdf"]', 'href')) === `/admin/classes/${INTRO}.pdf`, '“Download PDF” is the roster’s PDF');
check(await page.locator('[data-print]').isVisible(), 'a Print button');
await page.emulateMedia({ media: 'print' });
check(!(await page.locator('.staff-top').isVisible()) && !(await page.locator('[data-print]').isVisible()), 'printed, the staff bar and buttons are left off');
await page.emulateMedia({ media: 'screen' });
await shot('print-desktop');

// ── 6. Downloads, right after signing in ──
await page.goto(`${BASE}/admin/classes/${INTRO}`);
let [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-download="csv"]')]);
const csv = readFileSync(await download.path(), 'utf8');
check(csv.startsWith('﻿Student,Age,Status,Parents,Allergies,Medical notes,Pickup,Emergency contacts,Photos\r\n'), 'the roster CSV has the roster’s columns');
check(/Maya Rivera,\d+,Enrolled,.*Peanuts/.test(csv), 'Maya is in it with her allergy');
const shown = await page.locator('[data-roster] [data-child]').count();
check(csv.trim().split('\r\n').length - 1 >= shown, `the CSV has the page’s ${shown} children`);
[download] = await Promise.all([page.waitForEvent('download'), page.click('[data-download="pdf"]')]);
let pdf = readFileSync(await download.path());
check(pdf.subarray(0, 4).toString() === '%PDF', `the roster PDF downloads (${Math.round(pdf.length / 1024)} KB)`);
if (SHOTS) writeFileSync(`${SHOTS}/roster.pdf`, pdf);
[download] = await Promise.all([page.waitForEvent('download'), page.click('[data-download="sign-in"]')]);
pdf = readFileSync(await download.path());
check(pdf.subarray(0, 4).toString() === '%PDF' && /sign-in sheet/.test(download.suggestedFilename()), `the sign-in sheet downloads (${download.suggestedFilename()})`);
if (SHOTS) writeFileSync(`${SHOTS}/sign-in-sheet.pdf`, pdf);
await page.goto(`${BASE}/admin/classes?waitlist=1`);
[download] = await Promise.all([page.waitForEvent('download'), page.click('[data-download="csv"]')]);
const list = readFileSync(await download.path(), 'utf8');
check(list.startsWith('﻿Term,Class,When,Teacher,Location,Places filled,Openings,Waitlist\r\n') && list.includes('Stories') && !list.includes('Intro to Theater'), 'the class list CSV is the list as filtered');
[download] = await Promise.all([page.waitForEvent('download'), page.click('[data-download="pdf"]')]);
pdf = readFileSync(await download.path());
check(pdf.subarray(0, 4).toString() === '%PDF', 'the class list PDF downloads');
if (SHOTS) writeFileSync(`${SHOTS}/class-list.pdf`, pdf);

// ── 7. Phone ──
await phone();
await page.goto(`${BASE}/admin/classes`);
check((await sideways()) <= 0, 'Classes: nothing wider than a 390 px phone');
const chips = await page.$$eval('[data-filters] .chip', (cs) => cs.map((c) => c.getBoundingClientRect().height));
check(chips.every((h) => h >= 44), 'filter chips are at least 44 px tall');
await shot('classes-phone');
const card = page.locator(`[data-session="${INTRO}"]`);
const box = await card.boundingBox();
check(box.x >= 0 && box.x + box.width <= 390, 'each class card fits the screen');
await Promise.all([page.waitForURL(new RegExp(`/admin/classes/${INTRO}$`)), card.locator('[data-label="Waitlist"]').click()]);
step('tapping anywhere on the card opens the class');
const phoneMaya = page.locator('[data-child]', { hasText: 'Maya Rivera' }).first();
await phoneMaya.locator('summary').click();
check((await sideways()) <= 0, 'a class’s page, details open: nothing wider than the screen');
const taps = await page.$$eval('[data-roster] .btn, [data-roster] summary, [data-roster] .family-link', (els) => els.filter((e) => e.offsetParent).map((e) => e.getBoundingClientRect().height));
check(taps.every((h) => h >= 44), `Call, Text, Email and the rest are at least 44 px tall (${Math.min(...taps)} px)`);
check((await page.locator('[data-staff-back]').count()) === 1, 'one back link, in the phone’s top bar');
await shot('class-phone-open');
const tab = page.locator('.staff-tabs a', { hasText: 'Today' });
const t = await tab.boundingBox();
const onTop = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.staff-tabs a')?.textContent.trim(), [t.x + t.width / 2, t.y + t.height / 2]);
check(onTop === 'Today', 'the bottom tabs are on top and can be tapped');
await Promise.all([page.waitForURL(`${BASE}/admin`), tab.click()]);
step('tapping Today in the tab bar goes to Today');
await page.goto(`${BASE}/admin/classes/${STORIES}`);
check((await sideways()) <= 0, 'the waitlist on a phone: nothing wider than the screen');
await shot('class-waitlist-phone');
await page.goto(`${BASE}/admin/classes/${INTRO}/print`);
check((await sideways()) <= 0, 'the print page on a phone: nothing wider than the screen');
await shot('print-phone');
await desktop();

// ── 8. Later, a download asks her to confirm it's her ──
const aged = await page.request.post(`${BASE}/dev/age-session`, { form: { minutes: '20' }, headers: { origin: BASE } });
check(aged.status() === 204, 'test-only: the session is aged by 20 minutes');
await page.goto(`${BASE}/admin/classes/${INTRO}`);
await Promise.all([page.waitForURL(/\/admin\/confirm\?next=%2Fadmin%2Fclasses%2Fintro-f26-tue\.pdf$/), page.click('[data-download="pdf"]')]);
step('20 minutes later, the roster PDF asks her to confirm it’s her');
for (const path of [`/admin/classes/${INTRO}.csv`, `/admin/classes/${INTRO}/sign-in-sheet.pdf`, '/admin/classes.pdf']) {
  const res = await page.request.get(BASE + path, { maxRedirects: 0 });
  check(res.status() === 303 && res.headers().location.startsWith('/admin/confirm?next='), `${path} asks too`);
}

// ── 9. Families can't see it ──
const anon = await fetch(`${BASE}/admin/classes/${INTRO}.csv`, { redirect: 'manual' });
check(anon.status === 303 && !(await anon.text()).includes('Peanuts'), 'signed out, the roster CSV gives nothing');

check(errors.length === 0, `no page errors (${errors.join('; ')})`);
await browser.close();
console.log('\nStaff classes checks passed.');
