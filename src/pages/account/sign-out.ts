import type { APIRoute } from 'astro';
import { safeStaffPath } from '@/lib/admin-links';
import { getAuth } from '@/server/auth';

export const prerender = false;

/**
 * Families land on the home page. Staff pages send `next` (/admin), so the
 * installed staff app stays on the staff sign-in instead of opening the
 * family site; anything but a staff path is ignored.
 */
export const POST: APIRoute = async ({ request, redirect, cookies }) => {
  const form = await request.formData().catch(() => null);
  const next = form?.get('next');
  const to = (typeof next === 'string' && safeStaffPath(next)) || '/';
  const auth = await getAuth();
  const res = await auth.api.signOut({ headers: request.headers, asResponse: true });
  cookies.delete('lc_signed_in', { path: '/' });
  const out = redirect(to, 303);
  const headers = new Headers(out.headers);
  for (const c of res.headers.getSetCookie()) headers.append('Set-Cookie', c);
  return new Response(null, { status: 303, headers });
};
