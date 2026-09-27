/**
 * Content model for the marketing site.
 *
 * These shapes intentionally mirror what the Phase 2 portal database will hold
 * (programs → sessions → enrollments), so the catalog can later be read from
 * the portal API instead of these files without changing the page templates.
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
  ages: { min: number; max: number | null };
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
  /** An imported asset (optimized at build time) or a public URL. */
  src?: ImageMetadata | string;
  alt: string;
  /** CSS object-position, for photos whose subject isn't centered. */
  position?: string;
  /** Shown in place of the photo until a real one is dropped into public/images. */
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
