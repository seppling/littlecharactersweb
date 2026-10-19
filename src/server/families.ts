/**
 * Staff: search, the families list, a family's page, staff notes, and the
 * family downloads (docs/back-office.md → Search and a family's page).
 *
 * Search is plain SQL ILIKE ("contains, any case") over family names, parents'
 * names, emails and phones (digits only), and children's names, plus class
 * titles from the content. No index: about 300 families scan in a few
 * milliseconds. Results never carry allergies or medical notes.
 *
 * Unlike src/server/family.ts (a family's own pages, scoped to the signed-in
 * household), these take a householdId from the address. Callers must check
 * requireStaff first. Staff writes (care details, contacts, notes) live here
 * too, so family.ts stays the family's own; each is written to the audit log.
 */
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from './db';
import { encrypt } from './crypto';
import { audit } from './records';
import { ageOn, listOrders, readStudentNotes, studentDetailsInput } from './family';
import { listInstallments, totalDue } from './billing';
import { childBadges, type Badge } from '@/lib/badges';
import { emergencyContactsInput, formatPhone, pickupPeopleInput, type EmergencyContact, type PickupPerson } from '@/lib/contacts';
import { todayInAthens } from '@/lib/pricing';
import type { SiteContent } from '@/content/site-content';
import type { Program, Session } from '@/content/types';

const { household, householdMember, user, student, enrollment, householdNote, message, messageRecipient } = schema;

type Catalog = Pick<SiteContent, 'programs' | 'findSession'>;
type EnrollmentStatus = (typeof enrollment.$inferSelect)['status'];

export const FAMILIES_PER_PAGE = 50;
export const SEARCH_LIMIT = 50;
export const NOTE_MAX = 4000;

// ───────────── Search ─────────────

/** "%text%" for ILIKE, with the query's own % _ \ matched as themselves. */
export const containsPattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** The digits of a phone-number query, or null when it doesn't look like one (fewer than 3 digits, or letters). */
export function phoneDigits(q: string): string | null {
  if (!/^[\d\s().+-]+$/.test(q.trim())) return null;
  let digits = q.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return digits.length >= 3 ? digits : null;
}

const digitsOf = (column: typeof user.phone) => sql`regexp_replace(coalesce(${column}, ''), '[^0-9]', '', 'g')`;

export type SearchPerson = { name: string; email: string; phone: string };
export type FamilyHit = { id: string; name: string; parents: SearchPerson[]; children: string[] };
export type ChildHit = { id: string; householdId: string; name: string; age: number | null; family: string };
export type ClassHit = { sessionId: string; title: string; term: string };
export type SearchResults = { families: FamilyHit[]; children: ChildHit[]; classes: ClassHit[] };

/**
 * Everything that matches `q`, grouped. A family is found by its name, a
 * parent (name, email or phone) or a child; it lists the parents and children
 * that matched. Children are listed again on their own, with their family.
 */
export async function searchStaff(rawQuery: string, catalog: Pick<SiteContent, 'programs'>): Promise<SearchResults> {
  const q = rawQuery.trim().slice(0, 100);
  if (!q) return { families: [], children: [], classes: [] };
  const db = await getDb();
  const like = containsPattern(q);
  const digits = phoneDigits(q);

  const parentMatch = or(ilike(user.name, like), ilike(user.email, like), digits ? sql`${digitsOf(user.phone)} like ${containsPattern(digits)}` : undefined);
  const childMatch = or(ilike(student.firstName, like), ilike(student.lastName, like), ilike(sql`${student.firstName} || ' ' || ${student.lastName}`, like));

  const [byName, parents, kids] = await Promise.all([
    db.select({ id: household.id, name: household.name }).from(household).where(ilike(household.name, like)).limit(SEARCH_LIMIT),
    db
      .select({ householdId: household.id, family: household.name, name: user.name, email: user.email, phone: user.phone })
      .from(householdMember)
      .innerJoin(user, eq(user.id, householdMember.userId))
      .innerJoin(household, eq(household.id, householdMember.householdId))
      .where(parentMatch)
      .limit(SEARCH_LIMIT * 2),
    db
      .select({ id: student.id, householdId: household.id, family: household.name, firstName: student.firstName, lastName: student.lastName, birthdate: student.birthdate })
      .from(student)
      .innerJoin(household, eq(household.id, student.householdId))
      .where(childMatch)
      .orderBy(asc(student.firstName), asc(student.lastName))
      .limit(SEARCH_LIMIT),
  ]);

  const families = new Map<string, FamilyHit>();
  const hit = (id: string, name: string) => {
    const f = families.get(id) ?? { id, name, parents: [], children: [] };
    families.set(id, f);
    return f;
  };
  for (const h of byName) hit(h.id, h.name);
  for (const p of parents) hit(p.householdId, p.family).parents.push({ name: p.name, email: p.email, phone: formatPhone(p.phone) });
  for (const k of kids) hit(k.householdId, k.family).children.push(`${k.firstName} ${k.lastName}`);

  const needle = q.toLowerCase();
  const classes = catalog.programs
    .filter((p) => p.title.toLowerCase().includes(needle))
    .flatMap((p) => p.sessions.map((s) => ({ sessionId: s.id, title: p.title, term: [s.label ?? s.term, sessionWhen(s)].filter(Boolean).join(' · ') })));

  return {
    families: [...families.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, SEARCH_LIMIT),
    children: kids.map((k) => ({ id: k.id, householdId: k.householdId, name: `${k.firstName} ${k.lastName}`, age: ageOn(k.birthdate), family: k.family })),
    classes: classes.slice(0, SEARCH_LIMIT),
  };
}

