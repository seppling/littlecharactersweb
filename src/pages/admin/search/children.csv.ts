import type { APIRoute } from 'astro';
import { familyDownload } from '@/server/family-downloads';

export const prerender = false;

/** The Student / Class List as a CSV. Staff who signed in within 15 minutes. */
export const GET: APIRoute = (ctx) => familyDownload('children', 'csv', ctx);
