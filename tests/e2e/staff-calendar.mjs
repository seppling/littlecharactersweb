#!/usr/bin/env node
/**
 * End-to-end: the staff calendar and days off (docs/back-office.md →
 * Calendar and days off).
 *
 * - The calendar's month (a grid on a computer, a list of days at 390 px) and
 *   week; filtering by program.
 * - A class's Dates, and "Add a day off" from there for Intro to Theater on
 *   Tuesday, December 8, with "Lower that month's payments": the preview's
 *   amounts (Maya $55 → $36 with her scholarship: one class is a fifth of
 *   December's $95), then Save. The family's email in the dev mailbox, and
 *   their account showing the new amount and "No class Dec 8". Ava's December was marked paid by
 *   staff-payments, so she's listed as "Already paid: give a credit" ($16.15,
 *   a fifth of $80.75 with the family discount).
 * - December's billing run, on a copy of the database, charges Maya $36.
 * - Removing the day off puts the amounts back.
 * - A day off for every class with "Don't change payments"; the calendar and
 *   Today show it.
 *
 * Run after every other browser test, on the same server (it needs the two
 * family journeys' enrollments):
 *
 *   npm run build && tests/e2e/serve.sh      # fresh local database + sample import
 *   node tests/e2e/staff-calendar.mjs [baseUrl] [screenshotDir]
 *
 * The billing check copies the server's database folder (PGLITE_DIR, default
 * .data/e2e) and runs `npm run billing:run` on the copy with the Stripe keys
 * blanked.
 */
