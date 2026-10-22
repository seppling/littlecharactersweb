#!/usr/bin/env node
/**
 * End-to-end: the rest of Settings (docs/back-office.md → Settings) and the
 * small follow-ups.
 *
 * - Emails: Hannah changes the waitlist offer's subject and opening, previews
 *   it, sends herself a test (the dev mailbox shows the new wording with the
 *   offer's link still there), saves, and goes back to the original.
 * - Reasons: she adds a drop reason and uses it on Remove; the family page
 *   shows it.
 * - A made-up teacher marks a child Absent with a reason on a 390 px phone,
 *   and Hannah sees it on the class's attendance; teachers can't open any of
 *   the settings pages.
 * - Attendance: a start date makes the older "Attendance not taken" alerts go.
 * - Last season: filled in, saved, cleared.
 * - A rehearsal shows on Today and in the teacher's This week.
 * - At 390 px: nothing wider than the screen; no button wraps; 44 px targets.
 *
 * Run last, after every other browser test, on the same server:
 *
 *   npm run build && tests/e2e/serve.sh
 *   node tests/e2e/staff-settings-rest.mjs [baseUrl] [screenshotDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const SHOTS = process.argv[3];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const hiddenInDetailsScript = () => {
  window.hiddenInDetails = (el) => {
    const d = el.closest('details:not([open])');
    return !!d && !el.closest('details:not([open]) > summary');
  };
};
async function newPage(viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(hiddenInDetailsScript);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  return p;
}
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
      // 43.99, not 44: a button still sliding back from its hover lift measures 43.99999 px (a sub-pixel transform).
      .filter((el) => el.getBoundingClientRect().height < 43.99)
      .map((el) => `${el.tagName.toLowerCase()} “${(el.textContent || el.getAttribute('name') || '').trim().slice(0, 30)}” ${Math.round(el.getBoundingClientRect().height)}px`),
  );

/** At 390 px: nothing sticks out; on a staff page, no button wraps and every target is 44 px. Takes the phone screenshot. */
async function phoneCheck(p, what, name, staff = true) {
  const size = p.viewportSize();
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
  await p.setViewportSize(size);
}

/** The newest email to `to` whose text contains `has`, from the dev mailbox. */
async function mailTo(p, to, has) {
  const mail = await p.context().newPage();
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
  const code = (await mailTo(p, email, 'is your Little Characters sign-in code')).match(/(\d{6}) is your Little Characters sign-in code/)?.[1];
  await Promise.all([p.waitForEvent('load'), p.fill('#signin-code', code)]);
  await p.waitForTimeout(800);
}


const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** The next date (YYYY-MM-DD, Athens) falling on a weekday (0 = Sunday), from tomorrow. */
function nextWeekday(day) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  let d = addDays(today, 1);
  while (new Date(`${d}T12:00:00Z`).getUTCDay() !== day) d = addDays(d, 1);
  return d;
}

const HANNAH = 'hannah@example.com';
const YESAND = 'yesand-f26-wed'; // Wednesdays, 4:30–5:30 pm
const INTRO = 'intro-f26-tue';
const SONGS = 'stories-songs-f26';
const SHOW = 'fall-variety-show';
const SHOW_TITLE = 'Fall 2026 Variety Show';
const WED = nextWeekday(3);
const SAT = addDays(WED, 3);
const stamp = Date.now();
const teacherEmail = `rory.sample.teacher+${stamp}@example.com`;
const DROP = `Started soccer ${stamp % 1000}`;

const hp = await newPage();
await hp.goto(`${BASE}/admin/settings`);
await signIn(hp, HANNAH);
await hp.waitForSelector('h1:has-text("Settings")');
for (const tile of ['emails', 'reasons', 'attendance', 'last-season']) check(await hp.locator(`[data-settings-${tile}]`).count(), `Settings has a ${tile} tile`);

