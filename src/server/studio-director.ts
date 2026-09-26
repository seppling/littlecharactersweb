/**
 * Studio Director → Little Characters import.
 *
 * Reads the CSV exports Hannah downloads from Studio Director (families and/or
 * students, one file or several), groups rows into households, and creates:
 *   - a household (source "studio-director")
 *   - a user row per guardian email, NOT email-verified. Nobody can use it until
 *     they sign in with a code sent to that address, which is how a family
 *     "claims" the account. Nothing is ever sent to them by this import.
 *   - students, with allergy/medical notes encrypted. Details are marked
 *     unconfirmed, so each family re-checks them on their first enrollment.
 *
 * Header names vary by report, so columns are matched loosely (see FIELDS) and
 * can be overridden with --map. Safe to re-run: existing emails and students
 * (same first name + birthday) are matched instead of duplicated.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { getDb, schema } from './db';
import { encrypt } from './crypto';

// ───────────── CSV ─────────────

/** RFC 4180 CSV (quotes, escaped quotes, CRLF, BOM). Tab-separated files work too. */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^﻿/, '');
  const firstLine = text.slice(0, text.search(/\r?\n|$/));
  const sep = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') (field += '"'), i++;
      else quoted = false;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === sep) row.push(field), (field = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field), rows.push(row), (row = []), (field = '');
    } else field += c;
  }
  if (field !== '' || row.length) row.push(field), rows.push(row);
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

// ───────────── Column matching ─────────────

export const FIELDS = {
  familyId: ['familyid', 'familynumber', 'familyno', 'family', 'accountid', 'accountnumber', 'accountno', 'account', 'customerid'],
  familyName: ['familyname', 'accountname', 'household', 'householdname'],
  guardianFirst: ['parentfirstname', 'guardianfirstname', 'parent1firstname', 'guardian1firstname', 'contactfirstname', 'primarycontactfirstname', 'motherfirstname'],
  guardianLast: ['parentlastname', 'guardianlastname', 'parent1lastname', 'guardian1lastname', 'contactlastname', 'primarycontactlastname', 'motherlastname'],
  guardianName: ['parentname', 'guardianname', 'parent1name', 'guardian1name', 'contactname', 'primarycontact', 'parent', 'guardian'],
  email: ['email', 'emailaddress', 'parentemail', 'guardianemail', 'parent1email', 'guardian1email', 'primaryemail', 'familyemail', 'email1', 'contactemail'],
  phone: ['phone', 'cellphone', 'cell', 'mobile', 'mobilephone', 'parentphone', 'parent1phone', 'guardianphone', 'primaryphone', 'homephone', 'phone1'],
  guardian2First: ['parent2firstname', 'guardian2firstname', 'secondaryfirstname', 'secondarycontactfirstname', 'fatherfirstname'],
  guardian2Last: ['parent2lastname', 'guardian2lastname', 'secondarylastname', 'secondarycontactlastname', 'fatherlastname'],
  guardian2Name: ['parent2name', 'guardian2name', 'secondarycontact', 'secondaryparent', 'secondaryname'],
  email2: ['email2', 'parent2email', 'guardian2email', 'secondaryemail', 'alternateemail', 'altemail', 'additionalemail'],
  phone2: ['phone2', 'parent2phone', 'guardian2phone', 'secondaryphone', 'alternatephone', 'workphone'],
  studentFirst: ['studentfirstname', 'childfirstname', 'dancerfirstname', 'studentfirst'],
  studentLast: ['studentlastname', 'childlastname', 'dancerlastname', 'studentlast'],
  studentName: ['studentname', 'childname', 'student', 'dancername', 'dancer', 'child'],
  birthdate: ['birthdate', 'birthday', 'dateofbirth', 'dob', 'studentbirthdate', 'studentdob', 'studentbirthday', 'bday'],
  allergies: ['allergies', 'allergy', 'studentallergies', 'foodallergies'],
  medical: ['medical', 'medicalnotes', 'medicalconditions', 'medicalinfo', 'medicalinformation', 'medications', 'healthnotes', 'specialneeds', 'medicalallergies', 'allergiesmedical'],
} as const;

export type Field = keyof typeof FIELDS;

