/**
 * Email wording Hannah can change (Settings → Emails; docs/back-office.md →
 * Settings). For six emails she may change the subject and the opening
 * paragraph (for the progress note, the line at the end). Everything that must
 * be right stays in each email's own code and is always there: amounts,
 * dates, links, the child's name, the pay button.
 *
 * Saved as `email.<name>` = `{ subject, intro }` (src/server/settings-store.ts).
 * Unsaved, each email is word for word what it was before this setting.
 */
import { clearSetting, getSetting, setSetting, type Wording } from './settings-store';
import type { EmailParagraph } from './email';

export type EmailName = 'welcome' | 'payNow' | 'waitlistOffer' | 'dropIn' | 'refund' | 'progressNote';

export interface EmailDef {
  name: EmailName;
  /** "Enrollment confirmation" */
  title: string;
  /** When it's sent, in a line. */
  when: string;
  /** The {placeholders} she can use, with what each becomes. */
  placeholders: Record<string, string>;
  /** The built-in wording, with placeholders. Filled in, it reads as the email does today. */
  subject: string;
  intro: string;
  /** What the second box is called: the opening, or (progress notes) the last line. */
  introLabel: string;
  /** What always comes after it, in words, so she knows what she can't break. */
  fixed: string;
}

export const EMAIL_DEFS: EmailDef[] = [
  {
    name: 'welcome',
    title: 'Enrollment confirmation',
    when: 'When a family signs up for a class or a free first class (not the waitlist).',
    placeholders: { child: 'The children’s first names', class: 'The class', date: 'The first class date' },
    subject: 'You’re in! {class} · Little Characters',
    intro: '{child} is enrolled in {class}.',
    introLabel: 'Opening',
    fixed: 'Always after it: who is enrolled, the day, time and place, what was paid and the autopay dates, what to bring, and the family account link.',
  },
  {
    name: 'payNow',
    title: 'Payment didn’t go through',
    when: 'When a monthly charge fails, and when you press Send a pay link.',
    placeholders: { amount: 'The amount due', payment: 'What it’s for', reason: 'Why it failed (“your bank declined the charge”)' },
    subject: 'We couldn’t charge your card · Little Characters',
    intro: 'We tried to charge {amount} for {payment}, but {reason}.',
    introLabel: 'Opening',
    fixed: 'Always after it: the amount and why it failed, the next try, the pay link, the late fee date, and “just reply to this email”.',
  },
  {
    name: 'waitlistOffer',
    title: 'Waitlist offer',
    when: 'When you press Offer the spot for a child on a waitlist.',
    placeholders: { child: 'The child’s first name', class: 'The class', deadline: 'When the offer ends (“Wed, Oct 21 at 3:15 pm”)' },
    subject: 'A place opened in {class}',
    intro: 'A place opened in {class}. Sign up by {deadline} to take it.',
    introLabel: 'Opening',
    fixed: 'Always after it: the sign-up date, the sign-up link, and that the place goes to the first family to sign up.',
  },
  {
    name: 'dropIn',
    title: 'Drop-in confirmation',
    when: 'When a family pays for a drop-in.',
    placeholders: { child: 'The child’s first name', class: 'The class', date: 'The date (“Tuesday, October 20”)' },
    subject: 'Drop-in booked: {class} · Little Characters',
    intro: '{child} is booked to drop in to {class}.',
    introLabel: 'Opening',
    fixed: 'Always after it: who is booked, the date, time and place, what was paid, how to arrive, and the family account link.',
  },
  {
    name: 'refund',
    title: 'Refund',
    when: 'When you refund a payment and leave “Email the family” ticked.',
    placeholders: { amount: 'The amount refunded', payment: 'What it was for' },
    subject: 'Refund of {amount} for {payment} · Little Characters',
    intro: 'We’ve refunded {amount} to the card you paid with. It takes 5–10 days to reach your card.',
    introLabel: 'Opening',
    fixed: 'Always after it: the amount and how it comes back, where to see it, and “just reply to this email”.',
  },
  {
    name: 'progressNote',
    title: 'Progress note',
    when: 'When you send a progress note to a family.',
    placeholders: { child: 'The child’s first name', class: 'The class' },
    subject: '{child}’s progress in {class}',
    intro: 'Sent by Little Characters about {class}',
    introLabel: 'Last line',
    fixed: 'Always in it: your note, the skills you ticked, and “Reply to this email to reach us.” after the last line.',
  },
];

