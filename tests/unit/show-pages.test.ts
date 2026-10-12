/**
 * Show pages (/events/<slug>): which events get one, the old addresses that
 * still go to /events, the Event markup for Google, and where event cards link.
 */
import { describe, expect, it } from 'vitest';
import { eventLink, eventPath, hasShowPage, isPastShow, showPageLd } from '@/lib/events';
import { oldSiteRedirect } from '@/lib/redirects';
import { collections } from '@/content/collections';
import { validate, type Data } from '@/content/fields';
import { events } from '@/content/seed/events';
import { locations } from '@/content/seed/locations';
import { programs } from '@/content/seed/programs';
import type { EventItem } from '@/content/types';

const site = {
  name: 'Little Characters Theater Troupe',
  shortName: 'Little Characters',
  url: 'https://www.littlecharacters.org',
  description: 'A children’s theater in Athens, GA.',
  founded: 2022,
  founder: 'Hannah Eppling',
  contact: { email: 'hello@example.com', phone: '(706) 555-0123' },
  social: {},
};
const hq = locations.find((l) => l.id === 'hq')!;
const pageUrl = 'https://www.littlecharacters.org/events/spring-show';

const show = (over: Partial<EventItem> = {}): EventItem => ({
  slug: 'spring-show',
  title: 'Spring Variety Show',
  kind: 'show',
  brand: 'lc',
  gel: 'purple',
  times: [
    { start: '2027-05-01T14:00', end: '2027-05-01T15:30' },
    { start: '2027-05-02T14:00', end: '2027-05-02T15:30' },
  ],
  locationId: 'hq',
  summary: 'Performances from this spring’s classes.',
  price: 'Free',
  ...over,
});

const isShowSlug = (slug: string) => events.some((e) => e.slug === slug && hasShowPage(e));
const programExists = (slug: string) => programs.some((p) => p.slug === slug);
const types = (data: { '@type': string }[]) => data.map((d) => d['@type']);

describe('which events get a page', () => {
  it('gives shows a page, past and undated ones too, and recurring nights none', () => {
    const withPage = events.filter(hasShowPage).map((e) => e.slug);
    expect(withPage).toEqual(['jack-and-the-beanstalk', 'fall-variety-show']);
    expect(events.filter((e) => !hasShowPage(e)).map((e) => e.kind)).not.toContain('show');
  });
  it('knows where each event lives', () => {
    expect(eventPath(show())).toBe('/events/spring-show');
    expect(eventPath(events.find((e) => e.slug === 'parents-night-out-nov')!)).toBe('/events#parents-night-out-nov');
  });
  it('calls a show past only once its last performance is over', () => {
    expect(isPastShow(show(), '2027-05-02')).toBe(false);
    expect(isPastShow(show(), '2027-05-03')).toBe(true);
    expect(isPastShow(show({ times: [], tba: '2026-12' }), '2027-05-03')).toBe(false);
  });
});

describe('old event addresses', () => {
  it('serves a current show’s page at its address', () => {
    expect(oldSiteRedirect('/events/fall-variety-show', isShowSlug)).toBeUndefined();
    expect(oldSiteRedirect('/events/jack-and-the-beanstalk', isShowSlug)).toBeUndefined();
  });
  it('sends the same page written another way to its one address', () => {
    expect(oldSiteRedirect('/events/fall-variety-show/', isShowSlug)).toBe('/events/fall-variety-show');
    expect(oldSiteRedirect('/events/Fall-Variety-Show', isShowSlug)).toBe('/events/fall-variety-show');
  });
  it('still sends old Squarespace addresses that match no show to /events', () => {
    expect(oldSiteRedirect('/events/lc-variety-show/', isShowSlug)).toBe('/events');
    expect(oldSiteRedirect('/events/8uepmlluu1px9twdv3vksheyuwj1t6-kxpf3', isShowSlug)).toBe('/events');
    // Recurring nights have no page of their own.
    expect(oldSiteRedirect('/events/parents-night-out-nov', isShowSlug)).toBe('/events');
    expect(oldSiteRedirect('/events/fall-variety-show/extra', isShowSlug)).toBe('/events');
  });
  it('leaves the calendar files and the list alone', () => {
    expect(oldSiteRedirect('/events/fall-variety-show.ics', isShowSlug)).toBeUndefined();
    expect(oldSiteRedirect('/events/parents-night-out-nov.ics', isShowSlug)).toBeUndefined();
    expect(oldSiteRedirect('/events', isShowSlug)).toBeUndefined();
    expect(oldSiteRedirect('/events/', isShowSlug)).toBeUndefined();
  });
});

