#!/usr/bin/env node
/**
 * End-to-end: the free first class, and the age rule on "Who's coming?".
 *
 * A new family adds four children. The two outside Intro to Theater's ages are
 * greyed out and refused; the other two take the free first class together
 * (nothing due, no payment step). Then each continues after the trial: one on
 * monthly autopay, one paying for the season, at the prorated and discounted
 * amounts. Once Ben is enrolled, the 15% family discount lowers Ava's later
 * months too. A child can't take a second free class, a Geode class offers
 * none, and the billing run charges the right monthly amount.
 *
 * Run after enroll-journey.mjs, on the same server (it also works on its own):
 *
 *   npm run build && tests/e2e/serve.sh      # fresh local database + sample import
 *   node tests/e2e/trial-journey.mjs [baseUrl] [screenshotDir]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const SHOTS = process.argv[3];
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
// From the top, so the sticky header doesn't land over the content in a full-page shot.
const top = () => page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
const shot = async (name) => SHOTS && (await top(), page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }));
const step = (msg) => console.log(`✓ ${msg}`);
const fail = (msg) => {
  throw new Error(msg);
};
/** Also at phone width (390 px): the page must not scroll sideways. */
async function phoneCheck(name) {
  await page.setViewportSize({ width: 390, height: 844 });
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (SHOTS) await top(), await page.screenshot({ path: `${SHOTS}/${name}-390.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  if (wide > 0) fail(`${name}: scrolls sideways by ${wide}px at 390 px`);
}

async function mailTo(email, pattern) {
  const mail = await ctx.newPage();
  try {
    for (let i = 0; i < 20; i++) {
      await mail.goto(`${BASE}/dev/mailbox`);
      const texts = await mail.locator('li').filter({ hasText: `to ${email}` }).allTextContents();
      const hit = texts.find((t) => pattern.test(t));
      if (hit) return hit;
      await new Promise((r) => setTimeout(r, 250));
    }
  } finally {
    await mail.close();
  }
  fail(`No email to ${email} matching ${pattern}`);
}

async function signIn(p, email) {
  await p.fill('#signin-email', email);
  for (let tries = 0; ; tries++) {
    await p.click('[data-step="email"] button[type="submit"]');
    await p.waitForSelector('#signin-code:visible, [data-error]:visible');
    if (await p.locator('#signin-code').isVisible()) break;
    // Sign-in codes are rate limited per address (5 a minute); right after enroll-journey.mjs we can hit it.
    if (tries > 1 || !(await p.locator('[data-error]').textContent()).includes('Too many')) fail(`Sign-in failed: ${await p.locator('[data-error]').textContent()}`);
    await p.waitForTimeout(61_000);
  }
  const text = await mailTo(email, /is your Little Characters sign-in code/);
  const code = text.match(/(\d{6}) is your Little Characters sign-in code/)[1];
  await Promise.all([p.waitForLoadState('load'), p.fill('#signin-code', code)]);
  await p.waitForTimeout(800);
}

// ───────────── Expected prices, worked out here from the class's dates ─────────────
// Intro to Theater (intro-f26-tue): Tuesdays, Aug 17 – Dec 18 2026, $95 a month, $30 performance fee.
// Mirrors the rules in docs/portal.md, independently of src/lib/pricing.ts.
const TUITION = 9500;
const FEE = 3000;
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const tuesdays = [];
for (let d = new Date('2026-08-17T12:00:00Z'); d <= new Date('2026-12-18T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
  if (d.getUTCDay() === 2) tuesdays.push(d.toISOString().slice(0, 10));
}
if (!tuesdays.some((t) => t >= today)) fail(`Intro to Theater's fall term is over (today is ${today}); point this test at a current class.`);
const months = [...new Set(tuesdays.filter((t) => t >= today).map((t) => t.slice(0, 7)))];
const lateJoin = (new Date(`${today}T12:00:00Z`) - new Date('2026-08-17T12:00:00Z')) / 86_400_000 > 7;
const shares = months.map((m, i) => {
  if (i > 0 || !lateJoin) return 1;
  const inMonth = tuesdays.filter((t) => t.startsWith(m));
  return inMonth.filter((t) => t >= today).length / inMonth.length;
});
const money = (c) => `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
const firstMonthCents = Math.round(95 * shares[0] * 100);
const monthlyDueToday = firstMonthCents + FEE;
const seasonTuition = Math.round(95 * shares.reduce((a, s) => a + s, 0) * 100);
// Ben pays for the season while Ava is already in the class: the 15% sibling discount beats 10% for paying in full.
const seasonDueToday = seasonTuition - Math.round(seasonTuition * 0.15) + FEE;
const laterMonths = months.slice(1);
// The family discount covers the whole family (decided Oct 13, 2026): once Ben is enrolled too, Ava's
// later months are 15% off as well, the cent rounded in the family's favor. $95 → $80.75.
const FAMILY_MONTH = TUITION - Math.ceil(TUITION * 0.15);

// ───────────── 1. A new family; children outside the ages are greyed out ─────────────
const email = `trial+${Date.now()}@example.com`;
await page.goto(`${BASE}/enroll/intro-f26-tue`);
await signIn(page, email);
await page.waitForSelector('#p-name');
await page.fill('#p-name', 'Jordan Lee');
await page.fill('#p-phone', '706-555-0199');
await page.click('button[type="submit"]');
await page.waitForSelector('text=Add a student');

async function addStudent(first, birthdate) {
  if (!(await page.locator('details.add').evaluate((d) => d.open))) await page.click('details.add summary');
  await page.fill('#s-first', first);
  await page.fill('#s-last', 'Lee');
  await page.fill('#s-bday', birthdate);
  await page.click('form:has(input[value="add-student"]) button[type="submit"]');
  await page.waitForSelector(`label.pick:has-text("${first} Lee")`);
}
const pick = (first) => page.locator(`label.pick:has-text("${first} Lee")`);
const box = (first) => pick(first).locator('input[name="studentId"]');

await addStudent('Leo', '2021-05-01');
if (!(await box('Leo').isDisabled())) fail('Leo (5) should not be selectable for ages 7–10');
if (await box('Leo').isChecked()) fail('A child outside the ages must not be ticked');
await page.waitForSelector('[data-none-fit] >> text=Intro to Theater is for ages 7–10, and Leo is outside that range');
const askHref = await page.locator('[data-none-fit] a').getAttribute('href');
if (askHref !== '/contact?topic=class&class=Intro%20to%20Theater') fail(`Ask us should carry the class: ${askHref}`);
if (await page.locator('#students button[type="submit"]').count()) fail('No Continue button when no one can be picked');
if (!(await page.locator('details.add').evaluate((d) => d.open))) fail('“Add a student” should be open when no one fits');
await shot('t1-none-fit');
step('Only child outside the ages: greyed out, a plain note, “Add a student” open and “Ask us”');

await addStudent('Ava', '2017-03-01');
if (!(await box('Ava').isChecked())) fail('Ava (fits) should be ticked when added');
await addStudent('Ben', '2018-06-15');
await addStudent('Kai', '2014-02-01');
if (!(await box('Kai').isDisabled()) || (await box('Kai').isChecked())) fail('Kai (12), just added, should be saved but greyed out and not ticked');
await pick('Kai').locator('text=Ages 7–10. Kai is 12.').waitFor();
await pick('Leo').locator('text=Ages 7–10. Leo is 5.').waitFor();
if (await page.locator('[data-none-fit]').count()) fail('The “no one fits” note should go once someone fits');
await box('Ava').check();
await box('Ben').check();
await shot('t2-picker-greyed');
await phoneCheck('t2-picker-greyed');
step('Kai (12) and Leo (5) are greyed out with “Ages 7–10. Kai is 12.” and an “Ask us” link');

// The contact page picks up the class
await page.goto(`${BASE}${askHref}`);
if ((await page.inputValue('#c-topic')) !== 'class') fail('Ask us should choose “Help picking a class”');
if ((await page.inputValue('#c-msg')) !== 'About Intro to Theater: ') fail('Ask us should start the message with the class name');
step('“Ask us” opens the contact form about Intro to Theater');

// A stale page or hand-made request can't sign Kai up
await page.goto(`${BASE}/enroll/intro-f26-tue`);
await page.evaluate(() => {
  const kai = [...document.querySelectorAll('label.pick')].find((l) => l.textContent.includes('Kai Lee')).querySelector('input');
  kai.disabled = false;
  kai.checked = true;
});
await page.click('#students button[type="submit"]');
await page.waitForSelector('#students .error:has-text("Intro to Theater is for ages 7–10, and Kai is 12.")');
if (!page.url().includes('/enroll/intro-f26-tue')) fail('The server should refuse Kai and stay on the picker');
step('The server refuses Kai with a clear message');

// ───────────── 2. Ava and Ben take the free first class ─────────────
await box('Ava').check();
await box('Ben').check();
await page.click('#students button[type="submit"]');
await page.waitForURL(/\/enroll\/details/);
for (const radio of await page.locator('input[name^="photo-"][value="yes"]').all()) await radio.check();
// The family's part (October 2026): asked once, here on the Lees' first sign-up; the later sign-ups below
// show it as a one-line summary, like each child's details.
await page.fill('#ec-0-name', 'Jordan Lee');
await page.fill('#ec-0-relationship', 'Aunt');
await page.fill('#ec-0-phone', '706-555-0142');
await page.fill('#zip', '30606');
await page.check('input[name="policies"]');
await page.click('button:has-text("Review & pay")');
await page.waitForURL(/\/enroll\/review/);
// New students start on the free first class (decided Oct 13, 2026): no tap needed, and the other plans are there.
if (!(await page.locator('input[type="radio"][name="plan"][value="trial"]').isChecked())) fail('The free first class should be pre-selected for new students');
for (const plan of ['monthly', 'full']) if (!(await page.locator(`input[name="plan"][value="${plan}"]`).count())) fail(`“${plan}” should stay one tap away`);
if ((await page.locator('tfoot td').textContent()) !== '$0') fail('The free class should have nothing due today');
await page.waitForSelector('.bill >> text=Ava: first class free');
await page.waitForSelector('.bill >> text=Ben: first class free');
await shot('t3-review-trial');
const visited = [];
page.on('framenavigated', (f) => f === page.mainFrame() && visited.push(f.url()));
await page.click('.pay button:has-text("Confirm enrollment")');
await page.waitForURL(/\/enroll\/confirmation/);
if (visited.some((u) => u.includes('/enroll/pay'))) fail('The free class must not go through the payment step');
await page.waitForSelector('h1:has-text("You’re in!")');
await page.waitForSelector('.facts >> text=Your first class is free');
await shot('t4-trial-confirmation');
await phoneCheck('t4-trial-confirmation');
await mailTo(email, /Your first class is free\. After it, you can continue/);
step('Free first class: pre-selected, $0 due, no payment step, confirmation page and email say the first class is free');

await page.goto(`${BASE}/account`);
for (const k of ['Ava', 'Ben']) {
  await page.locator('.classes li', { hasText: k }).locator('text=Free trial class').waitFor();
}
if ((await page.locator('a:has-text("Continue after the trial")').count()) !== 2) fail('Each trial child should have “Continue after the trial”');
if (await page.locator('[data-autopay]').count()) fail('No autopay after a free class');
const trialReceipt = page.locator('[data-receipts] tr', { hasText: 'Intro to Theater (free trial)' });
if ((await trialReceipt.locator('td').last().textContent()) !== '$0') fail('The free class receipt should be $0');
await shot('t5-account-trial');
step('Account: both on their free class, “Continue after the trial”, a $0 receipt and no autopay');

// Hannah sees the trials on the roster
const staff = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const hannah = await staff.newPage();
await hannah.goto(`${BASE}/account`);
await signIn(hannah, 'hannah@example.com');
if (await hannah.locator('#p-name').count()) {
  await hannah.fill('#p-name', 'Hannah Eppling');
  await hannah.fill('#p-phone', '281-798-2623');
  await hannah.click('button[type="submit"]');
}
await hannah.goto(`${BASE}/admin/intro-f26-tue`);
for (const k of ['Ava', 'Ben']) await hannah.locator('tr', { hasText: `${k} Lee` }).filter({ hasText: email }).locator('td', { hasText: /^trial$/ }).waitFor();
step('Hannah’s roster lists Ava and Ben as “trial”');

// ───────────── 3. No second free class ─────────────
async function startOrder(kids) {
  await page.goto(`${BASE}/enroll/intro-f26-tue`);
  for (const k of ['Ava', 'Ben']) if (await box(k).isEnabled()) await box(k).setChecked(kids.includes(k));
  await page.click('#students button[type="submit"]');
  await page.waitForURL(/\/enroll\/details/);
  // Details confirmed this year aren't asked again: a one-line summary with "Edit" (decided Oct 13, 2026).
  if ((await page.locator('[data-details-on-file]').count()) !== kids.length || (await page.locator('fieldset.kid').count())) fail('Details on file should be a summary, not the form');
  await page.check('input[name="policies"]');
  await page.click('button:has-text("Review & pay")');
  await page.waitForURL(/\/enroll\/review/);
  return new URL(page.url()).searchParams.get('order');
}
await page.goto(`${BASE}/enroll/intro-f26-tue`);
await pick('Ava').locator('text=Trial class taken · continue').waitFor();
const avaOrder = await startOrder(['Ava']);
// Ava's details from the free class are summarized; "Edit" brings the form back.
await page.goto(`${BASE}/enroll/details?order=${avaOrder}`);
await page.waitForSelector('[data-details-on-file] >> text=Ava Lee');
await shot('t5b-details-on-file');
await page.click('[data-details-on-file] a:has-text("Edit")');
await page.waitForSelector('fieldset.kid legend:has-text("Ava Lee")');
await page.check('input[name="policies"]');
await page.click('button:has-text("Review & pay")');
await page.waitForURL(/\/enroll\/review/);
step('Details step: Ava’s details on file show as one line with “Edit”, which opens her form');
if (await page.locator('input[name="plan"][value="trial"]').count()) fail('Ava already had her free class; it must not be offered again');
await page.goto(`${BASE}/enroll/review?order=${avaOrder}&plan=trial`);
if ((await page.locator('tfoot td').textContent()) === '$0') fail('Asking for ?plan=trial again must not make it free');
// Even a hand-made "trial" choice is priced as paid tuition.
await page.evaluate(() => (document.querySelector('.pay input[name="plan"]').value = 'trial'));
await page.click('.pay button[type="submit"]');
await page.waitForURL(/\/enroll\/pay/);
step('A child who took the free class isn’t offered another, even by asking for it');

// ───────────── 4. Ava continues on monthly autopay ─────────────
await page.goto(`${BASE}/enroll/review?order=${avaOrder}&plan=monthly`);
await page.waitForSelector('[data-autopay-consent]');
const avaDue = await page.locator('tfoot td').textContent();
if (avaDue !== money(monthlyDueToday)) fail(`Ava monthly: expected ${money(monthlyDueToday)} today, page says ${avaDue}`);
if (laterMonths.length && !(await page.locator('.later').textContent()).includes(`Then ${money(TUITION)} charged automatically`)) fail('Later months should be $95');
await shot('t6-review-monthly');
await page.click('.pay button[type="submit"]');
await page.waitForURL(/\/enroll\/pay/);
await page.click('button:has-text("Complete test payment")');
await page.waitForURL(/\/enroll\/confirmation/);
await page.waitForSelector(`.facts >> text=${money(monthlyDueToday)}`);
step(`Ava continues monthly: ${money(firstMonthCents)} for ${months[0]}${shares[0] < 1 ? ` (prorated, ${shares[0].toFixed(2)} of the month)` : ''} + $30 fee = ${avaDue} today`);

// ───────────── 5. Ben continues, paying for the season ─────────────
await startOrder(['Ben']);
await page.check('input[name="plan"][value="full"]');
await page.waitForURL(/plan=full/);
const benDue = await page.locator('tfoot td').textContent();
if (benDue !== money(seasonDueToday)) fail(`Ben season: expected ${money(seasonDueToday)} today, page says ${benDue}`);
await page.waitForSelector('.bill >> text=15% multi-class / multi-student discount');
await page.waitForSelector('text=Discounts don’t combine, so you’re getting the bigger one.');
// The season line names the discount it really gets (the 15%, not 10%) and compares it with paying monthly.
const fullLabel = await page.locator('label.plan:has(input[value="full"])').textContent();
if (!fullLabel.includes(`${money(seasonDueToday)} today with the 15% family discount`) || fullLabel.includes('10%')) fail(`The season line should name the 15%: ${fullLabel}`);
if (!fullLabel.includes('same total as paying monthly')) fail(`The season line should say it costs the same as monthly: ${fullLabel}`);
// Ben's enrollment also lowers Ava's months, and the page says so before the family pays.
if (laterMonths.length) await page.waitForSelector(`[data-family-discount] >> text=Ava’s remaining monthly payments also drop to ${money(FAMILY_MONTH)} with the 15% family discount.`);
await shot('t7-review-season');
await phoneCheck('t7-review-season');
await page.click('.pay button[type="submit"]');
await page.waitForURL(/\/enroll\/pay/);
await page.click('button:has-text("Complete test payment")');
await page.waitForURL(/\/enroll\/confirmation/);
// Family totals, read from the family's payments: today's three sign-ups, and autopay from the next 1st.
await page.waitForSelector(`[data-family-totals] >> text=${money(monthlyDueToday + seasonDueToday)}`);
await page.waitForSelector('[data-family-totals] >> text=for 3 sign-ups');
if (laterMonths.length) await page.waitForSelector(`[data-family-totals] >> text=${money(FAMILY_MONTH)} a month`);
await mailTo(email, /Ava’s remaining monthly payments also drop to/);
await shot('t7b-confirmation-family-totals');
await phoneCheck('t7b-confirmation-family-totals');
step(`Ben pays for the season: ${money(seasonTuition)} less 15% (Ava is in the class) + $30 fee = ${benDue}; the page says Ava’s months drop to ${money(FAMILY_MONTH)}`);

await page.goto(`${BASE}/account`);
for (const k of ['Ava', 'Ben']) await page.locator('.classes li', { hasText: k }).locator('text=Enrolled').waitFor();
if (await page.locator('a:has-text("Continue after the trial")').count()) fail('No “continue” link once both are enrolled');
const autopayRows = await page.locator('[data-autopay-item]').allTextContents();
// Before the family discount covered the whole family these stayed at $95; now Ben counts, so they're $80.75.
if (autopayRows.length !== laterMonths.length || !autopayRows.every((r) => r.includes('Ava') && r.includes(`Family discount (15%): −${money(TUITION - FAMILY_MONTH)}`) && r.endsWith(money(FAMILY_MONTH)))) fail(`Upcoming autopay should be Ava's ${laterMonths.length} months at ${money(FAMILY_MONTH)}, with the family discount: ${autopayRows}`);
if (laterMonths.length) await page.waitForSelector('[data-family-note] >> text=15% off for multiple students or classes');
await shot('t8-account-continued');
await phoneCheck('t8-account-continued');
step(`Account: both enrolled; Ava's ${laterMonths.length} later months at ${money(FAMILY_MONTH)} (Family discount (15%): −${money(TUITION - FAMILY_MONTH)}) on autopay, nothing for Ben`);

// ───────────── 6. Geode offers no free class ─────────────
await page.goto(`${BASE}/enroll/acting-studio-f26`);
for (const k of ['Leo', 'Ava', 'Ben']) if (!(await box(k).isDisabled())) fail(`${k} is outside Geode Acting Studio's ages (11–17)`);
await box('Kai').check();
await page.click('#students button[type="submit"]');
await page.waitForURL(/\/enroll\/details/);
await page.check('input[name^="photo-"][value="yes"]');
await page.check('input[name="policies"]');
await page.click('button:has-text("Review & pay")');
await page.waitForURL(/\/enroll\/review/);
if (await page.locator('input[name="plan"][value="trial"]').count()) fail('Geode must not offer the free first class');
// Acting Studio starts mid-month (Tue Oct 20): its first month is charged for the classes in it (decided Oct 13,
// 2026): October's 2 of 4 Tuesdays is $47.50. Worked out here from the dates, independently of src/lib/pricing.ts.
const actTue = tuesdays.filter((t) => t >= '2026-10-20' && t <= '2026-12-15');
const actLeft = actTue.filter((t) => t >= today);
if (actLeft.length) {
  const m0 = actLeft[0].slice(0, 7);
  const actLate = (new Date(`${today}T12:00:00Z`) - new Date('2026-10-20T12:00:00Z')) / 86_400_000 > 7;
  const inM0 = actTue.filter((t) => t.startsWith(m0));
  const classes = actLate ? inM0.filter((t) => t >= today).length : inM0.length;
  const tuesInOct = 4; // Oct 6, 13, 20, 27
  const share = m0 === '2026-10' ? classes / tuesInOct : actLate ? classes / inM0.length : 1;
  // Ava and Ben are enrolled, so Kai's month is 15% off too, the cent rounded in the family's favor.
  const actTuition = Math.round(95 * share * 100);
  const actDue = actTuition - Math.ceil((actTuition * 15) / 100) + FEE;
  const shown = await page.locator('tfoot td').textContent();
  if (shown !== money(actDue)) fail(`Acting Studio monthly: expected ${money(actDue)} today, page says ${shown}`);
  await page.waitForSelector(`.bill >> text=Kai: ${new Date(`${m0}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })} tuition, ${classes} ${classes === 1 ? 'class' : 'classes'}`);
  step(`Acting Studio (starts mid-month): ${money(actTuition)} for ${classes} ${m0 === '2026-10' ? 'of October’s 4 Tuesdays' : 'classes'}, less 15% (Ava and Ben are enrolled), + $30 fee = ${shown}`);
}
if ((await page.locator('tfoot td').textContent()) === '$0') fail('Geode should have tuition due');
step('Geode Acting Studio: Kai (new) is offered monthly or the season, no free class');

// ───────────── 7. The billing run charges Ava $80.75 ─────────────
if (laterMonths.length) {
  const due = `${laterMonths[0]}-01`;
  const run = await page.request.post(`${BASE}/api/billing/run?today=${due}`, { headers: { authorization: 'Bearer e2e-cron-secret' }, data: {} });
  const report = await run.json();
  if (report.charged < 1 || report.errors) fail(`Billing run on ${due}: ${JSON.stringify(report)}`);
  await page.goto(`${BASE}/account`);
  const row = page.locator('[data-receipts] tr', { hasText: 'tuition: Ava' });
  await row.waitFor();
  if ((await row.locator('td').last().textContent()) !== money(FAMILY_MONTH)) fail(`Ava’s month should be charged ${money(FAMILY_MONTH)}`);
  await row.locator('[data-family-discount]').waitFor();
  step(`The ${due} billing run charges Ava’s month: ${money(FAMILY_MONTH)}, with a receipt naming the family discount`);
}

await staff.close();
await browser.close();
console.log('\nAll free-class checks passed.');
