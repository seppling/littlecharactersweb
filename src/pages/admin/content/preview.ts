import type { APIRoute } from 'astro';
import { PREVIEW_COOKIE } from '@/lib/editor';

export const prerender = false;

/** Staff: turn on (or off) seeing unpublished edits on the site, then go to a page. */
export const GET: APIRoute = ({ url, cookies, locals, redirect }) => {
  const to = url.searchParams.get('to') ?? '/';
  const dest = to.startsWith('/') && !to.startsWith('//') ? to : '/';
  if (url.searchParams.has('off')) {
    cookies.delete(PREVIEW_COOKIE, { path: '/' });
  } else if (locals.isAdmin) {
    cookies.set(PREVIEW_COOKIE, '1', { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: 8 * 3600 });
  }
  return redirect(dest, 303);
};
