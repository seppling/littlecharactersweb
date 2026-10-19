#!/usr/bin/env node
/**
 * End-to-end: reports (src/server/reports/), on the data the other browser
 * tests left behind.
 *
 * - Hannah opens Reports from the menu: six tiles with numbers, and each tile
 *   opens its report showing the same total.
 * - The library lists every group, each report with its Studio Director name.
 * - Starring a report puts it first in the library and under the tiles.
 * - A report's CSV and PDF ask for a fresh sign-in first, then download the
 *   same rows; sorting by a column reorders the table.
 * - The allergy and medical list asks for a fresh sign-in, then shows a
 *   class's list once one is picked.
 * - A chart's "Show the numbers" opens its table.
 * - A teacher gets the Staff only panel.
 * - At 390 px: nothing wider than the screen, no button wraps, every target
 *   is 44 px.
 *
 * Run last, after every other browser test, on the same server:
 *
 *   npm run build && tests/e2e/serve.sh
 *   node tests/e2e/staff-reports.mjs [baseUrl] [screenshotDir]
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

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
  const ctx = await browser.newContext({ viewport, acceptDownloads: true });
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
const brokenButtons = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll('.admin-page .btn, .admin-page .star')]
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
const smallTargets = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll('.admin-page a, .admin-page button, .admin-page input:not([type="hidden"], [type="checkbox"], [type="radio"]), .admin-page select, .admin-page summary')]
      .filter((el) => el.getClientRects().length && !el.closest('.sr-only') && !hiddenInDetails(el))
      .filter((el) => el.getBoundingClientRect().height < 44)
      .map((el) => `${el.tagName.toLowerCase()} “${(el.textContent || el.getAttribute('name') || '').trim().slice(0, 30)}” ${Math.round(el.getBoundingClientRect().height)}px`),
  );

async function phoneCheck(p, what, name) {
  const size = p.viewportSize();
  await p.setViewportSize({ width: 390, height: 844 });
  const extra = await sideways(p);
  check(extra <= 0, `${what}: no sideways scrolling at 390 px${extra > 0 ? ` (${(await tooWide(p)).join(', ')})` : ''}`);
  const broken = await brokenButtons(p);
  check(broken.length === 0, `${what}: no button breaks onto two lines at 390 px${broken.length ? ` (${broken.join(', ')})` : ''}`);
  const small = await smallTargets(p);
  check(small.length === 0, `${what}: links, buttons and fields are at least 44 px tall at 390 px${small.length ? ` (${small.join('; ')})` : ''}`);
  if (name) await shot(p, name);
  await p.setViewportSize(size);
}

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

/** Types the email (unless it's filled in) and the code, waiting out the 5-codes-a-minute limit. */
async function signIn(p, email, { waitForNav = true } = {}) {
  if (!(await p.inputValue('#signin-email'))) await p.fill('#signin-email', email);
  for (let tries = 0; ; tries++) {
    const before = await mailTo(p, email, 'is your Little Characters sign-in code');
    await p.click('[data-step="email"] button[type="submit"]');
    await p.waitForSelector('#signin-code:visible, [data-error]:visible');
    if (await p.locator('#signin-code').isVisible()) {
      let text = '';
      for (let i = 0; i < 20 && (!text || text === before); i++) {
        text = await mailTo(p, email, 'is your Little Characters sign-in code');
        if (text === before) await p.waitForTimeout(250);
      }
      const code = text.match(/(\d{6}) is your Little Characters sign-in code/)?.[1];
      if (waitForNav) await Promise.all([p.waitForEvent('load'), p.fill('#signin-code', code)]);
      else await p.fill('#signin-code', code);
      await p.waitForTimeout(800);
      return;
    }
    const error = await p.textContent('[data-error]');
    if (tries >= 2 || !/Too many tries/.test(error)) throw new Error(`Sign-in failed: ${error}`);
    console.log('· waiting a minute for the sign-in rate limit');
    await p.waitForTimeout(61_000);
  }
}

const HANNAH = 'hannah@example.com';
const TEACHER = 'jordan.sample.teacher@example.com'; // added by staff-teach.mjs
const text = async (p, sel) => ((await p.textContent(sel)) ?? '').replace(/\s+/g, ' ').trim();

