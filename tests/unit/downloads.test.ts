import { describe, expect, it } from 'vitest';
import { toCsv } from '@/lib/csv';
import { buildPdf, csvResponse, pdfResponse } from '@/server/downloads';

describe('toCsv', () => {
  it('starts with a byte-order mark and ends lines with CRLF', () => {
    const csv = toCsv(['email', 'list'], [['a@example.com', 'newsletter']]);
    expect(csv).toBe('﻿email,list\r\na@example.com,newsletter\r\n');
  });

  it('quotes commas, quotes and line breaks (RFC 4180)', () => {
    const csv = toCsv(['note'], [['Hi, there'], ['She said "yes"'], ['two\nlines'], [' padded ']]);
    expect(csv.split('\r\n').slice(1, 5)).toEqual(['"Hi, there"', '"She said ""yes"""', '"two\nlines"', '" padded "']);
  });

  it('keeps spreadsheet formulas from running', () => {
    const csv = toCsv(['x'], [['=HYPERLINK("http://evil")'], ['+1'], ['-2+3'], ['@SUM(A1)'], ['\tTab'], ['\rCR'], ['safe=still']]);
    expect(csv.split('\r\n').slice(1, 8)).toEqual(['"\'=HYPERLINK(""http://evil"")"', "'+1", "'-2+3", "'@SUM(A1)", "'\tTab", `"'\rCR"`, 'safe=still']);
    // A refund's amount stays a number the spreadsheet adds up.
    expect(toCsv(['Amount ($)'], [['-25.00'], ['-1-1']]).split('\r\n').slice(1, 3)).toEqual(['-25.00', "'-1-1"]);
  });

  it('writes numbers, dates, yes/no and blanks', () => {
    const csv = toCsv(['n', 'd', 'b', 'e'], [[-5, new Date('2026-10-19T12:00:00Z'), true, null]]);
    expect(csv.split('\r\n')[1]).toBe('-5,2026-10-19T12:00:00.000Z,yes,');
  });
});

describe('download responses', () => {
  it('sends a CSV as a private attachment', async () => {
    const res = csvResponse('Little Characters sign-ups.csv', toCsv(['a'], []));
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="Little Characters sign-ups.csv"/);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
  });

  it('builds a real PDF with the title in it', async () => {
    const bytes = await buildPdf({ title: 'Messages and sign-ups', subtitle: 'All forms', columns: [{ header: 'When' }, { header: 'Email', weight: 2 }], rows: [['Oct 19', 'a@example.com']] });
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(bytes.toString('latin1')).toContain('Messages and sign-ups');
  });

  it('runs to more pages for long lists, with an empty list still a valid file', async () => {
    const rows = Array.from({ length: 200 }, (_, i) => [`Row ${i}`, 'x'.repeat(300)]);
    const long = (await buildPdf({ title: 'Long', columns: [{ header: 'A' }, { header: 'B' }], rows })).toString('latin1');
    expect(Number(long.match(/\/Count (\d+)/)?.[1])).toBeGreaterThan(3);
    const empty = await buildPdf({ title: 'Empty', columns: [{ header: 'A' }], rows: [] });
    expect(empty.subarray(0, 4).toString('latin1')).toBe('%PDF');
  });

  it('sends a PDF as a private attachment', async () => {
    const res = await pdfResponse('Sign-ups.pdf', { title: 'Sign-ups', columns: [{ header: 'A' }], rows: [] });
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="Sign-ups.pdf"/);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(new TextDecoder().decode((await res.arrayBuffer()).slice(0, 4))).toBe('%PDF');
  });
});
