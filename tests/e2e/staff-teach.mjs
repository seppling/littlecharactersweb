#!/usr/bin/env node
/**
 * End-to-end: the teacher app (docs/back-office.md → The teacher app).
 *
 * - Hannah adds a teacher (a made-up email) for Intro to Theater, and a
 *   substitute for the Tuesday after: both teachers get one email.
 * - The teacher signs in on a 390 px phone, sees Tuesday's class (?on=,
 *   development only), marks everyone present, one absent, one late, writes a
 *   note to Hannah and submits.
 * - Offline: a change is "Saved on this phone", the roster reopens from the
 *   phone with no signal, and with signal it's "All sent ✓"; the server has
 *   one row per child.
 * - The teacher gets the Staff only panel on another class's roster, Payments
 *   and Families.
 * - Hannah sees "Attendance done ✓" and the note on Today, the attendance on
 *   the class page (and its CSV), and "Attendance not taken" for the Tuesday
 *   before.
 * - Signing out clears the phone's copy: the roster doesn't open offline.
 *
 * Run after every other browser test, on the same server:
 *
 *   npm run build && tests/e2e/serve.sh      # fresh local database + sample import
 *   node tests/e2e/staff-teach.mjs [baseUrl] [screenshotDir]
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const SHOTS = process.argv[3];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const step = (msg) => console.log(`✓ ${msg}`);
function check(ok, msg) {
  if (!ok) throw new Error(`✗ ${msg}`);
  step(msg);
}
const shot = async (p, name, fullPage = true) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });
const sideways = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

async function newPage(viewport = DESKTOP, opts = {}) {
  const ctx = await browser.newContext({ viewport, ...opts });
  const p = await ctx.newPage();
  // Offline pages fail to load their files on purpose; only script errors count.
  p.on('pageerror', (e) => errors.push(e.message));
  return p;
}

async function mailFor(p, email, pattern) {
  const mail = await p.context().newPage();
  try {
    for (let i = 0; i < 20; i++) {
      await mail.goto(`${BASE}/dev/mailbox`);
      const items = await mail.locator('li').filter({ hasText: `to ${email}` }).allTextContents();
      const hit = items.find((t) => pattern.test(t));
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 250));
    }
  } finally {
    await mail.close();
  }
  return null;
}

async function codeFor(p, email) {
  const text = await mailFor(p, email, /\d{6} is your Little Characters sign-in code/);
  const code = text?.match(/(\d{6}) is your Little Characters sign-in code/)?.[1];
  if (!code) throw new Error('No sign-in code arrived');
  return code;
}

/** Types the email and the code, like a person would. */
async function signIn(p, email) {
  if (!(await p.inputValue('#signin-email'))) await p.fill('#signin-email', email);
  // Every browser test signs in from the same address, so the 5-codes-a-minute
  // limit can be hit right after the other tests. Wait it out, like a person would.
  for (let tries = 0; ; tries++) {
    await p.click('[data-step="email"] button[type="submit"]');
    await p.waitForSelector('#signin-code:visible, [data-error]:visible');
    if (await p.locator('#signin-code').isVisible()) break;
    const error = await p.textContent('[data-error]');
    if (tries >= 2 || !/Too many tries/.test(error)) throw new Error(`Sign-in failed: ${error}`);
    console.log('· waiting a minute for the sign-in rate limit');
    await p.waitForTimeout(61_000);
  }
  const code = await codeFor(p, email);
  await Promise.all([p.waitForNavigation(), p.fill('#signin-code', code)]);
}

