/**
 * The editable text of each page, and the site-wide settings.
 *
 * Text can include links written [like this](/contact) and **bold**. Headlines
 * can spotlight words with *single asterisks*. Words in curly braces, like
 * {email}, are filled in from the site settings, so they stay in step.
 */
import type { Field } from './fields';
import { characterOptions, gelOptions } from './collections';
import type { PageKey } from './types';

export interface PageDef {
  key: PageKey;
  label: string;
  intro: string;
  /** Where it shows on the public site. */
  url: string;
  fields: Field[];
}

const RICH = 'Links: [text](/page or https://…). Bold: **text**.';
const VARS = 'You can use {email}, {phone}, {founded} and {founder}; they’re filled in from the site settings.';

const seo: Field = {
  key: 'seo',
  label: 'Search engines',
  type: 'group',
  help: 'What Google shows for this page. Leave empty to use the page’s usual title and description.',
  fields: [
    { key: 'title', label: 'Title', type: 'text', max: 70 },
    { key: 'description', label: 'Description', type: 'textarea', rows: 2, max: 300 },
  ],
};

const eyebrow: Field = { key: 'eyebrow', label: 'Small label above', type: 'text', max: 120 };
const heading: Field = { key: 'heading', label: 'Heading', type: 'text', required: true, max: 160 };
const lede: Field = { key: 'lede', label: 'Intro', type: 'textarea', rows: 3, max: 800, help: RICH };
const head = (withLede = true): Field[] => (withLede ? [eyebrow, heading, lede] : [eyebrow, heading]);
const gel: Field = { key: 'gel', label: 'Color', type: 'select', options: gelOptions, required: true };
const character: Field = { key: 'character', label: 'Character', type: 'select', options: characterOptions, required: true };
const link = (label = 'Link'): Field => ({
  key: 'link',
  label,
  type: 'group',
  required: true,
  fields: [
    { key: 'label', label: 'Link text', type: 'text', required: true, half: true },
    { key: 'href', label: 'Goes to', type: 'url', required: true, half: true, placeholder: '/programs or https://…' },
  ],
});

const hero = (extra: Field[] = [], headlineHelp?: string): Field => ({
  key: 'hero',
  label: 'Top of the page',
  type: 'group',
  required: true,
  fields: [
    eyebrow,
    { key: 'headline', label: 'Headline', type: 'text', required: true, max: 160, help: headlineHelp },
    { key: 'intro', label: 'Intro', type: 'textarea', rows: 3, required: true, max: 800, help: `${RICH} ${VARS}` },
    ...extra,
  ],
});

