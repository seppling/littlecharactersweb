import type { APIRoute, GetStaticPaths } from 'astro';
import path from 'node:path';
import { SHARE_STOPS, shareablePhotos } from '@/lib/media';
import { makeShareImage } from '@/server/share-image';

/** Link-preview images of the photos that ship with the site, made once at build time (see src/lib/media.ts). */
export const prerender = true;

export const getStaticPaths: GetStaticPaths = () =>
  shareablePhotos.flatMap((photo) =>
    SHARE_STOPS.map((stop) => ({
      params: { folder: photo.folder, name: photo.key.slice(photo.folder.length + 1), stop: String(stop) },
      props: { file: photo.file, stop },
    })),
  );

export const GET: APIRoute = async ({ props }) => {
  const { file, stop } = props as { file: string; stop: number };
  return new Response(await makeShareImage(path.resolve(file), stop), { headers: { 'Content-Type': 'image/jpeg' } });
};
