/**
 * Settings → Staff (docs/back-office.md → Staff roles): who works here, their
 * role, the classes they teach and the dates they cover as a substitute.
 *
 * - Owners in ADMIN_EMAILS are listed but can't be changed here: the server's
 *   settings decide them.
 * - Deactivating someone keeps their records (attendance they marked, notes);
 *   they just can't open staff pages any more. Nobody is deleted.
 * - Every change is written to the audit log (`admin.staff.*`), with the class
 *   or date it concerns in `detail`.
 *
 * Callers check requireStaff, and requireFreshStaff before a change.
 */
import { and, asc, eq, gte, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Program, Session } from '@/content/types';
import type { SiteContent } from '@/content/site-content';
import { todayInAthens } from '@/lib/pricing';
import { staffSession, whenLabel } from './classes';
import { getDb, schema } from './db';
import { audit } from './records';
import { isEnvOwner, type StaffRole } from './staff';
import { sendCoverEmails } from './attendance';
import { meetsOn } from './teachers';

const { staff, classTeacher, classCover } = schema;

type Catalog = Pick<SiteContent, 'programs' | 'findSession'>;

/** A step staff can't take; the message is safe to show them. */
export class StaffSettingsError extends Error {}

export const NAME_MAX = 80;

export const staffInput = z.object({
  email: z.string().trim().toLowerCase().max(200).pipe(z.email('Enter their email address.')),
  name: z.string().trim().min(1, 'Enter their name.').max(NAME_MAX, `Keep the name under ${NAME_MAX} characters.`),
  role: z.enum(['owner', 'teacher'], { message: 'Choose Teacher or Owner.' }),
});

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? 'Check the form and try again.';

export interface StaffListRow {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  active: boolean;
  /** In ADMIN_EMAILS: always an owner, can't be changed here. */
  fixed: boolean;
  classCount: number;
}

/** Everyone, active first, then by name. ADMIN_EMAILS owners who haven't signed in yet aren't in the table, so they're listed from the settings. */
export async function staffList(adminEmails: string[]): Promise<StaffListRow[]> {
  const db = await getDb();
  const rows = await db.select().from(staff).orderBy(asc(staff.name));
  const counts = new Map<string, number>();
  for (const r of await db.select({ staffId: classTeacher.staffId }).from(classTeacher)) counts.set(r.staffId, (counts.get(r.staffId) ?? 0) + 1);
  const out: StaffListRow[] = rows.map((r) => {
    const fixed = isEnvOwner(r.email);
    return { id: r.id, email: r.email, name: r.name, role: fixed ? 'owner' : r.role, active: fixed || r.active, fixed, classCount: counts.get(r.id) ?? 0 };
  });
  for (const email of adminEmails) {
    if (!rows.some((r) => r.email === email)) out.push({ id: '', email, name: email, role: 'owner', active: true, fixed: true, classCount: 0 });
  }
  return out.sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
}

export async function staffById(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(staff).where(eq(staff.id, id));
  return row ? { ...row, fixed: isEnvOwner(row.email), role: isEnvOwner(row.email) ? ('owner' as const) : row.role } : undefined;
}

/** Add a teacher or an owner. Someone already on the list (even deactivated) can't be added twice. */
export async function addStaff(byUserId: string, raw: z.input<typeof staffInput>) {
  const parsed = staffInput.safeParse(raw);
  if (!parsed.success) throw new StaffSettingsError(firstIssue(parsed.error));
  const input = parsed.data;
  const db = await getDb();
  const [existing] = await db.select().from(staff).where(eq(staff.email, input.email));
  if (existing || isEnvOwner(input.email)) {
    throw new StaffSettingsError(existing && !existing.active ? `${input.email} is already on the list, turned off. Open them to turn them back on.` : `${input.email} is already on staff.`);
  }
  const [row] = await db.insert(staff).values({ ...input, createdBy: byUserId }).returning();
  await audit(byUserId, 'admin.staff.add', 'staff', row.id, input.role);
  return row;
}

