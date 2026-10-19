import type { APIRoute } from 'astro';
import { toCsv } from '@/lib/csv';
import { todayInAthens } from '@/lib/pricing';
import { attendanceTable, classAttendance } from '@/server/attendance';
import { csvResponse } from '@/server/downloads';
import { audit } from '@/server/records';
import { requireFreshStaff } from '@/server/staff';

export const prerender = false;

/** A class's attendance as a spreadsheet: a row per child, a column per class date (P, A, L, LE). Staff who signed in within 15 minutes; logged. */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const found = locals.content.findSession(params.sessionId ?? '');
  if (!found) return new Response('Not found', { status: 404 });
  const { headers, rows } = attendanceTable(await classAttendance(found.session));
  await audit(locals.user!.id, 'admin.attendance.csv', 'session', found.session.id);
  return csvResponse(`${found.program.title} attendance ${todayInAthens()}.csv`, toCsv(headers, rows));
};
