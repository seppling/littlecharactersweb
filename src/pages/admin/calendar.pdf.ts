import type { APIRoute } from 'astro';
import { scheduleDownload } from '@/server/calendar';
import { pdfResponse } from '@/server/downloads';
import { audit } from '@/server/records';
import { requireFreshStaff } from '@/server/staff';

export const prerender = false;

/** The calendar's month as a PDF, as filtered: the Daily Class Schedule, or with ?report=classes the Class Schedule. Staff who signed in within 15 minutes. */
export const GET: APIRoute = async ({ locals, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const d = await scheduleDownload(locals.content, url.searchParams);
  const weights = d.report === 'classes' ? [1.8, 1.1, 1, 1.1, 0.6, 0.6, 2, 1.6] : [1.1, 1, 2, 1, 1.1, 0.6, 1.2];
  const right = new Set(d.report === 'classes' ? [4, 5] : [5]);
  await audit(locals.user!.id, 'admin.download.pdf', 'list', `calendar-${d.report}`, d.month);
  return pdfResponse(`Little Characters ${d.title.toLowerCase()} ${d.month}.pdf`, {
    title: d.title,
    subtitle: d.subtitle,
    columns: d.table.headers.map((header, i) => ({ header, weight: weights[i], align: right.has(i) ? 'right' : 'left' })),
    rows: d.table.rows,
    orientation: 'landscape',
  });
};
