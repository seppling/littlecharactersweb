/**
 * The class finder's order once an age is picked: open programs first, then
 * the narrowest age range that covers the chosen ages, then partial overlaps.
 */
import { describe, expect, it } from 'vitest';
import { programs } from '@/content/seed/programs';
import { locations } from '@/content/seed/locations';
import { finderLimit, schoolOnlyLabel, sortByFit, type FinderItem } from '@/lib/finder';
import { ageBands } from '@/content/catalog';
import type { Program } from '@/content/types';

// The page's usual order (src/pages/programs/index.astro): classes, then camps, then the rest; youngest first.
const order = ['class', 'camp', 'inclusive', 'lesson', 'party', 'workshop'];
const catalog = [...programs]
  .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.ages.min - b.ages.min)
  .map((p) => ({ title: p.title, ageMin: p.ages.min, ageMax: p.ages.max ?? 120, limit: finderLimit(p) }));

const band = (id: string) => {
  const b = ageBands.find((x) => x.id === id)!;
  return [b.min, b.max] as const;
};
/** What a family sees for an age: the programs that overlap it, in finder order. */
const shown = (id: string) => {
  const [lo, hi] = band(id);
  return sortByFit(catalog.filter((p) => p.ageMin <= hi && p.ageMax >= lo), [lo, hi]).map((p) => p.title);
};
const bySlug = (slug: string) => programs.find((p) => p.slug === slug)!;

describe('who can join', () => {
  it('marks Athens Academy Enrichment as one school’s students', () => {
    expect(finderLimit(bySlug('athens-academy-enrichment'))).toBe('school');
    const byId = (id: string) => locations.find((l) => l.id === id);
    expect(schoolOnlyLabel(bySlug('athens-academy-enrichment'), byId)).toBe('Athens Academy students only');
  });

  it('marks the daytime homeschool class as school hours', () => {
    expect(finderLimit(bySlug('homeschool-class'))).toBe('school-hours');
  });

  it('leaves every other program open', () => {
    const limited = programs.filter((p) => finderLimit(p)).map((p) => p.slug);
    expect(limited.sort()).toEqual(['athens-academy-enrichment', 'homeschool-class']);
  });

  it('doesn’t count camps or programs with no dates as limited', () => {
    const camp = { kind: 'camp', sessions: [{ days: ['Mon'], start: '09:00', locationId: 'hq' }] } as unknown as Program;
    expect(finderLimit(camp)).toBeUndefined();
    expect(finderLimit({ kind: 'class', sessions: [] })).toBeUndefined();
  });
});

describe('order for an age', () => {
  it('puts Acting Studio first for 14–17, ahead of the “Ages 6+, 7+, 8+, 9+” classes', () => {
    const list = shown('14-17');
    expect(list[0]).toBe('Geode: Acting Studio');
    for (const t of ['Yes, And… Improv', 'Produce a Show', 'LC/Geode Performance Troupe', 'Film Creation']) {
      expect(list.indexOf(t)).toBeGreaterThan(0);
    }
  });

  it('puts the homeschool class last for 14–17 (school hours)', () => {
    expect(shown('14-17').at(-1)).toBe('LC Homeschool Class');
  });

  it('puts Stories and Songs first for 4–6, and Athens Academy and homeschool after every open program', () => {
    const list = shown('4-6');
    expect(list[0]).toBe('Stories and Songs');
    expect(list.slice(-2).sort()).toEqual(['Athens Academy Enrichment', 'LC Homeschool Class']);
  });

  it('puts Intro to Theater first for 7–10', () => {
    expect(shown('7-10')[0]).toBe('Intro to Theater');
  });

  it('keeps the usual order with no age chosen', () => {
    expect(sortByFit(catalog, undefined).map((p) => p.title)).toEqual(catalog.map((p) => p.title));
  });
});

describe('sortByFit', () => {
  const item = (name: string, ageMin: number, ageMax: number, limit?: FinderItem['limit']) => ({ name, ageMin, ageMax, limit });

  it('ranks covering ranges by width, then partial overlaps, then limited programs', () => {
    const items = [item('school', 11, 17, 'school'), item('partial', 15, 16), item('wide', 4, 120), item('narrow', 11, 17), item('mid', 8, 17)];
    expect(sortByFit(items, [14, 17]).map((i) => i.name)).toEqual(['narrow', 'mid', 'wide', 'partial', 'school']);
  });

  it('is stable: equal keys keep their given order', () => {
    const items = [item('a', 9, 17), item('b', 9, 17), item('c', 9, 17)];
    expect(sortByFit(items, [14, 17]).map((i) => i.name)).toEqual(['a', 'b', 'c']);
  });

  it('doesn’t change the list it was given', () => {
    const items = [item('wide', 4, 120), item('narrow', 11, 17)];
    sortByFit(items, [14, 17]);
    expect(items.map((i) => i.name)).toEqual(['wide', 'narrow']);
  });
});
