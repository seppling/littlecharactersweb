#!/usr/bin/env node
/**
 * End-to-end: tags, skills and progress notes (docs/back-office.md → Tags
 * and skills).
 *
 * - A new family (made up) signs up two children; Hannah adds them to Intro
 *   to Theater without charge.
 * - Hannah makes a child tag and a family tag in Settings → Tags, tags both
 *   children from the class roster ("Tag selected") and the family from its
 *   page, filters the roster and search by tag, and previews an email to the
 *   tag.
 * - She adds skills to Intro to Theater in Settings → Skills.
 * - A teacher (a made-up email) ticks skills on a 390 px phone, including
 *   with no signal ("Needs signal to save", then saved), and writes a draft
 *   note. The teacher never sees tags.
 * - Hannah sees the grid and the draft on the class page, previews and sends
 *   the note; the family sees it in their account.
 * - The changed pages at 390 px: no sideways scrolling, 44 px tap targets.
 *
 * Run last, on the same server as the others:
 *
 *   npm run build && tests/e2e/serve.sh      # fresh local database + sample import
 *   node tests/e2e/staff-tags-skills.mjs [baseUrl] [screenshotDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const SHOTS = process.argv[3];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const step = (msg) => console.log(`✓ ${msg}`);
function check(ok, msg) {
  if (!ok) throw new Error(`✗ ${msg}`);
  step(msg);
}
const shot = async (p, name, fullPage = true) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });
const sideways = (p) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

async function newPage(viewport = DESKTOP) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  return p;
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
  if (!code) throw new Error('No sign-in code arrived');
  await Promise.all([p.waitForEvent('load'), p.fill('#signin-code', code)]);
  await p.waitForTimeout(800);
}

async function tapTargets(p, selector, what) {
  const small = await p.$$eval(selector, (els) =>
    els
      .filter((e) => e.offsetParent !== null)
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.height < 44)
      .map((r) => Math.round(r.height)),
  );
  check(small.length === 0, `${what}: tap targets at least 44 px${small.length ? ` (found ${small.join(', ')})` : ''}`);
}

/** At 390 px: no sideways scrolling and 44 px taps, plus a screenshot. Back to the computer width after. */
async function onPhone(p, name, what, taps) {
  await p.setViewportSize(PHONE);
  check((await sideways(p)) <= 0, `${what}: no sideways scrolling at 390 px`);
  if (taps) await tapTargets(p, taps, what);
  await shot(p, `${name}-phone`);
  await p.setViewportSize(DESKTOP);
}

/** The next Tuesday (YYYY-MM-DD, Athens) from today, or today if it's one. Intro to Theater meets on Tuesdays. */
function nextTuesday() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  while (d.getUTCDay() !== 2) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const HANNAH = 'hannah@example.com';
const TEACHER = 'morgan.sample.skills@example.com';
const PARENT = 'jo.sample.tags@example.com';
const INTRO = 'intro-f26-tue';
const TUE = nextTuesday();
const KIDS = [
  ['Mila', 'Larkspur', '2017-03-03'],
  ['Otto', 'Larkspur', '2018-05-05'],
];

// ── 1. A family signs up two children ──
const fp = await newPage();
await fp.goto(`${BASE}/account`);
await signIn(fp, PARENT);
await fp.waitForSelector('#p-name');
await fp.fill('#p-name', 'Jo Larkspur');
await fp.fill('#p-phone', '706-555-0177');
await fp.click('button[type="submit"]');
await fp.waitForSelector('text=Add a student');
for (const [first, last, birthday] of KIDS) {
  if (!(await fp.locator('#s-first').isVisible())) await fp.click('details.add > summary');
  await fp.fill('#s-first', first);
  await fp.fill('#s-last', last);
  await fp.fill('#s-bday', birthday);
  await fp.click('form:has(input[value="add-student"]) button[type="submit"]');
  await fp.waitForSelector(`text=${first} ${last}`);
}
step('a family made an account with Mila and Otto');

