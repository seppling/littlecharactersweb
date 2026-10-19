/**
 * Tags: staff labels on children and families ("Scholarship", "Needs a
 * buddy", a show or a cast group), for filtering rosters and search and for
 * "Email a tag" (docs/back-office.md → Tags).
 *
 * - Staff only. Tags are never shown to families or to teachers: the teacher
 *   app's roster doesn't read them.
 * - A name is unique per kind, whatever the capitals (the table's
 *   `tag_kind_name_idx` on lower(name) enforces it).
 * - Every change is written to the audit log with ids only (`admin.tag.*`).
 */
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import type { SiteContent } from '@/content/site-content';
import { formatPhone } from '@/lib/contacts';
import { todayInAthens } from '@/lib/pricing';
import { getDb, schema } from './db';
import { ageOn } from './family';
import type { AudienceFamily, Parent } from './messages';
import { audit } from './records';

const { tag, studentTag, householdTag, student, household, householdMember, user, enrollment } = schema;

type Catalog = Pick<SiteContent, 'findSession'>;

export type TagKind = 'child' | 'family';
export const TAG_KINDS: TagKind[] = ['child', 'family'];
export const TAG_NAME_MAX = 40;
export const kindLabel = (kind: TagKind) => (kind === 'child' ? 'Children' : 'Families');
const kindWord = (kind: TagKind) => (kind === 'child' ? 'child' : 'family');

export type TagErrorCode = 'empty' | 'long' | 'taken' | 'deleted' | 'kind' | 'none' | 'gone';

/** A change that can't be made. `code` is what a redirect carries (never the tag's or a child's name). */
export class TagError extends Error {
  constructor(
    message: string,
    readonly code: TagErrorCode,
  ) {
    super(message);
  }
}

/** The words for a code that came back in an address. */
export const TAG_ERRORS: Record<TagErrorCode, string> = {
  empty: 'Type a name for the tag.',
  long: 'Keep a tag’s name under 40 characters.',
  taken: 'A tag with that name already exists. Tag names can’t repeat, even with different capitals.',
  deleted: 'That tag was deleted.',
  kind: 'That tag is for the other kind (children or families).',
  none: 'Tick at least one child.',
  gone: 'Those children aren’t on file any more.',
};

export interface TagRow {
  id: string;
  name: string;
  kind: TagKind;
  /** Children or families carrying it. */
  count: number;
}

export interface TagChip {
  id: string;
  name: string;
}

/** A tag's name, tidied: spaces collapsed, 1 to 40 characters. */
export function cleanTagName(raw: string) {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!name) throw new TagError(TAG_ERRORS.empty, 'empty');
  if (name.length > TAG_NAME_MAX) throw new TagError(TAG_ERRORS.long, 'long');
  return name;
}

export const isTagKind = (k: string): k is TagKind => k === 'child' || k === 'family';

const taken = (kind: TagKind, name: string) => new TagError(`There’s already a ${kindWord(kind)} tag called “${name}”. Tag names can’t repeat, even with different capitals.`, 'taken');
const isUniqueViolation = (e: unknown) => {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === '23505' || err?.cause?.code === '23505';
};

async function sameName(kind: TagKind, name: string, exceptId?: string) {
  const db = await getDb();
  const [row] = await db
    .select({ id: tag.id, name: tag.name })
    .from(tag)
    .where(and(eq(tag.kind, kind), sql`lower(${tag.name}) = lower(${name})`, exceptId ? ne(tag.id, exceptId) : undefined));
  return row ?? null;
}

/** Every tag of each kind, A to Z, with how many carry it. */
export async function listTags(): Promise<TagRow[]> {
  const db = await getDb();
  const kids = sql<number>`(select count(*)::int from ${studentTag} st where st.tag_id = ${tag.id})`;
  const fams = sql<number>`(select count(*)::int from ${householdTag} ht where ht.tag_id = ${tag.id})`;
  const rows = await db
    .select({ id: tag.id, name: tag.name, kind: tag.kind, kids, fams })
    .from(tag)
    .orderBy(sql`lower(${tag.name})`);
  return rows.map((r) => ({ id: r.id, name: r.name, kind: r.kind, count: r.kind === 'child' ? r.kids : r.fams }));
}

