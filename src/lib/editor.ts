/**
 * Small helpers shared by the editor pages in src/pages/admin/content.
 */
import { collections, type CollectionKey } from '@/content/collections';
import type { Data, Field, Option, RefCollection } from '@/content/fields';
import { pages, type PageDef } from '@/content/pages';
import type { SiteContent } from '@/content/site-content';
import type { PageKey } from '@/content/types';

export const BASE = '/admin/content';

/** Choices for fields that point at other content. Includes unpublished items, so a new class can be linked before it goes live. */
export function refOptions(content: SiteContent): Record<RefCollection, Option[]> {
  return {
    programs: content.programs.map((p) => ({ value: p.slug, label: p.title })),
    locations: content.locations.map((l) => ({ value: l.id, label: l.name })),
    testimonials: content.testimonials.map((t) => ({ value: t.id, label: `${t.attribution}: “${t.quote.slice(0, 50)}…”` })),
    faqs: content.faqs.map((f) => ({ value: f.id, label: f.q })),
    events: content.events.map((e) => ({ value: e.slug, label: e.title })),
  };
}

export interface EditTarget {
  kind: CollectionKey | 'pages';
  label: string;
  /** The list it belongs to, for the breadcrumb. */
  parent: { label: string; href: string };
  fields: Field[];
  title(data: Data): string;
  url(data: Data): string;
  deletable: boolean;
}

export function editTarget(kind: string, id: string): EditTarget | undefined {
  if (kind === 'pages') {
    const page: PageDef | undefined = pages[id as PageKey];
    if (!page) return undefined;
    return {
      kind,
      label: page.label,
      parent: { label: 'Pages', href: BASE },
      fields: page.fields,
      title: () => page.label,
      url: () => page.url,
      deletable: false,
    };
  }
  const def = collections[kind as CollectionKey];
  if (!def) return undefined;
  return {
    kind: def.key,
    label: def.singular,
    parent: { label: def.label, href: `${BASE}/${def.key}` },
    fields: def.fields,
    title: (d) => def.title(d as never) || `New ${def.singular}`,
    url: (d) => def.url(d as never),
    deletable: true,
  };
}

export const when = (d: Date | string | null | undefined) =>
  d
    ? new Date(d).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';

/** Set by staff to see unpublished edits on the site (see /admin/content/preview). */
export const PREVIEW_COOKIE = 'lc_preview';

/** A version, written out as "Label: value" lines, for the history page. */
export function describe(fields: Field[], data: Data | undefined, indent = ''): string[] {
  const lines: string[] = [];
  for (const f of fields) {
    const v = data?.[f.key];
    if (v == null || v === '' || (Array.isArray(v) && !v.length) || f.type === 'hidden') continue;
    if (f.type === 'group') {
      lines.push(`${indent}${f.label}:`, ...describe(f.fields, v as Data, `${indent}    `));
    } else if (f.type === 'list') {
      (v as Data[]).forEach((item, i) => lines.push(`${indent}${f.itemLabel[0].toUpperCase()}${f.itemLabel.slice(1)} ${i + 1}:`, ...describe(f.fields, item, `${indent}    `)));
    } else if (f.type === 'image') {
      const img = v as { src?: string; alt?: string };
      lines.push(`${indent}${f.label}: ${img.alt || img.src || ''}`);
    } else if (f.type === 'toggle') {
      lines.push(`${indent}${f.label}: yes`);
    } else if (Array.isArray(v)) {
      lines.push(`${indent}${f.label}: ${v.join(f.type === 'paragraphs' ? '\n\n' : ', ')}`);
    } else {
      lines.push(`${indent}${f.label}: ${String(v)}`);
    }
  }
  return lines;
}

/** "sessions.1.start" → "Sessions › Fall 2026 (session 2) › Starts at", for the list of problems. */
export function labelOf(fields: Field[], path: string, data: Data | undefined): string {
  const [key, ...rest] = path.split('.');
  const f = fields.find((x) => x.key === key);
  if (!f) return path;
  const value = data?.[key];
  if (f.type === 'group' && rest.length) return `${f.label} › ${labelOf(f.fields, rest.join('.'), value as Data)}`;
  if (f.type === 'list' && rest.length) {
    const [index, ...more] = rest;
    const item = (value as Data[] | undefined)?.[Number(index)];
    const name = `${f.itemLabel[0].toUpperCase()}${f.itemLabel.slice(1)} ${Number(index) + 1}`;
    return more.length ? `${f.label} › ${name} › ${labelOf(f.fields, more.join('.'), item)}` : `${f.label} › ${name}`;
  }
  if (f.type === 'image' && rest[0] === 'alt') return `${f.label} › Description`;
  return f.label;
}