/** Change a name or role. ADMIN_EMAILS owners stay owners (their name can change), and you can't take away your own owner role. */
export async function updateStaff(byUserId: string, byEmail: string, id: string, raw: { name: string; role: string }) {
  const person = await staffById(id);
  if (!person) throw new StaffSettingsError('That person wasn’t found.');
  // An ADMIN_EMAILS owner keeps the owner role; only their name can change.
  if (person.fixed && raw.role !== 'owner') throw new StaffSettingsError('This owner is set in the site’s settings and can’t be changed here.');
  const parsed = staffInput.omit({ email: true }).safeParse(raw);
  if (!parsed.success) throw new StaffSettingsError(firstIssue(parsed.error));
  if (person.email === byEmail.toLowerCase() && parsed.data.role !== 'owner') throw new StaffSettingsError('You can’t remove your own owner role. Ask another owner.');
  const db = await getDb();
  await db.update(staff).set(parsed.data).where(eq(staff.id, id));
  await audit(byUserId, 'admin.staff.update', 'staff', id, parsed.data.role === person.role ? undefined : parsed.data.role);
}

/** Turn someone off (they can't open staff pages; records stay) or back on. */
export async function setStaffActive(byUserId: string, byEmail: string, id: string, active: boolean) {
  const person = await staffById(id);
  if (!person) throw new StaffSettingsError('That person wasn’t found.');
  if (person.fixed) throw new StaffSettingsError('This owner is set in the site’s settings and can’t be turned off here.');
  if (!active && person.email === byEmail.toLowerCase()) throw new StaffSettingsError('You can’t turn yourself off. Ask another owner.');
  const db = await getDb();
  await db.update(staff).set({ active }).where(eq(staff.id, id));
  await audit(byUserId, active ? 'admin.staff.reactivate' : 'admin.staff.deactivate', 'staff', id);
}

export interface ClassChoice {
  sessionId: string;
  program: Program;
  session: Session;
  /** "Tue · 4:30–5:30 pm", or a one-off's date */
  when: string;
  /** The session's label when it adds something to `when` ("Ages 7–10"), else '' */
  extra: string;
  /** "Intro to Theater, Tue · 4:30–5:30 pm", for a list of every class */
  label: string;
}

/** Classes that can be assigned: current and upcoming sessions the site takes sign-ups for, by term then title. */
export function assignableClasses(catalog: Catalog, today = todayInAthens()): ClassChoice[] {
  return catalog.programs
    .flatMap((program) =>
      program.sessions
        .filter((s) => staffSession(s) && s.endDate >= today)
        .map((session) => {
          const when = whenLabel(session);
          // A one-off's label is often just its date, already in `when`.
          const extra = session.label && !when.startsWith(session.label) ? session.label : '';
          return { sessionId: session.id, program, session, when, extra, label: [program.title, extra, when].filter(Boolean).join(', ') };
        }),
    )
    .sort((a, b) => a.session.startDate.localeCompare(b.session.startDate) || a.program.title.localeCompare(b.program.title));
}

export type Assignment = 'lead' | 'assistant' | '';

/**
 * Set which of the assignable classes this person teaches: `choices` maps
 * session id → lead, assistant or '' (not teaching). Classes not in
 * `choices` (ended ones) are left as they are.
 */
