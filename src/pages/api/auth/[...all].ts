import type { APIRoute } from 'astro';
import { getAuth } from '@/server/auth';

export const prerender = false;

/** Better Auth's endpoints: send code, verify code, get session, sign out. */
export const ALL: APIRoute = async ({ request }) => (await getAuth()).handler(request);
