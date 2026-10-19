/**
 * A report's CSV and PDF (/admin/reports/<key>.csv and .pdf): the same rows,
 * filters and order as its page. A fresh sign-in first; each download is
 * written to the audit log (`admin.download.csv|pdf`, list `report:<key>`).
 */
import type { APIContext } from 'astro';
import { toCsv } from '@/lib/csv';
import { csvResponse, pdfResponse } from '../downloads';
import { audit } from '../records';
import { requireFreshStaff } from '../staff';
import { todayInAthens } from '@/lib/pricing';
import { cellText, csvCell, readFilters, sortRows, type ReportContext } from './common';
import { findReport, Loads, runReport } from './library';
import { filtersLine } from './page';

export async function reportDownload(format: 'csv' | 'pdf', { locals, url, params }: Pick<APIContext, 'locals' | 'url' | 'params'>) {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const def = findReport(params.key ?? '');
  if (!def) return new Response(null, { status: 404 });
  const ctx: ReportContext = { content: locals.content, today: todayInAthens(), now: new Date() };
  const f = readFilters(url.searchParams);
  const loads = new Loads(ctx);
  const result = await runReport(def, f, loads, locals.user!.id);
  const rows = sortRows(result.rows, f.sort, f.dir);
  await audit(locals.user!.id, `admin.download.${format}`, 'list', `report:${def.key}`, filtersLine(def, f, loads) || undefined);
  const name = `Little Characters ${def.key} ${ctx.today}.${format}`;
  const headers = result.columns.map((c) => c.label);
  if (format === 'csv') return csvResponse(name, toCsv(headers, rows.map((r) => r.cells.map((c, i) => csvCell(c, result.columns[i].kind)))));
  return pdfResponse(name, {
    title: def.title,
    subtitle: [filtersLine(def, f, loads), `${result.total.label}: ${result.total.display}`].filter(Boolean).join(' · '),
    columns: result.columns.map((c, i) => ({ header: c.label, weight: i === 0 ? 1.6 : 1, align: c.kind && c.kind !== 'text' && c.kind !== 'date' ? 'right' : undefined })),
    rows: rows.map((r) => r.cells.map((c, i) => cellText(c, result.columns[i].kind))),
  });
}
