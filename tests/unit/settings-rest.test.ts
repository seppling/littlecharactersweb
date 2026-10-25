/**
 * The rest of Settings (docs/back-office.md → Settings: emails, reasons,
 * attendance, last season) and the small follow-ups: each setting's default
 * and saved value; email wording (placeholders filled in, the required parts
 * always there, the built-in wording when unset); a drop reason saved on
 * Remove; an absence reason on a tap (and the tap replayed); the attendance
 * start date and kinds on Needs attention; the Last season form's parsing;
 * the `refund` and `notes` attention kinds; teachers refused on every
 * settings page.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Program, Session } from '@/content/types';
import { bookingClock } from '@/lib/session-dates';
import { getDb, schema } from '@/server/db';
import { getCatalog } from '@/server/content';
import { classRows } from '@/server/classes';
import { confirmOrder, createDraftOrder, createStudent, ensureHousehold, fulfillOrder } from '@/server/family';
import { confirmationEmail } from '@/server/family';
import { payNowEmail } from '@/server/billing';
import { dropInEmail } from '@/server/drop-ins';
import { refundEmail } from '@/server/refunds';
import { offerEmail, removeChild } from '@/server/roster-changes';
import { progressWords } from '@/server/progress-notes';
import { previewEmail, sendTestEmail } from '@/server/email-previews';
import { EMAIL_DEFS, EmailWordingError, checkWording, emailDef, emailWording, fill, resetWording, saveWording, unknownPlaceholders, worded } from '@/server/email-wording';
import { DEFAULT_REASONS, ReasonError, dropReasonFrom, editReasons, reasonList, saveReasons } from '@/server/reasons';
import { baselineFromForm, dollarsToCents, formFromBaseline } from '@/server/last-season';
import { attendanceExpected, attentionAttendance, classAttendance, saveTaps, teachRoster, type Tap, type Viewer } from '@/server/attendance';
import { attentionFrom, REFUND_PENDING_HOURS, type AttentionInput } from '@/server/today';
import { getSetting, setSetting } from '@/server/settings-store';
import { requireStaff } from '@/server/staff';

const INTRO = 'intro-f26-tue'; // Tuesdays, Aug 17 – Dec 18 (src/content/seed/programs.ts)
const TUE = '2026-10-20';
const owner = 'u-settings-rest-owner';

beforeAll(async () => {
  const db = await getDb();
  await db.insert(schema.user).values({ id: owner, name: 'Hannah', email: 'hannah@example.com', emailVerified: true }).onConflictDoNothing();
});

// ───────────── Email wording ─────────────

describe('email wording: placeholders and checks', () => {
  const offer = emailDef('waitlistOffer')!;
  it('fills in placeholders, and leaves unknown ones as typed', () => {
    expect(fill('Hi {child}, {class} on {date} {nope}', { child: 'Ava', class: 'Intro', date: 'Tue' })).toBe('Hi Ava, Intro on Tue {nope}');
  });
  it('finds placeholders an email doesn’t have', () => expect(unknownPlaceholders('{child} {amount} {class}', offer)).toEqual(['amount']));
  it('refuses empty boxes and unknown placeholders, in words', () => {
    expect(() => checkWording(offer, { subject: ' ', intro: 'x' })).toThrow('Write a subject.');
    expect(() => checkWording(offer, { subject: 'x', intro: '' })).toThrow('Write the opening.');
    expect(() => checkWording(offer, { subject: 'Room for {child}', intro: 'Pay {amount}' })).toThrow(EmailWordingError);
    expect(() => checkWording(offer, { subject: 'Room for {child}', intro: 'Pay {amount}' })).toThrow('This email has no {amount}. You can use {child}, {class}, {deadline}.');
  });
  it('tidies the opening to one paragraph', () => expect(checkWording(offer, { subject: ' A  place ', intro: 'One\n\ntwo' })).toEqual({ subject: 'A place', intro: 'One two' }));
  it('every built-in wording uses only its own placeholders', () => {
    for (const d of EMAIL_DEFS) expect(unknownPlaceholders(`${d.subject} ${d.intro}`, d), d.name).toEqual([]);
  });
  it('worded: unset is the built-in email as it is', () => {
    const built = { subject: 'S', heading: 'H', lines: ['first', 'second'] };
    expect(worded(built, null, {})).toBe(built);
    expect(worded(built, { subject: 'New {x} · Little Characters', intro: 'Hello {x}' }, { x: 'Ava' }, ['fact'])).toEqual({ subject: 'New Ava · Little Characters', heading: 'New Ava', lines: ['Hello Ava', 'fact', 'second'] });
  });
});

describe('each email: built-in when unset; her words with the required parts when set', () => {
  const custom = (subject: string, intro: string) => ({ subject, intro });

  it('enrollment confirmation', () => {
    const d = { plan: 'monthly', kids: ['Ava', 'Ben'], classTitle: 'Intro to Theater', firstDate: 'Tuesday, October 20', when: 'Tuesdays, 4:30–5:30 pm, starting Tuesday, October 20 at HQ.', unit: 'month', totalCents: 9500, autopay: 'We’ll charge $95 on Nov 1.', adult: false };
    const built = confirmationEmail(d, null);
    expect(built.subject).toBe('You’re in! Intro to Theater · Little Characters');
    expect(built.heading).toBe('You’re in!');
    expect(built.lines[0]).toBe('Ava and Ben are enrolled in Intro to Theater.');
    const mine = confirmationEmail(d, custom('Welcome, {child}!', 'We can’t wait to see {child} in {class} on {date}.'));
    expect(mine.subject).toBe('Welcome, Ava and Ben!');
    expect(mine.lines[0]).toBe('We can’t wait to see Ava and Ben in Intro to Theater on Tuesday, October 20.');
    expect(mine.lines).toContain('Enrolled: Ava and Ben in Intro to Theater.');
    for (const required of [d.when, 'Paid today: $95.', d.autopay]) expect(mine.lines).toContain(required);
    expect(mine.lines.at(-1)).toMatch(/\/account$/);
    // A waitlist confirmation keeps the built-in words.
    expect(confirmationEmail({ ...d, plan: 'waitlist' }, custom('Welcome!', 'Hi')).heading).toBe('You’re on the waitlist');
  });

  it('pay now', () => {
    const i = { id: 'inst1', dueDate: '2026-11-01', label: 'November tuition: Ava, Intro to Theater', amountCents: 9500, baseAmountCents: 9500, regularAmountCents: 9500, lateFeeCents: 0, adjustments: [], lastError: 'card_declined', retryOn: '2026-11-03' } as unknown as Parameters<typeof payNowEmail>[0];
    const built = payNowEmail(i, '2026-11-01', null);
    expect(built.subject).toBe('We couldn’t charge your card · Little Characters');
    expect(built.lines[0]).toBe('We tried to charge $95 for November tuition: Ava, Intro to Theater, but your bank declined the charge.');
    // The built-in template, filled in, reads exactly as the built-in email.
    const def = emailDef('payNow')!;
    expect(fill(def.intro, { amount: '$95', payment: i.label, reason: 'your bank declined the charge' })).toBe(built.lines[0]);
    const mine = payNowEmail(i, '2026-11-01', custom('Quick note about {payment}', 'Hi! Something went wrong with your card.'));
    expect(mine.subject).toBe('Quick note about November tuition: Ava, Intro to Theater');
    expect(mine.lines[0]).toBe('Hi! Something went wrong with your card.');
    expect(mine.lines[1]).toBe('Amount due: $95 for November tuition: Ava, Intro to Theater. We couldn’t charge it because your bank declined the charge.');
    expect(mine.lines.join(' ')).toContain('/account/pay/inst1');
    expect(mine.lines.join(' ')).toContain('late fee');
  });

  it('waitlist offer', () => {
    const d = { classTitle: 'Intro to Theater', deadline: 'Wed, Oct 21 at 3:15 pm', url: 'https://example.org/enroll/intro?offer=o1', firstName: 'Olive' };
    const built = offerEmail(d, null);
    expect(built.subject).toBe('A place opened in Intro to Theater');
    expect(built.lines[0]).toBe('A place opened in Intro to Theater. Sign up by Wed, Oct 21 at 3:15 pm to take it.');
    expect(fill(emailDef('waitlistOffer')!.intro, { class: d.classTitle, deadline: d.deadline })).toBe(built.lines[0]);
    const mine = offerEmail(d, custom('Good news for {child}!', 'A spot just opened in {class}.'));
    expect(mine.subject).toBe('Good news for Olive!');
    expect(mine.lines).toEqual(['A spot just opened in Intro to Theater.', 'Sign up by Wed, Oct 21 at 3:15 pm to take the place.', d.url, built.lines[2]]);
  });

  it('drop-in confirmation', () => {
    const d = { firstName: 'Ava', classTitle: 'Intro to Theater', day: 'Tuesday, October 20', time: '4:30–5:30 pm', location: { name: 'HQ', address: '1635 W Broad St' }, priceCents: 2500, arrival: ['Bring water.'] };
    const built = dropInEmail(d, null);
    expect([built.subject, built.lines[0]]).toEqual(['Drop-in booked: Intro to Theater · Little Characters', 'Ava is booked to drop in to Intro to Theater.']);
    const mine = dropInEmail(d, custom('See you {date}!', 'Hooray, {child} is coming!'));
    expect(mine.heading).toBe('See you Tuesday, October 20!');
    expect(mine.lines.slice(0, 4)).toEqual(['Hooray, Ava is coming!', 'Booked: Ava, drop-in to Intro to Theater.', 'Tuesday, October 20, 4:30–5:30 pm at HQ, 1635 W Broad St.', 'Paid today: $25.']);
  });

  it('refund', () => {
    const built = refundEmail(2500, 'Drop-in: Intro', 'stripe', null);
    expect(built.subject).toBe('Refund of $25 for Drop-in: Intro · Little Characters');
    expect(fill(emailDef('refund')!.intro, { amount: '$25' })).toBe(built.lines[0]);
    const mine = refundEmail(2500, 'Drop-in: Intro', 'cash', custom('Your refund', 'Sorry Ava missed it.'));
    expect(mine.lines).toEqual(['Sorry Ava missed it.', 'We’ve given you $25 back by cash or check.', 'It shows in the Payments part of your family account.', 'Questions? Just reply to this email.']);
  });

  it('progress note: subject and last line', () => {
    expect(progressWords('Mila', 'Intro', null)).toEqual({ subject: 'Mila’s progress in Intro', footer: 'Sent by Little Characters about Intro' });
    expect(progressWords('Mila', null, null)).toEqual({ subject: 'Mila’s progress', footer: 'Sent by Little Characters' });
    expect(progressWords('Mila', 'Intro', custom('{child}: a note from {class}', 'With love from Hannah and the {class} team.'))).toEqual({ subject: 'Mila: a note from Intro', footer: 'With love from Hannah and the Intro team' });
  });
});

describe('email wording: saved, previewed, tested, reset', () => {
  it('reads null until saved; the built-in words saved as they are clear it', async () => {
    expect(await emailWording('waitlistOffer')).toBeNull();
    const def = emailDef('waitlistOffer')!;
    expect(await saveWording(owner, 'waitlistOffer', { subject: def.subject, intro: def.intro })).toBeNull();
    expect(await emailWording('waitlistOffer')).toBeNull();
    await saveWording(owner, 'waitlistOffer', { subject: 'Good news for {child}', intro: 'A spot opened in {class}.' });
    expect(await emailWording('waitlistOffer')).toEqual({ subject: 'Good news for {child}', intro: 'A spot opened in {class}.' });
  });
  it('the preview is the whole email, from the email’s own code, with the link still there', async () => {
    const p = previewEmail('waitlistOffer', await emailWording('waitlistOffer'), await getCatalog());
    expect(p.subject).toBe('Good news for Ava');
    const html = p.lines.map((l) => (typeof l === 'string' ? l : l.html)).join('\n');
    expect(html).toMatch(/\/enroll\/[^"]+\?offer=sample/);
    expect(html).toContain('Reply to this email to reach us.');
  });
  it('a test goes only to the staff member, marked [Test]', async () => {
    await sendTestEmail({ id: owner, email: 'hannah@example.com' }, 'waitlistOffer', await emailWording('waitlistOffer'), await getCatalog());
    const db = await getDb();
    const [m] = await db.select().from(schema.devEmail).where(eq(schema.devEmail.subject, '[Test] Good news for Ava'));
    expect(m.to).toBe('hannah@example.com');
    expect(m.text).toContain('?offer=sample');
  });
  it('back to the original', async () => {
    await resetWording(owner, 'waitlistOffer');
    expect(await emailWording('waitlistOffer')).toBeNull();
  });
});

// ───────────── Reasons ─────────────

describe('reasons', () => {
  it('defaults, then the saved list; the default list saved as is clears it', async () => {
    expect(await reasonList('drop')).toEqual(['Schedule', 'Moved', 'Cost', 'Lost interest', 'Other']);
    expect(await reasonList('absence')).toEqual(['Sick', 'Travel', 'Family', 'Other']);
    await saveReasons(owner, 'absence', ['Sick', 'School event', 'Other']);
    expect(await reasonList('absence')).toEqual(['Sick', 'School event', 'Other']);
    await saveReasons(owner, 'absence', [...DEFAULT_REASONS.absence]);
    expect(await getSetting('reasons.absence')).toBeNull();
  });
  it('add, rename, move, remove (pure), with words for mistakes', () => {
    let l = ['Schedule', 'Other'];
    l = editReasons.add(l, '  Started   soccer ');
    expect(l).toEqual(['Schedule', 'Other', 'Started soccer']);
    expect(() => editReasons.add(l, 'schedule')).toThrow('“schedule” is already on the list.');
    expect(editReasons.rename(l, 'Schedule', 'schedule change')).toEqual(['schedule change', 'Other', 'Started soccer']);
    expect(editReasons.move(l, 'Started soccer', 'up')).toEqual(['Schedule', 'Started soccer', 'Other']);
    expect(editReasons.move(l, 'Schedule', 'up')).toEqual(l);
    expect(editReasons.remove(l, 'Other')).toEqual(['Schedule', 'Started soccer']);
    expect(() => editReasons.remove(l, 'Gone')).toThrow(ReasonError);
    expect(() => editReasons.add(Array.from({ length: 20 }, (_, i) => `R${i}`), 'One more')).toThrow('Up to 20 reasons');
  });
  it('the drop reason from Remove’s form: only a listed reason; Other with words', () => {
    const list = ['Moved', 'Other'];
    expect(dropReasonFrom('Moved', 'ignored', list)).toBe('Moved');
    expect(dropReasonFrom('Other', '  started   soccer ', list)).toBe('Other: started soccer');
    expect(dropReasonFrom('Other', '', list)).toBe('Other');
    expect(dropReasonFrom('', '', list)).toBeNull();
    expect(dropReasonFrom('Hacked', '', list)).toBeNull();
  });

  it('a drop reason is saved on Remove, and stays when the list changes', async () => {
    const db = await getDb();
    const u = { id: 'u-drop-reason', name: 'Pat Drop', email: 'drop-reason@example.com', emailVerified: true };
    await db.insert(schema.user).values(u);
    const h = await ensureHousehold(u);
    await db.update(schema.household).set({ stripeCustomerId: 'cus_drop', stripePaymentMethodId: 'pm_drop' }).where(eq(schema.household.id, h.id));
    const kid = await createStudent(h.id, { firstName: 'Rowan', lastName: 'Drop', birthdate: '2017-05-05' }, u.id);
    const o = await confirmOrder(h.id, (await createDraftOrder(h.id, u.id, INTRO, [kid.id])).id, 'monthly', u.id);
    await fulfillOrder(o.id, u.id);
    const [e] = await db.select().from(schema.enrollment).where(and(eq(schema.enrollment.studentId, kid.id), eq(schema.enrollment.sessionId, INTRO)));
    const why = dropReasonFrom('Moved', '', await reasonList('drop'));
    expect(await removeChild(e.id, INTRO, 'stop', owner, why)).not.toBeNull();
    await saveReasons(owner, 'drop', ['Schedule', 'Cost']);
    const [after] = await db.select().from(schema.enrollment).where(eq(schema.enrollment.id, e.id));
    expect([after.status, after.dropReason]).toEqual(['cancelled', 'Moved']);
    expect(after.cancelledAt).toBeInstanceOf(Date);
  });
});

// ───────────── Absence reasons on taps ─────────────

describe('an absence reason on a tap', () => {
  let viewer: Viewer;
  let kid = '';
  const tap = (status: Tap['status'], markedAt: string, reason?: string, clientId = crypto.randomUUID()): Tap => ({ clientId, sessionId: INTRO, date: TUE, studentId: kid, status, note: '', markedAt, ...(reason !== undefined ? { reason } : {}) });
  const row = async () => (await (await getDb()).select().from(schema.attendance).where(and(eq(schema.attendance.sessionId, INTRO), eq(schema.attendance.classDate, TUE), eq(schema.attendance.studentId, kid))))[0];
  const now = new Date('2026-10-20T22:00:00Z');

  beforeAll(async () => {
    const db = await getDb();
    const [st] = await db.insert(schema.staff).values({ email: 'hannah@example.com', name: 'Hannah', role: 'owner' }).onConflictDoNothing().returning();
    const staffId = st?.id ?? (await db.select().from(schema.staff).where(eq(schema.staff.email, 'hannah@example.com')))[0].id;
    viewer = { userId: owner, staffId, role: 'owner' };
    const [hh] = await db.insert(schema.household).values({ name: 'Absent family' }).returning();
    const [s] = await db.insert(schema.student).values({ householdId: hh.id, firstName: 'Mo', lastName: 'Absent', birthdate: '2017-01-01' }).returning();
    kid = s.id;
    await db.insert(schema.enrollment).values({ householdId: hh.id, studentId: kid, sessionId: INTRO, programSlug: 'intro', status: 'active' });
  });

  it('saved with Absent, shown on the roster and on Hannah’s attendance list', async () => {
    const t = tap('absent', '2026-10-20T21:00:00Z', 'Sick');
    expect(await saveTaps(viewer, [t], await getCatalog(), now, TUE)).toEqual([{ clientId: t.clientId, result: 'saved' }]);
    expect((await row()).reason).toBe('Sick');
    const roster = await teachRoster(INTRO, TUE, owner, 'view', TUE);
    expect(roster.find((c) => c.studentId === kid)?.mark).toMatchObject({ status: 'absent', reason: 'Sick' });
    const { session } = (await getCatalog()).findSession(INTRO)!;
    const date = (await classAttendance(session, TUE)).dates.find((d) => d.date === TUE)!;
    expect(date.absent).toEqual([{ name: 'Mo A.', reason: 'Sick' }]);
  });
  it('the same tap replayed changes nothing', async () => {
    const t = tap('absent', '2026-10-20T21:05:00Z', 'Travel');
    await saveTaps(viewer, [t], await getCatalog(), now, TUE);
    expect(await saveTaps(viewer, [t, { ...t, reason: 'Family' }], await getCatalog(), now, TUE)).toEqual([
      { clientId: t.clientId, result: 'same' },
      { clientId: t.clientId, result: 'same' },
    ]);
    expect((await row()).reason).toBe('Travel');
  });
  it('an older tap doesn’t replace the reason; a tap without one (an older phone) clears it', async () => {
    expect((await saveTaps(viewer, [tap('absent', '2026-10-20T20:00:00Z', 'Sick')], await getCatalog(), now, TUE))[0].result).toBe('older');
    expect((await row()).reason).toBe('Travel');
    await saveTaps(viewer, [tap('absent', '2026-10-20T21:10:00Z')], await getCatalog(), now, TUE);
    expect((await row()).reason).toBeNull();
  });
  it('Present clears it, even if the phone sent one', async () => {
    await saveTaps(viewer, [tap('absent', '2026-10-20T21:20:00Z', 'Sick')], await getCatalog(), now, TUE);
    await saveTaps(viewer, [tap('present', '2026-10-20T21:30:00Z', 'Sick')], await getCatalog(), now, TUE);
    expect(await row()).toMatchObject({ status: 'present', reason: null });
  });
});

// ───────────── Attendance settings on Needs attention ─────────────

describe('attendance settings', () => {
  const session = { id: 'intro-tue', term: 'Fall 2026', days: ['Tue'], start: '16:30', end: '17:30', startDate: '2026-09-01', endDate: '2026-12-15', locationId: 'hq', status: 'open', teacher: 'Zack Newcott' } as Session;
  const wsession = { ...session, id: 'ws-tue', teacher: 'Wren' } as Session;
  const program = { slug: 'intro', title: 'Intro', kind: 'class', sessions: [session] } as unknown as Program;
  const workshop = { slug: 'ws', title: 'Workshop', kind: 'workshop', sessions: [wsession] } as unknown as Program;
  const content = {
    programs: [program, workshop],
    locationById: () => undefined,
    findSession: (id: string) => (id === session.id ? { program, session } : id === wsession.id ? { program: workshop, session: wsession } : undefined),
  };
  const rows = classRows(content, new Map([[session.id, { active: 8, trial: 0, waitlist: 0 }], [wsession.id, { active: 6, trial: 0, waitlist: 0 }]]), bookingClock(4, new Date('2026-10-20T12:00:00Z')));
  const input = (over: Partial<NonNullable<AttentionInput['attendance']>> = {}): AttentionInput => ({ payments: [], classes: rows, enrolled: [], attendance: { reports: new Set(), daysOff: [], dropIns: new Set(), missed: [], ...over } });
  // 10 pm on Tuesday Oct 20: last Tuesday's and today's classes are both not taken.
  const titles = (i: AttentionInput) => attentionFrom(i, content, TUE, new Date('2026-10-21T02:00:00Z')).filter((x) => x.kind === 'attendance').map((x) => `${x.title} ${x.action.href.slice(-10)}`);

  it('unset: every date and every kind, as before', () => {
    expect(titles(input())).toEqual(['Attendance not taken: Intro 2026-10-13', 'Attendance not taken: Workshop 2026-10-13', 'Attendance not taken: Intro 2026-10-20', 'Attendance not taken: Workshop 2026-10-20']);
  });
  it('a start date: only class dates on or after it', () => {
    expect(titles(input({ startDate: '2026-10-14' }))).toEqual(['Attendance not taken: Intro 2026-10-20', 'Attendance not taken: Workshop 2026-10-20']);
    expect(titles(input({ startDate: '2026-10-20' }))).toHaveLength(2);
  });
  it('kinds: only those raise it', () => {
    expect(titles(input({ kinds: ['class', 'camp'] }))).toEqual(['Attendance not taken: Intro 2026-10-13', 'Attendance not taken: Intro 2026-10-20']);
    expect(titles(input({ kinds: [] }))).toEqual([]);
  });
  it('attendanceExpected (pure)', () => {
    expect(attendanceExpected({}, 'party', '2020-01-01')).toBe(true);
    expect(attendanceExpected({ startDate: '2026-11-16', kinds: null }, 'class', '2026-11-15')).toBe(false);
    expect(attendanceExpected({ startDate: '2026-11-16', kinds: ['class'] }, 'class', '2026-11-16')).toBe(true);
  });
  it('attentionAttendance reads both settings: null until saved', async () => {
    expect(await attentionAttendance(TUE)).toMatchObject({ startDate: null, kinds: null });
    await setSetting(owner, 'attendance.startDate', '2026-11-16');
    await setSetting(owner, 'attendance.kinds', ['class', 'camp']);
    expect(await attentionAttendance(TUE)).toMatchObject({ startDate: '2026-11-16', kinds: ['class', 'camp'] });
    await expect(setSetting(owner, 'attendance.startDate', 'next week')).rejects.toThrow();
    await expect(setSetting(owner, 'attendance.kinds', ['recital' as 'class'])).rejects.toThrow();
  });
});

// ───────────── Last season ─────────────

describe('the Last season form', () => {
  const empty = { season: 'Spring 2026', children: '', returning: '', classTitle: [], classEnrolled: [], month: [], collected: [] };
  it('dollars to cents', () => {
    expect([dollarsToCents('9500'), dollarsToCents('$9,500.5'), dollarsToCents(' 12.34 '), dollarsToCents('0')]).toEqual([950000, 950050, 1234, 0]);
    expect([dollarsToCents('12.345'), dollarsToCents('-5'), dollarsToCents('ten'), dollarsToCents('')]).toEqual([null, null, null, null]);
  });
  it('parses rows, ignoring empty ones, months in order', () => {
    const r = baselineFromForm({
      season: '  Spring   2026 ',
      children: '1,20',
      returning: '84',
      classTitle: ['Intro to Theater', '', '  Troupe ', ''],
      classEnrolled: ['11', '', '9', ''],
      month: ['2026-04', '', '2026-03'],
      collected: ['$9,800.00', '', '9500'],
    });
    expect(r).toEqual({
      value: {
        season: 'Spring 2026',
        children: 120,
        returning: 84,
        classes: [
          { title: 'Intro to Theater', enrolled: 11 },
          { title: 'Troupe', enrolled: 9 },
        ],
        monthly: [
          { month: '2026-03', collectedCents: 950000 },
          { month: '2026-04', collectedCents: 980000 },
        ],
      },
    });
  });
  it('blank counts are left out', () => expect(baselineFromForm(empty)).toEqual({ value: { season: 'Spring 2026', classes: [], monthly: [] } }));
  it('half-filled rows and wrong numbers say what to fix', () => {
    expect(baselineFromForm({ ...empty, season: '' }).error).toBe('Name the season, like “Spring 2026”.');
    expect(baselineFromForm({ ...empty, classTitle: ['Intro'], classEnrolled: [''] }).error).toBe('Intro: how many were enrolled, as a whole number.');
    expect(baselineFromForm({ ...empty, classTitle: [''], classEnrolled: ['4'] }).error).toBe('Class row 1: add the class’s name.');
    expect(baselineFromForm({ ...empty, month: ['2026-03'], collected: ['lots'] }).error).toMatch(/^2026-03: the amount collected/);
    expect(baselineFromForm({ ...empty, month: [''], collected: ['100'] }).error).toBe('Money row 1: pick the month.');
    expect(baselineFromForm({ ...empty, children: '10', returning: '12' }).error).toMatch(/More came back/);
    expect(baselineFromForm({ ...empty, children: '2.5' }).error).toMatch(/whole number/);
  });
  it('shows a saved value again in the form', () => {
    const f = formFromBaseline({ season: 'Spring 2026', children: 5, classes: [{ title: 'Intro', enrolled: 4 }], monthly: [{ month: '2026-03', collectedCents: 950050 }] });
    expect(f).toEqual({ season: 'Spring 2026', children: '5', returning: '', classTitle: ['Intro'], classEnrolled: ['4'], month: ['2026-03'], collected: ['9500.50'] });
    expect(baselineFromForm(f).value?.monthly[0].collectedCents).toBe(950050);
  });
});

// ───────────── Needs attention: refunds and progress notes ─────────────

describe('attentionFrom: refund and notes', () => {
  const session = { id: 'intro-tue', term: 'Fall 2026', days: ['Tue'], start: '16:30', end: '17:30', startDate: '2026-09-01', endDate: '2026-12-15', locationId: 'hq', status: 'open' } as Session;
  const program = { slug: 'intro', title: 'Intro', kind: 'class', sessions: [session] } as unknown as Program;
  const content = { findSession: (id: string) => (id === session.id ? { program, session } : undefined) };
  const now = new Date('2026-10-20T16:00:00Z');
  const base: AttentionInput = { payments: [], classes: [], enrolled: [] };
  const refund = (over: Partial<NonNullable<AttentionInput['refunds']>[number]>) => ({ id: 'r1', family: 'Rivera family', householdId: 'h1', orderId: 'o1', amountCents: 2500, status: 'failed', createdAt: now, error: 'The card’s bank declined the refund.', ...over });

  it('refund: failed ones, and pending ones after a day, as alerts linking to the order', () => {
    const items = attentionFrom(
      {
        ...base,
        refunds: [
          refund({}),
          refund({ id: 'r2', status: 'pending', error: null, createdAt: new Date(now.getTime() - REFUND_PENDING_HOURS * 3_600_000), orderId: null, householdId: 'h2', family: 'Lee family' }),
          refund({ id: 'r3', status: 'pending', error: null, createdAt: new Date(now.getTime() - 3_600_000) }),
        ],
      },
      content,
      TUE,
      now,
    ).filter((i) => i.kind === 'refund');
    expect(items.map((i) => [i.tone, i.title, i.detail, i.action.href])).toEqual([
      ['alert', 'A refund didn’t go through: Rivera family', '$25 · The card’s bank declined the refund.', '/admin/payments/o1'],
      ['alert', 'A refund didn’t go through: Lee family', '$25 · still pending since Mon, Oct 19', '/admin/families/h2'],
    ]);
  });
  it('notes: one neutral item per class with drafts, linking to the class', () => {
    const items = attentionFrom({ ...base, notes: [{ sessionId: 'intro-tue', count: 3 }, { sessionId: 'intro-tue', count: 0 }] }, content, TUE, now).filter((i) => i.kind === 'notes');
    expect(items.map((i) => [i.tone, i.title, i.detail, i.action.href])).toEqual([['neutral', 'Progress notes to send: Intro', '3 drafts waiting', '/admin/classes/intro-tue#skills-h']]);
  });
  it('refunds come right after payments; notes aren’t urgent', () => {
    const items = attentionFrom({ ...base, refunds: [refund({})], notes: [{ sessionId: 'intro-tue', count: 1 }] }, content, TUE, now);
    expect(items.map((i) => i.kind)).toEqual(['refund', 'notes']);
  });
});

// ───────────── Owners only ─────────────

describe('every settings page is for owners only', () => {
  const dir = path.resolve(import.meta.dirname, '../../src/pages/admin/settings');
  const pages = ['emails.astro', 'reasons.astro', 'attendance.astro', 'last-season.astro'];
  it.each(pages)('%s checks requireStaff first, and changes need a fresh sign-in', (file) => {
    const src = readFileSync(path.join(dir, file), 'utf8');
    expect(src).toMatch(/const \{ staff, response \} = requireStaff\(Astro\.locals\);\s*if \(response\) return response;/);
    expect(src).not.toContain('requireTeacherOrOwner');
    expect(src).toContain('requireFreshStaff(Astro.locals');
  });
  it('the pages are all there', () => expect(readdirSync(dir)).toEqual(expect.arrayContaining(pages)));
  it('a teacher (signed in, not an owner) gets the Staff only 404', () => {
    const teacher = { id: 'u-t', email: 'teacher@example.com', name: 'Tee', emailVerified: true } as App.Locals['user'];
    expect(requireStaff({ user: teacher, isAdmin: false }).response?.status).toBe(404);
  });
});
