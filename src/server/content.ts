/**
 * Site content in the database: reading it for pages (cached), and the
 * editor's actions: save a draft, publish, discard, delete, reorder, restore.
 *
 * Each entry keeps the published version (what the site shows) and, when
 * there are unpublished edits, a draft. Every publish is kept in
 * content_version for the history page.
 *
 * The first time the site runs against an empty database, the starting
 * content in src/content/seed/ is copied in.
 */
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb, schema } from './db';
import { collections, isCollectionKey, type CollectionKey } from '@/content/collections';
import { pages as pageDefs, isPageKey } from '@/content/pages';
import { validate, walkFields, type Data, type Field, type FieldErrors } from '@/content/fields';
import { seedEntries } from '@/content/seed';
import { buildSiteContent, type ContentRow, type SiteContent } from '@/content/site-content';
import { shortId, slugify } from '@/content/ids';
import type { Program } from '@/content/types';
import type { UploadInfo } from '@/lib/media';

const { contentEntry, contentVersion, contentRevision, enrollment, media, mediaFile, order } = schema;

export type Kind = CollectionKey | 'pages';
export type Mode = 'live' | 'draft';

export const isKind = (k: string): k is Kind => k === 'pages' || isCollectionKey(k);

export function fieldsFor(kind: Kind, id: string): Field[] {
  if (kind === 'pages') {
    if (!isPageKey(id)) throw new Error(`No page "${id}"`);
    return pageDefs[id].fields;
  }
  return collections[kind].fields;
}

// ───────────── Reading, with a small cache ─────────────

/** How often a running server checks whether someone else changed the content. */
const CHECK_EVERY_MS = 2000;

let cache: { revision: number; checkedAt: number; live?: Promise<SiteContent>; draft?: Promise<SiteContent> } | undefined;
let seeded: Promise<void> | undefined;

async function revision() {
  const db = await getDb();
  const rows = await db.select({ revision: contentRevision.revision }).from(contentRevision).where(eq(contentRevision.id, 1));
  return rows[0]?.revision ?? 0;
}

type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>['transaction']>[0]>[0];

async function bumpRevision(tx: Tx) {
  await tx
    .insert(contentRevision)
    .values({ id: 1, revision: 1 })
    .onConflictDoUpdate({ target: contentRevision.id, set: { revision: sql`${contentRevision.revision} + 1` } });
}

/** Forget cached content (after a change on this server, and in tests). */
export function resetContentCache() {
  cache = undefined;
  seeded = undefined;
}

/**
 * Everything pages need. `draft` shows unpublished edits too; only staff
 * previewing their changes see it.
 */
export async function getContent(mode: Mode = 'live'): Promise<SiteContent> {
  await (seeded ??= seedIfEmpty().catch((e) => {
    seeded = undefined;
    throw e;
  }));
  const now = Date.now();
  if (!cache || now - cache.checkedAt > CHECK_EVERY_MS) {
    const rev = await revision();
    if (!cache || cache.revision !== rev) cache = { revision: rev, checkedAt: now };
    else cache.checkedAt = now;
  }
  const c = cache;
  const loading = (c[mode] ??= load(mode));
  return loading.catch((e) => {
    if (c[mode] === loading) c[mode] = undefined;
    throw e;
  });
}

async function load(mode: Mode) {
  const db = await getDb();
  const rows = await db.select().from(contentEntry);
  const visible: ContentRow[] = [];
  for (const r of rows) {
    const data = mode === 'draft' ? (r.draft ?? r.published) : r.published;
    if (data != null) visible.push({ collection: r.collection, id: r.id, position: r.position, data });
  }
  return buildSiteContent(visible, await uploads());
}

async function uploads() {
  const db = await getDb();
  const rows = await db
    .select({ id: media.id, width: media.width, height: media.height, alt: media.alt, size: mediaFile.width })
    .from(media)
    .innerJoin(mediaFile, eq(mediaFile.mediaId, media.id))
    .orderBy(asc(mediaFile.width));
  const map = new Map<string, UploadInfo>();
  for (const r of rows) {
    const info = map.get(r.id) ?? { width: r.width, height: r.height, alt: r.alt, widths: [] };
    info.widths.push(r.size);
    map.set(r.id, info);
  }
  return map;
}

