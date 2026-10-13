/**
 * Leads from the public site's forms: contact messages, the newsletter signup,
 * "tell me when registration opens" on class pages, and the summer camp list.
 * Every submission is saved (staff see them at /admin/leads); contact messages
 * are also emailed to Hannah with the family's address as the reply-to, and
 * the sender gets an "on its way" email (see senderCopy).
 */
import { and, count, desc, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from './db';
import { emailHtml, sendEmail } from './email';
import { config } from './env';
import { topicLabel } from '@/lib/contact-topics';

export const LEAD_KINDS = ['contact', 'newsletter', 'notify', 'camps'] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];

const text = (max: number) => z.string().trim().max(max).optional().default('');

export const leadInput = z
  .object({
    kind: z.enum(LEAD_KINDS),
    email: z.string().trim().toLowerCase().max(200).pipe(z.email('Please enter a valid email address.')),
    name: text(100),
    message: text(4000),
    topic: text(60),
    ages: text(60),
    program: text(80),
    /** "My child will miss a class": who, which class, and when. */
    child: text(100),
    className: text(100),
    date: z.union([z.literal(''), z.iso.date('Please choose the date as YYYY-MM-DD.')]).optional().default(''),
    /** Honeypot: hidden from people, filled in by bots. */
    website: text(200),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'contact' && !v.name) ctx.addIssue({ code: 'custom', path: ['name'], message: 'Please add your name.' });
    // An absence note can be just the child, the class and the date.
    const absence = v.topic === 'absence' && v.child && v.className && v.date;
    if (v.kind === 'contact' && !v.message && !absence) ctx.addIssue({ code: 'custom', path: ['message'], message: 'Please add a message.' });
  });

export type LeadInput = z.infer<typeof leadInput>;

/** Who sent a contact message, if they were signed in (from the session, never from the form). */
export interface Sender {
  email: string;
  emailVerified: boolean;
  name?: string | null;
}

/** What the sender's copy says about replies; both come from the site settings. */
export interface CopyOptions {
  sender?: Sender | null;
  /** Hannah's reply-time line, like "We reply within 2 school days." Empty: say nothing. */
  replyTime?: string;
  phone?: string;
}

/** At most this many "on its way" notes a day to an address that isn't a signed-in parent's. */
const ANON_COPIES_PER_DAY = 3;

/** Saves the lead (and emails contact messages). Returns false for bots and quick repeats, which are quietly dropped. */
export async function saveLead(input: LeadInput, opts: CopyOptions = {}) {
  if (input.website) return false;
  const db = await getDb();
  // Someone double-clicking Send shouldn't produce two messages.
  const [recent] = await db
    .select({ id: schema.lead.id })
    .from(schema.lead)
    .where(and(eq(schema.lead.email, input.email), eq(schema.lead.kind, input.kind), gt(schema.lead.createdAt, new Date(Date.now() - 60_000))))
    .limit(1);
  if (recent) return false;

  const absence = input.topic === 'absence';
  const details = Object.fromEntries(
    Object.entries({
      topic: input.topic,
      ages: input.ages,
      program: input.program,
      ...(absence ? { child: input.child, className: input.className, date: input.date } : {}),
    }).filter(([, v]) => v),
  );
  await db.insert(schema.lead).values({ kind: input.kind, email: input.email, name: input.name || null, message: input.message || null, details });

  if (input.kind === 'contact') {
    const about = [
      input.topic ? `About: ${topicLabel(input.topic)}` : '',
      absence && input.child ? `Child: ${input.child}` : '',
      absence && input.className ? `Class: ${input.className}` : '',
      absence && input.date ? `Date: ${longDate(input.date)}` : '',
      input.ages ? `Child’s age(s): ${input.ages}` : '',
    ].filter(Boolean);
    const lines = [`From: ${input.name} <${input.email}>`, ...about, input.message, 'Reply to this email to answer them directly.'].filter(Boolean);
    await sendEmail({
      to: config.leadsTo,
      replyTo: input.email,
      subject: `Website message from ${input.name}${input.topic ? ` (${input.topic})` : ''}`,
      text: lines.join('\n\n'),
      html: emailHtml('New message from the website', lines),
    });
    // The message has reached Hannah; a failed copy mustn't make the form say it didn't.
    await senderCopy(input, about, opts).catch((e) => console.error('Contact copy failed', e));
  }
  return true;
}

/**
 * The sender's "on its way" email. Anyone can type any address into the form,
 * so only a signed-in parent writing from their own verified address gets
 * their message repeated back. Anyone else gets a short note with nothing they
 * typed in it (so the form can't send someone else our email with a stranger's
 * words in it), at most a few a day per address.
 */
async function senderCopy(input: LeadInput, about: string[], opts: CopyOptions) {
  const own = !!opts.sender?.emailVerified && opts.sender.email.toLowerCase() === input.email;
  if (!own) {
    const db = await getDb();
    const [{ n }] = await db
      .select({ n: count() })
      .from(schema.lead)
      .where(and(eq(schema.lead.email, input.email), eq(schema.lead.kind, 'contact'), gt(schema.lead.createdAt, new Date(Date.now() - 86_400_000))));
    if (n > ANON_COPIES_PER_DAY) return;
  }
  const reply = opts.replyTime?.trim();
  const urgent = opts.phone ? `If it’s urgent, call us at ${opts.phone}.` : '';
  const lines = own
    ? [
        `Hi ${input.name.split(' ')[0] || 'there'}, thanks for writing. Your message is on its way to us, and we’ll reply by email.${reply ? ` ${reply}` : ''}`,
        ...about,
        input.message ? `Your message:\n${input.message}` : '',
        urgent,
      ]
    : [`Thanks for writing to Little Characters. Your message is on its way to us, and we’ll reply by email.${reply ? ` ${reply}` : ''}`, urgent, 'Didn’t write to us? You can ignore this email.'];
  const body = lines.filter(Boolean);
  await sendEmail({
    to: input.email,
    subject: 'Your message to Little Characters is on its way',
    text: body.join('\n\n'),
    html: emailHtml('Your message is on its way', body),
  });
}

const longDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });

export async function listLeads(limit = 200) {
  const db = await getDb();
  return db.select().from(schema.lead).orderBy(desc(schema.lead.createdAt)).limit(limit);
}
