import type { APIRoute } from 'astro';
import { leadInput, saveLead } from '@/server/leads';

export const prerender = false;

/**
 * The public site's forms post here. With JavaScript, the page shows its own
 * confirmation (JSON reply); without it, the visitor lands on /thanks.
 */
export const POST: APIRoute = async ({ request, redirect }) => {
  const wantsJson = request.headers.get('accept')?.includes('application/json') ?? false;
  const form = await request.formData().catch(() => null);
  const parsed = leadInput.safeParse(form ? Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])) : {});
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Please check the form and try again.';
    return wantsJson ? Response.json({ ok: false, message }, { status: 400 }) : new Response(message, { status: 400 });
  }
  try {
    await saveLead(parsed.data);
  } catch (e) {
    console.error('Lead form failed', e);
    const message = 'Sorry, that didn’t go through. Please try again, or email us directly.';
    return wantsJson ? Response.json({ ok: false, message }, { status: 500 }) : new Response(message, { status: 500 });
  }
  return wantsJson ? Response.json({ ok: true }) : redirect(`/thanks?form=${parsed.data.kind}`, 303);
};
