/**
 * Put the wording drafts in src/content/seo-draft/ into the content editor as
 * unpublished drafts. Nothing is published: Hannah reviews each one, then
 * publishes or discards it. See docs/seo/drafts.md.
 *
 *   npm run seo:load-drafts             # show what it would do (writes nothing)
 *   npm run seo:load-drafts -- --commit # save the drafts
 *   npm run seo:load-drafts -- --from /tmp/try.ts   # drafts from another file (exporting `drafts`), to try the loader
 *
 * Uses DATABASE_URL (production) or the local dev database (APP_ENV=development;
 * stop the dev server first). Safe to run again: entries that already have
 * unpublished changes, or that changed since the draft was written, are skipped.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { drafts as ours, type Draft } from '../src/content/seo-draft';
import { describeOutcomes, loadDrafts } from './seo-drafts';

const args = process.argv.slice(2);
let commit = false;
let from: string | undefined;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--commit') commit = true;
  else if (args[i] === '--from' && args[i + 1]) from = args[++i];
  else if (args[i] !== '--dry-run') {
    console.error(`Unknown option ${args[i]}. Usage: npm run seo:load-drafts [-- --commit] [--from drafts.ts]`);
    process.exit(1);
  }
}
const drafts: Draft[] = from ? (await import(pathToFileURL(path.resolve(from)).href)).drafts : ours;

const outcomes = await loadDrafts(drafts, { commit });
console.log(commit ? 'Loading wording drafts\n' : 'Preview (nothing written)\n');
console.log(describeOutcomes(outcomes, commit));
process.exit(outcomes.some((o) => o.status === 'problem') ? 1 : 0);
