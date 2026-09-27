/**
 * What can be edited at /admin/content, and how each form looks.
 *
 * Collections are lists of similar things (classes, events, FAQs…). Pages
 * (src/content/pages.ts) are one-off sets of text for a single page.
 */
import type { Field, FieldErrors, Option } from './fields';
import { brandLabels, characterLabels, eventKindLabels, faqGroups, focusLabels, gelLabels, kindLabels, options, statusLabels, weekdays } from './catalog';
import type { EventItem, Faq, Location, Program, TeamMember, Testimonial } from './types';

export type CollectionKey = 'programs' | 'events' | 'faqs' | 'team' | 'testimonials' | 'locations';

export interface CollectionDef<T = unknown> {
  key: CollectionKey;
  /** "Classes & camps" */
  label: string;
  /** "class or camp", as in "Add a class or camp". */
  singular: string;
  /** Shown at the top of the list. */
  intro: string;
  fields: Field[];
  /**
   * The field that names the item in web addresses and links (a slug). It's
   * fixed once the item is published, because links and enrollments use it.
   * Collections without one get a generated id.
   */
  idField?: string;
  title(item: T): string;
  /** For collections without an idField: what a new item's id is made from (default: its title). */
  newId?(item: T): string;
  subtitle?(item: T): string | undefined;
  /** Where the item shows on the public site. */
  url(item: T): string;
  /** Checks that involve more than one field. */
  check?(item: T): FieldErrors;
}

export const gelOptions = options(gelLabels);
export const characterOptions = options(characterLabels);
const dayOptions: Option[] = weekdays.map((d) => ({ value: d, label: d }));
const unitOptions: Option[] = [
  { value: 'month', label: 'per month' },
  { value: 'week', label: 'per week' },
  { value: 'day', label: 'per day' },
  { value: 'class', label: 'per class' },
  { value: 'session', label: 'per session' },
  { value: 'hour', label: 'per hour' },
  { value: 'child', label: 'per child' },
];

const priceFields = (withAdditional = true): Field[] => [
  { key: 'amount', label: 'Price ($)', type: 'money', required: true, half: true },
  { key: 'unit', label: 'Per', type: 'select', options: unitOptions, required: true, half: true },
  { key: 'note', label: 'Price note', type: 'text', help: 'Optional, like “1-hour class” or “Scholarships available”.' },
  ...(withAdditional
    ? [{ key: 'additional', label: 'Each additional child ($)', type: 'money', help: 'Only for prices per child, like Parents’ Night Out.' } as Field]
    : []),
];

const linkFields: Field[] = [
  { key: 'label', label: 'Button text', type: 'text', required: true, half: true },
  { key: 'href', label: 'Link', type: 'url', required: true, half: true, placeholder: 'https://… or /contact' },
];

const sessionFields: Field[] = [
  { key: 'id', label: 'Session id', type: 'hidden' },
  { key: 'term', label: 'Term', type: 'text', required: true, half: true, placeholder: 'Spring 2027' },
  { key: 'label', label: 'Name', type: 'text', half: true, help: 'Optional, like “Week 1” or “Sat, Oct 24”.' },
  { key: 'days', label: 'Meets on', type: 'multi', options: dayOptions, required: true },
  { key: 'start', label: 'Starts at', type: 'time', required: true, half: true },
  { key: 'end', label: 'Ends at', type: 'time', required: true, half: true },
  { key: 'startDate', label: 'First day', type: 'date', required: true, half: true },
  { key: 'endDate', label: 'Last day', type: 'date', required: true, half: true },
  { key: 'locationId', label: 'Where', type: 'ref', collection: 'locations', required: true },
  {
    key: 'status',
    label: 'Registration',
    type: 'select',
    options: options(statusLabels),
    required: true,
    help: 'Families can enroll while it’s Open. “Waitlist only” lets them join the waitlist.',
  },
  {
    key: 'price',
    label: 'Price',
    type: 'group',
    fields: priceFields(),
    help: 'Leave empty to show “Pricing TBA”. Changing a price only affects new enrollments: families already enrolled keep the charges they agreed to.',
  },
  { key: 'capacity', label: 'Class size limit', type: 'number', integer: true, min: 1, max: 500, half: true, help: 'Weekly classes default to 20.' },
  { key: 'spotsLeft', label: 'Spots left to show', type: 'number', integer: true, min: 0, max: 500, half: true, help: 'Optional. Shows “3 spots left”.' },
  { key: 'teacher', label: 'Teacher', type: 'text' },
  {
    key: 'externalUrl',
    label: 'Register somewhere else',
    type: 'url',
    help: 'Only when another organization takes registration, like a school’s own system. Leave empty to enroll here.',
  },
  { key: 'externalLabel', label: 'Button text for that link', type: 'text', placeholder: 'Register' },
];

