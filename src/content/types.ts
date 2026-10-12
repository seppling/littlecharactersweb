/**
 * Content model for the site: classes, events, FAQs, team, testimonials,
 * locations and the editable page text.
 *
 * The content itself lives in the database and is edited at /admin/content.
 * src/content/seed/ holds the starting content that fills an empty database.
 * Enrollments point at each session's stable `id`, so ids never change once a
 * session is published.
 */

export type ProgramKind = 'class' | 'camp' | 'workshop' | 'lesson' | 'inclusive' | 'party';

export type Brand = 'lc' | 'geode';

/** Colors from the stage-lighting "gel" palette; see src/styles/tokens.css. */
export type Gel = 'red' | 'orange' | 'teal' | 'yellow' | 'purple';

/** The illustrated cast; see src/components/Character.astro. */
export type CharacterName = 'royal' | 'magician' | 'artist' | 'professor' | 'dancer' | 'stagehand';

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type PriceUnit = 'month' | 'week' | 'day' | 'class' | 'session' | 'hour' | 'child';

export interface Price {
  amount: number;
  unit: PriceUnit;
  note?: string;
  /** For per-child pricing: the price for each additional child in the same family. */
  additional?: number;
}

/** One-time fees on top of tuition (performance fee, materials fee). */
export interface Fee {
  amount: number;
  label: string;
}

export interface Session {
  /** Stable id; becomes the enrollment key in Phase 2. */
  id: string;
  term: string;
  label?: string;
  days: Weekday[];
  /** 24h "HH:MM" local time. */
  start: string;
  end: string;
  /** ISO dates (YYYY-MM-DD). */
  startDate: string;
  endDate: string;
  locationId: string;
  /** Omit when the price hasn't been set yet ("Pricing TBA"). */
  price?: Price;
  capacity?: number;
  spotsLeft?: number;
  status: 'open' | 'few-left' | 'waitlist' | 'coming-soon' | 'closed';
  teacher?: string;
  /** Registration handled by a partner (e.g. a school's own system). */
  externalUrl?: string;
  externalLabel?: string;
}

/** What students actually do, for the "What they’ll do" filter in the class finder. */
export type Focus = 'acting' | 'improv' | 'produce' | 'tech' | 'film' | 'writing' | 'music';

export interface Program {
  slug: string;
  title: string;
  kind: ProgramKind;
  /** Disciplines, most prominent first. Leave empty for parties and nights out. */
  focus?: Focus[];
  brand: Brand;
  gel: Gel;
  /** No max = "and up". */
  ages: { min: number; max?: number };
  /** Shown instead of the computed range, e.g. "Ages 7+" for an open-ended youth class. */
  agesLabel?: string;
  tagline: string;
  summary: string;
  description: string[];
  highlights: string[];
  /** One line about how the class ends — families always ask. */
  showcase?: string;
  duration?: string;
  priceFrom?: Price;
  fee?: Fee;
  /** Who's teaching this term. */
  teachers?: string[];
  /** When a class runs longer than the term, e.g. "August – March". */
  runs?: string;
  /** Who it's for beyond age, e.g. prior experience. */
  prerequisite?: string;
  image?: ImageRef;
  sessions: Session[];
  /** For programs booked by request (lessons, parties) instead of by session. */
  requestCta?: { label: string; href: string };
  /** No dates yet: show a "tell me when" signup instead of sessions. */
  notify?: boolean;
  featured?: boolean;
}

export interface ImageRef {
  /**
   * A photo from the library: "builtin:<folder>/<name>" for photos that ship
   * with the site (src/assets), or "media:<id>" for photos uploaded in the editor.
   */
  src?: string;
  alt: string;
  /** CSS object-position, for photos whose subject isn't centered. */
  position?: string;
  /** Shown in place of the photo until a real one is chosen. */
  placeholder?: string;
}

export interface Location {
  id: string;
  name: string;
  shortName: string;
  address: string[];
  mapUrl: string;
  notes?: string;
  usedFor?: string;
}

export interface EventItem {
  slug: string;
  title: string;
  kind: 'show' | 'community' | 'drop-off' | 'inclusive' | 'geode';
  brand: Brand;
  gel: Gel;
  /** ISO local datetimes, one per performance/occurrence. Empty when the date isn't set yet. */
  times: { start: string; end: string }[];
  /** For undated events: "YYYY-MM" of the expected month. */
  tba?: string;
  locationId?: string;
  venue?: string;
  summary: string;
  price?: string;
  cta?: { label: string; href: string };
  ages?: string;
}

export interface TeamMember {
  name: string;
  role: string;
  /** Short line for cards; the full bio shows on the About page. */
  intro?: string;
  bio: string[];
  gel: Gel;
  image?: ImageRef;
}

export interface Faq {
  q: string;
  a: string;
  group: 'Getting started' | 'Classes' | 'Payments & discounts' | 'Performances' | 'Camps & parties' | 'Supporting LC';
}

export interface Testimonial {
  quote: string;
  attribution: string;
}

