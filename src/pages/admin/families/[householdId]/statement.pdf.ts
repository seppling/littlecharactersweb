import type { APIRoute } from 'astro';
import { staffStatementDownload } from '@/server/statements';

export const prerender = false;

/** A family's yearly statement as a PDF (?year=2026): a fresh sign-in, then an audit entry. */
export const GET: APIRoute = (ctx) => staffStatementDownload('pdf', ctx);
