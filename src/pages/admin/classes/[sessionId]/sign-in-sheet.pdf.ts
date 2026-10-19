import type { APIRoute } from 'astro';
import { todayInAthens } from '@/lib/pricing';
import { signInPdf } from '@/server/classes';
import { pdfResponse } from '@/server/downloads';
import { requireFreshStaff } from '@/server/staff';

export const prerender = false;

/** A class's sign-in sheet: children's names and the next 8 class dates, landscape, no care details. Staff who signed in within 15 minutes; logged. */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const found = locals.content.findSession(params.sessionId ?? '');
  if (!found) return new Response('Not found', { status: 404 });
  const table = await signInPdf(found, locals.content.locationById(found.session.locationId)?.name, locals.user!.id);
  return pdfResponse(`${found.program.title} sign-in sheet ${todayInAthens()}.pdf`, table);
};
