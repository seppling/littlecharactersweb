import type { APIRoute } from 'astro';
import { householdForUser, listEnrollments } from '@/server/family';

export const prerender = false;

/**
 * Tiny "who's signed in" for the public pages' header and staff tools. Returns
 * no personal data beyond a first name, except ?for=contact, which gives the
 * contact form the parent's own name and email to fill in. The answer is
 * never cached (all /api responses are private, no-store).
 */
export const GET: APIRoute = async ({ locals, url }) => {
  const user = locals.user;
  if (!user) return Response.json({ signedIn: false });
  if (url.searchParams.get('for') === 'contact') return Response.json({ signedIn: true, name: user.name ?? '', email: user.email });
  const household = await householdForUser(user.id);
  const upcoming = household ? (await listEnrollments(household.id)).filter((r) => r.enrollment.status !== 'waitlist').length : 0;
  return Response.json({ signedIn: true, firstName: user.name?.split(' ')[0] || 'there', upcoming, isAdmin: locals.isAdmin });
};
