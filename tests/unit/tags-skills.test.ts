/**
 * Tags, skills and progress notes (src/server/tags.ts, skills.ts,
 * progress-notes.ts): tag names unique per kind in any case, deleting a tag,
 * tagging children in bulk, the roster, search and email filters; who may
 * tick skills on which date (teacher, substitute on and off their date,
 * owner, turned off); retired skills; a teacher's draft note and an owner
 * sending it; tags never on a teacher's roster.
 */
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Email } from '@/server/email';
import { getDb, schema } from '@/server/db';
import { getCatalog } from '@/server/content';
import { teachRoster, type Viewer } from '@/server/attendance';
import { messageResult } from '@/server/messages';
import { composeProgressNote, draftsForClass, getNote, notesForStudents, previewKey, previewNote, saveDraft, saveTeacherDraft, sendProgressNote, sharedNotesFor, skillChoices, ProgressNoteError } from '@/server/progress-notes';
import {
  addSkill,
  childSkills,
  classSkillGrid,
  moveSkill,
  programSkills,
  renameSkill,
  setSkill,
  setSkillActive,
  skillAccess,
  skillGridTable,
  skillRoster,
  type SkillAccessInput,
} from '@/server/skills';
import { addCover, addStaff, setClasses, setStaffActive } from '@/server/staff-settings';
import {
  TagError,
  createTag,
  deleteTag,
  findOrCreateTag,
  listTags,
  renameTag,
  tagAudience,
  tagHousehold,
  tagMembers,
  tagStudents,
  tagTable,
  tagsForHouseholds,
  tagsForStudents,
  untagStudent,
  withTag,
} from '@/server/tags';

// From the starting content (src/content/seed/programs.ts).
const INTRO = 'intro-f26-tue'; // Tuesdays, Intro to Theater
const INTRO_SLUG = 'intro-to-theater';
const TUE = '2026-10-20';
const hannahUser = 'u-hannah-tags';
let owner: Viewer;
let lead: Viewer;
let sub: Viewer;
let other: Viewer;
let A: string; // household with two children in Intro
let B: string; // household with one child, not in Intro
const kids: Record<string, string> = {};

function outbox() {
  const sent: Email[] = [];
  return { sent, send: async (e: Email) => void sent.push(e), paceMs: 0 };
}

beforeAll(async () => {
  const db = await getDb();
  const catalog = await getCatalog();
  const users = [
    { id: hannahUser, email: 'hannah@example.com' },
    { id: 'u-lead-ts', email: 'lead.ts@example.com' },
    { id: 'u-sub-ts', email: 'sub.ts@example.com' },
    { id: 'u-other-ts', email: 'other.ts@example.com' },
    { id: 'u-off-ts', email: 'off.ts@example.com' },
    { id: 'u-parent-a', email: 'parent.a@example.com' },
    { id: 'u-parent-b', email: 'parent.b@example.com' },
  ];
  for (const u of users) await db.insert(schema.user).values({ ...u, name: u.email, emailVerified: true }).onConflictDoNothing();
  const [h] = await db.insert(schema.staff).values({ email: 'hannah@example.com', name: 'Hannah', role: 'owner' }).returning();
  owner = { userId: hannahUser, staffId: h.id, role: 'owner' };
  const leadRow = await addStaff(hannahUser, { email: 'lead.ts@example.com', name: 'Lee Lead', role: 'teacher' });
  const subRow = await addStaff(hannahUser, { email: 'sub.ts@example.com', name: 'Casey Sub', role: 'teacher' });
  const otherRow = await addStaff(hannahUser, { email: 'other.ts@example.com', name: 'Otto Other', role: 'teacher' });
  lead = { userId: 'u-lead-ts', staffId: leadRow.id, role: 'teacher' };
  sub = { userId: 'u-sub-ts', staffId: subRow.id, role: 'teacher' };
  other = { userId: 'u-other-ts', staffId: otherRow.id, role: 'teacher' };
  await setClasses(hannahUser, leadRow.id, new Map([[INTRO, 'lead']]));
  await addCover(hannahUser, subRow.id, { sessionId: INTRO, classDate: TUE }, catalog, '2026-10-19');

  const [ha] = await db.insert(schema.household).values({ name: 'Rivera Family' }).returning();
  const [hb] = await db.insert(schema.household).values({ name: 'Okafor Family' }).returning();
  A = ha.id;
  B = hb.id;
  await db.insert(schema.householdMember).values([
    { householdId: A, userId: 'u-parent-a' },
    { householdId: B, userId: 'u-parent-b' },
  ]);
  for (const [name, householdId] of [['Ada', A], ['Ben', A], ['Cy', B]] as const) {
    const [s] = await db.insert(schema.student).values({ householdId, firstName: name, lastName: 'Sample', birthdate: '2017-01-01' }).returning();
    kids[name] = s.id;
  }
  await db.insert(schema.enrollment).values([
    { householdId: A, studentId: kids.Ada, sessionId: INTRO, programSlug: INTRO_SLUG, status: 'active' },
    { householdId: A, studentId: kids.Ben, sessionId: INTRO, programSlug: INTRO_SLUG, status: 'trial' },
  ]);
  await db.insert(schema.closure).values({ date: '2026-11-24', sessionId: null, reason: 'Thanksgiving week' });
});

