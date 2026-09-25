import type { Faq } from './types';

/*
 * Answers marked "from current site" are migrated policy. The rest are
 * drafted for Hannah to confirm (see docs/content-inventory.md).
 */
export const faqs: Faq[] = [
  // Getting started
  {
    group: 'Getting started',
    q: 'Is the first class really free?',
    a: 'Yes. A new student’s first class is always free, so your child can try it before you commit.',
  },
  {
    group: 'Getting started',
    q: 'My child has never done theater. Is that okay?',
    a: 'Absolutely. Most of our students start with no experience. Teachers meet every student where they are, whether they are made for the stage or more interested in what happens behind the scenes.',
  },
  {
    group: 'Getting started',
    q: 'Can you support my child’s specific needs?',
    a: 'We do everything we can to cater to the specific needs of every student, and rich communication with parents is key to how we work. Tell us about your child when you register or reach out anytime. We also offer Ovation, a monthly class for people with special needs.',
  },
  {
    group: 'Getting started',
    q: 'Where are classes held?',
    a: 'Weekly classes, workshops and parties are at our HQ, 1635 W Broad St in Athens. Production camps and showcases are at Marigold Auditorium in Winterville.',
  },
  // Classes
  {
    group: 'Classes',
    q: 'How big are classes?',
    a: 'All classes follow a deep enrichment model of about 7 students per teacher, and classes are capped at 20 students or fewer depending on the subject.',
  },
  {
    group: 'Classes',
    q: 'How does class tuition work?',
    a: 'Weekly classes are billed monthly: $85/month for 45-minute classes, $95/month for 1-hour classes and $115/month for 1¼-hour classes.',
  },
  {
    group: 'Classes',
    q: 'What should my child wear?',
    a: 'Comfortable clothes they can move in and closed-toe shoes. Bring a water bottle with their name on it.',
  },
  // Camps
  {
    group: 'Camps',
    q: 'How does camp registration and payment work?',
    a: 'A $50 non-refundable deposit is due at registration to hold your spot. The rest of the camp payment is due the week before the first day of camp.',
  },
  {
    group: 'Camps',
    q: 'What is the camper-to-counselor ratio?',
    a: 'All camps follow a deep enrichment model of 8 campers to 1 counselor.',
  },
  {
    group: 'Camps',
    q: 'Is lunch provided?',
    a: 'Snacks and materials are included. Lunch is not, so pack one if your camper is staying for an afternoon add-on.',
  },
  // Payments & discounts
  {
    group: 'Payments & discounts',
    q: 'Do you offer sibling or multi-class discounts?',
    a: 'Yes. We offer a 15% sibling discount and a 15% multiple-class discount for families taking more than one class per week.',
  },
  {
    group: 'Payments & discounts',
    q: 'Do you offer scholarships?',
    a: 'Yes. We never want cost to keep a student from joining our programs. Reach out and let us know you are interested in a scholarship; the conversation stays between us.',
  },
  // Performances
  {
    group: 'Performances',
    q: 'Will my child perform?',
    a: 'Most classes and camps end with a performance for families: camps on the last day, and weekly classes in our end-of-term LC Variety Show at Marigold Auditorium.',
  },
];
