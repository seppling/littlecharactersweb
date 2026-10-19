/**
 * The family's part of the details step and the account's "Family details":
 * emergency contacts, who may pick up, ZIP code and how they heard about us.
 * Asked once per family (not per child), then confirmed yearly like each
 * child's care details (student-details.ts). Unit-tested in
 * tests/unit/family-details.test.ts.
 */
import { z } from 'zod';
import { MAX_CONTACTS, emergencyContactsInput, formatPhone, pickupPeopleInput, type EmergencyContact, type PickupPerson } from './contacts';

/**
 * At least one emergency contact before a family can enroll. A policy choice
 * made for Hannah to confirm (October 2026): set to false to make it optional.
 */
export const EMERGENCY_CONTACT_REQUIRED = true;

const YEAR_MS = 365 * 86_400_000;

/**
 * "How did you hear about us?" The answer is stored as the key, or
 * "other: what they wrote", so Reports can count them.
 */
export const HEARD_ABOUT = [
  { key: 'friend', label: 'A friend or family member' },
  { key: 'search', label: 'Google or another search' },
  { key: 'social', label: 'Instagram or Facebook' },
  { key: 'school', label: 'A school or teacher' },
  { key: 'event', label: 'A show or event' },
  { key: 'flyer', label: 'A flyer or poster' },
] as const;
export const HEARD_ABOUT_OTHER = 'other';

/** "A friend or family member", "Something else: the library". */
export function heardAboutLabel(stored: string | null | undefined) {
  if (!stored) return '';
  const known = HEARD_ABOUT.find((o) => o.key === stored);
  if (known) return known.label;
  const other = stored.match(/^other(?::\s*(.*))?$/s);
  if (other) return other[1] ? `Something else: ${other[1]}` : 'Something else';
  return stored;
}

export interface FamilyDetails {
  emergencyContacts: EmergencyContact[];
  pickupPeople: PickupPerson[];
  zip: string | null;
  heardAbout: string | null;
  contactsConfirmedAt: Date | null;
}

/** Everything the forms require is there (so "Looks right" can confirm it as it is). */
export function familyDetailsComplete(f: Pick<FamilyDetails, 'emergencyContacts' | 'zip'>) {
  return !!f.zip && (!EMERGENCY_CONTACT_REQUIRED || f.emergencyContacts.length > 0);
}

/** Complete, and a parent confirmed it within the past year: the details step shows a summary instead of the form. */
export function familyDetailsOnFile(f: Pick<FamilyDetails, 'emergencyContacts' | 'zip' | 'contactsConfirmedAt'>, now = new Date()) {
  return familyDetailsComplete(f) && !!f.contactsConfirmedAt && now.getTime() - f.contactsConfirmedAt.getTime() < YEAR_MS;
}

const person = (p: { name: string; relationship: string }) => (p.relationship ? `${p.name} (${p.relationship.toLowerCase()})` : p.name);

/** "Emergency contact: Jordan Lee (aunt) · Pickup: 2 people · ZIP 30601" */
export function familySummary(f: Pick<FamilyDetails, 'emergencyContacts' | 'pickupPeople' | 'zip'>) {
  const [first, ...more] = f.emergencyContacts;
  const n = f.pickupPeople.length;
  return [
    first ? `Emergency contact${more.length ? 's' : ''}: ${person(first)}${more.length ? ` +${more.length} more` : ''}` : 'No emergency contact',
    n ? `Pickup: ${n} ${n === 1 ? 'person' : 'people'}` : 'Pickup: parents only',
    f.zip ? `ZIP ${f.zip}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** "Jordan Lee, aunt, (706) 555-0142": one line per person on the account page. */
export function personLine(p: { name: string; relationship: string; phone?: string }) {
  return [p.name, p.relationship, formatPhone(p.phone)].filter(Boolean).join(', ');
}

const zip = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const m = v.match(/^(\d{5})(?:-?\d{4})?$/);
    if (!m) ctx.addIssue({ code: 'custom', message: 'Enter your 5-digit ZIP code' });
    return m?.[1] ?? '';
  });

export const familyDetailsInput = z.object({
  emergencyContacts: EMERGENCY_CONTACT_REQUIRED ? emergencyContactsInput.min(1, 'Add at least one emergency contact') : emergencyContactsInput,
  pickupPeople: pickupPeopleInput,
  zip,
  /** Left out when the family already answered, or skipped it. */
  heardAbout: z.string().trim().max(120).optional(),
});
export type FamilyDetailsInput = z.infer<typeof familyDetailsInput>;

/**
 * The form's field names: one row per person, `ec-0-name`, `ec-0-relationship`,
 * `ec-0-phone`, and `pu-0-…` for pickup people. A row left empty is skipped.
 */
export const rowField = (list: 'ec' | 'pu', i: number, key: 'name' | 'relationship' | 'phone') => `${list}-${i}-${key}`;

/**
 * Reads the family form. `askHeard` is false when the question wasn't shown.
 * Errors are keyed by field name (`ec-0-phone`, `zip`), plus `ec` and `pu`
 * for the lists themselves.
 */
export function readFamilyForm(form: FormData, { askHeard }: { askHeard: boolean }) {
  const text = (k: string) => String(form.get(k) ?? '').trim();
  const rows = (list: 'ec' | 'pu') =>
    Array.from({ length: MAX_CONTACTS }, (_, i) => ({
      i,
      name: text(rowField(list, i, 'name')),
      relationship: text(rowField(list, i, 'relationship')),
      phone: text(rowField(list, i, 'phone')),
    })).filter((r) => r.name || r.relationship || r.phone);
  const ec = rows('ec');
  const pu = rows('pu');
  const heard = text('heard');
  const heardOther = text('heard-other').slice(0, 100);
  const heardAbout = !askHeard || !heard ? undefined : heard === HEARD_ABOUT_OTHER ? (heardOther ? `other: ${heardOther}` : 'other') : HEARD_ABOUT.some((o) => o.key === heard) ? heard : undefined;

  const parsed = familyDetailsInput.safeParse({
    emergencyContacts: ec.map(({ name, relationship, phone }) => ({ name, relationship, phone })),
    pickupPeople: pu.map(({ name, relationship, phone }) => ({ name, relationship, phone })),
    zip: text('zip'),
    heardAbout,
  });
  const errors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const [list, index, key] = issue.path;
      const rowsOf = list === 'emergencyContacts' ? ec : list === 'pickupPeople' ? pu : null;
      const prefix = list === 'emergencyContacts' ? 'ec' : 'pu';
      const name = rowsOf && typeof index === 'number' && typeof key === 'string' ? rowField(prefix, rowsOf[index].i, key as 'name') : rowsOf ? prefix : String(list);
      errors[name] ??= issue.message;
    }
  }
  return parsed.success ? { data: parsed.data, errors } : { data: null, errors };
}
