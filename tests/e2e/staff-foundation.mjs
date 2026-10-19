#!/usr/bin/env node
/**
 * End-to-end: the staff back office's shared pieces (docs/back-office.md).
 *
 * - Staff sign in; the top bar on a computer, the tab bar and menu on a phone.
 * - The search box goes to /admin/search; the old addresses redirect.
 * - The staff app's manifest loads without signing in; /admin/install.
 * - Downloads need a sign-in from the last 15 minutes: the leads CSV and PDF
 *   download right after signing in, and ask again once the session is older.
 * - A staff session unused for 30 days is signed out.
 * - A signed-in parent gets "Not found" on staff pages.
 *
 * Run after the other four browser tests, on the same server:
 *
 *   npm run build && tests/e2e/serve.sh      # fresh local database + sample import
 *   node tests/e2e/staff-foundation.mjs [baseUrl] [screenshotDir]
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
const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
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

/** Types the email (unless it's filled in already) and the code, like Hannah would. */
async function signIn(p, email, { waitForNav = true } = {}) {
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
  const code = await codeFor(email);
  if (waitForNav) await Promise.all([p.waitForNavigation(), p.fill('#signin-code', code)]);
  else await p.fill('#signin-code', code);
}

const HANNAH = 'hannah@example.com';

// ── 1. Sign in where she wanted to go ──
await page.goto(`${BASE}/admin`);
await page.waitForSelector('h1:has-text("Staff sign-in"), h2:has-text("Staff sign-in")');
check(!(await page.locator('.site-header').count()), 'staff pages don’t show the family site’s header');
await signIn(page, HANNAH);
await page.waitForSelector('h1:has-text("Today")');
check(page.url() === `${BASE}/admin`, 'Hannah signs in with a code and lands on Today');

// ── 2. Computer: the top bar ──
const sections = await page.$$eval('.staff-sections a', (as) => as.map((a) => [a.textContent.trim(), a.getAttribute('href'), a.getAttribute('aria-current')]));
check(
  JSON.stringify(sections.map((s) => s[0])) === JSON.stringify(['Today', 'Classes', 'Families', 'Payments', 'Messages & sign-ups', 'Website', 'Settings']),
  `top bar sections in order: ${sections.map((s) => s[0]).join(', ')}`,
);
check(sections[0][2] === 'page', 'Today is marked as the current section');
check(await page.locator('.staff-account__email', { hasText: HANNAH }).isVisible(), 'her email shows in the top bar');
check(await page.locator('.staff-signout').isVisible(), 'Sign out is in the top bar');
check(!(await page.locator('.staff-tabs').isVisible()), 'no phone tab bar on a computer');
check(await page.locator('a[href="/admin/classes"]').count(), 'Today links to Classes');
await shot('shell-desktop', false);

await page.fill('#staff-q', 'Rivera');
await Promise.all([page.waitForURL(/\/admin\/search\?q=Rivera$/), page.press('#staff-q', 'Enter')]);
check(new URL(page.url()).pathname === '/admin/search', 'the search box submits to /admin/search?q=');
check((await page.inputValue('#staff-q')) === 'Rivera', 'the search box keeps the words on the results page');

// ── 3. Old addresses redirect for good ──
for (const [from, to] of [
  ['/admin/intro-f26-tue', '/admin/classes/intro-f26-tue'],
  ['/admin/billing', '/admin/payments'],
]) {
  const res = await page.request.get(BASE + from, { maxRedirects: 0 });
  check(res.status() === 301 && res.headers().location === to, `${from} → ${to} (301)`);
}
await page.goto(`${BASE}/admin/payments`);
const orderLink = await page.locator('a[href^="/admin/payments/"]').first().getAttribute('href').catch(() => null);
if (orderLink) {
  const id = orderLink.split('/').pop();
  const res = await page.request.get(`${BASE}/admin/billing/${id}`, { maxRedirects: 0 });
  check(res.status() === 301 && res.headers().location === orderLink, `/admin/billing/<order> → ${orderLink} (301)`);
}
check((await page.request.get(`${BASE}/admin/billing/no-such-order`, { maxRedirects: 0 })).status() === 404, 'an unknown order’s old address is “Not found”');
check((await page.request.get(`${BASE}/admin/no-such-class`, { maxRedirects: 0 })).status() === 404, 'an unknown class’s old address is “Not found”');
await page.goto(`${BASE}/admin/intro-f26-tue`);
check(page.url() === `${BASE}/admin/classes/intro-f26-tue`, 'the browser follows the old roster address to its new home');