const DAY_SHORT: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const sessionWhen = (s: Pick<Session, 'days'>) => s.days.map((d) => DAY_SHORT[d] ?? d).join(', ');

// ───────────── Every family (the Families list and its downloads) ─────────────

/** A class is current until its last day. */
const isCurrent = (s: Session | undefined, today: string) => !!s && s.endDate >= today;

/**
 * Every family with its parents, children and enrollments, A to Z: one load
 * for the Families list and the Family, Student / Class and Contact
 * downloads, so they always agree. Four queries, whatever the number of families.
 */
export async function familyDirectory(catalog: Catalog, today = todayInAthens()) {
  const db = await getDb();
  const [families, parents, kids, enrolled] = await Promise.all([
    db.select().from(household).orderBy(sql`lower(${household.name})`, asc(household.createdAt)),
    db
      .select({ householdId: householdMember.householdId, name: user.name, email: user.email, phone: user.phone })
      .from(householdMember)
      .innerJoin(user, eq(user.id, householdMember.userId))
      .orderBy(asc(householdMember.createdAt)),
    db
      .select({ id: student.id, householdId: student.householdId, firstName: student.firstName, lastName: student.lastName, birthdate: student.birthdate })
      .from(student)
      .orderBy(asc(student.createdAt)),
    db
      .select({ studentId: enrollment.studentId, sessionId: enrollment.sessionId, status: enrollment.status })
      .from(enrollment)
      .where(sql`${enrollment.status} <> 'cancelled'`),
  ]);

  const classesOf = new Map<string, string[]>();
  for (const e of enrolled) {
    const found = catalog.findSession(e.sessionId);
    if (!found || !isCurrent(found.session, today)) continue;
    const label = e.status === 'active' ? found.program.title : `${found.program.title} (${e.status})`;
    classesOf.set(e.studentId, [...(classesOf.get(e.studentId) ?? []), label]);
  }

  const parentsOf = groupBy(parents, (p) => p.householdId);
  const kidsOf = groupBy(kids, (k) => k.householdId);
  return families.map((h) => {
    const children = (kidsOf.get(h.id) ?? [])
      .map((k) => ({ id: k.id, name: `${k.firstName} ${k.lastName}`, age: ageOn(k.birthdate, today), classes: classesOf.get(k.id) ?? [] }));
    return {
      id: h.id,
      name: h.name,
      zip: h.zip ?? '',
      heardAbout: h.heardAbout ?? '',
      source: h.source,
      parents: (parentsOf.get(h.id) ?? []).map((p) => ({ name: p.name, email: p.email, phone: formatPhone(p.phone) })),
      emergencyContacts: h.emergencyContacts,
      children,
      currentClasses: [...new Set(children.flatMap((c) => c.classes))],
    };
  });
}
export type DirectoryFamily = Awaited<ReturnType<typeof familyDirectory>>[number];

function groupBy<T>(xs: T[], key: (x: T) => string) {
  const out = new Map<string, T[]>();
  for (const x of xs) out.set(key(x), [...(out.get(key(x)) ?? []), x]);
  return out;
}

