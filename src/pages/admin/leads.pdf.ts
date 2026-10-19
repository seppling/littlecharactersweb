import type { APIRoute } from 'astro';
import { pdfResponse } from '@/server/downloads';
import { leadsTable, staffLeads } from '@/server/leads';
import { requireFreshStaff } from '@/server/staff';
import { todayInAthens } from '@/lib/pricing';

export const prerender = false;

/** Messages and sign-ups as a PDF, the same rows as /admin/leads. Staff who signed in within 15 minutes. */
export const GET: APIRoute = async ({ locals, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const { programBySlug, events } = locals.content;
  const { headers, rows } = leadsTable(await staffLeads((slug) => programBySlug(slug)?.title ?? events.find((e) => e.slug === slug)?.title));
  const weights = [1.1, 0.9, 1.1, 1.6, 1.6, 3];
  return pdfResponse(`Little Characters messages and sign-ups ${todayInAthens()}.pdf`, {
    title: 'Messages & sign-ups',
    subtitle: `All forms, newest first · ${rows.length} ${rows.length === 1 ? 'entry' : 'entries'}`,
    columns: headers.map((header, i) => ({ header, weight: weights[i] })),
    rows,
    orientation: 'landscape',
  });
};
