/**
 * Photos: the ones that ship with the site (src/assets) and the ones uploaded
 * in the editor (stored in the database).
 *
 * Pages are rendered on request, so they never resize images themselves:
 *   - built-in photos are resized once, at build time, by the prerendered
 *     route /media/builtin/<folder>/<name>/<width>.webp;
 *   - uploads are resized when they're uploaded (src/server/media.ts) and
 *     served from /media/<id>/<width>.
 */
import type { ImageRef } from '@/content/types';

/** The widths we make of every photo (never wider than the original). */
export const PHOTO_WIDTHS = [360, 640, 960, 1280];

/** The logo is shown at fixed sizes. */
const FIXED_WIDTHS: Record<string, number[]> = {
  'brand/logo-horizontal': [190, 380, 570],
  'brand/logo-mark': [48, 96, 144],
};

const files = import.meta.glob<ImageMetadata>('/src/assets/{photos,team,brand}/*.{webp,png,jpg,jpeg}', { eager: true, import: 'default' });

export interface BuiltinPhoto {
  /** "photos/cast-silly-faces" */
  key: string;
  folder: string;
  /** Path under the project, for the build-time resizer. */
  file: string;
  width: number;
  height: number;
  widths: number[];
}

const widthsFor = (key: string, width: number) => {
  const fixed = FIXED_WIDTHS[key];
  if (fixed) return fixed;
  const fitting = PHOTO_WIDTHS.filter((w) => w <= width);
  return fitting.length ? fitting : [width];
};

export const builtinPhotos: BuiltinPhoto[] = Object.entries(files).map(([file, meta]) => {
  const [, folder, name] = file.match(/^\/src\/assets\/(\w+)\/(.+)\.\w+$/)!;
  const key = `${folder}/${name}`;
  return { key, folder, file: file.slice(1), width: meta.width, height: meta.height, widths: widthsFor(key, meta.width) };
});

const builtinByKey = new Map(builtinPhotos.map((p) => [p.key, p]));

export const builtinUrl = (key: string, width: number) => `/media/builtin/${key}/${width}.webp`;
export const uploadUrl = (id: string, width: number) => `/media/${id}/${width}`;

/** What we know about an uploaded photo (from the media table). */
export interface UploadInfo {
  width: number;
  height: number;
  widths: number[];
  alt?: string | null;
}

export interface ResolvedImage {
  src: string;
  srcset: string;
  width: number;
  height: number;
}

/** A photo reference → the <img> attributes. Undefined when there's no photo (or it was deleted). */
export function resolveImage(ref: Pick<ImageRef, 'src'> | undefined, uploads: Map<string, UploadInfo>, preferWidth = 960): ResolvedImage | undefined {
  const src = ref?.src;
  if (!src) return undefined;
  let info: { width: number; height: number; widths: number[] } | undefined;
  let url: (w: number) => string;
  if (src.startsWith('builtin:')) {
    const key = src.slice('builtin:'.length);
    info = builtinByKey.get(key);
    url = (w) => builtinUrl(key, w);
  } else if (src.startsWith('media:')) {
    const id = src.slice('media:'.length);
    info = uploads.get(id);
    url = (w) => uploadUrl(id, w);
  } else {
    return undefined;
  }
  if (!info || !info.widths.length) return undefined;
  const fallback = info.widths.filter((w) => w <= preferWidth).at(-1) ?? info.widths[0];
  return {
    src: url(fallback),
    srcset: info.widths.map((w) => `${url(w)} ${w}w`).join(', '),
    width: info.width,
    height: info.height,
  };
}

/** A small preview for the editor's photo picker. */
export function thumbnail(src: string | undefined, uploads: Map<string, UploadInfo>) {
  return resolveImage(src ? { src } : undefined, uploads, 360)?.src;
}
