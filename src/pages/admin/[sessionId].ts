import type { APIRoute } from 'astro';
import { classPage } from '@/lib/admin-links';
import { movedTo } from '@/server/moved';

export const prerender = false;

/** Old address of a class roster (/admin/<session>), now /admin/classes/<session>. */
export const ALL: APIRoute = ({ locals, params, request, url }) => {
  const found = locals.content.findSession(params.sessionId ?? '');
  return movedTo(locals, request, found ? classPage(found.session.id) + url.search : null);
};
