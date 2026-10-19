/**
 * Staff search, the Families list, notes and staff edits (src/server/families.ts).
 * Sample families are made up.
 */
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDb, schema } from '@/server/db';
import { getCatalog } from '@/server/content';
import { createStudent, ensureHousehold, getStudent, readStudentNotes, updateStudentDetails, type SessionUser } from '@/server/family';
import {
  addNote,
  childrenTable,
  containsPattern,
  contactsTable,
  currentTerm,
  deleteNote,
  editNote,
  familiesPage,
  familiesTable,
  familyDirectory,
  familyNotes,
  familyPage,
  FamilyEditError,
  phoneDigits,
  searchStaff,
  staffUpdateCareDetails,
  staffUpdateContacts,
} from '@/server/families';

const ana: SessionUser = { id: 'u-ana', name: 'Ana Rivera', email: 'ana.rivera@example.com', emailVerified: true };
const bo: SessionUser = { id: 'u-bo', name: 'Bo Chen', email: 'bo@example.com', emailVerified: true };
const cy: SessionUser = { id: 'u-cy', name: 'Cy Adams', email: 'cy@example.com', emailVerified: true };
const hannah = { id: 'u-hannah', name: 'Hannah', email: 'hannah@example.com', emailVerified: true };
const helper = { id: 'u-helper', name: 'Sam Helper', email: 'sam@example.com', emailVerified: true };
let A: { id: string };
let B: { id: string };
let maya: { id: string };
let catalog: Awaited<ReturnType<typeof getCatalog>>;

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-19T16:00:00Z'));
  const db = await getDb();
  await db.insert(schema.user).values([
    { ...ana, phone: '(706) 555-0142' },
    { ...bo, phone: '+1 706.555.0199' },
    cy,
    hannah,
    helper,
  ]);
  A = await ensureHousehold(ana);
  B = await ensureHousehold(bo);
  await ensureHousehold(cy);
  maya = await createStudent(A.id, { firstName: 'Maya', lastName: 'Rivera', birthdate: '2017-04-12' }, ana.id);
  await updateStudentDetails(A.id, maya.id, { allergies: 'Peanuts', medicalNotes: 'Inhaler in her bag', pickupNotes: '', photoConsent: true }, ana.id);
  await createStudent(B.id, { firstName: 'Lily', lastName: 'Chen', birthdate: '2019-01-05' }, bo.id);
  catalog = await getCatalog();
});
afterAll(() => {
  vi.useRealTimers();
});

describe('search', () => {
  it('matches phone numbers whatever the format', async () => {
    for (const q of ['706-555-0142', '7065550142', '(706) 555 0142', '+1 706 555 0142', '555.0142']) {
      const r = await searchStaff(q, catalog);
      expect(r.families.map((f) => f.id), q).toEqual([A.id]);
      expect(r.families[0].parents[0].phone).toBe('(706) 555-0142');
    }
    expect((await searchStaff('0199', catalog)).families.map((f) => f.id)).toEqual([B.id]);
  });

  it('ignores letter case, and matches part of a word', async () => {
    expect((await searchStaff('rIVERA', catalog)).families.map((f) => f.id)).toEqual([A.id]);
    expect((await searchStaff('ANA.RIV', catalog)).families.map((f) => f.id)).toEqual([A.id]);
    expect((await searchStaff('chen fam', catalog)).families.map((f) => f.id)).toEqual([B.id]);
  });

  it('finds a child by first name, with their family', async () => {
    const r = await searchStaff('maya', catalog);
    expect(r.children).toEqual([{ id: maya.id, householdId: A.id, name: 'Maya Rivera', age: 9, family: 'Rivera family' }]);
    expect(r.families).toEqual([{ id: A.id, name: 'Rivera family', parents: [], children: ['Maya Rivera'] }]);
    expect((await searchStaff('Maya Riv', catalog)).children.map((c) => c.id)).toEqual([maya.id]);
  });

  it('finds classes by title from the content', async () => {
    const title = catalog.programs[0].title;
    const r = await searchStaff(title.slice(0, 5).toUpperCase(), catalog);
    expect(r.classes.some((c) => c.title === title && c.sessionId === catalog.programs[0].sessions[0]?.id)).toBe(true);
  });

  it('treats % and _ as themselves, and ignores an empty box', async () => {
    expect(containsPattern('50%_off')).toBe('%50\\%\\_off%');
    const r = await searchStaff('%', catalog);
    expect(r.families).toEqual([]);
    expect(r.children).toEqual([]);
    expect(await searchStaff('   ', catalog)).toEqual({ families: [], children: [], classes: [] });
  });

  it('only compares digits for queries that look like phone numbers', () => {
    expect(phoneDigits('706-555')).toBe('706555');
    expect(phoneDigits('1 706 555 0142')).toBe('7065550142');
    expect(phoneDigits('Maya 7')).toBeNull();
    expect(phoneDigits('70')).toBeNull();
  });

  it('never shows medical details', async () => {
    const text = JSON.stringify(await searchStaff('Rivera', catalog));
    expect(text).not.toMatch(/Peanuts|Inhaler/);
  });
});

