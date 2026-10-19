#!/usr/bin/env node
/**
 * End-to-end: the staff Payments pages (src/server/payments-admin.ts).
 *
 * - A failed charge shows under Needs attention, linking to the family;
 *   "Send a pay link" puts the "pay now" email in the dev mailbox and the item
 *   says "Pay link sent".
 * - ?show=failed and ?show=upcoming show one section; the upcoming totals add up.
 * - Payments received and its month picker; Paid by cash/check lands there.
 * - All three downloads, after a fresh sign-in.
 * - A family's order page: its title, the family link, one back link.
 * - At 390 px: nothing wider than the screen, no button broken mid-word, 44 px
 *   tap targets.
 *
 * Uses the families the journeys created. Run after the other staff browser
 * tests, on the same server:
 *
 *   npm run build && tests/e2e/serve.sh
 *   node tests/e2e/staff-payments.mjs [baseUrl] [screenshotDir]
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
const tooWide = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && el.getClientRects().length)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`),
  );
/** Buttons whose words wrap onto a second line ("Stop paym / ents"). */
const brokenButtons = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('main .btn, .admin-page .btn')]
      .filter((el) => el.getClientRects().length)
      .filter((el) => {
        // The words on screen: text not inside screen-reader-only spans.
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
const smallTargets = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.admin-page a, .admin-page button, .admin-page input:not([type="hidden"], [type="checkbox"], [type="radio"]), .admin-page summary')]
      .filter((el) => el.getClientRects().length && !el.closest('.sr-only'))
      .filter((el) => el.getBoundingClientRect().height < 44)
      .map((el) => `${el.tagName.toLowerCase()} “${(el.textContent || el.getAttribute('name') || '').trim().slice(0, 30)}” ${Math.round(el.getBoundingClientRect().height)}px`),
  );
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
  if (waitForNav) await Promise.all([p.waitForEvent('load'), p.fill('#signin-code', code)]);
  else await p.fill('#signin-code', code);
}

/** At 390 px: nothing sticks out, no button wraps, every target is 44 px. Takes the phone screenshot. */
async function phoneCheck(what, name) {
  await phone();
  const extra = await sideways();
  check(extra <= 0, `${what}: no sideways scrolling at 390 px${extra > 0 ? ` (${(await tooWide()).join(', ')})` : ''}`);
  const broken = await brokenButtons();
  check(broken.length === 0, `${what}: no button breaks onto two lines at 390 px${broken.length ? ` (${broken.join(', ')})` : ''}`);
  const small = await smallTargets();
  check(small.length === 0, `${what}: links, buttons and fields are at least 44 px tall at 390 px${small.length ? ` (${small.join('; ')})` : ''}`);
  if (name) await shot(name);
  await desktop();
}

const HANNAH = 'hannah@example.com';
const cents = (s) => Math.round(Number(s.replace(/[^0-9.]/g, '')) * 100);
const payLinkEmails = async (installmentId) => {
  const mail = await ctx.newPage();
  await mail.goto(`${BASE}/dev/mailbox`);
  const n = await mail.locator('li').filter({ hasText: 'We couldn’t charge your card' }).filter({ hasText: `/account/pay/${installmentId}` }).count();
  await mail.close();
  return n;
};

// ── 1. Sign in; the page and its sections ──
await page.goto(`${BASE}/admin/payments`);
await signIn(page, HANNAH);
await page.waitForSelector('h1:has-text("Payments")');
check((await page.title()).startsWith('Payments'), 'the title is “Payments”, like the tab');
check((await page.locator('.actions').count()) === 0, 'no .actions class (the website editor’s sticky save bar) on the page');
for (const s of ['[data-attention]', '[data-upcoming]', '[data-families]', '[data-received]']) check((await page.locator(s).count()) === 1, `the page has ${s}`);

