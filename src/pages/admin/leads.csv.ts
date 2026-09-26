import type { APIRoute } from 'astro';
import { listLeads } from '@/server/leads';

export const prerender = false;

/** Signup emails (newsletter, notify me, summer camps) for importing into an email tool. Staff only. */
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.isAdmin) return new Response('Not found', { status: 404 });
  const rows = (await listLeads(10_000)).filter((l) => l.kind !== 'contact');
  const cell = (v: string) => `"${v.replaceAll('"', '""')}"`;
  const csv = [
    ['email', 'list', 'program', 'signed_up'].join(','),
    ...rows.map((l) => [l.email, l.kind, l.details.program ?? '', l.createdAt.toISOString().slice(0, 10)].map(cell).join(',')),
  ].join('\n');
  return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="little-characters-signups.csv"' } });
};
