import type { APIRoute } from 'astro';
import { classPage } from '@/lib/admin-links';

export const prerender = false;

/** classSkills(id) is the address its downloads hang off; the grid itself is on the class's page. */
export const GET: APIRoute = ({ params, redirect }) => redirect(`${classPage(params.sessionId ?? '')}#skills-h`, 302);
