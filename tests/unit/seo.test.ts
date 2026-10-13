/**
 * What search engines and link previews read: titles, structured data
 * (dates in Athens time, escaping, events without an end or a date), share
 * images and the redirects from the old site.
 */
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { athensDateTime, breadcrumbLd, courseLd, eventLd, isCourse, jsonLd, offerPrice, organizationLd, pageTitle, postalAddress } from '@/lib/seo';
import { focusPoint, shareImage, shareStop, type UploadInfo } from '@/lib/media';
import { oldSiteRedirect } from '@/lib/redirects';
import { makeShareImage } from '@/server/share-image';
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
  social: { instagram: 'https://instagram.com/example' },
};
const hq = locations.find((l) => l.id === 'hq')!;
const pageUrl = 'https://www.littlecharacters.org/events';

const event = (over: Partial<EventItem> = {}): EventItem => ({
  slug: 'parents-night-out-nov',
  title: 'Parents’ Night Out',
  kind: 'drop-off',
  brand: 'lc',
  gel: 'red',
  times: [{ start: '2026-11-14T17:00', end: '2026-11-14T20:00' }],
  locationId: 'hq',
  summary: 'Games and theater while you enjoy an evening to yourself.',
  price: '$30',
  cta: { label: 'Register', href: 'https://docs.google.com/forms/example' },
  ...over,
});

describe('page titles', () => {
  it('adds the company name, unless the title already has it', () => {
    expect(pageTitle('Find a class', site)).toBe('Find a class · Little Characters');
    expect(pageTitle('Kids acting classes in Athens, GA | Little Characters', site)).toBe('Kids acting classes in Athens, GA | Little Characters');
    expect(pageTitle('About little characters', site)).toBe('About little characters');
    expect(pageTitle(undefined, site)).toBe('Little Characters Theater Troupe · Athens, GA');
    expect(pageTitle('  ', site)).toBe('Little Characters Theater Troupe · Athens, GA');
  });
});

describe('Athens times', () => {
  it('uses the offset in force on the day, summer and winter', () => {
    expect(athensDateTime('2026-10-15T18:30')).toBe('2026-10-15T18:30:00-04:00');
    expect(athensDateTime('2026-11-14T17:00')).toBe('2026-11-14T17:00:00-05:00');
    expect(athensDateTime('2027-03-14T12:00')).toBe('2027-03-14T12:00:00-04:00');
  });
  it('handles the days the clocks change', () => {
    // Nov 1, 2026: 1:30 am happens twice; the morning after is standard time.
    expect(athensDateTime('2026-11-01T09:00')).toBe('2026-11-01T09:00:00-05:00');
    expect(athensDateTime('2026-10-31T23:00')).toBe('2026-10-31T23:00:00-04:00');
  });
  it('rejects anything that is not a date and time', () => {
    expect(athensDateTime(undefined)).toBeUndefined();
    expect(athensDateTime('')).toBeUndefined();
    expect(athensDateTime('2026-11-14')).toBeUndefined();
    expect(athensDateTime('soon')).toBeUndefined();
  });
});