export const programs: CollectionDef<Program> = {
  key: 'programs',
  label: 'Classes & camps',
  singular: 'class or camp',
  intro: 'Everything families can sign up for: weekly classes, camps, workshops, lessons and parties, each with its dates and prices.',
  idField: 'slug',
  fields: [
    { key: 'title', label: 'Name', type: 'text', required: true, max: 120 },
    {
      key: 'slug',
      label: 'Web address',
      type: 'text',
      format: 'slug',
      required: true,
      max: 80,
      help: 'The end of its address: littlecharacters.org/programs/this-part. It can’t be changed once published.',
    },
    { key: 'kind', label: 'Kind', type: 'select', options: Object.entries(kindLabels).map(([value, l]) => ({ value, label: l.singular })), required: true, half: true },
    { key: 'brand', label: 'Company', type: 'select', options: options(brandLabels), required: true, half: true },
    { key: 'gel', label: 'Color', type: 'select', options: gelOptions, required: true, half: true },
    { key: 'featured', label: 'Feature on the home page', type: 'toggle', half: true },
    {
      key: 'ages',
      label: 'Ages',
      type: 'group',
      required: true,
      fields: [
        { key: 'min', label: 'From age', type: 'number', integer: true, min: 0, max: 120, required: true, half: true },
        { key: 'max', label: 'To age', type: 'number', integer: true, min: 0, max: 120, half: true, help: 'Leave empty for “and up”.' },
      ],
    },
    { key: 'agesLabel', label: 'Age label to show instead', type: 'text', help: 'Optional, like “Ages 7+” or “All ages”.' },
    { key: 'focus', label: 'What students do', type: 'multi', options: options(focusLabels), help: 'Used by the “What they’ll do” filter in the class finder.' },
    { key: 'tagline', label: 'Tagline', type: 'text', required: true, max: 200, help: 'One line under the name.' },
    { key: 'summary', label: 'Summary', type: 'textarea', rows: 3, required: true, max: 600, help: 'Two sentences for class cards and search results.' },
    { key: 'description', label: 'Full description', type: 'paragraphs', rows: 8, keepEmpty: true, help: 'Leave a blank line between paragraphs.' },
    { key: 'highlights', label: 'Highlights', type: 'lines', rows: 4, keepEmpty: true, help: 'One per line, like “Improv” or “Ends in a show”.' },
    { key: 'showcase', label: 'How it ends', type: 'text', help: 'One line, like “Ends with a show for family and friends.”' },
    { key: 'duration', label: 'Length', type: 'text', half: true, placeholder: '1 hour' },
    { key: 'runs', label: 'Runs', type: 'text', half: true, help: 'When it runs longer than a term, like “August – March”.' },
    { key: 'prerequisite', label: 'Who it’s for, beyond age', type: 'text', placeholder: 'For students who have worked in theater before.' },
    { key: 'teachers', label: 'Teachers', type: 'lines', rows: 2, help: 'One per line.' },
    { key: 'priceFrom', label: 'Starting price', type: 'group', fields: priceFields(), help: 'Shown as “from $95/month” on cards.' },
    {
      key: 'fee',
      label: 'One-time fee',
      type: 'group',
      fields: [
        { key: 'amount', label: 'Fee ($)', type: 'money', required: true, half: true },
        { key: 'label', label: 'What it’s for', type: 'text', required: true, half: true, placeholder: 'performance fee' },
      ],
    },
    { key: 'image', label: 'Photo', type: 'image' },
    {
      key: 'sessions',
      label: 'Sessions',
      type: 'list',
      itemLabel: 'session',
      titleKeys: ['term', 'label', 'days', 'start'],
      keepEmpty: true,
      collapsed: true,
      help: 'Each time this runs: a term of a weekly class, a camp week, or one night. A session with families enrolled can be closed but not removed.',
      fields: sessionFields,
    },
    { key: 'notify', label: 'No dates yet: show a “tell me when” signup', type: 'toggle' },
    {
      key: 'requestCta',
      label: 'Booked by request',
      type: 'group',
      fields: linkFields,
      help: 'For lessons and parties: a button to ask, instead of sessions.',
    },
  ],
  title: (p) => p.title,
  subtitle: (p) => {
    const terms = [...new Set(p.sessions.map((s) => s.term))];
    return [kindLabels[p.kind]?.singular, terms.join(', ') || (p.notify ? 'Dates coming soon' : undefined)].filter(Boolean).join(' · ');
  },
  url: (p) => `/programs/${p.slug}`,
  check(p) {
    const errors: FieldErrors = {};
    if (p.ages && p.ages.max != null && p.ages.max < p.ages.min) errors['ages.max'] = 'Should be the same as or older than “From age”';
    p.sessions.forEach((s, i) => {
      if (s.start && s.end && s.end <= s.start) errors[`sessions.${i}.end`] = 'Should be after the start time';
      if (s.startDate && s.endDate && s.endDate < s.startDate) errors[`sessions.${i}.endDate`] = 'Should be on or after the first day';
      if (s.externalLabel && !s.externalUrl) errors[`sessions.${i}.externalUrl`] = 'Add the link, or clear the button text';
    });
    return errors;
  },
};

