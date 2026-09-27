/**
 * The starting content. The first time the site runs against an empty
 * database, these entries are copied in (see src/server/content.ts). After
 * that the database is the source of truth: edit content at /admin/content,
 * not here.
 */
import { slugify } from '../ids';
import type { CollectionKey } from '../collections';
import { programs } from './programs';
import { events } from './events';
import { faqs } from './faqs';
import { team } from './team';
import { testimonials } from './testimonials';
import { locations } from './locations';
import { pages } from './pages';

export interface SeedEntry {
  collection: CollectionKey | 'pages';
  id: string;
  position: number;
  data: unknown;
}

/** Drop `undefined` values, the way saving to the database would. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value));

export function seedEntries(): SeedEntry[] {
  const list = <T>(collection: CollectionKey, items: T[], idOf: (item: T) => string): SeedEntry[] =>
    items.map((item, position) => ({ collection, id: idOf(item), position, data: plain(item) }));
  return [
    ...list('programs', programs, (p) => p.slug),
    ...list('events', events, (e) => e.slug),
    ...list('faqs', faqs, (f) => slugify(f.q)),
    ...list('team', team, (m) => slugify(m.name)),
    ...list('testimonials', testimonials, (t) => slugify(t.attribution.split(',')[0])),
    ...list('locations', locations, (l) => l.id),
    ...Object.entries(pages).map(([id, data], position) => ({ collection: 'pages' as const, id, position, data: plain(data) })),
  ];
}