// ── 1. Emails: the waitlist offer's subject and opening ──
await hp.click('[data-settings-emails]');
await hp.waitForSelector('h1:has-text("Emails")');
const offerCard = hp.locator('[data-email="waitlistOffer"]');
check((await offerCard.locator('[data-current-subject]').textContent()).trim() === 'A place opened in {class}', 'the waitlist offer shows its current subject');
check((await offerCard.locator('[data-wording]').getAttribute('data-wording')) === 'original', '… marked “Original wording”');
await shot(hp, 'settings-emails');
await phoneCheck(hp, 'Settings → Emails', 'settings-emails-390');
await offerCard.locator('[data-change]').click();
await hp.waitForSelector('h1:has-text("Waitlist offer")');
check((await hp.textContent('[data-placeholders]')).includes('{deadline}'), 'the placeholders are listed beside the boxes');
await hp.fill('#subject', 'Good news: a place for {child}');
await hp.fill('#intro', 'Hi! A spot just opened in {class}, and it’s yours if you want it.');
await hp.click('[data-preview]');
await hp.waitForSelector('[data-email-preview="draft"]');
const previewText = await hp.textContent('[data-email-preview]');
check((await hp.textContent('[data-preview-subject]')).trim() === 'Good news: a place for Ava', 'Preview: the new subject with sample details (“Ava”)');
check(previewText.includes('A spot just opened in') && previewText.includes('Sign up by') && /\/enroll\/[^\s]+\?offer=sample/.test(previewText), 'the whole email: the new opening, the sign-up date and the offer’s link');
await shot(hp, 'settings-email-preview');
await phoneCheck(hp, 'an email’s preview', 'settings-email-preview-390');
await hp.click('[data-send-test]');
await hp.waitForSelector('[data-test-sent]');
const test = await mailTo(hp, HANNAH, '[Test] Good news: a place for Ava');
check(test.includes('A spot just opened in') && /\/enroll\/[^\s]+\?offer=sample/.test(test), 'Send me a test: the dev mailbox has the new wording, with the offer’s link still there');
// A placeholder this email doesn't have is refused, in words.
await hp.fill('#intro', 'You owe {amount}.');
await hp.click('[data-save]');
check((await hp.textContent('[data-error]')).includes('This email has no {amount}'), 'an unknown placeholder is refused, in words');
await hp.fill('#intro', 'Hi! A spot just opened in {class}, and it’s yours if you want it.');
await Promise.all([hp.waitForURL(/done=saved/), hp.click('[data-save]')]);
await hp.goto(`${BASE}/admin/settings/emails`);
check((await offerCard.locator('[data-wording]').getAttribute('data-wording')) === 'yours' && (await offerCard.locator('[data-current-subject]').textContent()).includes('Good news'), 'saved: the list shows “Your wording”');
await offerCard.locator('[data-change]').click();
await Promise.all([hp.waitForURL(/done=reset/), hp.click('[data-reset]')]);
check((await hp.inputValue('#subject')) === 'A place opened in {class}', 'Back to the original wording');

// ── 2. Reasons: add a drop reason, use it on Remove ──
await hp.goto(`${BASE}/admin/settings/reasons`);
check((await hp.locator('[data-reasons="drop"] [data-reason] .reason__name').allTextContents()).map((t) => t.replace(/^\d+\.\s*/, '').trim()).join('|').startsWith('Schedule|Moved|Cost|Lost interest|Other'), 'drop reasons start with Schedule, Moved, Cost, Lost interest, Other');
await hp.fill('#add-drop', DROP);
await Promise.all([hp.waitForURL(/done=add/), hp.click('[data-add-reason="drop"] button')]);
check(await hp.locator(`[data-reasons="drop"] [data-reason="${DROP}"]`).count(), `“${DROP}” is added at the end`);
await shot(hp, 'settings-reasons');
await phoneCheck(hp, 'Settings → Reasons', 'settings-reasons-390');

/** Puts a sample child in a class without charge (unless they're there already). */
async function addFree(sessionId, name) {
  await hp.goto(`${BASE}/admin/classes/${sessionId}`);
  if (await hp.locator('.kid', { hasText: name }).count()) return;
  await hp.click('[data-roster-tools] summary:has-text("Add a child")');
  await hp.fill('#find-q', name);
  await hp.click('[data-find] button[value="find"]');
  await hp.locator('[data-add-child]', { hasText: name }).locator('button:has-text("Add without charge")').click();
  await hp.waitForSelector('[data-add-confirm="free"]');
  await hp.fill('#add-reason', 'Sample child for the settings check');
  const overFull = hp.locator('[data-add-confirm] input[name="overFull"]');
  if (await overFull.count()) await overFull.check();
  await Promise.all([hp.waitForURL(/done=added/), hp.click('[data-add-confirm] button[value="add-free"]')]);
}
await addFree(INTRO, 'Theo Okafor');
const theo = hp.locator('.kid', { hasText: 'Theo Okafor' });
await theo.locator('summary:has-text("Remove")').click();
await theo.locator('button[value="only"]').click();
await hp.waitForSelector('[data-remove-check="only"]');
await hp.selectOption('#drop-reason', 'Other');
check(await hp.locator('#drop-other').isVisible(), 'Remove asks why (optional); “Other” opens a few words');
await hp.selectOption('#drop-reason', DROP);
check(!(await hp.locator('#drop-other').isVisible()), '… and closes them again for another reason');
await shot(hp, 'remove-reason');
await phoneCheck(hp, 'Remove with a reason', 'remove-reason-390');
await Promise.all([hp.waitForURL(/done=removed-only/), hp.click('[data-remove-check] button[value="remove"]')]);
const famHref = await hp.goto(`${BASE}/admin/search?q=Okafor`).then(() => hp.locator('a[href^="/admin/families/"]').first().getAttribute('href'));
await hp.goto(`${BASE}${famHref}`);
check((await hp.locator('[data-drop-reason]').allTextContents()).some((t) => t.includes(DROP)), 'the family page shows the class as Cancelled, with “Why: …”');

