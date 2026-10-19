/**
 * The home page's "On the call sheet" cards, minus anything already over.
 * A card goes once its own "take down after" date has passed, or once what it
 * links to has happened: an event that's over (the same rule as /events), or
 * a class with no dates left to sign up for (the same rule as the class page).
 * A card whose link points to an event or class that doesn't exist goes too,
 * so no card leads nowhere.
 */
import { isUpcoming } from '@/content/catalog';
import type { EventItem, Program } from '@/content/types';
import { offeredSessions, type BookingClock } from '@/lib/session-dates';

export interface CallSheetItem {
  when: string;
  title: string;
  text?: string;
  href?: string;
  /** "YYYY-MM-DD": the card comes down the day after. */
  until?: string;
}

interface Ctx {
  /** Athens date, "YYYY-MM-DD". */
  today: string;
  events: EventItem[];
  programBySlug: (slug: string) => Program | undefined;
  clock: BookingClock;
}

/** Whether a card's link still leads somewhere current. Links outside events and class pages always do. */
export function linkIsCurrent(href: string | undefined, { today, events, programBySlug, clock }: Ctx) {
  const path = href?.startsWith('/') ? href : undefined;
  if (!path) return true;
  const event = /^\/events(?:\/|#)([\w-]+)$/.exec(path)?.[1];
  if (event !== undefined) {
    const e = events.find((x) => x.slug === event);
    return !!e && isUpcoming(e, today);
  }
  const program = /^\/programs\/([\w-]+)(?:[#?].*)?$/.exec(path)?.[1];
  if (program !== undefined) {
    const p = programBySlug(program);
    if (!p) return false;
    return p.sessions.length === 0 || p.notify || !!p.requestCta || offeredSessions(p, clock).length > 0;
  }
  return true;
}

export function liveCallSheet<T extends CallSheetItem>(items: T[], ctx: Ctx) {
  return items.filter((item) => !(item.until && item.until < ctx.today) && linkIsCurrent(item.href, ctx));
}
