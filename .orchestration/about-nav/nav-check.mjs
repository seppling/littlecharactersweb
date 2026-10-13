// Menu, keyboard, fit and screenshot checks for the about-nav unit.
// Usage (server running): node .orchestration/about-nav/nav-check.mjs http://127.0.0.1:4321 .orchestration/about-nav/shots
import { chromium } from 'playwright';
const [BASE, OUT] = process.argv.slice(2);
const results = [];
const check = (ok, what) => { results.push(`${ok ? 'PASS' : 'FAIL'} ${what}`); if (!ok) process.exitCode = 1; };
const browser = await chromium.launch();

async function noSideScroll(page, label) {
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  check(w[0] <= w[1], `${label}: no sideways scroll (${w[0]} <= ${w[1]})`);
}

// Desktop
for (const width of [1280, 1100, 1024, 1001]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`${BASE}/about/team`);
  // Menu fits: nav, actions, logo on one row without overlap
  const fit = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    const nav = r('.site-nav'), act = r('.site-header__actions'), logo = r('.site-header__inner > :first-child'), inner = r('.site-header__inner');
    const items = [...document.querySelectorAll('.site-nav > ul > li')].map((li) => li.getBoundingClientRect());
    const tall = [...document.querySelectorAll('.site-nav > ul > li > *')].some((el) => el.getBoundingClientRect().height > 50);
    const oneRow = items.every((i) => Math.abs(i.top - items[0].top) < 2);
    return { oneRow: oneRow && !tall, gapLogo: nav.left - logo.right, gapAct: act.left - nav.right, overflow: act.right - inner.right, h: inner.height };
  });
  check(fit.oneRow && fit.gapLogo >= 8 && fit.gapAct >= 8 && fit.overflow <= 1, `${width}px: menu fits on one row (${JSON.stringify(fit)})`);
  await noSideScroll(page, `${width}px /about/team`);
  check((await page.getAttribute('.site-nav__toggle', 'aria-current')) === 'true', `${width}px: About marked current on /about/team`);
  if (width === 1280) {
    await page.click('.site-nav__toggle');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/header-dropdown-desktop.png`, clip: { x: 0, y: 0, width, height: 360 } });
    // Click elsewhere closes
    await page.mouse.click(20, 600);
    check((await page.getAttribute('.site-nav__toggle', 'aria-expanded')) === 'false', 'click outside closes the dropdown');
    // Keyboard
    await page.goto(`${BASE}/`);
    await page.focus('.site-nav a[href="/events"]');
    await page.keyboard.press('Tab');
    check(await page.evaluate(() => document.activeElement?.classList.contains('site-nav__toggle')), 'Tab reaches the About button');
    check((await page.isHidden('#nav-about')), 'dropdown starts closed');
    await page.keyboard.press('Enter');
    check((await page.getAttribute('.site-nav__toggle', 'aria-expanded')) === 'true' && (await page.isVisible('#nav-about')), 'Enter opens it (aria-expanded=true)');
    check((await page.getAttribute('.site-nav__toggle', 'aria-controls')) === 'nav-about', 'aria-controls points at the list');
    const order = [];
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => document.activeElement?.getAttribute('href'))); }
    check(order.join(' ') === '/about /about/team /about/schools /faq', `Tab walks the links in order (${order.join(' ')})`);
    await page.keyboard.press('Escape');
    check((await page.getAttribute('.site-nav__toggle', 'aria-expanded')) === 'false' && (await page.isHidden('#nav-about')), 'Escape closes it');
    check(await page.evaluate(() => document.activeElement?.classList.contains('site-nav__toggle')), 'Escape returns focus to the button');
    await page.keyboard.press('Space');
    check((await page.getAttribute('.site-nav__toggle', 'aria-expanded')) === 'true', 'Space opens it too');
    await page.keyboard.press('Enter');
    check((await page.getAttribute('.site-nav__toggle', 'aria-expanded')) === 'false', 'Enter on the button closes it');
    await page.keyboard.press('Enter');
    for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
    const after = await page.evaluate(() => document.activeElement?.getAttribute('href'));
    check(after === '/geode' && (await page.getAttribute('.site-nav__toggle', 'aria-expanded')) === 'false', `tabbing past the last link closes it (focus on ${after})`);
    await page.keyboard.press('Tab');
    check((await page.evaluate(() => document.activeElement?.getAttribute('href'))) === '/contact', 'Contact is in the main menu, after Geode');
    // Enter on a link goes there
    await page.focus('.site-nav__toggle');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    await Promise.all([page.waitForURL('**/about/team'), page.keyboard.press('Enter')]);
    check(true, 'Enter on “Team” opens /about/team');
    check((await page.getAttribute('#nav-about a[href="/about/team"]', 'aria-current')) === 'page', 'Team link marked aria-current=page');
    // Contact current
    await page.goto(`${BASE}/contact`);
    check((await page.getAttribute('.site-nav a[href="/contact"]', 'aria-current')) === 'page', 'Contact marked current on /contact');
    check((await page.getAttribute('.site-nav__toggle', 'aria-current')) === null, 'About not marked on /contact');
    await page.goto(`${BASE}/faq`);
    check((await page.getAttribute('.site-nav__toggle', 'aria-current')) === 'true', 'About marked on /faq (FAQ is in the About menu)');
    // Old anchors
    await page.goto(`${BASE}/about#team`);
    await page.waitForURL('**/about/team');
    check(true, '/about#team goes to /about/team');
    await page.goto(`${BASE}/about#schools`);
    await page.waitForURL('**/about/schools');
    check(true, '/about#schools goes to /about/schools');
    // Full pages
    for (const [path, name] of [['/about', 'about'], ['/about/team', 'team'], ['/about/schools', 'schools']]) {
      await page.goto(`${BASE}${path}`);
      await noSideScroll(page, `1280px ${path}`);
      await page.screenshot({ path: `${OUT}/${name}-desktop.jpg`, fullPage: true });
    }
    await page.goto(`${BASE}/about`);
    const cards = await page.$$eval('.more-card h2 a', (as) => as.map((a) => a.getAttribute('href')));
    check(cards.join(' ') === '/about/team /about/schools', `/about links to both new pages (${cards.join(' ')})`);
    await page.locator('.site-footer').screenshot({ path: `${OUT}/footer-desktop.png` });
    const email = await page.$eval('.site-footer__email', (a) => a.getClientRects().length);
    check(email === 1, `footer email on one line at 1280px (${email} line boxes)`);
    // Touch-like: a tap opens it (no hover needed)
  } else if (width === 1024) {
    await page.goto(`${BASE}/about`);
    await page.locator('.site-footer').screenshot({ path: `${OUT}/footer-1024.png` });
    await page.click('.site-nav__toggle');
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/header-dropdown-1024.png`, clip: { x: 0, y: 0, width, height: 360 } });
  }
  await page.close();
}

for (const width of [999, 961]) {
  const p = await browser.newPage({ viewport: { width, height: 800 } });
  await p.goto(`${BASE}/about/team`);
  check(await p.isVisible('.mobile-nav summary'), `${width}px: phone menu button shown`);
  await noSideScroll(p, `${width}px /about/team`);
  await p.close();
}
// Phone, with touch
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const phone = await ctx.newPage();
await phone.goto(`${BASE}/about/team`);
await phone.tap('.mobile-nav summary');
const labels = await phone.$$eval('.mobile-nav__panel a', (as) => as.map((a) => a.textContent.trim().replace(/\s+/g, ' ')));
check(['Our story', 'Team', 'Schools & partners', 'FAQ', 'Contact'].every((l) => labels.includes(l)), `phone menu lists the About pages and Contact (${labels.join(' | ')})`);
const panel = await phone.$eval('.mobile-nav__panel', (p) => { const r = p.getBoundingClientRect(); return { bottom: r.bottom, scroll: p.scrollHeight > p.clientHeight }; });
check(panel.bottom <= 844, `phone menu fits the screen (bottom ${Math.round(panel.bottom)}px, scrolls inside: ${panel.scroll})`);
await phone.screenshot({ path: `${OUT}/phone-menu-open.png` });
for (const [path, name] of [['/about', 'about'], ['/about/team', 'team'], ['/about/schools', 'schools']]) {
  await phone.goto(`${BASE}${path}`);
  await noSideScroll(phone, `390px ${path}`);
  await phone.screenshot({ path: `${OUT}/${name}-390.jpg`, fullPage: true });
}
await phone.locator('.site-footer').screenshot({ path: `${OUT}/footer-390.png` });
// Tap test of the desktop dropdown on a touch tablet width
const tablet = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
const tp = await tablet.newPage();
await tp.goto(`${BASE}/`);
await tp.tap('.site-nav__toggle');
check(await tp.isVisible('#nav-about'), 'a tap opens the dropdown on a touch screen');
await tp.tap('h1');
check(await tp.isHidden('#nav-about'), 'a tap elsewhere closes it');
await browser.close();
console.log(results.join('\n'));