/** Tell every server that content changed (a photo was uploaded or deleted). */
export async function touchContent() {
  await write(async () => {});
}

/** The live catalog, for server code (enrollment, rosters). */
export const getCatalog = () => getContent('live');

/**
 * Copy in the starting content for any collection that has never had content.
 * A collection someone emptied on purpose has history, so it stays empty.
 */
async function seedIfEmpty() {
  const db = await getDb();
  const known = new Set((await db.selectDistinct({ collection: contentVersion.collection }).from(contentVersion)).map((r) => r.collection));
  const entries = seedEntries().filter((e) => !known.has(e.collection));
  if (!entries.length) return;
  await db.transaction(async (tx) => {
    const now = new Date();
    const inserted = await tx
      .insert(contentEntry)
      .values(entries.map((e) => ({ collection: e.collection, id: e.id, position: e.position, published: e.data, publishedAt: now })))
      .onConflictDoNothing()
      .returning({ collection: contentEntry.collection, id: contentEntry.id, published: contentEntry.published });
    if (inserted.length) {
      await tx.insert(contentVersion).values(inserted.map((r) => ({ collection: r.collection, entryId: r.id, data: r.published, action: 'seed' as const })));
      await bumpRevision(tx);
    }
  });
}

// ───────────── The editor's view ─────────────

export type EntryRow = typeof contentEntry.$inferSelect;
export type EntryStatus = 'live' | 'changed' | 'new';

export const statusOf = (e: Pick<EntryRow, 'published' | 'draft'>): EntryStatus => (e.published == null ? 'new' : e.draft != null ? 'changed' : 'live');
/** What the editor shows: the draft if there is one. */
export const workingCopy = (e: Pick<EntryRow, 'published' | 'draft'>) => (e.draft ?? e.published) as Data;

export async function listEntries(kind: Kind): Promise<EntryRow[]> {
  await getContent();
  const db = await getDb();
  return db.select().from(contentEntry).where(eq(contentEntry.collection, kind)).orderBy(asc(contentEntry.position), asc(contentEntry.id));
}

export async function getEntry(kind: Kind, id: string): Promise<EntryRow | undefined> {
  await getContent();
  const db = await getDb();
  const rows = await db
    .select()
    .from(contentEntry)
    .where(and(eq(contentEntry.collection, kind), eq(contentEntry.id, id)));
  return rows[0];
}

/** How many entries in each list have unpublished changes. */
export async function pendingCounts(): Promise<Map<string, number>> {
  await getContent();
  const db = await getDb();
  const rows = await db
    .select({ collection: contentEntry.collection, n: sql<number>`count(*)::int` })
    .from(contentEntry)
    .where(sql`${contentEntry.draft} is not null`)
    .groupBy(contentEntry.collection);
  return new Map(rows.map((r) => [r.collection, Number(r.n)]));
}

// ───────────── Checks before saving ─────────────

export type Result = { ok: true; id: string } | { ok: false; errors: FieldErrors; message?: string };

const fail = (message: string, errors: FieldErrors = {}): Result => ({ ok: false, errors, message });

/** Stable JSON, so "no changes" is recognized regardless of key order. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .filter((k) => (value as Data)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Data)[k])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export const sameContent = (a: unknown, b: unknown) => canonical(a) === canonical(b);

/** Sessions with any sign-up (past or present), by session id. */
export async function signupCounts(sessionIds: string[]): Promise<Map<string, number>> {
  if (!sessionIds.length) return new Map();
  const db = await getDb();
  const enrolled = await db
    .select({ sessionId: enrollment.sessionId, n: sql<number>`count(*)::int` })
    .from(enrollment)
    .where(inArray(enrollment.sessionId, sessionIds))
    .groupBy(enrollment.sessionId);
  const ordered = await db
    .select({ sessionId: order.sessionId, n: sql<number>`count(*)::int` })
    .from(order)
    .where(and(inArray(order.sessionId, sessionIds), sql`${order.status} <> 'draft'`))
    .groupBy(order.sessionId);
  const counts = new Map<string, number>();
  for (const r of [...enrolled, ...ordered]) counts.set(r.sessionId, Math.max(counts.get(r.sessionId) ?? 0, Number(r.n)));
  return counts;
}