export const site: PageDef = {
  key: 'site',
  label: 'Site settings & announcement',
  intro: 'The announcement bar, contact details, social links and parking directions used across the whole site.',
  url: '/',
  fields: [
    {
      key: 'announcement',
      label: 'Announcement bar',
      type: 'group',
      help: 'A strip across the top of every page, for news like “Spring registration is open!”',
      fields: [
        { key: 'show', label: 'Show the announcement bar', type: 'toggle' },
        { key: 'text', label: 'Announcement', type: 'text', max: 160 },
        {
          key: 'link',
          label: 'Link',
          type: 'group',
          fields: [
            { key: 'label', label: 'Link text', type: 'text', required: true, half: true, placeholder: 'See classes' },
            { key: 'href', label: 'Goes to', type: 'url', required: true, half: true, placeholder: '/programs' },
          ],
        },
        { key: 'gel', label: 'Color', type: 'select', options: gelOptions },
      ],
    },
    {
      key: 'contact',
      label: 'Contact',
      type: 'group',
      required: true,
      fields: [
        { key: 'email', label: 'Email', type: 'text', format: 'email', required: true, half: true },
        { key: 'phone', label: 'Phone', type: 'text', required: true, half: true, placeholder: '(706) 555-0123' },
      ],
    },
    {
      key: 'social',
      label: 'Social media',
      type: 'group',
      fields: [
        { key: 'instagram', label: 'Instagram', type: 'url', half: true },
        { key: 'facebook', label: 'Facebook', type: 'url', half: true },
      ],
    },
    {
      key: 'links',
      label: 'Giving',
      type: 'group',
      fields: [
        { key: 'giving', label: 'Donation link', type: 'url', help: 'Where the “Give now” buttons go.' },
        { key: 'wishList', label: 'Wish list', type: 'url' },
      ],
    },
    {
      key: 'parking',
      label: 'Parking & drop-off at HQ',
      type: 'group',
      required: true,
      help: 'Shown on the home page, the contact page and enrollment confirmations.',
      fields: [
        { key: 'walkIn', label: 'Walk in', type: 'textarea', rows: 3, required: true },
        { key: 'dropOff', label: 'Drop off (after 5 pm)', type: 'textarea', rows: 3, required: true },
        { key: 'staffOnly', label: 'Please don’t', type: 'textarea', rows: 2, required: true },
        { key: 'late', label: 'Running late?', type: 'textarea', rows: 2, required: true },
        { key: 'guideUrl', label: 'Parking guide (PDF)', type: 'url' },
      ],
    },
    {
      key: 'description',
      label: 'Site description',
      type: 'textarea',
      rows: 3,
      required: true,
      max: 300,
      help: 'What search engines show for the home page, and for pages without their own description.',
    },
    { key: 'previewBanner', label: 'Show the “Design preview” note at the top of every page', type: 'toggle', help: 'Turn this off at launch.' },
  ],
};