export async function getTag(id: string): Promise<TagRow | null> {
  if (!id) return null;
  return (await listTags()).find((t) => t.id === id) ?? null;
}

export async function createTag(userId: string, kind: TagKind, rawName: string) {
  const name = cleanTagName(rawName);
  const same = await sameName(kind, name);
  if (same) throw taken(kind, same.name);
  const db = await getDb();
  try {
    const [row] = await db.insert(tag).values({ kind, name, createdBy: userId }).returning();
    await audit(userId, 'admin.tag.create', 'tag', row.id, kind);
    return row;
  } catch (e) {
    if (isUniqueViolation(e)) throw taken(kind, name);
    throw e;
  }
}

/** "Pick or type a new one": the tag of that kind with this name (any capitals), made if there's none. */
export async function findOrCreateTag(userId: string, kind: TagKind, rawName: string) {
  const name = cleanTagName(rawName);
  const same = await sameName(kind, name);
  if (same) return { id: same.id, name: same.name, created: false };
  const row = await createTag(userId, kind, name);
  return { id: row.id, name: row.name, created: true };
}

export async function renameTag(userId: string, id: string, rawName: string) {
  const name = cleanTagName(rawName);
  const db = await getDb();
  const [row] = await db.select().from(tag).where(eq(tag.id, id));
  if (!row) throw new TagError(TAG_ERRORS.deleted, 'deleted');
  const same = await sameName(row.kind, name, id);
  if (same) throw taken(row.kind, same.name);
  try {
    await db.update(tag).set({ name }).where(eq(tag.id, id));
  } catch (e) {
    if (isUniqueViolation(e)) throw taken(row.kind, name);
    throw e;
  }
  await audit(userId, 'admin.tag.rename', 'tag', id);
  return { ...row, name };
}

/** Deletes a tag and takes it off everyone (the joins cascade). Returns how many carried it, or null when it was already gone. */
export async function deleteTag(userId: string, id: string) {
  const t = await getTag(id);
  if (!t) return null;
  const db = await getDb();
  await db.delete(tag).where(eq(tag.id, id));
  await audit(userId, 'admin.tag.delete', 'tag', id, `${t.kind}, on ${t.count}`);
  return t.count;
}

async function tagOfKind(id: string, kind: TagKind) {
  const db = await getDb();
  const [row] = await db.select().from(tag).where(eq(tag.id, id));
  if (!row) throw new TagError(TAG_ERRORS.deleted, 'deleted');
  if (row.kind !== kind) throw new TagError(kind === 'child' ? 'That’s a family tag. Pick a child tag.' : 'That’s a child tag. Pick a family tag.', 'kind');
  return row;
}

/** Adds a child tag to these children ("Tag selected"). Returns how many didn't have it yet. Each one is logged. */
export async function tagStudents(userId: string, tagId: string, studentIds: string[]) {
  await tagOfKind(tagId, 'child');
  const ids = [...new Set(studentIds.filter(Boolean))];
  if (!ids.length) throw new TagError(TAG_ERRORS.none, 'none');
  const db = await getDb();
  const known = await db.select({ id: student.id }).from(student).where(inArray(student.id, ids));
  if (!known.length) throw new TagError(TAG_ERRORS.gone, 'gone');
  const added = await db
    .insert(studentTag)
    .values(known.map((s) => ({ studentId: s.id, tagId, createdBy: userId })))
    .onConflictDoNothing()
    .returning({ studentId: studentTag.studentId });
  for (const a of added) await audit(userId, 'admin.tag.add', 'student', a.studentId, tagId);
  return added.length;
}

export async function untagStudent(userId: string, tagId: string, studentId: string) {
  const db = await getDb();
  const gone = await db.delete(studentTag).where(and(eq(studentTag.tagId, tagId), eq(studentTag.studentId, studentId))).returning({ studentId: studentTag.studentId });
  if (gone.length) await audit(userId, 'admin.tag.remove', 'student', studentId, tagId);
  return gone.length > 0;
}

export async function tagHousehold(userId: string, tagId: string, householdId: string) {
  await tagOfKind(tagId, 'family');
  const db = await getDb();
  const added = await db.insert(householdTag).values({ householdId, tagId, createdBy: userId }).onConflictDoNothing().returning({ householdId: householdTag.householdId });
  if (added.length) await audit(userId, 'admin.tag.add', 'household', householdId, tagId);
  return added.length > 0;
}

