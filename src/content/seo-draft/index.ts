/**
 * Every wording draft, in the order they're loaded and reviewed.
 *
 *   npm test                  checks each one still applies to the starting content
 *   npm run seo:review        writes docs/seo/review.md from them
 *   npm run seo:load-drafts   puts them in the editor as unpublished drafts (--commit to write)
 *
 * See docs/seo/drafts.md.
 */
import type { Draft } from './format';
import { pages } from './pages';
import { programs } from './programs';
import { events } from './events';
import { faqs } from './faqs';
import { team } from './team';
import { testimonials } from './testimonials';
import { locations } from './locations';

export const drafts: Draft[] = [...pages, ...programs, ...events, ...faqs, ...team, ...testimonials, ...locations];

export * from './format';