// ───────────── Tags ─────────────

describe('tag names', () => {
  it('are unique per kind, whatever the capitals', async () => {
    await createTag(hannahUser, 'child', 'Needs a buddy');
    await expect(createTag(hannahUser, 'child', 'needs A BUDDY')).rejects.toThrow(/already a child tag called “Needs a buddy”/);
    await expect(createTag(hannahUser, 'child', '  Needs   a buddy ')).rejects.toBeInstanceOf(TagError);
  });
  it('can repeat across kinds', async () => {
    await createTag(hannahUser, 'child', 'Scholarship');
    await expect(createTag(hannahUser, 'family', 'scholarship')).resolves.toMatchObject({ kind: 'family', name: 'scholarship' });
  });
  it('the table itself refuses a second one, any case', async () => {
    const db = await getDb();
    await expect(db.insert(schema.tag).values({ kind: 'child', name: 'SCHOLARSHIP' })).rejects.toThrow();
  });
  it('are tidied and limited in length', async () => {
    await expect(createTag(hannahUser, 'child', '   ')).rejects.toMatchObject({ code: 'empty' });
    await expect(createTag(hannahUser, 'child', 'x'.repeat(41))).rejects.toMatchObject({ code: 'long' });
  });
  it('rename keeps the rule', async () => {
    const t = await createTag(hannahUser, 'child', 'Annie: orphans');
    await expect(renameTag(hannahUser, t.id, 'scholarship')).rejects.toMatchObject({ code: 'taken' });
    await expect(renameTag(hannahUser, t.id, 'Annie: Orphans')).resolves.toMatchObject({ name: 'Annie: Orphans' });
  });
  it('“pick or type”: an existing name in other capitals is the same tag', async () => {
    const t = await findOrCreateTag(hannahUser, 'child', 'NEEDS A BUDDY');
    expect(t).toMatchObject({ name: 'Needs a buddy', created: false });
    expect((await findOrCreateTag(hannahUser, 'child', 'Level 2')).created).toBe(true);
  });
});