export const home: PageDef = {
  key: 'home',
  label: 'Home page',
  intro: 'The home page, top to bottom. Featured classes are chosen on each class (“Feature on the home page”), and upcoming shows come from Shows & events.',
  url: '/',
  fields: [
    {
      key: 'hero',
      label: 'Top of the page',
      type: 'group',
      required: true,
      fields: [
        eyebrow,
        { key: 'headline', label: 'Headline', type: 'text', required: true, max: 120, help: 'Wrap a word in *asterisks* to put the spotlight on it.' },
        { key: 'intro', label: 'Intro', type: 'textarea', rows: 3, required: true, max: 600 },
        { key: 'promises', label: 'Tags', type: 'lines', rows: 3, keepEmpty: true, help: 'Short promises shown as tape labels, one per line.' },
        { key: 'photo', label: 'Photo', type: 'image' },
      ],
    },
    {
      key: 'callSheet',
      label: 'On the call sheet',
      type: 'group',
      required: true,
      help: 'The three “what’s happening now” cards under the top of the page. Keep these current.',
      fields: [
        heading,
        {
          key: 'items',
          label: 'Cards',
          type: 'list',
          itemLabel: 'card',
          titleKeys: ['title'],
          keepEmpty: true,
          max: 4,
          fields: [
            { key: 'when', label: 'When', type: 'text', required: true, placeholder: 'Sun, Sep 27 · 1:30 pm' },
            { key: 'title', label: 'Title', type: 'text', required: true },
            { key: 'text', label: 'Text', type: 'text' },
            { key: 'href', label: 'Goes to', type: 'url', placeholder: '/events' },
            gel,
          ],
        },
      ],
    },
    {
      key: 'trial',
      label: 'First class free',
      type: 'group',
      required: true,
      fields: [
        eyebrow,
        heading,
        { key: 'body', label: 'Text', type: 'textarea', rows: 3, required: true },
        { key: 'button', label: 'Button text', type: 'text', required: true },
        {
          key: 'steps',
          label: 'Steps',
          type: 'list',
          itemLabel: 'step',
          titleKeys: ['title'],
          keepEmpty: true,
          fields: [
            { key: 'title', label: 'Step', type: 'text', required: true },
            { key: 'text', label: 'Text', type: 'text', required: true },
          ],
        },
      ],
    },
    {
      key: 'pathway',
      label: 'Where does my kid start?',
      type: 'group',
      required: true,
      fields: [
        ...head(),
        {
          key: 'steps',
          label: 'Age steps',
          type: 'list',
          itemLabel: 'step',
          titleKeys: ['age', 'title'],
          keepEmpty: true,
          fields: [
            { key: 'age', label: 'Ages', type: 'text', required: true, half: true, placeholder: '4–6' },
            { key: 'title', label: 'Title', type: 'text', required: true, half: true },
            { ...character, half: true },
            { ...gel, half: true },
            { key: 'programs', label: 'Classes', type: 'ref', collection: 'programs', multiple: true },
          ],
        },
      ],
    },
    {
      key: 'approach',
      label: 'Our approach',
      type: 'group',
      required: true,
      fields: [
        ...head(false),
        {
          key: 'steps',
          label: 'Steps',
          type: 'list',
          itemLabel: 'step',
          titleKeys: ['title'],
          keepEmpty: true,
          fields: [
            { key: 'title', label: 'Title', type: 'text', required: true },
            { key: 'body', label: 'Text', type: 'textarea', rows: 3, required: true },
            gel,
            { key: 'photo', label: 'Photo', type: 'image' },
          ],
        },
      ],
    },
    { key: 'featured', label: 'Featured classes', type: 'group', required: true, fields: head(false) },
    {
      key: 'why',
      label: 'Why families choose us',
      type: 'group',
      required: true,
      fields: [
        ...head(false),
        {
          key: 'facts',
          label: 'Facts',
          type: 'list',
          itemLabel: 'fact',
          titleKeys: ['big'],
          keepEmpty: true,
          fields: [
            { key: 'big', label: 'Big text', type: 'text', required: true, half: true, placeholder: '8–12' },
            { ...gel, half: true },
            { key: 'text', label: 'Text', type: 'textarea', rows: 2, required: true },
          ],
        },
        { key: 'testimonial', label: 'Quote', type: 'ref', collection: 'testimonials' },
      ],
    },
    {
      key: 'extras',
      label: 'More ways to play',
      type: 'group',
      required: true,
      fields: [
        heading,
        {
          key: 'items',
          label: 'Cards',
          type: 'list',
          itemLabel: 'card',
          titleKeys: ['title'],
          keepEmpty: true,
          fields: [
            { key: 'title', label: 'Title', type: 'text', required: true, half: true },
            { key: 'href', label: 'Goes to', type: 'url', required: true, half: true },
            { key: 'body', label: 'Text', type: 'textarea', rows: 2, required: true },
            { ...character, half: true },
            { key: 'geode', label: 'Geode colors', type: 'toggle', half: true },
          ],
        },
      ],
    },
    { key: 'shows', label: 'Shows & events', type: 'group', required: true, fields: head(false) },
    {
      key: 'story',
      label: 'Our story',
      type: 'group',
      required: true,
      fields: [
        ...head(false),
        { key: 'paragraphs', label: 'Text', type: 'paragraphs', rows: 6, keepEmpty: true, help: `Leave a blank line between paragraphs. ${VARS}` },
        { key: 'photo', label: 'Photo', type: 'image' },
      ],
    },
    { key: 'visit', label: 'Visit HQ', type: 'group', required: true, help: 'The address and parking come from Locations and Site settings.', fields: head(false) },
    {
      key: 'give',
      label: 'Giving',
      type: 'group',
      required: true,
      fields: [heading, { key: 'body', label: 'Text', type: 'textarea', rows: 3, required: true }],
    },
    {
      key: 'signup',
      label: 'Email signup',
      type: 'group',
      required: true,
      fields: [heading, { key: 'body', label: 'Text', type: 'textarea', rows: 3, required: true }],
    },
    seo,
  ],
};

