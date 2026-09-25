/**
 * Leads from the public site's forms: contact messages, the newsletter signup,
 * "tell me when registration opens" on class pages, and the summer camp list.
 * Every submission is saved (staff see them at /admin/leads); contact messages
 * are also emailed to Hannah with the family's address as the reply-to.
 */
import { and, desc, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from './db';
import { emailHtml, sendEmail } from './email';
import { config } from './env';

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
    /** Honeypot: hidden from people, filled in by bots. */
    website: text(200),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'contact' && !v.name) ctx.addIssue({ code: 'custom', path: ['name'], message: 'Please add your name.' });
    if (v.kind === 'contact' && !v.message) ctx.addIssue({ code: 'custom', path: ['message'], message: 'Please add a message.' });
  });

export type LeadInput = z.infer<typeof leadInput>;

/** Saves the lead (and emails contact messages). Returns false for bots and quick repeats, which are quietly dropped. */
export async function saveLead(input: LeadInput) {
  if (input.website) return false;
  const db = await getDb();
  // Someone double-clicking Send shouldn't produce two messages.
  const [recent] = await db
    .select({ id: schema.lead.id })
    .from(schema.lead)
    .where(and(eq(schema.lead.email, input.email), eq(schema.lead.kind, input.kind), gt(schema.lead.createdAt, new Date(Date.now() - 60_000))))
    .limit(1);
  if (recent) return false;

  const details = Object.fromEntries(Object.entries({ topic: input.topic, ages: input.ages, program: input.program }).filter(([, v]) => v));
  await db.insert(schema.lead).values({ kind: input.kind, email: input.email, name: input.name || null, message: input.message || null, details });

  if (input.kind === 'contact') {
    const lines = [
      `From: ${input.name} <${input.email}>`,
      input.topic ? `About: ${input.topic}` : '',
      input.ages ? `Child’s age(s): ${input.ages}` : '',
      input.message,
      'Reply to this email to answer them directly.',
    ].filter(Boolean);
    await sendEmail({
      to: config.leadsTo,
      replyTo: input.email,
      subject: `Website message from ${input.name}${input.topic ? ` (${input.topic})` : ''}`,
      text: lines.join('\n\n'),
      html: emailHtml('New message from the website', lines),
    });
  }
  return true;
}

export async function listLeads(limit = 200) {
  const db = await getDb();
  return db.select().from(schema.lead).orderBy(desc(schema.lead.createdAt)).limit(limit);
}
