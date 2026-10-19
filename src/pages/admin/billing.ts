import type { APIRoute } from 'astro';
import { payments } from '@/lib/admin-links';
import { movedTo } from '@/server/moved';

export const prerender = false;

/** Old address of monthly autopay (/admin/billing), now /admin/payments. */
export const ALL: APIRoute = ({ locals, request, url }) => movedTo(locals, request, payments() + url.search);
