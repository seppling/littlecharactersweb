import type { APIRoute } from 'astro';
import { family } from '@/lib/admin-links';
import { getDb, schema } from '@/server/db';
import { requireStaff } from '@/server/staff';
import { TagError, findOrCreateTag, isTagKind, tagHousehold, tagStudents, untagHousehold, untagStudent } from '@/server/tags';
import { and, eq } from 'drizzle-orm';

export const prerender = false;

/**
 * The family page's tag forms (owners): add a tag (picked or typed: a new
 * name makes the tag) to the family or one of its children, or remove one.
 * Back to the page with ?tags= (or ?tagError=<code>; never a name), at the
 * child's card or the family's tags. Every change is logged (tags.ts).
 */
export const POST: APIRoute = async ({ locals, params, request, redirect }) => {
  const { staff, response } = requireStaff(locals);
  if (response) return response;
  if (!staff) return new Response(null, { status: 403 });
  const householdId = params.householdId ?? '';
  const db = await getDb();
  const [h] = await db.select({ id: schema.household.id }).from(schema.household).where(eq(schema.household.id, householdId));
  if (!h) return new Response('Not found', { status: 404 });

  const form = await request.formData();
  const get = (k: string) => String(form.get(k) ?? '');
  const kind = get('kind');
  if (!isTagKind(kind)) return new Response('Bad request', { status: 400 });
  const studentId = kind === 'child' ? get('studentId') : '';
  if (kind === 'child') {
    // Only this family's own children.
    const [s] = await db.select({ id: schema.student.id }).from(schema.student).where(and(eq(schema.student.id, studentId), eq(schema.student.householdId, householdId)));
    if (!s) return new Response('Not found', { status: 404 });
  }
  const anchor = kind === 'child' ? `#child-${encodeURIComponent(studentId)}` : '#family-tags';
  const back = (q: Record<string, string>) => redirect(`${family(householdId)}?${new URLSearchParams(q)}${anchor}`, 303);
  try {
    if (get('action') === 'add') {
      const t = await findOrCreateTag(staff.id, kind, get('name'));
      if (kind === 'child') await tagStudents(staff.id, t.id, [studentId]);
      else await tagHousehold(staff.id, t.id, householdId);
      return back({ tags: t.created ? 'created' : 'added' });
    }
    if (get('action') === 'remove') {
      if (kind === 'child') await untagStudent(staff.id, get('tagId'), studentId);
      else await untagHousehold(staff.id, get('tagId'), householdId);
      return back({ tags: 'removed' });
    }
  } catch (e) {
    if (!(e instanceof TagError)) throw e;
    return back({ tagError: e.code });
  }
  return new Response('Bad request', { status: 400 });
};