/** One page of the Families list. Page numbers start at 1; out-of-range pages show the last one. */
export function familiesPage<T>(all: T[], page: number, perPage = FAMILIES_PER_PAGE) {
  const pages = Math.max(1, Math.ceil(all.length / perPage));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { rows: all.slice((current - 1) * perPage, current * perPage), page: current, pages, total: all.length };
}

const lines = (xs: string[]) => xs.filter(Boolean).join('\n');
const contactLine = (c: { name: string; relationship: string; phone?: string }) => [`${c.name} (${c.relationship})`, c.phone && formatPhone(c.phone)].filter(Boolean).join(' ');

/** "Family List": family, parents, emails, phones, ZIP, how they heard, children. */
export function familiesTable(families: DirectoryFamily[]) {
  return {
    headers: ['Family', 'Parents', 'Emails', 'Phones', 'ZIP', 'Heard about us', 'Children'],
    rows: families.map((f) => [
      f.name,
      lines(f.parents.map((p) => p.name)),
      lines(f.parents.map((p) => p.email)),
      lines(f.parents.map((p) => p.phone)),
      f.zip,
      f.heardAbout,
      lines(f.children.map((c) => c.name)),
    ]),
  };
}

/** "Student / Class List": child, age, family, current classes. Children A to Z by last name. */
export function childrenTable(families: DirectoryFamily[]) {
  const kids = families.flatMap((f) => f.children.map((c) => ({ ...c, family: f.name })));
  const last = (n: string) => n.split(' ').at(-1) ?? n;
  kids.sort((a, b) => last(a.name).localeCompare(last(b.name)) || a.name.localeCompare(b.name));
  return {
    headers: ['Child', 'Age', 'Family', 'Current classes'],
    rows: kids.map((c) => [c.name, c.age ?? '', c.family, lines(c.classes)]),
  };
}

/** "Student Contact List": child, parents, emails, phones, emergency contacts. */
export function contactsTable(families: DirectoryFamily[]) {
  return {
    headers: ['Child', 'Family', 'Parents', 'Emails', 'Phones', 'Emergency contacts'],
    rows: families.flatMap((f) =>
      f.children.map((c) => [
        c.name,
        f.name,
        lines(f.parents.map((p) => p.name)),
        lines(f.parents.map((p) => p.email)),
        lines(f.parents.map((p) => p.phone)),
        lines(f.emergencyContacts.map(contactLine)),
      ]),
    ),
  };
}

// ───────────── Notes ─────────────

export class FamilyEditError extends Error {}

const noteBody = z.string().trim().min(1, 'Write the note first.').max(NOTE_MAX, `Keep a note under ${NOTE_MAX} characters.`);
const parseBody = (body: string) => {
  const r = noteBody.safeParse(body);
  if (!r.success) throw new FamilyEditError(r.error.issues[0].message);
  return r.data;
};

/** A staff note about the family, or about one of its children (studentId). */
export async function addNote(staffId: string, householdId: string, body: string, studentId?: string | null) {
  const db = await getDb();
  const text = parseBody(body);
  if (studentId) {
    const [s] = await db.select({ id: student.id }).from(student).where(and(eq(student.id, studentId), eq(student.householdId, householdId)));
    if (!s) throw new FamilyEditError('That child isn’t in this family.');
  }
  const [n] = await db.insert(householdNote).values({ householdId, studentId: studentId || null, body: text, authorUserId: staffId }).returning();
  await audit(staffId, 'admin.note.add', 'household_note', n.id);
  return n;
}

/** Only the note's author edits it. Returns the note, or throws. */
export async function editNote(staffId: string, householdId: string, noteId: string, body: string) {
  const db = await getDb();
  const text = parseBody(body);
  const [n] = await db
    .update(householdNote)
    .set({ body: text })
    .where(and(eq(householdNote.id, noteId), eq(householdNote.householdId, householdId), eq(householdNote.authorUserId, staffId)))
    .returning();
  if (!n) throw new FamilyEditError('Only the person who wrote a note can change it.');
  await audit(staffId, 'admin.note.edit', 'household_note', n.id);
  return n;
}

/** Only the note's author deletes it. */
export async function deleteNote(staffId: string, householdId: string, noteId: string) {
  const db = await getDb();
  const [n] = await db
    .delete(householdNote)
    .where(and(eq(householdNote.id, noteId), eq(householdNote.householdId, householdId), eq(householdNote.authorUserId, staffId)))
    .returning({ id: householdNote.id });
  if (!n) throw new FamilyEditError('Only the person who wrote a note can delete it.');
  await audit(staffId, 'admin.note.delete', 'household_note', n.id);
}