// ── 2. Hannah adds them to Intro to Theater ──
const hp = await newPage();
await hp.goto(`${BASE}/admin/classes/${INTRO}`);
await signIn(hp, HANNAH);
await hp.waitForSelector('[data-roster-tools]');
for (const [first, last] of KIDS) {
  await hp.goto(`${BASE}/admin/classes/${INTRO}`);
  await hp.click('[data-roster-tools] > details > summary');
  await hp.fill('#find-q', `${first} ${last}`);
  await hp.click('[data-find] button');
  const row = hp.locator('[data-add-child]').filter({ hasText: `${first} ${last}` });
  await row.locator('button:has-text("Add without charge")').click();
  await hp.fill('#add-reason', 'Sample for the tags test');
  if (await hp.locator('[data-full-warning] input').count()) await hp.check('[data-full-warning] input');
  await Promise.all([hp.waitForURL(/done=added/), hp.click('[data-add-confirm] button[value="add-free"]')]);
}
step('Hannah added both to Intro to Theater, without charge');

// ── 3. Settings → Tags ──
await hp.goto(`${BASE}/admin/settings`);
check(await hp.locator('[data-settings-tags]').count(), 'Settings has a Tags tile');
await hp.click('[data-settings-tags]');
await hp.waitForSelector('h1:has-text("Tags")');
await hp.check('input[name="kind"][value="child"]');
await hp.fill('#tag-name', 'Cast group A');
await Promise.all([hp.waitForURL(/done=added/), hp.click('[data-add-tag] button[type="submit"]')]);
check(await hp.locator('[data-tag-kind="child"] [data-tag-row="Cast group A"]').count(), 'a child tag, “Cast group A”, is listed under Children');
await hp.check('input[name="kind"][value="child"]');
await hp.fill('#tag-name', 'cast GROUP a');
await hp.click('[data-add-tag] button[type="submit"]');
await hp.waitForSelector('[data-error]');
check((await hp.textContent('[data-error]')).includes('can’t repeat'), 'the same name in other capitals is refused, in plain words');
await hp.check('input[name="kind"][value="family"]');
await hp.fill('#tag-name', 'Carpool');
await Promise.all([hp.waitForURL(/done=added/), hp.click('[data-add-tag] button[type="submit"]')]);
check(await hp.locator('[data-tag-kind="family"] [data-tag-row="Carpool"]').count(), 'a family tag, “Carpool”, is listed under Families');

// ── 4. Tag children from the roster ──
await hp.goto(`${BASE}/admin/classes/${INTRO}`);
await hp.click('[data-tag-tool] > summary');
for (const [first, last] of KIDS) await hp.locator('[data-child]').filter({ hasText: `${first} ${last}` }).locator('[data-tag-tick] input').check();
check((await hp.textContent('[data-ticked-count]')).includes('2 children ticked'), 'two children ticked on the roster');
await hp.fill('#tag-selected-name', 'Cast group A');
await Promise.all([hp.waitForURL(/tagged=2/), hp.click('[data-tag-selected]')]);
check((await hp.textContent('[data-tagged]')).includes('Tagged 2 children'), '“Tag selected” tags both: “Tagged 2 children.”');
for (const [first, last] of KIDS) {
  const chips = await hp.locator('[data-child]').filter({ hasText: `${first} ${last}` }).locator('[data-tags]').textContent();
  check(chips.includes('Cast group A'), `${first}’s roster row shows the tag as a chip`);
}
const tagId = await hp.$eval('#roster-tag option:not([value=""])', (o) => o.value);
await hp.selectOption('#roster-tag', tagId);
await Promise.all([hp.waitForURL(/tag=/), hp.click('[data-tag-filter] button')]);
const shown = await hp.$$eval('[data-roster] [data-child]', (els) => els.map((e) => e.querySelector('.kid__name')?.textContent));
check(shown.length === 2 && shown.every((n) => /Larkspur/.test(n)), `the roster filtered by the tag shows only those two (${shown.join(', ')})`);
check((await hp.textContent('[data-tag-shown]')).includes('2 children'), '… and says how many');
await shot(hp, 'roster-tags-desktop');
await onPhone(hp, 'roster-tags', 'a roster filtered by a tag', '[data-roster-tags] button, [data-roster-tags] select, [data-roster-tags] summary');

