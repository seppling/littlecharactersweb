#!/usr/bin/env node
/**
 * End-to-end: the menus, the class finder and the accessibility fixes from the
 * October customer-journey audit.
 *
 * - Give, Parents' Night Out, Parties and Parking are in both menus.
 * - The desktop bar stays on one row from 1001 to 1280 px.
 * - Phones: "Sign in" / "Hi, Sam" beside Menu, no near-duplicate "Classes",
 *   Escape closes the menu and returns focus, tabbing out closes it.
 * - The finder sorts by fit once an age is chosen, and on a phone the results
 *   start on the first screen.
 * - Headings, the footer logo's name and the age-guide chip contrast.
 *
 * Signs in a new family of its own, so it can run before or after the other
 * browser tests on the same server:
 *
 *   npm run build && tests/e2e/serve.sh      # fresh local database + sample import
 *   node tests/e2e/navigation.mjs [baseUrl] [screenshotDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const SHOTS = process.argv[3];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const step = (msg) => console.log(`✓ ${msg}`);
function check(ok, msg) {
  if (!ok) throw new Error(`✗ ${msg}`);
  step(msg);
}
const shot = async (name, fullPage = false) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });
const focused = () => page.evaluate(() => {
  const el = document.activeElement;
  return { tag: el?.tagName, text: el?.textContent?.trim().replace(/\s+/g, ' ') ?? '', inPanel: !!el?.closest('.mobile-nav__panel'), href: el?.getAttribute('href') };
});
const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

// ── 1. Desktop: the new links, and the bar on one row ──
await page.goto(`${BASE}/`);
const desktopLinks = await page.$$eval('.site-header a, .site-header button', (els) => els.filter((e) => !e.closest('.mobile-nav, .mobile-account')).map((e) => e.getAttribute('href') ?? e.textContent.trim()));
for (const href of ['/give', '/programs/parents-night-out', '/programs/parties', '/contact#parking']) {
  check(desktopLinks.includes(href), `desktop header links to ${href}`);
}

for (const width of [1001, 1024, 1100, 1180, 1260, 1261, 1280, 1440]) {
  await page.setViewportSize({ width, height: 800 });
  const fit = await page.evaluate(() => {
    const box = (s) => document.querySelector(s).getBoundingClientRect();
    // One row: every item's middle is within a few pixels of the others'.
    const mids = [...document.querySelectorAll('.site-nav > ul > li, .site-header__actions > a')].map((e) => {
      const r = e.getBoundingClientRect();
      return r.top + r.height / 2;
    });
    return {
      height: box('.site-header__inner').height,
      slack: box('.site-nav').left - box('.logo').right,
      rows: Math.max(...mids) - Math.min(...mids) < 4 ? 1 : 2,
      over: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  if (width === 1001) await shot('header-desktop-1001');
  check(fit.height <= 76 && fit.rows === 1 && fit.over <= 0 && fit.slack >= 0, `desktop bar fits on one row at ${width}px (spare ${Math.round(fit.slack)}px, over ${fit.over}px)`);
}
await page.setViewportSize({ width: 1280, height: 900 });
await shot('header-desktop-1280');

// Keyboard: Tab to Shows & Events, Enter opens it, Tab goes in, Escape closes and returns.
const showsButton = page.locator('.site-nav__toggle', { hasText: 'Shows & Events' });
await showsButton.focus();
await page.keyboard.press('Enter');
check((await showsButton.getAttribute('aria-expanded')) === 'true', 'Enter opens Shows & Events');
await shot('header-desktop-shows-open');
await page.keyboard.press('Tab');
check((await focused()).text === 'Shows & events', 'Tab moves into the dropdown');
await page.keyboard.press('Tab');
check((await focused()).text === 'Parents’ Night Out', 'Parents’ Night Out is next');
await page.keyboard.press('Escape');
check((await showsButton.getAttribute('aria-expanded')) === 'false' && (await focused()).text === 'Shows & Events', 'Escape closes it and focus returns to the button');

const aboutButton = page.locator('.site-nav__toggle', { hasText: 'About' });
await aboutButton.focus();
await page.keyboard.press('Enter');
for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
check((await focused()).text === 'Parking & drop-off', 'About ends with Parking & drop-off');
await shot('header-desktop-about-open');
await page.keyboard.press('Tab');
check((await aboutButton.getAttribute('aria-expanded')) === 'false', 'tabbing past the last link closes About');
await aboutButton.focus();
await page.keyboard.press('Enter');
await page.locator('#nav-about a[href="/contact#parking"]').focus();
await Promise.all([page.waitForURL('**/contact#parking'), page.keyboard.press('Enter')]);
check(await page.locator('#parking').isVisible(), 'Enter on Parking & drop-off opens the parking section');

