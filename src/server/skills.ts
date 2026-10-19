/**
 * Skills: what a class works on, per program, and where each child is with
 * them (docs/back-office.md → Skills).
 *
 * - Settings → Skills (owners): a program's skills in order; add, rename,
 *   move up or down, retire (`active = false`: the child's progress stays, and
 *   the skill drops off the teacher's list) or bring back.
 * - The teacher app's Skills view: Not yet · Working on it · Got it per child
 *   and skill (`student_skill`: no row, `working`, `got_it`). The same people
 *   as attendance may open it (skillAccess); saving needs signal.
 * - Hannah's side: the class's grid (the "Class Skills Worksheet"), and each
 *   child's skills by class on the family page ("Student Skills").
 *
 * Audit entries hold ids, the class and the date; never names.
 */
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { Program, Session } from '@/content/types';
import type { SiteContent } from '@/content/site-content';
import { todayInAthens } from '@/lib/pricing';
import { expectedOn, initials, isIsoDate, shortName, type Viewer } from './attendance';
import { dayOffOn } from './class-day';
import { classLine } from './classes';
import type { PdfTable } from './downloads';
import { getDb, schema } from './db';
import { audit } from './records';
import { canTeach, meetsOn } from './teachers';

const { skill, studentSkill, student, enrollment, user } = schema;

type Catalog = Pick<SiteContent, 'findSession'>;

export const SKILL_NAME_MAX = 80;
export const SKILL_STATUSES = ['not_yet', 'working', 'got_it'] as const;
export type SkillStatus = (typeof SKILL_STATUSES)[number];
export const SKILL_LABELS: Record<SkillStatus, string> = { not_yet: 'Not yet', working: 'Working on it', got_it: 'Got it' };
export const isSkillStatus = (s: unknown): s is SkillStatus => typeof s === 'string' && (SKILL_STATUSES as readonly string[]).includes(s);

export class SkillError extends Error {}

// ───────────── Settings → Skills ─────────────

export type SkillRow = typeof skill.$inferSelect;

/** A program's skills in order: active first by position, then retired. */
export async function programSkills(programSlug: string, opts: { retired?: boolean } = {}): Promise<SkillRow[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(skill)
    .where(and(eq(skill.programSlug, programSlug), opts.retired ? undefined : eq(skill.active, true)))
    .orderBy(asc(skill.position), asc(skill.createdAt));
  return [...rows.filter((r) => r.active), ...rows.filter((r) => !r.active)];
}

/** How many active and retired skills each program has. */
export async function skillCounts() {
  const db = await getDb();
  const rows = await db
    .select({ slug: skill.programSlug, active: sql<number>`count(*) filter (where ${skill.active})::int`, retired: sql<number>`count(*) filter (where not ${skill.active})::int` })
    .from(skill)
    .groupBy(skill.programSlug);
  return new Map(rows.map((r) => [r.slug, { active: r.active, retired: r.retired }]));
}

export function cleanSkillName(raw: string) {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!name) throw new SkillError('Type the skill first.');
  if (name.length > SKILL_NAME_MAX) throw new SkillError(`Keep a skill under ${SKILL_NAME_MAX} characters.`);
  return name;
}

async function sameSkill(programSlug: string, name: string, exceptId?: string) {
  const db = await getDb();
  const [row] = await db
    .select({ id: skill.id, name: skill.name })
    .from(skill)
    .where(and(eq(skill.programSlug, programSlug), sql`lower(${skill.name}) = lower(${name})`, exceptId ? ne(skill.id, exceptId) : undefined));
  return row ?? null;
}

/** Adds a skill at the end of the program's list. */
export async function addSkill(userId: string, programSlug: string, rawName: string) {
  const name = cleanSkillName(rawName);
  const same = await sameSkill(programSlug, name);
  if (same) throw new SkillError(`“${same.name}” is already on this list. Bring it back if it was retired.`);
  const db = await getDb();
  const [{ last }] = await db.select({ last: sql<number>`coalesce(max(${skill.position}), -1)::int` }).from(skill).where(eq(skill.programSlug, programSlug));
  const [row] = await db.insert(skill).values({ programSlug, name, position: last + 1, createdBy: userId }).returning();
  await audit(userId, 'admin.skill.add', 'skill', row.id, programSlug);
  return row;
}

async function skillRow(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(skill).where(eq(skill.id, id));
  if (!row) throw new SkillError('That skill wasn’t found.');
  return row;
}

export async function renameSkill(userId: string, id: string, rawName: string) {
  const name = cleanSkillName(rawName);
  const row = await skillRow(id);
  const same = await sameSkill(row.programSlug, name, id);
  if (same) throw new SkillError(`“${same.name}” is already on this list.`);
  const db = await getDb();
  await db.update(skill).set({ name }).where(eq(skill.id, id));
  await audit(userId, 'admin.skill.rename', 'skill', id, row.programSlug);
}

