#!/usr/bin/env node
/**
 * End-to-end: "Email the class" and "Email this family" (src/server/messages.ts).
 *
 * - Compose for a class with the families from the journeys; untick one.
 * - "Copy emails" fills the clipboard; when the browser refuses, the box
 *   to copy from appears.
 * - Send a test, review, then send (with a double click): the dev mailbox has
 *   one email per ticked family, with the subject and footer. A refresh and a
 *   resent form send nothing more.
 * - The family page lists the email; "Email this family" sends to one family.
 * - At 390 px, nothing is wider than the screen.
 *
 * Run after the other browser tests, on the same server:
 *
 *   npm run build && tests/e2e/serve.sh > server.log
 *   SERVER_LOG=server.log node tests/e2e/staff-messages.mjs [baseUrl] [screenshotDir]
 *
 * With SERVER_LOG, it also checks each email's reply-to in the dev mailbox's
 * log lines (the mailbox page doesn't store it).
 */
import { chromium } from 'playwright';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const SHOTS = process.argv[3];
const LOG = process.env.SERVER_LOG;
const REPLY_TO = process.env.EMAIL_REPLY_TO ?? 'littlecharacterstheater@gmail.com';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
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
const phone = () => page.setViewportSize({ width: 390, height: 844 });
const desktop = () => page.setViewportSize({ width: 1280, height: 900 });

/** Small tap targets among the visible buttons and links of the page's own content. */
const smallTargets = () =>
  page.evaluate(() =>
    [...document.querySelectorAll('.admin-page :is(button, .btn, summary, label.family__pick, label.switch)')]
      // 43.99, not 44: a button still sliding back from its hover lift measures 43.99999 px (a sub-pixel transform).
      .filter((el) => el.getClientRects().length && el.getBoundingClientRect().height < 43.99)
      .map((el) => el.textContent.trim().slice(0, 30)),
  );

async function phoneCheck(what, name) {
  await phone();
  const extra = await sideways();
  check(extra <= 0, `${what}: no sideways scrolling at 390 px${extra > 0 ? ` (${(await tooWide()).join(', ')})` : ''}`);
  const small = await smallTargets();
  check(small.length === 0, `${what}: tap targets at least 44 px tall at 390 px${small.length ? ` (${small.join(', ')})` : ''}`);
  if (name) await shot(name);
  await desktop();
}

/** The dev mailbox's latest emails: { to, subject, text }. */
async function mailbox() {
  const mail = await ctx.newPage();
  try {
    await mail.goto(`${BASE}/dev/mailbox`);
    return await mail.$$eval('.mailbox li', (lis) =>
      lis.map((li) => ({ to: li.querySelector('.script').textContent.split(' · to ')[1]?.trim() ?? '', subject: li.querySelector('strong').textContent.trim(), text: li.querySelector('pre').textContent })),
    );
  } finally {
    await mail.close();
  }
}

