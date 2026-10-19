import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getDb, schema } from '@/server/db';
import { decrypt } from '@/server/crypto';
import { importFamilies, matchColumns, parseBirthdate, parseCsv, readFamilies, uninvitedImportedGuardians } from '@/server/studio-director';

describe('CSV parsing', () => {
  it('handles quotes, commas and newlines inside fields, CRLF and a BOM', () => {
    const text = '﻿Name,Notes\r\n"Rivera, Ana","Says ""hi""\nsecond line"\r\nBo,plain\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ['Name', 'Notes'],
      ['Rivera, Ana', 'Says "hi"\nsecond line'],
      ['Bo', 'plain'],
    ]);
  });

  it('reads tab-separated exports too', () => {
    expect(parseCsv('A\tB\n1\t2')).toEqual([
      ['A', 'B'],
      ['1', '2'],
    ]);
  });
});

describe('birthdays', () => {
  const today = new Date('2026-09-25T12:00:00Z');
  it.each([
    ['2016-03-09', '2016-03-09'],
    ['3/9/2016', '2016-03-09'],
    ['03/09/16', '2016-03-09'],
    ['3-9-2016', '2016-03-09'],
    ['11/2/95', '1995-11-02'],
    ['March 9, 2016', '2016-03-09'],
  ])('%s → %s', (raw, iso) => expect(parseBirthdate(raw, today)).toBe(iso));

  it.each(['', '13/45/2015', '2/30/2016', 'soon', '1/1/2030'])('rejects "%s"', (raw) => expect(parseBirthdate(raw, today)).toBeNull());
});

describe('column matching', () => {
  it('reads plain "First Name" as the parent in a family report and the student in a student report', () => {
    expect(matchColumns(['Family ID', 'First Name', 'Last Name', 'Email'])).toMatchObject({ familyId: 0, guardianFirst: 1, guardianLast: 2, email: 3 });
    expect(matchColumns(['Family ID', 'First Name', 'Last Name', 'Birth Date'])).toMatchObject({ familyId: 0, studentFirst: 1, studentLast: 2, birthdate: 3 });
  });

  it('lets a person point a field at any column', () => {
    expect(matchColumns(['Kid', 'Mom Email'], { studentName: 'Kid', email: 'mom email' })).toMatchObject({ studentName: 0, email: 1 });
    expect(() => matchColumns(['A'], { email: 'Nope' })).toThrow(/no column named "Nope"/);
  });
});

describe('grouping rows into families', () => {
  it('links a student report to a family report by family ID', () => {
    const { families, problems } = readFamilies([
      { name: 'families.csv', text: 'Family ID,First Name,Last Name,Email,Parent 2 Email\n7,Ana,Rivera,ANA@example.com,luis@example.com' },
      { name: 'students.csv', text: 'Family ID,First Name,Last Name,DOB,Allergies\n7,Maya,Rivera,3/9/2016,Peanuts\n7,Maya,Rivera,3/9/2016,Peanuts\n7,Leo,,7/21/2019,' },
    ]);
    expect(problems).toEqual([]);
    expect(families).toHaveLength(1);
    expect(families[0].guardians.map((g) => g.email)).toEqual(['ana@example.com', 'luis@example.com']);
    expect(families[0].students.map((s) => `${s.firstName} ${s.lastName}`)).toEqual(['Maya Rivera', 'Leo Rivera']);
  });

  it('handles one combined report keyed by parent email, with two addresses in a cell', () => {
    const { families } = readFamilies([
      {
        name: 'roster.csv',
        text: 'Student Name,Birthday,Parent Name,Email\n"Okafor, Zara",11/2/2015,Chidi Okafor,chidi@example.com; ngozi@example.com\nAda Okafor,1/5/2018,Chidi Okafor,chidi@example.com',
      },
    ]);
    expect(families).toHaveLength(1);
    expect(families[0].guardians).toMatchObject([{ name: 'Chidi Okafor', email: 'chidi@example.com' }, { email: 'ngozi@example.com' }]);
    expect(families[0].students.map((s) => s.firstName)).toEqual(['Zara', 'Ada']);
  });

  it('reports rows it can’t use instead of guessing', () => {
    const { families, problems } = readFamilies([
      { name: 'x.csv', text: 'Family ID,First Name,Email\n1,Pat,\n2,Jo,jo@example\n3,Kim,kim@example.com' },
      { name: 'y.csv', text: 'Family ID,First Name,Birth Date\n,Lost,1/1/2018\n3,Sam,someday' },
    ]);
    expect(families.map((f) => f.label)).toEqual(['3']);
    expect(problems.map((p) => p.where).sort()).toEqual(['x.csv:2', 'x.csv:3', 'x.csv:3', 'y.csv:2', 'y.csv:3'].sort());
  });
});