/**
 * Validate an entry and fill in what the editor doesn't ask for (new
 * session ids). Returns the data to save.
 */
export async function prepare(kind: Kind, id: string | undefined, input: Data): Promise<{ ok: true; id: string; data: Data } | { ok: false; errors: FieldErrors; message?: string }> {
  const fields = kind === 'pages' ? fieldsFor(kind, id ?? '') : collections[kind].fields;
  const checked = validate(fields, input);
  if (!checked.ok) return { ok: false, errors: checked.errors, message: 'Some fields need a look.' };
  const data = checked.data;

  if (kind === 'pages') return { ok: true, id: id!, data };

  const def = collections[kind];
  const errors: FieldErrors = { ...(def.check?.(data as never) ?? {}) };
  const existing = id ? await getEntry(kind, id) : undefined;
  let entryId = id;

  if (def.idField) {
    const wanted = String(data[def.idField] ?? '');
    if (existing?.published != null) {
      // Links and enrollments use it, so it can't change once published.
      data[def.idField] = existing.id;
    } else if (wanted !== existing?.id) {
      if (await getEntry(kind, wanted)) errors[def.idField] = 'Another one already uses this. Try adding a word or a year.';
      entryId = wanted;
    }
  } else if (!existing) {
    const base = slugify(def.newId?.(data as never) ?? def.title(data as never)) || kind;
    entryId = (await getEntry(kind, base)) ? `${base}-${shortId(4)}` : base;
  }

  if (kind === 'programs') {
    const program = data as unknown as Program;
    const taken = await sessionIdsElsewhere(entryId!);
    const seen = new Set<string>();
    program.sessions.forEach((s, i) => {
      if (!s.id) s.id = `${program.slug}-${shortId(5)}`;
      if (taken.has(s.id) || seen.has(s.id)) errors[`sessions.${i}.term`] = 'This session’s id is already used by another class. Remove it and add it again.';
      seen.add(s.id);
    });
  }

  if (Object.keys(errors).length) return { ok: false, errors, message: 'Some fields need a look.' };
  return { ok: true, id: entryId!, data };
}

async function sessionIdsElsewhere(programSlug: string) {
  const rows = await listEntries('programs');
  const ids = new Set<string>();
  for (const r of rows) {
    if (r.id === programSlug) continue;
    for (const version of [r.published, r.draft] as (Program | null)[]) for (const s of version?.sessions ?? []) ids.add(s.id);
  }
  return ids;
}

/** Sessions that would disappear from the site, and have families signed up. */
async function removedSessionsWithSignups(before: Program | null, after: Program | null) {
  const kept = new Set(after?.sessions.map((s) => s.id) ?? []);
  const removed = (before?.sessions ?? []).filter((s) => !kept.has(s.id));
  const counts = await signupCounts(removed.map((s) => s.id));
  return removed.filter((s) => (counts.get(s.id) ?? 0) > 0).map((s) => ({ session: s, count: counts.get(s.id)! }));
}

/** Other content that points at this entry (a session's location, a page's quote…). */
export async function referencesTo(kind: CollectionKey, id: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select().from(contentEntry);
  const where: string[] = [];
  for (const row of rows) {
    if (row.collection === kind && row.id === id) continue;
    if (row.collection !== 'pages' && !isCollectionKey(row.collection)) continue;
    const fields = row.collection === 'pages' ? (isPageKey(row.id) ? pageDefs[row.id].fields : []) : collections[row.collection as CollectionKey].fields;
    const name =
      row.collection === 'pages' ? (isPageKey(row.id) ? pageDefs[row.id].label : row.id) : collections[row.collection as CollectionKey].title(workingCopy(row) as never);
    for (const version of [row.published, row.draft]) {
      if (version && pointsAt(fields, version as Data, kind, id)) {
        where.push(name);
        break;
      }
    }
  }
  return [...new Set(where)];
}

function pointsAt(fields: Field[], data: Data, kind: CollectionKey, id: string): boolean {
  for (const { field, path } of walkFields(fields)) {
    if (field.type === 'list') {
      const items = getPath(data, path);
      if (Array.isArray(items) && items.some((item) => pointsAt(field.fields, item as Data, kind, id))) return true;
    } else if (field.type === 'ref' && field.collection === kind) {
      const v = getPath(data, path);
      if (v === id || (Array.isArray(v) && v.includes(id))) return true;
    }
  }
  return false;
}

