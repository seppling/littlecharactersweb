import type { APIRoute } from 'astro';
import { todayInAthens } from '@/lib/pricing';
import { attendancePdf } from '@/server/attendance';
import { pdfResponse } from '@/server/downloads';
import { audit } from '@/server/records';
import { requireFreshStaff } from '@/server/staff';

export const prerender = false;

/** A class's attendance as a PDF ("Attendance"): a row per child, a column per class date. Staff who signed in within 15 minutes; logged. */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const found = locals.content.findSession(params.sessionId ?? '');
  if (!found) return new Response('Not found', { status: 404 });
  const table = await attendancePdf(found, locals.content.locationById(found.session.locationId)?.name);
  await audit(locals.user!.id, 'admin.attendance.pdf', 'session', found.session.id);
  return pdfResponse(`${found.program.title} attendance ${todayInAthens()}.pdf`, table);
};
