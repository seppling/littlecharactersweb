import type { APIRoute } from 'astro';
import { familyDownload } from '@/server/family-downloads';

export const prerender = false;

/** The Student Contact List as a PDF. Staff who signed in within 15 minutes. */
export const GET: APIRoute = (ctx) => familyDownload('contacts', 'pdf', ctx);
