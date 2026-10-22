import type { APIRoute } from 'astro';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { classPage } from '@/lib/admin-links';
import { getDb, schema } from '@/server/db';
import { requireStaff } from '@/server/staff';
import { TagError, findOrCreateTag, tagStudents } from '@/server/tags';

export const prerender = false;

/**
 * "Tag selected" on a class's roster (owners): adds a child tag (picked, or
 * typed: a new name makes it) to every ticked child. Only children of this
 * class count (signed up and not cancelled, or a drop-in). Back to the
 * roster with ?tagged=<n> (or ?tagError=<code>), keeping the roster's date
 * and tag filter. Each child tagged is logged (tags.ts).
 */
export const POST: APIRoute = async ({ locals, params, request, redirect }) => {
  const { staff, response } = requireStaff(locals);
  if (response) return response;
  if (!staff) return new Response(null, { status: 403 });
  const found = locals.content.findSession(params.sessionId ?? '');
  if (!found) return new Response('Not found', { status: 404 });
  const form = await request.formData();
  const ticked = form.getAll('studentId').map(String).filter(Boolean);
  const keep = new URLSearchParams();
  for (const k of ['date', 'tag']) if (form.get(k)) keep.set(k, String(form.get(k)));
  const back = (q: Record<string, string>) => {
    for (const [k, v] of Object.entries(q)) keep.set(k, v);
    return redirect(`${classPage(found.session.id)}?${keep}#roster-h`, 303);
  };
  const db = await getDb();
  const inClass = ticked.length
    ? new Set([
        ...(await db
          .select({ id: schema.enrollment.studentId })
          .from(schema.enrollment)
          .where(and(eq(schema.enrollment.sessionId, found.session.id), ne(schema.enrollment.status, 'cancelled'), inArray(schema.enrollment.studentId, ticked)))).map((r) => r.id),
        ...(await db
          .select({ id: schema.dropIn.studentId })
          .from(schema.dropIn)
          .where(and(eq(schema.dropIn.sessionId, found.session.id), eq(schema.dropIn.status, 'booked'), inArray(schema.dropIn.studentId, ticked)))).map((r) => r.id),
      ])
    : new Set<string>();
  try {
    if (!inClass.size) throw new TagError('Tick at least one child.', 'none');
    const t = await findOrCreateTag(staff.id, 'child', String(form.get('name') ?? ''));
    const n = await tagStudents(staff.id, t.id, [...inClass]);
    return back({ tagged: String(n), of: String(inClass.size) });
  } catch (e) {
    if (!(e instanceof TagError)) throw e;
    return back({ tagError: e.code });
  }
};