// ── 4. Phone: tab bar, title, back link, menu ──
await phone();
await page.goto(`${BASE}/admin`);
const tabs = await page.$$eval('.staff-tabs a', (as) => as.map((a) => ({ text: a.textContent.trim(), href: a.getAttribute('href'), current: a.getAttribute('aria-current'), h: a.getBoundingClientRect().height, w: a.getBoundingClientRect().width })));
check(JSON.stringify(tabs.map((t) => t.text)) === JSON.stringify(['Today', 'Classes', 'Search', 'Alerts']), 'phone tab bar: Today, Classes, Search, Alerts');
check(JSON.stringify(tabs.map((t) => t.href)) === JSON.stringify(['/admin', '/admin/classes', '/admin/search', '/admin/attention']), 'tabs go to /admin, /admin/classes, /admin/search, /admin/attention');
check(tabs.every((t) => t.h >= 44 && t.w >= 44), `tabs are at least 44 px (${Math.min(...tabs.map((t) => t.h))} px tall)`);
check(tabs[0].current === 'page' && tabs.filter((t) => t.current).length === 1, 'the current tab is marked');
check(!(await page.locator('.staff-sections').isVisible()) && !(await page.locator('#staff-q').isVisible()), 'the computer top bar is hidden on a phone');
check((await page.locator('.staff-phonebar__title').textContent()).trim() === 'Today', 'the phone top bar shows the page title');
check((await sideways()) <= 0, 'no sideways scrolling at 390 px');
await shot('shell-phone-today', false);

await page.click('.staff-menu summary');
const menu = await page.$$eval('.staff-menu__panel a', (as) => as.map((a) => a.textContent.trim()));
for (const label of ['Payments', 'Messages & sign-ups', 'Website', 'Put the app on your phone']) check(menu.includes(label), `phone menu has ${label}`);
const menuHeights = await page.$$eval('.staff-menu__panel a, .staff-menu summary', (as) => as.map((a) => a.getBoundingClientRect().height));
check(menuHeights.every((h) => h >= 44), 'menu items are at least 44 px tall');
await shot('shell-phone-menu', false);
await page.keyboard.press('Escape');
check(!(await page.locator('.staff-menu__panel').isVisible()), 'Escape closes the menu');

await page.goto(`${BASE}/admin/classes/intro-f26-tue`);
const back = page.locator('[data-staff-back]');
check((await back.getAttribute('href')) === '/admin/classes' && (await back.isVisible()), 'a class shows a back link to Classes on a phone');
check((await page.$eval('.staff-tabs a[aria-current="page"]', (a) => a.textContent.trim())) === 'Classes', 'Classes is the current tab on a class');
// The roster moved unchanged; its wide table is the Classes unit's to rebuild for phones.
console.log(`· note: the old roster table is ${await sideways()} px wider than a 390 px phone (unchanged page, rebuilt by the Classes unit)`);
await shot('shell-phone-class', false);

await page.goto(`${BASE}/admin/content`);
check(await page.locator('.staff-hint', { hasText: 'works best on a computer' }).isVisible(), 'the website editor says it works best on a computer');
check(await page.locator('a[href="/admin/content/pages/site"]').first().isVisible(), 'the editor stays usable on a phone');
await page.goto(`${BASE}/admin/payments`);
check((await sideways()) <= 0, 'Payments has no sideways scrolling at 390 px');
await page.goto(`${BASE}/admin/leads`);
check((await sideways()) <= 0, 'Messages & sign-ups has no sideways scrolling at 390 px');
await desktop();
await page.goto(`${BASE}/admin/content`);
check(!(await page.locator('.staff-hint').isVisible()), 'no “best on a computer” line on a computer');

