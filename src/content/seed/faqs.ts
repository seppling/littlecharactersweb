import type { Faq } from '../types';

/*
 * From the live FAQ page, the Fall 2026 classes page, the Fall 2026 tuition
 * guidelines and the parking guide (captured Sep 25, 2026). The payment
 * answers say what checkout and autopay do (src/lib/pricing.ts,
 * src/server/billing.ts); prices come from the classes through {tuitionRange}.
 * Class pages show the first answers of their sections, so keep the questions'
 * wording (it is their id) and order.
 */
export const faqs: Faq[] = [
  // Getting started
  {
    group: 'Getting started',
    q: 'Who do you serve?',
    a: 'We offer camps, classes and workshops to students in pre-K through 5th grade through Little Characters, and to students in grades 6–12 and adults through Geode. Some of our students have been acting for years and some are tiptoeing on stage for the first time. Our hope is to create a sense of belonging for everyone.',
  },
  {
    group: 'Getting started',
    q: 'Can my child try a class first?',
    a: 'Yes, in most weekly classes: look for the “First class free” tag. When you enroll, choose “Try the first class free” and nothing is due until your child decides to stay.',
  },
  {
    group: 'Getting started',
    q: 'Can you support my child’s specific needs?',
    a: 'Inclusivity is one of our core values. All of our staff have experience working with kids of all ages and abilities, and we partner with the UGA Speech and Hearing Clinic to pair students with higher needs with a one-on-one class buddy at no cost to parents. Tell us about your child and we’ll make sure everyone feels safe and welcome.',
  },
  {
    group: 'Getting started',
    q: 'Where are you, and where do I park?',
    a: 'We’re at 1635 W Broad St, between Rocksprings and Alps on the south side of Broad. Park on Minor St and walk your child to the front door, where a teacher checks them in. After 5 pm you can drop off from the car via the neighbor’s circle driveway at 1655 W Hancock Ave. The back lot is staff-only, and doors lock 5 minutes after class starts.',
  },
  // Classes
  {
    group: 'Classes',
    q: 'How big are classes?',
    a: 'Classes tend to be around 8–12 kids, and camps and workshops around 12–20. We keep about 7–8 students per teacher and add teachers if any of our friends need a little extra attention. A class needs 5 students to run.',
  },
  {
    group: 'Classes',
    q: 'How much do classes cost?',
    a: 'Most weekly classes are {tuitionRange}, by class length. A few, like Stories and Songs, run as 8-week sessions with a single price. Every class shows its price in the [class finder](/programs?kind=class). Each class also has a one-time performance or materials fee that pays teachers for extra writing and rehearsal time, costumes, props and facility rentals.',
  },
  {
    group: 'Classes',
    q: 'When is tuition due?',
    a: 'When you sign up, you pay the first month (prorated if you join after the first week) and the one-time performance or materials fee. After that, monthly tuition is charged automatically to your saved card on the 1st of each month. Or pay for the whole season up front and save {payInFullDiscount}. A month still unpaid after the 10th has a $15 late fee. Trying the first class free? Nothing is due until you decide to stay.',
  },
  {
    group: 'Classes',
    q: 'What if I need to unenroll?',
    a: 'Let us know at least 5 days before the 1st, and we’ll stop the next monthly charge. We can’t refund tuition for missed classes or for a student who drops mid-season after paying. See [our policies](/policies).',
  },
  {
    group: 'Classes',
    q: 'What happens if a class doesn’t fill?',
    a: 'Classes need 5 students to run. If a class doesn’t have 5 about two weeks into the season, it’s cancelled for the season and students can move to a different class. Students who choose not to move are only charged for the first month.',
  },
  // Payments & discounts
  {
    group: 'Payments & discounts',
    q: 'Do you offer discounts?',
    a: 'Yes. Pay for the season in full and get 10% off. We also offer a 15% multi-class or multi-student discount.',
  },
  {
    group: 'Payments & discounts',
    q: 'Do you offer scholarships?',
    a: 'We never want cost to keep students from joining our programs. We’re happy to arrange a pay-what-you-can rate for families who need it. Email littlecharacterstheater@gmail.com for the scholarship application.',
  },
  {
    group: 'Payments & discounts',
    q: 'How can I pay?',
    a: 'By card, when you sign up on this site. For monthly tuition, we keep the card on file and charge it automatically on the 1st; email us to switch cards. Card numbers go straight to Stripe, our payment processor, and never touch our site. Ask us about other ways to pay.',
  },
  // Performances
  {
    group: 'Performances',
    q: 'Will my child perform?',
    a: 'Yes! All classes have a mid-season showcase and end with a big show at the end of the term. Each family receives 2 free tickets per student.',
  },
  // Camps & parties
  {
    group: 'Camps & parties',
    q: 'How do camps work?',
    a: 'Camps run about $50 a day, usually 9 am to 1 pm with snacks and materials included (bring a lunch). Summer camp weeks end with a performance for parents and friends. We also run mini camps on CCSD school holidays and weekend workshops 1–2 times a season.',
  },
  {
    group: 'Camps & parties',
    q: 'Do you offer parties?',
    a: 'Heck yeah we do! Name the occasion, and we’ll make it happen. Two-hour parties on evenings or weekends include customizable theater games, your own Teacher/Party Coordinator, a stage for dance parties and present opening, and tables and chairs for cake and snacks.',
  },
  // Supporting LC
  {
    group: 'Supporting LC',
    q: 'How can I support Little Characters?',
    a: 'Volunteer with classes, camps, shows or events; give to our scholarship fund; donate costumes, props or set pieces; or pick something from our Amazon Wish List. Email littlecharacterstheater@gmail.com to get started.',
  },
];