// ── 2. A failed charge: the next scheduled month of the first family on autopay ──
const orderHref = await page.locator('[data-families] a[href^="/admin/payments/"]').first().getAttribute('href');
const orderId = orderHref.split('/').pop();
const familyName = (await page.locator('[data-families] tbody tr').first().locator('td').first().textContent()).trim();
const failed = await page.request.post(`${BASE}/dev/fail-charge`, { form: { order: orderId }, headers: { origin: BASE } });
check(failed.status() === 200, 'test-only: the family’s next charge is declined');
const { installmentId } = await failed.json();
await page.reload();
const item = page.locator(`[data-attention-item="${installmentId}"]`);
check((await item.count()) === 1, `the failed charge shows under Needs attention (${familyName})`);
const itemText = await item.textContent();
check(itemText.includes(familyName) && /Card declined/.test(itemText) && /Trying again/.test(itemText), 'it shows the family, the reason and the next try');
check(/^\/admin\/families\//.test(await item.locator('.attention-item__title a').getAttribute('href')), 'the family’s name links to the family’s page');
check(/\$\d/.test(await item.locator('.attention-item__title').textContent()), 'it shows the amount');
for (const b of ['Send a pay link', 'Paid by cash/check', 'Stop payments']) check((await item.locator(`button:has-text("${b}")`).count()) === 1, `it has “${b}”`);
check((await payLinkEmails(installmentId)) === 1, 'the decline emailed the family a “pay now” link, as before');
await shot('payments-desktop');

// ── 3. Send a pay link ──
await Promise.all([page.waitForURL(/done=link/), item.locator('button:has-text("Send a pay link")').click()]);
check(/Pay link sent to 1 parent/.test(await page.textContent('[data-notice]')), 'the page says the pay link went to the parent');
check((await payLinkEmails(installmentId)) === 2, 'the same “pay now” email is in /dev/mailbox again');
const sentLine = await page.locator(`[data-attention-item="${installmentId}"] [data-pay-link-sent]`).textContent();
check(/^Pay link sent [A-Z][a-z]{2} \d{1,2}$/.test(sentLine.trim()), `the item says “${sentLine.trim()}”`);
await page.reload();
check((await payLinkEmails(installmentId)) === 2, 'reloading the page doesn’t send it again');

// ── 4. One section at a time ──
await page.goto(`${BASE}/admin/payments?show=failed`);
check((await page.locator('[data-attention]').count()) === 1 && (await page.locator('[data-upcoming], [data-families], [data-received]').count()) === 0, '?show=failed shows only Needs attention');
check((await page.getAttribute('[data-views] a[aria-pressed="true"]', 'href')) === '/admin/payments?show=failed', 'the “Needs attention” chip is lit');
await shot('payments-failed-desktop');
await phoneCheck('?show=failed', 'payments-failed-390');
await page.goto(`${BASE}/admin/payments?show=upcoming`);
check((await page.locator('[data-upcoming]').count()) === 1 && (await page.locator('[data-attention], [data-families], [data-received]').count()) === 0, '?show=upcoming shows only Upcoming autopay');
const days = await page.$$eval('[data-upcoming-day]', (ds) => ds.map((d) => ({ date: d.dataset.upcomingDay, total: d.querySelector('[data-day-total]').textContent, rows: [...d.querySelectorAll('tbody td.num')].map((td) => td.textContent) })));
check(days.length >= 1, `upcoming autopay is grouped by date (${days.map((d) => d.date).join(', ')})`);
check(days.every((d) => d.rows.reduce((a, r) => a + cents(r), 0) === cents(d.total)), `each date’s total adds up (${days.map((d) => `${d.date}: ${d.total}`).join(', ')})`);
check(days.every((d, i) => i === 0 || d.date > days[i - 1].date) && days.at(-1).date <= new Date(Date.parse(`${days[0].date}T12:00:00Z`) + 62 * 86_400_000).toISOString().slice(0, 10), 'dates in order, through two months after the next charge day');
await shot('payments-upcoming-desktop');

// ── 5. Payments received and the month picker ──
await page.goto(`${BASE}/admin/payments`);
const thisMonth = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).slice(0, 7);
check((await page.inputValue('#pay-month')) === thisMonth, `Payments received defaults to this month (${thisMonth})`);
const rows = await page.locator('[data-received-list] tbody tr').count();
check(rows >= 1, `this month lists what came in (${rows} payments)`);
const amounts = await page.$$eval('[data-received-list] tbody td.num', (tds) => tds.map((t) => t.textContent));
const sum = amounts.reduce((a, r) => a + cents(r), 0);
check((await page.textContent('[data-received-total]')).includes(`$${(sum / 100).toFixed(sum % 100 ? 2 : 0)}`), `the month’s total adds up ($${(sum / 100).toFixed(2)})`);
check((await page.locator('[data-received-list] td[data-label="How paid"]', { hasText: 'Card' }).count()) >= 1, 'card payments say “Card”');
await Promise.all([page.waitForURL(/month=\d{4}-\d{2}#received$/), page.click('[data-month-prev]')]);
const prev = new URL(page.url()).searchParams.get('month');
check(prev < thisMonth && (await page.inputValue('#pay-month')) === prev, `the previous-month link shows ${prev}`);
await page.fill('#pay-month', thisMonth);
await Promise.all([page.waitForURL(new RegExp(`month=${thisMonth}`)), page.click('[data-month-picker] button[type="submit"]')]);
check((await page.locator('[data-received-list] tbody tr').count()) === rows, 'picking a month with the month box shows that month');
await shot('payments-received-desktop');

// ── 6. Paid by cash/check: it leaves Needs attention and is listed as received ──
await Promise.all([page.waitForURL(/done=paid/), page.locator(`[data-attention-item="${installmentId}"] button:has-text("Paid by cash/check")`).click()]);
check((await page.locator(`[data-attention-item="${installmentId}"]`).count()) === 0, 'once paid by cash or check, it leaves Needs attention');
await page.goto(`${BASE}/admin/payments?month=${thisMonth}`);
check((await page.locator('[data-received-list] td[data-label="How paid"]', { hasText: 'Cash or check, marked by Hannah' }).count()) === 1, 'and Payments received shows it: “Cash or check, marked by Hannah …”');

// Another family's charge fails, for the downloads, the order page and the screenshots.
await page.goto(`${BASE}/admin/payments`);
const order2Href = await page.locator('[data-families] a[href^="/admin/payments/"]').first().getAttribute('href');
const family2 = (await page.locator('[data-families] tbody tr').first().locator('td').first().textContent()).trim();
const second = await page.request.post(`${BASE}/dev/fail-charge`, { form: { order: order2Href.split('/').pop() }, headers: { origin: BASE } });
check(second.status() === 200, `test-only: a second family’s next charge is declined (${family2})`);
const secondId = (await second.json()).installmentId;
await page.reload();
await shot('payments-everything-desktop');
await phoneCheck('Payments', 'payments-everything-390');

// ── 7. Downloads, after a fresh sign-in ──
const aged = await page.request.post(`${BASE}/dev/age-session`, { form: { minutes: '20' }, headers: { origin: BASE } });
check(aged.status() === 204, 'test-only: the session is aged by 20 minutes');
await page.goto(`${BASE}/admin/payments`);
await Promise.all([page.waitForURL(/\/admin\/confirm\?next=%2Fadmin%2Fpayments\.csv%3Fshow%3Dfailed$/), page.click('[data-attention] [data-download="csv"]')]);
check(true, 'the Overdue List CSV asks her to sign in again first');
const waitDownload = page.waitForEvent('download', { timeout: 150_000 }); // the sign-in may wait out its rate limit first
await signIn(page, HANNAH, { waitForNav: false });
let download = await waitDownload;
const overdue = readFileSync(await download.path(), 'utf8');
check(overdue.startsWith('﻿Due,Family,Class,For,Amount ($),Late fee ($),Days overdue,What happened,Next,Pay link sent\r\n'), 'Overdue List CSV: its columns');
check(overdue.includes(family2) && overdue.includes('Card declined'), 'Overdue List CSV: the failed charge, with the family and the reason');
if (SHOTS) writeFileSync(`${SHOTS}/overdue-list.csv`, overdue);

const get = async (path) => {
  const [d] = await Promise.all([page.waitForEvent('download'), page.goto(BASE + path).catch(() => null)]);
  return readFileSync(await d.path());
};
const upcomingCsv = (await get('/admin/payments.csv?show=upcoming')).toString('utf8');
const upcomingRows = upcomingCsv.split('\r\n').slice(1).filter(Boolean);
check(upcomingCsv.startsWith('﻿Date,Family,Class,For,Amount ($)\r\n') && upcomingRows.every((r) => /^\d{4}-\d{2}-\d{2},.*,\d+\.\d{2}$/.test(r)), `Upcoming Autopay CSV (next 90 days) downloads (${upcomingRows.length} charges left after the test’s declines)`);
const receivedCsv = (await get(`/admin/payments.csv?month=${thisMonth}`)).toString('utf8');
check(receivedCsv.startsWith('﻿Date,Family,Class,For,Amount ($),How paid\r\n') && receivedCsv.includes('Cash or check, marked by Hannah'), 'Payments List CSV: the month shown, cash included');
for (const [what, path] of [
  ['Overdue List', '/admin/payments.pdf?show=failed'],
  ['Upcoming Autopay', '/admin/payments.pdf?show=upcoming'],
  ['Payments List', `/admin/payments.pdf?month=${thisMonth}`],
]) {
  const pdf = await get(path);
  check(pdf.subarray(0, 4).toString() === '%PDF', `${what} PDF downloads (${Math.round(pdf.length / 1024)} KB)`);
  if (SHOTS) writeFileSync(`${SHOTS}/${what.toLowerCase().replace(/ /g, '-')}.pdf`, pdf);
}
await page.goto(`${BASE}/admin/payments`);
const hrefs = await page.$$eval('[data-download]', (as) => as.map((a) => a.getAttribute('href')));
check(['/admin/payments.csv?show=failed', '/admin/payments.csv?show=upcoming', `/admin/payments.csv?month=${thisMonth}`].every((h) => hrefs.includes(h)), 'the page links each section to its own download');

// ── 8. A family's order page ──
await page.goto(BASE + order2Href);
const h1 = (await page.textContent('h1')).trim();
check(h1.startsWith(family2) && /: .+/.test(h1), `the order page’s title is the family and the class (“${h1}”)`);
check((await page.title()).startsWith(h1), 'the tab title matches');
check(/^\/admin\/families\//.test(await page.getAttribute('[data-family-link]', 'href')), 'it links to the family’s page');
check((await page.locator('.admin-crumbs').count()) === 0, 'no second back link in the page');
check((await page.locator('.actions').count()) === 0, 'no .actions class on the order page');
check((await page.locator('[data-add-adjustment]').count()) === 1, 'Add a discount is still there');
await shot('order-desktop');
await phone();
check((await page.getAttribute('[data-staff-back]', 'href')) === '/admin/payments', 'on a phone, the shell’s back link goes to Payments');
await desktop();
await phoneCheck('the order page', 'order-390');

// ── 9. Not for families ──
const fam = await browser.newContext();
const fp = await fam.newPage();
await fp.goto(`${BASE}/account`);
await signIn(fp, 'payments.parent@example.com');
for (const p of ['/admin/payments', '/admin/payments?show=failed', '/admin/payments.csv', '/admin/payments.pdf?show=upcoming', orderHref]) {
  const res = await fp.request.get(BASE + p, { maxRedirects: 0 });
  check(res.status() === 404, `a signed-in parent gets 404 at ${p}`);
}
const sneaky = await fp.request.post(`${BASE}/admin/payments`, { form: { action: 'pay-link', id: secondId }, headers: { origin: BASE } });
check(sneaky.status() === 404, 'a parent posting “Send a pay link” gets 404');
check((await fp.request.post(`${BASE}/dev/fail-charge`, { form: { order: orderId }, headers: { origin: BASE } })).status() === 404, 'a parent can’t use the test-only decline');
await fam.close();

check(errors.length === 0, `no page errors (${errors.join('; ')})`);
await browser.close();
console.log('\nStaff payments checks passed.');
