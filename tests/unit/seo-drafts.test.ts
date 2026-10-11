/**
 * Wording drafts (src/content/seo-draft/) and the loader that puts them in
 * the editor. The loader must never publish, never overwrite unpublished
 * work or newer content, and change nothing when run twice.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { getDb, schema } from '@/server/db';
import { collections, type CollectionKey } from '@/content/collections';
import { pages as pageDefs } from '@/content/pages';
import type { Data, Field } from '@/content/fields';
import { seedEntries } from '@/content/seed';
import { applyEdits, drafts, resolvePath, type Draft } from '@/content/seo-draft';
import { renderReview } from '@/content/seo-draft/review';
import { getContent, getEntry, publish, saveDraft, statusOf, workingCopy } from '@/server/content';
import type { PageKey } from '@/content/types';
import { LOADED_BY, describeOutcomes, loadDrafts } from '../../scripts/seo-drafts';

const STAFF = 'u-hannah';
const fieldsOf = (collection: string, id: string) => (collection === 'pages' ? pageDefs[id as PageKey].fields : collections[collection as CollectionKey].fields);
const seedData = (collection: string, id: string) => structuredClone(seedEntries().find((e) => e.collection === collection && e.id === id)!.data) as Data;

beforeAll(async () => {
  const db = await getDb();
  await db.insert(schema.user).values({ id: STAFF, name: 'Hannah Eppling', email: 'hannah@example.com', emailVerified: true });
});

/** Every text field in an entry, with its path and value, reaching into groups and list items. Names no field. */
function* textFields(fields: Field[], data: Data | undefined, prefix = ''): Generator<{ path: string; value: string }> {
  for (const f of fields) {
    const path = prefix ? `${prefix}.${f.key}` : f.key;
    const v = data?.[f.key];
    if (f.type === 'text' || f.type === 'textarea') yield { path, value: typeof v === 'string' ? v : '' };
    else if (f.type === 'group') yield* textFields(f.fields, v as Data | undefined, path);
    else if (f.type === 'list' && Array.isArray(v)) for (const [i, item] of v.entries()) yield* textFields(f.fields, item as Data, `${path}.${i}`);
  }
}

describe('the drafts in src/content/seo-draft/', () => {
  it('is a list the loader can read', () => {
    expect(Array.isArray(drafts)).toBe(true);
  });

  // An empty table makes no tests; each draft the wording sessions add gets one.
  it.each(drafts.map((d) => [label(d), d] as const))('%s applies to the starting content and passes the editor’s checks', async (_name, d) => {
    const [outcome] = await loadDrafts([d], { commit: false });
    expect({ status: outcome.status, notes: outcome.notes }).toEqual({ status: 'ready', notes: [] });
  });

  it('docs/seo/review.md matches them (run `npm run seo:review` after changing a draft)', () => {
    expect(readFileSync('docs/seo/review.md', 'utf8')).toBe(renderReview(drafts));
  });
});

function label(d: Draft) {
  return 'create' in d ? `new in ${d.kind}` : `${d.kind}/${d.id}`;
}

