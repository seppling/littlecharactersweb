import type { APIRoute } from 'astro';
import { toCsv } from '@/lib/csv';
import { castList, findShow, programTable } from '@/server/shows';
import { csvResponse } from '@/server/downloads';
import { audit } from '@/server/records';
import { requireFreshStaff } from '@/server/staff';

export const prerender = false;

/** The cast list for the program, as a spreadsheet: name, role and group, in the cast's order. Staff who signed in within 15 minutes; logged. */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const event = findShow(locals.content, params.slug ?? '');
  if (!event) return new Response('Not found', { status: 404 });
  const { headers, rows } = programTable(await castList(event.slug));
  await audit(locals.user!.id, 'admin.download.csv', 'list', `cast-program:${event.slug}`);
  return csvResponse(`${event.title} cast list.csv`, toCsv(headers, rows));
};
