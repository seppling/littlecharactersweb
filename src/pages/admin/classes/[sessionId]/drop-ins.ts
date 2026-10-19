import type { APIRoute } from 'astro';
import { classPage } from '@/lib/admin-links';

export const prerender = false;

/** The Drop-ins list lives on the class's page; its downloads are drop-ins.csv and drop-ins.pdf beside this address. */
export const GET: APIRoute = ({ params, redirect }) => redirect(`${classPage(params.sessionId ?? '')}#drop-ins-h`, 302);