await page.goto(`${BASE}/`);
await page.locator('.site-header__give').focus();
await Promise.all([page.waitForURL('**/give'), page.keyboard.press('Enter')]);
check((await page.locator('.site-header__give').getAttribute('aria-current')) === 'page', 'Give opens /give and is marked as the current page');

await page.goto(`${BASE}/programs/parties`);
check(
  (await page.locator('.site-nav__toggle', { hasText: 'Shows & Events' }).getAttribute('aria-current')) === 'true' &&
    (await page.locator('.site-nav a[href="/programs?kind=class"]').getAttribute('aria-current')) === null,
  'on /programs/parties, Shows & Events is marked, not Classes',
);

// ── 2. Phone: the header and the menu ──
await page.setViewportSize({ width: 390, height: 664 });
await page.goto(`${BASE}/`);
check((await sideways()) <= 0, 'home page: no sideways scrolling at 390px');
const signIn = page.locator('.mobile-account .account-link');
check((await signIn.isVisible()) && (await signIn.textContent()).trim() === 'Sign in', 'phone header shows “Sign in” beside Menu');
const box = await signIn.boundingBox();
const menuBox = await page.locator('.mobile-nav summary').boundingBox();
const headerBox = await page.locator('.site-header').boundingBox();
check(
  box.y >= headerBox.y && box.y + box.height <= headerBox.y + headerBox.height && menuBox.x + menuBox.width <= 390 - 15 && box.x + box.width <= menuBox.x,
  'Sign in and Menu both fit in the header, side by side',
);
await shot('home-phone-390');

const phoneLinks = await page.$$eval('.mobile-nav__panel a', (els) => els.map((e) => e.getAttribute('href')));
check(!phoneLinks.includes('/programs?kind=class') && phoneLinks[0] === '/programs', 'phone menu opens with Find a class, without the near-identical Classes');
for (const href of ['/give', '/programs/parents-night-out', '/programs/parties', '/contact#parking']) {
  check(phoneLinks.includes(href), `phone menu links to ${href}`);
}

await page.locator('.mobile-account .account-link').focus();
await page.keyboard.press('Tab');
check((await focused()).tag === 'SUMMARY', 'Tab goes from Sign in to Menu');
await page.keyboard.press('Enter');
check(await page.locator('.mobile-nav').evaluate((d) => d.open), 'Enter opens the phone menu');
await shot('menu-phone-open');
await page.keyboard.press('Tab');
check((await focused()).text === 'Find a class', 'Tab moves into the menu');
await page.keyboard.press('Escape');
check(!(await page.locator('.mobile-nav').evaluate((d) => d.open)) && (await focused()).tag === 'SUMMARY', 'Escape closes the phone menu and focus returns to Menu');

