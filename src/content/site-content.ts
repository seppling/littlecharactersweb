/**
 * Everything a page needs, built from the saved content entries: the lists in
 * editor order, lookups, the page text and the site settings. Pages get it as
 * `Astro.locals.content`; server code calls getContent() in src/server/content.ts.
 */
import { site as siteConfig } from '@/config/site';
import { PRICING } from '@/lib/pricing';
import { lateJoinWeeksOr } from '@/lib/session-dates';
import { SELF_LINK, type Field } from './fields';
import { pages as pageDefs } from './pages';
import { pages as seedPages } from './seed/pages';
import type { EventItem, Faq, Location, PageKey, Pages, Program, Session, SiteSettings, TeamMember, Testimonial } from './types';
import type { Vars } from './rich';
import type { UploadInfo } from '@/lib/media';

export interface ContentRow {
  collection: string;
  id: string;
  position: number;
  data: unknown;
}

export type WithId<T> = T & { id: string };

export type SiteInfo = typeof siteConfig & {
  description: string;
  contact: { email: string; phone: string; phoneHref: string; /** Hannah's reply-time line; empty means the site promises nothing. */ replyTime?: string };
  social: SiteSettings['social'];
  /** The donation form. Empty: the Give page offers an email instead. */
  givingUrl?: string;
  /** Hannah's line under "Give now" (tax-deductibility); empty shows nothing. */
  givingTaxNote?: string;
  wishListUrl?: string;
  /** Last day of Studio Director billing (YYYY-MM-DD), for the imported families' welcome note. */
  studioDirectorBillingEnds?: string;
  preview: boolean;
  announcement?: SiteSettings['announcement'];
  parking: SiteSettings['parking'];
  /** Weekly classes stop taking new students this many weeks before the last class. */
  lateJoinWeeks: number;
  /** Drop-ins to one class of a weekly class (src/server/drop-ins.ts): the price in cents, and whether families can book. */
  dropIns: { priceCents: number; open: boolean };
  /** Families' yearly statements: Hannah's tax ID and note, both optional (empty: left out). */
  statements: { taxId?: string; note?: string };
};

