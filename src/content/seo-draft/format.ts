/**
 * The format of wording drafts, and how one is applied to an entry's content.
 *
 * A draft never changes the site by itself. `npm run seo:load-drafts` saves
 * each one as an unpublished draft in the content editor, where Hannah
 * previews it, then publishes or discards it. See docs/seo/drafts.md.
 *
 * Nothing here names a field: paths are checked against the field
 * definitions in collections.ts and pages.ts, so a field added there can be
 * drafted without changing this file.
 */
import { collections, type CollectionKey } from '../collections';
import { isPageKey, pages as pageDefs } from '../pages';
import type { Data, Field } from '../fields';
import type { PageKey } from '../types';

export type Kind = CollectionKey | 'pages';

/** A field's value as it's saved: text, a number, a yes/no, or a list of lines or paragraphs. */
export type Value = string | number | boolean | string[];

export interface Edit {
  /**
   * Where the field is, as keys joined by dots. Numbers pick an item in a
   * list, counting from 0: `seo.title`, `callSheet.items.2.text`,
   * `description.0` (the first paragraph), `image.alt`.
   */
  path: string;
  /**
   * The exact text the field holds now ('' when it's empty). The edit applies
   * only while the field still holds this, so a change made since the draft
   * was written is never overwritten.
   */
  from: Value;
  /** The new text. '' empties the field. */
  to: Value;
  /** Why, in a sentence, for Hannah. */
  why: string;
}

/** Changes to an entry that's already on the site. */
export interface EntryDraft<K extends Kind = Kind> {
  kind: K;
  /** The entry's id: the end of its editor address, /admin/content/<kind>/<id>. */
  id: K extends 'pages' ? PageKey : string;
  edits: Edit[];
}

/** A new entry (a new FAQ, say), saved as unpublished. */
export interface NewEntryDraft<K extends CollectionKey = CollectionKey> {
  kind: K;
  /** Every field of the new entry, as the editor would save it. */
  create: Data;
  why: string;
}

export type Draft = EntryDraft | NewEntryDraft;
export type PageDraft = EntryDraft<'pages'>;
export type CollectionDraft<K extends CollectionKey> = EntryDraft<K> | NewEntryDraft<K>;

export const isNewEntry = (d: Draft): d is NewEntryDraft => 'create' in d;

export function fieldsOf(kind: Kind, id: string): Field[] | undefined {
  if (kind === 'pages') return isPageKey(id) ? pageDefs[id].fields : undefined;
  return collections[kind]?.fields;
}

/** Empty, the way the editor treats it: nothing, '' or no items. */
const isBlank = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

/** Stable JSON, so key order doesn't matter. */
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

export const sameValue = (a: unknown, b: unknown) => (isBlank(a) && isBlank(b)) || canonical(a) === canonical(b);

const IMAGE_KEYS = ['src', 'alt', 'position', 'placeholder'];
/** Stands for a single line, paragraph or photo detail: nothing is inside it. */
const END: Field = { key: '', label: '', type: 'hidden' };

/**
 * Check a path against the field definitions. Returns the field labels along
 * the way ("Search engines › Title") or what's wrong with it.
 */
