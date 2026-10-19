import type { APIRoute } from 'astro';
import { paymentsDownload } from '@/server/payments-admin';

export const prerender = false;

/** A Payments list as a PDF: the Payments List for ?month=, the Overdue List (?show=failed) or Upcoming Autopay (?show=upcoming). Staff who signed in within 15 minutes. */
export const GET: APIRoute = (ctx) => paymentsDownload('pdf', ctx);
