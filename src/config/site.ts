/**
 * Site-wide settings. Anything Hannah might need to change without touching
 * page code lives here or in src/data/.
 */
export const site = {
  name: 'Little Characters Theater Troupe',
  shortName: 'Little Characters',
  tagline: 'Every person has a story worth telling.',
  description:
    'Theater classes, camps, workshops and shows for ages 4 to 100 in Athens, Georgia. Encouraging creative hearts through theater since 2022.',
  url: 'https://www.littlecharacters.org',
  founded: 2022,
  founder: 'Hannah Eppling',

  contact: {
    email: 'littlecharacterstheater@gmail.com',
    phone: '(281) 798-2623',
    phoneHref: 'tel:+12817982623',
  },

  social: {
    instagram: 'https://www.instagram.com/littlecharactersathens/',
    facebook: 'https://www.facebook.com/littlecharactersathens/',
  },

  /**
   * While true, a slim banner explains that schedules and prices on this build
   * are placeholders. Flip to false once src/data/ has been checked by Hannah.
   */
  preview: true,

  /**
   * Enrollment + account entry points.
   *
   * Phase 1 hands families off to Studio Director. Phase 2 swaps `mode` to
   * 'native' and every "Enroll" / "Log in" button on the site starts pointing
   * at our own /enroll and /account routes; no page templates change.
   */
  portal: {
    // 'native' = our own family portal (/enroll, /account). Switch back to
    // 'studio-director' to send families to Studio Director instead.
    mode: 'native' as 'studio-director' | 'native',
    // The live MyStudioDirector portal, as linked from the current Fall 2026 classes page.
    studioDirector: {
      login: 'https://app.thestudiodirector.com/littlecharacterstheater/portal.sd',
      enroll: 'https://app.thestudiodirector.com/littlecharacterstheater/portal.sd?page=Enroll',
    },
    native: {
      login: '/account',
      enroll: '/enroll',
    },
  },

  // TODO: the current giving page has no payment form yet; point this at a real donation link.
  givingUrl: 'https://www.littlecharacters.org/giving-page',
  wishListUrl: 'https://a.co/510Gges',
  mapUrl: 'https://maps.app.goo.gl/2sAZXSFJ3HkdCYsn9',
} as const;

export const nav = [
  { label: 'Classes', href: '/programs?kind=class' },
  { label: 'Camps', href: '/camps' },
  { label: 'Shows & Events', href: '/events' },
  { label: 'About', href: '/about' },
  { label: 'Geode', href: '/geode', note: 'Teens & adults' },
] as const;