export const about: PageDef = {
  key: 'about',
  label: 'About page',
  intro: 'Our story, what we do, who it’s for, the team section, and the key facts. The team members themselves are edited under Team.',
  url: '/about',
  fields: [
    {
      key: 'hero',
      label: 'Top of the page',
      type: 'group',
      required: true,
      fields: [
        eyebrow,
        { key: 'headline', label: 'Headline', type: 'text', required: true, max: 120 },
        { key: 'summary', label: 'One-sentence summary', type: 'textarea', rows: 2, required: true, help: `What Little Characters is, in one sentence. ${RICH}` },
        { key: 'story', label: 'Story', type: 'paragraphs', rows: 6, keepEmpty: true, help: `Leave a blank line between paragraphs. ${VARS}` },
        { key: 'photo', label: 'Photo', type: 'image' },
      ],
    },
    {
      key: 'services',
      label: 'What we do',
      type: 'group',
      required: true,
      fields: [
        ...head(false),
        {
          key: 'items',
          label: 'Cards',
          type: 'list',
          itemLabel: 'card',
          titleKeys: ['title'],
          keepEmpty: true,
          fields: [
            { key: 'title', label: 'Title', type: 'text', required: true, half: true },
            { ...gel, half: true },
            { key: 'body', label: 'Text', type: 'textarea', rows: 3, required: true },
            link(),
          ],
        },
      ],
    },
    {
      key: 'differences',
      label: 'What makes us different',
      type: 'group',
      required: true,
      fields: [
        ...head(false),
        { key: 'photo', label: 'Photo', type: 'image' },
        {
          key: 'items',
          label: 'Reasons',
          type: 'list',
          itemLabel: 'reason',
          titleKeys: ['title'],
          keepEmpty: true,
          fields: [
            { key: 'title', label: 'Title', type: 'text', required: true },
            {
              key: 'body',
              label: 'Text',
              type: 'textarea',
              rows: 3,
              required: true,
              help: 'You can use {payInFullDiscount} and {multiDiscount}; they’re filled in from the current pricing.',
            },
          ],
        },
      ],
    },
    {
      key: 'audiences',
      label: 'Who it’s for',
      type: 'group',
      required: true,
      fields: [
        ...head(),
        {
          key: 'items',
          label: 'Groups',
          type: 'list',
          itemLabel: 'group',
          titleKeys: ['label'],
          keepEmpty: true,
          fields: [
            { key: 'label', label: 'Label', type: 'text', required: true, half: true, placeholder: 'Ages 4–6' },
            { ...gel, half: true },
            { key: 'body', label: 'Text', type: 'textarea', rows: 2, required: true },
            { key: 'programs', label: 'Links to classes', type: 'ref', collection: 'programs', multiple: true },
            {
              key: 'links',
              label: 'Other links',
              type: 'list',
              itemLabel: 'link',
              titleKeys: ['label'],
              fields: [
                { key: 'label', label: 'Link text', type: 'text', required: true, half: true },
                { key: 'href', label: 'Goes to', type: 'url', required: true, half: true },
              ],
            },
          ],
        },
      ],
    },
    {
      key: 'beliefs',
      label: 'What we believe',
      type: 'group',
      required: true,
      fields: [
        ...head(),
        { key: 'valuesHeading', label: 'Values heading', type: 'text', required: true },
        {
          key: 'values',
          label: 'Values',
          type: 'list',
          itemLabel: 'value',
          titleKeys: ['title'],
          keepEmpty: true,
          fields: [
            { key: 'title', label: 'Value', type: 'text', required: true, half: true },
            { ...gel, half: true },
            { key: 'body', label: 'Text', type: 'textarea', rows: 2, required: true },
          ],
        },
      ],
    },
    {
      key: 'team',
      label: 'The team',
      type: 'group',
      required: true,
      help: 'Team members are edited under Team.',
      fields: [
        ...head(),
        { key: 'social', label: 'Social line', type: 'text', help: 'You can use {instagram} and {facebook}, like [Instagram]({instagram}).' },
        { key: 'quote', label: 'Quote', type: 'ref', collection: 'testimonials' },
        { key: 'hiring', label: 'Working with us', type: 'text', help: `${RICH} ${VARS}` },
      ],
    },
    {
      key: 'schools',
      label: 'Theater at your school',
      type: 'group',
      required: true,
      fields: [...head(), { key: 'body', label: 'Text', type: 'textarea', rows: 3, required: true, help: RICH }, { key: 'quote', label: 'Quote', type: 'ref', collection: 'testimonials' }],
    },
    {
      key: 'how',
      label: 'How it works',
      type: 'group',
      required: true,
      help: 'The four steps (Find, Pick a time, Enroll & pay, You’re in) are part of the enrollment design. These notes follow them.',
      fields: [
        ...head(false),
        {
          key: 'notes',
          label: 'Notes',
          type: 'list',
          itemLabel: 'note',
          titleKeys: ['title'],
          keepEmpty: true,
          fields: [
            { key: 'title', label: 'Title', type: 'text', required: true },
            { key: 'body', label: 'Text', type: 'textarea', rows: 3, required: true, help: `${RICH} ${VARS}` },
          ],
        },
      ],
    },
    {
      key: 'facts',
      label: 'Key facts',
      type: 'group',
      required: true,
      help: 'A plain list that search engines and AI assistants quote. Keep each answer short and factual.',
      fields: [
        ...head(false),
        {
          key: 'items',
          label: 'Facts',
          type: 'list',
          itemLabel: 'fact',
          titleKeys: ['label'],
          keepEmpty: true,
          fields: [
            { key: 'label', label: 'Label', type: 'text', required: true, half: true },
            {
              key: 'text',
              label: 'Answer',
              type: 'textarea',
              rows: 2,
              required: true,
              help: `${RICH} You can also use {tuitionRange}, {campDay}, {payInFullDiscount}, {multiDiscount}, {teamSize}, {founderRole}, {hqAddress}, {hqMap}, {website} and {siteHost}.`,
            },
          ],
        },
      ],
    },
    {
      key: 'faq',
      label: 'Questions',
      type: 'group',
      required: true,
      fields: [heading, { key: 'questions', label: 'Questions to show', type: 'ref', collection: 'faqs', multiple: true, help: 'Pick from the FAQs.' }],
    },
    seo,
  ],
};

