/**
 * Fixed vocabulary for the catalog: what each kind of program is called, the
 * "focus" filter, age bands, colors and so on. These are part of the site's
 * design and code, not editable content.
 */
import type { Brand, CharacterName, EventItem, Faq, Focus, Gel, Program, Session, Weekday } from './types';

export const kindLabels: Record<Program['kind'], { singular: string; plural: string }> = {
  class: { singular: 'Weekly class', plural: 'Weekly classes' },
  camp: { singular: 'Camp', plural: 'Camps & workshops' },
  workshop: { singular: 'Free class', plural: 'Free classes' },
  lesson: { singular: 'Private lessons', plural: 'Private lessons' },
  inclusive: { singular: 'Adaptive class', plural: 'Adaptive classes' },
  party: { singular: 'Parties & nights out', plural: 'Parties & nights out' },
};

export const focusLabels: Record<Focus, string> = {
  acting: 'Acting',
  improv: 'Improv',
  produce: 'Produce a show',
  tech: 'Tech & design',
  film: 'Film',
  writing: 'Writing',
  music: 'Singing & musicals',
};

/** Age bands used by the age picker and finder. */
export const ageBands = [
  { id: '4-6', label: '4–6', min: 4, max: 6 },
  { id: '7-10', label: '7–10', min: 7, max: 10 },
  { id: '11-13', label: '11–13', min: 11, max: 13 },
  { id: '14-17', label: '14–17', min: 14, max: 17 },
  { id: 'adult', label: 'Adults', min: 18, max: 120 },
] as const;

export const brandLabels: Record<Brand, string> = {
  lc: 'Little Characters',
  geode: 'Geode (tweens, teens & adults)',
};

export const gelLabels: Record<Gel, string> = {
  red: 'Red',
  orange: 'Orange',
  teal: 'Teal',
  yellow: 'Yellow',
  purple: 'Purple (Geode)',
};

export const characterLabels: Record<CharacterName, string> = {
  royal: 'The Royal',
  magician: 'The Magician',
  artist: 'The Artist',
  professor: 'The Professor',
  dancer: 'The Dancer',
  stagehand: 'The Stagehand',
};

export const weekdays: Weekday[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const statusLabels: Record<Session['status'], string> = {
  open: 'Open',
  'few-left': 'Open, few spots left',
  waitlist: 'Full: waitlist only',
  'coming-soon': 'Coming soon',
  closed: 'Closed',
};

export const eventKindLabels: Record<EventItem['kind'], string> = {
  show: 'Show',
  community: 'Community event',
  'drop-off': 'Drop-off night',
  inclusive: 'Adaptive / inclusive',
  geode: 'Geode',
};

export const faqGroups: Faq['group'][] = ['Getting started', 'Classes', 'Payments & discounts', 'Performances', 'Camps & parties', 'Supporting LC'];

/** Events with a real date, in order; undated ones (tba) sort by their month, then ones with no month at all. */
export const sortKey = (e: EventItem) => e.times[0]?.start ?? (e.tba ? `${e.tba}-99` : '9999');

/**
 * Still to come on `today` (YYYY-MM-DD): its last performance is today or
 * later, or it's undated and expected this month or later. Past events drop
 * off the site on their own.
 */
export function isUpcoming(e: EventItem, today: string) {
  const last = e.times.map((t) => t.end || t.start).sort().at(-1);
  if (last) return last.slice(0, 10) >= today;
  return !e.tba || e.tba >= today.slice(0, 7);
}

export const options = <K extends string>(labels: Record<K, string>) =>
  (Object.entries(labels) as [K, string][]).map(([value, label]) => ({ value, label }));
