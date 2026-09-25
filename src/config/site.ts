/**
 * Site-wide settings. Anything Hannah might need to change without touching
 * page code lives here or in src/data/.
 */
export const site = {
  name: 'Little Characters Theater Troupe',
  shortName: 'Little Characters',
  tagline: 'Every person has a story worth telling.',
  description:
    'Theater classes, camps, workshops and shows for ages 4 to 100 in Athens and Winterville, Georgia.',
  url: 'https://www.littlecharacters.org',
  founded: 2022,

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
    mode: 'studio-director' as 'studio-director' | 'native',
    // TODO(hannah): paste the real Studio Director portal links.
    studioDirector: {
      login: 'https://app.thestudiodirector.com/littlecharacters/portal.sd?page=Login',
      enroll: 'https://app.thestudiodirector.com/littlecharacters/portal.sd?page=Enroll',
    },
    native: {
      login: '/account',
      enroll: '/enroll',
    },
  },

  forms: {
    // TODO: point at a form handler (Netlify Forms, Formspree, or the Phase 2 API).
    contactAction: '',
    newsletterAction: '',
  },

  givingUrl: 'https://www.littlecharacters.org/giving-page',
} as const;

export const nav = [
  { label: 'Classes', href: '/programs?kind=class' },
  { label: 'Camps', href: '/camps' },
  { label: 'Shows & Events', href: '/events' },
  { label: 'About', href: '/about' },
  { label: 'Geode', href: '/geode', note: 'Teens & adults' },
] as const;
