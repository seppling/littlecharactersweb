import type { APIRoute } from 'astro';
import { castSheet, findShow, showDatesLabel } from '@/server/shows';
import { pdfResponse } from '@/server/downloads';
import { audit } from '@/server/records';
import { requireFreshStaff } from '@/server/staff';

export const prerender = false;

/** The staff cast sheet as a PDF: the program's columns plus photos, class and parents' phones (no care details). Fresh sign-in; logged. */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const event = findShow(locals.content, params.slug ?? '');
  if (!event) return new Response('Not found', { status: 404 });
  const { headers, rows } = await castSheet(event.slug, event, locals.content);
  await audit(locals.user!.id, 'admin.download.pdf', 'list', `cast-sheet:${event.slug}`);
  return pdfResponse(`${event.title} cast sheet.pdf`, {
    title: `${event.title}: Cast Sheet`,
    subtitle: `${showDatesLabel(event)} · for staff`,
    columns: headers.map((header, i) => ({ header, weight: [1.6, 1.6, 1.1, 0.8, 1.6, 2.6][i] })),
    rows,
    orientation: 'landscape',
  });
};