describe('tagging', () => {
  it('bulk-tags children from a roster, once each, and counts them', async () => {
    const t = (await listTags()).find((x) => x.kind === 'child' && x.name === 'Level 2')!;
    expect(await tagStudents(hannahUser, t.id, [kids.Ada, kids.Ben, kids.Ada])).toBe(2);
    expect(await tagStudents(hannahUser, t.id, [kids.Ada])).toBe(0);
    expect((await listTags()).find((x) => x.id === t.id)?.count).toBe(2);
    const db = await getDb();
    const logged = await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, 'admin.tag.add'));
    expect(logged.filter((l) => l.detail === t.id).map((l) => l.entityId).sort()).toEqual([kids.Ada, kids.Ben].sort());
  });
  it('refuses a family tag on a child, and nobody ticked', async () => {
    const fam = (await listTags()).find((x) => x.kind === 'family')!;
    await expect(tagStudents(hannahUser, fam.id, [kids.Ada])).rejects.toMatchObject({ code: 'kind' });
    const child = (await listTags()).find((x) => x.kind === 'child')!;
    await expect(tagStudents(hannahUser, child.id, [])).rejects.toMatchObject({ code: 'none' });
  });
  it('filters a roster by a child tag', async () => {
    const t = (await listTags()).find((x) => x.name === 'Level 2')!;
    const roster = [{ studentId: kids.Ada }, { studentId: kids.Ben }, { studentId: kids.Cy }];
    const tags = await tagsForStudents(roster.map((r) => r.studentId));
    expect(withTag(roster, tags, t.id).map((r) => r.studentId)).toEqual([kids.Ada, kids.Ben]);
    expect(withTag(roster, tags, null)).toHaveLength(3);
  });
  it('search by tag lists the children with their family and classes', async () => {
    const t = (await listTags()).find((x) => x.name === 'Level 2')!;
    const m = await tagMembers(t, await getCatalog(), TUE);
    expect(m.kind).toBe('child');
    if (m.kind !== 'child') return;
    expect(m.children.map((c) => c.name)).toEqual(['Ada Sample', 'Ben Sample']);
    expect(m.children[0]).toMatchObject({ family: 'Rivera Family', classes: ['Intro to Theater'] });
    expect(m.children[1].classes).toEqual(['Intro to Theater (trial)']);
    expect(tagTable(m).headers).toEqual(['Child', 'Age', 'Family', 'Current classes']);
  });
  it('a family tag: its families, for search and email', async () => {
    const fam = await createTag(hannahUser, 'family', 'Volunteers');
    expect(await tagHousehold(hannahUser, fam.id, B)).toBe(true);
    expect(await tagHousehold(hannahUser, fam.id, B)).toBe(false);
    expect((await tagsForHouseholds([A, B])).get(B)?.map((t) => t.name)).toEqual(['Volunteers']);
    const m = await tagMembers({ id: fam.id, kind: 'family' }, await getCatalog(), TUE);
    expect(m.kind === 'family' && m.families.map((f) => f.name)).toEqual(['Okafor Family']);
    expect((await tagAudience({ id: fam.id, kind: 'family' })).map((f) => f.householdId)).toEqual([B]);
  });
  it('emailing a child tag reaches each child’s family once', async () => {
    const t = (await listTags()).find((x) => x.name === 'Level 2')!;
    const audience = await tagAudience(t);
    expect(audience.map((f) => f.householdId)).toEqual([A]);
    expect(audience[0].parents.map((p) => p.email)).toEqual(['parent.a@example.com']);
  });
  it('removing one tag from one child', async () => {
    const t = (await listTags()).find((x) => x.name === 'Level 2')!;
    expect(await untagStudent(hannahUser, t.id, kids.Ben)).toBe(true);
    expect(await untagStudent(hannahUser, t.id, kids.Ben)).toBe(false);
    expect((await tagsForStudents([kids.Ben])).get(kids.Ben)).toBeUndefined();
  });
  it('deleting a tag takes it off everyone', async () => {
    const t = await createTag(hannahUser, 'child', 'Cast A');
    await tagStudents(hannahUser, t.id, [kids.Ada, kids.Cy]);
    expect(await deleteTag(hannahUser, t.id)).toBe(2);
    const db = await getDb();
    expect(await db.select().from(schema.studentTag).where(eq(schema.studentTag.tagId, t.id))).toHaveLength(0);
    expect(await deleteTag(hannahUser, t.id)).toBeNull();
  });
});

// ───────────── Skills ─────────────

describe('skillAccess (pure)', () => {
  const base: SkillAccessInput = { role: 'teacher', teaches: true, meets: true, dayOff: null, date: TUE, today: TUE };
  const at = (over: Partial<SkillAccessInput>) => skillAccess({ ...base, ...over });
  it('a teacher ticks their class today and on past dates', () => {
    expect(at({})).toEqual({ view: true, edit: true, why: 'ok' });
    expect(at({ date: '2026-09-01' }).edit).toBe(true);
  });
  it('a future date is read-only for teachers, open for owners', () => {
    expect(at({ date: '2026-10-27' })).toEqual({ view: true, edit: false, why: 'future' });
    expect(at({ role: 'owner', teaches: false, date: '2026-10-27' }).edit).toBe(true);
  });
  it('not their class, or a date it doesn’t meet: nothing', () => {
    expect(at({ teaches: false }).view).toBe(false);
    expect(at({ meets: false, role: 'owner' }).view).toBe(false);
  });
  it('a day off: seen, not ticked by teachers', () => expect(at({ dayOff: 'Thanksgiving' })).toMatchObject({ view: true, edit: false, why: 'day-off' }));
});

