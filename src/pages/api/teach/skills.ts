/**
 * The teacher app's Skills view saves one tick here (docs/back-office.md →
 * Skills): `{ by, sessionId, date, studentId, skillId, status }`, status
 * `not_yet`, `working` or `got_it`. Needs signal: there's no offline queue,
 * so the page keeps the tick on screen and tries again when signal returns.
 * The same people as attendance may save (skillAccess in src/server/skills.ts).
 */
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { todayInAthens } from '@/lib/pricing';
import { isProd } from '@/server/env';
import { SKILL_STATUSES, setSkill } from '@/server/skills';
import { requireTeacherOrOwner } from '@/server/staff';
import { devDay } from '@/server/today';

export const prerender = false;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
const id = z.string().min(1).max(100);
const input = z.object({ by: id, sessionId: id, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), studentId: id, skillId: id, status: z.enum(SKILL_STATUSES) });

export const POST: APIRoute = async ({ request, locals, url }) => {
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
  const parsed = input.safeParse(body);
  if (!parsed.success) return json({ error: 'bad-request' }, 400);
  if (parsed.data.by !== staff.id) return json({ error: 'other-person' }, 409);
  const now = new Date();
  // Browser tests pick the day with ?on=YYYY-MM-DD; production ignores it.
  const today = devDay(url.searchParams, !isProd) ?? todayInAthens(now);
  const result = await setSkill({ userId: staff.id, staffId: staff.staffId, role: staff.role }, parsed.data, locals.content, now, today);
  return json(result, result.ok ? 200 : 403);
};