await page.keyboard.press('Enter');
let steps = 0;
while ((await page.locator('.mobile-nav').evaluate((d) => d.open)) && steps < 40) {
  await page.keyboard.press('Tab');
  steps++;
}
const after = await focused();
check(steps > 5 && steps < 40 && !after.inPanel, `tabbing past the last link closes the phone menu (after ${steps} tabs, focus on “${after.text.slice(0, 30)}”)`);
const hiddenFocus = await page.evaluate(() => {
  const el = document.activeElement;
  const r = el.getBoundingClientRect();
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return r.height > 0 && r.top < window.innerHeight && r.bottom > 0 ? !(el.contains(top) || top?.contains(el)) : false;
});
check(!hiddenFocus, 'focus isn’t left on a link hidden behind the panel');

await page.locator('.mobile-nav summary').click();
await page.mouse.click(5, 400); // the panel spans 92% of the width, so tap the margin
check(!(await page.locator('.mobile-nav').evaluate((d) => d.open)), 'tapping outside closes the phone menu');

// Desktop width at 1001: the phone bits stay hidden.
await page.setViewportSize({ width: 1001, height: 800 });
check(!(await page.locator('.mobile-account').isVisible()) && !(await page.locator('.mobile-nav').isVisible()), 'the phone header is hidden on desktop');

// ── 3. The class finder ──
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${BASE}/programs?age=14-17`);
const order1417 = await page.$$eval('[data-program]:not([hidden]) h3', (els) => els.map((e) => e.textContent.trim()));
check(order1417[0] === 'Geode: Acting Studio', `14–17 starts with Acting Studio (${order1417.slice(0, 4).join(', ')}, …)`);
check(order1417.at(-1) === 'LC Homeschool Class', '14–17 ends with the daytime homeschool class');
check(!(await page.locator('.filters__toggle').isVisible()), 'desktop shows every filter (no Filters button)');
await shot('programs-14-17-desktop');

await page.locator('label.chip', { hasText: '4–6' }).click();
const order46 = await page.$$eval('[data-program]:not([hidden]) h3', (els) => els.map((e) => e.textContent.trim()));
check(order46[0] === 'Stories and Songs' && order46.slice(-2).includes('Athens Academy Enrichment'), `choosing 4–6 re-sorts: Stories and Songs first, Athens Academy last (${order46.join(', ')})`);
check(new URL(page.url()).searchParams.get('age') === '4-6', 'the address follows the chosen age');
await page.locator('label.chip', { hasText: 'Any age' }).click();
const orderAny = await page.$$eval('[data-program] h3', (els) => els.map((e) => e.textContent.trim()));
check(orderAny[0] === 'Stories and Songs' && orderAny[1] === 'Athens Academy Enrichment', '“Any age” returns to the usual order');

const headings = await page.$$eval('main h1, main h2, main h3', (els) => els.filter((e) => e.offsetParent || e.classList.contains('sr-only')).map((e) => e.tagName));
check(headings[0] === 'H1' && headings[1] === 'H2' && headings.indexOf('H3') > headings.indexOf('H2'), '/programs headings go h1 → h2 → h3');

await page.setViewportSize({ width: 390, height: 664 });
for (const age of ['14-17', '4-6']) {
  await page.goto(`${BASE}/programs?age=${age}`);
  const firstScreen = await page.evaluate(() => {
    const first = [...document.querySelectorAll('[data-program]')].find((r) => !r.hidden);
    return {
      count: document.getElementById('result-count').getBoundingClientRect().bottom,
      card: first.getBoundingClientRect().top,
      title: first.querySelector('h3').textContent.trim(),
    };
  });
  check(firstScreen.count < 664 && firstScreen.card < 664 - 60, `${age} on a phone: the count and the first card (${firstScreen.title}) start on the first screen (card at ${Math.round(firstScreen.card)}px)`);
  check((await sideways()) <= 0, `${age} on a phone: no sideways scrolling`);
  await shot(`programs-${age}-phone-390`);
}
check(await page.locator('.prow__only', { hasText: 'Athens Academy students only' }).isVisible(), 'Athens Academy is labelled “Athens Academy students only”');
const toggle = page.locator('.filters__toggle');
check((await toggle.isVisible()) && !(await page.locator('#filters-extra').isVisible()), 'phone: Type and Focus wait behind Filters');
await toggle.focus();
await page.keyboard.press('Enter');
check((await toggle.getAttribute('aria-expanded')) === 'true' && (await page.locator('#filters-extra').isVisible()), 'Filters opens them');
await page.locator('#filters-extra label.chip', { hasText: 'Camps' }).click();
check((await toggle.textContent()).includes('(1)'), 'Filters counts the active ones');
await page.goto(`${BASE}/programs`);
check(await page.locator('#filters-extra').isVisible(), 'phone with no age chosen: every filter shows, as before');

// ── 4. Accessibility fixes ──
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(`${BASE}/`);
const footerLogo = await page.locator('.site-footer .logo').evaluate((a) => ({ label: a.getAttribute('aria-label'), text: a.textContent.replace(/\s+/g, ' ').trim() }));
check(!footerLogo.label && /^Little Characters Theater Troupe ?, home$/.test(footerLogo.text), `footer logo's name is its visible words: “${footerLogo.text}”`);