/** Plain "First Name"/"Last Name"/"Name" mean the student in a student report, the parent otherwise. */
const GENERIC = { first: ['firstname', 'first'], last: ['lastname', 'last', 'surname'], name: ['name', 'fullname'] };

export const normalizeHeader = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

export type ColumnMap = Partial<Record<Field, number>>;

export function matchColumns(headers: string[], overrides: Partial<Record<Field, string>> = {}): ColumnMap {
  const norm = headers.map(normalizeHeader);
  const map: ColumnMap = {};
  const take = (field: Field, i: number) => {
    if (i >= 0 && map[field] === undefined && !Object.values(map).includes(i)) map[field] = i;
  };
  for (const [field, header] of Object.entries(overrides) as [Field, string][]) {
    const i = norm.indexOf(normalizeHeader(header));
    if (i < 0) throw new Error(`--map ${field}: no column named "${header}". Columns: ${headers.join(', ')}`);
    map[field] = i;
  }
  for (const field of Object.keys(FIELDS) as Field[]) {
    for (const alias of FIELDS[field]) take(field, norm.indexOf(alias));
  }
  const studentReport = map.birthdate !== undefined || map.studentFirst !== undefined || map.studentName !== undefined;
  const [first, last, name]: Field[] = studentReport ? ['studentFirst', 'studentLast', 'studentName'] : ['guardianFirst', 'guardianLast', 'guardianName'];
  for (const a of GENERIC.first) take(first, norm.indexOf(a));
  for (const a of GENERIC.last) take(last, norm.indexOf(a));
  for (const a of GENERIC.name) take(name, norm.indexOf(a));
  return map;
}

// ───────────── Rows → families ─────────────

