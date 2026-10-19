import type { APIRoute } from 'astro';
import { todayInAthens } from '@/lib/pricing';
import { classFilters, classList, classListTable, filtersLabel } from '@/server/classes';
import { pdfResponse } from '@/server/downloads';
import { audit } from '@/server/records';
import { requireFreshStaff } from '@/server/staff';

export const prerender = false;

/** The Classes list as a PDF, as filtered: the same rows as /admin/classes. Staff who signed in within 15 minutes. */
export const GET: APIRoute = async ({ locals, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const f = classFilters(url.searchParams);
  const { rows } = await classList(locals.content, f);
  const table = classListTable(rows);
  const weights = [0.9, 1.8, 1.4, 1.3, 0.9, 0.8, 0.7, 0.7];
  const right = new Set([5, 6, 7]);
  await audit(locals.user!.id, 'admin.classes.pdf');
  return pdfResponse(`Little Characters class list ${todayInAthens()}.pdf`, {
    title: 'Class List',
    subtitle: `${filtersLabel(f)} · ${rows.length} ${rows.length === 1 ? 'class' : 'classes'}`,
    columns: table.headers.map((header, i) => ({ header, weight: weights[i], align: right.has(i) ? 'right' : 'left' })),
    rows: table.rows,
    orientation: 'landscape',
  });
};
