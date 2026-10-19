/**
 * Site-wide settings that are part of the code. Contact details, social
 * links, the announcement bar and other things Hannah changes are edited at
 * /admin/content/pages/site; pages read the combined settings from
 * `Astro.locals.content.site`.
 */
export const site = {
  name: 'Little Characters Theater Troupe',
  shortName: 'Little Characters',
  url: 'https://www.littlecharacters.org',
  founded: 2022,
  founder: 'Hannah Eppling',

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
} as const;

/**
 * The top menu. An item with `children` is a dropdown (a list of links on phones).
 * Parents' Night Out and Parties sit under Shows & Events because that's where
 * parents looked for them; Parking sits under About next to the FAQ. Give is a
 * quieter link beside the account link (SiteHeader.astro), and in the phone menu.
 */
export const nav: { label: string; href: string; note?: string; children?: { label: string; href: string }[] }[] = [
  { label: 'Classes', href: '/programs?kind=class' },
  { label: 'Camps', href: '/camps' },
  {
    label: 'Shows & Events',
    href: '/events',
    children: [
      { label: 'Shows & events', href: '/events' },
      { label: 'Parents’ Night Out', href: '/programs/parents-night-out' },
      { label: 'Parties', href: '/programs/parties' },
    ],
  },
  {
    label: 'About',
    href: '/about',
    children: [
      { label: 'Our story', href: '/about' },
      { label: 'Team', href: '/about/team' },
      { label: 'Schools & partners', href: '/about/schools' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Parking & drop-off', href: '/contact#parking' },
    ],
  },
  { label: 'Geode', href: '/geode', note: 'Teens & adults' },
  { label: 'Contact', href: '/contact' },
];

/** Links that live outside the dropdowns: Give beside the account link, and in the phone menu. */
export const giveLink = { label: 'Give', href: '/give' };
