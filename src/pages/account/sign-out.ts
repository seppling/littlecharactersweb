import type { APIRoute } from 'astro';
import { getAuth } from '@/server/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect, cookies }) => {
  const auth = await getAuth();
  const res = await auth.api.signOut({ headers: request.headers, asResponse: true });
  cookies.delete('lc_signed_in', { path: '/' });
  const out = redirect('/', 303);
  const headers = new Headers(out.headers);
  for (const c of res.headers.getSetCookie()) headers.append('Set-Cookie', c);
  return new Response(null, { status: 303, headers });
};