describe('draft format', () => {
  const home = pageDefs.home.fields;

  it('reaches groups, list items, single paragraphs and photo descriptions', () => {
    expect(resolvePath(home, 'seo.title')).toEqual({ ok: true, labels: ['Search engines', 'Title'] });
    expect(resolvePath(home, 'callSheet.items.1.text')).toMatchObject({ ok: true });
    expect(resolvePath(collections.programs.fields, 'description.0')).toEqual({ ok: true, labels: ['Full description', 'paragraph 1'] });
    expect(resolvePath(collections.programs.fields, 'image.alt')).toMatchObject({ ok: true });
  });

  it('refuses paths that aren’t one field', () => {
    expect(resolvePath(home, 'seo.titel')).toMatchObject({ ok: false });
    expect(resolvePath(home, 'seo')).toMatchObject({ ok: false });
    expect(resolvePath(home, 'callSheet.items.1')).toMatchObject({ ok: false });
    expect(resolvePath(home, 'seo.title.x')).toMatchObject({ ok: false });
  });

  it('can edit every text field the collections and pages define, by path alone', () => {
    let count = 0;
    for (const entry of seedEntries()) {
      const fields = fieldsOf(entry.collection, entry.id);
      const data = entry.data as Data;
      for (const { path, value } of textFields(fields, data)) {
        const { data: out, changed, invalid } = applyEdits(fields, data, [{ path, from: value, to: `${value} (new)`, why: 'test' }]);
        expect([...changed, ...invalid], `${entry.collection}/${entry.id} ${path}`).toEqual([]);
        expect(path.split('.').reduce<unknown>((o, k) => (o as Data)[k], out)).toBe(`${value} (new)`);
        count++;
      }
    }
    expect(count).toBeGreaterThan(200);
  });

  it('applies an edit only while the field holds its `from` text, and never changes the original', () => {
    const data = seedData('pages', 'home');
    const before = structuredClone(data);
    const { changed } = applyEdits(home, data, [{ path: 'callSheet.items.0.title', from: 'Something older', to: 'New', why: 'test' }]);
    expect(changed[0]).toMatch(/callSheet\.items\.0\.title .*has changed since the draft was written/);
    expect(data).toEqual(before);
  });

  it('treats an empty field as "" and removes a group it empties', () => {
    const data = seedData('pages', 'home');
    const added = applyEdits(home, data, [{ path: 'seo.title', from: '', to: 'Kids’ theater classes in Athens, GA', why: 'test' }]);
    expect([...added.changed, ...added.invalid]).toEqual([]);
    expect((added.data.seo as Data).title).toBe('Kids’ theater classes in Athens, GA');
    const removed = applyEdits(home, added.data, [{ path: 'seo.title', from: 'Kids’ theater classes in Athens, GA', to: '', why: 'test' }]);
    expect(removed.data).toEqual(data);
  });
});

