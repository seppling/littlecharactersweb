/**
 * The content editor's model: every field definition can hold the content we
 * have (so opening and saving an item loses nothing), drafts stay off the
 * site until published, history can be restored, and content that families
 * depend on can't be removed by accident.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { getDb, schema } from '@/server/db';
import { collections, type CollectionKey } from '@/content/collections';
import { pages as pageDefs } from '@/content/pages';
import { readForm, toFormData, validate, type Data } from '@/content/fields';
import { seedEntries } from '@/content/seed';
import { rich, plain, href } from '@/content/rich';
import { withRequiredDefaults } from '@/content/site-content';
import { describe as describeVersion, labelOf } from '@/lib/editor';
import {
  deleteEntry,
  discardDraft,
  getContent,
  getEntry,
  history,
  publish,
  referencesTo,
  reorder,
  restoreToDraft,
  sameContent,
  saveDraft,
  statusOf,
  workingCopy,
} from '@/server/content';
import type { PageKey, Program } from '@/content/types';

const STAFF = 'u-hannah';
const fieldsOf = (collection: string, id: string) => (collection === 'pages' ? pageDefs[id as PageKey].fields : collections[collection as CollectionKey].fields);

beforeAll(async () => {
  const db = await getDb();
  await db.insert(schema.user).values({ id: STAFF, name: 'Hannah Eppling', email: 'hannah@example.com', emailVerified: true });
});

describe('field definitions', () => {
  const entries = seedEntries();

  it.each(entries.map((e) => [`${e.collection}/${e.id}`, e] as const))('%s is valid and survives the edit form unchanged', (_name, entry) => {
    const fields = fieldsOf(entry.collection, entry.id);
    const data = entry.data as Data;
    const checked = validate(fields, data);
    expect(checked.ok ? {} : checked.errors).toEqual({});
    const roundTrip = readForm(fields, toFormData(fields, data));
    expect(roundTrip).toEqual(data);
  });

  it('reports errors by form path', () => {
    const fields = collections.programs.fields;
    const program = structuredClone(entries.find((e) => e.id === 'intro-to-theater')!.data) as Program;
    program.sessions[0].start = '25:00';
    program.slug = 'Not A Slug';
    const result = validate(fields, program as unknown as Data);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors['sessions.0.start']).toMatch(/time/);
      expect(result.errors.slug).toMatch(/lowercase/);
    }
  });

  it('keeps list items in the order the browser sent them, and drops blank ones', () => {
    const fields = pageDefs.home.fields;
    const fd = toFormData(fields, entries.find((e) => e.id === 'home')!.data as Data);
    // Move the third card first, then add an empty card.
    const tokens = fd.getAll('callSheet.items[]');
    fd.delete('callSheet.items[]');
    for (const t of [tokens[2], tokens[0], tokens[1], 'new1']) fd.append('callSheet.items[]', String(t));
    fd.append('callSheet.items.new1.title', '');
    const data = readForm(fields, fd) as { callSheet: { items: { title: string }[] } };
    expect(data.callSheet.items.map((i) => i.title)).toEqual(['Stories and Songs & Acting Studio', 'Registration is open for all classes', 'Jack and the Beanstalk']);
  });

  it('says “Required” for a missing required field, and names it in the list of problems', () => {
    const fields = collections.programs.fields;
    const program = structuredClone(entries.find((e) => e.id === 'intro-to-theater')!.data) as Data & { sessions: Data[] };
    delete program.title;
    delete program.sessions[0].term;
    const result = validate(fields, program);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.title).toBe('Required');
      expect(result.errors['sessions.0.term']).toBe('Required');
      expect(labelOf(fields, 'sessions.0.term', program)).toBe('Sessions › Session 1 › Term');
      expect(labelOf(fields, 'ages.max', program)).toBe('Ages › To age');
    }
  });

  it('writes an old version out in words for the history page', () => {
    const faq = entries.find((e) => e.id === 'who-do-you-serve')!;
    const lines = describeVersion(collections.faqs.fields, faq.data as Data);
    expect(lines[0]).toBe('Section: Getting started');
    expect(lines[1]).toBe('Question: Who do you serve?');
  });

  it('refuses links that could run code', () => {
    const fields = collections.events.fields;
    const event = { ...(entries.find((e) => e.collection === 'events')!.data as Data), cta: { label: 'Tickets', href: 'javascript:alert(1)' } };
    const result = validate(fields, event);
    expect(result.ok).toBe(false);
  });
});

describe('formatting', () => {
  it('escapes HTML and turns markup into links and bold', () => {
    expect(rich('Say <b>hi</b> to [us](/contact) **now**')).toBe('Say &lt;b&gt;hi&lt;/b&gt; to <a href="/contact">us</a> <strong>now</strong>');
  });
  it('fills placeholders, including inside links', () => {
    expect(rich('Email [{email}](mailto:{email})', { email: 'a@b.org' })).toBe('Email <a href="mailto:a@b.org">a@b.org</a>');
  });
  it('leaves unsafe links as plain text', () => {
    expect(rich('[click](javascript:alert(1))')).not.toContain('<a');
  });
  it('spotlights words in headlines', () => {
    expect(rich('Every person has a *story*', {}, { spotlight: 'lit' })).toBe('Every person has a <span class="lit">story</span>');
    expect(plain('Every person has a *story* [here](/x)')).toBe('Every person has a story here');
  });
  it('never makes a link out of an unfilled placeholder', () => {
    expect(href('{wishList}', {})).toBe('#');
    expect(href('{wishList}', { wishList: 'https://a.co/x' })).toBe('https://a.co/x');
  });
});

describe('page defaults', () => {
  it('fills required fields added later, but leaves cleared optional ones empty', () => {
    const merged = withRequiredDefaults(pageDefs.home.fields, { hero: { headline: 'H', intro: 'I', eyebrow: 'E' }, visit: { heading: 'V' } }, { hero: { headline: 'Mine', intro: 'Mine too' } });
    expect(merged.hero).toEqual({ headline: 'Mine', intro: 'Mine too' });
    expect(merged.visit).toEqual({ heading: 'V' });
  });
});

describe('content store', () => {
  it('starts with the seed content', async () => {
    const content = await getContent();
    expect(content.programs.length).toBe(seedEntries().filter((e) => e.collection === 'programs').length);
    expect(content.findSession('intro-f26-tue')?.program.slug).toBe('intro-to-theater');
    expect(content.site.contact.phoneHref).toBe('tel:+12817982623');
    expect(content.pages.home.hero.headline).toContain('*story*');
    expect(content.vars.tuitionRange).toBe('$95–$115 a month');
  });

  it('keeps drafts off the live site until published, and records history', async () => {
    const entry = (await getEntry('programs', 'intro-to-theater'))!;
    const edited = { ...workingCopy(entry), tagline: 'A brand new tagline.' };
    expect(await saveDraft('programs', 'intro-to-theater', edited, STAFF)).toMatchObject({ ok: true });

    expect((await getContent('live')).programBySlug('intro-to-theater')?.tagline).not.toBe('A brand new tagline.');
    expect((await getContent('draft')).programBySlug('intro-to-theater')?.tagline).toBe('A brand new tagline.');
    expect(statusOf((await getEntry('programs', 'intro-to-theater'))!)).toBe('changed');

    expect(await publish('programs', 'intro-to-theater', STAFF)).toMatchObject({ ok: true });
    expect((await getContent('live')).programBySlug('intro-to-theater')?.tagline).toBe('A brand new tagline.');

    const versions = await history('programs', 'intro-to-theater');
    expect(versions.map((v) => v.action)).toEqual(['publish', 'seed']);
    expect(versions[0].userName).toBe('Hannah Eppling');

    // Restore the original: it comes back as a draft to check, then goes live.
    await restoreToDraft('programs', 'intro-to-theater', versions[1].id, STAFF);
    expect((await getContent('live')).programBySlug('intro-to-theater')?.tagline).toBe('A brand new tagline.');
    await publish('programs', 'intro-to-theater', STAFF, 'restore');
    expect(sameContent((await getContent()).programBySlug('intro-to-theater'), versions[1].data)).toBe(true);
  });

  it('treats saving without changes as no draft', async () => {
    const entry = (await getEntry('faqs', 'who-do-you-serve'))!;
    await saveDraft('faqs', 'who-do-you-serve', structuredClone(workingCopy(entry)), STAFF);
    expect((await getEntry('faqs', 'who-do-you-serve'))!.draft).toBeNull();
  });

  it('adds a new class with its own session ids, and keeps its web address once published', async () => {
    const base = workingCopy((await getEntry('programs', 'intro-to-theater'))!) as unknown as Program;
    const fresh = { ...base, slug: 'spring-intro', title: 'Spring Intro', sessions: base.sessions.map(({ id: _id, ...s }) => ({ ...s, term: 'Spring 2027' })) };
    const saved = await saveDraft('programs', undefined, fresh as unknown as Data, STAFF);
    expect(saved).toMatchObject({ ok: true, id: 'spring-intro' });
    const draft = (await getEntry('programs', 'spring-intro'))!;
    const ids = (draft.draft as Program).sessions.map((s) => s.id);
    expect(ids.every((id) => id.startsWith('spring-intro-'))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect((await getContent('live')).programBySlug('spring-intro')).toBeUndefined();

    // The same address can't be used twice.
    expect(await saveDraft('programs', undefined, fresh as unknown as Data, STAFF)).toMatchObject({ ok: false });

    await publish('programs', 'spring-intro', STAFF);
    const renamed = { ...(await getEntry('programs', 'spring-intro'))!.published as Data, slug: 'other-name' };
    expect(await saveDraft('programs', 'spring-intro', renamed, STAFF)).toMatchObject({ ok: true, id: 'spring-intro' });
    expect(((await getEntry('programs', 'spring-intro'))!.draft as Program | null)?.slug ?? 'spring-intro').toBe('spring-intro');
  });

  it('won’t remove a session families signed up for', async () => {
    const db = await getDb();
    const [h] = await db.insert(schema.household).values({ name: 'Rivera family' }).returning();
    const [s] = await db.insert(schema.student).values({ householdId: h.id, firstName: 'Maya', lastName: 'Rivera' }).returning();
    await db.insert(schema.enrollment).values({ householdId: h.id, studentId: s.id, sessionId: 'yesand-f26-wed', programSlug: 'yes-and-improv', status: 'active' });

    const program = workingCopy((await getEntry('programs', 'yes-and-improv'))!) as unknown as Program;
    const without = { ...program, sessions: program.sessions.filter((x) => x.id !== 'yesand-f26-wed') };
    await saveDraft('programs', 'yes-and-improv', without as unknown as Data, STAFF);
    const result = await publish('programs', 'yes-and-improv', STAFF);
    expect(result).toMatchObject({ ok: false });
    expect(!result.ok && result.message).toMatch(/Closed/);
    expect((await getContent()).findSession('yesand-f26-wed')).toBeDefined();

    expect(await deleteEntry('programs', 'yes-and-improv', STAFF)).toMatchObject({ ok: false });
    await discardDraft('programs', 'yes-and-improv', STAFF);
    expect((await getEntry('programs', 'yes-and-improv'))!.draft).toBeNull();
  });

  it('won’t delete something other content points to', async () => {
    expect(await referencesTo('locations', 'hq')).toContain('Intro to Theater');
    expect(await deleteEntry('locations', 'hq', STAFF)).toMatchObject({ ok: false });
    expect(await referencesTo('testimonials', 'lane')).toContain('Home page');
  });

  it('deletes and restores', async () => {
    expect(await deleteEntry('faqs', 'who-do-you-serve', STAFF)).toMatchObject({ ok: false }); // used on the About page
    const id = 'can-we-visit-before-enrolling';
    const before = (await getContent()).faqs.length;
    const faq = await saveDraft('faqs', undefined, { group: 'Getting started', q: 'Can we visit before enrolling?', a: 'Yes!' }, STAFF);
    expect(faq).toMatchObject({ ok: true, id });
    await publish('faqs', id, STAFF);
    expect((await getContent()).faqs.length).toBe(before + 1);
    expect(await deleteEntry('faqs', id, STAFF)).toMatchObject({ ok: true });
    expect((await getContent()).faqs.length).toBe(before);
    const [deleted, published] = await history('faqs', id);
    expect(deleted.action).toBe('delete');
    await restoreToDraft('faqs', id, published.id, STAFF);
    await publish('faqs', id, STAFF, 'restore');
    expect((await getContent()).faq(id)?.a).toBe('Yes!');
  });

  it('reorders a list', async () => {
    const ids = (await getContent()).team.map((m) => m.id);
    const flipped = [ids[1], ids[0], ...ids.slice(2)];
    await reorder('team', flipped, STAFF);
    expect((await getContent()).team.map((m) => m.id)).toEqual(flipped);
  });

  it('saves page text, with the new version live after publishing', async () => {
    const home = workingCopy((await getEntry('pages', 'home'))!) as Data & { hero: Data };
    const edited = { ...home, hero: { ...home.hero, headline: 'Welcome to the *stage*.' } };
    expect(await saveDraft('pages', 'home', edited, STAFF)).toMatchObject({ ok: true, id: 'home' });
    await publish('pages', 'home', STAFF);
    expect((await getContent()).pages.home.hero.headline).toBe('Welcome to the *stage*.');
  });

  it('turns on the announcement bar from site settings', async () => {
    const settings = workingCopy((await getEntry('pages', 'site'))!);
    await saveDraft('pages', 'site', { ...settings, announcement: { show: true, text: 'Spring registration is open!', gel: 'teal' } }, STAFF);
    await publish('pages', 'site', STAFF);
    expect((await getContent()).site.announcement).toMatchObject({ show: true, text: 'Spring registration is open!' });
  });
});
