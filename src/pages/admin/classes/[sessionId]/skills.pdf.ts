import type { APIRoute } from 'astro';
import { todayInAthens } from '@/lib/pricing';
import { pdfResponse } from '@/server/downloads';
import { audit } from '@/server/records';
import { skillGridPdf } from '@/server/skills';
import { requireFreshStaff } from '@/server/staff';

export const prerender = false;

/** The "Class Skills Worksheet" as a PDF. Staff who signed in within 15 minutes; logged. */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const found = locals.content.findSession(params.sessionId ?? '');
  if (!found) return new Response('Not found', { status: 404 });
  const table = await skillGridPdf(found, locals.content.locationById(found.session.locationId)?.name);
  await audit(locals.user!.id, 'admin.download.pdf', 'list', `skills:${found.session.id}`);
  return pdfResponse(`${found.program.title} skills ${todayInAthens()}.pdf`, table);
};
