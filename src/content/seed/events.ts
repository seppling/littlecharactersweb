import type { EventItem } from '../types';

/*
 * Upcoming shows and events, from the live site's events calendar and the
 * Fall 2026 classes page (captured Sep 25, 2026).
 */
// Nights that are also class dates (programSlug) are booked through that
// class's own sign-up for the same date; the button below is only used if
// that date is removed from the class (see eventAction in src/lib/events.ts).

const pno = (slug: string, date: string): EventItem => ({
  slug,
  title: 'Parents’ Night Out',
  kind: 'drop-off',
  brand: 'lc',
  gel: 'red',
  times: [{ start: `${date}T17:00`, end: `${date}T20:00` }],
  locationId: 'hq',
  summary: 'Drop your kiddo(s) off for games, theater activities and new friends while you enjoy an evening to yourself.',
  price: '$30 first child · $10 each additional',
  cta: { label: 'Details', href: '/programs/parents-night-out' },
  programSlug: 'parents-night-out',
});

const improvNight = (slug: string, date: string): EventItem => ({
  slug,
  title: 'Third Thursday Improv Night',
  kind: 'geode',
  brand: 'geode',
  gel: 'purple',
  times: [{ start: `${date}T18:30`, end: `${date}T20:30` }],
  locationId: 'hq',
  summary: 'Group and partner improv games for grown-ups. Play as little or as much as you like; BYOB with a 21+ ID.',
  ages: '18+',
  price: '$25',
  cta: { label: 'Details', href: '/programs/geode-adult-improv' },
  programSlug: 'geode-adult-improv',
});

const freeClass = (slug: string, start: string, end: string): EventItem => ({
  slug,
  title: 'Free Community Theater Class',
  kind: 'community',
  brand: 'lc',
  gel: 'yellow',
  times: [{ start, end }],
  locationId: 'hq',
  summary: 'Our monthly free class, open to all ages, with a different teacher each month.',
  price: 'Free',
  cta: { label: 'Details', href: '/programs/free-community-class' },
  programSlug: 'free-community-class',
});

export const events: EventItem[] = [
  pno('parents-night-out-sep', '2026-09-25'),
  {
    slug: 'jack-and-the-beanstalk',
    title: 'Jack and the Beanstalk',
    kind: 'show',
    brand: 'lc',
    gel: 'orange',
    times: [{ start: '2026-09-27T13:30', end: '2026-09-27T14:00' }],
    venue: 'Theater in the Woods, State Botanical Garden of Georgia',
    summary:
      'Our Performance Troupe performs at the Botanical Garden’s Insectival Festival, on the Theater in the Woods stage in the children’s garden. Get there a little early for a good seat!',
    price: 'Festival entry $5/person, $20/family · no extra cost for the show',
    cta: { label: 'Festival info', href: 'https://botgarden.uga.edu/event/35th-annual-insectival/' },
  },
  freeClass('free-class-oct', '2026-10-15T16:15', '2026-10-15T17:15'),
  improvNight('improv-night-oct', '2026-10-15'),
  pno('parents-night-out-oct', '2026-10-24'),
  freeClass('free-class-nov', '2026-11-02T16:00', '2026-11-02T17:00'),
  pno('parents-night-out-nov', '2026-11-14'),
  improvNight('improv-night-nov', '2026-11-19'),
  {
    slug: 'fall-variety-show',
    title: 'Fall 2026 Variety Show',
    kind: 'show',
    brand: 'lc',
    gel: 'purple',
    times: [],
    tba: '2026-12',
    summary:
      'Our twice-a-year Variety Show, with performances from this fall’s classes, including Stories and Songs and Geode’s Acting Studio. Each enrolled student gets 2 free tickets.',
    // The classes whose pages say they perform at the Variety Show.
    performers: ['stories-and-songs', 'geode-acting-studio', 'film-creation'],
  },
  improvNight('improv-night-dec', '2026-12-17'),
  pno('parents-night-out-dec', '2026-12-19'),
];
