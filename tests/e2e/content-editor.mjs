#!/usr/bin/env node
/**
 * End-to-end: Hannah edits the site. She signs in to /admin/content, changes a
 * class (the draft stays off the site until she publishes), previews it, adds
 * a new term's session by copying last term's, turns on the announcement bar,
 * uploads a photo, restores an older version, and brings back a deleted event.
 * A family can't see or use any of it.
 *
 *   npm run build && tests/e2e/serve.sh      # fresh local database
 *   node tests/e2e/enroll-journey.mjs         # first: it expects the starting content
 *   node tests/e2e/content-editor.mjs [baseUrl] [screenshotDir]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const SHOTS = process.argv[3];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', (d) => d.accept());
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const step = (msg) => console.log(`✓ ${msg}`);
const check = (ok, msg) => {
  if (!ok) throw new Error(`Failed: ${msg}`);
};
/** What a family sees: no cookies, so no preview. */
const live = async (p) => (await fetch(BASE + p)).text();
const submit = (action) => Promise.all([page.waitForNavigation(), page.click(`button[value="${action}"]`)]);

async function signIn(email) {
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
  if (!code) throw new Error('No sign-in code arrived');
  await Promise.all([page.waitForNavigation(), page.fill('#signin-code', code)]);
}

// 1. Staff sign in right where they wanted to go.
await page.goto(`${BASE}/admin/content/programs/intro-to-theater`);
await signIn('hannah@example.com');
await page.waitForSelector('h1:has-text("Intro to Theater")');
step('Staff sign-in lands on the editor');

// 2. A draft stays off the site; preview shows it; publish puts it live.
await page.fill('#f-tagline', 'Where every kid finds their voice on stage.');
await submit('save');
check(await page.locator('.notice:has-text("Saved as a draft")').count(), 'draft notice');
check(!(await live('/programs/intro-to-theater')).includes('finds their voice'), 'draft is not live');
await submit('preview');
check(await page.locator('.staff-bar--preview').count(), 'preview bar');
check(await page.locator('text=Where every kid finds their voice on stage.').count(), 'preview shows the draft');
await shot('editor-1-preview');
await Promise.all([page.waitForNavigation(), page.click('.staff-bar--preview a:has-text("Back to editing")')]);
await submit('publish');
check((await live('/programs/intro-to-theater')).includes('finds their voice'), 'published tagline is live');
step('Draft → preview → publish');

// 3. A new term: copy last term's session and change its dates.
const sessions = page.locator('#f-sessions [data-list-items] > details');
await sessions.first().locator('summary [data-copy]').click();
const copy = sessions.nth(1);
await copy.locator('input[name$=".term"]').fill('Spring 2027');
await copy.locator('input[name$=".startDate"]').fill('2027-01-12');
await copy.locator('input[name$=".endDate"]').fill('2027-05-04');
await shot('editor-2-session');
await submit('publish');
const classPage = await live('/programs/intro-to-theater');
const enrollIds = new Set([...classPage.matchAll(/\/enroll\/([a-z0-9-]+)/g)].map((m) => m[1]));
check(enrollIds.has('intro-f26-tue') && enrollIds.size === 2, `new session has its own id (${[...enrollIds]})`);
check(classPage.includes('Jan 12'), 'new session dates on the class page');
step('Copied a session into a new term, with its own enrollment link');

// 4. Required fields are explained, by name.
await page.fill('#f-title', '');
await submit('save');
check((await page.locator('.notice--error').textContent()).includes('Name: Required'), 'names the missing field');
await page.fill('#f-title', 'Intro to Theater');
await submit('save');
step('Missing fields are named in plain words');

// 5. The announcement bar, from site settings.
await page.goto(`${BASE}/admin/content/pages/site`);
await page.check('#f-announcement-show');
await page.fill('#f-announcement-text', 'Spring registration is open!');
await page.fill('#f-announcement-link-label', 'See classes');
await page.fill('#f-announcement-link-href', '/programs');
await submit('publish');
check((await live('/about')).includes('Spring registration is open!'), 'announcement on every page');
step('Announcement bar turned on');

