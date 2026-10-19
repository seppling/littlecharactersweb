import type { APIRoute } from 'astro';
import { toCsv } from '@/lib/csv';
import { todayInAthens } from '@/lib/pricing';
import { classDropIns, dropInTable } from '@/server/drop-ins';
import { csvResponse } from '@/server/downloads';
import { audit } from '@/server/records';
import { requireFreshStaff } from '@/server/staff';

export const prerender = false;

/** A class's drop-ins as a spreadsheet: the same rows as its page's Drop-ins list, no care details. Staff who signed in within 15 minutes; logged. */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const found = locals.content.findSession(params.sessionId ?? '');
  if (!found) return new Response('Not found', { status: 404 });
  const { headers, rows } = dropInTable(await classDropIns(found.program, found.session));
  await audit(locals.user!.id, 'admin.download.csv', 'list', `drop-ins:${found.session.id}`);
  return csvResponse(`${found.program.title} drop-ins ${todayInAthens()}.csv`, toCsv(headers, rows));
};