// ───────────── Page text ─────────────
// Edited at /admin/content/pages/<key>. Text fields can include links written
// [like this](/contact) and **bold**; see src/content/rich.ts.

export interface Link {
  label: string;
  href: string;
}

/** The small label, heading and intro that start most sections. */
export interface SectionHead {
  eyebrow?: string;
  heading: string;
  lede?: string;
}

/** What search engines show. Empty = the page's built-in title and description. */
export interface Seo {
  title?: string;
  description?: string;
}

export interface SiteSettings {
  announcement?: { show?: boolean; text?: string; link?: Link; gel?: Gel };
  contact: { email: string; phone: string };
  social: { instagram?: string; facebook?: string };
  links: { giving?: string; wishList?: string };
  parking: { walkIn: string; dropOff: string; staffOnly: string; late: string; guideUrl?: string };
  description: string;
  previewBanner?: boolean;
}

export interface HomePage {
  seo?: Seo;
  hero: { eyebrow?: string; headline: string; intro: string; promises: string[]; photo?: ImageRef };
  callSheet: { heading: string; items: { when: string; title: string; text?: string; href?: string; gel: Gel }[] };
  trial: { eyebrow?: string; heading: string; body: string; button: string; steps: { title: string; text: string }[] };
  pathway: SectionHead & { steps: { age: string; title: string; character: CharacterName; gel: Gel; programs: string[] }[] };
  approach: SectionHead & { steps: { title: string; body: string; gel: Gel; photo?: ImageRef }[] };
  featured: { eyebrow?: string; heading: string };
  why: { eyebrow?: string; heading: string; facts: { big: string; text: string; gel: Gel }[]; testimonial?: string };
  extras: { heading: string; items: { title: string; body: string; href: string; character: CharacterName; geode?: boolean }[] };
  shows: { eyebrow?: string; heading: string };
  story: { eyebrow?: string; heading: string; paragraphs: string[]; photo?: ImageRef };
  visit: { eyebrow?: string; heading: string };
  give: { heading: string; body: string };
  signup: { heading: string; body: string };
}

export interface AboutPage {
  seo?: Seo;
  hero: { eyebrow?: string; headline: string; summary: string; story: string[]; photo?: ImageRef };
  services: SectionHead & { items: { title: string; body: string; link: Link; gel: Gel }[] };
  differences: SectionHead & { photo?: ImageRef; items: { title: string; body: string }[] };
  audiences: SectionHead & { items: { label: string; body: string; gel: Gel; programs?: string[]; links?: Link[] }[] };
  beliefs: SectionHead & { valuesHeading: string; values: { title: string; body: string; gel: Gel }[] };
  team: SectionHead & { social?: string; quote?: string; hiring?: string };
  schools: SectionHead & { body: string; quote?: string };
  how: SectionHead & { notes: { title: string; body: string }[] };
  facts: SectionHead & { items: { label: string; text: string }[] };
  faq: { heading: string; questions: string[] };
}

export interface CampsPage {
  seo?: Seo;
  hero: { eyebrow?: string; headline: string; intro: string; facts: { label: string; value: string }[]; summerButton: string; miniButton: string; photo?: ImageRef };
  summer: {
    openTape: string;
    openHeading: string;
    openLede: string;
    soonTape: string;
    soonHeading: string;
    formats: { title: string; body: string; gel: Gel }[];
    notifyHeading: string;
    notifyBody: string;
    notifyNote?: string;
  };
  mini: SectionHead & { recentHeading: string; recent: { when: string; title: string; gel: Gel }[] };
  day: SectionHead & { steps: { time: string; what: string; detail: string }[] };
  faq: { heading: string };
}

export interface GeodePage {
  seo?: Seo;
  hero: { eyebrow?: string; headline: string; line: string; intro: string; classesButton: string; improvButton: string };
  growing: { heading: string; paragraphs: string[] };
  classes: { heading: string; note?: string };
  improv: SectionHead;
  past: { heading: string; items: { caption: string; photo?: ImageRef }[] };
}

export interface GivePage {
  seo?: Seo;
  hero: { eyebrow?: string; headline: string; intro: string; giveButton: string; scholarshipButton: string };
  impact: { heading: string; items: { amount: string; what: string; gel: Gel }[] };
  ways: { heading: string; items: { title: string; body: string; link: Link }[] };
  scholarship: { heading: string; body: string };
}

export interface ContactPage {
  seo?: Seo;
  hero: { eyebrow?: string; headline: string; intro: string };
  parking: { eyebrow?: string; heading: string };
}

export interface SimplePage {
  seo?: Seo;
  hero: { eyebrow?: string; headline: string; intro: string };
}

export interface EventsPage extends SimplePage {
  perform: { heading: string; body: string; button: string };
}

export interface Pages {
  site: SiteSettings;
  home: HomePage;
  about: AboutPage;
  camps: CampsPage;
  geode: GeodePage;
  give: GivePage;
  contact: ContactPage;
  faq: SimplePage;
  classes: SimplePage;
  events: EventsPage;
}
export type PageKey = keyof Pages;