// 6. Upload a photo, set its focus point, use it.
const photo = path.join(tmpdir(), 'lc-upload-test.jpg');
writeFileSync(photo, await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#11aa99' } }).jpeg().toBuffer());
await page.goto(`${BASE}/admin/content/team/cc-conner`);
await page.click('[data-image-field] [data-choose-photo]');
await page.waitForSelector('dialog[data-photo-picker][open] .picker__photo');
await page.setInputFiles('[data-picker-upload]', photo);
await page.waitForFunction(() => !document.querySelector('dialog[data-photo-picker]').open, null, { timeout: 30_000 });
const src = await page.inputValue('[data-image-src]');
check(src.startsWith('media:'), 'upload picked');
await page.fill('input[name="image.alt"]', 'A teal test photo');
await page.locator('[data-focus-picker]').click({ position: { x: 40, y: 30 } });
check(/^\d+% \d+%$/.test(await page.inputValue('[data-image-position]')), 'focus point set');
await submit('publish');
const mediaUrl = (await live('/about')).match(new RegExp(`/media/${src.slice(6)}/\\d+`))?.[0];
check(mediaUrl, 'About page uses the upload');
const served = await fetch(BASE + mediaUrl);
check(served.ok && served.headers.get('content-type') === 'image/webp', 'upload served as WebP');
step('Uploaded a photo and used it');

// 7. History: bring back the previous photo.
await page.click('text=History and older versions');
await shot('editor-3-history');
await Promise.all([page.waitForNavigation(), page.click('button:has-text("Restore this version")')]);
await submit('publish');
check(!(await live('/about')).includes(src.slice(6)), 'older version restored');
step('Restored an older version');

// 8. Add an event, delete it, bring it back.
await page.goto(`${BASE}/admin/content/events/new`);
await page.fill('#f-title', 'Spring Showcase');
await page.fill('#f-slug', 'spring-showcase-2027');
await page.fill('#f-summary', 'Our spring classes take the stage.');
await page.click('#f-times [data-add-item]');
const t = page.locator('#f-times [data-list-items] > details').last();
await t.locator('input[name$=".start"]').fill('2027-04-24T14:00');
await t.locator('input[name$=".end"]').fill('2027-04-24T15:30');
await submit('publish');
check((await live('/events')).includes('Spring Showcase'), 'new event listed');
await submit('delete');
check(!(await live('/events')).includes('Spring Showcase'), 'deleted event gone');
await page.click('summary:has-text("Recently deleted")');
await Promise.all([page.waitForNavigation(), page.click('a:has-text("Bring back")')]);
await Promise.all([page.waitForNavigation(), page.click('button:has-text("Bring back this version")')]);
await submit('publish');
check((await live('/events')).includes('Spring Showcase'), 'event brought back');
step('Added, deleted and brought back an event');

// 9. The staff button on public pages, for staff only.
await page.goto(`${BASE}/about`);
await page.waitForSelector('[data-staff-bar]:not([hidden])');
check((await page.getAttribute('[data-staff-bar] a', 'href')) === '/admin/content/pages/about', 'Edit this page link');
step('“Edit this page” shows for staff');

const family = await browser.newContext();
const fp = await family.newPage();
await fp.goto(`${BASE}/about`);
await fp.waitForTimeout(400);
check((await fp.locator('[data-staff-bar]:not([hidden])').count()) === 0, 'families see no staff button');
await fp.goto(`${BASE}/admin/content/programs/intro-to-theater`);
check(await fp.locator('h2:has-text("Staff sign-in")').count(), 'editor asks families to sign in');
await family.request.post(`${BASE}/admin/content/programs/intro-to-theater`, { form: { _action: 'publish', title: 'Hacked' }, headers: { origin: BASE } });
check(!(await live('/programs/intro-to-theater')).includes('Hacked'), 'family POST changes nothing');
await family.close();
step('Families can’t see or use the editor');

check(errors.length === 0, `no page errors (${errors.join('; ')})`);
await browser.close();
console.log('\nAll editor checks passed.');
