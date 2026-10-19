import type { APIRoute } from 'astro';
import { todayInAthens } from '@/lib/pricing';
import { rosterPdf } from '@/server/classes';
import { pdfResponse } from '@/server/downloads';
import { requireFreshStaff } from '@/server/staff';

export const prerender = false;

/** A class's roster as a PDF, with care details: the same children as its page. Also the print page's "Download PDF". Staff who signed in within 15 minutes; logged. */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const found = locals.content.findSession(params.sessionId ?? '');
  if (!found) return new Response('Not found', { status: 404 });
  const table = await rosterPdf(found, locals.content.locationById(found.session.locationId)?.name, locals.user!.id);
  return pdfResponse(`${found.program.title} roster ${todayInAthens()}.pdf`, table);
};
