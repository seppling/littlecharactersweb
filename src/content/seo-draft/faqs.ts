/** Wording drafts: FAQs (changes, and new questions). Format: docs/seo/drafts.md. */
import type { CollectionDraft } from './format';

export const faqs: CollectionDraft<'faqs'>[] = [
  // ── New questions ──
  {
    kind: 'faqs',
    create: {
      group: 'Getting started',
      q: 'What age can my child start?',
      a: 'At 4. Our youngest class, [Stories and Songs](/programs/stories-and-songs), is for ages 4–6; we don’t have classes for children under 4. Tweens and teens from 11 can join [Geode](/geode), and adults 18 and up can come to [Adult Improv Night](/programs/geode-adult-improv).',
    },
    why: 'Parents search “what age can kids start acting”; this answers it and links to the class for each age.',
  },
  {
    kind: 'faqs',
    create: {
      group: 'Getting started',
      q: 'Does my child need acting experience?',
      a: 'No. Some of our students have been acting for years and some are tiptoeing on stage for the first time, and our classes welcome both, including Geode’s [Acting Studio](/programs/geode-acting-studio) for teens. The one exception is the [Performance Troupe](/programs/performance-troupe), which is for students who have worked in theater before.',
    },
    why: 'Answers the most common worry of a parent with a beginner, and names the one class that asks for experience.',
  },
  {
    kind: 'faqs',
    create: {
      group: 'Getting started',
      q: 'Do you serve families outside Athens?',
      a: 'Yes! Our families come from all over the Greater Athens area, including Watkinsville, Winterville, Bogart and Statham. Classes meet at our space at 1635 W Broad St in Athens, about a mile from downtown, and some of our shows are at the Marigold Auditorium in Winterville.',
    },
    why: 'Tells families in nearby towns that they’re welcome, in the town names they search with.',
  },
  {
    kind: 'faqs',
    create: {
      group: 'Getting started',
      q: 'Can I stay and watch?',
      a: 'You’re welcome to wait in our lobby during class. Families watch at the mid-season showcase and the big show at the end of each term, with 2 free tickets per student. See our [shows and events](/events).',
    },
    why: 'Answers a question parents of young children ask before signing up, and links to the shows.',
  },
  {
    kind: 'faqs',
    create: {
      group: 'Camps & parties',
      q: 'Do you have summer camps?',
      a: 'Yes! Every summer we run half-day theater camp weeks for ages 4–10, 9 am to 1 pm, about $50 a day, plus intensives for tweens and teens through Geode. Each camp ends with a performance for parents and friends. Dates for next summer are announced on the [Summer Camp](/programs/summer-camp) page, where you can sign up to hear first. See [all our camps](/camps).',
    },
    why: 'Summer camp is the largest group of searches; this answers it directly and links to the camp pages.',
  },

  // ── Changes to existing questions ──
  {
    kind: 'faqs',
    id: 'who-do-you-serve',
    edits: [
      {
        path: 'a',
        from: 'We offer camps, classes and workshops to students in pre-K through 5th grade through Little Characters, and to students in grades 6–12 and adults through Geode. Some of our students have been acting for years and some are tiptoeing on stage for the first time. Our hope is to create a sense of belonging for everyone.',
        to: 'We offer camps, classes and workshops to students in pre-K through 5th grade through Little Characters, and to students in grades 6–12 and adults through [Geode](/geode). Some of our students have been acting for years and some are tiptoeing on stage for the first time. Our hope is to create a sense of belonging for everyone. [Find a class by age](/programs).',
        why: 'Links to Geode and to the class finder, the pages that answer more.',
      },
    ],
  },
  {
    kind: 'faqs',
    id: 'can-my-child-try-a-class-first',
    edits: [
      {
        path: 'a',
        from: 'Yes, in most weekly classes: look for the “First class free” tag. When you enroll, choose “Try the first class free” and nothing is due until your child decides to stay.',
        to: 'Yes, in most [weekly classes](/programs): look for the “First class free” tag. When you enroll, choose “Try the first class free” and nothing is due until your child decides to stay.',
        why: 'Links to the classes, where the “First class free” tags are.',
      },
    ],
  },
  {
    kind: 'faqs',
    id: 'can-you-support-my-childs-specific-needs',
    edits: [
      {
        path: 'a',
        from: 'Inclusivity is one of our core values. All of our staff have experience working with kids of all ages and abilities, and we partner with the UGA Speech and Hearing Clinic to pair students with higher needs with a one-on-one class buddy at no cost to parents. Tell us about your child and we’ll make sure everyone feels safe and welcome.',
        to: 'Inclusivity is one of our core values. All of our staff have experience working with kids of all ages and abilities, and we partner with the UGA Speech and Hearing Clinic to pair students with higher needs with a one-on-one class buddy at no cost to parents. We also offer [Ovation](/programs/ovation), our adaptive theater class for people with special needs. [Tell us about your child](/contact?topic=needs) and we’ll make sure everyone feels safe and welcome.',
        why: 'Points parents of children with special needs to Ovation and to the contact form for their question.',
      },
    ],
  },
  {
    kind: 'faqs',
    id: 'where-are-you-and-where-do-i-park',
    edits: [
      {
        path: 'a',
        from: 'We’re at 1635 W Broad St, between Rocksprings and Alps on the south side of Broad. Park on Minor St and walk your child to the front door, where a teacher checks them in. After 5 pm you can drop off from the car via the neighbor’s circle driveway at 1655 W Hancock Ave. The back lot is staff-only, and doors lock 5 minutes after class starts.',
        to: 'We’re at 1635 W Broad St in Athens, between Rocksprings and Alps on the south side of Broad. Park on Minor St and walk your child to the front door, where a teacher checks them in. After 5 pm you can drop off from the car via the neighbor’s circle driveway at 1655 W Hancock Ave. The back lot is staff-only, and doors lock 5 minutes after class starts. [Maps and directions](/contact#parking).',
        why: 'Names the city with the address and links to the parking maps on the contact page.',
      },
    ],
  },
  {
    kind: 'faqs',
    id: 'how-much-do-classes-cost',
    edits: [
      {
        path: 'a',
        from: 'Our typical breakdown is $85/month for 45-minute classes, $95/month for 1-hour classes, $115/month for 1¼-hour classes and $125/month for 1½-hour classes. Some classes run as 8-week sessions with a single price. Each class also has a one-time performance or materials fee that pays teachers for extra writing and rehearsal time, costumes, props and facility rentals.',
        to: 'Our typical breakdown is $85/month for 45-minute classes, $95/month for 1-hour classes, $115/month for 1¼-hour classes and $125/month for 1½-hour classes. Some classes run as 8-week sessions with a single price. Each class also has a one-time performance or materials fee that pays teachers for extra writing and rehearsal time, costumes, props and facility rentals. Every class page shows its price: [find a class](/programs).',
        why: 'Links to the class pages, where each price is listed.',
      },
    ],
  },
  {
    kind: 'faqs',
    id: 'do-you-offer-scholarships',
    edits: [
      {
        path: 'a',
        from: 'We never want cost to keep students from joining our programs. We’re happy to arrange a pay-what-you-can rate for families who need it. Email littlecharacterstheater@gmail.com for the scholarship application.',
        to: 'We never want cost to keep students from joining our programs. We’re happy to arrange a pay-what-you-can rate for families who need it. Email littlecharacterstheater@gmail.com for the scholarship application. Gifts to our [scholarship fund](/give) help make this possible.',
        why: 'Links scholarships to the give page, which pays for them.',
      },
    ],
  },
  {
    kind: 'faqs',
    id: 'will-my-child-perform',
    edits: [
      {
        path: 'a',
        from: 'Yes! All classes have a mid-season showcase and end with a big show at the end of the term. Each family receives 2 free tickets per student.',
        to: 'Yes! All classes have a mid-season showcase and end with a big show at the end of the term. Each family receives 2 free tickets per student. See what’s coming up on our [shows and events](/events) page.',
        why: 'Links to the events page, where the shows are listed.',
      },
    ],
  },
  {
    kind: 'faqs',
    id: 'how-do-camps-work',
    edits: [
      {
        path: 'a',
        from: 'Camps run about $50 a day, usually 9 am to 1 pm with snacks and materials included (bring a lunch). Summer camp weeks end with a performance for parents and friends. We also run mini camps on CCSD school holidays and weekend workshops 1–2 times a season.',
        to: 'Camps run about $50 a day, usually 9 am to 1 pm with snacks and materials included (bring a lunch). [Summer camp](/programs/summer-camp) weeks end with a performance for parents and friends. We also run [mini camps](/programs/mini-camps-and-workshops) on Clarke County School District (CCSD) school holidays and weekend workshops 1–2 times a season. See [all our camps](/camps).',
        why: 'Links each kind of camp to its page and spells out the school district, which parents search by name.',
      },
    ],
  },
  {
    kind: 'faqs',
    id: 'do-you-offer-parties',
    edits: [
      {
        path: 'q',
        from: 'Do you offer parties?',
        to: 'Do you host birthday parties?',
        why: 'Uses “birthday party”, the words parents search.',
      },
      {
        path: 'a',
        from: 'Heck yeah we do! Name the occasion, and we’ll make it happen. Two-hour parties on evenings or weekends include customizable theater games, your own Teacher/Party Coordinator, a stage for dance parties and present opening, and tables and chairs for cake and snacks.',
        to: 'Heck yeah we do, birthdays and any other occasion! Name it, and we’ll make it happen. Two-hour parties on evenings or weekends include customizable theater games, your own Teacher/Party Coordinator, a stage for dance parties and present opening, and tables and chairs for cake and snacks. [Ask about a party](/programs/parties).',
        why: 'Says “birthdays” in the answer and links to the parties page.',
      },
    ],
  },
  {
    kind: 'faqs',
    id: 'how-can-i-support-little-characters',
    edits: [
      {
        path: 'a',
        from: 'Volunteer with classes, camps, shows or events; give to our scholarship fund; donate costumes, props or set pieces; or pick something from our Amazon Wish List. Email littlecharacterstheater@gmail.com to get started.',
        to: 'Volunteer with classes, camps, shows or events; give to our [scholarship fund](/give); donate costumes, props or set pieces; or pick something from our Amazon Wish List. Email littlecharacterstheater@gmail.com to get started.',
        why: 'Links to the give page.',
      },
    ],
  },
];
