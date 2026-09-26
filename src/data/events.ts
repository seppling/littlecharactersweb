import type { EventItem } from './types';

/*
 * Upcoming shows and events, from the live site's events calendar and the
 * Fall 2026 classes page (captured Sep 25, 2026).
 */
const PNO_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSceXu5NWca5TztIjA44qk9WdC4FWK77re6xsBDdUg9uuAFz7w/viewform';
const ADULT_IMPROV_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSdtbKfY86bY81dHuNwBVomyLUmm7LbEXpPS9NCg-gpXEKIHXA/viewform';

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
  cta: { label: 'Register', href: PNO_FORM },
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
  cta: { label: 'Register', href: ADULT_IMPROV_FORM },
});

const freeClass = (slug: string, start: string, end: string): EventItem => ({
  slug,
  title: 'Free Community Theater Class',
  kind: 'community',
  brand: 'lc',
  gel: 'yellow',
  times: [{ start, end }],
  locationId: 'hq',
  summary: 'Our monthly free class, open to all ages, with a different teacher each month. Registration opens soon.',
  price: 'Free',
  cta: { label: 'Details', href: '/programs/free-community-class' },
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
    price: 'Date and tickets coming soon',
  },
  improvNight('improv-night-dec', '2026-12-17'),
  pno('parents-night-out-dec', '2026-12-19'),
];

/** Events with a real date, in order; undated ones (tba) sort by their month. */
export const sortKey = (e: EventItem) => e.times[0]?.start ?? `${e.tba}-99`;

export const eventBySlug = (slug: string) => events.find((e) => e.slug === slug);