describe('the families list', () => {
  it('lists every family A to Z with its children', async () => {
    const all = await familyDirectory(catalog);
    expect(all.map((f) => f.name)).toEqual(['Adams family', 'Chen family', 'Rivera family']);
    expect(all[2].children.map((c) => c.name)).toEqual(['Maya Rivera']);
    expect(all[2].parents).toEqual([{ name: 'Ana Rivera', email: 'ana.rivera@example.com', phone: '(706) 555-0142' }]);
  });

  it('pages', () => {
    const items = Array.from({ length: 5 }, (_, i) => i);
    expect(familiesPage(items, 1, 2)).toEqual({ rows: [0, 1], page: 1, pages: 3, total: 5 });
    expect(familiesPage(items, 3, 2)).toEqual({ rows: [4], page: 3, pages: 3, total: 5 });
    // Past the end: the last page. Nonsense: the first.
    expect(familiesPage(items, 9, 2).page).toBe(3);
    expect(familiesPage(items, Number('abc'), 2).page).toBe(1);
    expect(familiesPage([], 1, 2)).toEqual({ rows: [], page: 1, pages: 1, total: 0 });
  });

  it('builds the three downloads from the same families', async () => {
    const all = await familyDirectory(catalog);
    const fam = familiesTable(all);
    expect(fam.headers).toEqual(['Family', 'Parents', 'Emails', 'Phones', 'ZIP', 'Heard about us', 'Children']);
    expect(fam.rows[2]).toEqual(['Rivera family', 'Ana Rivera', 'ana.rivera@example.com', '(706) 555-0142', '', '', 'Maya Rivera']);
    const kids = childrenTable(all);
    expect(kids.rows.map((r) => r[0])).toEqual(['Lily Chen', 'Maya Rivera']);
    const contacts = contactsTable(all);
    expect(contacts.headers).toContain('Emergency contacts');
    expect(JSON.stringify([fam, kids, contacts])).not.toMatch(/Peanuts|Inhaler/);
  });
});

describe('notes', () => {
  it('lets only the author edit or delete a note, and logs each change', async () => {
    const n = await addNote(hannah.id, A.id, '  Prefers texts to calls.  ', maya.id);
    expect(n.body).toBe('Prefers texts to calls.');
    await expect(editNote(helper.id, A.id, n.id, 'Changed by someone else')).rejects.toThrow(FamilyEditError);
    await expect(deleteNote(helper.id, A.id, n.id)).rejects.toThrow(FamilyEditError);
    // Not through another family's page either.
    await expect(editNote(hannah.id, B.id, n.id, 'Wrong family')).rejects.toThrow(FamilyEditError);
    expect((await familyNotes(A.id))[0].body).toBe('Prefers texts to calls.');

    await editNote(hannah.id, A.id, n.id, 'Prefers texts.');
    const [saved] = await familyNotes(A.id);
    expect(saved).toMatchObject({ body: 'Prefers texts.', author: 'Hannah', studentId: maya.id });

    await deleteNote(hannah.id, A.id, n.id);
    expect(await familyNotes(A.id)).toEqual([]);

    const db = await getDb();
    const log = await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, n.id));
    expect(log.map((l) => l.action).sort()).toEqual(['admin.note.add', 'admin.note.delete', 'admin.note.edit']);
  });

  it('refuses empty notes and another family’s child', async () => {
    await expect(addNote(hannah.id, A.id, '   ')).rejects.toThrow(/Write the note/);
    const [lily] = await (await getDb()).select().from(schema.student).where(eq(schema.student.firstName, 'Lily'));
    await expect(addNote(hannah.id, A.id, 'Hello', lily.id)).rejects.toThrow(/isn’t in this family/);
  });
});