/**
 * Moves an active skill one place up or down among the program's active
 * skills. The list is renumbered 0, 1, 2… so positions stay tidy.
 */
export async function moveSkill(userId: string, id: string, direction: 'up' | 'down') {
  const row = await skillRow(id);
  const list = (await programSkills(row.programSlug)).map((s) => s.id);
  const i = list.indexOf(id);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const [position, sid] of list.entries()) await tx.update(skill).set({ position }).where(eq(skill.id, sid));
  });
  await audit(userId, 'admin.skill.move', 'skill', id, `${row.programSlug} ${direction}`);
  return true;
}

/** Retire (false) or bring back (true). Brought back, a skill goes to the end of the list. Children's progress is kept either way. */
export async function setSkillActive(userId: string, id: string, active: boolean) {
  const row = await skillRow(id);
  if (row.active === active) return false;
  const db = await getDb();
  const [{ last }] = await db.select({ last: sql<number>`coalesce(max(${skill.position}), -1)::int` }).from(skill).where(eq(skill.programSlug, row.programSlug));
  const position = active ? last + 1 : row.position;
  await db.update(skill).set({ active, position }).where(eq(skill.id, id));
  await audit(userId, active ? 'admin.skill.reactivate' : 'admin.skill.retire', 'skill', id, row.programSlug);
  return true;
}

// ───────────── Who may tick skills ─────────────

export type SkillAccessWhy = 'ok' | 'no-access' | 'not-meeting' | 'day-off' | 'future';

export interface SkillAccessInput {
  role: 'owner' | 'teacher';
  /** canTeach(staffId, sessionId, date): their own class, or a class they cover that date. */
  teaches: boolean;
  meets: boolean;
  dayOff: string | null;
  date: string;
  today: string;
}

/**
 * The attendance rule's people (teachAccess), for skills: a teacher opens a
 * class they can teach that date, and ticks skills on any date it meets up
 * to today (not a day off). A substitute only on their cover date. Owners
 * open any class date and tick at any time.
 */
export function skillAccess(a: SkillAccessInput): { view: boolean; edit: boolean; why: SkillAccessWhy } {
  if (a.role === 'teacher' && !a.teaches) return { view: false, edit: false, why: 'no-access' };
  if (!a.meets) return { view: false, edit: false, why: 'not-meeting' };
  if (a.role === 'owner') return { view: true, edit: true, why: 'ok' };
  if (a.dayOff) return { view: true, edit: false, why: 'day-off' };
  if (a.date > a.today) return { view: true, edit: false, why: 'future' };
  return { view: true, edit: true, why: 'ok' };
}

/** Everything skillAccess needs for one class date. Null when the class isn't in the content or the date isn't a date. */
export async function skillDateFor(viewer: Viewer, sessionId: string, date: string, catalog: Catalog, today = todayInAthens()) {
  const found = catalog.findSession(sessionId);
  if (!found || !isIsoDate(date)) return null;
  const [teaches, dayOff] = await Promise.all([viewer.role === 'owner' ? Promise.resolve(true) : canTeach(viewer.staffId, sessionId, date), dayOffOn(sessionId, date)]);
  const access = skillAccess({ role: viewer.role, teaches, meets: meetsOn(found.session, date), dayOff: dayOff?.reason ?? null, date, today });
  return { ...found, date, dayOff, access };
}

// ───────────── The teacher app's Skills view ─────────────

export interface SkillChild {
  studentId: string;
  householdId: string;
  firstName: string;
  /** "Maya R." */
  shortName: string;
  initials: string;
  statuses: Record<string, SkillStatus>;
}

const statusesFor = async (studentIds: string[], skillIds: string[]) => {
  const out = new Map<string, Record<string, SkillStatus>>();
  if (!studentIds.length || !skillIds.length) return out;
  const db = await getDb();
  const rows = await db
    .select({ studentId: studentSkill.studentId, skillId: studentSkill.skillId, status: studentSkill.status })
    .from(studentSkill)
    .where(and(inArray(studentSkill.studentId, studentIds), inArray(studentSkill.skillId, skillIds)));
  for (const r of rows) out.set(r.studentId, { ...(out.get(r.studentId) ?? {}), [r.skillId]: r.status });
  return out;
};

/**
 * The children expected on a class date (as on the attendance roster), by
 * first name, with where each is on the program's active skills. Names and
 * statuses only: no care details, and no tags. Logged as `teach.skills.view`.
 */