// ── 5. Tag the family and a child from the family's page ──
await hp.goto(`${BASE}/admin/search?q=Larkspur`);
await Promise.all([hp.waitForURL(/\/admin\/families\//), hp.locator('[data-results="families"] a.hit').first().click()]);
const familyUrl = hp.url().split('?')[0];
await hp.click('[data-family-tags] [data-tag-editor] details > summary');
await hp.fill('[data-family-tags] input[name="name"]', 'Carpool');
await Promise.all([hp.waitForURL(/tags=added/), hp.click('[data-family-tags] [data-add-tag] button')]);
check((await hp.textContent('[data-family-tags] [data-tags]')).includes('Carpool'), 'the family is tagged “Carpool” (picked from the list)');
const mila = hp.locator('[data-child]').filter({ hasText: 'Mila Larkspur' });
check((await mila.locator('[data-tags]').textContent()).includes('Cast group A'), 'Mila’s card shows her roster tag');
await mila.locator('[data-tag-editor] details > summary').click();
await mila.locator('input[name="name"]').fill('Needs a buddy');
await Promise.all([hp.waitForURL(/tags=created/), mila.locator('[data-add-tag] button').click()]);
check((await hp.locator('[data-child]').filter({ hasText: 'Mila Larkspur' }).locator('[data-tags]').textContent()).includes('Needs a buddy'), 'a new tag typed on Mila’s card is made and added');
await Promise.all([hp.waitForURL(/tags=removed/), hp.locator('[data-child]').filter({ hasText: 'Mila Larkspur' }).locator('[data-tag] [data-remove-tag]').last().click()]);
check(!(await hp.locator('[data-child]').filter({ hasText: 'Mila Larkspur' }).locator('[data-tags]').textContent()).includes('Needs a buddy'), '✕ removes a tag from a child');
await shot(hp, 'family-tags-desktop');
await onPhone(hp, 'family-tags', 'a family’s page with tags', '[data-tag-editor] button, [data-tag-editor] summary');

// ── 6. Search by tag, and chips on search results ──
await hp.goto(`${BASE}/admin/search?q=Larkspur`);
check((await hp.textContent('[data-results="children"]')).includes('Cast group A'), 'search results show children’s tags');
check((await hp.textContent('[data-results="families"]')).includes('Carpool'), '… and families’ tags');
await hp.goto(`${BASE}/admin/search`);
await hp.selectOption('#by-tag', tagId);
await Promise.all([hp.waitForURL(/tag=/), hp.click('[data-tag-search] button')]);
const tagged = await hp.$$eval('[data-results="tag"] a.hit strong', (els) => els.map((e) => e.textContent));
check(tagged.length === 2 && tagged.includes('Mila Larkspur') && tagged.includes('Otto Larkspur'), 'search by tag lists the two children');
check((await hp.textContent('[data-results="tag"]')).includes('Intro to Theater'), '… with their classes');
await shot(hp, 'search-tag-desktop');
await onPhone(hp, 'search-tag', 'search by tag', '[data-tag-search] select, [data-tag-search] button, [data-results="tag"] a');

// ── 7. Email a tag: preview ──
await hp.click('[data-tag-email]');
await hp.waitForSelector('[data-composer][data-kind="tag"]');
check((await hp.locator('[data-family]').count()) === 1, 'Email a tag: the one family of the two tagged children');
await hp.fill('#msg-subject', 'Cast group A rehearsal');
await hp.fill('#msg-body', 'Cast group A meets in the big room this week.');
await hp.click('[data-review]');
await hp.waitForSelector('[data-step="review"]');
check((await hp.textContent('[data-sending-to]')).includes('Sending to 1 family'), 'the preview says “Sending to 1 family”');
await shot(hp, 'tag-email-review-desktop');

// Settings → Tags shows the counts.
await hp.goto(`${BASE}/admin/settings/tags`);
check((await hp.textContent('[data-tag-row="Cast group A"] [data-tag-count]')).includes('2 children'), 'Settings → Tags counts 2 children for “Cast group A”');
check((await hp.textContent('[data-tag-row="Carpool"] [data-tag-count]')).includes('1 family'), '… and 1 family for “Carpool”');
const csv = await hp.request.get(BASE + (await hp.getAttribute('[data-tag-row="Cast group A"] [data-download="csv"]', 'href')));
check(csv.status() === 200 && (await csv.text()).includes('Mila Larkspur'), 'the tag’s list downloads as a CSV');
await shot(hp, 'settings-tags-desktop');
await onPhone(hp, 'settings-tags', 'Settings → Tags', '.tags-page button, .tags-page summary, .tags-page .choice, .tags-page a.btn');

// ── 8. Settings → Skills ──
await hp.goto(`${BASE}/admin/settings`);
await hp.click('[data-settings-skills]');
await hp.click('[data-program="intro-to-theater"]');
await hp.waitForSelector('h1:has-text("Skills: Intro to Theater")');
for (const name of ['Projects their voice', 'Stays in character', 'Takes direction']) {
  await hp.fill('#skill-name', name);
  await Promise.all([hp.waitForURL(/done=added/), hp.click('[data-add-skill] button')]);
}
await Promise.all([hp.waitForURL(/done=moved/), hp.click('button[aria-label="Move Takes direction up"]')]);
const order = await hp.$$eval('[data-skill-list] [data-skill-row]', (els) => els.map((e) => e.getAttribute('data-skill-row')));
check(order.join(' / ') === 'Projects their voice / Takes direction / Stays in character', `three skills, reordered (${order.join(' / ')})`);
await shot(hp, 'settings-skills-desktop');
await onPhone(hp, 'settings-skills', 'Settings → Skills', '.skills-settings button, .skills-settings summary');

// ── 9. A teacher for Intro to Theater ──
await hp.goto(`${BASE}/admin/settings/staff`);
await hp.fill('#add-name', 'Morgan Sample');
await hp.fill('#add-email', TEACHER);
await Promise.all([hp.waitForURL(/saved=added$/), hp.click('[data-add-staff] button[type="submit"]')]);
await hp.selectOption(`select[name="class:${INTRO}"]`, 'lead');
await Promise.all([hp.waitForURL(/saved=classes/), hp.click('[data-classes] button[type="submit"]')]);
step('Hannah added a teacher for Intro to Theater');

// ── 10. The teacher ticks skills on a phone ──
const tp = await newPage(PHONE);
await tp.goto(`${BASE}/admin/teach`);
await signIn(tp, TEACHER);
await tp.waitForSelector('h1:has-text("Hi, Morgan")');
await tp.goto(`${BASE}/admin/teach/${INTRO}/${TUE}?on=${TUE}`);
check(!(await tp.textContent('body')).includes('Cast group A'), 'the teacher’s attendance roster shows no tags');
await Promise.all([tp.waitForURL(/\/skills/), tp.click('[data-view="skills"]')]);
check(!(await tp.textContent('body')).includes('Cast group A'), 'nor does the Skills view');
const milaRow = tp.locator('[data-kid]').filter({ hasText: 'Mila L.' });
await milaRow.locator('summary').click();
const tickOn = async (kid, skill, label) => {
  await kid.locator('[data-skill]').filter({ hasText: skill }).locator(`button:has-text("${label}")`).click();
};
await tickOn(milaRow, 'Projects their voice', 'Got it');
await tp.waitForSelector('[data-save-status][data-state="sent"]');
await tickOn(milaRow, 'Takes direction', 'Working on it');
await tp.waitForSelector('[data-save-status][data-state="sent"]');
check((await milaRow.locator('[data-kid-summary]').textContent()).includes('1 got it · 1 working on it'), 'Mila: one Got it, one Working on it, saved ✓');

// No signal: the tick stays on screen and saves once signal is back.
const ottoRow = tp.locator('[data-kid]').filter({ hasText: 'Otto L.' });
await ottoRow.locator('summary').click();
await tp.context().setOffline(true);
await tickOn(ottoRow, 'Projects their voice', 'Working on it');
await tp.waitForSelector('[data-save-status][data-state="waiting"]');
check((await tp.textContent('[data-save-status]')).includes('Needs signal to save'), 'offline, the page says “Needs signal to save”');
check((await ottoRow.locator('[data-skill]').filter({ hasText: 'Projects their voice' }).locator('button[aria-pressed="true"]').textContent()).includes('Working on it'), '… and keeps the tick on screen');
await shot(tp, 'teach-skills-offline-phone');
await tp.context().setOffline(false);
await tp.waitForSelector('[data-save-status][data-state="sent"]', { timeout: 30_000 });
step('back online, the tick saves on its own');

// A draft note for Hannah.
await milaRow.locator('textarea[name="body"]').fill('Mila spoke up in every scene this week.');
await Promise.all([tp.waitForURL(/draft=saved/), milaRow.locator('[data-save-draft]').click()]);
check(await tp.locator('[data-draft-saved]').count(), 'the teacher saved a note for Hannah');
check((await sideways(tp)) <= 0, 'the Skills view: no sideways scrolling at 390 px');
await tapTargets(tp, '.skills-page .steps__btn, .skills-page summary, .skills-page .btn, .teach-views a', 'the Skills view');
await tp.locator('[data-kid]').filter({ hasText: 'Mila L.' }).locator('summary').click();
await shot(tp, 'teach-skills-phone');
await tp.setViewportSize(DESKTOP);
await shot(tp, 'teach-skills-desktop');
await tp.setViewportSize(PHONE);

// Tags stay with owners.
for (const path of ['/admin/settings/tags', `/admin/search?tag=${tagId}`, `/admin/settings/tags/${tagId}/email`, '/admin/settings/skills']) {
  const res = await tp.goto(BASE + path);
  check(res.status() === 404, `a teacher gets the Staff only panel (404) at ${path}`);
}
const tagCsv = await tp.request.get(`${BASE}/admin/settings/tags/${tagId}.csv`, { maxRedirects: 0 });
check(tagCsv.status() === 404, 'a teacher can’t download a tag’s list');

// ── 11. Hannah: the grid, the draft, the preview, Send ──
await hp.goto(`${BASE}/admin/classes/${INTRO}`);
const gridMila = hp.locator('[data-skill-grid] [data-skill-child]').filter({ hasText: 'Mila Larkspur' });
check((await gridMila.textContent()).includes('Got it') && (await gridMila.textContent()).includes('Working on it'), 'the class page’s Skills grid shows Mila’s ticks');
check((await hp.textContent('[data-notes-to-send]')).includes('Mila Larkspur'), '“Progress notes to send” lists the teacher’s draft');
await hp.locator('[data-class-skills]').scrollIntoViewIfNeeded();
await shot(hp, 'class-skills-desktop');
await hp.setViewportSize(PHONE);
check((await sideways(hp)) <= 0, 'the class page with Skills: no sideways scrolling at 390 px');
await tapTargets(hp, '[data-class-skills] a, [data-class-skills] .btn', 'the class page’s Skills part');
await hp.locator('[data-class-skills]').screenshot({ path: SHOTS ? `${SHOTS}/class-skills-phone.png` : undefined }).catch(() => {});
await hp.setViewportSize(DESKTOP);
const worksheet = await hp.request.get(BASE + (await hp.getAttribute('[data-class-skills] [data-download="csv"]', 'href')));
check(worksheet.status() === 200 && (await worksheet.text()).includes('Projects their voice'), 'the Class Skills Worksheet downloads as a CSV');

await hp.click('[data-notes-to-send] a');
await hp.waitForSelector('[data-note-form]');
check((await hp.inputValue('[data-note-body]')).includes('Mila spoke up'), 'the draft opens with the teacher’s words');
check(await hp.locator('[data-got-it] input[type="checkbox"]:checked').count(), 'her Got it skills are ticked to list under it');
await hp.fill('[data-note-body]', 'Mila spoke up in every scene this week. She’s ready for a bigger part.');
await Promise.all([hp.waitForURL(/preview=1/), hp.click('[data-preview]')]);
const preview = await hp.textContent('[data-review-body]');
check(preview.includes('Got it:') && preview.includes('Projects their voice') && preview.includes('Working on it:') && preview.includes('Takes direction'), 'the preview lists her Got it and Working on it skills under the note');
check((await hp.textContent('[data-sending-to]')).includes(PARENT), '… and says it goes to her parent');
await shot(hp, 'note-preview-desktop');
await onPhone(hp, 'note-preview', 'the progress note’s preview', '[data-note-review] .btn');
await Promise.all([hp.waitForURL(/note=sent/), hp.click('[data-send]')]);
check(await hp.locator('[data-note-notice]').count(), 'sent: back on the class page with “Progress note sent”');
check(!(await hp.locator('[data-notes-to-send]').count()), 'nothing left to send');
const mail = await mailTo(hp, PARENT, 'Mila’s progress in Intro to Theater');
check(mail.includes('Mila’s progress in Intro to Theater'), 'the parent got the email “Mila’s progress in Intro to Theater”');
await hp.goto(familyUrl);
check((await hp.textContent('[data-emails]')).includes('Mila’s progress in Intro to Theater'), 'it’s on the family’s “Emails sent”');

// ── 12. The family sees it in their account ──
await fp.goto(`${BASE}/account`);
const notes = fp.locator('[data-progress-notes]');
check((await notes.textContent()).includes('ready for a bigger part') && (await notes.textContent()).includes('Projects their voice'), 'the family sees the note in their account, under Mila');
check(!(await fp.textContent('body')).includes('Cast group A') && !(await fp.textContent('body')).includes('Carpool'), 'the family never sees tags');
await notes.scrollIntoViewIfNeeded();
await shot(fp, 'family-notes-desktop');
await onPhone(fp, 'family-notes', 'the family’s account with a progress note', '[data-progress-notes] summary');

check(errors.length === 0, `no page errors (${errors.join('; ')})`);
await browser.close();
