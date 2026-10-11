/** Wording drafts: Shows and events. Format: docs/seo/drafts.md. */
import type { CollectionDraft, Edit } from './format';

// Repeating events keep one summary each, so every date reads the same.
const PNO_SUMMARY: Edit = {
  path: 'summary',
  from: 'Drop your kiddo(s) off for games, theater activities and new friends while you enjoy an evening to yourself.',
  to: 'Drop your kiddo(s), ages 4–12, off at our W Broad St space in Athens for games, theater activities and new friends while you enjoy an evening to yourself.',
  why: 'Gives the ages and the place in the text, for “parents night out Athens” searches and for parents deciding.',
};

const IMPROV_SUMMARY: Edit = {
  path: 'summary',
  from: 'Group and partner improv games for grown-ups. Play as little or as much as you like; BYOB with a 21+ ID.',
  to: 'Group and partner improv games for grown-ups at our W Broad St space in Athens. No experience needed: play as little or as much as you like; BYOB with a 21+ ID.',
  why: 'Says where, and that beginners are welcome, for “improv night Athens” searches.',
};

const FREE_CLASS_SUMMARY: Edit = {
  path: 'summary',
  from: 'Our monthly free class, open to all ages, with a different teacher each month. Registration opens soon.',
  to: 'Our monthly free theater class at our W Broad St space in Athens, open to all ages, with a different teacher each month. Registration opens soon.',
  why: 'Says what kind of class it is and where, for “free kids activities Athens” searches.',
};

const repeat = (ids: string[], edit: Edit): CollectionDraft<'events'>[] => ids.map((id) => ({ kind: 'events', id, edits: [edit] }));

export const events: CollectionDraft<'events'>[] = [
  ...repeat(['free-class-oct', 'free-class-nov'], FREE_CLASS_SUMMARY),
  ...repeat(['improv-night-oct', 'improv-night-nov', 'improv-night-dec'], IMPROV_SUMMARY),
  ...repeat(['parents-night-out-oct', 'parents-night-out-nov', 'parents-night-out-dec'], PNO_SUMMARY),
  {
    kind: 'events',
    id: 'fall-variety-show',
    edits: [
      {
        path: 'venue',
        from: '',
        to: 'Marigold Auditorium for Arts and Culture, 373 N Church St, Winterville',
        why: 'The show will be at the Marigold Auditorium in Winterville; this is its full name and street address, so families can find it.',
      },
      {
        path: 'summary',
        from: 'Our twice-a-year Variety Show, with performances from this fall’s classes, including Stories and Songs and Geode’s Acting Studio. Each enrolled student gets 2 free tickets.',
        to: 'Our twice-a-year Variety Show comes to Winterville, just outside Athens, with performances from this fall’s classes, including Stories and Songs and Geode’s Acting Studio. Each enrolled student gets 2 free tickets.',
        why: 'Names the town in the text (the venue line gives the full address), for families planning the trip and “kids shows near Athens” searches.',
      },
    ],
  },
];
