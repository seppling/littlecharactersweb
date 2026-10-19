#!/usr/bin/env tsx
/**
 * The staff app's home-screen icons (docs/back-office.md → The phone app):
 * the logo mark on the dark "house" ink. Run once; the PNGs are committed in
 * public/admin/icons/.
 *
 *   npx tsx scripts/make-staff-icons.ts
 */
import sharp from 'sharp';

const INK = '#1c1826';
const MARK = 'src/assets/brand/logo-mark.png';
const OUT = 'public/admin/icons';

/** `scale`: the mark's share of the square. Maskable icons keep it inside the middle 80% circle. */
async function icon(size: number, scale: number, file: string) {
  const mark = await sharp(MARK).resize(Math.round(size * scale)).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: INK } })
    .composite([{ input: mark, gravity: 'center' }])
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/${file}`);
}

await icon(192, 0.72, 'icon-192.png');
await icon(512, 0.72, 'icon-512.png');
await icon(512, 0.5, 'maskable-512.png');
await icon(180, 0.66, 'apple-touch-icon.png');
console.log(`Icons written to ${OUT}.`);
