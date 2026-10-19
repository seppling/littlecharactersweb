#!/usr/bin/env node
/**
 * End-to-end: Today, Needs attention and the staff shell fixes
 * (src/server/today.ts, src/components/admin/AdminShell.astro).
 *
 * - Today's classes on a Tuesday the seed's classes meet (?on=, development
 *   only), and "No classes today" with the next day that has classes.
 * - Needs attention on Today and in full, with working links, and the count
 *   on the Alerts tab and on Today in the top bar.
 * - The focus ring in the dark top bar is clearly visible.
 * - Signing out from a staff page lands on the staff sign-in.
 * - A signed-in parent at /admin gets a 404 with the "Staff only" panel.
 * - At 390 px, nothing is wider than the screen.
 *
 * Run after the other browser tests, on the same server:
 *
 *   npm run build && tests/e2e/serve.sh
 *   node tests/e2e/staff-today.mjs [baseUrl] [screenshotDir]
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
const shot = async (p, name, fullPage = true) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });
const sideways = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const tooWide = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && el.getClientRects().length)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`),
  );
const phone = (p) => p.setViewportSize({ width: 390, height: 844 });
const desktop = (p) => p.setViewportSize({ width: 1280, height: 900 });

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

/** Types the email (unless it's filled in already) and the code, like Hannah would. */
async function signIn(p, email) {
  if (!(await p.inputValue('#signin-email'))) await p.fill('#signin-email', email);
  // Every browser test signs in from the same address: wait out the 5-codes-a-minute limit if needed.
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
}

async function phoneCheck(p, what, name) {
  await phone(p);
  const extra = await sideways(p);
  check(extra <= 0, `${what}: no sideways scrolling at 390 px${extra > 0 ? ` (${(await tooWide(p)).join(', ')})` : ''}`);
  if (name) await shot(p, name);
  await desktop(p);
}

const HANNAH = 'hannah@example.com';
// Tuesday, October 20, 2026: Stories and Songs, Intro to Theater and Acting Studio meet.
const TUESDAY = '2026-10-20';

// ── 1. Today's classes ──
await page.goto(`${BASE}/admin?on=${TUESDAY}`);
await signIn(page, HANNAH);
check(new URL(page.url()).pathname === '/admin', 'signed in on Today');
check((await page.textContent('[data-today-date]')).includes('Tuesday, October 20'), 'Today shows the date');
const classes = page.locator('[data-today-classes] li');
const titles = await classes.allTextContents();
check(titles.some((t) => t.includes('Intro to Theater')) && titles.some((t) => t.includes('Stories and Songs')), `Today lists Tuesday’s classes (${titles.length})`);
check(titles.every((t) => !t.includes('Film Creation')), 'a Thursday class isn’t on Tuesday');
const intro = classes.filter({ hasText: 'Intro to Theater' }).first();
check(/^\d+ of \d+$|^\d+$/.test((await intro.locator('[data-places]').textContent()).trim()), 'each class shows its places filled (“8 of 12”)');
check(/\d(:\d\d)?–\d/.test(await intro.textContent()) && (await intro.textContent()).includes('Zack Newcott'), 'each class shows its time and teacher');
await shot(page, 'today-desktop');
await phoneCheck(page, 'Today', 'today-phone');
await Promise.all([page.waitForURL(/\/admin\/classes\/intro-f26-tue$/), intro.locator('a').click()]);
check((await page.textContent('h1')).includes('Intro to Theater'), 'a class on Today opens its class page');

await page.goto(`${BASE}/admin?on=2026-12-25`);
check((await page.locator('[data-no-classes]').textContent()).includes('No classes today'), '“No classes today” on a day without classes');
check(/Next classes: \w{3}, \w{3} \d+/.test(await page.textContent('[data-no-classes]')), '… with the next day that has classes');

// ── 2. Needs attention ──
await page.goto(`${BASE}/admin`);
const onToday = await page.locator('[data-attention] li').count();
const seeAll = page.locator('[data-see-all]');
if (onToday) {
  await Promise.all([page.waitForURL(/\/admin\/attention$/), seeAll.click()]);
  step(`“See all” on Today opens Needs attention (${onToday} shown on Today)`);
} else {
  check(await page.locator('text=All clear').count(), 'Today says “All clear” when nothing needs attention');
  await page.goto(`${BASE}/admin/attention`);
}
const groups = page.locator('[data-group]');
let listed = 0;
for (const g of await groups.all()) {
  const n = Number(await g.locator('[data-count]').textContent());
  const items = await g.locator('.attention-item').count();
  check(n === items, `“${(await g.locator('h2').textContent()).trim().replace(/\s+\d+$/, '')}” counts its ${items} item(s)`);
  listed += items;
}
check(listed >= onToday, 'the full list has everything Today shows');
const hrefs = [...new Set(await page.locator('.attention-item__action').evaluateAll((as) => as.map((a) => a.getAttribute('href'))))];
for (const href of hrefs) {
  const res = await page.request.get(BASE + href, { maxRedirects: 0 });
  check(res.status() === 200, `the link ${href} works`);
}
await shot(page, 'attention-desktop');
await phoneCheck(page, 'Needs attention', 'attention-phone');

