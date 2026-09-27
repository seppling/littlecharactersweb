import type { APIRoute } from 'astro';
import { listUploads, MAX_UPLOAD_BYTES, saveUpload, UploadError } from '@/server/media';
import { builtinPhotos, thumbnail } from '@/lib/media';

export const prerender = false;

/** The photo library, for the editor's photo picker. */
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.isAdmin) return new Response('Not found', { status: 404 });
  const uploads = locals.content.uploads;
  const uploaded = (await listUploads()).map((m) => ({ src: `media:${m.id}`, thumb: thumbnail(`media:${m.id}`, uploads), alt: m.alt ?? '', name: m.filename, width: m.width, height: m.height }));
  const builtin = builtinPhotos
    .filter((p) => p.folder !== 'brand')
    .map((p) => ({ src: `builtin:${p.key}`, thumb: thumbnail(`builtin:${p.key}`, uploads), alt: '', name: p.key.split('/')[1].replace(/-/g, ' '), width: p.width, height: p.height }));
  return Response.json({ photos: [...uploaded, ...builtin] }, { headers: { 'Cache-Control': 'private, no-store' } });
};

/** Upload a photo. */
export const POST: APIRoute = async ({ locals, request }) => {
  if (!locals.isAdmin || !locals.user) return new Response('Not found', { status: 404 });
  if (Number(request.headers.get('content-length') ?? 0) > MAX_UPLOAD_BYTES + 1024 * 1024) {
    return Response.json({ message: 'That file is over 25 MB. Try a smaller photo.' }, { status: 413 });
  }
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !file.size) return Response.json({ message: 'Choose a photo to upload.' }, { status: 400 });
  try {
    const saved = await saveUpload({
      bytes: new Uint8Array(await file.arrayBuffer()),
      filename: file.name,
      alt: String(form.get('alt') ?? ''),
      userId: locals.user.id,
    });
    return Response.json({ ...saved, thumb: `/media/${saved.id}/${saved.widths[0]}` });
  } catch (e) {
    if (e instanceof UploadError) return Response.json({ message: e.message }, { status: 400 });
    throw e;
  }
};