async function tapTargets(p, selector, what) {
  const small = await p.$$eval(selector, (els) =>
    els
      .filter((e) => e.offsetParent !== null)
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.height < 44)
      .map((r) => Math.round(r.height)),
  );
  check(small.length === 0, `${what}: tap targets at least 44 px${small.length ? ` (found ${small.join(', ')})` : ''}`);
}

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** The next date (YYYY-MM-DD, Athens) falling on a weekday (0 = Sunday), from today. */
function nextWeekday(day) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  while (d.getUTCDay() !== day) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const HANNAH = 'hannah@example.com';
const TEACHER = 'jordan.sample.teacher@example.com';
const SUB = 'casey.sample.sub@example.com';
const INTRO = 'intro-f26-tue'; // Tuesdays, with Maya and the Lee children from the journeys
const PRODUCE = 'produce-f26-mon'; // a class Jordan doesn't teach
const TUE = nextWeekday(2);
const PREV = addDays(TUE, -7);
const NEXT = addDays(TUE, 7);
const roster = (date) => `${BASE}/admin/teach/${INTRO}/${date}?on=${TUE}`;

// ── 1. Hannah adds the teacher and a substitute ──
const hp = await newPage(DESKTOP, { acceptDownloads: true });
await hp.goto(`${BASE}/admin/settings/staff`);
await signIn(hp, HANNAH);
async function addPerson(name, email) {
  await hp.goto(`${BASE}/admin/settings/staff`);
  await hp.fill('#add-name', name);
  await hp.fill('#add-email', email);
  await Promise.all([hp.waitForURL(/\/admin\/settings\/staff\/[^/?]+\?saved=added$/), hp.click('[data-add-staff] button[type="submit"]')]);
  return hp.url().split('?')[0];
}
const jordanUrl = await addPerson('Jordan Sample', TEACHER);
const jordanId = jordanUrl.split('/').pop();
await hp.selectOption(`select[name="class:${INTRO}"]`, 'lead');
await Promise.all([hp.waitForURL(/saved=classes/), hp.click('[data-classes] button[type="submit"]')]);
check((await hp.inputValue(`select[name="class:${INTRO}"]`)) === 'lead', 'Hannah gives Jordan Intro to Theater');
await addPerson('Casey Sample', SUB);
await hp.selectOption('#cover-class', INTRO);
await hp.fill('#cover-date', NEXT);
if (await hp.locator('#cover-for').count()) await hp.selectOption('#cover-for', jordanId);
await Promise.all([hp.waitForURL(/saved=cover-added/), hp.click('[data-add-cover] button[type="submit"]')]);
check(await hp.locator(`[data-cover="${INTRO} ${NEXT}"]`).count(), `Casey covers Intro on ${NEXT}`);
check(!!(await mailFor(hp, SUB, /You’re covering Intro to Theater/)), 'the substitute gets an email');
check(!!(await mailFor(hp, TEACHER, /Casey Sample is covering Intro to Theater/)), 'the regular teacher gets an email');

// ── 2. The teacher, on a phone ──
const tp = await newPage(PHONE);
await tp.goto(`${BASE}/admin/teach?on=${TUE}`);
await signIn(tp, TEACHER);
await tp.waitForSelector('h1:has-text("Hi, Jordan")');
const card = tp.locator(`[data-teach-class="${INTRO}"]`);
check(await card.count(), `Jordan’s Today lists Intro to Theater on ${TUE}`);
const cardText = await card.textContent();
check(/\d+ child/.test(cardText) && cardText.includes('Not taken'), `the card shows the children expected and “Not taken” (${cardText.replace(/\s+/g, ' ').trim()})`);
const tabs = await tp.$$eval('.teach-tabs a', (as) => as.map((a) => a.textContent.trim()));
check(JSON.stringify(tabs) === JSON.stringify(['Today', 'Me']), `a teacher’s phone tabs are Today and Me (${tabs.join(', ')})`);
check(!(await tp.locator('.staff-tabs').count()), 'no owner tabs for teachers');
check((await tp.locator(`[data-week-class="${INTRO} ${NEXT}"]`).textContent()).includes('Casey Sample is covering'), 'This week shows the substitute on the next Tuesday');
check((await sideways(tp)) <= 0, 'the teacher’s Today: no sideways scrolling at 390 px');
await tapTargets(tp, '.teach-card, .teach-tabs a, .teach-row', 'the teacher’s Today');
await shot(tp, 'teach-today-phone');

