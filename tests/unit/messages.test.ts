/**
 * Staff email: who gets it, one email per family, the one-time token, and
 * failures recorded and retried (src/server/messages.ts). Nothing is really
 * sent: a stand-in records each email. Sample families are made up.
 */
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { getDb, schema } from '@/server/db';
import type { Email } from '@/server/email';
import { usesDevMailbox } from '@/server/email';
import { config } from '@/server/env';
import { createStudent, ensureHousehold, type SessionUser } from '@/server/family';
import { familyEmails } from '@/server/families';
import { composerStep, type ComposerContext } from '@/server/message-composer';
import {
  checkDraft,
  classAudience,
  composeEmail,
  earlierMessages,
  emailList,
  familyAudience,
  footerFor,
  messageResult,
  MessageError,
  newSendToken,
  paragraphHtml,
  paragraphs,
  phoneList,
  pickRecipients,
  retryFailed,
  sendMessage,
  sendTest,
} from '@/server/messages';

const SESSION = 'intro-f26-tue';
const ana: SessionUser = { id: 'u-ana', name: 'Ana Rivera', email: 'ana.rivera@example.com', emailVerified: true };
const raul: SessionUser = { id: 'u-raul', name: 'Raul Rivera', email: 'Raul@Example.com', emailVerified: true };
const bo: SessionUser = { id: 'u-bo', name: 'Bo Chen', email: 'bo@example.com', emailVerified: true };
const cy: SessionUser = { id: 'u-cy', name: 'Cy Adams', email: 'cy@example.com', emailVerified: true };
const di: SessionUser = { id: 'u-di', name: 'Di Park', email: 'di@example.com', emailVerified: true };
const hannah = { id: 'u-hannah', name: 'Hannah', email: 'hannah@example.com', emailVerified: true };
let A: { id: string };
let B: { id: string };
let C: { id: string };
let D: { id: string };

/** Records emails instead of sending them; fails for any address in `failFor`. */
function outbox(failFor: string[] = []) {
  const sent: Email[] = [];
  const send = async (e: Email) => {
    const to = [e.to].flat();
    if (to.some((t) => failFor.includes(t))) throw new Error('Email failed: 422 invalid address');
    sent.push(e);
  };
  return { sent, send, paceMs: 0 };
}

beforeAll(async () => {
  const db = await getDb();
  await db.insert(schema.user).values([{ ...ana, phone: '7065550142' }, { ...raul, phone: '7065550143' }, bo, { ...cy, phone: '7065550150' }, di, hannah]);
  A = await ensureHousehold(ana);
  await db.insert(schema.householdMember).values({ householdId: A.id, userId: raul.id });
  B = await ensureHousehold(bo);
  C = await ensureHousehold(cy);
  D = await ensureHousehold(di);
  const maya = await createStudent(A.id, { firstName: 'Maya', lastName: 'Rivera', birthdate: '2018-10-20' }, ana.id);
  const leo = await createStudent(A.id, { firstName: 'Leo', lastName: 'Rivera', birthdate: '2016-01-02' }, ana.id);
  const kai = await createStudent(B.id, { firstName: 'Kai', lastName: 'Chen', birthdate: '2017-05-05' }, bo.id);
  const zoe = await createStudent(C.id, { firstName: 'Zoe', lastName: 'Adams', birthdate: '2017-03-03' }, cy.id);
  const ivy = await createStudent(D.id, { firstName: 'Ivy', lastName: 'Park', birthdate: '2017-07-07' }, di.id);
  const base = { sessionId: SESSION, programSlug: 'intro-to-theater' };
  await db.insert(schema.enrollment).values([
    { ...base, householdId: A.id, studentId: maya.id, status: 'active' },
    { ...base, householdId: A.id, studentId: leo.id, status: 'waitlist' },
    { ...base, householdId: B.id, studentId: kai.id, status: 'trial' },
    { ...base, householdId: C.id, studentId: zoe.id, status: 'waitlist' },
    { ...base, householdId: D.id, studentId: ivy.id, status: 'cancelled' },
  ]);
});

describe('who gets a class email', () => {
  it('lists each family once: enrolled and trial, then waitlist-only ones marked', async () => {
    const audience = await classAudience(SESSION);
    expect(audience.map((f) => [f.name, f.waitlist])).toEqual([
      ['Adams family', true],
      ['Chen family', false],
      ['Rivera family', false],
    ]);
    expect(audience.find((f) => f.householdId === A.id)!.parents.map((p) => p.email)).toEqual([ana.email, raul.email]);
  });

  it('sends to enrolled and trial families by default, adds the waitlist when asked, and leaves out unticked families', async () => {
    const audience = await classAudience(SESSION);
    const ids = (opts: Parameters<typeof pickRecipients>[1]) => pickRecipients(audience, opts).map((f) => f.householdId).sort();
    expect(ids({ includeWaitlist: false, selected: null })).toEqual([A.id, B.id].sort());
    expect(ids({ includeWaitlist: true, selected: null })).toEqual([A.id, B.id, C.id].sort());
    expect(ids({ includeWaitlist: true, selected: new Set([A.id, C.id]) })).toEqual([A.id, C.id].sort());
    // Ticking a waitlisted family does nothing while the waitlist is off.
    expect(ids({ includeWaitlist: false, selected: new Set([A.id, C.id]) })).toEqual([A.id]);
  });

  it('copies emails and phone numbers once each', async () => {
    const audience = await classAudience(SESSION);
    expect(emailList(audience)).toEqual(['cy@example.com', 'bo@example.com', 'ana.rivera@example.com', 'raul@example.com']);
    expect(phoneList(audience)).toEqual(['7065550150', '7065550142', '7065550143']);
  });

  it('finds one family for "Email this family"', async () => {
    expect((await familyAudience(B.id))?.parents.map((p) => p.email)).toEqual(['bo@example.com']);
    expect(await familyAudience('nope')).toBeNull();
  });
});

