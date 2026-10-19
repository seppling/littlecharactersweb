/**
 * Spreadsheet downloads (docs/back-office.md → Downloads). RFC 4180 quoting,
 * CRLF line ends, and a byte-order mark so Excel reads accents and curly
 * quotes as UTF-8.
 */

export type Cell = string | number | boolean | Date | null | undefined;

const BOM = '﻿';

/**
 * A cell that starts with = + - @, a tab or a carriage return could run as a
 * formula when opened in a spreadsheet, so it gets a leading apostrophe.
 */
function safe(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function text(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  if (cell instanceof Date) return cell.toISOString();
  if (typeof cell === 'number') return String(cell);
  if (typeof cell === 'boolean') return cell ? 'yes' : 'no';
  return safe(cell);
}

function quote(value: string) {
  return /[",\r\n]/.test(value) || value !== value.trim() ? `"${value.replaceAll('"', '""')}"` : value;
}

export function toCsv(headers: string[], rows: Cell[][]): string {
  const line = (cells: Cell[]) => cells.map((c) => quote(text(c))).join(',');
  return BOM + [line(headers), ...rows.map(line)].join('\r\n') + '\r\n';
}
