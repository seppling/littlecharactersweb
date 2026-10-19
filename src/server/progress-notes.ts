/**
 * Progress notes: a short note to a family about one child, with the
 * child's "Got it" and "Working on it" skills listed under it (Studio
 * Director's "Report Card"; docs/back-office.md → Progress notes).
 *
 * - A draft (`shared_at` empty) holds only the note's words. Teachers write
 *   one from the teacher app's Skills view; it waits for Hannah ("Progress
 *   notes to send" on the class page). Hannah writes them from the family or
 *   the class page.
 * - Sending (owners): the skill lists are picked then and written into the
 *   body, which is what the family reads. The email goes through
 *   sendMessage (kind `family`, so it's on the family's "Emails sent"); the
 *   note keeps the email's id and `shared_at`. Families see shared notes in
 *   their account, under the child.
 * - Staff only until shared. Logged with ids (`admin.progress_note.*`,
 *   `teach.progress_note.draft`); never the text.
 */
import { and, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { SiteContent } from '@/content/site-content';
import { todayInAthens } from '@/lib/pricing';
import { expectedOn, type Viewer } from './attendance';
import { getDb, schema } from './db';
import { familyAudience, footerFor, sendMessage, type SendOptions } from './messages';
import { audit } from './records';
import { childSkills, skillDateFor } from './skills';

const { progressNote, student, household, user, staff } = schema;

type Catalog = Pick<SiteContent, 'findSession'>;

export const PROGRESS_NOTE_MAX = 2000;

export class ProgressNoteError extends Error {}

export function cleanNoteBody(raw: string) {
  const body = raw.replace(/\r\n?/g, '\n').trim();
  if (!body) throw new ProgressNoteError('Write the note first.');
  if (body.length > PROGRESS_NOTE_MAX) throw new ProgressNoteError(`Keep a progress note under ${PROGRESS_NOTE_MAX} characters.`);
  return body;
}

/** The text the family reads: the note, then the skills picked, a line each. */
export function composeProgressNote(note: string, gotIt: string[], working: string[]) {
  const list = (title: string, names: string[]) => (names.length ? `${title}\n${names.map((n) => `• ${n}`).join('\n')}` : '');
  return [note.trim(), list('Got it:', gotIt), list('Working on it:', working)].filter(Boolean).join('\n\n');
}

/** "Maya’s progress in Intro to Theater" */
export const progressSubject = (firstName: string, classTitle?: string | null) => `${firstName}’s progress${classTitle ? ` in ${classTitle}` : ''}`;

export interface NoteView {
  id: string;
  studentId: string;
  householdId: string;
  sessionId: string | null;
  childFirst: string;
  child: string;
  family: string;
  /** The class's title, when the note is about one. */
  classTitle: string | null;
  body: string;
  author: string;
  sharedAt: Date | null;
  messageId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The name in Settings → Staff first (teachers often have no account name), then the account's. */
const authorName = (u: { staffName: string | null; name: string | null; email: string | null }) => u.staffName || u.name || u.email || 'Former staff';

async function notesWhere(where: ReturnType<typeof and>, catalog: Catalog): Promise<NoteView[]> {
  const db = await getDb();
  const rows = await db
    .select({ note: progressNote, firstName: student.firstName, lastName: student.lastName, family: household.name, authorName: user.name, authorEmail: user.email, staffName: staff.name })
    .from(progressNote)
    .innerJoin(student, eq(student.id, progressNote.studentId))
    .innerJoin(household, eq(household.id, progressNote.householdId))
    .leftJoin(user, eq(user.id, progressNote.authorUserId))
    .leftJoin(staff, eq(staff.email, sql`lower(${user.email})`))
    .where(where)
    .orderBy(desc(progressNote.updatedAt));
  return rows.map((r) => ({
    id: r.note.id,
    studentId: r.note.studentId,
    householdId: r.note.householdId,
    sessionId: r.note.sessionId,
    childFirst: r.firstName,
    child: `${r.firstName} ${r.lastName}`,
    family: r.family,
    classTitle: r.note.sessionId ? (catalog.findSession(r.note.sessionId)?.program.title ?? null) : null,
    body: r.note.body,
    author: authorName({ staffName: r.staffName, name: r.authorName, email: r.authorEmail }),
    sharedAt: r.note.sharedAt,
    messageId: r.note.messageId,
    createdAt: r.note.createdAt,
    updatedAt: r.note.updatedAt,
  }));
}

export async function getNote(id: string, catalog: Catalog) {
  if (!id) return null;
  return (await notesWhere(and(eq(progressNote.id, id)), catalog))[0] ?? null;
}

/** "Progress notes to send": a class's drafts, newest first. */
export const draftsForClass = (sessionId: string, catalog: Catalog) => notesWhere(and(eq(progressNote.sessionId, sessionId), isNull(progressNote.sharedAt)), catalog);

/** Every note about these children, drafts and sent, newest first, by child. */
export async function notesForStudents(studentIds: string[], catalog: Catalog) {
  const out = new Map<string, NoteView[]>();
  if (!studentIds.length) return out;
  for (const n of await notesWhere(and(inArray(progressNote.studentId, studentIds)), catalog)) out.set(n.studentId, [...(out.get(n.studentId) ?? []), n]);
  return out;
}

/** The family's account: shared notes only, by child, newest first. Scoped to their own household by the caller's session. */
export async function sharedNotesFor(householdId: string, catalog: Catalog) {
  const out = new Map<string, { id: string; body: string; sharedAt: Date; classTitle: string | null }[]>();
  for (const n of await notesWhere(and(eq(progressNote.householdId, householdId), isNotNull(progressNote.sharedAt)), catalog)) {
    out.set(n.studentId, [...(out.get(n.studentId) ?? []), { id: n.id, body: n.body, sharedAt: n.sharedAt!, classTitle: n.classTitle }]);
  }
  return out;
}

async function childOf(studentId: string) {
  const db = await getDb();
  const [s] = await db.select({ id: student.id, householdId: student.householdId }).from(student).where(eq(student.id, studentId));
  if (!s) throw new ProgressNoteError('That child isn’t on file any more.');
  return s;
}

/** Hannah writes or changes a draft. A note already sent can't be changed. Returns the note's id. */
export async function saveDraft(userId: string, input: { noteId?: string | null; studentId: string; sessionId?: string | null; body: string }) {
  const body = cleanNoteBody(input.body);
  const db = await getDb();
  if (input.noteId) {
    const [row] = await db.select().from(progressNote).where(eq(progressNote.id, input.noteId));
    if (!row) throw new ProgressNoteError('That note was deleted.');
    if (row.sharedAt) throw new ProgressNoteError('That note was already sent, so it can’t be changed.');
    await db.update(progressNote).set({ body }).where(eq(progressNote.id, row.id));
    await audit(userId, 'admin.progress_note.edit', 'student', row.studentId, row.id);
    return row.id;
  }
  const s = await childOf(input.studentId);
  const [row] = await db.insert(progressNote).values({ studentId: s.id, householdId: s.householdId, sessionId: input.sessionId || null, body, authorUserId: userId }).returning({ id: progressNote.id });
  await audit(userId, 'admin.progress_note.draft', 'student', s.id, row.id);
  return row.id;
}

/**
 * A teacher's draft from the Skills view: one per teacher, child and class,
 * changed in place until Hannah sends it. Needs the Skills view's access to
 * that class date, and the child on that date's roster.
 */
export async function saveTeacherDraft(viewer: Viewer, input: { sessionId: string; date: string; studentId: string; body: string }, catalog: Catalog, today = todayInAthens()) {
  const body = cleanNoteBody(input.body);
  const cd = await skillDateFor(viewer, input.sessionId, input.date, catalog, today);
  if (!cd?.access.edit) throw new ProgressNoteError('You can’t write notes for this class on this date.');
  if (!(await expectedOn(input.sessionId, input.date)).has(input.studentId)) throw new ProgressNoteError('That child isn’t on this class’s roster.');
  const s = await childOf(input.studentId);
  const db = await getDb();
  const [mine] = await db
    .select({ id: progressNote.id })
    .from(progressNote)
    .where(and(eq(progressNote.studentId, s.id), eq(progressNote.sessionId, input.sessionId), eq(progressNote.authorUserId, viewer.userId), isNull(progressNote.sharedAt)));
  if (mine) {
    await db.update(progressNote).set({ body }).where(eq(progressNote.id, mine.id));
    await audit(viewer.userId, 'teach.progress_note.draft', 'student', s.id, mine.id);
    return mine.id;
  }
  const [row] = await db.insert(progressNote).values({ studentId: s.id, householdId: s.householdId, sessionId: input.sessionId, body, authorUserId: viewer.userId }).returning({ id: progressNote.id });
  await audit(viewer.userId, 'teach.progress_note.draft', 'student', s.id, row.id);
  return row.id;
}

/** The teacher's own draft for a child in a class, if one waits. */
export async function teacherDraft(userId: string, sessionId: string, studentIds: string[]) {
  if (!studentIds.length) return new Map<string, string>();
  const db = await getDb();
  const rows = await db
    .select({ studentId: progressNote.studentId, body: progressNote.body })
    .from(progressNote)
    .where(and(inArray(progressNote.studentId, studentIds), eq(progressNote.sessionId, sessionId), eq(progressNote.authorUserId, userId), isNull(progressNote.sharedAt)));
  return new Map(rows.map((r) => [r.studentId, r.body]));
}

export async function deleteDraft(userId: string, noteId: string) {
  const db = await getDb();
  const gone = await db.delete(progressNote).where(and(eq(progressNote.id, noteId), isNull(progressNote.sharedAt))).returning({ studentId: progressNote.studentId });
  if (gone.length) await audit(userId, 'admin.progress_note.delete', 'student', gone[0].studentId, noteId);
  return gone.length > 0;
}

/** The child's skills in the note's class, to pick from: "Got it" and "Working on it". */
export async function skillChoices(note: Pick<NoteView, 'studentId' | 'sessionId'>, catalog: Catalog) {
  const slug = note.sessionId ? catalog.findSession(note.sessionId)?.program.slug : undefined;
  if (!slug) return { gotIt: [], working: [] };
  const classes = (await childSkills([note.studentId], catalog)).get(note.studentId) ?? [];
  const skills = classes.find((c) => c.programSlug === slug)?.skills.filter((s) => !s.retired) ?? [];
  return { gotIt: skills.filter((s) => s.status === 'got_it'), working: skills.filter((s) => s.status === 'working') };
}

export interface NoteDraftInput {
  body: string;
  /** Skill ids ticked under "Got it" and "Working on it". */
  gotIt: string[];
  working: string[];
}

/** What the family would get: subject, body, footer and the parents' addresses. */
export async function previewNote(note: NoteView, input: NoteDraftInput, catalog: Catalog) {
  const text = cleanNoteBody(input.body);
  const choices = await skillChoices(note, catalog);
  const pick = (list: { id: string; name: string }[], ids: string[]) => list.filter((s) => ids.includes(s.id)).map((s) => s.name);
  const audience = await familyAudience(note.householdId);
  return {
    subject: progressSubject(note.childFirst, note.classTitle),
    body: composeProgressNote(text, pick(choices.gotIt, input.gotIt), pick(choices.working, input.working)),
    footer: footerFor(note.classTitle ?? undefined),
    audience,
    emails: [...new Set((audience?.parents ?? []).map((p) => p.email.toLowerCase()))],
  };
}

/**
 * Sends a note to the child's parents, once per token (the review form's).
 * The skill lists are written into the body, the note gets `shared_at` and
 * the email's id, and families see it in their account.
 */
export async function sendProgressNote(staff: { id: string }, noteId: string, input: NoteDraftInput & { token: string }, catalog: Catalog, opts: SendOptions = {}, now = new Date()) {
  const note = await getNote(noteId, catalog);
  if (!note) throw new ProgressNoteError('That note was deleted.');
  if (note.sharedAt) {
    if (note.messageId === input.token) return { messageId: input.token, duplicate: true };
    throw new ProgressNoteError('This note was already sent.');
  }
  const preview = await previewNote(note, input, catalog);
  if (!preview.audience || !preview.emails.length) throw new ProgressNoteError('This family has no parent email on file.');
  const sent = await sendMessage(
    { token: input.token, kind: 'family', subject: preview.subject, body: preview.body, footer: preview.footer, families: [preview.audience], staffId: staff.id },
    opts,
  );
  const db = await getDb();
  await db
    .update(progressNote)
    .set({ body: preview.body, sharedAt: now, messageId: sent.messageId })
    .where(and(eq(progressNote.id, note.id), isNull(progressNote.sharedAt)));
  if (!sent.duplicate) await audit(staff.id, 'admin.progress_note.send', 'student', note.studentId, note.id);
  return sent;
}