export async function skillRoster(program: Program, sessionId: string, date: string, viewerUserId: string) {
  const [expected, skills] = await Promise.all([expectedOn(sessionId, date), programSkills(program.slug)]);
  await audit(viewerUserId, 'teach.skills.view', 'session', sessionId, date);
  const ids = [...expected.keys()];
  if (!ids.length) return { skills, children: [] as SkillChild[] };
  const db = await getDb();
  const [kids, statuses] = await Promise.all([
    db.select({ id: student.id, householdId: student.householdId, firstName: student.firstName, lastName: student.lastName }).from(student).where(inArray(student.id, ids)),
    statusesFor(ids, skills.map((s) => s.id)),
  ]);
  const children = kids
    .map((k) => ({ studentId: k.id, householdId: k.householdId, firstName: k.firstName, shortName: shortName(k.firstName, k.lastName), initials: initials(k.firstName, k.lastName), statuses: statuses.get(k.id) ?? {} }))
    .sort((a, b) => a.shortName.localeCompare(b.shortName));
  return { skills, children };
}

export type SetSkillResult = { ok: true; status: SkillStatus; changed: boolean } | { ok: false; why: SkillAccessWhy | 'not-on-roster' | 'not-found' | 'retired' };

/**
 * One tick from the Skills view. Checks the access rule, that the skill is an
 * active skill of the class's program, and that the child is expected that
 * date. "Not yet" removes the row. A change is logged with the old and new
 * status (`teach.skill.change`, the class and date in `detail`).
 */
export async function setSkill(
  viewer: Viewer,
  input: { sessionId: string; date: string; studentId: string; skillId: string; status: SkillStatus },
  catalog: Catalog,
  now = new Date(),
  today = todayInAthens(now),
): Promise<SetSkillResult> {
  const cd = await skillDateFor(viewer, input.sessionId, input.date, catalog, today);
  if (!cd) return { ok: false, why: 'not-found' };
  if (!cd.access.edit) return { ok: false, why: cd.access.why };
  const db = await getDb();
  const [row] = await db.select().from(skill).where(eq(skill.id, input.skillId));
  if (!row || row.programSlug !== cd.program.slug) return { ok: false, why: 'not-found' };
  if (!row.active) return { ok: false, why: 'retired' };
  if (!(await expectedOn(input.sessionId, input.date)).has(input.studentId)) return { ok: false, why: 'not-on-roster' };

  const [before] = await db.select().from(studentSkill).where(and(eq(studentSkill.studentId, input.studentId), eq(studentSkill.skillId, input.skillId)));
  const old: SkillStatus = before?.status ?? 'not_yet';
  if (old === input.status) return { ok: true, status: old, changed: false };
  if (input.status === 'not_yet') {
    await db.delete(studentSkill).where(and(eq(studentSkill.studentId, input.studentId), eq(studentSkill.skillId, input.skillId)));
  } else {
    await db
      .insert(studentSkill)
      .values({ studentId: input.studentId, skillId: input.skillId, status: input.status, markedBy: viewer.userId, markedAt: now })
      .onConflictDoUpdate({ target: [studentSkill.studentId, studentSkill.skillId], set: { status: input.status, markedBy: viewer.userId, markedAt: now } });
  }
  await audit(viewer.userId, 'teach.skill.change', 'student', input.studentId, `${input.sessionId} ${input.date} ${input.skillId}: ${old} → ${input.status}`);
  return { ok: true, status: input.status, changed: true };
}

// ───────────── Hannah's side ─────────────

export interface SkillGrid {
  skills: SkillRow[];
  children: { studentId: string; householdId: string; name: string; statuses: Record<string, SkillStatus> }[];
}

/** The class's grid: its enrolled and trial children (by last name) × the program's active skills. */
export async function classSkillGrid(program: Program, session: Session): Promise<SkillGrid> {
  const db = await getDb();
  const [skills, kids] = await Promise.all([
    programSkills(program.slug),
    db
      .select({ id: student.id, householdId: student.householdId, firstName: student.firstName, lastName: student.lastName })
      .from(enrollment)
      .innerJoin(student, eq(student.id, enrollment.studentId))
      .where(and(eq(enrollment.sessionId, session.id), inArray(enrollment.status, ['active', 'trial'])))
      .orderBy(asc(student.lastName), asc(student.firstName)),
  ]);
  const statuses = await statusesFor(kids.map((k) => k.id), skills.map((s) => s.id));
  return { skills, children: kids.map((k) => ({ studentId: k.id, householdId: k.householdId, name: `${k.firstName} ${k.lastName}`, statuses: statuses.get(k.id) ?? {} })) };
}

/** The worksheet's words: blank is not yet. */
const SHORT: Record<SkillStatus, string> = { not_yet: '', working: 'Working', got_it: 'Got it' };