export const camps: PageDef = {
  key: 'camps',
  label: 'Camps page',
  intro: 'Summer camp and mini camps. The summer week-by-week grid fills in by itself once summer sessions named “Week 1”, “Week 2”… are added to a camp.',
  url: '/camps',
  fields: [
    hero(
      [
        {
          key: 'facts',
          label: 'Quick facts',
          type: 'list',
          itemLabel: 'fact',
          titleKeys: ['label'],
          keepEmpty: true,
          fields: [
            { key: 'label', label: 'Label', type: 'text', required: true, half: true, placeholder: 'Hours' },
            { key: 'value', label: 'Value', type: 'text', required: true, half: true, placeholder: '9 am – 1 pm' },
          ],
        },
        { key: 'summerButton', label: 'Summer button', type: 'text', required: true, half: true },
        { key: 'miniButton', label: 'Mini camps button', type: 'text', required: true, half: true },
        { key: 'photo', label: 'Photo', type: 'image' },
      ],
      'Wrap words in *asterisks* to underline them.',
    ),
    {
      key: 'summer',
      label: 'Summer camp',
      type: 'group',
      required: true,
      fields: [
        { key: 'openTape', label: 'Label when weeks are listed', type: 'text', required: true, half: true },
        { key: 'openHeading', label: 'Heading when weeks are listed', type: 'text', required: true, half: true },
        { key: 'openLede', label: 'Intro when weeks are listed', type: 'text', required: true },
        { key: 'soonTape', label: 'Label before dates are out', type: 'text', required: true, half: true },
        { key: 'soonHeading', label: 'Heading before dates are out', type: 'text', required: true, half: true },
        {
          key: 'formats',
          label: 'Camp formats (before dates are out)',
          type: 'list',
          itemLabel: 'format',
          titleKeys: ['title'],
          keepEmpty: true,
          fields: [
            { key: 'title', label: 'Title', type: 'text', required: true, half: true },
            { ...gel, half: true },
            { key: 'body', label: 'Text', type: 'textarea', rows: 3, required: true },
          ],
        },
        { key: 'notifyHeading', label: 'Signup heading', type: 'text', required: true },
        { key: 'notifyBody', label: 'Signup text', type: 'text', required: true },
        { key: 'notifyNote', label: 'Small print', type: 'text', help: RICH },
      ],
    },
    {
      key: 'mini',
      label: 'Mini camps & workshops',
      type: 'group',
      required: true,
      fields: [
        eyebrow,
        heading,
        { key: 'lede', label: 'After the summary', type: 'text', help: 'Follows the Mini camps summary (edited on that class).' },
        { key: 'recentHeading', label: 'Recent favorites heading', type: 'text', required: true },
        {
          key: 'recent',
          label: 'Recent favorites',
          type: 'list',
          itemLabel: 'workshop',
          titleKeys: ['title'],
          keepEmpty: true,
          fields: [
            { key: 'when', label: 'When', type: 'text', required: true, half: true, placeholder: 'Mar 2026' },
            { ...gel, half: true },
            { key: 'title', label: 'Title', type: 'text', required: true },
          ],
        },
      ],
    },
    {
      key: 'day',
      label: 'A day at camp',
      type: 'group',
      required: true,
      fields: [
        ...head(),
        {
          key: 'steps',
          label: 'Schedule',
          type: 'list',
          itemLabel: 'part of the day',
          titleKeys: ['time', 'what'],
          keepEmpty: true,
          fields: [
            { key: 'time', label: 'Time', type: 'text', required: true, half: true, placeholder: '9:00' },
            { key: 'what', label: 'What', type: 'text', required: true, half: true },
            { key: 'detail', label: 'Details', type: 'text', required: true },
          ],
        },
      ],
    },
    { key: 'faq', label: 'Camp questions', type: 'group', required: true, help: 'The questions come from the “Camps & parties” FAQ section.', fields: [heading] },
    seo,
  ],
};

