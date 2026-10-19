/**
 * A family's emergency contacts and pickup people: who to call besides the
 * parents, and who may collect the children. Shared by the family's forms and
 * the staff pages, and stored as JSON on the household (schema.ts).
 *
 * Not encrypted (like parents' phones), but never put in URLs or logs
 * (docs/security.md).
 */
import { z } from 'zod';

export const MAX_CONTACTS = 4;

/**
 * Digits only, with a leading + for numbers outside the US. US numbers keep 10
 * digits (a leading 1 or +1 is dropped), so the same number is stored one way.
 * Returns null when it isn't a phone number.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (!/^\+?[\d\s().-]+$/.test(raw)) return null;
  const plus = raw.startsWith('+');
  let digits = raw.replace(/\D/g, '');
  if (plus && digits.startsWith('1')) digits = digits.slice(1);
  else if (plus) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (!plus && digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  // US: 10 digits; area codes and exchanges don't start with 0 or 1.
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ? digits : null;
}

/** "(706) 555-0142" for US numbers; other numbers as stored. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const us = normalizePhone(phone);
  if (us && !us.startsWith('+')) return `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}`;
  return us ?? phone.trim();
}

const dialable = (phone: string) => {
  const n = normalizePhone(phone);
  if (!n) return phone.replace(/[^\d+]/g, '');
  return n.startsWith('+') ? n : `+1${n}`;
};
/** A link that calls the number: tel:+17065550142. */
export const telHref = (phone: string) => `tel:${dialable(phone)}`;
/** A link that starts a text message: sms:+17065550142. */
export const smsHref = (phone: string) => `sms:${dialable(phone)}`;

const phoneField = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) ctx.addIssue({ code: 'custom', message: 'Enter a phone number, like 706-555-0142' });
    return n ?? '';
  });

const name = z.string().trim().min(1, 'Add their name').max(80, 'Keep the name under 80 characters');
const relationship = z.string().trim().min(1, 'Say who they are, like Grandma or Neighbor').max(40, 'Keep it under 40 characters');

export const emergencyContactInput = z.object({ name, relationship, phone: phoneField });
export const pickupPersonInput = z.object({
  name,
  relationship,
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || undefined)
    .pipe(phoneField.optional()),
});

export const emergencyContactsInput = z.array(emergencyContactInput).max(MAX_CONTACTS, `Up to ${MAX_CONTACTS} people`);
export const pickupPeopleInput = z.array(pickupPersonInput).max(MAX_CONTACTS, `Up to ${MAX_CONTACTS} people`);

/** Someone to call in an emergency, besides the parents. Phone as normalizePhone stores it. */
export type EmergencyContact = { name: string; relationship: string; phone: string };
/** Someone who may pick the children up. */
export type PickupPerson = { name: string; relationship: string; phone?: string };