// ── 3. A teacher marks a child absent, with a reason, on a phone ──
await hp.goto(`${BASE}/admin/settings/staff`);
await hp.fill('#add-name', 'Rory Sample');
await hp.fill('#add-email', teacherEmail);
await Promise.all([hp.waitForURL(/saved=added$/), hp.click('[data-add-staff] button[type="submit"]')]);
await hp.selectOption(`select[name="class:${YESAND}"]`, 'lead');
await hp.selectOption(`select[name="class:${SONGS}"]`, 'assistant');
await Promise.all([hp.waitForURL(/saved=classes/), hp.click('[data-classes] button[type="submit"]')]);
step('Hannah adds a made-up teacher, Rory, to two classes');
await addFree(YESAND, 'Zara Okafor');

const tp = await newPage({ width: 390, height: 844 });
await tp.goto(`${BASE}/admin/teach?on=${WED}`);
await signIn(tp, teacherEmail);
for (const path of ['emails', 'reasons', 'attendance', 'last-season']) {
  const res = await tp.goto(`${BASE}/admin/settings/${path}`);
  check(res.status() === 404 && (await tp.locator('[data-staff-only]').count()), `a teacher can’t open Settings → ${path} (Staff only)`);
}
await tp.goto(`${BASE}/admin/teach/${YESAND}/${WED}?on=${WED}`);
const zara = tp.locator('[data-kid]').filter({ hasText: 'Zara O.' });
await zara.waitFor();
check(!(await zara.locator('[data-why]').isVisible()), 'no reasons until a child is marked Absent');
await zara.locator('[data-mark="absent"]').click();
check(await zara.locator('[data-why]').isVisible(), 'Absent offers the reasons, as one optional tap');
check((await zara.locator('[data-reason-choice]').allTextContents()).map((t) => t.trim()).join('|') === 'Sick|Travel|Family|Other', 'Sick, Travel, Family, Other');
await zara.locator('[data-reason-choice="Sick"]').click();
check((await zara.locator('[data-reason-choice="Sick"]').getAttribute('aria-pressed')) === 'true', 'the tapped reason is shown as chosen');
await tp.waitForFunction(() => document.querySelector('[data-sync-status]')?.textContent.includes('All sent ✓'), null, { timeout: 30_000 });
step('saved: “All sent ✓”');
await shot(tp, 'teach-absence-reasons-390');
await phoneCheck(tp, 'the teacher’s absence reasons', null);
await tp.setViewportSize({ width: 1280, height: 900 });
await shot(tp, 'teach-absence-reasons');
await tp.setViewportSize({ width: 390, height: 844 });

await hp.goto(`${BASE}/admin/classes/${YESAND}`);
const att = hp.locator(`[data-att-date="${WED}"] [data-att-absent]`);
check((await att.textContent()).includes('Zara O. (Sick)'), 'Hannah’s class attendance list shows “Absent: Zara O. (Sick)”');

