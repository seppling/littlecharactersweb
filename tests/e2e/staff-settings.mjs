#!/usr/bin/env node
/**
 * End-to-end: staff roles and Settings → Staff (docs/back-office.md → Staff roles).
 *
 * - Hannah adds a teacher (a made-up email), gives them two classes and a
 *   substitute date for a third.
 * - The teacher signs in on a shared device and lands on /admin/teach, which
 *   lists their classes for the day; owner pages (Payments, Families, a class
 *   they don't teach, the editor, Settings) show the "Staff only" panel (404).
 * - A shared-device session ends after an hour without use; on their own
 *   device it doesn't.
 * - Hannah turns the teacher off: they can't open staff pages any more.
 * - Settings and the teacher's home at 390 px: no sideways scrolling, 44 px
 *   tap targets.
 *
 * Run last, on the same server as the others:
 *
 *   npm run build && tests/e2e/serve.sh      # fresh local database + sample import
 *   node tests/e2e/staff-settings.mjs [baseUrl] [screenshotDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

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

async function newPage(viewport = DESKTOP) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  return p;
}

async function codeFor(p, email) {
  const mail = await p.context().newPage();
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

/** Types the email and the code, like a person would; ticks "This is a shared device" when asked. */
async function signIn(p, email, { shared = false } = {}) {
  if (!(await p.inputValue('#signin-email'))) await p.fill('#signin-email', email);
  if (shared) await p.check('[data-shared]');
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

/** The next date (YYYY-MM-DD, Athens) falling on a weekday (0 = Sunday), from today. */
function nextWeekday(day) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  while (d.getUTCDay() !== day) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const HANNAH = 'hannah@example.com';
const TEACHER = 'riley.sample.teacher@example.com';
const INTRO = 'intro-f26-tue'; // Tuesdays
const YESAND = 'yesand-f26-wed'; // Wednesdays
const TROUPE = 'troupe-f26-wed'; // Wednesdays: the substitute date
const PRODUCE = 'produce-f26-mon'; // a class Riley doesn't teach
const WED = nextWeekday(3);

// ── 1. Hannah: Settings → Staff ──
const hp = await newPage();
await hp.goto(`${BASE}/admin/settings/staff`);
await signIn(hp, HANNAH);
await hp.waitForSelector('h1:has-text("Staff")');
check(await hp.locator('.staff-sections a[href="/admin/settings"]:has-text("Settings")').count(), 'Settings is in the top bar');
const hannahRow = hp.locator(`[data-staff-row="${HANNAH}"]`);
check((await hannahRow.textContent()).includes('Owner') && (await hannahRow.textContent()).includes('set by the site'), 'Hannah is listed as an owner set by the site');

await hp.fill('#add-name', 'Riley Sample');
await hp.fill('#add-email', 'Riley.Sample.Teacher@Example.com');
check(await hp.isChecked('input[name="role"][value="teacher"]'), 'Teacher is the role chosen by default');
await Promise.all([hp.waitForURL(/\/admin\/settings\/staff\/[^/?]+\?saved=added$/), hp.click('[data-add-staff] button[type="submit"]')]);
check((await hp.textContent('.notice')).includes('Added. They can sign in now.'), 'adding a teacher opens their page with “Added”');
const personUrl = hp.url().split('?')[0];
check((await hp.textContent('.admin-intro')).includes(TEACHER), 'the email is saved in lowercase');

await hp.selectOption(`select[name="class:${INTRO}"]`, 'lead');
await hp.selectOption(`select[name="class:${YESAND}"]`, 'assistant');
await Promise.all([hp.waitForURL(/saved=classes/), hp.click('[data-classes] button[type="submit"]')]);
check((await hp.inputValue(`select[name="class:${INTRO}"]`)) === 'lead' && (await hp.inputValue(`select[name="class:${YESAND}"]`)) === 'assistant', 'two classes saved: teaches Intro, assists Yes, And');

await hp.selectOption('#cover-class', TROUPE);
await hp.fill('#cover-date', WED);
await Promise.all([hp.waitForURL(/saved=cover-added/), hp.click('[data-add-cover] button[type="submit"]')]);
check(await hp.locator(`[data-cover="${TROUPE} ${WED}"]`).count(), `a substitute date is listed (${WED})`);

// A date the class doesn't meet is refused, in plain words.
await hp.selectOption('#cover-class', TROUPE);
await hp.fill('#cover-date', nextWeekday(4));
await hp.click('[data-add-cover] button[type="submit"]');
await hp.waitForSelector('.notice--error');
check((await hp.textContent('.notice--error')).includes('doesn’t meet on that date'), 'a substitute date on a day the class doesn’t meet is refused');
check(!(await hp.locator('.notice[role="status"]').count()), '… and the earlier “added” message is gone');

await shot(hp, 'settings-person-desktop');
await hp.goto(`${BASE}/admin/settings/staff`);
check((await hp.locator(`[data-staff-row="${TEACHER}"]`).textContent()).includes('Teacher'), 'the list shows the new teacher');
await shot(hp, 'settings-staff-desktop');

// Phone: no sideways scrolling, 44 px taps.
await hp.setViewportSize(PHONE);
check((await sideways(hp)) <= 0, 'Settings → Staff: no sideways scrolling at 390 px');
await tapTargets(hp, '.staff-settings a.person, .staff-settings button, .staff-settings .choice', 'Settings → Staff');
await shot(hp, 'settings-staff-phone');
await hp.click('[data-staff-menu] summary');
check(await hp.locator('.staff-menu__panel a[href="/admin/settings"]').isVisible(), 'Settings is in the phone menu');
await hp.click('[data-staff-menu] summary');
await hp.goto(personUrl);
check((await sideways(hp)) <= 0, 'a person’s page: no sideways scrolling at 390 px');
await tapTargets(hp, '.person-page select, .person-page button', 'a person’s page');
await shot(hp, 'settings-person-phone');
await hp.goto(`${BASE}/admin/settings`);
check(await hp.locator('[data-settings-staff]').count(), 'Settings lists Staff');
await hp.setViewportSize(DESKTOP);

// ── 2. The teacher signs in on a shared phone ──
const tp = await newPage(PHONE);
await tp.goto(`${BASE}/admin`);
check(await tp.locator('[data-shared]').count(), 'the staff sign-in offers “This is a shared device”');
await shot(tp, 'signin-shared-phone');
await signIn(tp, TEACHER, { shared: true });
await tp.waitForSelector('h1:has-text("Hi, Riley")');
check(new URL(tp.url()).pathname === '/admin/teach', 'the teacher lands on /admin/teach');
check(!(await tp.locator('.staff-tabs').count()) && !(await tp.locator('[data-staff-search]').count()), 'teachers get no owner tabs or search');
check((await tp.locator('[data-teach-mine-class]').count()) === 2, 'their home lists the two classes they teach');

await tp.goto(`${BASE}/admin/teach?on=${WED}`);
const todayIds = await tp.$$eval('[data-teach-class]', (els) => els.map((e) => e.getAttribute('data-teach-class')));
check(todayIds.includes(YESAND) && todayIds.includes(TROUPE) && todayIds.length === 2, `on ${WED}: their Wednesday class and the substitute date`);
check((await tp.locator(`[data-teach-class="${TROUPE}"]`).textContent()).includes('Substitute'), 'the substitute date is marked');
check((await sideways(tp)) <= 0, 'the teacher’s home: no sideways scrolling at 390 px');
await tapTargets(tp, '.staff-menu summary', 'the teacher’s menu');
await shot(tp, 'teach-home-phone');
await tp.click('[data-staff-menu] summary');
const teacherMenu = await tp.$$eval('.staff-menu__panel a', (as) => as.map((a) => a.textContent.trim()));
check(!teacherMenu.some((t) => ['Payments', 'Families', 'Website', 'Settings'].includes(t)), `the teacher’s menu has no owner pages (${teacherMenu.join(', ')})`);
await tp.click('[data-staff-menu] summary');

// Owner pages: the Staff only panel, with a way back to their classes.
for (const path of ['/admin/payments', '/admin/search', `/admin/classes/${PRODUCE}`, `/admin/classes/${INTRO}`, '/admin/content', '/admin/settings/staff', '/admin/attention']) {
  const res = await tp.goto(BASE + path);
  check(res.status() === 404 && (await tp.locator('[data-staff-only]').count()), `a teacher gets the Staff only panel (404) at ${path}`);
}
check((await tp.locator('a:has-text("Go to your classes")').getAttribute('href')) === '/admin/teach', '… with “Go to your classes”');
await shot(tp, 'teacher-staff-only-phone');
for (const path of [`/admin/classes/${INTRO}.csv`, '/admin/payments.csv']) {
  const res = await tp.request.get(BASE + path, { maxRedirects: 0 });
  check(res.status() === 404, `a teacher can’t download ${path}`);
}
const res = await tp.goto(`${BASE}/admin/install`);
check(res.status() === 200 && (await tp.locator('h1:has-text("Put the app on your phone")').count()), 'teachers can open “Put the app on your phone”');

// Shared device: an hour without use signs them out.
await tp.goto(`${BASE}/admin/teach`);
await tp.request.post(`${BASE}/dev/age-session`, { form: { idleMinutes: '61' }, headers: { origin: BASE } });
await tp.goto(`${BASE}/admin/teach`);
check(await tp.locator('h2:has-text("Staff sign-in")').count(), 'on a shared device, an hour without use signs the teacher out');

// Their own computer: the same hour doesn't.
const td = await newPage(DESKTOP);
await td.goto(`${BASE}/admin/teach`);
await signIn(td, TEACHER);
await td.waitForSelector('h1:has-text("Hi, Riley")');
await td.goto(`${BASE}/admin/teach?on=${WED}`);
await shot(td, 'teach-home-desktop');
const sectionNames = await td.$$eval('.staff-sections a', (as) => as.map((a) => a.textContent.trim()));
check(JSON.stringify(sectionNames) === JSON.stringify(['Your classes']), 'on a computer, the teacher’s top bar has only “Your classes”');
await td.request.post(`${BASE}/dev/age-session`, { form: { idleMinutes: '61' }, headers: { origin: BASE } });
await td.goto(`${BASE}/admin/teach`);
check(await td.locator('h1:has-text("Hi, Riley")').count(), 'on their own device, an hour without use keeps them signed in');

// ── 3. Hannah turns the teacher off ──
await hp.goto(personUrl);
await Promise.all([hp.waitForURL(/saved=deactivated/), hp.click('[data-deactivate] button')]);
check(await hp.locator('[data-turned-off]').count(), 'the teacher is marked “Turned off”');
const off = await td.goto(`${BASE}/admin/teach`);
check(off.status() === 404 && (await td.locator('[data-staff-only]').count()), 'a teacher turned off gets the Staff only panel');
await hp.goto(`${BASE}/admin/settings/staff`);
check((await hp.locator(`[data-staff-row="${TEACHER}"] [data-active="false"]`).count()) === 1, 'the list shows them as turned off; their record stays');

check(errors.length === 0, `no page errors (${errors.join('; ')})`);
await browser.close();
