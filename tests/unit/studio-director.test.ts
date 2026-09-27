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
