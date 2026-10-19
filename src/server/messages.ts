/**
 * Staff email from the site: "Email the class" and "Email this family"
 * (docs/back-office.md → Messages).
 *
 * - One email per family, to all of that family's parent addresses, from
 *   EMAIL_FROM with reply-to EMAIL_REPLY_TO, so replies reach Hannah.
 * - Sent one at a time, paced under the email service's rate limit.
 * - The form's one-time token becomes the message's id: a double click, a
 *   refresh or the back button can't send the same message twice.
 * - Logged as one `message` row and one `message_recipient` row per address
 *   (the family pages show these), plus an audit entry without the text.
 */
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { config } from './env';
import { getDb, schema } from './db';
import { emailHtml, escapeHtml, sendEmail, usesDevMailbox, type Email } from './email';
import { audit } from './records';

const { message, messageRecipient, enrollment, household, householdMember, user } = schema;

export const SUBJECT_MAX = 200;
export const BODY_MAX = 20_000;
/** Resend allows 2 requests a second by default; one send every 600 ms stays under it. */
export const PACE_MS = usesDevMailbox ? 0 : 600;

export interface Parent {
  name: string;
  email: string;
  phone: string | null;
}

export interface AudienceFamily {
  householdId: string;
  name: string;
  parents: Parent[];
  /** Only on the waitlist for this class (no enrolled or trial child). */
  waitlist: boolean;
}

async function parentsOf(householdIds: string[]) {
  if (!householdIds.length) return new Map<string, Parent[]>();
  const db = await getDb();
  const rows = await db
    .select({ householdId: householdMember.householdId, name: user.name, email: user.email, phone: user.phone })
    .from(householdMember)
    .innerJoin(user, eq(user.id, householdMember.userId))
    .where(inArray(householdMember.householdId, householdIds))
    .orderBy(asc(householdMember.createdAt));
  const out = new Map<string, Parent[]>();
  for (const r of rows) out.set(r.householdId, [...(out.get(r.householdId) ?? []), { name: r.name, email: r.email, phone: r.phone }]);
  return out;
}

/**
 * Every family with a child signed up for the class (not cancelled), A to Z.
 * A family with any enrolled or trial child counts as enrolled; families
 * with only waitlisted children are marked `waitlist`.
 */
