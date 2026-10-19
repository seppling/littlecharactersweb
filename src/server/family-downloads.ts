/**
 * The family downloads (docs/back-office.md → Downloads): Family List,
 * Student / Class List, Student Contact List and Family Notes, each as a
 * spreadsheet and a PDF, built from the same rows as the pages. Every
 * download is written to the audit log.
 */
import type { APIContext } from 'astro';
import { toCsv } from '@/lib/csv';
import { todayInAthens } from '@/lib/pricing';
import { csvResponse, pdfResponse } from './downloads';
import { allNotes, childrenTable, contactsTable, familiesTable, familyDirectory, notesTable } from './families';
import { audit } from './records';
import { requireFreshStaff } from './staff';

export type FamilyList = 'families' | 'children' | 'contacts' | 'notes';

const LISTS: Record<FamilyList, { title: string; file: string; what: (n: number) => string; weights: number[] }> = {
  families: { title: 'Family List', file: 'family list', what: (n) => `${n} ${n === 1 ? 'family' : 'families'}, A to Z`, weights: [1.2, 1.4, 1.9, 1.2, 0.6, 1.2, 1.4] },
  children: { title: 'Student / Class List', file: 'student and class list', what: (n) => `${n} ${n === 1 ? 'child' : 'children'} · current classes`, weights: [1.4, 0.5, 1.3, 2.4] },
  contacts: { title: 'Student Contact List', file: 'student contact list', what: (n) => `${n} ${n === 1 ? 'child' : 'children'}`, weights: [1.2, 1.1, 1.3, 1.8, 1.2, 2] },
  notes: { title: 'Family Notes', file: 'family notes', what: (n) => `${n} ${n === 1 ? 'note' : 'notes'} · staff only`, weights: [1.1, 1.1, 3.6, 1.1, 1] },
};

async function table(list: FamilyList, content: App.Locals['content']) {
  if (list === 'notes') return notesTable(await allNotes());
  const families = await familyDirectory(content);
  return list === 'families' ? familiesTable(families) : list === 'children' ? childrenTable(families) : contactsTable(families);
}

/** The whole endpoint: a fresh sign-in, the rows, the audit entry, the file. */
export async function familyDownload(list: FamilyList, format: 'csv' | 'pdf', { locals, url }: Pick<APIContext, 'locals' | 'url'>) {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const { headers, rows } = await table(list, locals.content);
  const l = LISTS[list];
  await audit(locals.user!.id, `admin.download.${format}`, 'list', list);
  const name = `Little Characters ${l.file} ${todayInAthens()}.${format}`;
  if (format === 'csv') return csvResponse(name, toCsv(headers, rows));
  return pdfResponse(name, {
    title: l.title,
    subtitle: l.what(rows.length),
    columns: headers.map((header, i) => ({ header, weight: l.weights[i], align: header === 'Age' ? 'right' : undefined })),
    rows,
  });
}