describe('staff edits', () => {
  it('changes care details without counting as a parent’s confirmation', async () => {
    const before = await getStudent(A.id, maya.id);
    expect(before?.detailsConfirmedAt).toBeInstanceOf(Date);
    vi.setSystemTime(new Date('2026-10-20T16:00:00Z'));
    await staffUpdateCareDetails(hannah.id, A.id, maya.id, { allergies: 'Peanuts, sesame', medicalNotes: 'Inhaler in her bag', pickupNotes: 'Aunt Jo on Tuesdays', photoConsent: false });
    const after = await getStudent(A.id, maya.id);
    expect(after?.detailsConfirmedAt?.getTime()).toBe(before?.detailsConfirmedAt?.getTime());
    expect(readStudentNotes(after!)).toEqual({ allergies: 'Peanuts, sesame', medicalNotes: 'Inhaler in her bag' });
    expect(after?.allergiesEnc).not.toContain('sesame');
    expect(after).toMatchObject({ pickupNotes: 'Aunt Jo on Tuesdays', photoConsent: false });
    await expect(staffUpdateCareDetails(hannah.id, B.id, maya.id, { allergies: '', medicalNotes: '', pickupNotes: '', photoConsent: true })).rejects.toThrow(FamilyEditError);
    const db = await getDb();
    expect(await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'admin.student.update'), eq(schema.auditLog.entityId, maya.id)))).toHaveLength(1);
  });

  it('changes contacts with the shared rules, and leaves the confirmation date alone', async () => {
    await staffUpdateContacts(hannah.id, A.id, {
      emergencyContacts: [{ name: 'Rosa Rivera', relationship: 'Grandma', phone: '706.555.0177' }],
      pickupPeople: [{ name: 'Jo Rivera', relationship: 'Aunt', phone: '' }],
    });
    const db = await getDb();
    const [h] = await db.select().from(schema.household).where(eq(schema.household.id, A.id));
    expect(h.emergencyContacts).toEqual([{ name: 'Rosa Rivera', relationship: 'Grandma', phone: '7065550177' }]);
    expect(h.pickupPeople).toEqual([{ name: 'Jo Rivera', relationship: 'Aunt' }]);
    expect(h.contactsConfirmedAt).toBeNull();
    await expect(staffUpdateContacts(hannah.id, A.id, { emergencyContacts: [{ name: 'X', relationship: 'Y', phone: '12' }], pickupPeople: [] })).rejects.toThrow(/Emergency contacts/);
  });
});

describe('a family’s page', () => {
  it('shows the children with care details and badges, and logs the view', async () => {
    const page = await familyPage(A.id, catalog, hannah.id);
    expect(page?.children[0]).toMatchObject({ name: 'Maya Rivera', age: 9, allergies: 'Peanuts, sesame' });
    expect(page?.children[0].badges.map((b) => b.key)).toEqual(['medical', 'pickup', 'no-photos']);
    expect(page?.emails).toEqual([]);
    expect(page?.payments).toMatchObject({ card: null, next: null, problems: [], paidCents: 0, orders: [] });
    const db = await getDb();
    expect(await db.select().from(schema.auditLog).where(and(eq(schema.auditLog.action, 'admin.family.view'), eq(schema.auditLog.entityId, A.id)))).toHaveLength(1);
    expect(await familyPage('no-such-family', catalog, hannah.id)).toBeNull();
  });

  it('knows which season it is', () => {
    expect(currentTerm(catalog.programs, '2026-10-19')).toBeTruthy();
  });
});
