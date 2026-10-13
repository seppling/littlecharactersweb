/**
 * Makes link-preview images: a 1200×630 JPEG cropped around a stop along the
 * photo's cropped side (see src/lib/media.ts). Used at build time for the
 * built-in photos and on request for uploads.
 */
import sharp from 'sharp';
import { SHARE_HEIGHT, SHARE_WIDTH } from '@/lib/media';

// One photo at a time, nothing cached between them: keeps memory low on small servers.
sharp.concurrency(1);
sharp.cache(false);

export async function makeShareImage(input: string | Uint8Array, stop: number): Promise<Uint8Array<ArrayBuffer>> {
  const image = sharp(input, { failOn: 'error' });
  const { width, height } = await image.metadata();
  if (!width || !height) throw new Error('Not an image');
  // Scale so the photo covers the whole preview, then cut the preview out of it.
  const scale = Math.max(SHARE_WIDTH / width, SHARE_HEIGHT / height);
  const w = Math.max(SHARE_WIDTH, Math.round(width * scale));
  const h = Math.max(SHARE_HEIGHT, Math.round(height * scale));
  const data = await image
    .resize(w, h, { fit: 'fill' })
    .extract({ left: Math.round(((w - SHARE_WIDTH) * stop) / 100), top: Math.round(((h - SHARE_HEIGHT) * stop) / 100), width: SHARE_WIDTH, height: SHARE_HEIGHT })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 80, progressive: true })
    .toBuffer();
  return new Uint8Array(data);
}