export function resolvePath(fields: Field[], path: string): { ok: true; labels: string[] } | { ok: false; problem: string } {
  const parts = path.split('.');
  const labels: string[] = [];
  let current: Field[] | undefined = fields;
  let leaf: Field | undefined;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isIndex = /^\d+$/.test(part);
    if (leaf) {
      // Inside a field that isn't a group: only list items and photo details.
      if (leaf.type === 'list' && isIndex) {
        labels.push(`${leaf.itemLabel} ${Number(part) + 1}`);
        if (i === parts.length - 1) return { ok: false, problem: `point at a field inside ${leaf.itemLabel} ${Number(part) + 1}, not the whole item` };
        current = leaf.fields;
        leaf = undefined;
        continue;
      }
      if ((leaf.type === 'paragraphs' || leaf.type === 'lines') && isIndex) {
        labels.push(`${leaf.type === 'paragraphs' ? 'paragraph' : 'line'} ${Number(part) + 1}`);
        leaf = END;
        continue;
      }
      if (leaf.type === 'image' && IMAGE_KEYS.includes(part)) {
        labels.push(part === 'alt' ? 'description' : part);
        leaf = END;
        continue;
      }
      return { ok: false, problem: `“${parts.slice(0, i).join('.')}” has nothing called “${part}” inside it` };
    }
    const f: Field | undefined = current?.find((x) => x.key === part);
    if (!f) return { ok: false, problem: `there is no field “${parts.slice(0, i + 1).join('.')}”` };
    labels.push(f.label);
    if (f.type === 'group') {
      current = f.fields;
      leaf = undefined;
    } else {
      current = undefined;
      leaf = f;
    }
  }
  if (!leaf || leaf.type === 'list' || leaf.type === 'image') return { ok: false, problem: `“${labels.at(-1)}” holds several fields; point at one of them` };
  return { ok: true, labels };
}

const getIn = (data: unknown, parts: string[]) =>
  parts.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Data)[k] : undefined), data);

/** Set a value by path, making groups as needed. Emptying a field removes it, and any group it leaves empty. */
function setIn(data: Data, parts: string[], value: Value): string | undefined {
  const chain: unknown[] = [data];
  let node: unknown = data;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    const container = node as Data;
    if (Array.isArray(container)) {
      if (!/^\d+$/.test(k) || Number(k) >= container.length) return `“${parts.slice(0, i + 1).join('.')}”: that list has no item ${k}`;
    } else if (container[k] == null) {
      if (/^\d+$/.test(parts[i + 1])) return `“${parts.slice(0, i + 1).join('.')}” is empty, so it has no item ${parts[i + 1]}`;
      container[k] = {};
    }
    node = container[k];
    chain.push(node);
  }
  const last = parts[parts.length - 1];
  const target = node as Data;
  if (Array.isArray(target)) {
    if (!/^\d+$/.test(last) || Number(last) >= target.length) return `“${parts.join('.')}”: that list has no item ${last}`;
    target[Number(last)] = value as never;
    return;
  }
  if (value === '' || value == null) delete target[last];
  else target[last] = value;
  // Drop groups left empty, the way the editor does.
  for (let i = chain.length - 1; i > 0; i--) {
    const obj = chain[i];
    const parent = chain[i - 1];
    if (Array.isArray(obj) || Array.isArray(parent) || !obj || typeof obj !== 'object' || Object.keys(obj).length) break;
    delete (parent as Data)[parts[i - 1]];
  }
}

export interface Applied {
  data: Data;
  /** Fields that have changed since the draft was written. */
  changed: string[];
  /** Mistakes in the draft itself: a path that isn't a field, an item that isn't there. */
  invalid: string[];
}

/** Apply a draft's edits to a copy of the entry's content. Never changes `current`. */
export function applyEdits(fields: Field[], current: Data, edits: Edit[]): Applied {
  const data = structuredClone(current);
  const changed: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const edit of edits) {
    const resolved = resolvePath(fields, edit.path);
    if (!resolved.ok) {
      invalid.push(`${edit.path}: ${resolved.problem}`);
      continue;
    }
    if (seen.has(edit.path)) {
      invalid.push(`${edit.path}: edited twice in the same draft`);
      continue;
    }
    seen.add(edit.path);
    const parts = edit.path.split('.');
    const now = getIn(current, parts);
    if (!sameValue(now, edit.from)) {
      changed.push(`${edit.path} (${resolved.labels.join(' › ')}) has changed since the draft was written. It now reads: ${show(now)}`);
      continue;
    }
    const problem = setIn(data, parts, edit.to);
    if (problem) invalid.push(problem);
  }
  return { data, changed, invalid };
}

export function show(v: unknown): string {
  if (isBlank(v)) return '(empty)';
  if (typeof v === 'string') return `“${v}”`;
  return JSON.stringify(v);
}