const authorName = (u: { name: string | null; email: string | null } | null) => (u ? u.name || u.email || 'Staff' : 'Former staff');

/** One family's notes, newest first, with who wrote them. */
export async function familyNotes(householdId: string) {
  const db = await getDb();
  const rows = await db
    .select({ note: householdNote, authorName: user.name, authorEmail: user.email })
    .from(householdNote)
    .leftJoin(user, eq(user.id, householdNote.authorUserId))
    .where(eq(householdNote.householdId, householdId))
    .orderBy(desc(householdNote.createdAt));
  return rows.map((r) => ({ ...r.note, author: authorName(r.authorEmail ? { name: r.authorName, email: r.authorEmail } : null) }));
}

/** "Family Notes": every family's notes, by family then newest first. */
export async function allNotes() {
  const db = await getDb();
  const rows = await db
    .select({ note: householdNote, family: household.name, firstName: student.firstName, lastName: student.lastName, authorName: user.name, authorEmail: user.email })
    .from(householdNote)
    .innerJoin(household, eq(household.id, householdNote.householdId))
    .leftJoin(student, eq(student.id, householdNote.studentId))
    .leftJoin(user, eq(user.id, householdNote.authorUserId))
    .orderBy(sql`lower(${household.name})`, desc(householdNote.createdAt));
  return rows.map((r) => ({
    family: r.family,
    about: r.firstName ? `${r.firstName} ${r.lastName}` : 'Whole family',
    body: r.note.body,
    author: authorName(r.authorEmail ? { name: r.authorName, email: r.authorEmail } : null),
    createdAt: r.note.createdAt,
    edited: r.note.updatedAt.getTime() - r.note.createdAt.getTime() > 1000,
  }));
}

/** "2026-10-19 14:05" in Athens: sorts correctly in a spreadsheet. */
const stamp = (d: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/New_York', dateStyle: 'short', timeStyle: 'short' }).format(d);

export function notesTable(notes: Awaited<ReturnType<typeof allNotes>>) {
  return {
    headers: ['Family', 'About', 'Note', 'Written by', 'When'],
    rows: notes.map((n) => [n.family, n.about, n.body, n.author, `${stamp(n.createdAt)}${n.edited ? ' (edited)' : ''}`]),
  };
}

// ───────────── Staff edits ─────────────

const careInput = studentDetailsInput.extend({ photoConsent: z.boolean().nullable() });

/**
 * Staff change a child's care details (with the same encryption as the
 * family's form). Not a parent's confirmation: detailsConfirmedAt stays as it was.
 */
export async function staffUpdateCareDetails(staffId: string, householdId: string, studentId: string, raw: z.input<typeof careInput>) {
  const parsed = careInput.safeParse(raw);
  if (!parsed.success) throw new FamilyEditError(parsed.error.issues[0].message);
  const input = parsed.data;
  const db = await getDb();
  const [s] = await db
    .update(student)
    .set({ allergiesEnc: encrypt(input.allergies), medicalNotesEnc: encrypt(input.medicalNotes), pickupNotes: input.pickupNotes || null, photoConsent: input.photoConsent })
    .where(and(eq(student.id, studentId), eq(student.householdId, householdId)))
    .returning({ id: student.id });
  if (!s) throw new FamilyEditError('That child isn’t in this family.');
  await audit(staffId, 'admin.student.update', 'student', s.id);
}

/** Staff change the family's emergency contacts and pickup list. contactsConfirmedAt stays as it was. */
export async function staffUpdateContacts(staffId: string, householdId: string, raw: { emergencyContacts: unknown; pickupPeople: unknown }) {
  const ec = emergencyContactsInput.safeParse(raw.emergencyContacts);
  const pp = pickupPeopleInput.safeParse(raw.pickupPeople);
  if (!ec.success) throw new FamilyEditError(`Emergency contacts: ${ec.error.issues[0].message}`);
  if (!pp.success) throw new FamilyEditError(`Pickup list: ${pp.error.issues[0].message}`);
  const db = await getDb();
  const [h] = await db
    .update(household)
    .set({ emergencyContacts: ec.data as EmergencyContact[], pickupPeople: pp.data as PickupPerson[] })
    .where(eq(household.id, householdId))
    .returning({ id: household.id });
  if (!h) throw new FamilyEditError('That family wasn’t found.');
  await audit(staffId, 'admin.household.contacts', 'household', h.id);
}

/**
 * The rows of a contacts form (name/relationship/phone per row, numbered
 * from 0), with blank rows left out, for staffUpdateContacts.
 */
export function contactRows(form: FormData, prefix: string, max = 4) {
  const out: { name: string; relationship: string; phone: string }[] = [];
  for (let i = 0; i < max; i++) {
    const get = (k: string) => String(form.get(`${prefix}-${i}-${k}`) ?? '').trim();
    const row = { name: get('name'), relationship: get('relationship'), phone: get('phone') };
    if (row.name || row.relationship || row.phone) out.push(row);
  }
  return out;
}

// ───────────── A family's page ─────────────

const STATUS_ORDER: Record<EnrollmentStatus, number> = { active: 0, trial: 1, waitlist: 2, cancelled: 3 };

/**
 * The season "this season" means: the term of the weekly class running today,
 * else the next one to start (any kind of class when there are no weekly ones).
 */
export function currentTerm(programs: Program[], today = todayInAthens()): string | null {
  const pick = (list: Program[]) => {
    const sessions = list.flatMap((p) => p.sessions);
    const running = sessions.filter((s) => s.startDate <= today && s.endDate >= today).sort((a, b) => b.startDate.localeCompare(a.startDate));
    const next = sessions.filter((s) => s.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate));
    return (running[0] ?? next[0])?.term ?? null;
  };
  return pick(programs.filter((p) => p.kind === 'class')) ?? pick(programs);
}

