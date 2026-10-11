/**
 * Write docs/seo/review.md from the wording drafts in src/content/seo-draft/:
 * for each page or class, its editor link and each change as before → after.
 *
 *   npm run seo:review
 */
import { writeFileSync } from 'node:fs';
import { drafts } from '../src/content/seo-draft';
import { renderReview } from '../src/content/seo-draft/review';

writeFileSync('docs/seo/review.md', renderReview(drafts));
console.log(`Wrote docs/seo/review.md (${drafts.length} draft${drafts.length === 1 ? '' : 's'}).`);
