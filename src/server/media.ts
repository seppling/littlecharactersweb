/**
 * Photo uploads from the editor. Each upload is turned, once, into a few
 * resized WebP copies (src/lib/media.ts PHOTO_WIDTHS) that are stored in the
 * database and served from /media/<id>/<width> with long-lived caching.
 *
 * Resizing strips the camera's metadata, including any GPS location, which
 * matters for photos of children.
 */
import { desc, eq, sql } from 'drizzle-orm';
import sharp, { type Sharp } from 'sharp';
import { getDb, schema } from './db';
import { touchContent } from './content';
import { shortId } from '@/content/ids';
import { PHOTO_WIDTHS } from '@/lib/media';

const { media, mediaFile, contentEntry } = schema;

/** Phones take big photos; anything larger is almost certainly not a photo. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

// Keep memory low on small servers: one image at a time, no cache between uploads.
sharp.concurrency(1);
sharp.cache(false);

export class UploadError extends Error {}

export async function saveUpload(input: { bytes: Uint8Array; filename: string; alt?: string; userId: string }) {
  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) throw new UploadError('That file is over 25 MB. Try a smaller photo.');
  let image: Sharp;
  let width: number;
  let height: number;
  try {
    // rotate() applies the phone's "which way is up" flag before it's stripped.
    image = sharp(input.bytes, { failOn: 'error', limitInputPixels: 80_000_000 }).rotate();
    const meta = await image.metadata();
    if (!meta.width || !meta.height) throw new Error('no size');
    // Sideways phone photos swap width and height once rotated.
    const turned = (meta.orientation ?? 1) >= 5;
    width = turned ? meta.height : meta.width;
    height = turned ? meta.width : meta.height;
  } catch {
    throw new UploadError('That file doesn’t look like a photo we can use. Try a JPEG or PNG.');
  }

  const widths = PHOTO_WIDTHS.filter((w) => w <= width);
  if (!widths.length) widths.push(width);
  const copies: { width: number; data: Uint8Array }[] = [];
  for (const w of widths) {
    const data = await image.clone().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    copies.push({ width: w, data: new Uint8Array(data) });
  }

  const id = shortId(10);
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.insert(media).values({
      id,
      filename: input.filename.slice(0, 200) || 'photo',
      alt: input.alt?.trim().slice(0, 300) || null,
      width,
      height,
      bytes: input.bytes.byteLength,
      uploadedBy: input.userId,
    });
    await tx.insert(mediaFile).values(copies.map((c) => ({ mediaId: id, width: c.width, contentType: 'image/webp', data: c.data })));
  });
  await touchContent();
  return { id, src: `media:${id}`, width, height, widths };
}

export async function getMediaFile(id: string, width: number) {
  const db = await getDb();
  const rows = await db
    .select({ data: mediaFile.data, contentType: mediaFile.contentType })
    .from(mediaFile)
    .where(sql`${mediaFile.mediaId} = ${id} and ${mediaFile.width} = ${width}`);
  return rows[0];
}

export async function listUploads() {
  const db = await getDb();
  return db
    .select({ id: media.id, filename: media.filename, alt: media.alt, width: media.width, height: media.height, createdAt: media.createdAt })
    .from(media)
    .orderBy(desc(media.createdAt));
}

/** Content (published or draft) that uses this photo. */
export async function photoUsage(src: string) {
  const db = await getDb();
  const rows = await db
    .select({ collection: contentEntry.collection, id: contentEntry.id })
    .from(contentEntry)
    .where(sql`coalesce(${contentEntry.published}::text, '') like ${'%"' + src + '"%'} or coalesce(${contentEntry.draft}::text, '') like ${'%"' + src + '"%'}`);
  return rows;
}

export async function updateUploadAlt(id: string, alt: string) {
  const db = await getDb();
  await db
    .update(media)
    .set({ alt: alt.trim().slice(0, 300) || null })
    .where(eq(media.id, id));
  await touchContent();
}

/** Delete an uploaded photo that nothing uses. */
export async function deleteUpload(id: string) {
  const used = await photoUsage(`media:${id}`);
  if (used.length) return { ok: false as const, usedBy: used };
  const db = await getDb();
  await db.delete(media).where(eq(media.id, id));
  await touchContent();
  return { ok: true as const };
}
