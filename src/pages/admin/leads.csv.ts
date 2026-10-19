import type { APIRoute } from 'astro';
import { toCsv } from '@/lib/csv';
import { csvResponse } from '@/server/downloads';
import { leadsTable, staffLeads } from '@/server/leads';
import { requireFreshStaff } from '@/server/staff';
import { todayInAthens } from '@/lib/pricing';

export const prerender = false;

/** Messages and sign-ups as a spreadsheet, the same rows as /admin/leads. Staff who signed in within 15 minutes. */
export const GET: APIRoute = async ({ locals, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const { programBySlug, events } = locals.content;
  const { headers, rows } = leadsTable(await staffLeads((slug) => programBySlug(slug)?.title ?? events.find((e) => e.slug === slug)?.title));
  return csvResponse(`Little Characters messages and sign-ups ${todayInAthens()}.csv`, toCsv(headers, rows));
};