export const geode: PageDef = {
  key: 'geode',
  label: 'Geode page',
  intro: 'Geode, for tweens, teens and adults. Its classes and improv nights come from Classes & camps and Shows & events.',
  url: '/geode',
  fields: [
    {
      key: 'hero',
      label: 'Top of the page',
      type: 'group',
      required: true,
      fields: [
        eyebrow,
        { key: 'headline', label: 'Headline', type: 'text', required: true },
        { key: 'line', label: 'Tagline', type: 'text', required: true },
        { key: 'intro', label: 'Intro', type: 'textarea', rows: 3, required: true },
        { key: 'classesButton', label: 'Classes button', type: 'text', required: true, half: true },
        { key: 'improvButton', label: 'Improv nights button', type: 'text', required: true, half: true },
      ],
    },
    {
      key: 'growing',
      label: 'Growing up',
      type: 'group',
      required: true,
      fields: [heading, { key: 'paragraphs', label: 'Text', type: 'paragraphs', rows: 6, keepEmpty: true, help: 'Leave a blank line between paragraphs.' }],
    },
    {
      key: 'classes',
      label: 'Classes',
      type: 'group',
      required: true,
      fields: [heading, { key: 'note', label: 'Note under the classes', type: 'textarea', rows: 3, help: RICH }],
    },
    { key: 'improv', label: 'Improv nights', type: 'group', required: true, fields: head() },
    {
      key: 'past',
      label: 'Past events',
      type: 'group',
      required: true,
      fields: [
        heading,
        {
          key: 'items',
          label: 'Photos',
          type: 'list',
          itemLabel: 'photo',
          titleKeys: ['caption'],
          keepEmpty: true,
          fields: [
            { key: 'photo', label: 'Photo', type: 'image' },
            { key: 'caption', label: 'Caption', type: 'textarea', rows: 2, required: true },
          ],
        },
      ],
    },
    seo,
  ],
};

