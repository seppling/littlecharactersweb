import type { APIRoute } from 'astro';
import { toCsv } from '@/lib/csv';
import { todayInAthens } from '@/lib/pricing';
import { classRoster, rosterTable } from '@/server/classes';
import { csvResponse } from '@/server/downloads';
import { requireFreshStaff } from '@/server/staff';

export const prerender = false;

/** A class's roster as a spreadsheet, with care details: the same children as its page. Staff who signed in within 15 minutes; logged. */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const found = locals.content.findSession(params.sessionId ?? '');
  if (!found) return new Response('Not found', { status: 404 });
  const { students } = await classRoster(found.session.id, locals.user!.id, 'csv');
  const { headers, rows } = rosterTable(students);
  return csvResponse(`${found.program.title} roster ${todayInAthens()}.csv`, toCsv(headers, rows));
};
