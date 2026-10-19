import type { APIRoute } from 'astro';
import { toCsv } from '@/lib/csv';
import { todayInAthens } from '@/lib/pricing';
import { csvResponse } from '@/server/downloads';
import { audit } from '@/server/records';
import { requireFreshStaff } from '@/server/staff';
import { getTag, tagMembers, tagTable } from '@/server/tags';

export const prerender = false;

/** A tag's list as a spreadsheet: its children (with family and classes) or its families (with parents and contacts). Fresh sign-in; logged. */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const t = await getTag(params.tagId ?? '');
  if (!t) return new Response('Not found', { status: 404 });
  const { headers, rows } = tagTable(await tagMembers(t, locals.content));
  await audit(locals.user!.id, 'admin.download.csv', 'list', `tag:${t.id}`);
  return csvResponse(`Tag ${t.name} ${todayInAthens()}.csv`, toCsv(headers, rows));
};