describe('skills', () => {
  let skillIds: string[] = [];
  beforeAll(async () => {
    for (const name of ['Projects voice', 'Stays in character', 'Takes direction']) skillIds.push((await addSkill(hannahUser, INTRO_SLUG, name)).id);
  });

  it('are kept in order, can be moved and renamed, and names don’t repeat', async () => {
    expect((await programSkills(INTRO_SLUG)).map((s) => s.name)).toEqual(['Projects voice', 'Stays in character', 'Takes direction']);
    await moveSkill(hannahUser, skillIds[2], 'up');
    expect((await programSkills(INTRO_SLUG)).map((s) => s.name)).toEqual(['Projects voice', 'Takes direction', 'Stays in character']);
    expect(await moveSkill(hannahUser, skillIds[0], 'up')).toBe(false);
    await expect(addSkill(hannahUser, INTRO_SLUG, 'projects VOICE')).rejects.toThrow(/already on this list/);
    await renameSkill(hannahUser, skillIds[0], 'Projects their voice');
  });

  const tick = (v: Viewer, studentId: string, skillId: string, status: 'not_yet' | 'working' | 'got_it', date = TUE, today = TUE) =>
    getCatalog().then((c) => setSkill(v, { sessionId: INTRO, date, studentId, skillId, status }, c, new Date(), today));

  it('the class’s teacher ticks a child; the change is logged with old and new', async () => {
    expect(await tick(lead, kids.Ada, skillIds[0], 'working')).toEqual({ ok: true, status: 'working', changed: true });
    expect(await tick(lead, kids.Ada, skillIds[0], 'got_it')).toMatchObject({ ok: true, changed: true });
    expect(await tick(lead, kids.Ada, skillIds[0], 'got_it')).toMatchObject({ ok: true, changed: false });
    const db = await getDb();
    const log = await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, 'teach.skill.change'));
    expect(log.map((l) => l.detail)).toEqual([`${INTRO} ${TUE} ${skillIds[0]}: not_yet → working`, `${INTRO} ${TUE} ${skillIds[0]}: working → got_it`]);
    expect(log.every((l) => l.entityId === kids.Ada)).toBe(true);
  });

  it('a substitute ticks on their cover date only', async () => {
    expect(await tick(sub, kids.Ben, skillIds[1], 'working')).toMatchObject({ ok: true });
    expect(await tick(sub, kids.Ben, skillIds[1], 'got_it', '2026-10-13')).toEqual({ ok: false, why: 'no-access' });
  });

  it('another teacher can’t, an owner can at any time, nobody on a day off but owners', async () => {
    expect(await tick(other, kids.Ada, skillIds[1], 'working')).toEqual({ ok: false, why: 'no-access' });
    expect(await tick(lead, kids.Ada, skillIds[1], 'working', '2026-10-27')).toEqual({ ok: false, why: 'future' });
    expect(await tick(owner, kids.Ben, skillIds[2], 'working', '2026-10-27')).toMatchObject({ ok: true });
    expect(await tick(lead, kids.Ada, skillIds[1], 'working', '2026-11-24', '2026-11-25')).toEqual({ ok: false, why: 'day-off' });
  });

  it('only children on that date’s roster, and only the class’s own skills', async () => {
    expect(await tick(lead, kids.Cy, skillIds[0], 'working')).toEqual({ ok: false, why: 'not-on-roster' });
    const other = await addSkill(hannahUser, 'yes-and-improv', 'Says yes, and');
    expect(await tick(lead, kids.Ada, other.id, 'working')).toEqual({ ok: false, why: 'not-found' });
  });

  it('“Not yet” clears the mark', async () => {
    await tick(lead, kids.Ada, skillIds[2], 'working');
    await tick(lead, kids.Ada, skillIds[2], 'not_yet');
    const db = await getDb();
    expect((await db.select().from(schema.studentSkill).where(eq(schema.studentSkill.skillId, skillIds[2]))).filter((r) => r.studentId === kids.Ada)).toHaveLength(0);
  });

  it('a turned-off teacher can’t tick', async () => {
    const off = await addStaff(hannahUser, { email: 'off.ts@example.com', name: 'Off Teacher', role: 'teacher' });
    await setClasses(hannahUser, off.id, new Map([[INTRO, 'assistant']]));
    const v: Viewer = { userId: 'u-off-ts', staffId: off.id, role: 'teacher' };
    expect(await tick(v, kids.Ada, skillIds[1], 'working')).toMatchObject({ ok: true });
    await setStaffActive(hannahUser, 'hannah@example.com', off.id, false);
    expect(await tick(v, kids.Ada, skillIds[1], 'got_it')).toEqual({ ok: false, why: 'no-access' });
  });

  it('the class grid and its worksheet', async () => {
    const found = (await getCatalog()).findSession(INTRO)!;
    const grid = await classSkillGrid(found.program, found.session);
    expect(grid.children.map((c) => c.name)).toEqual(['Ada Sample', 'Ben Sample']);
    const table = skillGridTable(grid);
    expect(table.headers).toEqual(['Child', 'Projects their voice', 'Takes direction', 'Stays in character', 'Got it']);
    expect(table.rows[0]).toEqual(['Ada Sample', 'Got it', '', 'Working', 1]);
  });

  it('a retired skill leaves the teacher’s list and the grid, and stays on the child', async () => {
    await setSkillActive(hannahUser, skillIds[0], false);
    const found = (await getCatalog()).findSession(INTRO)!;
    const { skills } = await skillRoster(found.program, INTRO, TUE, lead.userId);
    expect(skills.map((s) => s.id)).not.toContain(skillIds[0]);
    expect((await classSkillGrid(found.program, found.session)).skills.map((s) => s.id)).not.toContain(skillIds[0]);
    expect(await tick(lead, kids.Ada, skillIds[0], 'working')).toEqual({ ok: false, why: 'retired' });
    const mine = (await childSkills([kids.Ada], await getCatalog())).get(kids.Ada)!;
    const retired = mine[0].skills.find((s) => s.id === skillIds[0]);
    expect(retired).toMatchObject({ status: 'got_it', retired: true, markedBy: 'Lee Lead' });
    await setSkillActive(hannahUser, skillIds[0], true);
    expect((await programSkills(INTRO_SLUG)).at(-1)?.id).toBe(skillIds[0]);
  });
});