export const events: CollectionDef<EventItem> = {
  key: 'events',
  label: 'Shows & events',
  singular: 'event',
  intro: 'Shows, showcases, community classes and nights out, listed on the events page and the home page.',
  idField: 'slug',
  fields: [
    { key: 'title', label: 'Name', type: 'text', required: true, max: 120 },
    { key: 'slug', label: 'Short name for links', type: 'text', format: 'slug', required: true, max: 80, help: 'Used in links to this event. It can’t change after publishing.' },
    { key: 'kind', label: 'Kind', type: 'select', options: options(eventKindLabels), required: true, half: true },
    { key: 'brand', label: 'Company', type: 'select', options: options(brandLabels), required: true, half: true },
    { key: 'gel', label: 'Color', type: 'select', options: gelOptions, required: true, half: true },
    { key: 'ages', label: 'Ages', type: 'text', half: true, placeholder: 'All ages' },
    { key: 'summary', label: 'Description', type: 'textarea', rows: 4, required: true, max: 1000 },
    {
      key: 'times',
      label: 'Dates & times',
      type: 'list',
      itemLabel: 'performance',
      titleKeys: ['start'],
      keepEmpty: true,
      help: 'One per performance. Leave empty when the date isn’t set yet.',
      fields: [
        { key: 'start', label: 'Starts', type: 'datetime', required: true, half: true },
        { key: 'end', label: 'Ends', type: 'datetime', required: true, half: true },
      ],
    },
    { key: 'tba', label: 'Expected month', type: 'month', help: 'Only when there’s no date yet: shows “date coming soon” in that month.' },
    { key: 'locationId', label: 'Where', type: 'ref', collection: 'locations', half: true },
    { key: 'venue', label: 'Or another venue', type: 'text', half: true, placeholder: 'State Botanical Garden' },
    { key: 'price', label: 'Price', type: 'text', placeholder: 'Free · $10 at the door' },
    { key: 'cta', label: 'Button', type: 'group', fields: linkFields, help: 'Optional: tickets, registration or more info.' },
  ],
  title: (e) => e.title,
  subtitle: (e) => (e.times[0] ? e.times[0].start.replace('T', ' ') : e.tba ? `Date coming soon (${e.tba})` : 'No date yet'),
  url: (e) => `/events#${e.slug}`,
  check(e) {
    const errors: FieldErrors = {};
    e.times.forEach((t, i) => {
      if (t.start && t.end && t.end <= t.start) errors[`times.${i}.end`] = 'Should be after the start';
    });
    return errors;
  },
};

