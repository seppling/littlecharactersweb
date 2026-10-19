import type { APIRoute } from 'astro';
import { castList, findShow, programTable, showDatesLabel } from '@/server/shows';
import { pdfResponse } from '@/server/downloads';
import { audit } from '@/server/records';
import { requireFreshStaff } from '@/server/staff';

export const prerender = false;

/** The cast list for the program, as a PDF: name, role and group, in the cast's order. Staff who signed in within 15 minutes; logged. */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const event = findShow(locals.content, params.slug ?? '');
  if (!event) return new Response('Not found', { status: 404 });
  const { headers, rows } = programTable(await castList(event.slug));
  await audit(locals.user!.id, 'admin.download.pdf', 'list', `cast-program:${event.slug}`);
  return pdfResponse(`${event.title} cast list.pdf`, {
    title: `${event.title}: Cast`,
    subtitle: showDatesLabel(event),
    columns: headers.map((header, i) => ({ header, weight: [2, 2, 1.4][i] })),
    rows,
    orientation: 'portrait',
  });
};
