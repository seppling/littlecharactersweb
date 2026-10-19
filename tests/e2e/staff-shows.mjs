#!/usr/bin/env node
/**
 * End-to-end: shows (src/server/shows.ts): cast lists, roles and rehearsals.
 *
 * - A made-up family (the Penwicks) signs in and adds Juniper; Hannah adds her
 *   to Stories and Songs, a class performing in the Fall Variety Show.
 * - Hannah opens Shows from the menu, adds everyone from Stories and Songs to
 *   the show's cast, finds another child by name, gives roles and a group,
 *   gives Juniper a second role, reorders, and downloads the cast list for
 *   the program (CSV and PDF).
 * - She adds a made-up teacher to Stories and Songs, adds a rehearsal for that
 *   class, and sees it on the calendar (month and phone list).
 * - The teacher sees the rehearsal on their phone's Today, read-only, and
 *   can't open the show's staff page.
 * - The family sees Juniper's roles and the rehearsal in their account, and
 *   nothing about the rest of the cast.
 * - Changing the rehearsal offers "Email the families about this change",
 *   filled in, with only the families called to it ticked.
 * - At 390 px: nothing wider than the screen; on staff pages no button wraps
 *   and every target is 44 px.
 *
 * Run last, after the other browser tests, on the same server:
 *
 *   npm run build && tests/e2e/serve.sh
 *   node tests/e2e/staff-shows.mjs [baseUrl] [screenshotDir]
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
      .filter((el) => el.getBoundingClientRect().height < 44)
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

/** A Saturday at least a week ahead, inside the fall term (Stories and Songs runs to Dec 15). */
function rehearsalSaturday() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const HANNAH = 'hannah@example.com';
const SONGS = 'stories-songs-f26';
const SHOW = 'fall-variety-show';
const SHOW_TITLE = 'Fall 2026 Variety Show';
const stamp = Date.now();
const famEmail = `penwick+${stamp}@example.com`;
const teacherEmail = `sky.sample.teacher+${stamp}@example.com`;
const REH = rehearsalSaturday();
const REH_LABEL = new Date(`${REH}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

// ── 1. A family with a child in a performing class ──
const fp = await newPage();
await fp.goto(`${BASE}/account`);
await signIn(fp, famEmail);
await fp.waitForSelector('#p-name');
await fp.fill('#p-name', 'Morgan Penwick');
await fp.fill('#p-phone', '706-555-0163');
await fp.click('button[type="submit"]');
await fp.waitForSelector('#s-first');
await fp.fill('#s-first', 'Juniper');
await fp.fill('#s-last', 'Penwick');
await fp.fill('#s-bday', '2021-03-03');
await Promise.all([fp.waitForURL(/#students/), fp.click('form:has(input[value="add-student"]) button[type="submit"]')]);
check((await fp.textContent('#students')).includes('Juniper Penwick'), 'a made-up family (the Penwicks) signs in and adds Juniper');

const hp = await newPage();
await hp.goto(`${BASE}/admin/classes/${SONGS}`);
await signIn(hp, HANNAH);
await hp.waitForSelector('[data-roster-tools]');
await hp.click('[data-roster-tools] summary:has-text("Add a child")');
await hp.fill('#find-q', 'Juniper Penwick');
await hp.click('[data-find] button[value="find"]');
await hp.locator('[data-add-child]', { hasText: 'Juniper Penwick' }).locator('button:has-text("Add without charge")').click();
await hp.waitForSelector('[data-add-confirm="free"]');
await hp.fill('#add-reason', 'Test family for the shows check');
const overFull = hp.locator('[data-add-confirm] input[name="overFull"]');
if (await overFull.count()) await overFull.check();
await Promise.all([hp.waitForURL(/done=added/), hp.click('[data-add-confirm] button[value="add-free"]')]);
step('Hannah adds Juniper to Stories and Songs');

// ── 2. Shows, from the menu ──
await hp.goto(`${BASE}/admin`);
const showsLink = hp.locator('.staff-sections a:has-text("Shows")');
check((await showsLink.getAttribute('href')) === '/admin/shows', 'Shows is in the top bar');
await showsLink.click();
await hp.waitForSelector('h1:has-text("Shows")');
const row = hp.locator(`[data-show="${SHOW}"]`);
check((await row.textContent()).includes('Stories and Songs') && (await row.textContent()).includes('0 in the cast'), 'the Variety Show is listed with its performing classes and “0 in the cast”');
check((await row.locator('[data-show-dates]').textContent()).includes('Date to come'), 'a show with no date yet is listed, “Date to come”');
check(await hp.locator('[data-shows="past"] [data-show="jack-and-the-beanstalk"]').count(), 'past shows are listed after the upcoming ones');
await shot(hp, 'shows-list');
await phoneCheck(hp, 'Shows', 'shows-list-390');
await hp.setViewportSize({ width: 390, height: 844 });
await hp.click('[data-staff-menu] summary');
check(await hp.locator('.staff-menu__panel a[href="/admin/shows"]').isVisible(), 'Shows is in the phone menu');
await hp.click('[data-staff-menu] summary');
await hp.setViewportSize({ width: 1280, height: 900 });

// ── 3. The cast ──
await row.click();
await hp.waitForSelector(`h1:has-text("${SHOW_TITLE}")`);
const songsSuggest = hp.locator(`[data-suggest="${SONGS}"]`);
check((await songsSuggest.textContent()).includes('Juniper Penwick'), 'children in the performing classes are offered first');
await Promise.all([hp.waitForURL(/done=added/), songsSuggest.locator(`[data-add-class="${SONGS}"]`).click()]);
check((await hp.textContent('[data-notice]')).includes('to the cast'), '“Add everyone from Stories and Songs” adds them');
check((await hp.locator('[data-cast-name]', { hasText: 'Juniper Penwick' }).count()) === 1, 'Juniper is in the cast');

await hp.fill('#find-q', 'Zara Okafor');
await hp.click('[data-find] button[value="find"]');
check(!hp.url().includes('Zara'), 'finding a child by name is a form post: the name never goes in the address');
await Promise.all([hp.waitForURL(/done=added/), hp.locator('[data-match]', { hasText: 'Zara Okafor' }).locator('button:has-text("Add")').click()]);
check((await hp.locator('[data-cast-name]', { hasText: 'Zara Okafor' }).count()) === 1, 'any other child can be found by name and added');

const castRow = (name, n = 0) => hp.locator('[data-cast-row]').filter({ has: hp.locator('[data-cast-name]', { hasText: name }) }).nth(n);
async function setRole(name, role, group, n = 0) {
  const r = castRow(name, n);
  await r.locator('input[name="role"]').fill(role);
  await r.locator('input[name="group"]').fill(group);
  await Promise.all([hp.waitForURL(/done=saved/), r.locator('[data-save]').click()]);
}
await setRole('Juniper Penwick', 'Narrator', 'Act 1');
await setRole('Zara Okafor', 'Tree', 'Ensemble');
check((await castRow('Juniper Penwick').locator('input[name="role"]').inputValue()) === 'Narrator', 'roles and groups are edited in place');
await Promise.all([hp.waitForURL(/done=role-added/), castRow('Juniper Penwick').locator('[data-another-role]').click()]);
await setRole('Juniper Penwick', 'Moon', 'Act 2', 1);
check((await hp.locator('[data-cast-row]').filter({ hasText: 'Juniper Penwick' }).count()) === 2, 'Juniper has two roles');
check((await castRow('Juniper Penwick').locator('[data-photo]').textContent()).trim() === 'Photos: not asked', 'photo permission comes from the child’s record (“not asked”)');

const order = async () => hp.$$eval('[data-cast-row]', (rows) => rows.map((r) => `${r.querySelector('[data-cast-name]').textContent.trim()}: ${r.querySelector('input[name="role"]').value}`));
const before = await order();
const wrenAt = before.indexOf('Zara Okafor: Tree');
await Promise.all([hp.waitForURL(/done=moved/), castRow('Zara Okafor').locator('[data-up]').click()]);
const after = await order();
check(after.indexOf('Zara Okafor: Tree') === wrenAt - 1, `up moves Zara one place (${after.join(' / ')})`);
// Zara to the top, for the program's order below.
while ((await order())[0] !== 'Zara Okafor: Tree') await Promise.all([hp.waitForURL(/done=moved/), castRow('Zara Okafor').locator('[data-up]').click()]);
const castOrder = await order();
await shot(hp, 'show-cast');
await phoneCheck(hp, 'a show’s cast', 'show-cast-390');

// Copy emails / phones, and Email the cast.
check((await hp.getAttribute('[data-copy-tools]', 'data-emails')).includes(famEmail), 'Copy emails has the cast’s parents’ emails');
await hp.click('[data-email-cast]');
await hp.waitForSelector('h1:has-text("Email the cast")');
check((await hp.locator('[data-family]', { hasText: 'Penwick' }).count()) === 1, 'Email the cast lists the cast’s families (the staff composer)');
await hp.goBack();

// The program download: name, role and group in the cast's order.
const csv = await hp.request.get(`${BASE}/admin/shows/${SHOW}/program.csv`);
const csvText = (await csv.text()).replace(/^﻿/, '');
const lines = csvText.trim().split('\r\n');
check(csv.status() === 200 && lines[0] === 'Name,Role,Group', 'the program cast list downloads as CSV: Name, Role, Group');
check(
  JSON.stringify(lines.slice(1).map((l) => `${l.split(',')[0]}: ${l.split(',')[1]}`)) === JSON.stringify(castOrder),
  `in the cast’s order (${lines.slice(1).join(' / ')})`,
);
check(lines.includes('Juniper Penwick,Narrator,Act 1') && lines.includes('Juniper Penwick,Moon,Act 2'), 'both of Juniper’s roles print, with their groups');
const pdf = await hp.request.get(`${BASE}/admin/shows/${SHOW}/program.pdf`);
check(pdf.status() === 200 && (await pdf.body()).subarray(0, 4).toString() === '%PDF', 'and as a PDF');
const sheet = await hp.request.get(`${BASE}/admin/shows/${SHOW}/cast-sheet.csv`);
const sheetText = await sheet.text();
check(sheetText.includes('Photos') && sheetText.includes('Stories and Songs') && sheetText.includes('(706) 555-0163'), 'the staff cast sheet adds photos, the class and the parents’ phones');

// ── 4. A teacher for Stories and Songs, and a rehearsal for that class ──
await hp.goto(`${BASE}/admin/settings/staff`);
await hp.fill('#add-name', 'Sky Sample');
await hp.fill('#add-email', teacherEmail);
await Promise.all([hp.waitForURL(/saved=added$/), hp.click('[data-add-staff] button[type="submit"]')]);
await hp.selectOption(`select[name="class:${SONGS}"]`, 'lead');
await Promise.all([hp.waitForURL(/saved=classes/), hp.click('[data-classes] button[type="submit"]')]);
step('Hannah adds a made-up teacher, Sky, to Stories and Songs');

await hp.goto(`${BASE}/admin/shows/${SHOW}`);
await hp.click('[data-rehearsal-add] > summary');
const form = hp.locator('[data-rehearsal-add] form');
await form.locator('input[name="date"]').fill(REH);
await form.locator('input[name="start"]').fill('10:00');
await form.locator('input[name="end"]').fill('12:00');
await form.locator('select[name="location"]').selectOption('hq');
await form.locator('textarea[name="note"]').fill('Wear comfy shoes.');
await form.locator(`input[name="classes"][value="${SONGS}"]`).check();
await shot(hp, 'rehearsal-form');
await phoneCheck(hp, 'the rehearsal form', 'rehearsal-form-390');
await Promise.all([hp.waitForURL(/done=rehearsal-added/), form.locator('button[value="rehearsal-add"]').click()]);
const reh = hp.locator('[data-rehearsal]').first();
check((await reh.locator('[data-rehearsal-when]').textContent()).trim() === `${REH_LABEL}, 10 am–12 pm`, `the rehearsal is listed in Athens time (${REH_LABEL}, 10 am–12 pm)`);
check((await reh.textContent()).includes('Stories and Songs') && (await reh.textContent()).includes('Wear comfy shoes.'), 'with the class that rehearses and the note');

// The calendar.
await hp.goto(`${BASE}/admin/calendar?month=${REH.slice(0, 7)}`);
const calItem = hp.locator(`.cal-cell[data-date="${REH}"] [data-cal-rehearsal]`);
check((await calItem.textContent()).includes(`Rehearsal: ${SHOW_TITLE}`), 'the calendar shows the rehearsal on its date');
check((await calItem.getAttribute('href')) === `/admin/shows/${SHOW}`, '… linking to the show');
await shot(hp, 'calendar-rehearsal');
await hp.setViewportSize({ width: 390, height: 844 });
check(await hp.locator(`.cal-day[data-date="${REH}"] .cal-row--rehearsal`).isVisible(), 'the phone’s list shows it too');
await hp.setViewportSize({ width: 1280, height: 900 });
await phoneCheck(hp, 'the calendar with a rehearsal', 'calendar-rehearsal-390');
await hp.goto(`${BASE}/admin/calendar?view=week&week=${REH}`);
check((await hp.locator(`.cal-day[data-date="${REH}"] [data-cal-rehearsal]`).textContent()).includes('10 am–12 pm'), 'and the week view');

// ── 5. The teacher sees it on their phone's Today ──
const tp = await newPage({ width: 390, height: 844 });
await tp.goto(`${BASE}/admin/teach?on=${REH}`);
await signIn(tp, teacherEmail);
await tp.goto(`${BASE}/admin/teach?on=${REH}`);
await tp.waitForSelector('h1:has-text("Hi, Sky")');
const card = tp.locator('[data-teach-rehearsal]');
const cardText = await card.textContent();
check(cardText.includes(`Rehearsal: ${SHOW_TITLE}`) && cardText.includes('10 am–12 pm') && cardText.includes('HQ') && cardText.includes('Wear comfy shoes.'), 'the teacher’s Today has the rehearsal: time, place and note');
check(!(await card.locator('a, button').count()) && !cardText.includes('Juniper'), 'read-only, with no cast');
await phoneCheck(tp, 'the teacher’s Today', 'teach-today-rehearsal-390');
await tp.setViewportSize({ width: 1280, height: 900 });
await shot(tp, 'teach-today-rehearsal');
const blocked = await tp.goto(`${BASE}/admin/shows/${SHOW}`);
check(blocked.status() === 404 && (await tp.locator('[data-staff-only]').count()), 'teachers can’t open the show’s staff page (the cast’s contacts)');

// ── 6. The family sees the role and the rehearsal ──
await fp.goto(`${BASE}/account`);
const mine = fp.locator('[data-shows] [data-show]');
const roleLineText = (await mine.locator('[data-role-line]').textContent()).trim();
check(roleLineText === `Juniper: Narrator, Moon, in ${SHOW_TITLE}`, `the account shows “${roleLineText}”`);
const rehLine = (await mine.locator('[data-rehearsal]').first().textContent()).trim();
check(rehLine.startsWith(`Rehearsal: ${REH_LABEL}, 10 am–12 pm, HQ`), `and “${rehLine}”`);
check(!(await fp.textContent('[data-shows]')).includes('Zara'), 'nothing about other children in the cast');
await shot(fp, 'family-account');
await phoneCheck(fp, 'the family’s account', 'family-account-390', false);
const ics = await fp.request.get(`${BASE}${await fp.locator('[data-calendar-link]').first().getAttribute('href')}`);
check((await ics.text()).includes(`Juniper: Rehearsal\\, ${SHOW_TITLE}`), 'the class’s calendar file lists the rehearsal');

// ── 7. Changing the rehearsal offers an email to its families ──
await hp.goto(`${BASE}/admin/shows/${SHOW}`);
const r0 = hp.locator('[data-rehearsal]').first();
await r0.locator('details.reh__edit > summary').click();
await r0.locator('input[name="end"]').fill('12:30');
await Promise.all([hp.waitForURL(/done=rehearsal-changed/), r0.locator('button[value="rehearsal-save"]').click()]);
check(!decodeURIComponent(hp.url()).match(/Juniper|Penwick|Zara/), 'the change’s address has times and ids, no names');
await hp.click('[data-email-change]');
await hp.waitForSelector('h1:has-text("Email the cast")');
check((await hp.inputValue('#msg-subject')) === `Rehearsal changed: ${SHOW_TITLE}`, '“Email the families about this change” opens the composer, filled in');
check((await hp.inputValue('#msg-body')).includes(`It’s now ${REH_LABEL}, 10 am–12:30 pm, at HQ`), '… with the new time');
const ticked = await hp.$$eval('[data-family] input[name="family"]:checked', (els) => els.map((e) => e.closest('[data-family]').textContent));
check(ticked.some((t) => t.includes('Penwick')) && !ticked.some((t) => t.includes('Okafor')), `only the families called to that rehearsal are ticked: the Penwicks, not Zara’s (${ticked.length} ticked)`);

check(errors.length === 0, `no page errors (${errors.join('; ')})`);
await browser.close();
console.log('\nStaff shows: all checks passed.');
