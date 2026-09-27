import type { APIRoute, GetStaticPaths } from 'astro';
import path from 'node:path';
import sharp from 'sharp';
import { builtinPhotos } from '@/lib/media';

/**
 * The photos that ship with the site, resized once at build time into static
 * files (see src/lib/media.ts), so pages never resize images on request.
 */
export const prerender = true;

// One photo at a time, nothing cached between them: keeps the build's memory low.
sharp.concurrency(1);
sharp.cache(false);

export const getStaticPaths: GetStaticPaths = () =>
  builtinPhotos.flatMap((photo) =>
    photo.widths.map((width) => ({
      params: { folder: photo.folder, name: photo.key.slice(photo.folder.length + 1), width: String(width) },
      props: { file: photo.file, width },
    })),
  );

export const GET: APIRoute = async ({ props }) => {
  const { file, width } = props as { file: string; width: number };
  const data = await sharp(path.resolve(file)).resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  return new Response(new Uint8Array(data), { headers: { 'Content-Type': 'image/webp' } });
};