export type ImportGuardian = { name: string; email: string; phone: string | null };
export type ImportStudent = { firstName: string; lastName: string; birthdate: string | null; allergies: string; medical: string; where: string };
export type ImportFamily = { key: string; label: string; where: string; name: string | null; guardians: ImportGuardian[]; students: ImportStudent[] };
export type Problem = { where: string; reason: string };
export type SourceFile = { name: string; text: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Accepts 2014-03-09, 3/9/2014, 3/9/14, 3-9-2014 and "March 9, 2014". Returns YYYY-MM-DD or null. */
export function parseBirthdate(raw: string, today = new Date()): string | null {
  const s = raw.trim();
  if (!s) return null;
  let y: number, m: number, d: number;
  let match: RegExpMatchArray | null;
  if ((match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) [y, m, d] = [+match[1], +match[2], +match[3]];
  else if ((match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/))) {
    [m, d, y] = [+match[1], +match[2], +match[3]];
    if (y < 100) y += y <= today.getFullYear() % 100 ? 2000 : 1900;
  } else {
    const t = Date.parse(s);
    if (Number.isNaN(t)) return null;
    const dt = new Date(t);
    [y, m, d] = [dt.getFullYear(), dt.getMonth() + 1, dt.getDate()];
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  const iso = dt.toISOString().slice(0, 10);
  return iso > '1920-01-01' && iso <= today.toISOString().slice(0, 10) ? iso : null;
}

const clean = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** "Smith, Jane" → "Jane Smith"; "Jane Smith" stays. */
function personName(first: string, last: string, full: string) {
  if (first || last) return clean(`${first} ${last}`);
  const [a, b] = full.split(',').map(clean);
  return b ? `${b} ${a}` : clean(full);
}

export function readFamilies(files: SourceFile[], overrides: Partial<Record<Field, string>> = {}) {
  const problems: Problem[] = [];
  const columns: { file: string; matched: Record<string, string>; ignored: string[] }[] = [];
  const byKey = new Map<string, ImportFamily>();

  for (const file of files) {
    const [headers = [], ...rows] = parseCsv(file.text);
    const map = matchColumns(headers, overrides);
    const used = new Set(Object.values(map));
    columns.push({
      file: file.name,
      matched: Object.fromEntries(Object.entries(map).map(([f, i]) => [f, headers[i!]])),
      ignored: headers.filter((_, i) => !used.has(i)),
    });

    rows.forEach((cells, r) => {
      const where = `${file.name}:${r + 2}`;
      const get = (f: Field) => clean(map[f] === undefined ? '' : cells[map[f]!]);

      const guardians: ImportGuardian[] = [];
      for (const [first, last, full, email, phone] of [
        ['guardianFirst', 'guardianLast', 'guardianName', 'email', 'phone'],
        ['guardian2First', 'guardian2Last', 'guardian2Name', 'email2', 'phone2'],
      ] as const) {
        // A cell can hold more than one address ("a@x.com; b@y.com"); extras become guardians too.
        get(email)
          .toLowerCase()
          .split(/[\s;,]+/)
          .filter(Boolean)
          .forEach((address, n) => {
            if (!EMAIL.test(address)) return problems.push({ where, reason: `"${address}" isn’t a valid email; skipped that guardian` });
            guardians.push({ name: n ? '' : personName(get(first), get(last), get(full)), email: address, phone: n ? null : get(phone) || null });
          });
      }

      const id = get('familyId').toLowerCase();
      const key = id ? `id:${id}` : guardians[0] ? `email:${guardians[0].email}` : '';
      const studentName = personName(get('studentFirst'), get('studentLast'), get('studentName'));
      if (!key) {
        problems.push({ where, reason: studentName ? 'student row has no family ID or parent email to link to' : 'row has no family ID or email' });
        return;
      }

      const fam = byKey.get(key) ?? { key, label: key.slice(key.indexOf(':') + 1), where, name: null, guardians: [], students: [] };
      byKey.set(key, fam);
      fam.name ??= get('familyName') || null;
      for (const g of guardians) {
        const had = fam.guardians.find((x) => x.email === g.email);
        if (!had) fam.guardians.push(g);
        else {
          had.name ||= g.name;
          had.phone ??= g.phone;
        }
      }

      if (studentName) {
        const hasSplit = get('studentFirst') || get('studentLast');
        const [firstName, ...rest] = hasSplit ? [get('studentFirst'), get('studentLast')] : studentName.split(' ');
        const lastName = clean(hasSplit ? get('studentLast') : rest.join(' '));
        const rawBday = get('birthdate');
        const birthdate = parseBirthdate(rawBday);
        if (!birthdate) problems.push({ where, reason: rawBday ? `birthday "${rawBday}" not understood; left blank` : 'no birthday; left blank' });
        fam.students.push({ firstName, lastName, birthdate, allergies: get('allergies'), medical: get('medical'), where });
      }
    });
  }

  // Families keyed by email in one file and by family ID in another are the same family.
  const families = [...byKey.values()];
  for (const f of families.filter((f) => f.key.startsWith('email:'))) {
    const email = f.key.slice(6);
    const into = families.find((o) => o !== f && o.key.startsWith('id:') && o.guardians.some((g) => g.email === email));
    if (!into) continue;
    for (const g of f.guardians) if (!into.guardians.some((x) => x.email === g.email)) into.guardians.push(g);
    into.students.push(...f.students);
    byKey.delete(f.key);
  }

  const out: ImportFamily[] = [];
  for (const f of byKey.values()) {
    // Fill missing student last names from the family.
    const familyLast = f.guardians.find((g) => g.name)?.name.split(' ').at(-1) ?? '';
    for (const s of f.students) s.lastName ||= familyLast;
    // Same child listed twice (e.g. once per class): keep one.
    const seen = new Set<string>();
    f.students = f.students.filter((s) => {
      const k = `${s.firstName.toLowerCase()}|${s.birthdate ?? s.lastName.toLowerCase()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (!f.guardians.length) {
      problems.push({ where: f.where, reason: `family ${f.label} has no parent email to sign in with; skipped (they can sign up fresh)` });
      continue;
    }
    out.push(f);
  }
  return { families: out, problems, columns };
}

// ───────────── Write to the database ─────────────

export type ImportReport = {
  dryRun: boolean;
  households: { created: number; matched: number };
  guardians: { created: number; matched: number };
  students: { created: number; matched: number };
  problems: Problem[];
};

class Rollback extends Error {}

/**
 * Writes families in one transaction. With dryRun, everything runs against the
 * real database (so matching is accurate) and is then rolled back.
 */
export async function importFamilies(families: ImportFamily[], { dryRun = true } = {}): Promise<ImportReport> {
  const { user, household, householdMember, student, auditLog } = schema;
  const report: ImportReport = {
    dryRun,
    households: { created: 0, matched: 0 },
    guardians: { created: 0, matched: 0 },
    students: { created: 0, matched: 0 },
    problems: [],
  };
  const db = await getDb();

  try {
    await db.transaction(async (tx) => {
      for (const fam of families) {
        const emails = fam.guardians.map((g) => g.email);
        const existing = await tx
          .select({ id: user.id, email: user.email, name: user.name, phone: user.phone, householdId: householdMember.householdId })
          .from(user)
          .leftJoin(householdMember, eq(householdMember.userId, user.id))
          .where(inArray(user.email, emails));
        const households = [...new Set(existing.map((e) => e.householdId).filter(Boolean))] as string[];
        if (households.length > 1) {
          report.problems.push({ where: fam.where, reason: `parents in family ${fam.label} already belong to different households; skipped for a person to sort out` });
          continue;
        }

        let householdId = households[0];
        if (householdId) report.households.matched++;
        else {
          const last = fam.guardians.find((g) => g.name)?.name.split(' ').at(-1);
          const [h] = await tx
            .insert(household)
            .values({ name: fam.name ?? (last ? `${last} family` : `${emails[0].split('@')[0]}’s family`), source: 'studio-director' })
            .returning({ id: household.id });
          householdId = h.id;
          report.households.created++;
        }

        for (const g of fam.guardians) {
          const found = existing.find((e) => e.email === g.email);
          if (found) {
            report.guardians.matched++;
            if (!found.householdId) await tx.insert(householdMember).values({ householdId, userId: found.id });
            if ((!found.name && g.name) || (!found.phone && g.phone)) {
              await tx
                .update(user)
                .set({ name: found.name || g.name, phone: found.phone || g.phone })
                .where(eq(user.id, found.id));
            }
            continue;
          }
          const [u] = await tx
            .insert(user)
            .values({ id: crypto.randomUUID(), name: g.name, email: g.email, emailVerified: false, phone: g.phone })
            .returning({ id: user.id });
          await tx.insert(householdMember).values({ householdId, userId: u.id });
          report.guardians.created++;
        }

        const current = await tx.select().from(student).where(eq(student.householdId, householdId));
        for (const s of fam.students) {
          const match = current.find(
            (c) => c.firstName.toLowerCase() === s.firstName.toLowerCase() && (s.birthdate ? c.birthdate === s.birthdate : c.lastName.toLowerCase() === s.lastName.toLowerCase()),
          );
          if (match) {
            report.students.matched++;
            continue;
          }
          await tx.insert(student).values({
            householdId,
            firstName: s.firstName,
            lastName: s.lastName,
            birthdate: s.birthdate,
            allergiesEnc: encrypt(s.allergies),
            medicalNotesEnc: encrypt(s.medical),
          });
          report.students.created++;
        }
      }
      await tx.insert(auditLog).values({
        action: 'import.studio-director',
        entity: 'import',
        entityId: `${report.households.created}h/${report.guardians.created}g/${report.students.created}s`,
      });
      if (dryRun) throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  return report;
}

// ───────────── "Your account is ready" invitations ─────────────

/** Imported guardians who haven't signed in yet and haven't been invited. */
export async function uninvitedImportedGuardians() {
  const { user, household, householdMember, auditLog } = schema;
  const db = await getDb();
  const invited = db.select({ id: auditLog.entityId }).from(auditLog).where(eq(auditLog.action, 'invite.sent'));
  const rows = await db
    .select({ id: user.id, name: user.name, email: user.email, householdId: household.id })
    .from(user)
    .innerJoin(householdMember, eq(householdMember.userId, user.id))
    .innerJoin(household, eq(household.id, householdMember.householdId))
    .where(and(eq(household.source, 'studio-director'), eq(user.emailVerified, false)));
  const already = new Set((await invited).map((r) => r.id));
  return rows.filter((r) => !already.has(r.id));
}

export async function recordInvite(userId: string) {
  const db = await getDb();
  await db.insert(schema.auditLog).values({ action: 'invite.sent', entity: 'user', entityId: userId });
}
