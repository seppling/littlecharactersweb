import type { APIRoute } from 'astro';
import { familyDownload } from '@/server/family-downloads';

export const prerender = false;

/** The Family List (every family, as on the Families list) as a PDF. Staff who signed in within 15 minutes. */
export const GET: APIRoute = (ctx) => familyDownload('families', 'pdf', ctx);