export async function untagHousehold(userId: string, tagId: string, householdId: string) {
  const db = await getDb();
  const gone = await db.delete(householdTag).where(and(eq(householdTag.tagId, tagId), eq(householdTag.householdId, householdId))).returning({ householdId: householdTag.householdId });
  if (gone.length) await audit(userId, 'admin.tag.remove', 'household', householdId, tagId);
  return gone.length > 0;
}

/** Each child's tags, A to Z. */
export async function tagsForStudents(studentIds: string[]): Promise<Map<string, TagChip[]>> {
  const out = new Map<string, TagChip[]>();
  if (!studentIds.length) return out;
  const db = await getDb();
  const rows = await db
    .select({ owner: studentTag.studentId, id: tag.id, name: tag.name })
    .from(studentTag)
    .innerJoin(tag, eq(tag.id, studentTag.tagId))
    .where(inArray(studentTag.studentId, [...new Set(studentIds)]))
    .orderBy(sql`lower(${tag.name})`);
  for (const r of rows) out.set(r.owner, [...(out.get(r.owner) ?? []), { id: r.id, name: r.name }]);
  return out;
}

/** Each family's tags, A to Z. */
export async function tagsForHouseholds(householdIds: string[]): Promise<Map<string, TagChip[]>> {
  const out = new Map<string, TagChip[]>();
  if (!householdIds.length) return out;
  const db = await getDb();
  const rows = await db
    .select({ owner: householdTag.householdId, id: tag.id, name: tag.name })
    .from(householdTag)
    .innerJoin(tag, eq(tag.id, householdTag.tagId))
    .where(inArray(householdTag.householdId, [...new Set(householdIds)]))
    .orderBy(sql`lower(${tag.name})`);
  for (const r of rows) out.set(r.owner, [...(out.get(r.owner) ?? []), { id: r.id, name: r.name }]);
  return out;
}

/** The roster filter: only the children carrying this tag (all of them when there's no tag). */
export function withTag<T extends { studentId: string }>(children: T[], tags: Map<string, TagChip[]>, tagId: string | null | undefined) {
  if (!tagId) return children;
  return children.filter((c) => tags.get(c.studentId)?.some((t) => t.id === tagId));
}

// ───────────── Who carries a tag ─────────────

export interface TaggedChild {
  studentId: string;
  householdId: string;
  name: string;
  age: number | null;
  family: string;
  /** Current classes, by title (enrollments not cancelled, in a class that hasn't ended). */
  classes: string[];
}

export interface TaggedFamily {
  householdId: string;
  name: string;
  parents: { name: string; email: string; phone: string }[];
  children: string[];
  classes: string[];
}

export type TagMembers = { kind: 'child'; children: TaggedChild[] } | { kind: 'family'; families: TaggedFamily[] };

async function currentClasses(studentIds: string[], catalog: Catalog, today: string) {
  const out = new Map<string, string[]>();
  if (!studentIds.length) return out;
  const db = await getDb();
  const rows = await db
    .select({ studentId: enrollment.studentId, sessionId: enrollment.sessionId, status: enrollment.status })
    .from(enrollment)
    .where(and(inArray(enrollment.studentId, studentIds), ne(enrollment.status, 'cancelled')));
  for (const r of rows) {
    const found = catalog.findSession(r.sessionId);
    if (!found || found.session.endDate < today) continue;
    const label = r.status === 'active' ? found.program.title : `${found.program.title} (${r.status})`;
    out.set(r.studentId, [...new Set([...(out.get(r.studentId) ?? []), label])]);
  }
  return out;
}

