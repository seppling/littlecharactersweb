import type { APIRoute } from 'astro';
import { familyStatementDownload } from '@/server/statements';

export const prerender = false;

/** The family's own yearly statement as a CSV (?year=2026), from their account. */
export const GET: APIRoute = (ctx) => familyStatementDownload('csv', ctx);
