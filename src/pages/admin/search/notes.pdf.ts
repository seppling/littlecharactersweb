import type { APIRoute } from 'astro';
import { familyDownload } from '@/server/family-downloads';

export const prerender = false;

/** Family Notes (every family's staff notes) as a PDF. Staff who signed in within 15 minutes. */
export const GET: APIRoute = (ctx) => familyDownload('notes', 'pdf', ctx);
