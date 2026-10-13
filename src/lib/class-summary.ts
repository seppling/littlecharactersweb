/**
 * The top of a class page: what the summary says about when a class meets,
 * and what the "Choose a time" card still needs to say about each session.
 * The summary carries what every session has in common; the card carries
 * only what tells the sessions apart.
 */
import type { Session } from '@/content/types';
import { dateRange, dayList, price, timeRange } from '@/lib/format';

/** More lines than this and the summary points to the card instead. */
export const MAX_WHEN_LINES = 3;

const oneDay = (s: Session) => s.startDate === s.endDate;
const dateOf = (s: Session) => s.label ?? dateRange(s.startDate, s.startDate);
const weekly = (s: Session) => `${dayList(s.days)}, ${timeRange(s.start, s.end)}`;

export interface WhenSummary {
  /** One line per distinct day and time ("Tuesdays, 5:15–6:15 pm"). */
  lines: string[];
  /** True when the lines are a shortened form and the card has the full list. */
  seeAll: boolean;
  /** What the link to the card says when seeAll is true. */
  seeAllLabel: string;
}

/** The day and time for the summary, from the sessions families can pick. */
export function whenSummary(sessions: Session[]): WhenSummary | undefined {
  if (sessions.length === 0) return undefined;
  const lines = [...new Set(sessions.map((s) => (oneDay(s) ? `${dateOf(s)}, ${timeRange(s.start, s.end)}` : weekly(s))))];
  if (lines.length <= MAX_WHEN_LINES) return { lines, seeAll: false, seeAllLabel: '' };
  const allDated = sessions.every(oneDay);
  const times = [...new Set(sessions.map((s) => timeRange(s.start, s.end)))];
  if (allDated && times.length === 1) {
    return { lines: [`${times[0]} on ${sessions.length} dates`], seeAll: true, seeAllLabel: 'See the dates below' };
  }
  return { lines: [], seeAll: true, seeAllLabel: 'See times below' };
}

export interface CardParts {
  /** Show each session's days and time (they aren't the same for all). */
  time: boolean;
  /** Show each session's place (there's more than one). */
  place: boolean;
  /** Show each session's price (they aren't the same for all). */
  price: boolean;
}

export const sessionPrice = (s: Session) => (s.price ? price(s.price) : s.externalUrl ? 'Via school' : 'Pricing TBA');

/** Which details the card repeats for each session: only those that differ. */
export function cardParts(sessions: Session[]): CardParts {
  const differ = (f: (s: Session) => string) => new Set(sessions.map(f)).size > 1;
  return {
    time: differ((s) => (oneDay(s) ? timeRange(s.start, s.end) : weekly(s))),
    place: differ((s) => s.locationId),
    price: differ(sessionPrice),
  };
}

/** The two lines that name one session on the card. */
export function sessionLines(s: Session, parts: CardParts, placeName?: string) {
  const extra = [parts.place ? placeName : undefined].filter(Boolean);
  if (oneDay(s)) {
    const title = parts.time ? `${dateOf(s)} · ${timeRange(s.start, s.end)}` : dateOf(s);
    return { title, meta: extra.join(' · ') };
  }
  const title = parts.time ? `${s.label ?? dayList(s.days)} · ${timeRange(s.start, s.end)}` : s.label ?? s.term;
  return { title, meta: [dateRange(s.startDate, s.endDate), ...extra].join(' · ') };
}

/**
 * "Performance" when the showcase text clearly describes one show, otherwise
 * "Performances" (several, or unclear).
 */
export function performanceLabel(showcase: string) {
  const several =
    /\b(performances|shows|showcases|productions|screenings)\b/i.test(showcase) ||
    /\b(and|then|plus)\b[^.]*\b(show|showcase|performance|production)\b/i.test(showcase);
  const one = /\ba\b[^.]*?\b(performance|show|showcase|production)\b/i.test(showcase);
  return one && !several ? 'Performance' : 'Performances';
}
