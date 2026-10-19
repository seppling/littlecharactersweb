/** Hannah marks a teacher's note read: it leaves Today (src/server/attendance.ts). Owners only. */
import type { APIRoute } from 'astro';
import { safeStaffPath, today } from '@/lib/admin-links';
import { markNoteRead } from '@/server/attendance';
import { requireStaff } from '@/server/staff';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const { staff, response } = requireStaff(locals);
  if (response) return response;
  if (!staff) return redirect(today(), 303);
  const form = await request.formData();
  await markNoteRead(String(form.get('reportId') ?? ''), staff.id);
  return redirect(safeStaffPath(String(form.get('next') ?? '')) ?? today(), 303);
};