describe('writing the email', () => {
  it('keeps paragraphs, makes links clickable and escapes everything else', () => {
    expect(paragraphs('Hi all,\r\n\r\nRehearsal moved.\nSee you!\n\n\n')).toEqual(['Hi all,', 'Rehearsal moved.\nSee you!']);
    expect(paragraphHtml('Tickets: https://littlecharacters.org/shows?a=1&b=2. <b>Thanks</b>\nHannah')).toBe(
      'Tickets: <a href="https://littlecharacters.org/shows?a=1&amp;b=2" style="color:#662299">https://littlecharacters.org/shows?a=1&amp;b=2</a>. &lt;b&gt;Thanks&lt;/b&gt;<br>Hannah',
    );
    const { text, html } = composeEmail('Costumes', 'Bring a black shirt.\n\nThanks!', footerFor('Intro to Theater'));
    expect(text).toBe('Bring a black shirt.\n\nThanks!\n\n—\nSent by Little Characters about Intro to Theater. Reply to this email to reach us.');
    expect(html).toContain('<p style="margin:0 0 12px;font-size:15px;line-height:1.5;color:#4b4558">Bring a black shirt.</p>');
    expect(html).toContain('Sent by Little Characters about Intro to Theater');
  });

  it('needs a subject and a message', () => {
    expect(() => checkDraft('  ', 'Hi')).toThrow(MessageError);
    expect(() => checkDraft('Hi', ' \n ')).toThrow('Write a message.');
    expect(checkDraft('  Costume   day ', ' Hi \r\n')).toEqual({ subject: 'Costume day', body: 'Hi' });
  });
});

describe('sending', () => {
  it('uses the dev mailbox in tests', () => {
    expect(usesDevMailbox).toBe(true);
  });

  it('sends a test only to the staff member', async () => {
    const box = outbox();
    await sendTest(hannah, { subject: 'Costumes', body: 'Hi', footer: footerFor('Intro to Theater') }, box);
    expect(box.sent).toHaveLength(1);
    expect(box.sent[0]).toMatchObject({ to: 'hannah@example.com', subject: '[Test] Costumes', replyTo: config.emailReplyTo });
    const db = await getDb();
    expect(await db.select().from(schema.message)).toHaveLength(0);
  });

  it('sends one email per family, to all its parents, with reply-to; logs each address; and a second send with the same token does nothing', async () => {
    const box = outbox();
    const families = pickRecipients(await classAudience(SESSION), { includeWaitlist: true, selected: null });
    const token = newSendToken();
    const input = { token, kind: 'class' as const, sessionId: SESSION, subject: 'Costume day', body: 'Bring a black shirt.', footer: footerFor('Intro to Theater'), families, staffId: hannah.id };
    const first = await sendMessage(input, box);
    expect(first).toEqual({ messageId: token, duplicate: false });
    expect(box.sent.map((e) => e.to)).toEqual([['cy@example.com'], ['bo@example.com'], ['ana.rivera@example.com', 'raul@example.com']]);
    for (const e of box.sent) expect(e).toMatchObject({ subject: 'Costume day', replyTo: config.emailReplyTo });

    const again = await sendMessage(input, box);
    expect(again).toEqual({ messageId: token, duplicate: true });
    expect(box.sent).toHaveLength(3);

    const db = await getDb();
    const rows = await db.select().from(schema.messageRecipient).where(eq(schema.messageRecipient.messageId, token));
    expect(rows.map((r) => [r.email, r.householdId, r.status]).sort()).toEqual(
      [
        ['ana.rivera@example.com', A.id, 'sent'],
        ['bo@example.com', B.id, 'sent'],
        ['cy@example.com', C.id, 'sent'],
        ['raul@example.com', A.id, 'sent'],
      ].sort(),
    );
    const [m] = await db.select().from(schema.message).where(eq(schema.message.id, token));
    expect(m).toMatchObject({ kind: 'class', sessionId: SESSION, subject: 'Costume day', sentByUserId: hannah.id });
    const logged = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, token));
    expect(logged.map((l) => l.action)).toEqual(['admin.message.class']);
    // The family page's list reads the same rows.
    expect((await familyEmails(A.id)).map((e) => e.subject)).toEqual(['Costume day', 'Costume day']);
  });

  it('turns away a missing or made-up token', async () => {
    const families = pickRecipients(await classAudience(SESSION), { includeWaitlist: false, selected: null });
    await expect(sendMessage({ token: 'x', kind: 'class', sessionId: SESSION, subject: 'S', body: 'B', footer: 'F', families, staffId: hannah.id }, outbox())).rejects.toThrow(MessageError);
  });

  it('records a failed family as "didn’t send", and tries again only for the failed ones', async () => {
    const failing = outbox(['bo@example.com']);
    const families = pickRecipients(await classAudience(SESSION), { includeWaitlist: false, selected: null });
    const token = newSendToken();
    await sendMessage({ token, kind: 'class', sessionId: SESSION, subject: 'Picture day', body: 'Smile!', footer: footerFor('Intro to Theater'), families, staffId: hannah.id }, failing);
    let result = await messageResult(token);
    expect(result!.failed).toBe(1);
    expect(result!.families.map((f) => [f.name, f.failed])).toEqual([
      ['Chen family', true],
      ['Rivera family', false],
    ]);
    const db = await getDb();
    const [failedRow] = await db.select().from(schema.messageRecipient).where(eq(schema.messageRecipient.status, 'failed'));
    expect(failedRow.error).toContain('422');

    const fixed = outbox();
    expect(await retryFailed(token, hannah.id, footerFor('Intro to Theater'), fixed)).toEqual({ retried: 1 });
    expect(fixed.sent.map((e) => e.to)).toEqual([['bo@example.com']]);
    result = await messageResult(token);
    expect(result!.failed).toBe(0);
    // Nothing left to retry: a second click sends nothing.
    expect(await retryFailed(token, hannah.id, 'F', fixed)).toEqual({ retried: 0 });
    expect(fixed.sent).toHaveLength(1);

    const earlier = await earlierMessages({ sessionId: SESSION });
    expect(earlier.map((m) => [m.subject, m.families, m.failed, m.sender])).toEqual([
      ['Picture day', 2, 0, 'Hannah'],
      ['Costume day', 3, 0, 'Hannah'],
    ]);
  });
});

