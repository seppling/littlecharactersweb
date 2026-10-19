/**
 * Downloads for staff lists: a spreadsheet (CSV) and a PDF (docs/back-office.md
 * → Downloads). A list page at /admin/x has /admin/x.csv and /admin/x.pdf
 * beside it; all three build their rows with the same server function.
 *
 * The PDF is made here on the server, not with the browser's print dialog,
 * because saving a printout as a PDF is awkward on an iPhone. It uses PDF's
 * built-in Helvetica: pdfkit can't yet embed the site's variable fonts
 * (Figtree, Bricolage Grotesque).
 */
import PDFDocument from 'pdfkit';
import type { Cell } from '@/lib/csv';

const PRIVATE = 'private, no-store';

/** "Signups (Oct 19).csv" → a safe attachment name with a plain-ASCII fallback. */
function disposition(filename: string) {
  const ascii = filename.replace(/[^\w .()-]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function csvResponse(filename: string, csv: string) {
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': disposition(filename), 'Cache-Control': PRIVATE },
  });
}

export interface PdfColumn {
  header: string;
  /** Share of the page width, relative to the other columns. Default 1. */
  weight?: number;
  align?: 'left' | 'right';
}

export interface PdfTable {
  title: string;
  /** The filters shown, like "Fall 2026 · Waitlist only". */
  subtitle?: string;
  columns: PdfColumn[];
  rows: Cell[][];
  /** Landscape fits more columns. Default: landscape for more than 5 columns. */
  orientation?: 'portrait' | 'landscape';
  /** When it was made. Default now. */
  made?: Date;
  /** Who it's made for, under the title. Default "Little Characters" (staff lists); a family's statement names the family. */
  madeFor?: string;
}

const INK = '#1c1826';
const MUTE = '#6d6680';
const LINE = '#cfc8dc';
const HALL = '#f5f3f8';
const PURPLE = '#662299';
const MARGIN = 40;
const PAD = 4;
const SIZE = 9;
/** A single very long cell can't run past one page. */
const MAX_CELL = 1200;

const cellText = (c: Cell) => {
  if (c === null || c === undefined) return '';
  if (c instanceof Date) return madeOn(c);
  if (typeof c === 'boolean') return c ? 'Yes' : 'No';
  const s = String(c);
  return s.length > MAX_CELL ? `${s.slice(0, MAX_CELL)}…` : s;
};
const madeOn = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });

/** The PDF file's bytes. */
export function buildPdf({ title, subtitle, columns, rows, orientation, made = new Date(), madeFor = 'Little Characters' }: PdfTable): Promise<Buffer> {
  const layout = orientation ?? (columns.length > 5 ? 'landscape' : 'portrait');
  const doc = new PDFDocument({ size: 'LETTER', layout, margin: MARGIN, bufferPages: true, info: { Title: title, Author: 'Little Characters' } });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const left = MARGIN;
  const width = doc.page.width - 2 * MARGIN;
  const bottom = () => doc.page.height - MARGIN - 14;
  const total = columns.reduce((a, c) => a + (c.weight ?? 1), 0);
  const widths = columns.map((c) => (width * (c.weight ?? 1)) / total);
  const xs = widths.map((_, i) => left + widths.slice(0, i).reduce((a, w) => a + w, 0));

  // Header: title, filters, when and for whom.
  doc.font('Helvetica-Bold').fontSize(18).fillColor(INK).text(title, left, MARGIN, { width });
  if (subtitle) doc.moveDown(0.15).font('Helvetica').fontSize(10.5).fillColor(INK).text(subtitle, { width });
  doc.moveDown(0.25).font('Helvetica').fontSize(9).fillColor(MUTE).text(`Made ${madeOn(made)} for ${madeFor}`, { width });
  doc.moveDown(0.8);

  const rowHeight = (cells: string[], font: string) => {
    doc.font(font).fontSize(SIZE);
    return Math.max(...cells.map((t, i) => doc.heightOfString(t || ' ', { width: widths[i] - 2 * PAD })), SIZE) + 2 * PAD;
  };
  const drawRow = (cells: string[], y: number, h: number, font: string, fill?: string) => {
    if (fill) doc.rect(left, y, width, h).fill(fill);
    doc.font(font).fontSize(SIZE).fillColor(INK);
    cells.forEach((t, i) => doc.text(t, xs[i] + PAD, y + PAD, { width: widths[i] - 2 * PAD, align: columns[i].align ?? 'left', lineBreak: true }));
    doc.moveTo(left, y + h).lineTo(left + width, y + h).lineWidth(0.5).strokeColor(LINE).stroke();
  };

  const headers = columns.map((c) => c.header);
  const headerH = rowHeight(headers, 'Helvetica-Bold');
  const drawHeader = (y: number) => {
    drawRow(headers, y, headerH, 'Helvetica-Bold', HALL);
    doc.moveTo(left, y).lineTo(left + width, y).lineWidth(1.5).strokeColor(INK).stroke();
    return y + headerH;
  };

  let y = drawHeader(doc.y);
  if (!rows.length) {
    doc.font('Helvetica').fontSize(10).fillColor(MUTE).text('Nothing to show.', left, y + 8, { width });
  }
  rows.forEach((row, n) => {
    const cells = columns.map((_, i) => cellText(row[i]));
    const h = rowHeight(cells, 'Helvetica');
    if (y + h > bottom()) {
      doc.addPage();
      y = drawHeader(MARGIN);
    }
    drawRow(cells, y, h, 'Helvetica', n % 2 ? '#fbfafd' : undefined);
    y += h;
  });

  // Page numbers, and the title on later pages' feet.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const footY = doc.page.height - MARGIN + 8;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor(MUTE);
    doc.text(title, left, footY, { width: width / 2, lineBreak: false, ellipsis: true });
    doc.fillColor(PURPLE).text(`Page ${i + 1} of ${range.count}`, left + width / 2, footY, { width: width / 2, align: 'right', lineBreak: false });
  }
  doc.end();
  return done;
}

export async function pdfResponse(filename: string, table: PdfTable) {
  const bytes = await buildPdf(table);
  return new Response(new Uint8Array(bytes), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': disposition(filename), 'Cache-Control': PRIVATE },
  });
}
