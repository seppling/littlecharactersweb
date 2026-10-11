/**
 * Put the wording drafts (src/content/seo-draft/) into the content editor as
 * unpublished drafts. Used by `npm run seo:load-drafts` and the Render
 * preview's database step.
 *
 * Rules, each proved in tests/unit/seo-drafts.test.ts:
 *   - It never publishes. Families see nothing until Hannah publishes.
 *   - An entry that already has unpublished changes is left alone.
 *   - An edit applies only while the field still holds its `from` text.
 *   - Saving goes through saveDraft, the editor's own save, with its checks.
 *   - Running it again changes nothing.
 */
import { collections } from '../src/content/collections';
import { slugify } from '../src/content/ids';
import { pages as pageDefs, isPageKey } from '../src/content/pages';
import type { Data } from '../src/content/fields';
import { applyEdits, fieldsOf, isNewEntry, type Draft, type EntryDraft, type NewEntryDraft } from '../src/content/seo-draft/format';
import { getEntry, listEntries, prepare, sameContent, saveDraft, workingCopy } from '../src/server/content';

/**
 * Who saved the draft, as recorded in content_entry.updated_by. It isn't a
 * person's account, so it can't sign in; when Hannah publishes, the history
 * records her.
 */
export const LOADED_BY = 'seo-drafts';

export type Status = 'loaded' | 'ready' | 'skipped' | 'unchanged' | 'problem';

export interface Outcome {
  /** "Home page", "Classes & camps: Acting Studio" */
  name: string;
  /** Where to open it in the editor. */
  editUrl: string;
  status: Status;
  /** In plain words: why it was skipped, or what needs fixing. */
  notes: string[];
}

export async function loadDrafts(drafts: Draft[], { commit }: { commit: boolean }): Promise<Outcome[]> {
  const out: Outcome[] = [];
  for (const d of drafts) out.push(isNewEntry(d) ? await loadNew(d, commit) : await loadEdits(d, commit));
  return out;
}

const errorsInWords = (r: { errors: Record<string, string>; message?: string }) => [
  ...(r.message ? [r.message] : []),
  ...Object.entries(r.errors).map(([path, message]) => `${path}: ${message}`),
];

async function loadEdits(d: EntryDraft, commit: boolean): Promise<Outcome> {
  const editUrl = `/admin/content/${d.kind}/${d.id}`;
  const base = { editUrl, name: `${d.kind}/${d.id}` };
  const fields = fieldsOf(d.kind, d.id);
  if (!fields) return { ...base, status: 'problem', notes: [`There is no ${d.kind === 'pages' ? 'page' : 'list'} called “${d.kind === 'pages' ? d.id : d.kind}”.`] };
  const entry = await getEntry(d.kind, d.id);
  if (!entry) return { ...base, status: 'skipped', notes: ['It isn’t in the editor (deleted, or the id is wrong).'] };
  const name =
    d.kind === 'pages' ? (isPageKey(d.id) ? pageDefs[d.id].label : d.id) : `${collections[d.kind].label}: ${collections[d.kind].title(workingCopy(entry) as never)}`;
  const named = { ...base, name };
  if (entry.draft != null)
    return { ...named, status: 'skipped', notes: ['It already has unpublished changes, so it was left alone. Publish or discard those first, then run this again.'] };
  if (entry.published == null) return { ...named, status: 'skipped', notes: ['It isn’t on the site yet, so there is nothing to compare with.'] };

  const published = entry.published as Data;
  const { data, changed, invalid } = applyEdits(fields, published, d.edits);
  if (invalid.length) return { ...named, status: 'problem', notes: invalid };
  if (changed.length) return { ...named, status: 'skipped', notes: changed };
  if (sameContent(data, published)) return { ...named, status: 'unchanged', notes: ['The site already says this.'] };

  if (!commit) {
    const checked = await prepare(d.kind, d.id, data);
    return checked.ok ? { ...named, status: 'ready', notes: [] } : { ...named, status: 'problem', notes: errorsInWords(checked) };
  }
  const saved = await saveDraft(d.kind, d.id, data, LOADED_BY);
  return saved.ok ? { ...named, status: 'loaded', notes: [] } : { ...named, status: 'problem', notes: errorsInWords(saved) };
}

async function loadNew(d: NewEntryDraft, commit: boolean): Promise<Outcome> {
  const def = collections[d.kind];
  if (!def) return { name: `new in ${d.kind}`, editUrl: '/admin/content', status: 'problem', notes: [`There is no list called “${d.kind}”.`] };
  const title = String(def.title(d.create as never) ?? '');
  const id = def.idField ? String(d.create[def.idField] ?? '') : slugify(def.newId?.(d.create as never) ?? title);
  const base = { name: `${def.label}: ${title} (new)`, editUrl: `/admin/content/${d.kind}/${id}` };
  // The same id or the same title means it's already there (loaded before, or written by hand).
  const existing = (await listEntries(d.kind)).find((e) => e.id === id || def.title(workingCopy(e) as never) === title);
  if (existing) return { ...base, editUrl: `/admin/content/${d.kind}/${existing.id}`, status: 'skipped', notes: ['One with this name is already in the editor, so it was left alone.'] };

  if (!commit) {
    const checked = await prepare(d.kind, undefined, structuredClone(d.create));
    return checked.ok ? { ...base, status: 'ready', notes: [] } : { ...base, status: 'problem', notes: errorsInWords(checked) };
  }
  const saved = await saveDraft(d.kind, undefined, structuredClone(d.create), LOADED_BY);
  return saved.ok
    ? { ...base, editUrl: `/admin/content/${d.kind}/${saved.id}`, status: 'loaded', notes: [] }
    : { ...base, status: 'problem', notes: errorsInWords(saved) };
}

const HEADINGS: Record<Status, string> = {
  loaded: 'Saved as unpublished drafts',
  ready: 'Ready to load (nothing written yet)',
  unchanged: 'Nothing to change',
  skipped: 'Skipped',
  problem: 'Needs fixing in the draft files',
};

/** The outcome in plain words, for the terminal. */
export function describeOutcomes(outcomes: Outcome[], commit: boolean): string {
  if (!outcomes.length) return 'There are no drafts in src/content/seo-draft/ yet.';
  const lines: string[] = [];
  for (const status of ['loaded', 'ready', 'unchanged', 'skipped', 'problem'] as Status[]) {
    const group = outcomes.filter((o) => o.status === status);
    if (!group.length) continue;
    lines.push('', `${HEADINGS[status]} (${group.length})`);
    for (const o of group) {
      lines.push(`  ${o.name}   ${o.editUrl}`);
      for (const n of o.notes) lines.push(`      ${n}`);
    }
  }
  if (!commit && outcomes.some((o) => o.status === 'ready')) lines.push('', 'Looks right? Run again with --commit to save them as drafts. Nothing is published.');
  if (commit && outcomes.some((o) => o.status === 'loaded')) lines.push('', 'Nothing was published. Review each one in the editor, then Publish or Discard.');
  return lines.join('\n').trimStart();
}