export const give: PageDef = {
  key: 'give',
  label: 'Give page',
  intro: 'The scholarship fund and other ways to help. The “Give now” button goes to the donation link in Site settings.',
  url: '/give',
  fields: [
    hero([
      { key: 'giveButton', label: 'Give button', type: 'text', required: true, half: true },
      { key: 'scholarshipButton', label: 'Scholarship button', type: 'text', required: true, half: true },
    ]),
    {
      key: 'impact',
      label: 'What your gift covers',
      type: 'group',
      required: true,
      fields: [
        heading,
        {
          key: 'items',
          label: 'Amounts',
          type: 'list',
          itemLabel: 'amount',
          titleKeys: ['amount'],
          keepEmpty: true,
          fields: [
            { key: 'amount', label: 'Amount', type: 'text', required: true, half: true, placeholder: '$30' },
            { ...gel, half: true },
            { key: 'what', label: 'What it covers', type: 'text', required: true },
          ],
        },
      ],
    },
    {
      key: 'ways',
      label: 'Other ways to help',
      type: 'group',
      required: true,
      fields: [
        heading,
        {
          key: 'items',
          label: 'Ways',
          type: 'list',
          itemLabel: 'way',
          titleKeys: ['title'],
          keepEmpty: true,
          fields: [
            { key: 'title', label: 'Title', type: 'text', required: true },
            { key: 'body', label: 'Text', type: 'text', required: true },
            { ...link(), help: 'Links can use {email} and {wishList}, like mailto:{email}?subject=Volunteering.' },
          ],
        },
      ],
    },
    {
      key: 'scholarship',
      label: 'Scholarships',
      type: 'group',
      required: true,
      fields: [heading, { key: 'body', label: 'Text', type: 'textarea', rows: 3, required: true, help: `${RICH} ${VARS}` }],
    },
    seo,
  ],
};

export const contact: PageDef = {
  key: 'contact',
  label: 'Contact page',
  intro: 'The contact page’s text. Email, phone and parking directions are in Site settings; the address is under Locations.',
  url: '/contact',
  fields: [hero(), { key: 'parking', label: 'Parking & drop-off', type: 'group', required: true, fields: head(false) }, seo],
};

export const faq: PageDef = {
  key: 'faq',
  label: 'FAQ page',
  intro: 'The top of the FAQ page. The questions are edited under FAQs.',
  url: '/faq',
  fields: [hero(), seo],
};

export const classes: PageDef = {
  key: 'classes',
  label: 'Class finder',
  intro: 'The top of the “Find a class” page. The classes are edited under Classes & camps.',
  url: '/programs',
  fields: [hero(), seo],
};

export const eventsPage: PageDef = {
  key: 'events',
  label: 'Events page',
  intro: 'The top and bottom of the Shows & events page. The events are edited under Shows & events.',
  url: '/events',
  fields: [
    hero(),
    {
      key: 'perform',
      label: 'Closing card',
      type: 'group',
      required: true,
      fields: [heading, { key: 'body', label: 'Text', type: 'textarea', rows: 2, required: true }, { key: 'button', label: 'Button text', type: 'text', required: true }],
    },
    seo,
  ],
};

export const pages: Record<PageKey, PageDef> = { site, home, about, camps, geode, give, contact, faq, classes, events: eventsPage };
export const pageKeys = Object.keys(pages) as PageKey[];
export const isPageKey = (k: string): k is PageKey => k in pages;
