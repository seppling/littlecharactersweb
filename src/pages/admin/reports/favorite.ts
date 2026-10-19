/** Star or unstar a report (src/server/reports/favorites.ts), then back to where it was pressed. Owners only. */
import type { APIRoute } from 'astro';
import { reportsLibrary, safeStaffPath } from '@/lib/admin-links';
import { setFavorite } from '@/server/reports/favorites';
import { requireStaff } from '@/server/staff';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const { staff, response } = requireStaff(locals);
  if (response) return response;
  if (!staff || !locals.staffId) return redirect(reportsLibrary(), 303);
  const form = await request.formData();
  await setFavorite(locals.staffId, String(form.get('key') ?? ''), form.get('on') === '1');
  return redirect(safeStaffPath(String(form.get('next') ?? '')) ?? reportsLibrary(), 303);
};