export async function classAudience(sessionId: string): Promise<AudienceFamily[]> {
  const db = await getDb();
  const rows = await db
    .select({ householdId: household.id, name: household.name, status: enrollment.status })
    .from(enrollment)
    .innerJoin(household, eq(household.id, enrollment.householdId))
    .where(and(eq(enrollment.sessionId, sessionId), ne(enrollment.status, 'cancelled')));
  const families = new Map<string, { name: string; waitlist: boolean }>();
  for (const r of rows) {
    const f = families.get(r.householdId) ?? { name: r.name, waitlist: true };
    if (r.status !== 'waitlist') f.waitlist = false;
    families.set(r.householdId, f);
  }
  const parents = await parentsOf([...families.keys()]);
  return [...families]
    .map(([householdId, f]) => ({ householdId, name: f.name, waitlist: f.waitlist, parents: parents.get(householdId) ?? [] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One family, for "Email this family"; null when there's no such family. */
export async function familyAudience(householdId: string): Promise<AudienceFamily | null> {
  const db = await getDb();
  const [h] = await db.select({ id: household.id, name: household.name }).from(household).where(eq(household.id, householdId));
  if (!h) return null;
  const parents = await parentsOf([h.id]);
  return { householdId: h.id, name: h.name, waitlist: false, parents: parents.get(h.id) ?? [] };
}

/**
 * Who a class email goes to: enrolled and trial families, plus waitlisted
 * ones when asked, minus any family staff unticked. `selected` null means
 * the form wasn't filled in yet (everyone in). Families without a parent
 * email are left out.
 */
export function pickRecipients(audience: AudienceFamily[], opts: { includeWaitlist: boolean; selected: Set<string> | null }) {
  return audience.filter((f) => (opts.includeWaitlist || !f.waitlist) && (!opts.selected || opts.selected.has(f.householdId)) && f.parents.length > 0);
}

/** Parent emails of these families, once each: for Gmail's BCC. */
export const emailList = (families: AudienceFamily[]) => [...new Set(families.flatMap((f) => f.parents.map((p) => p.email.toLowerCase())))];
/** Parent phone numbers of these families, once each: for a group text. */
export const phoneList = (families: AudienceFamily[]) => [...new Set(families.flatMap((f) => f.parents.map((p) => p.phone).filter((p): p is string => !!p)))];

// ───────────── Writing the email ─────────────

const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;

/** One paragraph of plain text as safe HTML: escaped, links clickable, line breaks kept. */
export function paragraphHtml(text: string) {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    out += escapeHtml(text.slice(last, m.index));
    const url = escapeHtml(m[0]);
    out += `<a href="${url}" style="color:#662299">${url}</a>`;
    last = m.index! + m[0].length;
  }
  out += escapeHtml(text.slice(last));
  return out.replace(/\n/g, '<br>');
}

/** Blank lines separate paragraphs. */
export const paragraphs = (body: string) =>
  body
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[ \t]+$/gm, '').trim())
    .filter(Boolean);

/** "Sent by Little Characters about Intro to Theater" (or just "Sent by Little Characters" for one family). */
export const footerFor = (classTitle?: string) => (classTitle ? `Sent by Little Characters about ${classTitle}` : 'Sent by Little Characters');

export function composeEmail(subject: string, body: string, footer: string) {
  const paras = paragraphs(body);
  return {
    text: `${paras.join('\n\n')}\n\n—\n${footer}. Reply to this email to reach us.`,
    html: emailHtml(subject, [...paras.map((p) => ({ html: paragraphHtml(p) })), `— ${footer}. Reply to this email to reach us.`]),
  };
}

export class MessageError extends Error {}

/** The subject and message, trimmed and checked. */
export function checkDraft(subject: string, body: string) {
  const s = subject.replace(/\s+/g, ' ').trim();
  const b = body.replace(/\r\n?/g, '\n').trim();
  if (!s) throw new MessageError('Add a subject.');
  if (s.length > SUBJECT_MAX) throw new MessageError(`Keep the subject under ${SUBJECT_MAX} characters.`);
  if (!b) throw new MessageError('Write a message.');
  if (b.length > BODY_MAX) throw new MessageError('The message is too long.');
  return { subject: s, body: b };
}

// ───────────── Sending ─────────────

type Send = (email: Email) => Promise<void>;
export interface SendOptions {
  /** Defaults to sendEmail. Tests pass a stand-in. */
  send?: Send;
  paceMs?: number;
}

const wait = (ms: number) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
/** A short reason for the log, without the email service's whole reply. */
const reason = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

/** A fresh one-time token for the review form. */
export const newSendToken = () => crypto.randomUUID();
const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validToken = (t: string) => TOKEN_RE.test(t);

/** "Send me a test": only to the staff member's own address, not logged as a message. */
export async function sendTest(staff: { id: string; email: string }, draft: { subject: string; body: string; footer: string }, opts: SendOptions = {}) {
  const { subject, body } = checkDraft(draft.subject, draft.body);
  const { text, html } = composeEmail(subject, body, draft.footer);
  await (opts.send ?? sendEmail)({ to: staff.email, subject: `[Test] ${subject}`, text, html, replyTo: config.emailReplyTo });
  await audit(staff.id, 'admin.message.test');
}

export interface SendInput {
  token: string;
  kind: 'class' | 'family' | 'tag';
  /** The class (kind 'class'), or the tag's id (kind 'tag'). */
  sessionId?: string | null;
  subject: string;
  body: string;
  footer: string;
  families: AudienceFamily[];
  staffId: string;
}

async function deliver(families: { householdId: string | null; emails: string[]; rowIds: string[] }[], email: Omit<Email, 'to'>, opts: SendOptions) {
  const db = await getDb();
  const send = opts.send ?? sendEmail;
  const pace = opts.paceMs ?? PACE_MS;
  for (const [i, f] of families.entries()) {
    if (i > 0) await wait(pace);
    try {
      await send({ ...email, to: f.emails });
    } catch (e) {
      console.error('[messages] a send failed; the reason is in message_recipient.error');
      await db.update(messageRecipient).set({ status: 'failed', error: reason(e) }).where(inArray(messageRecipient.id, f.rowIds));
    }
  }
}

/**
 * Sends a message, once per token. Returns its id, and `duplicate` when this
 * token was already used (nothing is sent again).
 *
 * Each address is written as `sent` before its email goes out and changed to
 * `failed` if the send throws. (If the server stopped mid-way, the families
 * not reached yet would wrongly show as sent; a rare case, preferred over
 * sending anyone the same email twice.)
 */
export async function sendMessage(input: SendInput, opts: SendOptions = {}): Promise<{ messageId: string; duplicate: boolean }> {
  if (!validToken(input.token)) throw new MessageError('This form has expired. Start again.');
  const { subject, body } = checkDraft(input.subject, input.body);
  const families = input.families.filter((f) => f.parents.length > 0);
  if (!families.length) throw new MessageError('Choose at least one family.');
  const db = await getDb();
  const [created] = await db
    .insert(message)
    .values({ id: input.token, kind: input.kind, sessionId: input.sessionId ?? null, subject, body, sentByUserId: input.staffId })
    .onConflictDoNothing()
    .returning({ id: message.id });
  if (!created) return { messageId: input.token, duplicate: true };

  const planned = [];
  for (const f of families) {
    const emails = [...new Set(f.parents.map((p) => p.email.toLowerCase()))];
    const rows = await db
      .insert(messageRecipient)
      .values(emails.map((email) => ({ messageId: created.id, householdId: f.householdId, email, status: 'sent' as const })))
      .returning({ id: messageRecipient.id });
    planned.push({ householdId: f.householdId, emails, rowIds: rows.map((r) => r.id) });
  }
  await audit(input.staffId, `admin.message.${input.kind}`, 'message', created.id);
  const { text, html } = composeEmail(subject, body, input.footer);
  await deliver(planned, { subject, text, html, replyTo: config.emailReplyTo }, opts);
  return { messageId: created.id, duplicate: false };
}

/**
 * "Try again for the failed ones". Each failed family is claimed (set back to
 * `sent`) before its email goes out, so two clicks can't send it twice.
 */
export async function retryFailed(messageId: string, staffId: string, footer: string, opts: SendOptions = {}) {
  const db = await getDb();
  const [m] = await db.select().from(message).where(eq(message.id, messageId));
  if (!m) throw new MessageError('That email wasn’t found.');
  const claimed = await db
    .update(messageRecipient)
    .set({ status: 'sent', error: null })
    .where(and(eq(messageRecipient.messageId, messageId), eq(messageRecipient.status, 'failed')))
    .returning({ id: messageRecipient.id, householdId: messageRecipient.householdId, email: messageRecipient.email });
  if (!claimed.length) return { retried: 0 };
  const byFamily = new Map<string, { householdId: string | null; emails: string[]; rowIds: string[] }>();
  for (const r of claimed) {
    const key = r.householdId ?? `address:${r.email}`;
    const f = byFamily.get(key) ?? { householdId: r.householdId, emails: [], rowIds: [] };
    f.emails.push(r.email);
    f.rowIds.push(r.id);
    byFamily.set(key, f);
  }
  await audit(staffId, 'admin.message.retry', 'message', messageId);
  const { text, html } = composeEmail(m.subject, m.body, footer);
  await deliver([...byFamily.values()], { subject: m.subject, text, html, replyTo: config.emailReplyTo }, opts);
  return { retried: byFamily.size };
}

// ───────────── Reading the log ─────────────

export interface SentFamily {
  householdId: string | null;
  name: string;
  emails: string[];
  failed: boolean;
}

/** One message and how it went for each family. */
export async function messageResult(messageId: string) {
  const db = await getDb();
  const [m] = await db
    .select({ id: message.id, kind: message.kind, sessionId: message.sessionId, subject: message.subject, body: message.body, createdAt: message.createdAt, senderName: user.name, senderEmail: user.email })
    .from(message)
    .leftJoin(user, eq(user.id, message.sentByUserId))
    .where(eq(message.id, messageId));
  if (!m) return null;
  const rows = await db
    .select({ householdId: messageRecipient.householdId, name: household.name, email: messageRecipient.email, status: messageRecipient.status })
    .from(messageRecipient)
    .leftJoin(household, eq(household.id, messageRecipient.householdId))
    .where(eq(messageRecipient.messageId, messageId))
    .orderBy(asc(messageRecipient.createdAt));
  const families = new Map<string, SentFamily>();
  for (const r of rows) {
    const key = r.householdId ?? `address:${r.email}`;
    const f = families.get(key) ?? { householdId: r.householdId, name: r.name ?? r.email, emails: [], failed: false };
    f.emails.push(r.email);
    if (r.status === 'failed') f.failed = true;
    families.set(key, f);
  }
  const list = [...families.values()].sort((a, b) => Number(b.failed) - Number(a.failed) || a.name.localeCompare(b.name));
  return { ...m, sender: m.senderName || m.senderEmail || 'Staff', families: list, failed: list.filter((f) => f.failed).length };
}

/** Earlier emails to a class, to a tag, or to one family (its own emails, not class ones), newest first. */
export async function earlierMessages(where: { sessionId: string } | { tagId: string } | { householdId: string }, limit = 50) {
  const db = await getDb();
  const families = sql<number>`count(distinct coalesce(${messageRecipient.householdId}, ${messageRecipient.email}))::int`;
  const failed = sql<number>`count(distinct coalesce(${messageRecipient.householdId}, ${messageRecipient.email})) filter (where ${messageRecipient.status} = 'failed')::int`;
  const filter =
    'sessionId' in where
      ? and(eq(message.kind, 'class'), eq(message.sessionId, where.sessionId))
      : 'tagId' in where
        ? and(eq(message.kind, 'tag'), eq(message.sessionId, where.tagId))
        : and(eq(message.kind, 'family'), sql`exists (select 1 from ${messageRecipient} r where r.message_id = ${message.id} and r.household_id = ${where.householdId})`);
  const rows = await db
    .select({ id: message.id, subject: message.subject, createdAt: message.createdAt, senderName: user.name, senderEmail: user.email, families, failed })
    .from(message)
    .leftJoin(messageRecipient, eq(messageRecipient.messageId, message.id))
    .leftJoin(user, eq(user.id, message.sentByUserId))
    .where(filter)
    .groupBy(message.id, user.name, user.email)
    .orderBy(desc(message.createdAt))
    .limit(limit);
  return rows.map((r) => ({ id: r.id, subject: r.subject, sentAt: r.createdAt, sender: r.senderName || r.senderEmail || 'Staff', families: r.families, failed: r.failed }));
}
