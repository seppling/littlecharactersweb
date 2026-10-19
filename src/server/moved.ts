/**
 * Staff pages that moved in October 2026 (docs/back-office.md → Routes):
 * the old addresses send staff on for good. Signed-in families still get
 * "Not found", as before.
 */
import { requireStaff } from './staff';

export function movedTo(locals: App.Locals, request: Request, to: string | null) {
  const { response } = requireStaff(locals);
  if (response) return response;
  if (!to) return new Response('Not found', { status: 404 });
  // A form posted to an old address keeps its method (308).
  const status = request.method === 'GET' || request.method === 'HEAD' ? 301 : 308;
  return new Response(null, { status, headers: { Location: to } });
}