export interface SiteContent {
  programs: Program[];
  /** In the order they were entered; pages sort by date where it matters. */
  events: EventItem[];
  faqs: WithId<Faq>[];
  team: WithId<TeamMember>[];
  testimonials: WithId<Testimonial>[];
  locations: Location[];
  pages: Pages;
  site: SiteInfo;
  /** Uploaded photos, by id (see src/lib/media.ts). */
  uploads: Map<string, UploadInfo>;
  /** Placeholder values for editable text ({email}, {tuitionRange}…). */
  vars: Vars;
  programBySlug(slug: string): Program | undefined;
  locationById(id: string | undefined): Location | undefined;
  findSession(sessionId: string): { program: Program; session: Session } | undefined;
  testimonial(id: string | undefined): WithId<Testimonial> | undefined;
  faq(id: string): WithId<Faq> | undefined;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Required page fields added after a page was last saved are filled in from
 * the starting content, so new sections never show up blank. Optional fields
 * are left alone: an empty optional field means someone cleared it.
 */
export function withRequiredDefaults(fields: Field[], defaults: unknown, saved: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = isObject(saved) ? { ...saved } : {};
  const base = isObject(defaults) ? defaults : {};
  for (const f of fields) {
    if (out[f.key] === undefined) {
      if (f.required && base[f.key] !== undefined) out[f.key] = base[f.key];
    } else if (f.type === 'group' && isObject(out[f.key])) {
      out[f.key] = withRequiredDefaults(f.fields, base[f.key], out[f.key]);
    }
  }
  return out;
}

/**
 * A donation link on the old site's own address (www.littlecharacters.org/giving-page)
 * would loop back to /give once the domain moves here, so it counts as no link.
 */
export function offSiteLink(url: string | undefined) {
  const value = url?.trim();
  return value && !SELF_LINK.test(value) ? value : undefined;
}

/** The drop-in setting in cents. A price that isn't a sensible amount closes drop-ins rather than charging it. */
export function dropInSetting(value: SiteSettings['dropIns']): SiteInfo['dropIns'] {
  const price = value?.price;
  const ok = typeof price === 'number' && Number.isFinite(price) && price > 0 && price <= 1000;
  return { priceCents: ok ? Math.round(price * 100) : 0, open: ok && value?.open === true };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
/** Keep a phone number on one line. */
const nonBreaking = (phone: string) => phone.replace(/ /g, ' ').replace(/-/g, '‑');

export function buildSiteContent(rows: ContentRow[], uploads = new Map<string, UploadInfo>()): SiteContent {
  const byCollection = new Map<string, ContentRow[]>();
  for (const row of rows) {
    const list = byCollection.get(row.collection) ?? [];
    list.push(row);
    byCollection.set(row.collection, list);
  }
  const sorted = (collection: string) => (byCollection.get(collection) ?? []).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  // Programs, events and locations carry their own id (slug) in the data; the rest get the entry's id.
  const list = <T>(collection: string) => sorted(collection).map((r) => r.data as T);
  const withIds = <T>(collection: string) => sorted(collection).map((r) => ({ ...(r.data as T), id: r.id }));

  const programs = list<Program>('programs');
  const events = list<EventItem>('events');
  const locations = list<Location>('locations');
  const faqs = withIds<Faq>('faqs');
  const team = withIds<TeamMember>('team');
  const testimonials = withIds<Testimonial>('testimonials');

  const savedPages = new Map((byCollection.get('pages') ?? []).map((r) => [r.id, r.data]));
  const pages = Object.fromEntries(
    (Object.keys(pageDefs) as PageKey[]).map((key) => [key, withRequiredDefaults(pageDefs[key].fields, seedPages[key], savedPages.get(key) ?? seedPages[key])]),
  ) as unknown as Pages;

  const settings = pages.site;
  const site: SiteInfo = {
    ...siteConfig,
    description: settings.description,
    contact: {
      email: settings.contact.email,
      phone: settings.contact.phone,
      phoneHref: `tel:+1${settings.contact.phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')}`,
      replyTime: settings.contact.replyTime?.trim() || undefined,
    },
    social: settings.social ?? {},
    givingUrl: offSiteLink(settings.links?.giving),
    givingTaxNote: settings.links?.taxNote?.trim() || undefined,
    wishListUrl: settings.links?.wishList,
    studioDirectorBillingEnds: settings.studioDirector?.billingEnds || undefined,
    preview: !!settings.previewBanner,
    announcement: settings.announcement,
    parking: settings.parking,
    lateJoinWeeks: lateJoinWeeksOr(settings.signups?.lateJoinWeeks),
    dropIns: dropInSetting(settings.dropIns),
    statements: { taxId: settings.statements?.taxId?.trim() || undefined, note: settings.statements?.note?.trim() || undefined },
  };

  const programBySlug = (slug: string) => programs.find((p) => p.slug === slug);
  const locationById = (id: string | undefined) => (id ? locations.find((l) => l.id === id) : undefined);
  const hq = locationById('hq') ?? locations[0];

  const monthly = programs
    .filter((p) => p.brand === 'lc' && p.kind === 'class')
    .flatMap((p) => [p.priceFrom, ...p.sessions.map((s) => s.price)])
    .filter((price) => price?.unit === 'month')
    .map((price) => price!.amount);
  const campDay = programBySlug('summer-camp')?.priceFrom?.amount;
  const lead = team[0];

  const vars: Vars = {
    name: site.name,
    shortName: site.shortName,
    founded: site.founded,
    founder: site.founder,
    founderRole: lead?.role
      .toLowerCase()
      .replace(/ \+ /g, ', ')
      .replace(/, (?=[^,]*$)/, ' and '),
    email: site.contact.email,
    phone: nonBreaking(site.contact.phone),
    phoneHref: site.contact.phoneHref,
    instagram: site.social.instagram,
    facebook: site.social.facebook,
    giving: site.givingUrl,
    wishList: site.wishListUrl,
    website: site.url,
    siteHost: new URL(site.url).hostname.replace(/^www\./, ''),
    hqAddress: hq?.address.join(', '),
    hqMap: hq?.mapUrl,
    tuitionRange: monthly.length ? `$${Math.min(...monthly)}–$${Math.max(...monthly)} a month` : undefined,
    campDay: campDay ? `$${campDay}` : undefined,
    payInFullDiscount: pct(PRICING.payInFullDiscount),
    multiDiscount: pct(PRICING.multiDiscount),
    teamSize: team.length,
  };

  return {
    programs,
    events,
    faqs,
    team,
    testimonials,
    locations,
    pages,
    site,
    uploads,
    vars,
    programBySlug,
    locationById,
    findSession(sessionId) {
      for (const program of programs) {
        const session = program.sessions.find((s) => s.id === sessionId);
        if (session) return { program, session };
      }
      return undefined;
    },
    testimonial: (id) => (id ? testimonials.find((t) => t.id === id) : undefined),
    faq: (id) => faqs.find((f) => f.id === id),
  };
}
