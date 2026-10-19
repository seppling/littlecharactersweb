/**
 * The family's part of the details step: emergency contacts, who may pick up,
 * ZIP and how they heard about us (src/lib/family-details.ts, src/server/family.ts).
 */
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getDb, schema } from '@/server/db';
import { confirmFamilyDetails, ensureHousehold, getFamilyDetails, updateFamilyDetails, type SessionUser } from '@/server/family';
import {
  EMERGENCY_CONTACT_REQUIRED,
  familyDetailsComplete,
  familyDetailsOnFile,
  familySummary,
  heardAboutLabel,
  personLine,
  readFamilyForm,
} from '@/lib/family-details';

const now = new Date('2026-10-19T16:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const jordan = { name: 'Jordan Lee', relationship: 'Aunt', phone: '7065550142' };

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe('when the family part is asked again', () => {
  it('summarizes details a parent confirmed this year', () => {
    const f = { emergencyContacts: [jordan], zip: '30601' };
    expect(familyDetailsOnFile({ ...f, contactsConfirmedAt: daysAgo(30) }, now)).toBe(true);
    expect(familyDetailsOnFile({ ...f, contactsConfirmedAt: daysAgo(366) }, now)).toBe(false);
    // Imported from Studio Director: on file, but nobody has confirmed it yet.
    expect(familyDetailsOnFile({ ...f, contactsConfirmedAt: null }, now)).toBe(false);
  });

  it('asks again when something required is missing', () => {
    expect(familyDetailsOnFile({ emergencyContacts: [jordan], zip: null, contactsConfirmedAt: daysAgo(1) }, now)).toBe(false);
    expect(familyDetailsComplete({ emergencyContacts: [], zip: '30601' })).toBe(!EMERGENCY_CONTACT_REQUIRED);
  });
});

describe('the one-line summary', () => {
  it('names the first emergency contact, counts pickup people, and gives the ZIP', () => {
    expect(familySummary({ emergencyContacts: [jordan], pickupPeople: [{ name: 'Sam', relationship: 'Neighbor' }, { name: 'Ola', relationship: 'Nanny' }], zip: '30601' })).toBe(
      'Emergency contact: Jordan Lee (aunt) · Pickup: 2 people · ZIP 30601',
    );
    expect(familySummary({ emergencyContacts: [jordan, { ...jordan, name: 'Kim Lee' }], pickupPeople: [{ name: 'Sam', relationship: 'Neighbor' }], zip: '30606' })).toBe(
      'Emergency contacts: Jordan Lee (aunt) +1 more · Pickup: 1 person · ZIP 30606',
    );
    expect(familySummary({ emergencyContacts: [], pickupPeople: [], zip: null })).toBe('No emergency contact · Pickup: parents only');
  });

  it('writes one line per person for the account page', () => {
    expect(personLine(jordan)).toBe('Jordan Lee, Aunt, (706) 555-0142');
    expect(personLine({ name: 'Sam', relationship: 'Neighbor' })).toBe('Sam, Neighbor');
  });

  it('labels the answer to “How did you hear about us?”', () => {
    expect(heardAboutLabel('friend')).toBe('A friend or family member');
    expect(heardAboutLabel('other: the library')).toBe('Something else: the library');
    expect(heardAboutLabel('other')).toBe('Something else');
    expect(heardAboutLabel(null)).toBe('');
  });
});

describe('reading the form', () => {
  it('skips empty rows, stores phones as 10 digits and keeps the 5-digit ZIP', () => {
    const { data, errors } = readFamilyForm(
      form({
        'ec-0-name': ' Jordan Lee ',
        'ec-0-relationship': 'Aunt',
        'ec-0-phone': '(706) 555-0142',
        'pu-1-name': 'Sam Ruiz',
        'pu-1-relationship': 'Neighbor',
        zip: '30601-1234',
        heard: 'other',
        'heard-other': 'the library',
      }),
      { askHeard: true },
    );
    expect(errors).toEqual({});
    expect(data).toEqual({
      emergencyContacts: [jordan],
      pickupPeople: [{ name: 'Sam Ruiz', relationship: 'Neighbor', phone: undefined }],
      zip: '30601',
      heardAbout: 'other: the library',
    });
  });

  it('puts each problem next to its field', () => {
    const { data, errors } = readFamilyForm(form({ 'ec-0-name': 'Jordan Lee', 'ec-0-phone': '555-0142', 'pu-2-name': 'Sam', 'pu-2-phone': 'soon', zip: '306' }), { askHeard: false });
    expect(data).toBeNull();
    expect(errors).toEqual({
      'ec-0-relationship': 'Say who they are, like Grandma or Neighbor',
      'ec-0-phone': 'Enter a phone number, like 706-555-0142',
      'pu-2-relationship': 'Say who they are, like Grandma or Neighbor',
      'pu-2-phone': 'Enter a phone number, like 706-555-0142',
      zip: 'Enter your 5-digit ZIP code',
    });
  });

  it('asks for an emergency contact while that is required', () => {
    const { errors } = readFamilyForm(form({ zip: '30601' }), { askHeard: false });
    expect(errors.ec).toBe(EMERGENCY_CONTACT_REQUIRED ? 'Add at least one emergency contact' : undefined);
  });

  it('ignores “How did you hear about us?” when it wasn’t asked, and unknown answers', () => {
    const base = { 'ec-0-name': 'Jordan Lee', 'ec-0-relationship': 'Aunt', 'ec-0-phone': '706-555-0142', zip: '30601' };
    expect(readFamilyForm(form({ ...base, heard: 'friend' }), { askHeard: false }).data?.heardAbout).toBeUndefined();
    expect(readFamilyForm(form({ ...base, heard: 'billboard' }), { askHeard: true }).data?.heardAbout).toBeUndefined();
    expect(readFamilyForm(form({ ...base, heard: 'social' }), { askHeard: true }).data?.heardAbout).toBe('social');
  });
});

describe('saving', () => {
  const kit: SessionUser = { id: 'u-kit', name: 'Kit Moss', email: 'kit@example.com', emailVerified: true };

  it('saves, confirms and audit-logs without the details themselves', async () => {
    const db = await getDb();
    await db.insert(schema.user).values(kit);
    const h = await ensureHousehold(kit);
    expect(await getFamilyDetails(h.id)).toMatchObject({ emergencyContacts: [], pickupPeople: [], zip: null, heardAbout: null, contactsConfirmedAt: null });

    await updateFamilyDetails(h.id, { emergencyContacts: [jordan], pickupPeople: [], zip: '30601', heardAbout: 'flyer' }, kit.id);
    const saved = await getFamilyDetails(h.id);
    expect(saved).toMatchObject({ emergencyContacts: [jordan], zip: '30601', heardAbout: 'flyer' });
    expect(saved?.contactsConfirmedAt).toBeInstanceOf(Date);

    // A later save without the question keeps the first answer.
    await updateFamilyDetails(h.id, { emergencyContacts: [jordan], pickupPeople: [{ name: 'Sam', relationship: 'Neighbor' }], zip: '30605' }, kit.id);
    expect(await getFamilyDetails(h.id)).toMatchObject({ heardAbout: 'flyer', zip: '30605' });

    await db.update(schema.household).set({ contactsConfirmedAt: null }).where(eq(schema.household.id, h.id));
    await confirmFamilyDetails(h.id, kit.id);
    expect((await getFamilyDetails(h.id))?.contactsConfirmedAt).toBeInstanceOf(Date);

    const log = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, h.id));
    expect(log.map((l) => l.action)).toEqual(['household.create', 'household.details.update', 'household.details.update', 'household.details.confirm']);
    expect(JSON.stringify(log)).not.toContain('Jordan');
  });
});