export const emailDef = (name: string) => EMAIL_DEFS.find((d) => d.name === name);
export const isEmailName = (name: string): name is EmailName => !!emailDef(name);

export class EmailWordingError extends Error {}

const PLACEHOLDER = /\{([a-z]+)\}/g;

/** Fills in {placeholders}. One that isn't known stays as typed (saving refuses those). */
export function fill(template: string, values: Record<string, string>) {
  return template.replace(PLACEHOLDER, (m, key: string) => (key in values ? values[key] : m));
}

/** Placeholders in the text that this email doesn't have. */
export function unknownPlaceholders(text: string, def: Pick<EmailDef, 'placeholders'>) {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map((m) => m[1]).filter((k) => !(k in def.placeholders)))];
}

/** One line, no runs of spaces: the opening is one paragraph. */
const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Checks Hannah's wording and tidies it. Throws EmailWordingError with words for her. */
export function checkWording(def: EmailDef, input: { subject: string; intro: string }): Wording {
  const subject = tidy(input.subject);
  const intro = tidy(input.intro);
  if (!subject) throw new EmailWordingError('Write a subject.');
  if (!intro) throw new EmailWordingError(`Write the ${def.introLabel.toLowerCase()}.`);
  if (subject.length > 200) throw new EmailWordingError('Keep the subject under 200 characters.');
  if (intro.length > 1000) throw new EmailWordingError(`Keep the ${def.introLabel.toLowerCase()} under 1,000 characters.`);
  const unknown = unknownPlaceholders(`${subject} ${intro}`, def);
  if (unknown.length) {
    const known = Object.keys(def.placeholders).map((k) => `{${k}}`).join(', ');
    throw new EmailWordingError(`This email has no ${unknown.map((k) => `{${k}}`).join(' or ')}. You can use ${known}.`);
  }
  return { subject, intro };
}

/** Hannah's wording for an email, or null for the built-in wording. */
export function emailWording(name: EmailName): Promise<Wording | null> {
  return getSetting(`email.${name}`);
}

/** Saves her wording. The built-in wording, saved as is, clears the setting instead (so later changes to it still apply). */
export async function saveWording(userId: string, name: EmailName, input: { subject: string; intro: string }) {
  const def = emailDef(name)!;
  const w = checkWording(def, input);
  if (w.subject === def.subject && w.intro === def.intro) {
    await clearSetting(userId, `email.${name}`);
    return null;
  }
  return setSetting(userId, `email.${name}`, w);
}

/** "Back to the original wording". */
export const resetWording = (userId: string, name: EmailName) => clearSetting(userId, `email.${name}`);

/** An email before it's wrapped for sending: the subject, the heading in the email, and its paragraphs. */
export interface EmailParts {
  subject: string;
  heading: string;
  lines: EmailParagraph[];
}

/** The heading inside the email: the subject without " · Little Characters". */
export const headingOf = (subject: string) => subject.replace(/\s*·\s*Little Characters\s*$/, '');

/**
 * Pure: an email with Hannah's wording. Unset, the built-in email as it is.
 * Set, her subject (also the heading), her opening in place of the built-in
 * first paragraph, then `facts`: whatever that first paragraph carried that
 * must stay (an amount, a name), then the rest of the built-in email.
 */
export function worded(built: EmailParts, wording: Wording | null, values: Record<string, string>, facts: EmailParagraph[] = []): EmailParts {
  if (!wording) return built;
  const subject = fill(wording.subject, values);
  return { subject, heading: headingOf(subject), lines: [fill(wording.intro, values), ...facts, ...built.lines.slice(1)] };
}