// ── 4. Attendance: a start date makes the old alerts go ──
const THU = addDays(WED, 1);
const notTakenBefore = async (date) =>
  (await hp.locator('[data-kind="attendance"] a, .attention-item a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).filter((h) => /^\/admin\/teach\/[^/]+\/\d{4}-\d{2}-\d{2}/.test(h ?? '') && h.split('/')[4].slice(0, 10) < date);
await hp.goto(`${BASE}/admin/attention?on=${THU}`);
const before = await notTakenBefore(THU);
check(before.some((h) => h.includes(`${YESAND}/${WED}`)), `before: “Attendance not taken” for Yes, And on ${WED} (${before.length} class dates)`);
await hp.goto(`${BASE}/admin/settings/attendance`);
await hp.fill('#start-date', THU);
await Promise.all([hp.waitForURL(/done=start/), hp.click('[data-save-start]')]);
check((await hp.textContent('[data-start-now]')).includes('from'), 'the start date is saved');
await shot(hp, 'settings-attendance');
await phoneCheck(hp, 'Settings → Attendance', 'settings-attendance-390');
await hp.goto(`${BASE}/admin/attention?on=${THU}`);
check((await notTakenBefore(THU)).length === 0, 'after: no “Attendance not taken” for classes before the start date');
await hp.goto(`${BASE}/admin/settings/attendance`);
await Promise.all([hp.waitForURL(/done=start-cleared/), hp.click('[data-clear-start]')]);
check((await hp.textContent('[data-start-now]')).includes('every class date counts'), 'Remove the start date: every class date counts again');

// ── 5. Last season ──
await hp.goto(`${BASE}/admin/settings/last-season`);
check((await hp.textContent('[data-season-note]')).includes('Totals only: no family names.'), 'Last season says “Totals only: no family names.”');
await hp.fill('#season', 'Spring 2026');
await hp.fill('#children', '120');
await hp.fill('#returning', '84');
await hp.fill('#ct-0', 'Intro to Theater (Tuesdays)');
await hp.fill('#ce-0', '11');
await hp.fill('#mm-0', '2026-03');
await hp.fill('#mc-0', '9,500.00');
await hp.click('[data-more-rows]');
check((await hp.locator('[data-class-rows] .rowpair').count()) >= 7 && (await hp.inputValue('#ct-0')) === 'Intro to Theater (Tuesdays)', 'Add more rows keeps what’s typed');
await hp.fill('#ct-1', 'Yes, And!');
await hp.fill('#ce-1', '9');
await hp.fill('#mm-1', '2026-04');
await hp.fill('#mc-1', '9800');
await shot(hp, 'settings-last-season');
await phoneCheck(hp, 'Settings → Last season', 'settings-last-season-390');
await Promise.all([hp.waitForURL(/done=saved/), hp.click('[data-save-season]')]);
check((await hp.inputValue('#mc-0')) === '9500.00' && (await hp.inputValue('#ce-1')) === '9' && (await hp.inputValue('#returning')) === '84', 'saved, and shown again (dollars kept as dollars)');
await Promise.all([hp.waitForURL(/done=cleared/), hp.click('[data-clear]')]);
check((await hp.inputValue('#season')) === '' && !(await hp.locator('[data-clear]').count()), 'Clear removes it');

// ── 6. A rehearsal on Today, and in the teacher's week ──
await hp.goto(`${BASE}/admin/shows/${SHOW}`);
await hp.click('[data-rehearsal-add] > summary');
const form = hp.locator('[data-rehearsal-add] form');
await form.locator('input[name="date"]').fill(SAT);
await form.locator('input[name="start"]').fill('10:00');
await form.locator('input[name="end"]').fill('11:30');
await form.locator('select[name="location"]').selectOption('hq');
await form.locator(`input[name="classes"][value="${SONGS}"]`).check();
await Promise.all([hp.waitForURL(/done=rehearsal-added/), form.locator('button[value="rehearsal-add"]').click()]);
await hp.goto(`${BASE}/admin?on=${SAT}`);
const reh = hp.locator('[data-today-rehearsal]').filter({ hasText: '10–11:30 am' });
check((await reh.textContent()).includes(`Rehearsal: ${SHOW_TITLE}`) && (await reh.textContent()).includes('Stories and Songs'), 'Today shows the day’s rehearsal beside the classes');
check((await reh.getAttribute('href')) === `/admin/shows/${SHOW}`, '… linking to the show');
await shot(hp, 'today-rehearsal');
await phoneCheck(hp, 'Today with a rehearsal', 'today-rehearsal-390');
await tp.goto(`${BASE}/admin/teach?on=${WED}`);
const weekReh = tp.locator('[data-week-rehearsal]').filter({ hasText: '10–11:30 am' });
check((await weekReh.textContent()).includes(`Rehearsal: ${SHOW_TITLE}`) && !(await weekReh.locator('a, button').count()), 'the teacher’s This week lists the rehearsal, read-only');
await phoneCheck(tp, 'the teacher’s This week', 'teach-week-rehearsal-390');

// Tidy up: the drop reason added here.
await hp.goto(`${BASE}/admin/settings/reasons`);
await Promise.all([hp.waitForURL(/done=remove/), hp.locator(`[data-reasons="drop"] [data-reason="${DROP}"] [data-remove-reason]`).click()]);

check(errors.length === 0, `no page errors (${errors.join('; ')})`);
await browser.close();
console.log('\nStaff settings (the rest): all checks passed.');
