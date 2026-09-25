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
export type Gel = 'magenta' | 'amber' | 'cyan' | 'green' | 'lilac';

/** The illustrated cast; see src/components/Character.astro. */
export type CharacterName = 'royal' | 'magician' | 'artist' | 'professor' | 'dancer';

export type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type PriceUnit = 'month' | 'week' | 'day' | 'class' | 'session' | 'hour';

export interface Price {
  amount: number;
  unit: PriceUnit;
  note?: string;
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

export interface Program {
  slug: string;
  title: string;
  kind: ProgramKind;
  brand: Brand;
  gel: Gel;
  ages: { min: number; max: number | null };
  tagline: string;
  summary: string;
  description: string[];
  highlights: string[];
  /** One line about how the class ends — families always ask. */
  showcase?: string;
  duration?: string;
  priceFrom?: Price;
  image?: ImageRef;
  sessions: Session[];
  /** For programs booked by request (lessons, parties) instead of by session. */
  requestCta?: { label: string; href: string };
  featured?: boolean;
}

export interface ImageRef {
  src?: string;
  alt: string;
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
  /** ISO local datetimes, one per performance/occurrence. */
  times: { start: string; end: string }[];
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
  bio: string[];
  gel: Gel;
  image?: ImageRef;
}

export interface Faq {
  q: string;
  a: string;
  group: 'Getting started' | 'Classes' | 'Camps' | 'Payments & discounts' | 'Performances';
}
