#!/usr/bin/env node
/**
 * End-to-end: staff search and a family's page (src/server/families.ts).
 *
 * - Search by a parent's email, a phone number written another way, and a
 *   child's first name; open the family.
 * - Care details; add, edit and delete a note; change a child's allergies and
 *   the emergency contacts, and see them on the page.
 * - The Families list, and its downloads after a fresh sign-in.
 * - At 390 px, nothing is wider than the screen.
 *
 * Uses the imported sample family (tests/e2e/fixtures). Run after the other
 * five browser tests, on the same server:
 *
 *   npm run build && tests/e2e/serve.sh
 *   node tests/e2e/staff-families.mjs [baseUrl] [screenshotDir]
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
page.on('dialog', (d) => d.accept());
const step = (msg) => console.log(`✓ ${msg}`);
function check(ok, msg) {
  if (!ok) throw new Error(`✗ ${msg}`);
  step(msg);
}
const shot = async (name, fullPage = true) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });
const sideways = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
/** Elements that stick out past the right edge of the screen, for the failure message. */
const tooWide = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('body *')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && el.getClientRects().length)
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`),
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

async function phoneCheck(what, name) {
  await phone();
  const extra = await sideways();
  check(extra <= 0, `${what}: no sideways scrolling at 390 px${extra > 0 ? ` (${(await tooWide()).join(', ')})` : ''}`);
  if (name) await shot(name);
  await desktop();
}

const HANNAH = 'hannah@example.com';
/** The top bar's box on a computer; the page's own box on a phone. */
const searchFor = async (q) => {
  const box = (await page.locator('#staff-q').isVisible()) ? '#staff-q' : '#find-q';
  await page.fill(box, q);
  await Promise.all([page.waitForURL(/\/admin\/search\?q=/), page.press(box, 'Enter')]);
};

// ── 1. The Families list ──
await page.goto(`${BASE}/admin/search`);
await signIn(page, HANNAH);
await page.waitForSelector('h1:has-text("Families")');
check((await page.title()).startsWith('Families'), 'with no search, the page is called Families');
check((await page.$eval('.staff-sections a[aria-current="page"]', (a) => a.textContent.trim())) === 'Families', 'Families is the current section');
const names = await page.$$eval('[data-families] tbody tr td:first-child', (tds) => tds.map((td) => td.textContent.trim()));
check(names.includes('Okafor family'), `the list has the imported family (${names.length} families)`);
check(JSON.stringify(names) === JSON.stringify([...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))), 'families are A to Z');
const okRow = page.locator('[data-families] tbody tr', { hasText: 'Okafor family' });
check((await okRow.locator('td[data-label="Children"]').textContent()).trim() === '2', 'the family’s row counts its 2 children');
check((await page.locator('[data-download]').count()) === 6, 'Family, Student / Class and Contact lists each have CSV and PDF');
await shot('families-list-desktop');
await phoneCheck('the Families list', 'families-list-phone');

// A family from the enrollment journeys, if they ran first: classes and payments.
const enrolled = page.locator('[data-families] tbody tr').filter({ hasNot: page.locator('td[data-label="Current classes"]', { hasText: '—' }) }).first();
if (await enrolled.count()) {
  await Promise.all([page.waitForURL(/\/admin\/families\//), enrolled.locator('a').click()]);
  const classLinks = await page.$$eval('[data-classes] a', (as) => as.map((a) => a.getAttribute('href')));
  check(classLinks.length > 0 && classLinks.every((h) => h.startsWith('/admin/classes/')), `its classes link to their class pages (${classLinks.length})`);
  const orderLinks = await page.$$eval('[data-payments] a', (as) => as.map((a) => a.getAttribute('href')));
  check(orderLinks.every((h) => h.startsWith('/admin/payments/')), `its payments link to the family’s payments (${orderLinks.length})`);
  await shot('family-enrolled-desktop');
  await phoneCheck('a family with classes and payments', 'family-enrolled-phone');
  await page.goto(`${BASE}/admin/search`);
} else console.log('· no enrolled family (the journeys didn’t run first): skipping classes and payments');

// ── 2. Search ──
await searchFor('ANA.OKAFOR@example');
check((await page.title()).startsWith('Search'), 'with words, the page is called Search');
check(await page.locator('[data-results="families"] .hit', { hasText: 'Okafor family' }).isVisible(), 'a parent’s email (any case) finds the family');
check(await page.locator('[data-results="families"] .hit', { hasText: 'ana.okafor@example.com' }).isVisible(), 'the result shows the parent who matched');

await searchFor('706.555.0101');
check(await page.locator('[data-results="families"] .hit', { hasText: 'Okafor family' }).isVisible(), 'a phone number written with dots finds the family');

await searchFor('zara');
const child = page.locator('[data-results="children"] .hit', { hasText: 'Zara Okafor' });
check(await child.isVisible(), 'a child’s first name finds the child');
check((await child.textContent()).includes('Okafor family'), 'the child is shown with their family');
check(!(await page.content()).includes('Tree nuts'), 'search results don’t show allergies');
await shot('search-results-desktop');
await phoneCheck('search results', 'search-results-phone');

// ── 3. The family's page ──
await Promise.all([page.waitForURL(/\/admin\/families\//), child.click()]);
const familyUrl = page.url();
check(!/zara|okafor/i.test(familyUrl), 'the family’s address has no names in it');
check((await page.textContent('h1')).trim() === 'Okafor family', 'the family’s page opens');
check(await page.locator('[data-badge="imported"]', { hasText: 'From Studio Director' }).isVisible(), 'imported families are tagged From Studio Director');
const parent = page.locator('[data-parents] .person').first();
check((await parent.locator('a', { hasText: 'Email' }).getAttribute('href')) === 'mailto:ana.okafor@example.com', 'the parent has an Email link');
check((await parent.locator('a', { hasText: 'Call' }).getAttribute('href')) === 'tel:+17065550101', 'and a Call link');
check((await parent.locator('a', { hasText: 'Text' }).getAttribute('href')) === 'sms:+17065550101', 'and a Text link');
const zara = page.locator('[data-child]', { hasText: 'Zara Okafor' });
check(await zara.locator('[data-badge="medical"]', { hasText: 'Allergy' }).isVisible(), 'Zara has the Allergy badge');
check(await zara.locator('.care__list--alert').isVisible(), 'on a computer her care details are open, marked red');
check((await zara.locator('.care__list .alert dd').first().textContent()).includes('Tree nuts'), 'her allergy shows: Tree nuts');
// The sample import (tests/e2e/fixtures/studio-director-families.csv) brings this family's emergency contact over from Studio Director.
check(await page.locator('[data-contacts]', { hasText: 'Femi Okafor' }).isVisible(), 'the emergency contact imported from Studio Director shows');
check(await page.locator('[data-emails]', { hasText: 'No emails sent from the site yet.' }).isVisible(), 'no emails sent yet');
await shot('family-desktop');

// Back link on a phone: to the search results she came from.
await phone();
await page.goto(`${BASE}/admin/search`);
check(await page.locator('#find-q').isVisible(), 'on a phone, the page has its own search box');
await searchFor('zara');
await Promise.all([page.waitForURL(/\/admin\/families\//), page.click('[data-results="children"] .hit')]);
check((await page.getAttribute('[data-staff-back]', 'href')) === '/admin/search?q=zara', 'from search results, the back link returns to them');
check((await page.$eval('.staff-tabs a[aria-current="page"]', (a) => a.textContent.trim())) === 'Search', 'Search is the current tab on a family’s page');
check(!(await zara.locator('.care__list').isVisible()), 'on a phone, care details are closed');
await zara.locator('.care > summary').click();
check(await zara.locator('.care__list').isVisible(), 'and open with a tap');
const callBox = await parent.locator('a', { hasText: 'Call' }).boundingBox();
check(callBox.height >= 44 && callBox.width >= 88, `Call is a big button on a phone (${Math.round(callBox.width)}×${Math.round(callBox.height)})`);
await page.goto(familyUrl);
check((await page.getAttribute('[data-staff-back]', 'href')) === '/admin/search', 'opened directly, the back link goes to Families');
await phoneCheck('a family’s page', 'family-phone');

// ── 4. Notes: add, edit, delete ──
await page.fill('#note-body', 'Zara is shy the first week; pair her with a buddy.');
await page.selectOption('#note-about', { label: 'Zara Okafor' });
await shot('note-adding-desktop', false);
await phone();
await page.locator('#note-body').scrollIntoViewIfNeeded();
await shot('note-adding-phone', false);
await desktop();
await Promise.all([page.waitForURL(/saved=note-added/), page.click('[data-note-form] button[type="submit"]')]);
check(await page.locator('.notice', { hasText: 'Note added.' }).isVisible(), 'a note is added');
const note = page.locator('[data-note]', { hasText: 'pair her with a buddy' });
check((await note.textContent()).includes('Zara') && /hannah/i.test(await note.textContent()), 'it shows who it’s about and who wrote it');
await note.locator('summary', { hasText: 'Edit' }).click();
await note.locator('textarea').fill('Zara is shy the first week; pair her with Theo’s friend Mia.');
await Promise.all([page.waitForURL(/saved=note-edited/), note.locator('[data-note-edit] button[type="submit"]').click()]);
check(await page.locator('[data-note]', { hasText: 'Theo’s friend Mia' }).isVisible(), 'the author edits the note');
check((await page.locator('[data-note]').first().textContent()).includes('(edited)'), 'it says it was edited');
await Promise.all([page.waitForURL(/saved=note-deleted/), page.locator('[data-note]', { hasText: 'Theo’s friend Mia' }).locator('button', { hasText: 'Delete' }).click()]);
check(await page.locator('.notice', { hasText: 'Note deleted.' }).isVisible(), 'and deletes it');
check(!(await page.locator('[data-note]', { hasText: 'Theo’s friend Mia' }).count()), 'the note is gone');
// A note to keep, for the notes download.
await page.fill('#note-body', 'Asked about the spring show dates.');
await Promise.all([page.waitForURL(/saved=note-added/), page.click('[data-note-form] button[type="submit"]')]);

// ── 5. Staff edits: allergies, contacts ──
await zara.locator('summary', { hasText: 'Change care details' }).click();
await zara.locator('input[name="allergies"]').fill('Tree nuts, kiwi');
await Promise.all([page.waitForURL(/saved=care/), zara.locator('[data-care-form] button[type="submit"]').click()]);
check(await page.locator('.notice', { hasText: 'Care details saved.' }).isVisible(), 'staff change a child’s allergies');
check((await zara.locator('.care__list .alert dd').first().textContent()).includes('Tree nuts, kiwi'), 'the new allergies show on the family’s page');
await page.locator('[data-contacts] summary', { hasText: 'Change contacts' }).click();
await page.fill('#ec-0-name', 'Grace Okafor');
await page.fill('#ec-0-relationship', 'Grandma');
await page.fill('#ec-0-phone', '706 555 0188');
await Promise.all([page.waitForURL(/saved=contacts/), page.click('[data-contacts-form] button[type="submit"]')]);
check(!(await page.locator('[data-no-emergency]').count()), 'after adding one, no warning');
const ec = page.locator('[data-contacts] .contacts li', { hasText: 'Grace Okafor' });
check((await ec.textContent()).includes('(706) 555-0188') && (await ec.locator('a', { hasText: 'Call' }).getAttribute('href')) === 'tel:+17065550188', 'the emergency contact shows with a Call link');
await page.locator('[data-contacts] summary', { hasText: 'Change contacts' }).click();
await page.fill('#ec-1-name', 'No Phone');
await page.fill('#ec-1-relationship', 'Neighbor');
await Promise.all([page.waitForEvent('load'), page.click('[data-contacts-form] button[type="submit"]')]);
check(await page.locator('.notice--error', { hasText: 'Emergency contacts' }).isVisible(), 'an emergency contact without a phone is refused, with a reason');
check((await page.inputValue('#ec-1-name')) === 'No Phone', 'and what she typed is kept');

// ── 6. Downloads ──
await page.goto(`${BASE}/admin/search`);
let [download] = await Promise.all([page.waitForEvent('download'), page.click('a[href="/admin/search.csv"]')]);
const csv = readFileSync(await download.path(), 'utf8');
check(csv.startsWith('﻿Family,Parents,Emails,Phones,ZIP,Heard about us,Children\r\n'), 'Family List CSV: the right columns');
check(csv.includes('Okafor family') && csv.includes('Zara Okafor'), 'and the family with its children');
check(!csv.includes('Tree nuts'), 'no allergies in the Family List');
[download] = await Promise.all([page.waitForEvent('download'), page.click('a[href="/admin/search/children.csv"]')]);
check(readFileSync(await download.path(), 'utf8').startsWith('﻿Child,Age,Family,Current classes\r\n'), 'Student / Class List CSV downloads');
[download] = await Promise.all([page.waitForEvent('download'), page.click('a[href="/admin/search/contacts.csv"]')]);
const contacts = readFileSync(await download.path(), 'utf8');
check(contacts.includes('Grace Okafor (Grandma) (706) 555-0188'), 'Student Contact List CSV has the emergency contact');
[download] = await Promise.all([page.waitForEvent('download'), page.click('a[href="/admin/search.pdf"]')]);
const pdf = readFileSync(await download.path());
check(pdf.subarray(0, 4).toString() === '%PDF', `Family List PDF downloads (${Math.round(pdf.length / 1024)} KB)`);
if (SHOTS) writeFileSync(`${SHOTS}/family-list.pdf`, pdf);

// Later, the notes download asks her to confirm it's her first.
const aged = await page.request.post(`${BASE}/dev/age-session`, { form: { minutes: '20' }, headers: { origin: BASE } });
check(aged.status() === 204, 'test-only: the session is aged by 20 minutes');
await page.goto(familyUrl);
await Promise.all([page.waitForURL(/\/admin\/confirm\?next=%2Fadmin%2Fsearch%2Fnotes\.csv$/), page.click('[data-notes] [data-download="csv"]')]);
const waitDownload = page.waitForEvent('download');
await signIn(page, HANNAH, { waitForNav: false });
download = await waitDownload;
const notes = readFileSync(await download.path(), 'utf8');
check(notes.startsWith('﻿Family,About,Note,Written by,When\r\n') && notes.includes('Asked about the spring show dates.'), 'after a new code, the Family Notes CSV downloads');
[download] = await Promise.all([page.waitForEvent('download'), page.goto(`${BASE}/admin/search/notes.pdf`).catch(() => null)]);
check(readFileSync(await download.path()).subarray(0, 4).toString() === '%PDF', 'and the Family Notes PDF');

// ── 7. Not for families ──
const fam = await browser.newContext();
const fp = await fam.newPage();
await fp.goto(`${BASE}/account`);
await signIn(fp, 'families.parent@example.com');
for (const p of [new URL(familyUrl).pathname, '/admin/search', '/admin/search?q=zara', '/admin/search.csv', '/admin/search/notes.pdf']) {
  const res = await fp.request.get(BASE + p, { maxRedirects: 0 });
  check(res.status() === 404, `a signed-in parent gets 404 at ${p}`);
}
await fam.close();

check(errors.length === 0, `no page errors (${errors.join('; ')})`);
await browser.close();
console.log('\nStaff families checks passed.');