// ── 1. The dashboard ──
const page = await newPage();
await page.goto(`${BASE}/admin`);
await signIn(page, HANNAH);
await page.locator('.staff-sections a', { hasText: 'Reports' }).click();
await page.waitForURL(`${BASE}/admin/reports`);
check((await page.locator('.staff-sections a[aria-current="page"]').textContent()).trim() === 'Reports', 'Reports is in the top bar, and lit on the dashboard');
const tiles = await page.$$eval('[data-tiles] [data-tile]', (els) =>
  els.map((el) => ({ key: el.dataset.tile, value: el.querySelector('[data-tile-value]').textContent.trim(), href: el.querySelector('a').getAttribute('href') })),
);
check(tiles.length === 6, `six tiles across the top (${tiles.map((t) => t.key).join(', ')})`);
check(/^\$[\d,]+(\.\d\d)?$/.test(tiles.find((t) => t.key === 'payments-received').value), `Collected this month shows money (${tiles.find((t) => t.key === 'payments-received').value})`);
check(/^\d+$/.test(tiles.find((t) => t.key === 'children').value), `Children this season shows a number (${tiles.find((t) => t.key === 'children').value})`);
check((await page.locator('[data-tile] [data-how]').count()) >= 6, 'each tile has “How it’s counted”');
await page.locator('[data-tile="classes"] [data-how] summary').click();
check((await text(page, '[data-tile="classes"] [data-how] p')).startsWith('Enrolled ÷ places'), 'opening it says how the fill rate is counted');
await shot(page, 'dashboard-desktop');

for (const t of tiles) {
  await page.goto(BASE + t.href);
  const total = await text(page, '[data-total-value]');
  check(total === t.value, `the ${t.key} tile opens its report with the same total (${total})`);
}
await page.goto(`${BASE}/admin/reports`);
for (const panel of ['classes', 'owes', 'money', 'pace', 'heard', 'safety']) check((await page.locator(`[data-panel="${panel}"]`).count()) === 1, `the ${panel} panel is there`);

// A chart's numbers, as a table.
const chart = page.locator('[data-chart="chart-money"]');
if (await chart.count()) {
  await chart.locator('summary').click();
  check(await chart.locator('table tbody tr').first().isVisible(), 'Money by month: “Show the numbers” opens the chart’s table');
  await chart.screenshot({ path: SHOTS ? `${SHOTS}/chart-with-table.png` : undefined });
}
await phoneCheck(page, 'The dashboard', 'dashboard-390');

// ── 2. The library, and starring ──
await page.goto(`${BASE}/admin/reports`);
await page.click('[data-library-link]');
await page.waitForURL(`${BASE}/admin/reports/library`);
const groups = await page.$$eval('[data-group]', (els) => els.map((e) => e.dataset.group));
check(['money', 'enrollment', 'growth', 'safety', 'teachers', 'elsewhere'].every((g) => groups.includes(g)), `the library lists every group (${groups.join(', ')})`);
check((await text(page, '[data-report-item="coming-back"]')).includes('was: Retention List'), 'each report shows its Studio Director name (“was: Retention List”)');
await Promise.all([page.waitForURL(/\/admin\/reports\/library$/), page.click('[data-group="money"] [data-star="who-owes"]')]);
check((await page.$$eval('[data-group]', (els) => els.map((e) => e.dataset.group)))[0] === 'starred', 'starring a report adds Starred at the top');
check((await page.$$eval('[data-group="starred"] [data-report-item]', (els) => els.map((e) => e.dataset.reportItem)))[0] === 'who-owes', 'the starred report lists first');
check((await page.getAttribute('[data-group="money"] [data-star="who-owes"]', 'aria-pressed')) === 'true', 'and its star shows as pressed');
await shot(page, 'library-desktop');
await phoneCheck(page, 'The library', 'library-390');
await page.goto(`${BASE}/admin/reports`);
check((await page.locator('[data-starred] a', { hasText: 'Who owes, and for how long?' }).count()) === 1, 'the dashboard lists it under the tiles');