// The count: alert and warning items, on the Alerts tab and on Today in the top bar.
const urgent = await page.locator('.attention-item--alert, .attention-item--warning').count();
const topCount = page.locator('.staff-sections [data-staff-count]');
if (urgent) {
  check(Number(await topCount.locator('[aria-hidden]').textContent()) === urgent, `the top bar’s Today shows ${urgent} needing attention`);
  await phone(page);
  check(Number(await page.locator('.staff-tabs [data-staff-count] [aria-hidden]').textContent()) === urgent, 'the Alerts tab shows the same count');
  await desktop(page);
} else {
  check((await topCount.count()) === 0 && (await page.locator('.staff-tabs [data-staff-count]').count()) === 0, 'no count when nothing is urgent');
}
await phone(page);
await Promise.all([page.waitForURL(/\/admin\/attention$/), page.click('.staff-tabs a:has-text("Alerts")')]);
check((await page.getAttribute('.staff-tabs a:has-text("Alerts")', 'aria-current')) === 'page', 'the Alerts tab opens Needs attention and is lit');
await desktop(page);

// ── 3. The focus ring in the top bar ──
await page.goto(`${BASE}/admin`);
// Tab past the skip link to the first thing in the bar, the brand link.
for (let i = 0; i < 5 && !(await page.evaluate(() => !!document.activeElement?.closest('.staff-top'))); i++) await page.keyboard.press('Tab');
const ring = await page.evaluate(() => {
  const el = document.activeElement;
  const s = getComputedStyle(el);
  const rgb = (c) => c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  const lum = ([r, g, b]) => [r, g, b].map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
  const bar = rgb(getComputedStyle(document.querySelector('.staff-top')).backgroundColor);
  const [hi, lo] = [lum(rgb(s.outlineColor)), lum(bar)].sort((a, b) => b - a);
  return { inBar: !!el.closest('.staff-top'), style: s.outlineStyle, width: parseFloat(s.outlineWidth), contrast: (hi + 0.05) / (lo + 0.05) };
});
check(ring.inBar && ring.style !== 'none' && ring.width >= 2, `Tab reaches the top bar, with a ${ring.width}px ring`);
check(ring.contrast >= 3, `the ring stands out from the dark bar (contrast ${ring.contrast.toFixed(1)}:1)`);
await shot(page, 'focus-ring', false);

// ── 4. Sign out from a staff page ──
await page.goto(`${BASE}/admin/classes`);
await Promise.all([page.waitForURL(`${BASE}/admin`), page.click('.staff-signout')]);
check(await page.locator('h2:has-text("Staff sign-in")').count(), 'signing out from a staff page lands on the staff sign-in');

// ── 5. A signed-in parent sees the staff-only panel ──
const fam = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const fp = await fam.newPage();
fp.on('pageerror', (e) => errors.push(e.message));
await fp.goto(`${BASE}/account`);
await signIn(fp, 'today.parent@example.com');
const res = await fp.goto(`${BASE}/admin`);
check(res.status() === 404, 'a signed-in parent gets 404 at /admin');
check((await fp.textContent('[data-staff-only]')).includes('This page is for Little Characters staff. You’re signed in as today.parent@example.com'), '… with the staff-only panel and their email');
check((await fp.locator('a:has-text("Go to your family account")').getAttribute('href')) === '/account', '… a link to the family account');
check(await fp.locator('form[action="/account/sign-out"] button:has-text("Sign out")').count(), '… and Sign out');
await shot(fp, 'staff-only-desktop');
await phoneCheck(fp, 'The staff-only panel', 'staff-only-phone');
for (const p of ['/admin/attention', '/admin/classes', '/admin/classes/intro-f26-tue']) {
  const r = await fp.goto(BASE + p);
  check(r.status() === 404 && (await fp.locator('[data-staff-only]').count()), `a signed-in parent gets the panel and 404 at ${p}`);
}
await Promise.all([fp.waitForURL(/\/admin\/classes\/intro-f26-tue$/), fp.click('form[action="/account/sign-out"] button')]);
check(await fp.locator('h2:has-text("Staff sign-in")').count(), 'signing out from the panel shows the staff sign-in');
await fam.close();

check(errors.length === 0, `no page errors (${errors.join('; ')})`);
await browser.close();
console.log('\nStaff Today checks passed.');