describe('importing', () => {
  const files = [
    { name: 'families.csv', text: 'Family ID,First Name,Last Name,Email,Cell Phone\n1,Ana,Rivera,ana@example.com,706-555-0101\n2,Chidi,Okafor,chidi@example.com,' },
    { name: 'students.csv', text: 'Family ID,First Name,Last Name,Birth Date,Allergies\n1,Maya,Rivera,3/9/2016,Peanuts\n1,Leo,Rivera,7/21/2019,\n2,Zara,Okafor,11/2/2015,' },
  ];

  it('previews without writing anything', async () => {
    const report = await importFamilies(readFamilies(files).families, { dryRun: true });
    expect(report.households.created).toBe(2);
    expect(report.students.created).toBe(3);
    const db = await getDb();
    expect(await db.select().from(schema.user)).toHaveLength(0);
    expect(await db.select().from(schema.auditLog)).toHaveLength(0);
  });

  it('merges into a family that already signed up on the new site', async () => {
    const db = await getDb();
    // Chidi signed up on the new portal before the import ran.
    await db.insert(schema.user).values({ id: 'u-chidi', name: 'Chidi Okafor', email: 'chidi@example.com', emailVerified: true });
    const [h] = await db.insert(schema.household).values({ name: 'Okafor family' }).returning();
    await db.insert(schema.householdMember).values({ householdId: h.id, userId: 'u-chidi' });

    const report = await importFamilies(readFamilies(files).families, { dryRun: false });
    expect(report.households).toEqual({ created: 1, matched: 1 });
    expect(report.guardians).toEqual({ created: 1, matched: 1 });
    expect(report.students).toEqual({ created: 3, matched: 0 });
    expect((await db.select().from(schema.student).where(eq(schema.student.householdId, h.id))).map((s) => s.firstName)).toEqual(['Zara']);
  });

  it('creates unverified accounts that only a code sent to that email can open', async () => {
    const db = await getDb();
    const [ana] = await db.select().from(schema.user).where(eq(schema.user.email, 'ana@example.com'));
    expect(ana).toMatchObject({ name: 'Ana Rivera', emailVerified: false, phone: '706-555-0101' });
    expect(await db.select().from(schema.account)).toHaveLength(0); // no passwords, no sessions
    expect(await db.select().from(schema.session)).toHaveLength(0);
    expect((await uninvitedImportedGuardians()).map((g) => g.email)).toEqual(['ana@example.com']);
  });

  it('encrypts allergy notes and asks families to re-confirm details', async () => {
    const db = await getDb();
    const [maya] = await db.select().from(schema.student).where(eq(schema.student.firstName, 'Maya'));
    expect(maya.allergiesEnc).toMatch(/^v1:/);
    expect(maya.allergiesEnc).not.toContain('Peanuts');
    expect(decrypt(maya.allergiesEnc)).toBe('Peanuts');
    expect(maya.detailsConfirmedAt).toBeNull();
    expect(maya.photoConsent).toBeNull();
  });

  it('is safe to run twice', async () => {
    const report = await importFamilies(readFamilies(files).families, { dryRun: false });
    expect(report.households.created + report.guardians.created + report.students.created).toBe(0);
    expect(report.students.matched).toBe(3);
  });
});

describe('emergency contacts and ZIP codes', () => {
  it('recognizes the columns', () => {
    expect(matchColumns(['Family ID', 'Email', 'Zip Code', 'Emergency Contact', 'Emergency Phone', 'Emergency Contact Relationship'])).toMatchObject({
      zip: 2,
      emergencyName: 3,
      emergencyPhone: 4,
      emergencyRelationship: 5,
    });
    expect(matchColumns(['Email', 'Postal Code', 'Emergency Contact Name', 'Emergency Contact Phone'])).toMatchObject({ zip: 1, emergencyName: 2, emergencyPhone: 3 });
  });

  it('keeps one of each contact per family, with the phone stored as 10 digits', () => {
    const { families, problems } = readFamilies([
      { name: 'families.csv', text: 'Family ID,Email,Zip,Emergency Contact,Emergency Phone,Emergency Relationship\n8,pat@example.com,30605-1234,Jordan Quill,(706) 555-0188,Aunt' },
      { name: 'students.csv', text: 'Family ID,First Name,Last Name,Birth Date,Emergency Contact,Emergency Phone\n8,Juno,Quill,5/5/2017,Jordan Quill,706-555-0188\n8,Remy,Quill,6/6/2019,Sam Quill,not a number' },
    ]);
    expect(families[0].zip).toBe('30605');
    expect(families[0].emergencyContacts).toEqual([{ name: 'Jordan Quill', relationship: 'Aunt', phone: '7065550188' }]);
    // The report names the row, never the person or the number.
    expect(problems).toEqual([{ where: 'students.csv:3', reason: 'emergency contact phone not understood; skipped that contact' }]);
  });

  it('flags a ZIP code it can’t read', () => {
    const { families, problems } = readFamilies([{ name: 'f.csv', text: 'Email,Postal Code\nkit@example.com,3060' }]);
    expect(families[0].zip).toBeNull();
    expect(problems).toEqual([{ where: 'f.csv:2', reason: 'ZIP code "3060" not understood; left blank' }]);
  });

  it('stores them on the household, unconfirmed, and never overwrites what a family entered', async () => {
    const db = await getDb();
    const files = [{ name: 'f.csv', text: 'Family ID,Email,Zip,Emergency Contact,Emergency Phone\n9,wren@example.com,30601,Ola Wren,706-555-0177\n10,ash@example.com,30606,Bo Ash,706-555-0166' }];
    // The Ash family already gave the new site their own contact.
    await db.insert(schema.user).values({ id: 'u-ash', name: 'Lee Ash', email: 'ash@example.com', emailVerified: true });
    const [ash] = await db.insert(schema.household).values({ name: 'Ash family', emergencyContacts: [{ name: 'Cy Ash', relationship: 'Uncle', phone: '7065550155' }] }).returning();
    await db.insert(schema.householdMember).values({ householdId: ash.id, userId: 'u-ash' });

    await importFamilies(readFamilies(files).families, { dryRun: false });
    const [wren] = await db.select().from(schema.household).where(eq(schema.household.name, 'wren’s family'));
    expect(wren).toMatchObject({ zip: '30601', emergencyContacts: [{ name: 'Ola Wren', relationship: '', phone: '7065550177' }], contactsConfirmedAt: null });
    const [after] = await db.select().from(schema.household).where(eq(schema.household.id, ash.id));
    expect(after).toMatchObject({ zip: '30606', emergencyContacts: [{ name: 'Cy Ash', relationship: 'Uncle', phone: '7065550155' }], contactsConfirmedAt: null });
  });
});
