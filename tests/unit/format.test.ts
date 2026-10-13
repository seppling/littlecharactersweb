import { describe, expect, it } from 'vitest';
import { ageLabel, agesShort, agesSpan, price } from '@/lib/format';
import { programs } from '@/content/seed/programs';

const bySlug = (slug: string) => programs.find((p) => p.slug === slug)!;

describe('age labels from the class data', () => {
  it('spans a group of classes', () => {
    expect(agesSpan([{ ages: { min: 7, max: 10 } }, { ages: { min: 8, max: 17 } }])).toBe('Ages 7–17');
    expect(agesSpan([{ ages: { min: 9, max: 17 } }, { ages: { min: 11, max: 17 } }])).toBe('Ages 9–17');
  });

  it('stays open-ended when any class is, or is shown that way', () => {
    expect(agesSpan([{ ages: { min: 4, max: 6 } }, { ages: { min: 4 } }])).toBe('Ages 4+');
    expect(agesSpan([{ ages: { min: 18 } }])).toBe('Adults 18+');
    expect(agesSpan([{ ages: { min: 7, max: 10 } }, { ages: { min: 8, max: 17 }, agesLabel: 'Ages 8+' }])).toBe('Ages 7+');
  });

  it('matches the home page and About groups', () => {
    const span = (...slugs: string[]) => agesSpan(slugs.map(bySlug));
    expect(span('stories-and-songs')).toBe('Ages 4–6');
    expect(span('intro-to-theater', 'yes-and-improv')).toBe('Ages 7+');
    expect(span('produce-a-show', 'film-creation')).toBe('Ages 7+');
    expect(span('performance-troupe', 'geode-acting-studio')).toBe('Ages 9+');
  });

  it('is undefined for no classes, so the typed label is used', () => {
    expect(agesSpan([])).toBeUndefined();
  });

  it('shortens a label to sit beside a class name', () => {
    expect(agesShort('Ages 7–10')).toBe('7–10');
    expect(agesShort('Ages 7+')).toBe('7+');
    expect(agesShort('Adults 18+')).toBe('Adults 18+');
  });

  // The home page and About used to type these by hand, and they drifted (October 2026 audit).
  it('gives the ages the class pages show', () => {
    const label = (slug: string) => agesShort(ageLabel(bySlug(slug).ages, bySlug(slug).agesLabel));
    expect(label('film-creation')).toBe('9+');
    expect(label('yes-and-improv')).toBe('8+');
    expect(label('geode-acting-studio')).toBe('11–17');
    expect(label('performance-troupe')).toBe('9+');
    expect(label('intro-to-theater')).toBe('7–10');
  });
});

describe('price', () => {
  it('says a per-child price with its additional-child price the same way everywhere', () => {
    expect(price({ amount: 30, unit: 'child', additional: 10 })).toBe('$30 first child, $10 each additional');
    expect(price(bySlug('parents-night-out').priceFrom)).toBe('$30 first child, $10 each additional');
    for (const s of bySlug('parents-night-out').sessions) expect(price(s.price)).toBe('$30 first child, $10 each additional');
  });

  it('keeps the short form otherwise', () => {
    expect(price({ amount: 30, unit: 'child' })).toBe('$30/child');
    expect(price({ amount: 30, unit: 'child', additional: 30 })).toBe('$30/child');
    expect(price({ amount: 95, unit: 'month' })).toBe('$95/mo');
    expect(price({ amount: 0, unit: 'class' })).toBe('Free');
  });
});