// ── 5. The phone app: manifest and install page ──
const anon = await fetch(`${BASE}/admin/app.webmanifest`);
const manifest = await anon.json();
check(anon.status === 200 && /manifest\+json/.test(anon.headers.get('content-type')), 'the manifest loads without signing in');
check(manifest.name === 'Little Characters Staff' && manifest.short_name === 'LC Staff', 'manifest names: Little Characters Staff, LC Staff');
check(manifest.start_url === '/admin' && manifest.scope === '/admin' && manifest.id === '/admin' && manifest.display === 'standalone', 'manifest: start_url, scope and id /admin, standalone');
check(manifest.theme_color === '#1c1826' && manifest.background_color === '#ffffff', 'manifest colors from the design tokens');
const sizes = manifest.icons.map((i) => `${i.sizes} ${i.purpose}`);
check(['192x192 any', '512x512 any', '512x512 maskable'].every((s) => sizes.includes(s)), 'icons: 192, 512 and a maskable 512');
for (const i of manifest.icons) {
  const r = await fetch(BASE + i.src);
  check(r.status === 200 && r.headers.get('content-type') === 'image/png', `${i.src} loads`);
}
await page.goto(`${BASE}/admin`);
check((await page.getAttribute('link[rel="manifest"]', 'href')) === '/admin/app.webmanifest', 'staff pages link the manifest');
check((await page.getAttribute('meta[name="apple-mobile-web-app-title"]', 'content')) === 'LC Staff', 'staff pages name the iPhone home-screen app');
const familyHead = await (await fetch(`${BASE}/`)).text();
check(!familyHead.includes('app.webmanifest') && !familyHead.includes('apple-mobile-web-app-title'), 'the family site has no staff manifest');

await page.goto(`${BASE}/admin/install`);
await page.waitForSelector('h1:has-text("Put the app on your phone")');
check(await page.locator('[data-platform="iphone"] li').count() === 3, 'install: three iPhone steps');
check(await page.locator('[data-platform="iphone"]', { hasText: 'Add to Home Screen' }).isVisible(), 'install: Share, then Add to Home Screen');
check(await page.locator('[data-install-fallback]', { hasText: 'Install app' }).isVisible(), 'install: Android’s Chrome menu as the fallback');
check(await page.locator('[data-install]').isHidden(), 'install: no Install button until Chrome offers one');
check(await page.locator('[data-installed]').isHidden(), 'install: not open as the app, so no “you’re using the app”');
await shot('install-desktop');
await phone();
check((await sideways()) <= 0, 'install page: no sideways scrolling at 390 px');
await shot('install-phone');
await desktop();
const app = await browser.newContext({ viewport: { width: 390, height: 844 } });
await app.addInitScript(() => {
  const real = window.matchMedia.bind(window);
  window.matchMedia = (q) => (q.includes('display-mode: standalone') ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q));
});
await app.addCookies(await ctx.cookies());
const appPage = await app.newPage();
await appPage.goto(`${BASE}/admin/install`);
check(await appPage.locator('[data-installed]').isVisible(), 'install: opened as the app, it says so');
await app.close();

// ── 6. Downloads: fresh sign-in, then asked again ──
// A few made-up form entries, one that looks like a spreadsheet formula.
for (const [kind, email, extra] of [
  ['newsletter', 'june.carter@example.com', {}],
  ['notify', 'sam.ortiz@example.com', { program: 'intro-to-theater' }],
  ['contact', 'lee.park@example.com', { name: 'Lee Park', topic: 'general', message: '=SUM(1,2) Is there room for twins, ages 7, in Intro to Theater this fall? We’re new to Athens.' }],
]) {
  const res = await fetch(`${BASE}/api/leads`, { method: 'POST', headers: { origin: BASE, accept: 'application/json' }, body: new URLSearchParams({ kind, email, ...extra }) });
  if (!res.ok) throw new Error(`Couldn’t add a sample ${kind}: ${res.status}`);
}
await page.goto(`${BASE}/admin/leads`);
check((await page.getAttribute('[data-download="csv"]', 'href')) === '/admin/leads.csv' && (await page.getAttribute('[data-download="pdf"]', 'href')) === '/admin/leads.pdf', 'Messages & sign-ups has CSV and PDF buttons');
await shot('leads-desktop', false);
await phone();
check((await sideways()) <= 0, 'Messages & sign-ups, with entries, has no sideways scrolling at 390 px');
await shot('leads-phone');
await desktop();
const listed = await page.locator('[data-leads] tbody tr').count();
let [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-download="csv"]')]);
const csv = readFileSync(await download.path(), 'utf8');
check(csv.startsWith('﻿When,Form,Name,Email,About,Message\r\n'), 'right after signing in, the CSV downloads (byte-order mark, header row)');
check(listed >= 3 && csv.trim().split('\r\n').length - 1 === listed, `the CSV has the page’s ${listed} rows`);
check(csv.includes(`"'=SUM(1,2)`) && !csv.includes(',=SUM'), 'a message that looks like a formula is kept from running');
check(csv.includes('Intro to Theater'), 'the CSV names the class, as the page does');
check(/\.csv$/.test(download.suggestedFilename()), `CSV file name: ${download.suggestedFilename()}`);
[download] = await Promise.all([page.waitForEvent('download'), page.click('[data-download="pdf"]')]);
const pdf = readFileSync(await download.path());
check(pdf.subarray(0, 4).toString() === '%PDF', `the PDF downloads (${Math.round(pdf.length / 1024)} KB)`);
if (SHOTS) writeFileSync(`${SHOTS}/leads.pdf`, pdf);

