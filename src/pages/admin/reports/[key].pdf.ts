import type { APIRoute } from 'astro';
import { reportDownload } from '@/server/reports/downloads';

export const prerender = false;

/** A report as a PDF: the same rows, filters and order as its page (src/server/reports/downloads.ts). Fresh sign-in; logged. */
export const GET: APIRoute = (context) => reportDownload('pdf', context);