describe('structured data', () => {
  it('escapes text from the editor so it cannot close the script tag', () => {
    const out = jsonLd({ name: '</script><script>alert(1)</script>', line: 'a\u2028b' });
    expect(out).not.toContain('</script');
    expect(out).not.toContain('\u2028');
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>', line: 'a\u2028b' });
  });

  it('reads addresses as entered, and keeps odd ones whole', () => {
    expect(postalAddress(hq.address)).toEqual({
      '@type': 'PostalAddress',
      streetAddress: '1635 W Broad St',
      addressLocality: 'Athens',
      addressRegion: 'GA',
      postalCode: '30606',
      addressCountry: 'US',
    });
    expect(postalAddress(['Somewhere on campus'])).toEqual({ '@type': 'PostalAddress', streetAddress: 'Somewhere on campus', addressCountry: 'US' });
    expect(postalAddress([])).toBeUndefined();
  });

  it('describes the company from its content only', () => {
    const org = organizationLd({ site, locations, hq, logo: 'https://www.littlecharacters.org/apple-touch-icon.png' });
    expect(org['@type']).toEqual(['TheaterGroup', 'EducationalOrganization']);
    expect(org.location).toHaveLength(locations.length);
    expect(org.address?.postalCode).toBe('30606');
    expect(org.sameAs).toEqual(['https://instagram.com/example']);
    for (const key of ['geo', 'openingHours', 'priceRange', 'areaServed']) expect(org).not.toHaveProperty(key);
  });

  it('marks up each performance as an Event with the Athens offset', () => {
    const [e] = eventLd(event(), { site, location: hq, pageUrl });
    expect(e).toMatchObject({
      '@type': 'Event',
      name: 'Parents’ Night Out',
      startDate: '2026-11-14T17:00:00-05:00',
      endDate: '2026-11-14T20:00:00-05:00',
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: { '@type': 'Place', name: 'Little Characters HQ', address: { streetAddress: '1635 W Broad St' } },
      organizer: { '@type': 'Organization', name: site.name, url: site.url },
      offers: { '@type': 'Offer', price: 30, priceCurrency: 'USD', url: 'https://docs.google.com/forms/example' },
    });
    const two = eventLd(event({ times: [{ start: '2026-12-05T14:00', end: '2026-12-05T15:00' }, { start: '2026-12-05T18:00', end: '2026-12-05T19:00' }] }), { site, location: hq, pageUrl });
    expect(two.map((x) => x.startDate)).toEqual(['2026-12-05T14:00:00-05:00', '2026-12-05T18:00:00-05:00']);
  });

  it('leaves out an end it does not have, and offers it cannot read', () => {
    const [e] = eventLd(event({ times: [{ start: '2026-11-14T17:00', end: '' }], price: '$30 first child · $10 each additional' }), { site, location: hq, pageUrl });
    expect(e.startDate).toBe('2026-11-14T17:00:00-05:00');
    expect(e.endDate).toBeUndefined();
    expect(e.offers).toBeUndefined();
    expect(JSON.parse(jsonLd(e))).not.toHaveProperty('endDate');
  });

  it('skips events with no date yet, or no street address', () => {
    expect(eventLd(event({ times: [], tba: '2026-12' }), { site, location: hq, pageUrl })).toEqual([]);
    expect(eventLd(event({ locationId: undefined }), { site, pageUrl })).toEqual([]);
    expect(eventLd(event({ venue: 'State Botanical Garden of Georgia' }), { site, location: hq, pageUrl })).toEqual([]);
  });

  it('reads only plain prices', () => {
    expect(offerPrice('Free')).toBe(0);
    expect(offerPrice(' free ')).toBe(0);
    expect(offerPrice('$25')).toBe(25);
    expect(offerPrice('$12.50')).toBe(12.5);
    expect(offerPrice('Free · $10 at the door')).toBeUndefined();
    expect(offerPrice(undefined)).toBeUndefined();
  });

  it('marks classes, not camps or parties, as courses', () => {
    const kinds = new Set(programs.filter(isCourse).map((p) => p.kind));
    expect(kinds.has('camp')).toBe(false);
    expect(kinds.has('party')).toBe(false);
    expect(kinds.has('class')).toBe(true);
    const course = courseLd(programs[0], { site, url: 'https://www.littlecharacters.org/programs/x' });
    expect(course).toMatchObject({ '@type': 'Course', name: programs[0].title, description: programs[0].summary, provider: { name: site.name } });
  });

  it('builds a breadcrumb whose last step is the page itself', () => {
    const crumbs = breadcrumbLd([{ name: 'Find a class', url: 'https://x/programs' }, { name: 'Yes, And… Improv' }]);
    expect(crumbs.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Find a class', item: 'https://x/programs' },
      { '@type': 'ListItem', position: 2, name: 'Yes, And… Improv', item: undefined },
    ]);
  });
});

