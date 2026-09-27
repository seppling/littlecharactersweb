/**
 * Field definitions for the content editor.
 *
 * Each kind of content (a class, an event, the home page…) is described once
 * as a list of fields. That one description drives three things:
 *   - the edit form in /admin/content (labels, help text, input types),
 *   - reading the submitted form back into data (`readForm`),
 *   - validating it before it's saved (`validatorFor`).
 *
 * Form field names are dotted paths: `sessions.2.start`. A list writes one
 * hidden `sessions[]` input per item, in page order, holding that item's token,
 * so items can be reordered or removed in the browser without renumbering.
 */
import { z } from 'zod';

export interface Option {
  value: string;
  label: string;
}

/** Content that other content can point at (a session's location, the home page's featured quote…). */
export type RefCollection = 'programs' | 'locations' | 'testimonials' | 'events' | 'faqs';

interface Base {
  key: string;
  label: string;
  /** One or two sentences under the label. */
  help?: string;
  required?: boolean;
  placeholder?: string;
  /** Sits beside the next half-width field on wide screens. */
  half?: boolean;
}

export type Field =
  | (Base & { type: 'text'; max?: number; format?: 'slug' | 'email' })
  | (Base & { type: 'textarea'; rows?: number; max?: number })
  /** A list of paragraphs, edited as one box with a blank line between paragraphs. */
  | (Base & { type: 'paragraphs'; rows?: number; keepEmpty?: boolean })
  /** A list of short lines, one per line. */
  | (Base & { type: 'lines'; rows?: number; keepEmpty?: boolean })
  | (Base & { type: 'number'; min?: number; max?: number; integer?: boolean })
  /** Dollars. */
  | (Base & { type: 'money' })
  | (Base & { type: 'select'; options: readonly Option[] })
  | (Base & { type: 'multi'; options: readonly Option[] })
  | (Base & { type: 'toggle' })
  | (Base & { type: 'date' })
  | (Base & { type: 'month' })
  | (Base & { type: 'time' })
  | (Base & { type: 'datetime' })
  | (Base & { type: 'url' })
  | (Base & { type: 'image' })
  | (Base & { type: 'group'; fields: Field[] })
  | (Base & {
      type: 'list';
      fields: Field[];
      /** What one item is called: "session", "performance"… */
      itemLabel: string;
      /** Item keys whose values make up the item's heading in the form. */
      titleKeys?: string[];
      min?: number;
      max?: number;
      keepEmpty?: boolean;
      /** Show items folded, with just their heading, until opened. */
      collapsed?: boolean;
    })
  | (Base & { type: 'ref'; collection: RefCollection; multiple?: boolean })
  /** Kept as-is from the saved data (ids). */
  | (Base & { type: 'hidden' });

export type FieldType = Field['type'];
export type Data = Record<string, unknown>;

export const join = (prefix: string, key: string) => (prefix ? `${prefix}.${key}` : key);

// ───────────── Reading a submitted form ─────────────

const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim() : '');
const orUndefined = (s: string) => (s === '' ? undefined : s);
const isEmpty = (v: unknown): boolean =>
  v === undefined || (Array.isArray(v) && v.length === 0) || (isPlainObject(v) && Object.values(v).every(isEmpty));
const isPlainObject = (v: unknown): v is Data => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Turn a submitted form into data, following the field definitions (not whatever the browser sent). */
export function readForm(fields: Field[], fd: FormData, prefix = ''): Data {
  const out: Data = {};
  for (const f of fields) {
    const v = readField(f, fd, join(prefix, f.key));
    if (v !== undefined) out[f.key] = v;
  }
  return out;
}

