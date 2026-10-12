import type { APIRoute } from 'astro';
import { getMediaFile } from '@/server/media';

/** Photos uploaded in the editor. An id's copies never change, so browsers and CDNs can keep them for good. */
export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const width = Number(params.width);
  if (!/^[a-z0-9]{6,20}$/.test(params.id ?? '') || !Number.isInteger(width)) return new Response('Not found', { status: 404 });
  const file = await getMediaFile(params.id!, width);
  if (!file) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: { 'Content-Type': file.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
