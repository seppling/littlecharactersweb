import type { APIRoute } from 'astro';
import { toCsv } from '@/lib/csv';
import { todayInAthens } from '@/lib/pricing';
import { csvResponse } from '@/server/downloads';
import { audit } from '@/server/records';
import { classSkillGrid, skillGridTable } from '@/server/skills';
import { requireFreshStaff } from '@/server/staff';

export const prerender = false;

/** The "Class Skills Worksheet" as a spreadsheet: a row per child, a column per skill. Staff who signed in within 15 minutes; logged. */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const found = locals.content.findSession(params.sessionId ?? '');
  if (!found) return new Response('Not found', { status: 404 });
  const { headers, rows } = skillGridTable(await classSkillGrid(found.program, found.session));
  await audit(locals.user!.id, 'admin.download.csv', 'list', `skills:${found.session.id}`);
  return csvResponse(`${found.program.title} skills ${todayInAthens()}.csv`, toCsv(headers, rows));
};