export const faqs: CollectionDef<Faq> = {
  key: 'faqs',
  label: 'FAQs',
  singular: 'question',
  intro: 'Questions parents ask, grouped into sections on the FAQ page. Some also appear on class pages and the About page.',
  fields: [
    { key: 'group', label: 'Section', type: 'select', options: faqGroups.map((g) => ({ value: g, label: g })), required: true },
    { key: 'q', label: 'Question', type: 'text', required: true, max: 200 },
    { key: 'a', label: 'Answer', type: 'textarea', rows: 6, required: true, max: 3000, help: 'Links: [text](https://…). Bold: **text**.' },
  ],
  title: (f) => f.q,
  subtitle: (f) => f.group,
  url: () => '/faq',
};

export const team: CollectionDef<TeamMember> = {
  key: 'team',
  label: 'Team',
  singular: 'team member',
  intro: 'The people on the About page. The first person is shown larger, with a longer bio.',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, half: true },
    { key: 'role', label: 'Role', type: 'text', required: true, half: true, placeholder: 'Lead Teacher' },
    { key: 'intro', label: 'Short intro', type: 'text', help: 'Optional one line for cards.' },
    { key: 'bio', label: 'Bio', type: 'paragraphs', rows: 8, keepEmpty: true, help: 'Leave a blank line between paragraphs.' },
    { key: 'gel', label: 'Color', type: 'select', options: gelOptions, required: true },
    { key: 'image', label: 'Photo', type: 'image' },
  ],
  title: (m) => m.name,
  subtitle: (m) => m.role,
  url: () => '/about#team',
};

export const testimonials: CollectionDef<Testimonial> = {
  key: 'testimonials',
  label: 'Testimonials',
  singular: 'testimonial',
  intro: 'Quotes from families and students. Choose where each one appears in the Home and About page settings.',
  fields: [
    { key: 'quote', label: 'Quote', type: 'textarea', rows: 5, required: true, max: 1200, help: 'Without quotation marks; the site adds them.' },
    { key: 'attribution', label: 'Who said it', type: 'text', required: true, placeholder: 'Lane, parent', help: 'First name only, with their permission.' },
  ],
  title: (t) => `“${t.quote.slice(0, 70)}${t.quote.length > 70 ? '…' : ''}”`,
  newId: (t) => t.attribution.split(',')[0],
  subtitle: (t) => t.attribution,
  url: () => '/',
};

export const locations: CollectionDef<Location> = {
  key: 'locations',
  label: 'Locations',
  singular: 'location',
  intro: 'Where classes and events happen. Sessions and events point to one of these.',
  idField: 'id',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'id', label: 'Short id', type: 'text', format: 'slug', required: true, max: 60, help: 'Used behind the scenes. It can’t change after publishing.' },
    { key: 'shortName', label: 'Short name', type: 'text', required: true, help: 'Shown on class cards, like “HQ · W Broad St”.' },
    { key: 'address', label: 'Address', type: 'lines', rows: 2, required: true, help: 'One line per line of the address.' },
    { key: 'mapUrl', label: 'Map link', type: 'url', required: true, placeholder: 'https://maps.app.goo.gl/…' },
    { key: 'notes', label: 'Getting there', type: 'textarea', rows: 3 },
    { key: 'usedFor', label: 'Used for', type: 'text' },
  ],
  title: (l) => l.name,
  subtitle: (l) => l.address.join(', '),
  url: () => '/contact',
};

export const collections = { programs, events, faqs, team, testimonials, locations } as Record<CollectionKey, CollectionDef<any>>;
export const collectionKeys = Object.keys(collections) as CollectionKey[];
export const isCollectionKey = (k: string): k is CollectionKey => k in collections;
