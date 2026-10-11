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

// ───────────── Share images ─────────────
// Link previews (texts, Facebook, Slack) want a 1200×630 JPEG; many apps
// don't show WebP there. Each photo is cropped to that shape around its focus
// point. Where the crop sits is rounded to one of a few stops along the side
// that gets cropped, so built-in photos can be made once at build time (the route
// /media/share/builtin/<folder>/<name>/<stop>.jpg) and uploads are made on
// request and then cached for good (/media/share/<id>/<stop>.jpg).

export const SHARE_WIDTH = 1200;
export const SHARE_HEIGHT = 630;
/** Where the crop sits along the cropped side, in percent. */
export const SHARE_STOPS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
/** Folders of real photos. The logo doesn't crop well to a wide preview. */
export const SHARE_FOLDERS = ['photos', 'team'];

const KEYWORDS: Record<string, number> = { left: 0, top: 0, center: 50, right: 100, bottom: 100 };

/** A CSS object-position ("50% 30%", "center top", "left") → x and y in percent. Anything unreadable is the center. */
export function focusPoint(position: string | undefined): { x: number; y: number } {
  const parts = (position ?? '').trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 2);
  const value = (p: string | undefined) => {
    if (p === undefined) return 50;
    if (p in KEYWORDS) return KEYWORDS[p];
    const m = p.match(/^(-?\d+(?:\.\d+)?)%$/);
    return m ? Math.min(100, Math.max(0, Number(m[1]))) : 50;
  };
  // A single keyword names its own axis: "top" is the y, "left" the x.
  if (parts.length === 1 && (parts[0] === 'top' || parts[0] === 'bottom')) return { x: 50, y: value(parts[0]) };
  if (parts.length === 2 && (parts[0] === 'top' || parts[0] === 'bottom' || parts[1] === 'left' || parts[1] === 'right')) {
    return { x: value(parts[1]), y: value(parts[0]) };
  }
  return { x: value(parts[0]), y: value(parts[1]) };
}

/**
 * Where the preview sits along the photo's cropped side (the sides for wide
 * photos, top and bottom for the rest), as the nearest stop: the crop is
 * centered on the focus point as far as the photo allows. 0 is the top or left edge.
 */
export function shareStop(position: string | undefined, width: number, height: number) {
  const focus = focusPoint(position);
  const wide = width / height > SHARE_WIDTH / SHARE_HEIGHT;
  // How long the cropped side is once the photo covers the preview, and how much of it the preview shows.
  const length = wide ? (width * SHARE_HEIGHT) / height : (height * SHARE_WIDTH) / width;
  const shown = wide ? SHARE_WIDTH : SHARE_HEIGHT;
  if (!(length - shown >= 1)) return 50;
  const at = ((wide ? focus.x : focus.y) / 100) * length;
  const offset = Math.min(1, Math.max(0, (at - shown / 2) / (length - shown))) * 100;
  return SHARE_STOPS.reduce((best, s) => (Math.abs(s - offset) < Math.abs(best - offset) ? s : best));
}

export const builtinShareUrl = (key: string, stop: number) => `/media/share/builtin/${key}/${stop}.jpg`;
export const uploadShareUrl = (id: string, stop: number) => `/media/share/${id}/${stop}.jpg`;

/** Built-in photos that get share images (made at build time). */
export const shareablePhotos = builtinPhotos.filter((p) => SHARE_FOLDERS.includes(p.folder));

export interface ShareImage {
  /** Site-relative path; make it absolute before use. */
  src: string;
  width: number;
  height: number;
  alt: string;
}

/** A photo reference → its link-preview image. Undefined when there's no usable photo. */
export function shareImage(ref: ImageRef | undefined, uploads: Map<string, UploadInfo>): ShareImage | undefined {
  const src = ref?.src;
  if (!src) return undefined;
  let url: string | undefined;
  let alt: string | undefined = ref.alt?.trim();
  if (src.startsWith('builtin:')) {
    const key = src.slice('builtin:'.length);
    const photo = builtinByKey.get(key);
    if (photo && SHARE_FOLDERS.includes(photo.folder)) url = builtinShareUrl(key, shareStop(ref.position, photo.width, photo.height));
  } else if (src.startsWith('media:')) {
    const id = src.slice('media:'.length);
    const info = uploads.get(id);
    if (info?.widths.length) url = uploadShareUrl(id, shareStop(ref.position, info.width, info.height));
    alt ||= info?.alt?.trim() || undefined;
  }
  if (!url) return undefined;
  return { src: url, width: SHARE_WIDTH, height: SHARE_HEIGHT, alt: alt || '' };
}
