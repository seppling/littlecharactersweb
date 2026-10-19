import type { APIRoute } from 'astro';
import { todayInAthens } from '@/lib/pricing';
import { pdfResponse } from '@/server/downloads';
import { audit } from '@/server/records';
import { requireFreshStaff } from '@/server/staff';
import { getTag, kindLabel, tagMembers, tagTable } from '@/server/tags';

export const prerender = false;

/** A tag's list as a PDF ("Tag: <name>"). Fresh sign-in; logged. */
export const GET: APIRoute = async ({ locals, params, url }) => {
  const stop = requireFreshStaff(locals, url);
  if (stop) return stop;
  const t = await getTag(params.tagId ?? '');
  if (!t) return new Response('Not found', { status: 404 });
  const { headers, rows } = tagTable(await tagMembers(t, locals.content));
  await audit(locals.user!.id, 'admin.download.pdf', 'list', `tag:${t.id}`);
  return pdfResponse(`Tag ${t.name} ${todayInAthens()}.pdf`, {
    title: `Tag: ${t.name}`,
    subtitle: `${kindLabel(t.kind)} · ${rows.length} on the list`,
    columns: headers.map((header, i) => ({ header, weight: i === 0 ? 2 : header === 'Age' ? 0.6 : 2 })),
    rows,
  });
};
