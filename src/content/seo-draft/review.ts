/**
 * docs/seo/review.md, written from the draft files by `npm run seo:review`,
 * so it always matches them. A test fails when it's out of date.
 */
import { collections } from '../collections';
import { isPageKey, pages as pageDefs } from '../pages';
import { seedEntries } from '../seed';
import type { Data, Field } from '../fields';
import { fieldsOf, isNewEntry, resolvePath, type Draft, type Value } from './format';

const seedTitle = (kind: string, id: string) => {
  const entry = seedEntries().find((e) => e.collection === kind && e.id === id);
  return entry && kind !== 'pages' ? String(collections[kind as keyof typeof collections].title(entry.data as never)) : id;
};

function quote(v: Value | undefined): string {
  const parts = Array.isArray(v) ? v : v === undefined || v === '' ? [] : [String(v)];
  if (!parts.length) return '> _(empty)_';
  return parts.map((p) => p.split('\n').map((l) => `> ${l}`).join('\n')).join('\n>\n');
}

function fieldLines(fields: Field[], data: Data, prefix: string[] = []): string[] {
  const out: string[] = [];
  for (const f of fields) {
    const v = data[f.key];
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (f.type === 'group' && typeof v === 'object') out.push(...fieldLines(f.fields, v as Data, [...prefix, f.label]));
    else if (typeof v !== 'object' || (Array.isArray(v) && v.every((x) => typeof x === 'string')))
      out.push(`**${[...prefix, f.label].join(' › ')}**`, '', quote(v as Value), '');
    else out.push(`**${[...prefix, f.label].join(' › ')}**: see the editor`, '');
  }
  return out;
}

export function renderReview(drafts: Draft[]): string {
  const lines = [
    '# Wording drafts to review',
    '',
    '_Written by `npm run seo:review` from the files in `src/content/seo-draft/`. Don’t edit this page by hand; it’s rewritten each time._',
    '',
    'Each section below is one page, class, event or question. Once loaded (`npm run seo:load-drafts`), the new wording waits in the editor as **unpublished changes**: the site keeps showing today’s wording until it’s published.',
    '',
    'To review one: sign in, open its editor link, and press **Preview** to see the page with the new wording. Then **Publish** to put it on the site, or **Discard unpublished changes** to throw it away. You can also change the wording in the form first. See [drafts.md](drafts.md) for more.',
    '',
  ];
  if (!drafts.length) lines.push('There are no drafts yet.', '');
  for (const d of drafts) {
    if (isNewEntry(d)) {
      const def = collections[d.kind];
      lines.push(`## ${def.label}: new ${def.singular}, “${def.title(d.create as never)}”`, '');
      lines.push(`Find it in the list at \`/admin/content/${d.kind}\`, marked “Not published yet”.`, '', `_Why:_ ${d.why}`, '');
      lines.push(...fieldLines(def.fields, d.create));
      continue;
    }
    const name = d.kind === 'pages' ? (isPageKey(d.id) ? pageDefs[d.id].label : d.id) : `${collections[d.kind].label}: ${seedTitle(d.kind, d.id)}`;
    lines.push(`## ${name}`, '', `Edit: \`/admin/content/${d.kind}/${d.id}\``, '');
    const fields = fieldsOf(d.kind, d.id) ?? [];
    for (const e of d.edits) {
      const resolved = resolvePath(fields, e.path);
      lines.push(`### ${resolved.ok ? resolved.labels.join(' › ') : e.path}`, '', 'Before:', '', quote(e.from), '', 'After:', '', quote(e.to), '', `_Why:_ ${e.why}`, '');
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