// A future date: the roster is read-only.
await tp.goto(roster(NEXT));
check((await tp.locator('[data-roll-notice]').textContent()).includes('Casey Sample is covering') || (await tp.locator('[data-roll-notice="future"]').count()) > 0, 'a future date is read-only');
check(!(await tp.locator('[data-mark]').count()), '… with no attendance buttons');

await tp.goto(`${BASE}/admin/teach?on=${TUE}`);
await Promise.all([tp.waitForURL(new RegExp(`/admin/teach/${INTRO}/${TUE}`)), card.locator('a').click()]);
const rows = tp.locator('[data-kid]');
const n = await rows.count();
check(n >= 2, `the roster lists the class’s children (${n})`);
check((await tp.textContent('[data-total]')).trim() === String(n) && (await tp.textContent('[data-present]')).trim() === '0', `“Present 0 of ${n}” before anything is marked`);
check(new URL(tp.url()).pathname === `/admin/teach/${INTRO}/${TUE}`, 'no children’s names in the address');

await tp.click('[data-all-present]');
await tp.waitForFunction((total) => document.querySelector('[data-present]').textContent.trim() === String(total), n);
step(`Mark all present: Present ${n} of ${n}`);
await rows.nth(0).locator('[data-mark="absent"]').click();
await rows.nth(1).locator('[data-more] summary').click();
await rows.nth(1).locator('[data-mark="late"]').click();
await rows.nth(1).locator('[data-more] summary').click();
await rows.nth(1).locator('[data-kid-note]').fill('Arrived at 5:30');
await rows.nth(1).locator('[data-kid-note]').press('Tab');
await rows.nth(1).locator('[data-more] summary').click();
check((await tp.textContent('[data-present]')).trim() === String(n - 1), `one absent, one late: Present ${n - 1} of ${n}`);
check((await rows.nth(1).getAttribute('data-status')) === 'late' && (await rows.nth(1).locator('[data-more-label]').textContent()) === 'Late', 'Late shows on the row');
await tp.fill('[data-report-note]', 'Great rehearsal today. We ran out of glue sticks.');
await tp.click('[data-submit]');
await tp.waitForFunction(() => document.querySelector('[data-submit-state]')?.dataset.state === 'done', null, { timeout: 15_000 });
await tp.waitForFunction(() => document.querySelector('[data-sync-status]')?.textContent.includes('All sent ✓'));
step('Submit attendance: “Done ✓” and “All sent ✓”');
check((await sideways(tp)) <= 0, 'the roster: no sideways scrolling at 390 px');
await tapTargets(tp, '.toggle__btn, .kid-more > summary, [data-all-present], [data-submit], .kid-row__who, .safety-strip', 'the roster');
await shot(tp, 'teach-roster-sent-phone');

// A child's sheet: care details, pickup, emergency contacts, Call and Text.
await rows.nth(0).locator('[data-open-sheet]').click();
const sheet = rows.nth(0).locator('[data-sheet]');
await sheet.waitFor({ state: 'visible' });
check((await sheet.locator('h3').allTextContents()).join('|').includes('Emergency contacts'), 'tapping a child opens their sheet with care details and emergency contacts');
check((await sheet.locator('[data-call]').count()) > 0 && (await sheet.locator('[data-text]').count()) > 0, '… and the parents’ Call and Text');
check((await sheet.locator('a[href^="tel:"]').first().getAttribute('href')).startsWith('tel:'), '… as tel: links');
check(!/payment|\$\d|address/i.test(await sheet.textContent()), '… with nothing about payments or addresses');
await shot(tp, 'teach-child-sheet-phone', false);
await sheet.locator('[data-close-sheet]').click();

