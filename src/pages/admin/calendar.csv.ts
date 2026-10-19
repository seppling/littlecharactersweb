import type { APIRoute } from 'astro';
import { toCsv } from '@/lib/csv';
import { scheduleDownload } from '@/server/calendar';
import { csvResponse } from '@/server/downloads';
import { audit } from '@/server/records';
import { requireFreshStaff } from '@/server/staff';

export const prerender = false;

/**
 * The calendar's month as a spreadsheet, as filtered: the Daily Class Schedule
 * (one row per class and date), or with ?report=classes the Class Schedule
 * (one row per class). Staff who signed in within 15 minutes.
 */
export const GET: APIRoute = async ({ locals, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const d = await scheduleDownload(locals.content, url.searchParams);
  await audit(locals.user!.id, 'admin.download.csv', 'list', `calendar-${d.report}`, d.month);
  return csvResponse(`Little Characters ${d.title.toLowerCase()} ${d.month}.csv`, toCsv(d.table.headers, d.table.rows));
};