const getPath = (data: Data, path: string) => path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Data)[k] : undefined), data);

// ───────────── Changes ─────────────

async function write(fn: (tx: Tx) => Promise<void>) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await fn(tx);
    await bumpRevision(tx);
  });
  cache = undefined;
}

/**
 * Save edits without publishing. Returns the entry id: new entries get theirs
 * here, and an entry that has never been published follows its web address.
 */
export async function saveDraft(kind: Kind, id: string | undefined, input: Data, userId: string): Promise<Result> {
  const prepared = await prepare(kind, id, input);
  if (!prepared.ok) return prepared;
  const existing = id ? await getEntry(kind, id) : undefined;
  await write(async (tx) => {
    if (existing && existing.id === prepared.id) {
      const draft = existing.published != null && sameContent(existing.published, prepared.data) ? null : prepared.data;
      await tx
        .update(contentEntry)
        .set({ draft, updatedBy: userId })
        .where(and(eq(contentEntry.collection, kind), eq(contentEntry.id, prepared.id)));
      return;
    }
    let position = existing?.position;
    if (existing) {
      // A never-published entry whose web address changed moves to its new id.
      await tx.delete(contentEntry).where(and(eq(contentEntry.collection, kind), eq(contentEntry.id, existing.id)));
    } else {
      const [{ max }] = await tx
        .select({ max: sql<number>`coalesce(max(${contentEntry.position}), -1)::int` })
        .from(contentEntry)
        .where(eq(contentEntry.collection, kind));
      position = Number(max) + 1;
    }
    await tx.insert(contentEntry).values({ collection: kind, id: prepared.id, position: position ?? 0, draft: prepared.data, updatedBy: userId });
  });
  return { ok: true, id: prepared.id };
}

/** Put the draft on the site. */
export async function publish(kind: Kind, id: string, userId: string, action: 'publish' | 'restore' = 'publish'): Promise<Result> {
  const entry = await getEntry(kind, id);
  if (!entry) return fail('That item no longer exists.');
  if (entry.draft == null) return { ok: true, id };
  // Check again: the rules may have changed since the draft was saved.
  const prepared = await prepare(kind, id, entry.draft as Data);
  if (!prepared.ok) return prepared;

  if (kind === 'programs') {
    const blocked = await removedSessionsWithSignups(entry.published as Program | null, prepared.data as unknown as Program);
    if (blocked.length) {
      const names = blocked.map((b) => `${b.session.term}${b.session.label ? ` (${b.session.label})` : ''}: ${b.count} sign-up${b.count === 1 ? '' : 's'}`).join('; ');
      return fail(`Families have signed up for a session this would remove (${names}). Put it back and set its registration to Closed instead.`);
    }
  }

  await write(async (tx) => {
    await tx
      .update(contentEntry)
      .set({ published: prepared.data, draft: null, publishedAt: new Date(), publishedBy: userId, updatedBy: userId })
      .where(and(eq(contentEntry.collection, kind), eq(contentEntry.id, id)));
    await tx.insert(contentVersion).values({ collection: kind, entryId: id, data: prepared.data, action, userId });
  });
  return { ok: true, id };
}

/** Throw away unpublished edits. A new item that was never published is removed. */
export async function discardDraft(kind: Kind, id: string, userId: string): Promise<Result> {
  const entry = await getEntry(kind, id);
  if (!entry) return { ok: true, id };
  await write(async (tx) => {
    if (entry.published == null) {
      await tx.delete(contentEntry).where(and(eq(contentEntry.collection, kind), eq(contentEntry.id, id)));
    } else {
      await tx
        .update(contentEntry)
        .set({ draft: null, updatedBy: userId })
        .where(and(eq(contentEntry.collection, kind), eq(contentEntry.id, id)));
    }
  });
  return { ok: true, id };
}