describe('the composer steps', () => {
  const ctx = async (): Promise<ComposerContext> => ({ kind: 'class', sessionId: SESSION, here: '/admin/classes/intro-f26-tue/email', audience: await classAudience(SESSION), footer: footerFor('Intro to Theater'), staff: hannah });
  const form = (fields: [string, string][]) => {
    const f = new FormData();
    for (const [k, v] of fields) f.append(k, v);
    return f;
  };

  it('reviews with a fresh token, sends once, and a resent form goes to the same message', async () => {
    const c = await ctx();
    const box = outbox();
    const review = await composerStep(form([['action', 'review'], ['subject', 'Show day'], ['body', 'Arrive at 5.'], ['family', A.id]]), c, box);
    if (!('state' in review)) throw new Error('expected the review step');
    expect(review.state.step).toBe('review');
    expect(review.state.recipients.map((f) => f.householdId)).toEqual([A.id]);
    const token = review.state.token!;
    const sendForm = () => form([['action', 'send'], ['token', token], ['subject', 'Show day'], ['body', 'Arrive at 5.'], ['family', A.id]]);
    expect(await composerStep(sendForm(), c, box)).toEqual({ redirect: `/admin/classes/intro-f26-tue/email?sent=${token}` });
    expect(await composerStep(sendForm(), c, box)).toEqual({ redirect: `/admin/classes/intro-f26-tue/email?sent=${token}&again=1` });
    expect(box.sent).toHaveLength(1);
  });

  it('asks for a family when every one is unticked', async () => {
    const result = await composerStep(form([['action', 'review'], ['subject', 'S'], ['body', 'B']]), await ctx(), outbox());
    expect('state' in result && result.state.error).toBe('Tick at least one family.');
  });

  it('writes a family email as kind "family" and lists it for that family', async () => {
    const audience = [(await familyAudience(B.id))!];
    const c: ComposerContext = { kind: 'family', here: `/admin/families/${B.id}/email`, audience, footer: footerFor(), staff: hannah };
    const box = outbox();
    const review = await composerStep(form([['action', 'review'], ['subject', 'Your card'], ['body', 'Please update it.']]), c, box);
    if (!('state' in review)) throw new Error('expected the review step');
    await composerStep(form([['action', 'send'], ['token', review.state.token!], ['subject', 'Your card'], ['body', 'Please update it.']]), c, box);
    expect(box.sent.map((e) => e.to)).toEqual([['bo@example.com']]);
    expect(box.sent[0].text).toContain('Sent by Little Characters. Reply');
    expect((await earlierMessages({ householdId: B.id })).map((m) => m.subject)).toEqual(['Your card']);
    expect(await earlierMessages({ householdId: A.id })).toEqual([]);
  });
});