describe('a show page’s structured data', () => {
  const ctx = (today: string) => ({ site, location: hq, pageUrl, today });

  it('has a breadcrumb and one Event per performance still to come', () => {
    const data = showPageLd(show(), ctx('2027-04-01')) as any[];
    expect(types(data)).toEqual(['BreadcrumbList', 'Event', 'Event']);
    expect(data[0].itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Shows & events', item: 'https://www.littlecharacters.org/events' },
      { '@type': 'ListItem', position: 2, name: 'Spring Variety Show', item: undefined },
    ]);
    expect(data[1]).toMatchObject({ name: 'Spring Variety Show', startDate: '2027-05-01T14:00:00-04:00', url: pageUrl });
    expect(data[1].location.address.streetAddress).toBeTruthy();
  });
  it('leaves out performances that are over', () => {
    const data = showPageLd(show(), ctx('2027-05-02')) as any[];
    expect(types(data)).toEqual(['BreadcrumbList', 'Event']);
    expect(data[1].startDate).toBe('2027-05-02T14:00:00-04:00');
  });
  it('has no Event once the show is over', () => {
    expect(types(showPageLd(show(), ctx('2027-06-01')) as any[])).toEqual(['BreadcrumbList']);
  });
  it('has no Event while the date is coming soon', () => {
    expect(types(showPageLd(show({ times: [], tba: '2027-05' }), ctx('2027-04-01')) as any[])).toEqual(['BreadcrumbList']);
  });
});

describe('event cards', () => {
  it('link a show’s title to its page', () => {
    expect(eventLink(show(), programExists)).toBe('/events/spring-show');
  });
  it('link a recurring night to its class page, when that class exists', () => {
    const night = events.find((e) => e.slug === 'parents-night-out-nov')!;
    expect(eventLink(night, programExists)).toBe('/programs/parents-night-out');
    expect(eventLink({ ...night, programSlug: 'gone' }, programExists)).toBeUndefined();
    expect(eventLink({ ...night, programSlug: undefined }, programExists)).toBeUndefined();
  });
  it('point every recurring night in the starting content at a real class, and keep its button', () => {
    const expected: Record<string, string> = { 'drop-off': 'parents-night-out', geode: 'geode-adult-improv', community: 'free-community-class' };
    for (const e of events.filter((e) => !hasShowPage(e))) {
      expect(e.programSlug).toBe(expected[e.kind]);
      expect(programExists(e.programSlug!)).toBe(true);
      expect(e.cta?.href).toBeTruthy();
    }
  });
});

describe('the editor’s event fields', () => {
  const fields = collections.events.fields;
  it('has a “Class page” chosen from the classes, a photo and search fields', () => {
    expect(fields.find((f) => f.key === 'programSlug')).toMatchObject({ label: 'Class page', type: 'ref', collection: 'programs' });
    expect(fields.find((f) => f.key === 'image')).toMatchObject({ type: 'image' });
    expect(fields.find((f) => f.key === 'seo')).toMatchObject({ type: 'group' });
  });
  it('accepts every starting event, and keeps the new fields', () => {
    for (const e of events) {
      const result = validate(fields, e as unknown as Data);
      expect(result.ok).toBe(true);
      if (result.ok && e.programSlug) expect(result.data.programSlug).toBe(e.programSlug);
    }
    const result = validate(fields, {
      ...show(),
      image: { src: 'builtin:photos/cast-silly-faces', alt: 'The cast after a show', position: '50% 40%' },
      seo: { title: 'Spring Variety Show in Athens, GA', description: 'Two afternoons of performances.' },
    } as unknown as Data);
    expect(result.ok && result.data.image && result.data.seo).toBeTruthy();
  });
});
