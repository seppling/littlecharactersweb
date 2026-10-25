import type { APIRoute } from 'astro';
import { toCsv } from '@/lib/csv';
import { castSheet, findShow } from '@/server/shows';
import { csvResponse } from '@/server/downloads';
import { audit } from '@/server/records';
import { requireFreshStaff } from '@/server/staff';

export const prerender = false;

/** The staff cast sheet as a spreadsheet: the program's columns plus photos, class and parents' phones (no care details). Fresh sign-in; logged. */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const event = findShow(locals.content, params.slug ?? '');
  if (!event) return new Response('Not found', { status: 404 });
  const { headers, rows } = await castSheet(event.slug, event, locals.content);
  await audit(locals.user!.id, 'admin.download.csv', 'list', `cast-sheet:${event.slug}`);
  return csvResponse(`${event.title} cast sheet.csv`, toCsv(headers, rows));
};
