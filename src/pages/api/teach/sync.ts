/**
 * The teacher app's phones send attendance here (docs/back-office.md → The
 * teacher app): taps and "Submit attendance", saved on the phone first and
 * sent when there's signal. Idempotent: the same tap twice changes nothing,
 * and an older tap never replaces a newer one (src/server/attendance.ts).
 *
 * - Signed out (the session ended while offline): 401, and the phone keeps
 *   the taps until the same person signs in again.
 * - Taps made by someone else on this phone: 409, never saved under this
 *   person.
 */
import type { APIRoute } from 'astro';
import { saveReports, saveTaps, syncInput } from '@/server/attendance';
import { isProd } from '@/server/env';
import { requireTeacherOrOwner } from '@/server/staff';
import { devDay } from '@/server/today';
import { todayInAthens } from '@/lib/pricing';

export const prerender = false;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });

export const POST: APIRoute = async ({ request, locals, url }) => {
  // A JSON post can't come from another site's form, but say no to any other origin all the same.
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) return json({ error: 'origin' }, 403);
  const { staff, response } = requireTeacherOrOwner(locals);
  if (response) return json({ error: 'staff-only' }, 403);
  if (!staff) return json({ error: 'signed-out' }, 401);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad-request' }, 400);
  }
  const parsed = syncInput.safeParse(body);
  if (!parsed.success) return json({ error: 'bad-request' }, 400);
  if (parsed.data.by !== staff.id) return json({ error: 'other-person' }, 409);
  const viewer = { userId: staff.id, staffId: staff.staffId, role: staff.role };
  const now = new Date();
  // Browser tests pick the day with ?on=YYYY-MM-DD; production ignores it.
  const today = devDay(url.searchParams, !isProd) ?? todayInAthens(now);
  const taps = await saveTaps(viewer, parsed.data.taps, locals.content, now, today);
  // Reports after taps, so a class submitted offline is saved with its marks.
  const reports = await saveReports(viewer, parsed.data.reports, locals.content, now, today);
  return json({ results: [...taps, ...reports] });
};