// ── 3. Offline ──
await tp.evaluate(() => navigator.serviceWorker.ready);
await tp.waitForFunction(async () => !!(await caches.open('lc-teach-v1').then((c) => c.match(location.href))), null, { timeout: 15_000 });
step('the roster is kept on the phone for today');
await tp.context().setOffline(true);
await rows.nth(0).locator('[data-mark="present"]').click();
await tp.waitForFunction(() => document.querySelector('[data-sync-status]')?.textContent.includes('Saved on this phone'));
step('offline, a change is “Saved on this phone · sending when you have signal”');
await shot(tp, 'teach-roster-offline-phone');
await tp.reload();
await tp.waitForSelector('[data-teach-roster]');
check((await tp.textContent('h1')).includes('Intro to Theater'), 'with no signal, the roster opens from the phone');
await tp.waitForFunction(() => document.querySelector('[data-kid]')?.dataset.status === 'present');
check((await tp.textContent('[data-present]')).trim() === String(n), '… showing the change made offline');
await tp.context().setOffline(false);
await tp.waitForFunction(() => document.querySelector('[data-sync-status]')?.textContent.includes('All sent ✓'), null, { timeout: 30_000 });
step('back online: “All sent ✓”');
await shot(tp, 'teach-roster-back-online-phone');
await tp.goto(`${BASE}/admin/teach?on=${TUE}`);
check((await card.locator('[data-status]').textContent()).includes('Done ✓'), 'Today shows the class as Done ✓');

// ── 4. Only their own classes ──
const monday = addDays(TUE, -1);
for (const path of [`/admin/teach/${PRODUCE}/${monday}`, '/admin/payments', '/admin/search']) {
  const res = await tp.goto(BASE + path);
  check(res.status() === 404 && (await tp.locator('[data-staff-only]').count()), `the teacher gets the Staff only panel at ${path}`);
}
const syncRes = await tp.request.post(`${BASE}/api/teach/sync?on=${TUE}`, {
  data: { by: 'someone-else', taps: [], reports: [] },
  headers: { origin: BASE },
});
check(syncRes.status() === 409, 'taps made by someone else are never sent under this teacher');

// ── 5. Hannah ──
await hp.goto(`${BASE}/admin?on=${TUE}`);
const introToday = hp.locator('[data-today-classes] li').filter({ hasText: 'Intro to Theater' });
check((await introToday.locator('[data-attendance="done"]').textContent()).includes('Attendance done ✓'), 'Hannah’s Today: “Attendance done ✓” on Intro');
const note = hp.locator('[data-teacher-notes] [data-note]').filter({ hasText: 'glue sticks' });
check((await note.textContent()).includes('Note from Jordan Sample:'), 'the note from Jordan shows on Today');
await shot(hp, 'owner-today-note-desktop');
await hp.setViewportSize(PHONE);
check((await sideways(hp)) <= 0, 'Hannah’s Today with a note: no sideways scrolling at 390 px');
await shot(hp, 'owner-today-note-phone');
await hp.click('[data-staff-menu] summary');
check((await hp.locator('.staff-menu__panel a:has-text("Take attendance")').getAttribute('href')) === '/admin/teach', 'Hannah’s phone menu has “Take attendance”');
await hp.click('[data-staff-menu] summary');
await hp.setViewportSize(DESKTOP);
await Promise.all([hp.waitForURL(/\/admin\?on=/), note.locator('[data-note-read]').click()]);
check(!(await hp.locator('[data-note]').filter({ hasText: 'glue sticks' }).count()), 'Mark read: the note leaves Today');