export async function setClasses(byUserId: string, id: string, choices: Map<string, Assignment>) {
  const person = await staffById(id);
  if (!person) throw new StaffSettingsError('That person wasn’t found.');
  if (!person.active) throw new StaffSettingsError('Turn this person back on before giving them classes.');
  const db = await getDb();
  const sessionIds = [...choices.keys()];
  const current = sessionIds.length ? await db.select().from(classTeacher).where(and(eq(classTeacher.staffId, id), inArray(classTeacher.sessionId, sessionIds))) : [];
  const now = new Map(current.map((r) => [r.sessionId, r.role]));
  const changes: { action: string; sessionId: string; role?: string }[] = [];
  await db.transaction(async (tx) => {
    for (const [sessionId, want] of choices) {
      const had = now.get(sessionId);
      if ((had ?? '') === want) continue;
      if (!want) {
        await tx.delete(classTeacher).where(and(eq(classTeacher.staffId, id), eq(classTeacher.sessionId, sessionId)));
        changes.push({ action: 'admin.staff.class_remove', sessionId });
      } else if (had) {
        await tx.update(classTeacher).set({ role: want }).where(and(eq(classTeacher.staffId, id), eq(classTeacher.sessionId, sessionId)));
        changes.push({ action: 'admin.staff.class_role', sessionId, role: want });
      } else {
        await tx.insert(classTeacher).values({ sessionId, staffId: id, role: want, createdBy: byUserId });
        changes.push({ action: 'admin.staff.class_add', sessionId, role: want });
      }
    }
  });
  for (const c of changes) await audit(byUserId, c.action, 'staff', id, [c.sessionId, c.role].filter(Boolean).join(' '));
  return changes.length;
}

export const coverInput = z.object({
  sessionId: z.string().min(1, 'Choose a class.'),
  classDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the date.'),
  coveringForStaffId: z.string().optional(),
});

/** Add a substitute date: this person teaches that class on that date only. */
export async function addCover(byUserId: string, id: string, raw: z.input<typeof coverInput>, catalog: Catalog, today = todayInAthens()) {
  const person = await staffById(id);
  if (!person) throw new StaffSettingsError('That person wasn’t found.');
  if (!person.active) throw new StaffSettingsError('Turn this person back on before giving them a class.');
  const parsed = coverInput.safeParse(raw);
  if (!parsed.success) throw new StaffSettingsError(firstIssue(parsed.error));
  const { sessionId, classDate } = parsed.data;
  const coveringFor = parsed.data.coveringForStaffId || null;
  const found = catalog.findSession(sessionId);
  if (!found) throw new StaffSettingsError('That class wasn’t found.');
  if (classDate < today) throw new StaffSettingsError('Choose today or a later date.');
  if (!meetsOn(found.session, classDate)) throw new StaffSettingsError(`${found.program.title} doesn’t meet on that date.`);
  if (coveringFor === id) throw new StaffSettingsError('Someone can’t cover for themselves.');
  if (coveringFor && !(await staffById(coveringFor))) throw new StaffSettingsError('Choose who they’re covering for from the list.');
  const db = await getDb();
  const [row] = await db
    .insert(classCover)
    .values({ sessionId, classDate, staffId: id, coveringForStaffId: coveringFor, createdBy: byUserId })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new StaffSettingsError('They’re already covering that class on that date.');
  await audit(byUserId, 'admin.staff.cover_add', 'staff', id, `${sessionId} ${classDate}`);
  // The teacher app: one email to the substitute, and one to the teacher they cover for.
  await sendCoverEmails(row, found);
  return row;
}

export async function removeCover(byUserId: string, id: string, coverId: string) {
  const db = await getDb();
  const [row] = await db
    .delete(classCover)
    .where(and(eq(classCover.id, coverId), eq(classCover.staffId, id)))
    .returning();
  if (!row) throw new StaffSettingsError('That substitute date wasn’t found.');
  await audit(byUserId, 'admin.staff.cover_remove', 'staff', id, `${row.sessionId} ${row.classDate}`);
}

/** This person's classes (session id → lead or assistant) and their substitute dates from today on. */
export async function staffAssignments(id: string, today = todayInAthens()) {
  const db = await getDb();
  const [classes, covers] = await Promise.all([
    db.select().from(classTeacher).where(eq(classTeacher.staffId, id)),
    db
      .select()
      .from(classCover)
      .where(and(eq(classCover.staffId, id), gte(classCover.classDate, today)))
      .orderBy(asc(classCover.classDate)),
  ]);
  return { classes: new Map(classes.map((c) => [c.sessionId, c.role])), covers };
}
