import type { APIRoute } from 'astro';
import { searchTag } from '@/lib/admin-links';

export const prerender = false;

/** tagList(id) is the address a tag's downloads hang off; the list itself is the tag's search results. */
export const GET: APIRoute = ({ params, redirect }) => redirect(searchTag(params.tagId ?? ''), 302);