/** Take an item off the site for good (its history is kept). */
export async function deleteEntry(kind: CollectionKey, id: string, userId: string): Promise<Result> {
  const entry = await getEntry(kind, id);
  if (!entry) return { ok: true, id };
  if (kind === 'programs') {
    const blocked = await removedSessionsWithSignups(entry.published as Program | null, null);
    const draftBlocked = await removedSessionsWithSignups(entry.draft as Program | null, null);
    if (blocked.length || draftBlocked.length)
      return fail('Families have signed up for this, so it can’t be deleted. Set each session’s registration to Closed instead.');
  }
  const users = await referencesTo(kind, id);
  if (users.length) return fail(`This is still used by: ${users.join(', ')}. Change those first.`);
  await write(async (tx) => {
    await tx.delete(contentEntry).where(and(eq(contentEntry.collection, kind), eq(contentEntry.id, id)));
    await tx.insert(contentVersion).values({ collection: kind, entryId: id, data: null, action: 'delete', userId });
  });
  return { ok: true, id };
}

/** Set the order of a list. Takes effect on the site right away. */
export async function reorder(kind: CollectionKey, ids: string[], userId: string) {
  await write(async (tx) => {
    for (const [position, id] of ids.entries()) {
      await tx
        .update(contentEntry)
        .set({ position, updatedBy: userId })
        .where(and(eq(contentEntry.collection, kind), eq(contentEntry.id, id)));
    }
  });
}

/** Items deleted from a list (and not brought back), newest first, with their last content. */
export async function deletedEntries(kind: CollectionKey) {
  const db = await getDb();
  const versions = await db
    .select()
    .from(contentVersion)
    .where(eq(contentVersion.collection, kind))
    .orderBy(desc(contentVersion.createdAt));
  const existing = new Set((await listEntries(kind)).map((e) => e.id));
  const seen = new Set<string>();
  const deleted: { id: string; deletedAt: Date; data: Data }[] = [];
  for (const v of versions) {
    if (seen.has(v.entryId) || existing.has(v.entryId)) continue;
    seen.add(v.entryId);
    const last = versions.find((x) => x.entryId === v.entryId && x.data != null);
    if (v.action === 'delete' && last) deleted.push({ id: v.entryId, deletedAt: v.createdAt, data: last.data as Data });
  }
  return deleted.slice(0, 20);
}

/** The latest changes across all content, for the editor's front page. */
export async function recentChanges(limit = 12) {
  const db = await getDb();
  return db
    .select({
      collection: contentVersion.collection,
      entryId: contentVersion.entryId,
      action: contentVersion.action,
      data: contentVersion.data,
      createdAt: contentVersion.createdAt,
      userName: schema.user.name,
    })
    .from(contentVersion)
    .leftJoin(schema.user, eq(schema.user.id, contentVersion.userId))
    .where(sql`${contentVersion.action} <> 'seed'`)
    .orderBy(desc(contentVersion.createdAt))
    .limit(limit);
}

export async function history(kind: Kind, id: string) {
  const db = await getDb();
  return db
    .select({
      id: contentVersion.id,
      action: contentVersion.action,
      data: contentVersion.data,
      createdAt: contentVersion.createdAt,
      userName: schema.user.name,
      userEmail: schema.user.email,
    })
    .from(contentVersion)
    .leftJoin(schema.user, eq(schema.user.id, contentVersion.userId))
    .where(and(eq(contentVersion.collection, kind), eq(contentVersion.entryId, id)))
    .orderBy(desc(contentVersion.createdAt))
    .limit(100);
}

/** Load an old version into the draft, to check and publish. Deleted items come back as a draft. */
export async function restoreToDraft(kind: Kind, id: string, versionId: string, userId: string): Promise<Result> {
  const db = await getDb();
  const [version] = await db
    .select()
    .from(contentVersion)
    .where(and(eq(contentVersion.id, versionId), eq(contentVersion.collection, kind), eq(contentVersion.entryId, id)));
  if (!version?.data) return fail('That version can’t be restored.');
  const entry = await getEntry(kind, id);
  await write(async (tx) => {
    if (entry) {
      await tx
        .update(contentEntry)
        .set({ draft: entry.published != null && sameContent(entry.published, version.data) ? null : version.data, updatedBy: userId })
        .where(and(eq(contentEntry.collection, kind), eq(contentEntry.id, id)));
    } else {
      await tx.insert(contentEntry).values({ collection: kind, id, position: 999, draft: version.data, updatedBy: userId });
    }
  });
  return { ok: true, id };
}
