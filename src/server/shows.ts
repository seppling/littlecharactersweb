/**
 * Shows: cast lists, roles and rehearsals (docs/back-office.md → Shows).
 *
 * - The shows are the content's events of kind `show`. The cast is
 *   `show_cast` (one row per child and role; a child can have more than one
 *   role), in `position` order. Photo permission is read from
 *   `student.photo_consent`, never copied into the cast.
 * - Suggestions: children enrolled (active or trial) in the performing
 *   classes' current sessions (`performers`, program slugs).
 * - Rehearsals are `show_rehearsal`: start and end as instants, entered and
 *   shown in Athens time; `session_ids` are the classes that rehearse (none =
 *   the whole cast). They reach the staff calendar, the teachers' Today (for
 *   teachers of the rehearsing classes), and the families of children in the
 *   cast and in a rehearsing class.
 *
 * No money: casting charges nothing (the performance fee is charged at
 * sign-up). Every cast change and download is written to the audit log with
 * ids only; children's names never go in a URL or a log line.
 */
import { and, asc, eq, gte, inArray, lt } from 'drizzle-orm';
import { z } from 'zod';
import type { EventItem, Program, Session } from '@/content/types';
import type { SiteContent } from '@/content/site-content';
import { formatPhone } from '@/lib/contacts';
import { timeRange } from '@/lib/format';
import { todayInAthens } from '@/lib/pricing';
import { athensNow } from '@/lib/session-dates';
import { staffSession } from './classes';
import { getDb, schema } from './db';
import { searchStaff } from './families';
import { audit } from './records';
import type { AudienceFamily } from './messages';

const { showCast, showRehearsal, student, household, householdMember, user, enrollment, classTeacher } = schema;

type Content = Pick<SiteContent, 'events' | 'programs' | 'findSession' | 'locationById'>;

export const ROLE_MAX = 80;
export const GROUP_MAX = 60;
export const NOTE_MAX = 300;

export class ShowError extends Error {}

// ───────────── Athens time ─────────────

/** An Athens wall-clock date and time ("2026-11-14", "10:00") as an instant, across daylight-saving changes. */
export function athensInstant(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  const want = `${date}T${time}`;
  // Athens is UTC−4 (summer) or UTC−5 (winter). Try both; a time skipped in spring falls back to −5.
  for (const offset of [4, 5]) {
    const t = new Date(wall + offset * 3_600_000);
    if (athensNow(t) === want) return t;
  }
  return new Date(wall + 5 * 3_600_000);
}

/** An instant as Athens date and time: { date: "2026-11-14", time: "10:00" }. */
export function athensParts(t: Date) {
  const s = athensNow(t);
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
}

const dayLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** "Sat, Nov 14, 10 am–12 pm" */
export function rehearsalWhen(r: { startsAt: Date; endsAt: Date }) {
  const a = athensParts(r.startsAt);
  const b = athensParts(r.endsAt);
  return `${dayLabel(a.date)}, ${timeRange(a.time, b.time)}`;
}

// ───────────── Shows ─────────────

export const isShow = (e: EventItem) => e.kind === 'show';

export function findShow(content: Pick<Content, 'events'>, slug: string) {
  return content.events.find((e) => isShow(e) && e.slug === slug) ?? null;
}

/** The show's first date (YYYY-MM-DD), or null while it has none. */
export const showFirstDate = (e: EventItem) => [...e.times].sort((a, b) => a.start.localeCompare(b.start))[0]?.start.slice(0, 10) ?? null;
const showLastDate = (e: EventItem) => [...e.times].sort((a, b) => b.start.localeCompare(a.start))[0]?.start.slice(0, 10) ?? null;

/** Still to come (or undated): its last performance is today or later. */
export const showUpcoming = (e: EventItem, today: string) => (e.times.length ? showLastDate(e)! >= today : true);

