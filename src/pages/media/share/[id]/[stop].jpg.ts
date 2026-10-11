import type { APIRoute } from 'astro';
import { SHARE_STOPS } from '@/lib/media';
import { getLargestMediaFile } from '@/server/media';
import { makeShareImage } from '@/server/share-image';

/**
 * Link-preview images of photos uploaded in the editor, made on request from
 * the largest stored copy. An id's photo never changes, so they're cached for good.
 */
export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const stop = Number(params.stop);
  if (!/^[a-z0-9]{6,20}$/.test(params.id ?? '') || !SHARE_STOPS.includes(stop)) return new Response('Not found', { status: 404 });
  const file = await getLargestMediaFile(params.id!);
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(await makeShareImage(new Uint8Array(file.data), stop), {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