describe('loading drafts into the editor', () => {
  const homeTitle = 'Kids’ theater classes in Athens, GA | Little Characters';
  const seedHome = seedData('pages', 'home') as { callSheet: { items: { text: string }[] } };
  const newFaq = { kind: 'faqs', create: { group: 'Getting started', q: 'Is there a test question?', a: 'Yes, only in tests.' }, why: 'test' } as const;
  const testDrafts: Draft[] = [
    {
      kind: 'pages',
      id: 'home',
      edits: [
        { path: 'seo.title', from: '', to: homeTitle, why: 'test' },
        { path: 'callSheet.items.0.text', from: seedHome.callSheet.items[0].text, to: 'Your first class is free.', why: 'test' },
      ],
    },
    newFaq,
  ];

  const everything = async () => {
    const db = await getDb();
    return { entries: await db.select().from(schema.contentEntry), versions: await db.select().from(schema.contentVersion) };
  };

  it('a dry run writes nothing', async () => {
    await getContent();
    const before = await everything();
    const outcomes = await loadDrafts(testDrafts, { commit: false });
    expect(outcomes.map((o) => o.status)).toEqual(['ready', 'ready']);
    expect(await everything()).toEqual(before);
    expect(describeOutcomes(outcomes, false)).toMatch(/--commit/);
  });

  it('saves drafts without publishing anything, and says who saved them', async () => {
    const before = await everything();
    const live = await getContent('live');
    const outcomes = await loadDrafts(testDrafts, { commit: true });
    expect(outcomes.map((o) => [o.status, o.editUrl])).toEqual([
      ['loaded', '/admin/content/pages/home'],
      ['loaded', '/admin/content/faqs/is-there-a-test-question'],
    ]);

    // Nothing new in the history of published versions; published content untouched.
    const after = await everything();
    expect(after.versions).toEqual(before.versions);
    for (const e of before.entries) expect(after.entries.find((x) => x.collection === e.collection && x.id === e.id)!.published).toEqual(e.published);
    expect(JSON.stringify(await getContent('live'))).toBe(JSON.stringify(live));

    const home = (await getEntry('pages', 'home'))!;
    expect(statusOf(home)).toBe('changed');
    expect(home.updatedBy).toBe(LOADED_BY);
    expect(home.publishedBy).toBeNull();
    expect((workingCopy(home).seo as Data).title).toBe(homeTitle);
    expect((await getContent('draft')).pages.home.seo?.title).toBe(homeTitle);

    const faq = (await getEntry('faqs', 'is-there-a-test-question'))!;
    expect(statusOf(faq)).toBe('new');
    expect(faq.published).toBeNull();
    expect(faq.updatedBy).toBe(LOADED_BY);
    expect((await getContent('live')).faqs.some((f) => f.q === newFaq.create.q)).toBe(false);
  });

  it('changes nothing when run again', async () => {
    const before = await everything();
    const outcomes = await loadDrafts(testDrafts, { commit: true });
    expect(outcomes.map((o) => o.status)).toEqual(['skipped', 'skipped']);
    expect(await everything()).toEqual(before);
  });

  it('leaves an entry with someone’s unpublished changes alone', async () => {
    const about = seedData('pages', 'about');
    const hannahs = { ...about, seo: { title: 'Hannah’s own title' } };
    expect(await saveDraft('pages', 'about', hannahs, STAFF)).toMatchObject({ ok: true });
    const before = await everything();

    const [outcome] = await loadDrafts([{ kind: 'pages', id: 'about', edits: [{ path: 'seo.title', from: '', to: 'A loader title', why: 'test' }] }], { commit: true });
    expect(outcome.status).toBe('skipped');
    expect(outcome.notes.join(' ')).toMatch(/already has unpublished changes/);
    expect(await everything()).toEqual(before);
    const entry = (await getEntry('pages', 'about'))!;
    expect((entry.draft as Data).seo).toEqual({ title: 'Hannah’s own title' });
    expect(entry.updatedBy).toBe(STAFF);
  });

  it('skips an entry whose field changed since the draft was written, and names the field', async () => {
    // Hannah publishes a new description for a class.
    const program = workingCopy((await getEntry('programs', 'intro-to-theater'))!);
    const written = program.summary as string;
    expect(await saveDraft('programs', 'intro-to-theater', { ...program, summary: 'Hannah rewrote this.' }, STAFF)).toMatchObject({ ok: true });
    expect(await publish('programs', 'intro-to-theater', STAFF)).toMatchObject({ ok: true });
    const before = await everything();

    const [outcome] = await loadDrafts(
      [{ kind: 'programs', id: 'intro-to-theater', edits: [{ path: 'summary', from: written, to: 'A loader summary.', why: 'test' }] }],
      { commit: true },
    );
    expect(outcome.status).toBe('skipped');
    expect(outcome.notes[0]).toMatch(/^summary \(Summary\) has changed since the draft was written\. It now reads: “Hannah rewrote this\.”/);
    expect(await everything()).toEqual(before);
    expect((await getEntry('programs', 'intro-to-theater'))!.draft).toBeNull();
  });

  it('reports a draft the editor would refuse, and saves none of it', async () => {
    const before = await everything();
    const [outcome] = await loadDrafts(
      [{ kind: 'pages', id: 'contact', edits: [{ path: 'seo.title', from: '', to: 'x'.repeat(71), why: 'too long' }] }],
      { commit: true },
    );
    expect(outcome.status).toBe('problem');
    expect(outcome.notes.join(' ')).toMatch(/seo\.title: Keep this under 70 characters/);
    expect(await everything()).toEqual(before);
  });

  it('reports a wrong id or path in plain words', async () => {
    const outcomes = await loadDrafts(
      [
        { kind: 'events', id: 'no-such-event', edits: [] },
        { kind: 'pages', id: 'home', edits: [{ path: 'seo.titel', from: '', to: 'x', why: 'typo' }] },
      ],
      { commit: false },
    );
    expect(outcomes[0]).toMatchObject({ status: 'skipped', notes: [expect.stringMatching(/isn’t in the editor/)] });
    // home has the loaded draft from earlier, so it is skipped before the path is looked at.
    expect(outcomes[1].status).toBe('skipped');
    const [typo] = await loadDrafts([{ kind: 'pages', id: 'faq', edits: [{ path: 'seo.titel', from: '', to: 'x', why: 'typo' }] }], { commit: false });
    expect(typo).toMatchObject({ status: 'problem', notes: [expect.stringMatching(/no field “seo\.titel”/)] });
  });
});