/**
 * Everything on a family's page: the family, parents, children with their
 * care details (decrypted here, for staff), contacts, classes, payments,
 * notes and emails. Null when there's no such family. Viewing it is logged,
 * because it shows care details, like a roster.
 */
export async function familyPage(householdId: string, catalog: Catalog, viewerId: string, today = todayInAthens()) {
  const db = await getDb();
  const [h] = await db.select().from(household).where(eq(household.id, householdId));
  if (!h) return null;

  const [parents, kids, enrollments, orders, installments, notes, emails] = await Promise.all([
    db
      .select({ name: user.name, email: user.email, phone: user.phone })
      .from(householdMember)
      .innerJoin(user, eq(user.id, householdMember.userId))
      .where(eq(householdMember.householdId, householdId))
      .orderBy(asc(householdMember.createdAt)),
    db.select().from(student).where(eq(student.householdId, householdId)).orderBy(asc(student.createdAt)),
    db.select().from(enrollment).where(eq(enrollment.householdId, householdId)),
    listOrders(householdId),
    listInstallments(householdId),
    familyNotes(householdId),
    familyEmails(householdId),
  ]);
  await audit(viewerId, 'admin.family.view', 'household', householdId);

  const children = kids.map((s) => {
    const { allergies, medicalNotes } = readStudentNotes(s);
    const mine = enrollments.filter((e) => e.studentId === s.id);
    const counting = mine.filter((e) => e.status !== 'cancelled');
    const firstEnrolledAt = counting.length ? new Date(Math.min(...counting.map((e) => e.createdAt.getTime()))) : null;
    const badges: Badge[] = childBadges(
      {
        hasAllergies: !!allergies,
        hasMedicalNotes: !!medicalNotes,
        // The pickup list says who else may collect them, not who may not: no badge for it alone.
        hasPickupNote: !!s.pickupNotes,
        photoConsent: s.photoConsent,
        firstEnrolledAt,
        trial: counting.some((e) => e.status === 'trial' && isCurrent(catalog.findSession(e.sessionId)?.session, today)),
        birthdate: s.birthdate,
      },
      today,
    );
    return {
      id: s.id,
      firstName: s.firstName,
      name: `${s.firstName} ${s.lastName}`,
      age: ageOn(s.birthdate, today),
      birthdate: s.birthdate,
      badges,
      allergies,
      medicalNotes,
      pickupNotes: s.pickupNotes ?? '',
      photoConsent: s.photoConsent,
      detailsConfirmedAt: s.detailsConfirmedAt,
    };
  });

  const nameOf = new Map(kids.map((s) => [s.id, s.firstName]));
  const classes = enrollments
    .map((e) => {
      const found = catalog.findSession(e.sessionId);
      return {
        id: e.id,
        sessionId: e.sessionId,
        orderId: e.orderId,
        child: nameOf.get(e.studentId) ?? '',
        title: found?.program.title ?? e.sessionId,
        term: found ? (found.session.label ?? found.session.term) : '',
        endDate: found?.session.endDate ?? '',
        current: isCurrent(found?.session, today) && e.status !== 'cancelled',
        status: e.status,
        /** Added by staff without charge: why (roster-changes.ts). */
        noChargeReason: e.noChargeReason,
      };
    })
    .sort((a, b) => Number(b.current) - Number(a.current) || STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.endDate.localeCompare(a.endDate) || a.title.localeCompare(b.title));

  return {
    household: h,
    parents: parents.map((p) => ({ ...p, phone: p.phone ?? '' })),
    children,
    classes,
    payments: paymentSummary({ household: h, orders, installments, catalog, today }),
    notes,
    emails,
  };
}
export type FamilyPage = NonNullable<Awaited<ReturnType<typeof familyPage>>>;