// 20 minutes later, a download asks her to confirm it's her.
const aged = await page.request.post(`${BASE}/dev/age-session`, { form: { minutes: '20' }, headers: { origin: BASE } });
check(aged.status() === 204, 'test-only: the session is aged by 20 minutes (development only)');
await Promise.all([page.waitForURL(/\/admin\/confirm\?next=%2Fadmin%2Fleads\.csv$/), page.click('[data-download="csv"]')]);
await page.waitForSelector('h1:has-text("Confirm it’s you before downloading")');
check((await page.inputValue('#signin-email')) === HANNAH, 'later, the CSV asks her to confirm it’s her, email filled in');
await shot('confirm-desktop', false);
await phone();
check((await sideways()) <= 0, 'confirm page: no sideways scrolling at 390 px');
await shot('confirm-phone', false);
await desktop();
const waitDownload = page.waitForEvent('download');
await signIn(page, HANNAH, { waitForNav: false });
download = await waitDownload;
check(readFileSync(await download.path(), 'utf8').startsWith('﻿When,'), 'after the new code, the CSV downloads');
await page.waitForSelector('[data-confirmed] >> text=Thanks, you’re confirmed');
check((await page.getAttribute('[data-confirmed] a:has-text("Back to the list")', 'href')) === '/admin/leads', '“Back to the list” returns to Messages & sign-ups');
[download] = await Promise.all([page.waitForEvent('download'), page.goto(`${BASE}/admin/leads.pdf`).catch(() => null)]);
check(readFileSync(await download.path()).subarray(0, 4).toString() === '%PDF', 'and the PDF downloads without asking again');

// Return addresses stay on staff pages.
const evil = await page.request.get(`${BASE}/admin/confirm?next=${encodeURIComponent('https://evil.example/admin')}`, { maxRedirects: 0 });
check(evil.status() === 303 && evil.headers().location === '/admin', 'a return address off the staff pages goes to Today instead');

// Signed out, a download link asks for sign-in first.
const out = await fetch(`${BASE}/admin/leads.pdf`, { redirect: 'manual' });
check(out.status === 303 && out.headers.get('location') === '/admin/confirm?next=%2Fadmin%2Fleads.pdf', 'signed out, the PDF link goes to confirm first');

// ── 7. 30 days without use signs staff out ──
await page.request.post(`${BASE}/dev/age-session`, { form: { days: '31' }, headers: { origin: BASE } });
await page.goto(`${BASE}/admin`);
check(await page.locator('h2:has-text("Staff sign-in")').count(), 'a staff session unused for 30 days is signed out');

// ── 8. A signed-in parent gets "Not found" ──
const fam = await browser.newContext();
const fp = await fam.newPage();
await fp.goto(`${BASE}/account`);
await signIn(fp, 'foundation.parent@example.com');
for (const p of ['/admin', '/admin/classes', '/admin/classes/intro-f26-tue', '/admin/payments', '/admin/leads', '/admin/leads.csv', '/admin/leads.pdf', '/admin/search?q=a', '/admin/attention', '/admin/install', '/admin/confirm?next=%2Fadmin', '/admin/intro-f26-tue', '/admin/billing', '/admin/billing/x']) {
  const res = await fp.request.get(BASE + p, { maxRedirects: 0 });
  check(res.status() === 404, `a signed-in parent gets 404 at ${p}`);
}
await fam.close();

check(errors.length === 0, `no page errors (${errors.join('; ')})`);
await browser.close();
console.log('\nStaff foundation checks passed.');