const contrast = await page.evaluate(() => {
  const rgb = (c) => c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
  const lum = ([r, g, b]) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  return [...document.querySelectorAll('.riser__age')].map((el) => {
    const fg = lum(rgb(getComputedStyle(el).color));
    const bg = lum(rgb(getComputedStyle(el.closest('.riser__block')).backgroundColor));
    return { text: el.textContent.trim(), ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05) };
  });
});
for (const c of contrast) check(c.ratio >= 4.5, `age guide “${c.text}” contrast ${c.ratio.toFixed(2)}:1`);

await page.goto(`${BASE}/account`);
check((await page.locator('main h1').count()) === 1 && (await page.locator('main h1').textContent()).trim() === 'Family login', '/account (signed out) has an h1');
await shot('account-signed-out');
await page.goto(`${BASE}/enroll/intro-f26-tue`);
check((await page.locator('main h1').count()) === 1, '/enroll (signed out) has an h1');

// Sign in as a new family: the phone header greets them, and the account page has its h1.
const email = `nav-check-${Date.now()}@example.com`;
await page.goto(`${BASE}/account`);
await page.fill('#signin-email', email);
await page.click('[data-step="email"] button[type="submit"]');
await page.waitForSelector('#signin-code', { state: 'visible' });
const mail = await ctx.newPage();
let code;
for (let i = 0; i < 20 && !code; i++) {
  await mail.goto(`${BASE}/dev/mailbox`);
  const text = await mail.locator('li').filter({ hasText: `to ${email}` }).first().textContent().catch(() => '');
  code = text?.match(/(\d{6}) is your Little Characters sign-in code/)?.[1];
  if (!code) await new Promise((r) => setTimeout(r, 250));
}
await mail.close();
await Promise.all([page.waitForLoadState('load'), page.fill('#signin-code', code)]);
await page.waitForSelector('#p-name');
check((await page.locator('main h1').count()) === 1, '/account (signed in, new family) has an h1');
await page.fill('#p-name', 'Sam Rivera');
await page.fill('#p-phone', '706-555-0199');
await Promise.all([page.waitForLoadState('load'), page.click('button[type="submit"]')]);
await page.waitForSelector('h1:has-text("Hi, Sam!")');
check((await page.locator('main h1').count()) === 1, '/account (signed in) has an h1');

await page.setViewportSize({ width: 390, height: 664 });
await page.goto(`${BASE}/`);
await page.waitForFunction(() => document.querySelector('.mobile-account [data-account-label]')?.textContent === 'Hi, Sam');
check((await sideways()) <= 0, 'phone header greets “Hi, Sam” beside Menu, with no sideways scrolling');
await shot('header-phone-signed-in');
await page.goto(`${BASE}/enroll/intro-f26-tue`);
check((await page.locator('main h1').count()) === 1, '/enroll (signed in) has an h1');

await browser.close();
console.log('\nNavigation, finder and accessibility checks passed.');