await hp.goto(`${BASE}/admin/classes/${INTRO}`);
const att = hp.locator(`[data-att-date="${TUE}"]`);
// Everyone was there in the end: the absent child was marked present offline, and Late counts as there.
check((await att.textContent()).includes('taken by Jordan Sample') && (await att.locator('[data-att-count]').textContent()).trim() === `${n} of ${n}`, `the class page’s Attendance: ${TUE} ${n} of ${n}, taken by Jordan Sample`);
await shot(hp, 'owner-class-attendance-desktop');
const [download] = await Promise.all([hp.waitForEvent('download'), hp.click('[data-attendance] [data-download="csv"]')]);
const csv = readFileSync(await download.path(), 'utf8').trim().split(/\r?\n/);
check(csv.length === n + 1, `the attendance CSV: one row per child (${csv.length - 1})`);
const md = `${Number(TUE.slice(5, 7))}/${Number(TUE.slice(8, 10))}`;
const col = csv[0].split(',').indexOf(md);
const marks = csv.slice(1).map((r) => r.split(',')[col]).sort();
check(col > 0 && marks.filter((m) => m === 'P').length === n - 1 && marks.includes('L'), `… with ${TUE}’s marks (${marks.join(' ')})`);

await hp.goto(`${BASE}/admin/attention?on=${TUE}`);
const missing = hp.locator('.attention-item').filter({ hasText: 'Attendance not taken: Intro to Theater' });
check(await missing.count(), `Needs attention: “Attendance not taken” for Intro on ${PREV}`);
check((await missing.locator('a').first().getAttribute('href')) === `/admin/teach/${INTRO}/${PREV}`, '… linking to that date’s roster');
await shot(hp, 'owner-attention-desktop');

// Owners may take a missed one: the owner's view of the earlier roster.
await hp.goto(`${BASE}/admin/teach/${INTRO}/${PREV}`);
check(await hp.locator('[data-all-present]').count(), 'Hannah can take attendance for an earlier date');
await shot(hp, 'owner-roster-desktop');

// ── 6. Sign-out clears the phone's copy ──
await tp.goto(roster(TUE));
await tp.evaluate(() => navigator.serviceWorker.ready);
await tp.waitForFunction(async () => !!(await caches.open('lc-teach-v1').then((c) => c.match(location.href))), null, { timeout: 15_000 });
await tp.goto(`${BASE}/admin/teach/me`);
check((await tp.textContent('[data-me-email]')).includes(TEACHER), 'Me shows who’s signed in');
check(await tp.locator('[data-shared-note]').count(), 'Me explains shared devices');
await shot(tp, 'teach-me-phone');
await Promise.all([tp.waitForNavigation(), tp.click('[data-me-signout]')]);
check(await tp.locator('h2:has-text("Staff sign-in")').count(), 'Sign out lands on the staff sign-in');
await tp.context().setOffline(true);
await tp.goto(roster(TUE)).catch(() => {});
check(!(await tp.locator('[data-teach-roster]').count()), 'after signing out, the roster doesn’t open offline');
await tp.context().setOffline(false);

// Teacher's Today on a computer, for the report.
const td = await newPage(DESKTOP);
await td.goto(`${BASE}/admin/teach?on=${TUE}`);
await signIn(td, TEACHER);
await td.waitForSelector('h1:has-text("Hi, Jordan")');
await shot(td, 'teach-today-desktop');
await td.goto(roster(TUE));
await td.waitForFunction(() => document.querySelector('[data-sync-status]')?.textContent.includes('All sent ✓'));
await shot(td, 'teach-roster-sent-desktop');
await td.locator('[data-kid]').nth(0).locator('[data-open-sheet]').click();
await shot(td, 'teach-child-sheet-desktop', false);
await td.locator('[data-kid]').nth(0).locator('[data-close-sheet]').click();
await td.context().setOffline(true);
await td.locator('[data-kid]').nth(0).locator('[data-mark="absent"]').click();
await td.waitForFunction(() => document.querySelector('[data-sync-status]')?.textContent.includes('Saved on this phone'));
await shot(td, 'teach-roster-offline-desktop');
await td.context().setOffline(false);
await td.waitForFunction(() => document.querySelector('[data-sync-status]')?.textContent.includes('All sent ✓'), null, { timeout: 30_000 });
step('on a computer too: saved offline, then sent');

const real = errors.filter((e) => !/Failed to fetch|NetworkError|net::/.test(e));
check(real.length === 0, `no page errors (${real.join('; ')})`);
await browser.close();
