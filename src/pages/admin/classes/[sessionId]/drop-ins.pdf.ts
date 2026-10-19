import type { APIRoute } from 'astro';
import { todayInAthens } from '@/lib/pricing';
import { classLine } from '@/server/classes';
import { classDropIns, dropInTable } from '@/server/drop-ins';
import { pdfResponse } from '@/server/downloads';
import { audit } from '@/server/records';
import { requireFreshStaff } from '@/server/staff';

export const prerender = false;

/** A class's drop-ins as a PDF: the same rows as its page's Drop-ins list, no care details. Staff who signed in within 15 minutes; logged. */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const found = locals.content.findSession(params.sessionId ?? '');
  if (!found) return new Response('Not found', { status: 404 });
  const { headers, rows } = dropInTable(await classDropIns(found.program, found.session));
  await audit(locals.user!.id, 'admin.download.pdf', 'list', `drop-ins:${found.session.id}`);
  return pdfResponse(`${found.program.title} drop-ins ${todayInAthens()}.pdf`, {
    title: `${found.program.title}: Drop-ins`,
    subtitle: classLine(found.session, locals.content.locationById(found.session.locationId)?.name),
    columns: headers.map((header, i) => ({ header, weight: [1.2, 2, 2, 3, 1, 1][i], align: i === 4 ? ('right' as const) : undefined })),
    rows,
    orientation: 'landscape',
  });
};