async function codeFor(email) {
  for (let i = 0; i < 20; i++) {
    const found = (await mailbox()).find((m) => m.to === email && /is your Little Characters sign-in code/.test(m.subject));
    const code = found?.subject.match(/^(\d{6})/)?.[1];
    if (code) return code;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('No sign-in code arrived');
}

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

const HANNAH = 'hannah@example.com';
const INTRO = 'intro-f26-tue';
const EMAIL_PAGE = `${BASE}/admin/classes/${INTRO}/email`;
const stamp = Date.now().toString(36);
const SUBJECT = `Costume day ${stamp}`;
const BODY = 'Hi families,\n\nPlease bring a black T-shirt on Tuesday.\nDetails: https://littlecharacters.org/classes\n\nThanks!\nHannah';

// ── 1. The composer, from the class page ──
await page.goto(`${BASE}/admin/classes/${INTRO}`);
if (await page.locator('#signin-email').isVisible()) await signIn(page, HANNAH);
await Promise.all([page.waitForURL(EMAIL_PAGE), page.click('[data-email-link]')]);
check((await page.textContent('h1')).startsWith('Email the class'), '“Email the class” opens the composer');
const families = await page.$$eval('[data-group="enrolled"] [data-family]', (lis) => lis.map((li) => ({ id: li.querySelector('input').value, name: li.querySelector('strong').textContent.trim(), emails: li.dataset.emails.split(', ').filter(Boolean), phones: li.dataset.phones })));
check(families.length >= 2, `the class’s enrolled and trial families are listed (${families.length})`);
check(await page.$$eval('[data-group="enrolled"] input[type=checkbox]', (bs) => bs.every((b) => b.checked)), 'every family starts ticked');
const waitGroup = page.locator('[data-group="waitlist"]');
if (await waitGroup.count()) {
  check(await waitGroup.isHidden(), 'waitlisted families are left out until the switch is on');
  await page.check('[data-waitlist-switch]');
  check(await waitGroup.isVisible(), 'the switch shows the waitlisted families');
  await page.uncheck('[data-waitlist-switch]');
}
await shot('composer-desktop');
await phoneCheck('the composer', 'composer-phone');

// Untick the last family.
const left = families.at(-1);
const kept = families.slice(0, -1);
await page.uncheck(`[data-family] input[value="${left.id}"]`);
check((await page.textContent('[data-count]')).trim() === `${kept.length} ${kept.length === 1 ? 'family' : 'families'} ticked`, `unticking ${left.name} updates the count`);

// ── 2. The copy buttons ──
await page.click('[data-copy="emails"]');
const copied = await page.evaluate(() => navigator.clipboard.readText());
const keptEmails = [...new Set(kept.flatMap((f) => f.emails))];
check(copied === keptEmails.join(', '), `“Copy emails” copies the ticked families’ emails, comma-separated (${keptEmails.length})`);
check(!left.emails.some((e) => copied.split(', ').includes(e)), 'the unticked family isn’t copied');
check(/^Copied \d+ emails?\.$/.test(await page.textContent('[data-copy-status]')), 'it says what it copied');

// A browser that refuses the clipboard gets a box to copy from.
await page.evaluate(() => {
  navigator.clipboard.writeText = () => Promise.reject(new Error('not allowed'));
});
await page.click('[data-copy="phones"]');
const keptPhones = kept.flatMap((f) => f.phones.split(', ').filter(Boolean));
if (keptPhones.length) {
  check(await page.locator('[data-copy-fallback]').isVisible(), 'when copying isn’t allowed, a box to copy from appears');
  check((await page.inputValue('#copy-box')) === [...new Set(keptPhones)].join(', '), '“Copy phone numbers” puts the ticked families’ numbers in it');
} else {
  check(/No phone numbers/.test(await page.textContent('[data-copy-status]')), 'with no phone numbers on file, it says so');
  await page.click('[data-copy="emails"]');
  check((await page.inputValue('#copy-box')) === keptEmails.join(', '), 'when copying isn’t allowed, the box to copy from has the emails');
}

// ── 3. A test, to Hannah only ──
await page.fill('#msg-subject', SUBJECT);
await page.fill('#msg-body', BODY);
await Promise.all([page.waitForURL(EMAIL_PAGE), page.click('[data-test]')]);
check((await page.textContent('[data-notice]')).includes(`Test sent to ${HANNAH}`), '“Send me a test” says where it went');
check(await page.isChecked(`[data-family] input[value="${kept[0].id}"]`) && !(await page.isChecked(`[data-family] input[value="${left.id}"]`)), 'the ticks are kept');
check((await page.inputValue('#msg-subject')) === SUBJECT, 'the subject is kept');
let mail = await mailbox();
check(mail.filter((m) => m.subject === `[Test] ${SUBJECT}`).length === 1 && mail.find((m) => m.subject === `[Test] ${SUBJECT}`).to === HANNAH, 'the test reached only Hannah');
check(!mail.some((m) => m.subject === SUBJECT), 'no family got it yet');

// ── 4. Review, then send ──
await page.click('[data-review]');
await page.waitForSelector('[data-step="review"]');
check((await page.textContent('[data-review-subject]')).trim() === SUBJECT, 'the review shows the subject');
check((await page.textContent('[data-review-body]')).includes('Please bring a black T-shirt'), 'and the message');
check((await page.textContent('[data-sending-to]')).includes(`Sending to ${kept.length} ${kept.length === 1 ? 'family' : 'families'}`), 'and how many families it’s going to');
await shot('review-desktop');
await phoneCheck('the review step', 'review-phone');
const resend = await page.$$eval('[data-step="review"] form input[type=hidden]', (ins) => ins.map((i) => [i.name, i.value]));
await Promise.all([page.waitForURL(/\?sent=/), page.dblclick('[data-send]')]);
check((await page.textContent('[data-sent-ok]')).trim() === `Sent to ${kept.length} ${kept.length === 1 ? 'family' : 'families'}.`, 'after sending: “Sent to N families.”');
await shot('sent-desktop');
await phoneCheck('the sent confirmation', 'sent-phone');

mail = await mailbox();
const sent = mail.filter((m) => m.subject === SUBJECT);
check(sent.length === kept.length, `the dev mailbox has one email per ticked family, even after a double click (${sent.length})`);
for (const f of kept) check(sent.some((m) => m.to === f.emails.join(', ')), `${f.name}: one email to all their parents (${f.emails.join(', ')})`);
check(!sent.some((m) => left.emails.some((e) => m.to.includes(e))), `${left.name} (unticked) got nothing`);
check(sent.every((m) => m.text.includes('Sent by Little Characters about') && m.text.includes('Please bring a black T-shirt')), 'each email has the message and the footer');
if (LOG && existsSync(LOG)) {
  const lines = readFileSync(LOG, 'utf8').split('\n').filter((l) => l.includes(`subject="${SUBJECT}"`));
  check(lines.length === kept.length && lines.every((l) => l.includes(`reply-to=${REPLY_TO}`)), `each email’s reply-to is ${REPLY_TO}`);
} else console.log('· no SERVER_LOG: reply-to is checked by the unit tests only');

// ── 5. No double sends ──
await page.reload();
const resent = await page.request.post(EMAIL_PAGE, {
  data: new URLSearchParams([...resend, ['action', 'send']]).toString(),
  headers: { origin: BASE, 'content-type': 'application/x-www-form-urlencoded' },
  maxRedirects: 0,
});
check(resent.status() === 303 && /&again=1$/.test(resent.headers().location), 'the same form sent again goes to the sent email, marked “already sent”');
mail = await mailbox();
check(mail.filter((m) => m.subject === SUBJECT).length === kept.length, 'a refresh and a resent form send nothing more');

// ── 6. Earlier emails ──
await page.goto(EMAIL_PAGE);
const row = page.locator('[data-earlier-row]', { hasText: SUBJECT });
check((await row.count()) === 1, 'the composer lists the email under Earlier emails');
check((await row.locator('td[data-label="Families"]').textContent()).trim() === String(kept.length), 'with how many families');
check((await row.locator('td[data-label="From"]').textContent()).trim().length > 0, 'and who sent it');

// ── 7. The family page lists it; “Email this family” ──
const fam = kept[0];
await page.goto(`${BASE}/admin/families/${fam.id}`);
const listed = page.locator('[data-emails] tr', { hasText: SUBJECT });
check((await listed.count()) === fam.emails.length, `${fam.name}’s page lists the email for each parent address`);
await page.locator('[data-emails]').scrollIntoViewIfNeeded();
if (SHOTS) await page.locator('[data-emails]').screenshot({ path: `${SHOTS}/family-emails-desktop.png` });
await phone();
check((await sideways()) <= 0, 'the family page at 390 px: nothing wider than the screen');
if (SHOTS) await page.locator('[data-emails]').screenshot({ path: `${SHOTS}/family-emails-phone.png` });
await desktop();

await Promise.all([page.waitForURL(`${BASE}/admin/families/${fam.id}/email`), page.click('[data-email-family]')]);
check((await page.textContent('h1')).trim() === 'Email this family', '“Email this family” opens the composer for one family');
check(!(await page.locator('[data-family] input[type=checkbox]').count()), 'no ticks: it goes to this family');
await phoneCheck('the family composer', 'family-composer-phone');
const FAM_SUBJECT = `Your card ${stamp}`;
await page.fill('#msg-subject', FAM_SUBJECT);
await page.fill('#msg-body', 'Hi! Your card on file has expired. Please update it in your account.');
await page.click('[data-review]');
await page.waitForSelector('[data-step="review"]');
check((await page.textContent('[data-sending-to]')).includes('Sending to 1 family'), 'the review says “Sending to 1 family”');
await Promise.all([page.waitForURL(/\?sent=/), page.click('[data-send]')]);
mail = await mailbox();
const famMail = mail.filter((m) => m.subject === FAM_SUBJECT);
check(famMail.length === 1 && famMail[0].to === fam.emails.join(', '), 'one email to the family’s parents');
check(famMail[0].text.includes('Sent by Little Characters. Reply'), 'with the short footer');
await page.goto(`${BASE}/admin/families/${fam.id}`);
check((await page.locator('[data-emails] tr', { hasText: FAM_SUBJECT }).count()) === fam.emails.length, 'the family page lists it too');

// ── 8. Families can't see it ──
const anon = await fetch(EMAIL_PAGE, { redirect: 'manual' });
check(!(await anon.text()).includes(kept[0].emails[0]), 'signed out, the composer shows no family’s email');

check(errors.length === 0, `no page errors (${errors.join('; ')})`);
await browser.close();
console.log('\nStaff messages checks passed.');