import { chromium } from 'playwright';
import { cpSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const SHOTS = process.argv[3];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const PGLITE_DIR = process.env.PGLITE_DIR ?? '.data/e2e';

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

/** The latest dev-mailbox message to an address with this subject, or ''. */
async function mailFor(p, email, subject) {
  const mail = await p.context().newPage();
  try {
    await mail.goto(`${BASE}/dev/mailbox`);
    return (await mail.locator('li').filter({ hasText: `to ${email}` }).filter({ hasText: subject }).first().textContent().catch(() => '')) ?? '';
  } finally {
    await mail.close();
  }
}

/** December's billing run on a copy of the server's database: the test charges it prints. */
function decemberCharges() {
  const dir = mkdtempSync(path.join(tmpdir(), 'lc-billing-'));
  try {
    cpSync(PGLITE_DIR, dir, { recursive: true });
    const env = { ...process.env, APP_ENV: 'development', PGLITE_DIR: dir, STRIPE_SECRET_KEY: '', PUBLIC_STRIPE_PUBLISHABLE_KEY: '', STRIPE_WEBHOOK_SECRET: '', RESEND_API_KEY: '' };
    const out = execFileSync('npm', ['run', '-s', 'billing:run', '--', '--today', '2026-12-01'], { env, encoding: 'utf8' });
    return out.split('\n').filter((l) => l.startsWith('[test charge]'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const HANNAH = 'hannah@example.com';
const INTRO = 'intro-f26-tue'; // Intro to Theater: Tuesdays, Aug 17 – Dec 18, $95 a month
const DAY = '2026-12-08';

// ── 1. The calendar on a computer ──
const hp = await newPage();
await hp.goto(`${BASE}/admin/settings/days-off`);
await signIn(hp, HANNAH);
// Run again on the same server: take off this test's own days off first.
for (const reason of ['Snow day', 'Winter break']) {
  const left = hp.locator('.off').filter({ hasText: reason });
  if (!(await left.count())) continue;
  await Promise.all([hp.waitForURL(/remove=/), left.first().locator('[data-remove]').click()]);
  await Promise.all([hp.waitForURL(/done=removed/), hp.click('[data-confirm-remove]')]);
}
await hp.goto(`${BASE}/admin/calendar?month=2026-12`);
await hp.waitForSelector('[data-cal-grid]');
check((await hp.getAttribute('.staff-sections a[href="/admin/calendar"]', 'aria-current')) === 'page', 'Calendar is in the top bar, and lit');
check((await hp.textContent('[data-cal-title]')).trim() === 'December 2026', 'the month is December 2026');
const dec1 = hp.locator('.cal-cell[data-date="2026-12-01"]');
check(await dec1.locator(`[data-cal-class="${INTRO}"]`).count(), 'Intro to Theater is on Tuesday, Dec 1');
check(/\d+\/\d+/.test(await dec1.locator(`[data-cal-class="${INTRO}"]`).textContent()), 'each class shows its places, like “8/12”');
check(!(await hp.locator('[data-cal-agenda]').isVisible()), 'on a computer the month is a grid');
check((await sideways(hp)) <= 0, 'no sideways scrolling on a computer');
await shot(hp, 'calendar-month-desktop');

// Filter by program.
await hp.click('.cal-filters summary');
await hp.selectOption('#f-program', 'intro-to-theater');
await Promise.all([hp.waitForURL(/program=intro-to-theater/), hp.click('[data-filters] button[type="submit"]')]);
const shown = await hp.$$eval('.cal-grid [data-cal-class]', (as) => [...new Set(as.map((a) => a.getAttribute('data-cal-class')))]);
check(shown.length > 0 && shown.every((id) => id.startsWith('intro-')), `filtering by program shows only Intro to Theater (${shown.join(', ')})`);
check((await hp.getAttribute('[data-month-next]', 'href')).includes('program=intro-to-theater'), 'the filter stays on when changing months');

// The week view.
await hp.goto(`${BASE}/admin/calendar?month=2026-12&view=week&week=2026-12-01`);
check((await hp.textContent('[data-cal-title]')).trim() === 'Nov 29–Dec 5, 2026', 'the week view shows Sunday to Saturday');
const roster = await hp.getAttribute(`.cal-day[data-date="2026-12-01"] [data-cal-class="${INTRO}"] [data-roster-link]`, 'href');
check(roster === `/admin/teach/${INTRO}/2026-12-01`, 'each class links to that date’s attendance roster');

// ── 2. At 390 px: the month as a list of days ──
const pp = await newPage(PHONE);
await pp.goto(`${BASE}/admin/calendar?month=2026-12`);
await signIn(pp, HANNAH);
await pp.waitForSelector('[data-cal-agenda]');
check(!(await pp.locator('[data-cal-grid]').isVisible()) && (await pp.locator('[data-cal-agenda]').isVisible()), 'on a phone the month is a list of days');
check(await pp.locator(`.cal-day[data-date="2026-12-01"] [data-cal-class="${INTRO}"]`).count(), 'Dec 1 lists Intro to Theater');
check((await sideways(pp)) <= 0, 'no sideways scrolling at 390 px');
await tapTargets(pp, '.cal-row__what a, .cal-row__side .btn, .cal-nav .btn, .cal-bar .chip, .cal-filters summary', 'the phone calendar');
await pp.click('.staff-menu > summary');
check(await pp.locator('.staff-menu__panel a[href="/admin/calendar"]').isVisible(), 'Calendar is in the phone menu');
await pp.keyboard.press('Escape');
await shot(pp, 'calendar-agenda-phone');

// ── 3. A class's dates, and Add a day off from there ──
await hp.goto(`${BASE}/admin/classes/${INTRO}`);
await hp.waitForSelector('[data-class-dates]');
check(await hp.locator(`[data-class-dates] [data-date="${DAY}"]`).count(), 'the class’s Dates list Dec 8');
const leftBefore = (await hp.textContent('#dates-h')).match(/(\d+) class/)?.[1];
await Promise.all([hp.waitForURL(/\/admin\/settings\/days-off\?/), hp.click('[data-add-day-off]')]);
check(await hp.isChecked(`input[name="class"][value="${INTRO}"]`), 'Add a day off from the class page picks that class');
check(await hp.isChecked('input[name="which"][value="some"]'), '… and “Some classes”');
await hp.fill('#d-from', DAY);
await hp.fill('#d-reason', 'Snow day');
await Promise.all([hp.waitForURL(/step=check/), hp.click('[data-check]')]);
await hp.waitForSelector('[data-preview]');

const lowered = await hp.$$eval('[data-preview-lowered] tr[data-lowered]', (rows) => rows.map((r) => [r.querySelector('[data-now]').textContent.trim(), r.querySelector('[data-after]').textContent.trim(), r.textContent]));
check(lowered.some(([a, b, t]) => a === '$55' && b === '$36' && t.includes('−$19 for Dec 8')), 'the preview: Maya’s $55 (with her scholarship) becomes $36: one fifth of $95 off');
// Staff Payments marked Ava's December paid by cash or check earlier in the run: she's a credit to give, one fifth of $80.75.
const paid = await hp.textContent('[data-preview-paid]');
check(/Ava, Intro to Theater, Dec 8: December is paid\. One class: \$16\.15/.test(paid), 'the preview: Ava’s December is already paid, “give a credit” of $16.15 (her $80.75 has the family discount)');
check(!lowered.some(([a]) => a === '$80.75'), '… and her paid month isn’t lowered');
check((await hp.textContent('[data-preview-classes]')).includes('Intro to Theater'), 'the preview lists the class and its children');
check(!(await hp.locator('[data-save-day-off] input[name="payments"]:checked').count()), 'neither payment choice is picked for Hannah');
const familyHref = await hp.locator('[data-preview-lowered] tr[data-lowered]').filter({ hasText: '$36' }).locator('a').first().getAttribute('href');
await shot(hp, 'day-off-preview-desktop');
const pPrev = pp;
await pPrev.goto(hp.url());
await pPrev.waitForSelector('[data-preview]');
check((await sideways(pPrev)) <= 0, 'the preview has no sideways scrolling at 390 px');
await tapTargets(pPrev, '[data-preview] a, [data-preview] .btn, [data-preview] label.choice', 'the phone preview');
await shot(pPrev, 'day-off-preview-phone');

// Save with "Lower that month's payments".
await hp.check('[data-pay="lower"]');
await Promise.all([hp.waitForURL(/done=added/), hp.click('[data-save]')]);
const saved = await hp.textContent('[data-notice]');
check(/Day off saved for Dec 8\. \d+ monthly payments? lowered\. \d+ famil/.test(saved), `saved: “${saved.trim()}”`);
const row = hp.locator('[data-list="upcoming"] .off').filter({ hasText: 'Snow day' });
check((await row.locator('[data-pay-label]').textContent()).startsWith('Lowered'), 'the list says the payments were lowered');

// The family's email, and their account.
await hp.goto(`${BASE}${familyHref}`);
const parentEmail = (await hp.getAttribute('[data-parents] a[href^="mailto:"]', 'href')).replace('mailto:', '');
const mail = await mailFor(hp, parentEmail, 'No class Dec 8');
check(mail.includes('no class Tue, Dec 8 (Snow day)') && mail.includes('your December payment is now $36 (was $55)'), 'the family is emailed: no class Dec 8, December is now $36');
const fp = await newPage();
await fp.goto(`${BASE}/account`);
await signIn(fp, parentEmail);
await fp.waitForSelector('[data-no-class]');
check((await fp.textContent('[data-no-class]')).includes('No class Dec 8 (Snow day)'), 'the family’s account shows “No class Dec 8 (Snow day)”');
// Staff Payments declined Maya's December charge earlier in the run, so it's under "didn't go through" rather than Upcoming autopay.
const decRow = fp.locator('[data-payments] :is(tr, .alert)').filter({ hasText: 'Day off Dec 8 (Snow day): −$19' });
check((await decRow.count()) > 0 && (await decRow.first().textContent()).includes('$36'), 'the family’s account shows December at $36, with “Day off Dec 8 (Snow day): −$19”');
await shot(fp, 'family-account-day-off');

// The class page's dates strike it through.
await hp.goto(`${BASE}/admin/classes/${INTRO}`);
check((await hp.textContent(`[data-class-dates] [data-date="${DAY}"]`)).includes('No class: Snow day'), 'the class’s Dates strike Dec 8 through, with the reason');
check(Number((await hp.textContent('#dates-h')).match(/(\d+) class/)?.[1]) === Number(leftBefore) - 1, 'one class fewer left');
await hp.locator('[data-class-dates]').scrollIntoViewIfNeeded();
await shot(hp, 'class-dates-desktop');
const pDates = pp;
await pDates.goto(`${BASE}/admin/classes/${INTRO}`);
await pDates.waitForSelector('[data-class-dates]');
check((await sideways(pDates)) <= 0, 'the class page has no sideways scrolling at 390 px');
await pDates.locator('[data-class-dates]').screenshot({ path: SHOTS ? `${SHOTS}/class-dates-phone.png` : `${tmpdir()}/lc-class-dates.png` });

// The public calendar file leaves the day off out.
const ics = await (await hp.request.get(`${BASE}/calendar/${INTRO}.ics`)).text();
check(ics.includes('EXDATE;TZID=America/New_York:20261208T'), 'the class’s calendar file leaves out Dec 8');

// ── 4. December's billing run charges the lowered amounts ──
const charges = decemberCharges();
check(charges.some((l) => l.startsWith('[test charge] $36 ·')), `December’s run charges Maya $36 (${charges.length} charges)`);
check(!charges.some((l) => l.startsWith('[test charge] $55 ·')), '… not $55');

// ── 5. Remove the day off: the amounts go back ──
await hp.goto(`${BASE}/admin/settings/days-off`);
await Promise.all([hp.waitForURL(/remove=/), row.locator('[data-remove]').click()]);
const back = await hp.textContent('[data-remove-changes]');
check(back.includes('$36') && back.includes('$55'), 'removing shows Maya’s December going back up to $55');
await Promise.all([hp.waitForURL(/done=removed/), hp.click('[data-confirm-remove]')]);
check(/Day off removed\. \d+ payments? went back up\./.test(await hp.textContent('[data-notice]')), 'the day off is removed');
await fp.goto(`${BASE}/account`);
check(!(await fp.locator('[data-no-class]').count()), 'the family’s account no longer shows a day off');
const december = fp.locator('[data-payments] :is(tr, .alert)').filter({ hasText: 'December tuition' });
check(!(await fp.locator('[data-payments]').filter({ hasText: 'Day off Dec 8' }).count()) && (await december.first().textContent()).includes('$55'), 'December is back to $55');

// ── 6. Every class, "Don't change payments" ──
await hp.fill('#d-from', '2026-12-15');
await hp.check('input[name="which"][value="all"]');
await hp.fill('#d-reason', 'Winter break');
await Promise.all([hp.waitForURL(/step=check/), hp.click('[data-check]')]);
await hp.check('[data-pay="keep"]');
await Promise.all([hp.waitForURL(/done=added/), hp.click('[data-save]')]);
check((await hp.textContent('[data-notice]')).includes('Payments weren’t changed.'), '“Don’t change payments” saves without changing payments');
check((await hp.locator('[data-list="upcoming"] .off').filter({ hasText: 'Winter break' }).locator('[data-pay-label]').textContent()).trim() === 'Payments not changed', 'the list says payments weren’t changed');
await fp.goto(`${BASE}/account`);
check((await fp.textContent('[data-no-class]')).includes('No class Dec 15 (Winter break)'), 'the family sees “No class Dec 15 (Winter break)”');
check((await december.first().textContent()).includes('$55'), '… and December stays $55');
const pList = pp;
await pList.goto(`${BASE}/admin/settings/days-off`);
check((await sideways(pList)) <= 0, 'Days off has no sideways scrolling at 390 px');
await tapTargets(pList, '.off .btn, .off summary, [data-add-day-off] label.choice, [data-add-day-off] .btn', 'Days off on a phone');
await shot(pList, 'days-off-phone');
await hp.goto(`${BASE}/admin/settings/days-off`);
await shot(hp, 'days-off-desktop');

await hp.goto(`${BASE}/admin/calendar?month=2026-12`);
check((await hp.textContent('.cal-cell[data-date="2026-12-15"] [data-day-off]')).includes('Winter break'), 'the calendar shows a band across Dec 15');
await hp.goto(`${BASE}/admin?on=2026-12-15`);
check((await hp.textContent('[data-today-classes], [data-no-classes]')).includes('No classes today: Winter break'), 'Today says “No classes today: Winter break”');
await hp.goto(`${BASE}/admin/settings`);
check(await hp.locator('[data-settings-days-off]').count(), 'Settings has a Days off tile');

// ── 7. Downloads need a fresh sign-in and come back as files ──
const csv = await hp.request.get(`${BASE}/admin/calendar.csv?month=2026-12`);
check(csv.ok() && (await csv.text()).includes('Winter break'), 'the Daily Class Schedule CSV lists the day off');
const pdf = await hp.request.get(`${BASE}/admin/calendar.pdf?month=2026-12&report=classes`);
check(pdf.ok() && (await pdf.body()).subarray(0, 4).toString() === '%PDF', 'the Class Schedule PDF downloads');

check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join('; ')}` : ''}`);
await browser.close();
console.log('\nAll calendar checks passed.');
