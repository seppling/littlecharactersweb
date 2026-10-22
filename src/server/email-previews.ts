/**
 * Settings → Emails' Preview and "Send me a test": each email built by its
 * own code (the same functions that send it) from made-up sample details, with
 * the wording being edited. Nothing here touches a family or a payment.
 */
import type { SiteContent } from '@/content/site-content';
import type { Program, Session } from '@/content/types';
import { dayList, timeRange } from '@/lib/format';
import { formatCents, todayInAthens } from '@/lib/pricing';
import { arrivalLines } from '@/lib/program-fit';
import { payNowEmail } from './billing';
import { dropInEmail } from './drop-ins';
import { emailHtml, sendEmail, type EmailParagraph } from './email';
import type { EmailName, EmailParts } from './email-wording';
import { config } from './env';
import { confirmationEmail } from './family';
import { composeProgressNote, progressWords } from './progress-notes';
import { footerFor, paragraphHtml, paragraphs } from './messages';
import { audit } from './records';
import { refundEmail } from './refunds';
import { offerDeadline, offerEmail } from './roster-changes';
import type { schema } from './db';
import type { Wording } from './settings-store';

type Catalog = Pick<SiteContent, 'programs' | 'locationById' | 'site'>;

/** The sample child: made up. */
export const SAMPLE_CHILD = 'Ava';

const day = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
const plusDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** A weekly class from the content for the sample (the first one with a time), so the preview reads like the real thing. */
function sampleClass(content: Catalog): { program: Program | null; session: Session | null; title: string; place: { name: string; address: string } | null } {
  for (const program of content.programs) {
    if (program.kind !== 'class') continue;
    const session = program.sessions.find((s) => s.start && s.end && s.days.length);
    if (!session) continue;
    const loc = content.locationById(session.locationId);
    return { program, session, title: program.title, place: loc ? { name: loc.name, address: loc.address.join(', ') } : null };
  }
  return { program: null, session: null, title: 'Intro to Theater', place: null };
}

/** Message-style emails (sent through the staff composer): the subject as heading, links clickable, and the footer line. */
function messageParts(subject: string, body: string, footer: string): EmailParts {
  return { subject, heading: subject, lines: [...paragraphs(body).map((p) => ({ html: paragraphHtml(p) })), `— ${footer}. Reply to this email to reach us.`] };
}

/** The whole email `name` with sample details and this wording (null: the built-in wording). */
export function previewEmail(name: EmailName, wording: Wording | null, content: Catalog, today = todayInAthens()): EmailParts {
  const c = sampleClass(content);
  const next = plusDays(today, 7);
  const time = c.session ? timeRange(c.session.start, c.session.end) : '4–5 pm';
  switch (name) {
    case 'welcome':
      return confirmationEmail(
        {
          plan: 'monthly',
          kids: [SAMPLE_CHILD],
          classTitle: c.title,
          firstDate: day(next),
          when: `${c.session ? dayList(c.session.days) : 'Thursdays'}, ${time}, starting ${day(next)}${c.place ? ` at ${c.place.name}, ${c.place.address}` : ''}.`,
          unit: 'month',
          totalCents: 9500,
          autopay: `We’ll charge ${formatCents(9500)} to your saved card on ${day(plusDays(today, 30), { month: 'short', day: 'numeric' })} and ${day(plusDays(today, 60), { month: 'short', day: 'numeric' })}, and email a receipt each time.`,
          adult: false,
        },
        wording,
      );
    case 'payNow': {
      const due = plusDays(today, -1);
      const sample = {
        id: 'sample',
        dueDate: due,
        label: `${day(due, { month: 'long' })} tuition: ${SAMPLE_CHILD}, ${c.title}`,
        amountCents: 9500,
        baseAmountCents: 9500,
        regularAmountCents: 9500,
        lateFeeCents: 0,
        adjustments: [],
        lastError: 'card_declined',
        retryOn: plusDays(today, 2),
      } as unknown as typeof schema.installment.$inferSelect;
      return payNowEmail(sample, today, wording);
    }
    case 'waitlistOffer':
    {
      const url = new URL(`/enroll/${c.session?.id ?? 'class'}?offer=sample`, config.siteUrl).toString();
      const e = offerEmail({ classTitle: c.title, deadline: offerDeadline(new Date(Date.now() + 48 * 3_600_000)), url, firstName: SAMPLE_CHILD }, wording);
      return messageParts(e.subject, e.lines.join('\n\n'), footerFor());
    }
    case 'dropIn':
      return dropInEmail(
        {
          firstName: SAMPLE_CHILD,
          classTitle: c.title,
          day: day(next),
          time,
          location: c.place,
          priceCents: 2500,
          arrival: c.program ? arrivalLines(c.program, content.site.parking) : [],
        },
        wording,
      );
    case 'refund':
      return refundEmail(2500, `Drop-in: ${c.title}, ${day(today, { weekday: 'short', month: 'short', day: 'numeric' })} (${SAMPLE_CHILD})`, 'stripe', wording);
    case 'progressNote': {
      const words = progressWords(SAMPLE_CHILD, c.title, wording);
      const body = composeProgressNote(`${SAMPLE_CHILD} has grown so much this term. Confident on stage and a great scene partner.`, ['Projects voice to the back row'], ['Stays in character']);
      return messageParts(words.subject, body, words.footer);
    }
  }
}

const plain = (p: EmailParagraph) => (typeof p === 'string' ? p : p.html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"));

/** "Send me a test": the sample email to the staff member's own address, "[Test]" in the subject. */
export async function sendTestEmail(staff: { id: string; email: string }, name: EmailName, wording: Wording | null, content: Catalog) {
  const e = previewEmail(name, wording, content);
  await sendEmail({ to: staff.email, subject: `[Test] ${e.subject}`, text: `${e.heading}\n\n${e.lines.map(plain).join('\n\n')}`, html: emailHtml(e.heading, e.lines), replyTo: config.emailReplyTo });
  await audit(staff.id, 'admin.email_wording.test', 'staff_setting', `email.${name}`);
}