// ───────────── Progress notes ─────────────

describe('progress notes', () => {
  it('lists the skills picked under the note', () => {
    expect(composeProgressNote('Ada had a great term.', ['Projects voice'], ['Takes direction', 'Stays in character'])).toBe(
      'Ada had a great term.\n\nGot it:\n• Projects voice\n\nWorking on it:\n• Takes direction\n• Stays in character',
    );
    expect(composeProgressNote('Just the note.', [], [])).toBe('Just the note.');
  });

  it('a teacher writes a draft for Hannah; it waits on the class page, and the family can’t see it', async () => {
    const c = await getCatalog();
    const id = await saveTeacherDraft(lead, { sessionId: INTRO, date: TUE, studentId: kids.Ada, body: 'Ada spoke up in every scene.' }, c, TUE);
    // A second save changes the same draft.
    expect(await saveTeacherDraft(lead, { sessionId: INTRO, date: TUE, studentId: kids.Ada, body: 'Ada spoke up in every scene!' }, c, TUE)).toBe(id);
    const drafts = await draftsForClass(INTRO, c);
    expect(drafts.map((d) => [d.id, d.child, d.author, d.body])).toEqual([[id, 'Ada Sample', 'Lee Lead', 'Ada spoke up in every scene!']]);
    expect((await sharedNotesFor(A, c)).size).toBe(0);
  });

  it('teachers can’t write for a class that isn’t theirs, or a child not on it', async () => {
    const c = await getCatalog();
    await expect(saveTeacherDraft(other, { sessionId: INTRO, date: TUE, studentId: kids.Ada, body: 'Hi' }, c, TUE)).rejects.toBeInstanceOf(ProgressNoteError);
    await expect(saveTeacherDraft(lead, { sessionId: INTRO, date: TUE, studentId: kids.Cy, body: 'Hi' }, c, TUE)).rejects.toThrow(/roster/);
  });

  it('Hannah previews and sends it once; the family sees it, and it’s on their emails', async () => {
    const c = await getCatalog();
    const [draft] = await draftsForClass(INTRO, c);
    const note = (await getNote(draft.id, c))!;
    const choices = await skillChoices(note, c);
    expect(choices.gotIt.map((s) => s.name)).toEqual(['Projects their voice']);
    expect(choices.working.map((s) => s.name)).toEqual(['Stays in character']);
    const preview = await previewNote(note, { body: note.body, gotIt: choices.gotIt.map((s) => s.id), working: [] }, c);
    expect(preview.subject).toBe('Ada’s progress in Intro to Theater');
    expect(preview.emails).toEqual(['parent.a@example.com']);
    expect(preview.body).toBe('Ada spoke up in every scene!\n\nGot it:\n• Projects their voice');

    const box = outbox();
    // Changed after the preview (a teacher saved it again): refused, nothing sent.
    const stale = { body: note.body, gotIt: choices.gotIt.map((s) => s.id), working: [], token: crypto.randomUUID(), seen: previewKey(preview) };
    await saveDraft(hannahUser, { noteId: note.id, studentId: note.studentId, body: 'Ada spoke up in every scene! She also helped the younger ones.' });
    await expect(sendProgressNote({ id: hannahUser }, note.id, stale, c, box)).rejects.toThrow(/changed after you previewed/);
    expect(box.sent).toHaveLength(0);
    await saveDraft(hannahUser, { noteId: note.id, studentId: note.studentId, body: 'Ada spoke up in every scene!' });

    const token = crypto.randomUUID();
    const input = { body: note.body, gotIt: choices.gotIt.map((s) => s.id), working: [], token, seen: previewKey(preview) };
    expect(await sendProgressNote({ id: hannahUser }, note.id, input, c, box)).toEqual({ messageId: token, duplicate: false });
    // A double click sends nothing more.
    expect(await sendProgressNote({ id: hannahUser }, note.id, input, c, box)).toEqual({ messageId: token, duplicate: true });
    expect(box.sent).toHaveLength(1);
    expect(box.sent[0].to).toEqual(['parent.a@example.com']);
    expect(box.sent[0].subject).toBe('Ada’s progress in Intro to Theater');

    const sent = (await getNote(note.id, c))!;
    expect(sent.sharedAt).not.toBeNull();
    expect(sent.messageId).toBe(token);
    expect(sent.body).toContain('Got it:\n• Projects their voice');
    expect((await messageResult(token))?.families.map((f) => f.householdId)).toEqual([A]);
    expect((await sharedNotesFor(A, c)).get(kids.Ada)?.map((n) => n.id)).toEqual([note.id]);
    expect(await draftsForClass(INTRO, c)).toHaveLength(0);
    // Another token can't send it again.
    await expect(sendProgressNote({ id: hannahUser }, note.id, { ...input, token: crypto.randomUUID() }, c, box)).rejects.toThrow(/already sent/);
    // Only that family's notes.
    expect((await sharedNotesFor(B, c)).size).toBe(0);
    expect((await notesForStudents([kids.Ada], c)).get(kids.Ada)).toHaveLength(1);
  });
});

describe('tags stay with staff', () => {
  it('a teacher’s roster and Skills view carry no tags', async () => {
    const t = await createTag(hannahUser, 'child', 'Secret staff label');
    await tagStudents(hannahUser, t.id, [kids.Ada, kids.Ben]);
    const roster = await teachRoster(INTRO, TUE, lead.userId, 'view', TUE);
    expect(roster.length).toBeGreaterThan(0);
    expect(JSON.stringify(roster)).not.toContain('Secret staff label');
    expect(roster.every((c) => !('tags' in c))).toBe(true);
    const found = (await getCatalog()).findSession(INTRO)!;
    expect(JSON.stringify(await skillRoster(found.program, INTRO, TUE, lead.userId))).not.toContain('Secret staff label');
  });
  it('nor does the family’s view of their progress notes', async () => {
    expect(JSON.stringify([...(await sharedNotesFor(A, await getCatalog())).values()])).not.toContain('Secret staff label');
  });
});