/** The children (child tag) or families (family tag) carrying a tag, A to Z, with their classes. No care details. */
export async function tagMembers(t: Pick<TagRow, 'id' | 'kind'>, catalog: Catalog, today = todayInAthens()): Promise<TagMembers> {
  const db = await getDb();
  if (t.kind === 'child') {
    const rows = await db
      .select({ id: student.id, householdId: household.id, family: household.name, firstName: student.firstName, lastName: student.lastName, birthdate: student.birthdate })
      .from(studentTag)
      .innerJoin(student, eq(student.id, studentTag.studentId))
      .innerJoin(household, eq(household.id, student.householdId))
      .where(eq(studentTag.tagId, t.id))
      .orderBy(asc(student.lastName), asc(student.firstName));
    const classes = await currentClasses(rows.map((r) => r.id), catalog, today);
    return {
      kind: 'child',
      children: rows.map((r) => ({ studentId: r.id, householdId: r.householdId, name: `${r.firstName} ${r.lastName}`, age: ageOn(r.birthdate, today), family: r.family, classes: classes.get(r.id) ?? [] })),
    };
  }
  const fams = await db
    .select({ id: household.id, name: household.name })
    .from(householdTag)
    .innerJoin(household, eq(household.id, householdTag.householdId))
    .where(eq(householdTag.tagId, t.id))
    .orderBy(sql`lower(${household.name})`);
  const ids = fams.map((f) => f.id);
  const [parents, kids] = ids.length
    ? await Promise.all([
        db
          .select({ householdId: householdMember.householdId, name: user.name, email: user.email, phone: user.phone })
          .from(householdMember)
          .innerJoin(user, eq(user.id, householdMember.userId))
          .where(inArray(householdMember.householdId, ids))
          .orderBy(asc(householdMember.createdAt)),
        db
          .select({ id: student.id, householdId: student.householdId, firstName: student.firstName, lastName: student.lastName })
          .from(student)
          .where(inArray(student.householdId, ids))
          .orderBy(asc(student.createdAt)),
      ])
    : [[], []];
  const classes = await currentClasses(kids.map((k) => k.id), catalog, today);
  return {
    kind: 'family',
    families: fams.map((f) => {
      const mine = kids.filter((k) => k.householdId === f.id);
      return {
        householdId: f.id,
        name: f.name,
        parents: parents.filter((p) => p.householdId === f.id).map((p) => ({ name: p.name, email: p.email, phone: formatPhone(p.phone) })),
        children: mine.map((k) => `${k.firstName} ${k.lastName}`),
        classes: [...new Set(mine.flatMap((k) => classes.get(k.id) ?? []))],
      };
    }),
  };
}

/**
 * "Email a tag": the families of the children carrying a child tag, or the
 * families carrying a family tag, A to Z, with their parents (for the
 * composer, ./message-composer.ts).
 */
export async function tagAudience(t: Pick<TagRow, 'id' | 'kind'>): Promise<AudienceFamily[]> {
  const db = await getDb();
  const fams =
    t.kind === 'child'
      ? await db
          .selectDistinct({ id: household.id, name: household.name })
          .from(studentTag)
          .innerJoin(student, eq(student.id, studentTag.studentId))
          .innerJoin(household, eq(household.id, student.householdId))
          .where(eq(studentTag.tagId, t.id))
      : await db
          .select({ id: household.id, name: household.name })
          .from(householdTag)
          .innerJoin(household, eq(household.id, householdTag.householdId))
          .where(eq(householdTag.tagId, t.id));
  if (!fams.length) return [];
  const rows = await db
    .select({ householdId: householdMember.householdId, name: user.name, email: user.email, phone: user.phone })
    .from(householdMember)
    .innerJoin(user, eq(user.id, householdMember.userId))
    .where(inArray(householdMember.householdId, fams.map((f) => f.id)))
    .orderBy(asc(householdMember.createdAt));
  const parents = new Map<string, Parent[]>();
  for (const r of rows) parents.set(r.householdId, [...(parents.get(r.householdId) ?? []), { name: r.name, email: r.email, phone: r.phone }]);
  return fams
    .map((f) => ({ householdId: f.id, name: f.name, waitlist: false, parents: parents.get(f.id) ?? [] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** A tag's list as a table, for its CSV and PDF. */
export function tagTable(members: TagMembers) {
  if (members.kind === 'child') {
    return {
      headers: ['Child', 'Age', 'Family', 'Current classes'],
      rows: members.children.map((c) => [c.name, c.age ?? '', c.family, c.classes.join('\n')]),
    };
  }
  return {
    headers: ['Family', 'Parents', 'Emails', 'Phones', 'Children', 'Current classes'],
    rows: members.families.map((f) => [
      f.name,
      f.parents.map((p) => p.name).join('\n'),
      f.parents.map((p) => p.email).join('\n'),
      f.parents.map((p) => p.phone).filter(Boolean).join('\n'),
      f.children.join('\n'),
      f.classes.join('\n'),
    ]),
  };
}