function readField(f: Field, fd: FormData, path: string): unknown {
  switch (f.type) {
    case 'text':
    case 'url':
    case 'date':
    case 'month':
    case 'time':
    case 'datetime':
    case 'select':
    case 'hidden':
      return orUndefined(str(fd.get(path)).replace(/\s*\n\s*/g, ' '));
    case 'textarea':
      return orUndefined(str(fd.get(path)));
    case 'ref':
      if (f.multiple) return nonEmptyList(fd.getAll(path).map(str).filter(Boolean), f.required);
      return orUndefined(str(fd.get(path)));
    case 'paragraphs': {
      const paras = str(fd.get(path))
        .split(/\n\s*\n/)
        .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
        .filter(Boolean);
      return f.keepEmpty ? paras : nonEmptyList(paras, f.required);
    }
    case 'lines': {
      const lines = str(fd.get(path))
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      return f.keepEmpty ? lines : nonEmptyList(lines, f.required);
    }
    case 'number':
    case 'money': {
      const s = str(fd.get(path)).replace(/^\$/, '').replace(/,/g, '');
      if (s === '') return undefined;
      const n = Number(s);
      // Keep what was typed when it isn't a number, so validation can say so.
      return Number.isFinite(n) ? n : s;
    }
    case 'toggle':
      return fd.get(path) === 'on' ? true : undefined;
    case 'multi':
      return nonEmptyList(fd.getAll(path).map(str).filter(Boolean), f.required);
    case 'image': {
      const img: Data = {};
      for (const k of ['src', 'alt', 'position', 'placeholder']) {
        const v = orUndefined(str(fd.get(`${path}.${k}`)).replace(/\s*\n\s*/g, ' '));
        if (v !== undefined) img[k] = v;
      }
      return img.src || img.placeholder ? img : undefined;
    }
    case 'group': {
      const obj = readForm(f.fields, fd, path);
      return isEmpty(obj) && !f.required ? undefined : obj;
    }
    case 'list': {
      const items = fd
        .getAll(`${path}[]`)
        .map(str)
        .filter((token) => /^[\w-]+$/.test(token))
        .map((token) => readForm(f.fields, fd, `${path}.${token}`))
        // A blank item that was added and never filled in is dropped. Ids alone don't count.
        .filter((item) => !isEmpty(withoutHidden(f.fields, item)));
      return f.keepEmpty ? items : nonEmptyList(items, f.required);
    }
  }
}

function withoutHidden(fields: Field[], item: Data) {
  const copy = { ...item };
  for (const f of fields) if (f.type === 'hidden') delete copy[f.key];
  return copy;
}

/** Empty lists are left out, unless the field is required (then validation reports it). */
function nonEmptyList<T>(items: T[], required?: boolean) {
  return items.length || required ? items : undefined;
}

// ───────────── Validation ─────────────

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATETIME = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/;
const IMAGE_SRC = /^(builtin:[a-z]+\/[\w-]+|media:[\w-]+)$/;
const POSITION = /^(100|\d{1,2})% (100|\d{1,2})%$/;