type Installment = Awaited<ReturnType<typeof listInstallments>>[number];
type Order = Awaited<ReturnType<typeof listOrders>>[number];

/** The family page's payments box, read from the orders and monthly payments as they are. */
export function paymentSummary({
  household: h,
  orders,
  installments,
  catalog,
  today,
}: {
  household: Pick<typeof household.$inferSelect, 'cardBrand' | 'cardLast4' | 'cardExpMonth' | 'cardExpYear' | 'stripePaymentMethodId'>;
  orders: Order[];
  installments: Installment[];
  catalog: Catalog;
  today: string;
}) {
  const term = currentTerm(catalog.programs, today);
  const termOf = (sessionId: string) => catalog.findSession(sessionId)?.session.term ?? null;
  const titleOf = (sessionId: string) => catalog.findSession(sessionId)?.program.title ?? sessionId;

  const upcoming = installments.filter((i) => i.status === 'scheduled' && i.dueDate >= today);
  const nextDate = upcoming[0]?.dueDate ?? null;
  const next = nextDate ? { date: nextDate, cents: upcoming.filter((i) => i.dueDate === nextDate).reduce((a, i) => a + totalDue(i), 0) } : null;

  const problems = installments
    .filter((i) => i.status === 'failed' || (i.status === 'scheduled' && i.dueDate < today))
    .map((i) => ({ orderId: i.orderId, dueDate: i.dueDate, cents: totalDue(i), title: titleOf(i.sessionId), failed: i.status === 'failed' }));

  const inTerm = (sessionId: string) => !!term && termOf(sessionId) === term;
  const paidCents =
    orders.filter((o) => inTerm(o.sessionId)).reduce((a, o) => a + o.totalCents, 0) +
    installments.filter((i) => i.status === 'paid' && inTerm(i.sessionId)).reduce((a, i) => a + totalDue(i), 0);

  const remaining = (orderId: string) => installments.filter((i) => i.orderId === orderId && (i.status === 'scheduled' || i.status === 'failed' || i.status === 'processing')).length;
  return {
    card: h.cardLast4 ? { brand: h.cardBrand ?? 'Card', last4: h.cardLast4, exp: h.cardExpMonth && h.cardExpYear ? `${h.cardExpMonth}/${h.cardExpYear}` : '' } : null,
    hasSavedCard: !!h.stripePaymentMethodId,
    next,
    problems,
    term,
    paidCents,
    orders: orders.map((o) => ({ id: o.id, title: titleOf(o.sessionId), term: termOf(o.sessionId) ?? '', plan: o.plan, totalCents: o.totalCents, paidAt: o.paidAt, remaining: remaining(o.id) })),
  };
}

/** Staff emails sent to this family from the site, newest first (written by the messages unit). */
export async function familyEmails(householdId: string) {
  const db = await getDb();
  const rows = await db
    .select({ id: messageRecipient.id, email: messageRecipient.email, status: messageRecipient.status, sentAt: messageRecipient.createdAt, subject: message.subject, kind: message.kind, senderName: user.name, senderEmail: user.email })
    .from(messageRecipient)
    .innerJoin(message, eq(message.id, messageRecipient.messageId))
    .leftJoin(user, eq(user.id, message.sentByUserId))
    .where(eq(messageRecipient.householdId, householdId))
    .orderBy(desc(messageRecipient.createdAt))
    .limit(100);
  return rows.map((r) => ({ id: r.id, email: r.email, failed: r.status === 'failed', sentAt: r.sentAt, subject: r.subject, kind: r.kind, sender: authorName(r.senderEmail ? { name: r.senderName, email: r.senderEmail } : null) }));
}