describe('share images', () => {
  it('reads focus points written like CSS', () => {
    expect(focusPoint('50% 30%')).toEqual({ x: 50, y: 30 });
    expect(focusPoint('center top')).toEqual({ x: 50, y: 0 });
    expect(focusPoint('top left')).toEqual({ x: 0, y: 0 });
    expect(focusPoint('bottom')).toEqual({ x: 50, y: 100 });
    expect(focusPoint('right')).toEqual({ x: 100, y: 50 });
    expect(focusPoint('nonsense')).toEqual({ x: 50, y: 50 });
    expect(focusPoint(undefined)).toEqual({ x: 50, y: 50 });
  });

  it('centers the crop on the focus point, top to bottom for tall photos and side to side for wide ones', () => {
    // A 3:4 photo covers the preview at 1200×1600, so the preview shows 630 of those 1600 pixels.
    expect(shareStop('50% 8%', 1536, 2048)).toBe(0);
    expect(shareStop('50% 30%', 1536, 2048)).toBe(20);
    expect(shareStop('50% 60%', 1536, 2048)).toBe(70);
    expect(shareStop('50% 97%', 1536, 2048)).toBe(100);
    expect(shareStop('90% 10%', 3000, 1000)).toBe(100);
    expect(shareStop('10% 90%', 3000, 1000)).toBe(0);
    expect(shareStop('20% 20%', 1200, 630)).toBe(50);
    expect(shareStop('20% 20%', 0, 0)).toBe(50);
  });

  it('finds the preview for built-in photos and uploads, and none for missing ones', () => {
    const uploads = new Map<string, UploadInfo>([['abc123def4', { width: 4000, height: 3000, widths: [360, 1280], alt: 'Uploaded alt' }]]);
    // (Built-in photo sizes come from the build, so the stop itself is checked against the built site.)
    expect(shareImage({ src: 'builtin:photos/film-green-screen-pirate', alt: 'A pirate', position: '50% 30%' }, uploads)).toEqual({
      src: expect.stringMatching(/^\/media\/share\/builtin\/photos\/film-green-screen-pirate\/\d+\.jpg$/),
      width: 1200,
      height: 630,
      alt: 'A pirate',
    });
    expect(shareImage({ src: 'media:abc123def4', alt: '' }, uploads)).toMatchObject({ src: '/media/share/abc123def4/50.jpg', alt: 'Uploaded alt' });
    expect(shareImage({ src: 'media:gone000000', alt: 'x' }, uploads)).toBeUndefined();
    expect(shareImage({ src: 'builtin:brand/logo-mark', alt: 'Logo' }, uploads)).toBeUndefined();
    expect(shareImage({ alt: 'x', placeholder: 'Photo coming' }, uploads)).toBeUndefined();
    expect(shareImage(undefined, uploads)).toBeUndefined();
  });

  it('makes a 1200×630 JPEG from any shape of photo', async () => {
    for (const [w, h] of [[600, 900], [3000, 1000], [100, 100]]) {
      const png = await sharp({ create: { width: w, height: h, channels: 3, background: '#7744aa' } }).png().toBuffer();
      const meta = await sharp(await makeShareImage(new Uint8Array(png), 75)).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', 1200, 630]);
    }
  });
});

describe('redirects from the old site', () => {
  it('sends old pages to their new homes', () => {
    expect(oldSiteRedirect('/classes-1')).toBe('/programs');
    expect(oldSiteRedirect('/classes')).toBe('/programs');
    expect(oldSiteRedirect('/classes1')).toBe('/programs');
    expect(oldSiteRedirect('/camp')).toBe('/camps');
    expect(oldSiteRedirect('/team')).toBe('/about/team');
    expect(oldSiteRedirect('/faqs')).toBe('/faq');
    expect(oldSiteRedirect('/giving-page')).toBe('/give');
    expect(oldSiteRedirect('/home')).toBe('/');
    expect(oldSiteRedirect('/FAQs/')).toBe('/faq');
  });
  it('sends the retired PDFs to the pages that replaced them, whatever the letter case', () => {
    expect(oldSiteRedirect('/s/Little-Characters-Parking-Instructions.pdf')).toBe('/contact#parking');
    expect(oldSiteRedirect('/s/little-characters-parking-instructions.PDF')).toBe('/contact#parking');
    expect(oldSiteRedirect('/s/Hannah-Eppling-Experience-and-Teaching-Philosophy-1.pdf')).toBe('/about');
    expect(oldSiteRedirect('/s/HANNAH-EPPLING-EXPERIENCE-AND-TEACHING-PHILOSOPHY-1.pdf')).toBe('/about');
    expect(oldSiteRedirect('/s/Some-Other-File.pdf')).toBeUndefined();
  });
  it('sends old event pages to /events, but not the calendar files', () => {
    expect(oldSiteRedirect('/events/parents-night-out')).toBe('/events');
    expect(oldSiteRedirect('/events/8uepmlluu1px9twdv3vksheyuwj1t6-kxpf3')).toBe('/events');
    expect(oldSiteRedirect('/events/parents-night-out-nov.ics')).toBeUndefined();
    expect(oldSiteRedirect('/events')).toBeUndefined();
    expect(oldSiteRedirect('/events/')).toBeUndefined();
  });
  it('leaves new pages alone', () => {
    for (const path of ['/', '/programs', '/programs/yes-and-improv', '/camps', '/about', '/faq', '/give', '/contact', '/geode', '/media/share/abc/50.jpg']) {
      expect(oldSiteRedirect(path)).toBeUndefined();
    }
  });
});