export function skillGridTable(grid: SkillGrid) {
  return {
    headers: ['Child', ...grid.skills.map((s) => s.name), 'Got it'],
    rows: grid.children.map((c) => [c.name, ...grid.skills.map((s) => SHORT[c.statuses[s.id] ?? 'not_yet']), grid.skills.filter((s) => c.statuses[s.id] === 'got_it').length]),
  };
}

/** "Class Skills Worksheet: <class>", as a PDF: a row per child, a column per skill. */
export async function skillGridPdf({ program, session }: { program: Program; session: Session }, location: string | undefined): Promise<PdfTable> {
  const { headers, rows } = skillGridTable(await classSkillGrid(program, session));
  return {
    title: `Class Skills Worksheet: ${program.title}`,
    subtitle: `${classLine(session, location)} · Blank means not yet`,
    columns: headers.map((header, i) => ({ header, weight: i === 0 ? 3 : 2, align: i === headers.length - 1 ? 'right' : 'left' })),
    rows,
    orientation: headers.length > 5 ? 'landscape' : 'portrait',
  };
}

export interface ChildSkill {
  id: string;
  name: string;
  status: SkillStatus;
  retired: boolean;
  markedAt: Date | null;
  markedBy: string | null;
}

export interface ChildSkillClass {
  programSlug: string;
  title: string;
  /** The child's latest class of that program (for "Write a progress note"). */
  sessionId: string;
  skills: ChildSkill[];
}

/**
 * Each child's skills by class ("Student Skills"): every program they're
 * signed up for (not cancelled) that has skills, newest class first, with
 * each skill's status and when and by whom it was marked. Retired skills are
 * listed when the child has progress on them.
 */
export async function childSkills(studentIds: string[], catalog: Catalog): Promise<Map<string, ChildSkillClass[]>> {
  const out = new Map<string, ChildSkillClass[]>();
  if (!studentIds.length) return out;
  const db = await getDb();
  const enrolled = await db
    .select({ studentId: enrollment.studentId, sessionId: enrollment.sessionId, createdAt: enrollment.createdAt })
    .from(enrollment)
    .where(and(inArray(enrollment.studentId, studentIds), ne(enrollment.status, 'cancelled')))
    .orderBy(asc(enrollment.createdAt));
  // Each child's programs, with their latest class of each.
  const programsOf = new Map<string, Map<string, { title: string; sessionId: string; endDate: string }>>();
  for (const e of enrolled) {
    const found = catalog.findSession(e.sessionId);
    if (!found) continue;
    const mine = programsOf.get(e.studentId) ?? new Map();
    const had = mine.get(found.program.slug);
    if (!had || found.session.endDate >= had.endDate) mine.set(found.program.slug, { title: found.program.title, sessionId: e.sessionId, endDate: found.session.endDate });
    programsOf.set(e.studentId, mine);
  }
  const slugs = [...new Set([...programsOf.values()].flatMap((m) => [...m.keys()]))];
  if (!slugs.length) return out;
  const [skills, marks] = await Promise.all([
    db.select().from(skill).where(inArray(skill.programSlug, slugs)).orderBy(asc(skill.position), asc(skill.createdAt)),
    db
      .select({ studentId: studentSkill.studentId, skillId: studentSkill.skillId, status: studentSkill.status, markedAt: studentSkill.markedAt, byName: user.name, byEmail: user.email })
      .from(studentSkill)
      .leftJoin(user, eq(user.id, studentSkill.markedBy))
      .where(inArray(studentSkill.studentId, studentIds)),
  ]);
  const markOf = new Map(marks.map((m) => [`${m.studentId} ${m.skillId}`, m]));
  for (const [studentId, programs] of programsOf) {
    const classes: ChildSkillClass[] = [];
    for (const [slug, p] of [...programs].sort((a, b) => b[1].endDate.localeCompare(a[1].endDate))) {
      const list = skills
        .filter((s) => s.programSlug === slug)
        .map((s) => {
          const m = markOf.get(`${studentId} ${s.id}`);
          return { id: s.id, name: s.name, status: (m?.status ?? 'not_yet') as SkillStatus, retired: !s.active, markedAt: m?.markedAt ?? null, markedBy: m ? m.byName || m.byEmail || 'Former staff' : null };
        })
        .filter((s) => !s.retired || s.status !== 'not_yet');
      if (list.length) classes.push({ programSlug: slug, title: p.title, sessionId: p.sessionId, skills: [...list.filter((s) => !s.retired), ...list.filter((s) => s.retired)] });
    }
    if (classes.length) out.set(studentId, classes);
  }
  return out;
}