// ── 3. A report: sort, CSV and PDF after a fresh sign-in ──
await page.goto(`${BASE}/admin/reports/children`);
check((await text(page, 'h1')) === 'Which children are in a class this season?', 'a report’s title is its question');
const rows = await page.locator('[data-report-table] tbody tr').count();
check(rows > 0, `Children this season lists ${rows} children`);
await page.click('[data-report-table] th a[data-sort="2"]');
await page.click('[data-report-table] th a[data-sort="2"]');
const counts = await page.$$eval('[data-report-table] tbody td[data-label="Classes"]', (tds) => tds.map((td) => Number(td.textContent.trim())));
check(counts.every((c, i) => i === 0 || counts[i - 1] >= c) && page.url().includes('dir=desc'), `sorting by Classes, most first (${counts.slice(0, 5).join(', ')}…)`);
await shot(page, 'report-children-desktop');
await phoneCheck(page, 'A report (children)', 'report-children-390');

const aged = await page.request.post(`${BASE}/dev/age-session`, { form: { minutes: '20' }, headers: { origin: BASE } });
check(aged.status() === 204, 'test-only: the session is aged by 20 minutes');
await page.goto(`${BASE}/admin/reports/children`);
await Promise.all([page.waitForURL(/\/admin\/confirm\?next=%2Fadmin%2Freports%2Fchildren\.csv/), page.click('[data-download="csv"]')]);
check(true, 'the report’s CSV asks her to sign in again first');
const waitDownload = page.waitForEvent('download', { timeout: 150_000 });
await signIn(page, HANNAH, { waitForNav: false });
const csv = readFileSync(await (await waitDownload).path(), 'utf8');
const csvRows = csv.split('\r\n').slice(1).filter(Boolean);
check(csv.startsWith('﻿Child,Family,Classes,Class names\r\n') && csvRows.length === rows, `the CSV has the report’s columns and the same ${rows} rows`);
if (SHOTS) writeFileSync(`${SHOTS}/children.csv`, csv);
const get = async (path) => {
  const [d] = await Promise.all([page.waitForEvent('download'), page.goto(BASE + path).catch(() => null)]);
  return readFileSync(await d.path());
};
const pdf = await get('/admin/reports/who-owes.pdf');
check(pdf.subarray(0, 4).toString() === '%PDF', `Who owes PDF downloads (${Math.round(pdf.length / 1024)} KB)`);
if (SHOTS) writeFileSync(`${SHOTS}/who-owes.pdf`, pdf);

await page.goto(`${BASE}/admin/reports/classes`);
check((await page.locator('[data-report-filters] select[name="season"]').count()) === 1, 'Fill rate has a season filter');
await shot(page, 'report-classes-desktop');

// ── 4. The allergy and medical list asks for a fresh sign-in ──
await page.request.post(`${BASE}/dev/age-session`, { form: { minutes: '20' }, headers: { origin: BASE } });
await page.goto(`${BASE}/admin/reports/allergies`);
check(/\/admin\/confirm\?next=%2Fadmin%2Freports%2Fallergies/.test(page.url()), 'the allergy and medical list asks her to sign in again first');
await signIn(page, HANNAH);
await page.waitForURL(/\/admin\/reports\/allergies/);
check((await text(page, '[data-report-empty]')).includes('Pick a class'), 'then asks for a class');
const firstClass = await page.$eval('[data-filter-class] option:nth-child(2)', (o) => o.value);
await page.selectOption('[data-filter-class]', firstClass);
await Promise.all([page.waitForURL(/class=/), page.click('[data-report-filters] button[type="submit"]')]);
check((await page.locator('[data-report-table], [data-report-empty]').count()) === 1, `and shows that class’s list (${await text(page, '[data-total-value]')})`);

// Unstar, so a re-run starts clean.
await page.goto(`${BASE}/admin/reports/library`);
await Promise.all([page.waitForURL(/\/admin\/reports\/library$/), page.click('[data-group="starred"] [data-star="who-owes"]')]);
check((await page.locator('[data-group="starred"]').count()) === 0, 'unstarring takes it off the Starred list');

// ── 5. A teacher gets the Staff only panel ──
const tp = await newPage({ width: 390, height: 844 });
await tp.goto(`${BASE}/admin/teach`);
await signIn(tp, TEACHER);
const res = await tp.goto(`${BASE}/admin/reports`);
check(res.status() === 404 && (await tp.locator('[data-staff-only]').count()) === 1, 'a teacher at Reports gets the Staff only panel');
const lib = await tp.goto(`${BASE}/admin/reports/who-owes`);
check(lib.status() === 404, 'and at a report');

check(errors.length === 0, `no script errors${errors.length ? `: ${errors.join('; ')}` : ''}`);
await browser.close();
console.log('All reports checks passed.');