/** "Sun, Sep 27, 1:30 pm", "Fri, Dec 11 and Sat, Dec 12", or "Date to come (December 2026)". */
export function showDatesLabel(e: EventItem) {
  if (!e.times.length) {
    const month = e.tba ? new Date(`${e.tba}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : '';
    return month ? `Date to come (${month})` : 'Date to come';
  }
  const times = [...e.times].sort((a, b) => a.start.localeCompare(b.start));
  const time = (t: string) => {
    const [h, m] = t.slice(11, 16).split(':').map(Number);
    return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
  };
  if (times.length === 1) return `${dayLabel(times[0].start.slice(0, 10))}, ${time(times[0].start)}`;
  const days = [...new Set(times.map((t) => t.start.slice(0, 10)))].map(dayLabel);
  return days.length === 1 ? `${days[0]}, ${times.map((t) => time(t.start)).join(' and ')}` : `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;
}

/** The performing classes' programs, as the content names them. */
export const performingPrograms = (e: EventItem, content: Pick<Content, 'programs'>) =>
  (e.performers ?? []).map((slug) => content.programs.find((p) => p.slug === slug)).filter((p): p is Program => !!p);

/**
 * The performing classes' current sessions on a date: the staff sessions of
 * the performing programs that haven't ended by then. When none are left
 * (a past show), the ones that ran on the show's first date.
 */
export function performingSessions(e: EventItem, content: Pick<Content, 'programs'>, on: string): { program: Program; session: Session }[] {
  const all = performingPrograms(e, content).flatMap((program) => program.sessions.filter(staffSession).map((session) => ({ program, session })));
  const current = all.filter((s) => s.session.endDate >= on);
  if (current.length) return current;
  const first = showFirstDate(e);
  return first ? all.filter((s) => s.session.startDate <= first && s.session.endDate >= first) : [];
}

/** Children in each show's cast (each child once, whatever their roles). */
export async function castCounts(): Promise<Map<string, number>> {
  const db = await getDb();
  const rows = await db.selectDistinct({ showSlug: showCast.showSlug, studentId: showCast.studentId }).from(showCast);
  const out = new Map<string, number>();
  for (const r of rows) out.set(r.showSlug, (out.get(r.showSlug) ?? 0) + 1);
  return out;
}

export interface ShowSummary {
  event: EventItem;
  dates: string;
  performers: Program[];
  cast: number;
  upcoming: boolean;
}

/** Pure: the shows, upcoming first (soonest first, undated last), then past ones (latest first). */
export function showList(events: EventItem[], counts: Map<string, number>, content: Pick<Content, 'programs'>, today: string) {
  const shows: ShowSummary[] = events.filter(isShow).map((event) => ({ event, dates: showDatesLabel(event), performers: performingPrograms(event, content), cast: counts.get(event.slug) ?? 0, upcoming: showUpcoming(event, today) }));
  const key = (s: ShowSummary) => showFirstDate(s.event) ?? `${s.event.tba ?? '9999-12'}-99`;
  return {
    upcoming: shows.filter((s) => s.upcoming).sort((a, b) => key(a).localeCompare(key(b)) || a.event.title.localeCompare(b.event.title)),
    past: shows.filter((s) => !s.upcoming).sort((a, b) => key(b).localeCompare(key(a))),
  };
}

// ───────────── The cast ─────────────

export type PhotoPermission = 'yes' | 'no' | 'not-asked';
export const photoPermission = (consent: boolean | null): PhotoPermission => (consent === true ? 'yes' : consent === false ? 'no' : 'not-asked');
export const photoLabel: Record<PhotoPermission, string> = { yes: 'Photos: yes', no: 'No photos', 'not-asked': 'Photos: not asked' };
const photoWord: Record<PhotoPermission, string> = { yes: 'Yes', no: 'No', 'not-asked': 'Not asked' };

export interface CastRow {
  id: string;
  studentId: string;
  householdId: string;
  firstName: string;
  lastName: string;
  family: string;
  role: string;
  group: string;
  position: number;
  photo: PhotoPermission;
}

/** The cast in order: by position, then when added. */
export async function castList(slug: string): Promise<CastRow[]> {
  const db = await getDb();
  const rows = await db
    .select({
      id: showCast.id,
      studentId: showCast.studentId,
      householdId: student.householdId,
      firstName: student.firstName,
      lastName: student.lastName,
      family: household.name,
      role: showCast.role,
      group: showCast.castGroup,
      position: showCast.position,
      photoConsent: student.photoConsent,
    })
    .from(showCast)
    .innerJoin(student, eq(student.id, showCast.studentId))
    .innerJoin(household, eq(household.id, student.householdId))
    .where(eq(showCast.showSlug, slug))
    .orderBy(asc(showCast.position), asc(showCast.createdAt), asc(showCast.id));
  return rows.map(({ photoConsent, group, ...r }) => ({ ...r, group: group ?? '', photo: photoPermission(photoConsent) }));
}

export interface Suggestion {
  program: Program;
  session: Session;
  children: { studentId: string; name: string; family: string; trial: boolean; inCast: boolean }[];
}

/** Children enrolled (active or trial) in the performing classes' current sessions, by class, A to Z. */
export async function castSuggestions(e: EventItem, content: Pick<Content, 'programs'>, today = todayInAthens()): Promise<Suggestion[]> {
  const sessions = performingSessions(e, content, today);
  if (!sessions.length) return [];
  const db = await getDb();
  const [rows, cast] = await Promise.all([
    db
      .select({ sessionId: enrollment.sessionId, status: enrollment.status, studentId: student.id, firstName: student.firstName, lastName: student.lastName, family: household.name })
      .from(enrollment)
      .innerJoin(student, eq(student.id, enrollment.studentId))
      .innerJoin(household, eq(household.id, enrollment.householdId))
      .where(and(inArray(enrollment.sessionId, sessions.map((s) => s.session.id)), inArray(enrollment.status, ['active', 'trial']))),
    db.selectDistinct({ studentId: showCast.studentId }).from(showCast).where(eq(showCast.showSlug, e.slug)),
  ]);
  const inCast = new Set(cast.map((c) => c.studentId));
  return sessions.map((s) => ({
    ...s,
    children: rows
      .filter((r) => r.sessionId === s.session.id)
      .sort((a, b) => a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName))
      .map((r) => ({ studentId: r.studentId, name: `${r.firstName} ${r.lastName}`, family: r.family, trial: r.status === 'trial', inCast: inCast.has(r.studentId) })),
  }));
}

const clean = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * Adds children to the cast, at the end, in the order given. A child already
 * in the cast with the same role is skipped. Returns how many were added.
 */
export async function addToCast(slug: string, studentIds: string[], userId: string, opts: { role?: string; group?: string } = {}) {
  const ids = [...new Set(studentIds)].filter(Boolean);
  if (!ids.length) return 0;
  const role = clean(opts.role ?? '', ROLE_MAX);
  const group = clean(opts.group ?? '', GROUP_MAX) || null;
  const db = await getDb();
  const known = new Set((await db.select({ id: student.id }).from(student).where(inArray(student.id, ids))).map((s) => s.id));
  const last = await db.select({ position: showCast.position }).from(showCast).where(eq(showCast.showSlug, slug)).orderBy(asc(showCast.position));
  let position = last.length ? last[last.length - 1].position + 1 : 0;
  let added = 0;
  for (const id of ids.filter((i) => known.has(i))) {
    const [row] = await db
      .insert(showCast)
      .values({ showSlug: slug, studentId: id, role, castGroup: group, position, createdBy: userId })
      .onConflictDoNothing()
      .returning({ id: showCast.id });
    if (!row) continue;
    position++;
    added++;
    await audit(userId, 'admin.cast.add', 'student', id, slug);
  }
  return added;
}

async function castRow(slug: string, id: string) {
  const db = await getDb();
  const [row] = await db.select().from(showCast).where(and(eq(showCast.id, id), eq(showCast.showSlug, slug)));
  if (!row) throw new ShowError('That part of the cast wasn’t found. Someone may have changed it.');
  return row;
}

/** Changes a role and group. Two rows can't give one child the same role. */
export async function updateCast(slug: string, id: string, input: { role: string; group: string }, userId: string) {
  const row = await castRow(slug, id);
  const role = clean(input.role, ROLE_MAX);
  const group = clean(input.group, GROUP_MAX) || null;
  const db = await getDb();
  const [same] = await db
    .select({ id: showCast.id })
    .from(showCast)
    .where(and(eq(showCast.showSlug, slug), eq(showCast.studentId, row.studentId), eq(showCast.role, role)));
  if (same && same.id !== id) throw new ShowError('This child already has that role.');
  await db.update(showCast).set({ role, castGroup: group }).where(eq(showCast.id, id));
  await audit(userId, 'admin.cast.update', 'student', row.studentId, slug);
}

/** Moves one row up or down the order. Positions are renumbered 0, 1, 2… on the way. */
export async function moveCast(slug: string, id: string, dir: 'up' | 'down', userId: string) {
  const row = await castRow(slug, id);
  const db = await getDb();
  const order = (await db.select({ id: showCast.id }).from(showCast).where(eq(showCast.showSlug, slug)).orderBy(asc(showCast.position), asc(showCast.createdAt), asc(showCast.id))).map((r) => r.id);
  const i = order.indexOf(id);
  const j = dir === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  await db.transaction(async (tx) => {
    for (const [position, rowId] of order.entries()) await tx.update(showCast).set({ position }).where(eq(showCast.id, rowId));
  });
  await audit(userId, 'admin.cast.move', 'student', row.studentId, slug);
}

/** Takes one role off the cast (the child's other roles stay). */
export async function removeCast(slug: string, id: string, userId: string) {
  const row = await castRow(slug, id);
  const db = await getDb();
  await db.delete(showCast).where(eq(showCast.id, id));
  await audit(userId, 'admin.cast.remove', 'student', row.studentId, slug);
}

/** Children found by name for "Add to the cast" (the staff search), with whether they're in the cast already. */
export async function findForCast(q: string, slug: string, catalog: Pick<SiteContent, 'programs'>) {
  const { children } = await searchStaff(q, catalog);
  if (!children.length) return [];
  const db = await getDb();
  const ids = children.map((c) => c.id);
  const [names, cast] = await Promise.all([
    db.select({ id: student.id, firstName: student.firstName, lastName: student.lastName }).from(student).where(inArray(student.id, ids)),
    db.selectDistinct({ studentId: showCast.studentId }).from(showCast).where(and(eq(showCast.showSlug, slug), inArray(showCast.studentId, ids))),
  ]);
  const byId = new Map(names.map((n) => [n.id, n]));
  const inCast = new Set(cast.map((c) => c.studentId));
  return children.map((c) => ({ studentId: c.id, name: `${byId.get(c.id)?.firstName ?? ''} ${byId.get(c.id)?.lastName ?? ''}`.trim(), family: c.family, age: c.age, inCast: inCast.has(c.id) }));
}

// ───────────── Families of the cast ─────────────

/** The cast's families, for "Email the cast", Copy emails and Copy phones (A to Z). */
export async function castAudience(slug: string): Promise<AudienceFamily[]> {
  const cast = await castList(slug);
  const ids = [...new Set(cast.map((c) => c.householdId))];
  if (!ids.length) return [];
  const db = await getDb();
  const [families, parents] = await Promise.all([
    db.select({ id: household.id, name: household.name }).from(household).where(inArray(household.id, ids)),
    db
      .select({ householdId: householdMember.householdId, name: user.name, email: user.email, phone: user.phone })
      .from(householdMember)
      .innerJoin(user, eq(user.id, householdMember.userId))
      .where(inArray(householdMember.householdId, ids))
      .orderBy(asc(householdMember.createdAt)),
  ]);
  return families
    .map((f) => ({ householdId: f.id, name: f.name, waitlist: false, parents: parents.filter((p) => p.householdId === f.id).map(({ name, email, phone }) => ({ name, email, phone })) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The message log's key for a show's emails: kind `class` messages with this in `session_id` (no class id looks like it). */
export const showMessageKey = (slug: string) => `show:${slug}`;

// ───────────── Downloads ─────────────

/** "Cast list for the program": the name as it prints, role and group, in the cast's order. */
export function programTable(cast: CastRow[]) {
  return {
    headers: ['Name', 'Role', 'Group'],
    rows: cast.map((c) => [`${c.firstName} ${c.lastName}`, c.role, c.group]),
  };
}

/**
 * The staff cast sheet: the program's columns plus photo permission, the
 * parents' phones and the performing class each child is in. No care details.
 */
export async function castSheet(slug: string, e: EventItem, content: Pick<Content, 'programs'>, today = todayInAthens()) {
  const cast = await castList(slug);
  const ids = [...new Set(cast.map((c) => c.studentId))];
  const db = await getDb();
  const sessions = performingSessions(e, content, today);
  const [audience, enrolled] = await Promise.all([
    castAudience(slug),
    ids.length && sessions.length
      ? db
          .select({ studentId: enrollment.studentId, sessionId: enrollment.sessionId })
          .from(enrollment)
          .where(and(inArray(enrollment.studentId, ids), inArray(enrollment.sessionId, sessions.map((s) => s.session.id)), inArray(enrollment.status, ['active', 'trial'])))
      : Promise.resolve([]),
  ]);
  const classTitle = (sessionId: string) => {
    const s = sessions.find((x) => x.session.id === sessionId);
    return s ? (s.program.sessions.length > 1 && s.session.label ? `${s.program.title} (${s.session.label})` : s.program.title) : '';
  };
  const classesOf = (studentId: string) => [...new Set(enrolled.filter((r) => r.studentId === studentId).map((r) => classTitle(r.sessionId)))].join(', ');
  const phonesOf = (householdId: string) =>
    (audience.find((f) => f.householdId === householdId)?.parents ?? []).map((p) => (p.phone ? `${p.name}: ${formatPhone(p.phone)}` : p.name)).join('; ');
  return {
    headers: ['Name', 'Role', 'Group', 'Photos', 'Class', 'Parents’ phones'],
    rows: cast.map((c) => [`${c.firstName} ${c.lastName}`, c.role, c.group, photoWord[c.photo], classesOf(c.studentId), phonesOf(c.householdId)]),
  };
}

// ───────────── Rehearsals ─────────────

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
export const rehearsalInput = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
    start: z.string().regex(timeRe, 'Pick a start time'),
    end: z.string().regex(timeRe, 'Pick an end time'),
    locationId: z.string().trim().max(80).optional().transform((v) => v || null),
    note: z.string().max(NOTE_MAX * 2).optional().transform((v) => clean(v ?? '', NOTE_MAX) || null),
    sessionIds: z.array(z.string().max(120)).max(50).default([]),
  })
  .refine((r) => r.end > r.start, { message: 'The end time must be after the start time', path: ['end'] });
export type RehearsalInput = z.input<typeof rehearsalInput>;
export type Rehearsal = typeof showRehearsal.$inferSelect;

function rehearsalValues(input: RehearsalInput, content: Pick<Content, 'locationById' | 'findSession'>) {
  const parsed = rehearsalInput.safeParse(input);
  if (!parsed.success) throw new ShowError(parsed.error.issues[0].message);
  const r = parsed.data;
  if (r.locationId && !content.locationById(r.locationId)) throw new ShowError('Pick a place from the list.');
  return {
    startsAt: athensInstant(r.date, r.start),
    endsAt: athensInstant(r.date, r.end),
    locationId: r.locationId,
    note: r.note,
    sessionIds: [...new Set(r.sessionIds)].filter((id) => !!content.findSession(id)),
  };
}

export async function rehearsalsFor(slug: string): Promise<Rehearsal[]> {
  const db = await getDb();
  return db.select().from(showRehearsal).where(eq(showRehearsal.showSlug, slug)).orderBy(asc(showRehearsal.startsAt));
}

export async function rehearsalById(slug: string, id: string) {
  const db = await getDb();
  const [r] = await db.select().from(showRehearsal).where(and(eq(showRehearsal.id, id), eq(showRehearsal.showSlug, slug)));
  return r ?? null;
}

const detailOf = (slug: string, r: { startsAt: Date }) => `${slug} ${athensParts(r.startsAt).date}`;

export async function addRehearsal(slug: string, input: RehearsalInput, userId: string, content: Pick<Content, 'locationById' | 'findSession'>) {
  const values = rehearsalValues(input, content);
  const db = await getDb();
  const [row] = await db.insert(showRehearsal).values({ showSlug: slug, ...values, createdBy: userId }).returning();
  await audit(userId, 'admin.rehearsal.add', 'show_rehearsal', row.id, detailOf(slug, row));
  return row;
}

/** Changes a rehearsal; returns it as it was, for "Email the families about this change". */
export async function updateRehearsal(slug: string, id: string, input: RehearsalInput, userId: string, content: Pick<Content, 'locationById' | 'findSession'>) {
  const before = await rehearsalById(slug, id);
  if (!before) throw new ShowError('That rehearsal wasn’t found. Someone may have removed it.');
  const values = rehearsalValues(input, content);
  const db = await getDb();
  await db.update(showRehearsal).set(values).where(eq(showRehearsal.id, id));
  await audit(userId, 'admin.rehearsal.update', 'show_rehearsal', id, detailOf(slug, values));
  return before;
}

/** Removes a rehearsal; returns it as it was. */
export async function removeRehearsal(slug: string, id: string, userId: string) {
  const before = await rehearsalById(slug, id);
  if (!before) return null;
  const db = await getDb();
  await db.delete(showRehearsal).where(eq(showRehearsal.id, id));
  await audit(userId, 'admin.rehearsal.remove', 'show_rehearsal', id, detailOf(slug, before));
  return before;
}

/** Rehearsals starting on Athens dates `from` to `to` (inclusive), by start. */
export async function rehearsalsBetween(from: string, to: string): Promise<Rehearsal[]> {
  const db = await getDb();
  const next = new Date(Date.parse(`${to}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  return db
    .select()
    .from(showRehearsal)
    .where(and(gte(showRehearsal.startsAt, athensInstant(from, '00:00')), lt(showRehearsal.startsAt, athensInstant(next, '00:00'))))
    .orderBy(asc(showRehearsal.startsAt));
}

/** The classes that rehearse: the ones ticked, or for the whole cast, the performing classes' current sessions. */
export function rehearsingSessions(r: Pick<Rehearsal, 'sessionIds' | 'startsAt'>, e: EventItem | null, content: Pick<Content, 'programs' | 'findSession'>): string[] {
  if (r.sessionIds.length) return r.sessionIds;
  return e ? performingSessions(e, content, athensParts(r.startsAt).date).map((s) => s.session.id) : [];
}

/** "Stories and Songs, Geode: Acting Studio", or "Whole cast". */
export function rehearsingLabel(r: Pick<Rehearsal, 'sessionIds'>, content: Pick<Content, 'findSession'>) {
  if (!r.sessionIds.length) return 'Whole cast';
  return [...new Set(r.sessionIds.map((id) => content.findSession(id)?.program.title).filter((t): t is string => !!t))].join(', ') || 'Whole cast';
}

export const placeOf = (r: Pick<Rehearsal, 'locationId'>, content: Pick<Content, 'locationById'>) => (r.locationId ? (content.locationById(r.locationId)?.shortName ?? '') : '');

/** A rehearsal as staff and families read it: "Rehearsal: Sat, Nov 14, 10 am–12 pm, HQ · W Broad St". */
export const rehearsalLine = (r: Pick<Rehearsal, 'startsAt' | 'endsAt' | 'locationId'>, content: Pick<Content, 'locationById'>) =>
  `Rehearsal: ${[rehearsalWhen(r), placeOf(r, content)].filter(Boolean).join(', ')}`;

// ───────────── Who sees which rehearsal ─────────────

export interface RehearsalCard {
  id: string;
  showSlug: string;
  showTitle: string;
  /** "10 am–12 pm" */
  time: string;
  start: string;
  place: string;
  note: string | null;
  /** "Stories and Songs" or "Whole cast". */
  classes: string;
}

/**
 * Pure: may this teacher see the rehearsal? Owners see every one; a teacher
 * sees it when they lead or assist one of the rehearsing classes.
 */
export const teacherSeesRehearsal = (role: 'owner' | 'teacher', mySessions: Set<string>, rehearsing: string[]) => role === 'owner' || rehearsing.some((id) => mySessions.has(id));

/** The rehearsal cards on the teacher app's Today for one date (read-only: time, place, note; no cast). */
export async function teacherRehearsals(viewer: { staffId: string; role: 'owner' | 'teacher' }, date: string, content: Content): Promise<RehearsalCard[]> {
  const rows = await rehearsalsBetween(date, date);
  if (!rows.length) return [];
  const db = await getDb();
  const mine = viewer.role === 'owner' ? new Set<string>() : new Set((await db.select({ sessionId: classTeacher.sessionId }).from(classTeacher).where(eq(classTeacher.staffId, viewer.staffId))).map((r) => r.sessionId));
  return rows
    .map((r) => ({ r, show: findShow(content, r.showSlug) }))
    .filter(({ r, show }) => teacherSeesRehearsal(viewer.role, mine, rehearsingSessions(r, show, content)))
    .map(({ r, show }) => {
      const a = athensParts(r.startsAt);
      return { id: r.id, showSlug: r.showSlug, showTitle: show?.title ?? r.showSlug, time: timeRange(a.time, athensParts(r.endsAt).time), start: a.time, place: placeOf(r, content), note: r.note, classes: rehearsingLabel(r, content) };
    });
}

/**
 * Pure: is this child called to the rehearsal? Every child in the cast for a
 * whole-cast rehearsal; otherwise a child enrolled (active or trial) in one of
 * the rehearsing classes.
 */
export const childCalled = (r: Pick<Rehearsal, 'sessionIds'>, childSessions: Set<string>) => !r.sessionIds.length || r.sessionIds.some((id) => childSessions.has(id));

export interface FamilyShow {
  studentId: string;
  firstName: string;
  showSlug: string;
  showTitle: string;
  gel: EventItem['gel'];
  dates: string;
  roles: string[];
  rehearsals: { id: string; line: string; note: string | null }[];
}

/**
 * For the family account: each child's roles in upcoming shows, and the
 * rehearsals from today on that they're called to. Nothing about the rest of
 * the cast.
 */
export async function familyShows(householdId: string, content: Content, now = new Date()): Promise<FamilyShow[]> {
  const today = todayInAthens(now);
  const db = await getDb();
  const rows = await db
    .select({ studentId: showCast.studentId, firstName: student.firstName, showSlug: showCast.showSlug, role: showCast.role, position: showCast.position })
    .from(showCast)
    .innerJoin(student, eq(student.id, showCast.studentId))
    .where(eq(student.householdId, householdId))
    .orderBy(asc(showCast.position));
  const live = rows.filter((r) => {
    const e = findShow(content, r.showSlug);
    return e && showUpcoming(e, today);
  });
  if (!live.length) return [];
  const slugs = [...new Set(live.map((r) => r.showSlug))];
  const kids = [...new Set(live.map((r) => r.studentId))];
  const [rehearsals, enrolled] = await Promise.all([
    db.select().from(showRehearsal).where(and(inArray(showRehearsal.showSlug, slugs), gte(showRehearsal.endsAt, now))).orderBy(asc(showRehearsal.startsAt)),
    db.select({ studentId: enrollment.studentId, sessionId: enrollment.sessionId }).from(enrollment).where(and(inArray(enrollment.studentId, kids), inArray(enrollment.status, ['active', 'trial']))),
  ]);
  const out = new Map<string, FamilyShow>();
  for (const r of live) {
    const key = `${r.studentId} ${r.showSlug}`;
    const e = findShow(content, r.showSlug)!;
    const item = out.get(key) ?? { studentId: r.studentId, firstName: r.firstName, showSlug: r.showSlug, showTitle: e.title, gel: e.gel, dates: showDatesLabel(e), roles: [], rehearsals: [] };
    if (r.role && !item.roles.includes(r.role)) item.roles.push(r.role);
    out.set(key, item);
  }
  for (const item of out.values()) {
    const mine = new Set(enrolled.filter((x) => x.studentId === item.studentId).map((x) => x.sessionId));
    item.rehearsals = rehearsals.filter((r) => r.showSlug === item.showSlug && childCalled(r, mine)).map((r) => ({ id: r.id, line: rehearsalLine(r, content), note: r.note }));
  }
  return [...out.values()];
}

/** "Maya: Narrator, in Winter Showcase" (or "Maya is in the cast of Winter Showcase" before roles are given). */
export const roleLine = (s: Pick<FamilyShow, 'firstName' | 'roles' | 'showTitle'>) =>
  s.roles.length ? `${s.firstName}: ${s.roles.join(', ')}, in ${s.showTitle}` : `${s.firstName} is in the cast of ${s.showTitle}`;

/** A child's rehearsals called for one of their classes (or the whole cast), from `from` on: for the class's calendar file. */
export async function childRehearsals(studentId: string, sessionId: string, content: Pick<Content, 'events'>, from: Date) {
  const db = await getDb();
  const shows = await db.selectDistinct({ showSlug: showCast.showSlug }).from(showCast).where(eq(showCast.studentId, studentId));
  const slugs = shows.map((s) => s.showSlug).filter((slug) => findShow(content, slug));
  if (!slugs.length) return [];
  const rows = await db.select().from(showRehearsal).where(and(inArray(showRehearsal.showSlug, slugs), gte(showRehearsal.endsAt, from))).orderBy(asc(showRehearsal.startsAt));
  return rows.filter((r) => childCalled(r, new Set([sessionId]))).map((r) => ({ ...r, showTitle: findShow(content, r.showSlug)!.title }));
}

/** Families to tell about a rehearsal change: those with a child in the cast who's called to it. */
export async function rehearsalFamilies(slug: string, r: Pick<Rehearsal, 'sessionIds'>): Promise<Set<string>> {
  const cast = await castList(slug);
  if (!r.sessionIds.length) return new Set(cast.map((c) => c.householdId));
  const ids = [...new Set(cast.map((c) => c.studentId))];
  if (!ids.length) return new Set();
  const db = await getDb();
  const rows = await db
    .select({ studentId: enrollment.studentId })
    .from(enrollment)
    .where(and(inArray(enrollment.studentId, ids), inArray(enrollment.sessionId, r.sessionIds), inArray(enrollment.status, ['active', 'trial'])));
  const called = new Set(rows.map((x) => x.studentId));
  return new Set(cast.filter((c) => called.has(c.studentId)).map((c) => c.householdId));
}

// ───────────── Emailing families about a change ─────────────

export type RehearsalChange = 'changed' | 'removed';
type Was = Pick<Rehearsal, 'startsAt' | 'endsAt' | 'locationId' | 'sessionIds'>;

/** The address of "Email the families about this change": ids and times only, never names. */
export function changeQuery(about: RehearsalChange, was: Was, nowId?: string) {
  return new URLSearchParams({
    about,
    ...(nowId ? { r: nowId } : {}),
    start: was.startsAt.toISOString(),
    end: was.endsAt.toISOString(),
    ...(was.locationId ? { loc: was.locationId } : {}),
    ...(was.sessionIds.length ? { classes: was.sessionIds.join(',') } : {}),
  }).toString();
}

/** Reads changeQuery back; null when it's missing or doesn't make sense. */
export function readChangeQuery(params: URLSearchParams): { about: RehearsalChange; was: Was; nowId: string | null } | null {
  const about = params.get('about');
  if (about !== 'changed' && about !== 'removed') return null;
  const startsAt = new Date(params.get('start') ?? '');
  const endsAt = new Date(params.get('end') ?? '');
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null;
  return {
    about,
    nowId: params.get('r'),
    was: { startsAt, endsAt, locationId: params.get('loc') || null, sessionIds: (params.get('classes') ?? '').split(',').filter(Boolean) },
  };
}

/** The prefilled subject and message for a changed or cancelled rehearsal. Staff read and edit it before sending. */
export function changeEmail(about: RehearsalChange, showTitle: string, was: Was, now: Pick<Rehearsal, 'startsAt' | 'endsAt' | 'locationId' | 'note'> | null, content: Pick<Content, 'locationById'>) {
  const wasWhen = rehearsalWhen(was);
  if (about === 'removed' || !now) {
    return { subject: `Rehearsal cancelled: ${showTitle}`, body: `The ${showTitle} rehearsal on ${wasWhen} is cancelled.` };
  }
  const place = placeOf(now, content);
  return {
    subject: `Rehearsal changed: ${showTitle}`,
    body: [`The ${showTitle} rehearsal on ${wasWhen} has changed.`, `It’s now ${rehearsalWhen(now)}${place ? `, at ${place}` : ''}.`, now.note ?? ''].filter(Boolean).join('\n\n'),
  };
}
