import type { APIRoute } from 'astro';
import { toCsv } from '@/lib/csv';
import { todayInAthens } from '@/lib/pricing';
import { classFilters, classList, classListTable } from '@/server/classes';
import { csvResponse } from '@/server/downloads';
import { audit } from '@/server/records';
import { requireFreshStaff } from '@/server/staff';

export const prerender = false;

/** The Classes list as a spreadsheet, as filtered: the same rows as /admin/classes. Staff who signed in within 15 minutes. */
export const GET: APIRoute = async ({ locals, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const { rows } = await classList(locals.content, classFilters(url.searchParams));
  const table = classListTable(rows);
  await audit(locals.user!.id, 'admin.classes.csv');
  return csvResponse(`Little Characters class list ${todayInAthens()}.csv`, toCsv(table.headers, table.rows));
};
