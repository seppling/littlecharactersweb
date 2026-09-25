import type { APIRoute } from 'astro';
import { householdForUser, listEnrollments } from '@/server/family';

export const prerender = false;

/** Tiny "who's signed in" for the static pages' header. Returns no personal data beyond a first name. */
export const GET: APIRoute = async ({ locals }) => {
  const user = locals.user;
  if (!user) return Response.json({ signedIn: false });
  const household = await householdForUser(user.id);
  const upcoming = household ? (await listEnrollments(household.id)).filter((r) => r.enrollment.status !== 'waitlist').length : 0;
  return Response.json({ signedIn: true, firstName: user.name?.split(' ')[0] || 'there', upcoming });
};