/** Links may go to a page on this site, a web page, an email address or a phone number. */
export function isSafeUrl(url: string) {
  return /^(https?:\/\/[^\s<>"]+|\/[^\s<>"]*|#[\w-]*|mailto:[^\s<>"]+|tel:\+?[\d\s().-]+|\{\w+\})$/i.test(url);
}

const required = 'Required';

function textSchema(max: number, isRequired?: boolean) {
  const s = z.string({ error: required }).max(max, `Keep this under ${max} characters`);
  return isRequired ? s.min(1, required) : s.optional();
}

function schemaFor(f: Field): z.ZodType {
  const opt = <T extends z.ZodType>(s: T) => (f.required ? s : s.optional());
  switch (f.type) {
    case 'text': {
      const max = f.max ?? 300;
      if (f.format === 'email') return opt(z.email({ error: (issue) => (issue.input === undefined ? required : 'Check the email address') }).max(max));
      let s = z.string({ error: required }).max(max, `Keep this under ${max} characters`);
      if (f.format === 'slug') s = s.regex(SLUG, 'Use lowercase letters, numbers and dashes, like “summer-camp”');
      return f.required ? s.min(1, required) : s.optional();
    }
    case 'hidden':
      return z.string().max(200).optional();
    case 'textarea':
      return textSchema(f.max ?? 5000, f.required);
    case 'paragraphs':
    case 'lines': {
      const s = z.array(z.string().max(5000), { error: required });
      return f.required ? s.min(1, required) : f.keepEmpty ? s : s.optional();
    }
    case 'number': {
      let s = z.number({ error: (issue) => (issue.input === undefined ? required : 'Enter a number') });
      if (f.integer) s = s.int('Enter a whole number');
      if (f.min !== undefined) s = s.min(f.min, `At least ${f.min}`);
      if (f.max !== undefined) s = s.max(f.max, `At most ${f.max}`);
      return opt(s);
    }
    case 'money':
      return opt(
        z
          .number({ error: (issue) => (issue.input === undefined ? required : 'Enter an amount, like 95 or 12.50') })
          .min(0, 'Can’t be negative')
          .max(100_000)
          .refine((n) => Math.abs(Math.round(n * 100) - n * 100) < 1e-6, 'Use dollars and cents, like 12.50'),
      );
    case 'select':
      return opt(z.enum(f.options.map((o) => o.value) as [string, ...string[]], { error: 'Choose one' }));
    case 'multi': {
      const s = z.array(z.enum(f.options.map((o) => o.value) as [string, ...string[]]), { error: 'Choose at least one' });
      return f.required ? s.min(1, 'Choose at least one') : s.optional();
    }
    case 'toggle':
      return z.boolean().optional();
    case 'date':
      return opt(z.string({ error: required }).regex(DATE, 'Use a date like 2026-10-05'));
    case 'month':
      return opt(z.string({ error: required }).regex(MONTH, 'Use a month like 2026-12'));
    case 'time':
      return opt(z.string({ error: required }).regex(TIME, 'Use a time like 16:30'));
    case 'datetime':
      return opt(z.string({ error: required }).regex(DATETIME, 'Use a date and time like 2026-10-05T16:30'));
    case 'url':
      return opt(
        z
          .string({ error: required })
          .max(2000)
          .refine(isSafeUrl, 'Use a full web address (https://…), a page on this site (/about), mailto: or tel:'),
      );
    case 'image':
      return opt(
        z
          .object({
            src: z.string().regex(IMAGE_SRC).optional(),
            alt: z.string().max(300).optional(),
            position: z.string().regex(POSITION).optional(),
            placeholder: z.string().max(120).optional(),
          })
          .superRefine((img, ctx) => {
            if (img.src && !img.alt) ctx.addIssue({ code: 'custom', path: ['alt'], message: 'Describe the photo for people who can’t see it' });
          }),
      );
    case 'group':
      return opt(objectSchema(f.fields, required));
    case 'list': {
      let s = z.array(objectSchema(f.fields), { error: required });
      if (f.min !== undefined) s = s.min(f.min, `Add at least ${f.min}`);
      if (f.max !== undefined) s = s.max(f.max, `No more than ${f.max}`);
      return f.required ? s.min(1, `Add at least one ${f.itemLabel}`) : f.keepEmpty ? s : s.optional();
    }
    case 'ref': {
      const one = z.string({ error: 'Choose one' }).max(200);
      if (f.multiple) return f.required ? z.array(one).min(1, 'Choose at least one') : z.array(one).optional();
      return f.required ? one.min(1, 'Choose one') : one.optional();
    }
  }
}

export function objectSchema(fields: Field[], error?: string) {
  return z.object(Object.fromEntries(fields.map((f) => [f.key, schemaFor(f)])), error ? { error } : undefined);
}

export type FieldErrors = Record<string, string>;

/** Validate against the field definitions. Errors are keyed by form path ("sessions.1.start"). */
export function validate(fields: Field[], data: Data): { ok: true; data: Data } | { ok: false; errors: FieldErrors } {
  const result = objectSchema(fields).safeParse(data);
  if (result.success) return { ok: true, data: result.data as Data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    errors[path] ??= issue.message;
  }
  return { ok: false, errors };
}

// ───────────── Writing values into a form ─────────────

/** The text an input shows for a saved value. */
export function inputValue(f: Field, value: unknown): string {
  if (value === undefined || value === null) return '';
  switch (f.type) {
    case 'paragraphs':
      return Array.isArray(value) ? value.join('\n\n') : String(value);
    case 'lines':
      return Array.isArray(value) ? value.join('\n') : String(value);
    default:
      return typeof value === 'object' ? '' : String(value);
  }
}

/**
 * The form a browser would submit for this data. Used by tests to prove that
 * opening an item in the editor and saving it unchanged loses nothing.
 */
export function toFormData(fields: Field[], data: Data, fd = new FormData(), prefix = ''): FormData {
  for (const f of fields) {
    const path = join(prefix, f.key);
    const v = data?.[f.key];
    if (v === undefined) continue;
    switch (f.type) {
      case 'group':
        toFormData(f.fields, v as Data, fd, path);
        break;
      case 'image':
        for (const [k, x] of Object.entries(v as Data)) if (x !== undefined) fd.append(`${path}.${k}`, String(x));
        break;
      case 'list':
        (v as Data[]).forEach((item, i) => {
          fd.append(`${path}[]`, String(i));
          toFormData(f.fields, item, fd, `${path}.${i}`);
        });
        break;
      case 'multi':
        for (const x of v as string[]) fd.append(path, x);
        break;
      case 'ref':
        if (f.multiple) for (const x of v as string[]) fd.append(path, x);
        else fd.append(path, String(v));
        break;
      case 'toggle':
        if (v) fd.append(path, 'on');
        break;
      default:
        fd.append(path, inputValue(f, v));
    }
  }
  return fd;
}

/** Walk every field, depth first, with its data path. */
export function* walkFields(fields: Field[], prefix = ''): Generator<{ field: Field; path: string }> {
  for (const f of fields) {
    const path = join(prefix, f.key);
    yield { field: f, path };
    if (f.type === 'group') yield* walkFields(f.fields, path);
  }
}
