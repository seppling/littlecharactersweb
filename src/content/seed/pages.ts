import type { Pages } from '../types';

/*
 * The page text as it was on the site before the editor, used to fill an
 * empty database. Placeholders like {email} are filled in when the page is
 * shown (see src/content/rich.ts).
 */
export const pages: Pages = {
  site: {
    announcement: { gel: 'yellow' },
    contact: { email: 'littlecharacterstheater@gmail.com', phone: '(281) 798-2623' },
    social: {
      instagram: 'https://www.instagram.com/littlecharactersathens/',
      facebook: 'https://www.facebook.com/littlecharactersathens/',
    },
    // TODO: the current giving page has no payment form yet; point this at a real donation link.
    links: { giving: 'https://www.littlecharacters.org/giving-page', wishList: 'https://a.co/510Gges' },
    /** How to get to HQ, from the "Parking Instructions" guide on the old site. */
    parking: {
      walkIn:
        'Park in one of the 25 spots on Minor St and walk your child to the front of the building. A teacher will be waiting by the front door to check them in. You’re welcome to wait in the lobby or run errands.',
      dropOff:
        'After 5 pm, you can stay in the car: at the crosswalk where W Hancock meets W Broad, turn into the neighbor’s circle driveway at the green building (GPS: 1655 W Hancock Ave) and pull up to our front door.',
      staffOnly: 'The lot behind the building is staff-only, so please don’t use the 1635 driveway.',
      late: 'Doors lock 5 minutes after class starts. If you’re running late, walk your student to the front door and knock.',
      guideUrl: 'https://www.littlecharacters.org/s/Little-Characters-Parking-Instructions.pdf',
    },
    description:
      'Theater classes, camps, workshops and shows for ages 4 to 100 in Athens, Georgia. Encouraging creative hearts through theater since 2022.',
    previewBanner: true,
  },

  home: {
    hero: {
      eyebrow: 'Encouraging creative hearts through theater · Athens, GA',
      headline: 'Every person has a *story* worth telling.',
      intro:
        'Through dramatic play, improv, storytelling and script writing, we help children, teens and adults discover confidence, creativity, and a place where they belong.',
      promises: ['First class free', 'Classes of 8–12 kids', 'Pay-what-you-can available'],
      photo: {
        src: 'builtin:photos/cast-silly-faces',
        alt: 'A cast of Little Characters students and teachers making silly faces on stage',
        position: '42% 35%',
      },
    },
    callSheet: {
      heading: 'On the call sheet',
      items: [
        {
          when: 'Fall 2026 · Aug 17 – Dec 18',
          title: 'Registration is open for all classes',
          text: 'New to Little Characters? Your first class is free.',
          href: '/programs?kind=class',
          gel: 'yellow',
        },
        {
          when: 'Sun, Sep 27 · 1:30 pm',
          title: 'Jack and the Beanstalk',
          text: 'Our Performance Troupe at the Botanical Garden’s Insectival.',
          href: '/events#jack-and-the-beanstalk',
          gel: 'teal',
        },
        {
          when: 'Starts Tue, Oct 20',
          title: 'Stories and Songs & Acting Studio',
          text: 'New Tuesday classes for ages 4–6 and 11–17.',
          href: '/programs/stories-and-songs',
          gel: 'orange',
        },
      ],
    },
    trial: {
      eyebrow: 'Not sure yet?',
      heading: 'The first class is on us.',
      body: 'New students can try a weekly class free. Come see if it clicks, and only pay if your child wants to stay.',
      button: 'Find a class to try',
      steps: [
        { title: 'Pick a class', text: 'Look for the “First class free” tag in the class finder.' },
        { title: 'Choose “Try the first class free”', text: 'Nothing is due when you enroll.' },
        { title: 'Stay if they love it', text: 'Continue monthly or pay the semester, right from your family account.' },
      ],
    },
    pathway: {
      eyebrow: 'Where does my kid start?',
      heading: 'A class for every age, and a next step when they’re ready.',
      lede: 'Classes are grouped by age, from pretend play for 4-year-olds to writing and staging an original show. Not sure which fits? [Ask us](/contact?topic=class) and we’ll help you pick.',
      // The pathway is a real progression: where most students start, and where they go next.
      steps: [
        { age: '4–6', title: 'First steps', character: 'professor', gel: 'yellow', programs: ['stories-and-songs'] },
        { age: '7–10', title: 'Find your voice', character: 'magician', gel: 'teal', programs: ['intro-to-theater', 'yes-and-improv'] },
        { age: '7+', title: 'Make your own', character: 'artist', gel: 'orange', programs: ['produce-a-show', 'film-creation'] },
        { age: '9–17', title: 'Take the stage', character: 'dancer', gel: 'purple', programs: ['performance-troupe', 'geode-acting-studio'] },
      ],
    },
    approach: {
      eyebrow: 'Our approach',
      heading: 'From “I’m nervous” to a bow on stage.',
      steps: [
        {
          title: 'Meet you where you’re at',
          body: 'We are all born beautiful individuals with differing gifts. We meet students where they are, whether nervous or excited, first-timers or masters of the stage, and help each little character feel comfortable and curious to learn.',
          gel: 'yellow',
          photo: { src: 'builtin:photos/teacher-with-students', alt: 'A teacher with a group of young students' },
        },
        {
          title: 'Learn and rehearse',
          body: 'We build a team through games, exercises and trust experiences. Then we build confidence, express emotions and grow communication skills by working on scenes, scripts and character development.',
          gel: 'teal',
          photo: { src: 'builtin:photos/rehearsing-on-stage', alt: 'Students rehearsing a scene on stage', position: '50% 60%' },
        },
        {
          title: 'Encourage and perform!',
          body: 'Performing can be intimidating! We share affirmations with each other and give one-on-one prep time with teachers. It’s a gift to showcase our hard work for our loved ones.',
          gel: 'red',
          photo: { src: 'builtin:photos/carnival-show', alt: 'Students performing a carnival-themed show on stage', position: '60% 50%' },
        },
      ],
    },
    featured: { eyebrow: 'Fall 2026 · registration open', heading: 'This semester’s classes' },
    why: {
      eyebrow: 'Why families choose Little Characters',
      heading: 'Small groups. Big confidence.',
      facts: [
        { big: '8–12', text: 'Kids in a typical class, with about 7 students per teacher. We add teachers when friends need extra attention.', gel: 'teal' },
        { big: 'Free', text: 'New students can try most weekly classes free, so your child can see if it clicks before you commit.', gel: 'orange' },
        { big: '15% off', text: 'For multiple students or multiple classes. Pay the semester up front and save 10%.', gel: 'red' },
        { big: '1 : 1', text: 'Class buddies for students with higher needs, through the UGA Speech and Hearing Clinic, at no cost to parents.', gel: 'purple' },
      ],
      testimonial: 'lane',
    },
    extras: {
      heading: 'More ways to play',
      items: [
        { title: 'Parents’ Night Out', body: 'Once a month, 5–8 pm. Games, crafts and snacks while you head downtown. $30 for the first child.', href: '/programs/parents-night-out', character: 'royal' },
        { title: 'Parties', body: 'Two hours on our stage for any occasion, with your own teacher/party coordinator.', href: '/programs/parties', character: 'artist' },
        { title: 'Private lessons', body: 'Audition help, playwriting, one-on-one acting and singing, by the hour.', href: '/programs/private-lessons', character: 'professor' },
        { title: 'Free community class', body: 'A free theater class once a month, open to all ages.', href: '/programs/free-community-class', character: 'magician' },
        { title: 'At your school', body: 'We’re a verified CCSD school vendor, running after-school programs around the county.', href: '/about#schools', character: 'stagehand' },
        { title: 'Geode: tweens, teens & adults', body: 'Acting Studio, Performance Troupe and Third Thursday Improv Nights for 11 and up.', href: '/geode', character: 'dancer', geode: true },
      ],
    },
    shows: { eyebrow: 'House lights down', heading: 'Shows & events' },
    story: {
      eyebrow: 'Our story',
      heading: 'It started with a Pre‑K moms’ group text.',
      paragraphs: [
        'A few years ago, Athens lost several of its historic kids’ theater companies. Hannah Eppling, a local mom and theater educator who has taught theater to 3- to 50-year-olds, started Little Characters in {founded} to keep the joy and connection of theater going for students of all ages and abilities, beginning with summer camps.',
        '“I have a yearning to encourage the hearts of others, and my favorite way to do so is through theater.”',
      ],
      photo: { src: 'builtin:team/hannah-eppling', alt: 'Hannah Eppling', position: '50% 8%' },
    },
    visit: { eyebrow: 'Visit HQ', heading: 'Come see our space' },
    give: {
      heading: 'Help a kid take the stage.',
      body: 'Gifts to our scholarship fund let us invite anyone to our programs without cost getting in the way. You can also volunteer, donate costumes and props, or shop our wish list.',
    },
    signup: {
      heading: 'Be first to hear about camps.',
      body: 'Mini camps, workshops and summer camp fill fast. Get dates, new classes and show announcements by email.',
    },
  },

  about: {
    hero: {
      eyebrow: 'Our story',
      headline: 'Bringing play back to Athens.',
      summary:
        '**Little Characters** is a children’s theater in Athens, Georgia, that runs weekly classes, camps and shows where kids ages 4 and up build confidence and creativity on stage.',
      story: [
        'A few years ago, Athens lost several of its historic kids’ theater companies, and a lot of kids and families lost a place to belong. In a Pre‑K moms’ group text, local mom and theater educator {founder} started asking what it would take to bring one back.',
        'In {founded}, she started Little Characters with summer camps. Today we run weekly classes, camps, workshops and shows from our own 5,000 sq ft space on W Broad St, plus Geode for tweens, teens and adults.',
      ],
      photo: { src: 'builtin:photos/rehearsal-circle', alt: 'Students sitting in a circle on the stage floor during rehearsal', position: '50% 60%' },
    },
    services: {
      eyebrow: 'What we do',
      heading: 'What Little Characters does',
      items: [
        {
          title: 'Weekly classes',
          body: 'Acting, improv, filmmaking, writing and stagecraft, once a week through the fall and spring. Every class builds to a mid-semester showcase and an end-of-term show.',
          link: { label: 'Find a class', href: '/programs?kind=class' },
          gel: 'teal',
        },
        {
          title: 'Camps',
          body: 'Summer camp weeks, plus mini camps on CCSD school holidays, usually 9 am to 1 pm with snacks and materials included. Camp weeks end with a performance for family and friends.',
          link: { label: 'See camps', href: '/camps' },
          gel: 'orange',
        },
        {
          title: 'Shows & events',
          body: 'Showcases and end-of-term shows, a free community class once a month, and Parents’ Night Out, when kids play at HQ while grown-ups get an evening off.',
          link: { label: 'See what’s on', href: '/events' },
          gel: 'red',
        },
        {
          title: 'Ovation',
          body: 'Our adaptive theater class for friends of all ages and abilities and their caregivers: an hour of games, movement and costumes in a fun, safe space.',
          link: { label: 'About Ovation', href: '/programs/ovation' },
          gel: 'teal',
        },
        {
          title: 'Parties, lessons & schools',
          body: 'Two-hour birthday parties, private lessons, and after-school programs at Athens schools as a verified CCSD school vendor.',
          link: { label: 'Plan a party', href: '/programs/parties' },
          gel: 'yellow',
        },
        {
          title: 'Geode',
          body: 'Our sister company for tweens, teens and adults: an acting studio, a performance troupe and monthly improv nights for grown-ups.',
          link: { label: 'Visit Geode', href: '/geode' },
          gel: 'purple',
        },
      ],
    },
    differences: {
      eyebrow: 'Why families choose us',
      heading: 'What makes Little Characters different',
      photo: { src: 'builtin:photos/full-house-twisted-tales', alt: 'A full audience at a Little Characters show' },
      items: [
        {
          title: 'Every class ends in a show',
          body: 'Students perform in a mid-semester showcase and a full show at the end of the term, and each family gets 2 free tickets per student.',
        },
        {
          title: 'Small classes, more teachers',
          body: 'Classes run about 8–12 kids, with about 7–8 students per teacher. We add a teacher whenever a friend needs extra attention.',
        },
        {
          title: 'A place in the cast for every ability',
          body: 'All of our staff have worked with kids of all ages and abilities. Through the UGA Speech and Hearing Clinic, students with higher needs get a one-on-one class buddy at no cost to parents, and Ovation is our adaptive class.',
        },
        {
          title: 'Taught by people who make theater',
          body: 'Hannah has worked in theater education since 2016, with kids and adults from 3 to 50. The team includes a designer who worked on three Academy Award–nominated films at Laika, trained improvisers and a GACE-certified K–⁠12 teacher.',
        },
        {
          title: 'Our own home on W Broad St',
          body: 'A 5,000 sq ft accessible space bursting with color and natural light, about a mile from downtown, with a stage, a lobby for waiting parents and room to play.',
        },
        {
          title: 'Easy to try, fair to pay',
          body: 'New students try most weekly classes free. Pay monthly, or save {payInFullDiscount} paying the term up front or {multiDiscount} with more than one student or class, and ask us about pay-what-you-can rates.',
        },
      ],
    },
    audiences: {
      eyebrow: 'Who it’s for',
      heading: 'Who Little Characters is for',
      lede: 'Some of our students have been acting for years and some are tiptoeing on stage for the first time. Here’s where each of them fits.',
      items: [
        { label: 'Ages 4–6', gel: 'yellow', body: 'Pre-K and kindergarten: songs, stories and a first taste of the stage.', programs: ['stories-and-songs'] },
        {
          label: 'Ages 7 and up',
          gel: 'orange',
          body: 'Learn the basics, write and stage an original play, or build confidence through improv.',
          programs: ['intro-to-theater', 'produce-a-show', 'yes-and-improv'],
        },
        {
          label: 'Ages 9 and up',
          gel: 'red',
          body: 'Students ready for bigger roles, and young filmmakers who want to act and shoot on a green screen.',
          programs: ['performance-troupe', 'film-creation'],
        },
        { label: 'Homeschool families', gel: 'teal', body: 'A Friday-afternoon class for homeschool students ages 6 and up.', programs: ['homeschool-class'] },
        { label: 'Every ability', gel: 'purple', body: 'An adaptive class for all ages, and one-on-one class buddies for students with higher needs.', programs: ['ovation'] },
        {
          label: 'Tweens, teens & adults',
          gel: 'teal',
          body: 'Geode, our sister company: acting classes for ages 11–17 and monthly improv nights for adults.',
          links: [{ label: 'Geode', href: '/geode' }],
        },
      ],
    },
    beliefs: {
      eyebrow: 'What we believe',
      heading: 'Every person has a story worth telling.',
      lede: 'We use theater to help children, teens and adults discover confidence, creativity and a place where they belong. Theater is an expression of the human condition. We are all born beautiful individuals with differing gifts, and theater is a beautiful way to grow and share them.',
      valuesHeading: 'Our core values',
      // From the FAQ page on the old site.
      values: [
        { title: 'Integrity', body: 'How we treat each other, our people, our community and our performances.', gel: 'red' },
        { title: 'Connection', body: 'Building lasting relationships and trust with each other and our students.', gel: 'orange' },
        { title: 'Professionalism', body: 'Upholding our mission and working as a team so students can be part of something meaningful.', gel: 'teal' },
        { title: 'Flexibility', body: 'Having each other’s backs, pivoting when needed, taking breaks and regrouping.', gel: 'purple' },
        { title: 'Fun', body: 'Not taking ourselves too seriously, being okay with messing up, encouraging each other’s creativity.', gel: 'yellow' },
      ],
    },
    team: {
      eyebrow: 'The troupe',
      heading: 'The team behind Little Characters',
      lede: 'An incredible group of creative individuals. We are so grateful for what each of them brings to our little corner of the world.',
      social: 'Follow along on [Instagram]({instagram}) and [Facebook]({facebook}).',
      quote: 'alex',
      hiring: 'Interested in working with us? Email [{email}](mailto:{email}).',
    },
    schools: {
      eyebrow: 'Schools & community',
      heading: 'Theater at your school',
      lede: 'Little Characters is a verified CCSD school vendor. We offer after-school programs and weekend events throughout the county.',
      body: 'We’ve run programs at Athens Academy, Athens Montessori School, Oglethorpe Ave. Elementary School and Love.Craft Athens. [Ask about bringing us to your school](/contact?topic=general).',
      quote: 'gracie',
    },
    how: {
      eyebrow: 'Getting started',
      heading: 'How Little Characters works',
      notes: [
        {
          title: 'Talk to a person',
          body: 'Questions about classes, billing or your child’s needs all go to one place: [{email}](mailto:{email}) or [{phone}]({phoneHref}).',
        },
        {
          title: 'Your family account',
          body: 'Enrollments, upcoming payments, receipts and your children’s care details, all in [one place](/account). Sign in with a code we email you. There’s no password to remember.',
        },
        {
          title: 'The first day',
          body: 'Park on Minor St and walk your child to the front door, where a teacher checks everyone in. Doors lock 5 minutes after class starts.',
        },
      ],
    },
    facts: {
      eyebrow: 'At a glance',
      heading: 'Key facts about Little Characters',
      items: [
        { label: 'Name', text: '{name} ({shortName})' },
        { label: 'Type', text: 'Children’s theater school and performance company' },
        { label: 'Founded', text: '{founded}, in Athens, Georgia' },
        { label: 'Founder', text: '{founder}, {founderRole}' },
        { label: 'Location', text: '[{hqAddress}]({hqMap})' },
        { label: 'Ages', text: '4 and up. Tweens, teens and adults take classes through Geode, our sister company.' },
        {
          label: 'Programs',
          text: 'Weekly classes, camps, workshops, shows, Parents’ Night Out, parties, private lessons, school programs and Ovation (adaptive theater)',
        },
        { label: 'Class size', text: 'About 8–12 students, with about 7–8 per teacher' },
        { label: 'Tuition', text: '{tuitionRange} for weekly classes, by class length; camps about {campDay} a day' },
        {
          label: 'Payment',
          text: 'Monthly, charged on the 1st, or the whole term for {payInFullDiscount} off. {multiDiscount} off for multiple students or classes. Pay-what-you-can rates on request.',
        },
        { label: 'Free trial', text: 'First class free in most weekly classes' },
        {
          label: 'Accessibility',
          text: 'Accessible building, one-on-one class buddies through the UGA Speech and Hearing Clinic at no cost, and Ovation, an adaptive class',
        },
        {
          label: 'Schools',
          text: 'Verified CCSD school vendor. Programs at Athens Academy, Athens Montessori School, Oglethorpe Ave. Elementary School and Love.Craft Athens',
        },
        { label: 'Team', text: '{teamSize} teachers, designers and staff' },
        { label: 'Contact', text: '[{email}](mailto:{email}) · [{phone}]({phoneHref})' },
        { label: 'Website', text: '[{siteHost}]({website})' },
        { label: 'Social', text: '[Instagram]({instagram}) · [Facebook]({facebook})' },
      ],
    },
    faq: {
      heading: 'Frequently asked questions',
      questions: ['who-do-you-serve', 'can-my-child-try-a-class-first', 'will-my-child-perform', 'do-you-offer-scholarships'],
    },
  },

  camps: {
    hero: {
      eyebrow: 'Theater camps in Athens, GA',
      headline: 'A week of theater. *A show on Friday.*',
      intro:
        'Each summer we offer 3–5 weeks of camp for students 4–17, from performing an original show to improv and technical theater. During the school year, we run half-day workshops and mini camps on CCSD school holidays.',
      facts: [
        { label: 'Hours', value: '9 am – 1 pm' },
        { label: 'Cost', value: 'About $50 a day' },
        { label: 'After-camp', value: 'Until 3 pm, $30/day' },
        { label: 'The finale', value: 'A show for families' },
      ],
      summerButton: 'Summer 2027',
      miniButton: 'Mini camps & workshops',
      photo: { src: 'builtin:photos/camp-show-stage', alt: 'Campers performing a dance number for families on stage', position: '55% 40%' },
    },
    summer: {
      openTape: 'Registration open',
      openHeading: 'Summer at a glance',
      openLede: 'Pick your camper’s age to see which weeks work for them.',
      soonTape: 'Dates coming soon',
      soonHeading: 'Summer camp 2027',
      formats: [
        {
          title: 'Ages 4–10: camp weeks',
          body: 'Monday to Friday, 9 am – 1 pm. Acting and improv, emotions and characters, crafts and games, and some weeks we write our own show. About $250 a week with snacks and materials.',
          gel: 'orange',
        },
        {
          title: 'Ages 11–17: Geode intensives',
          body: 'Shorter, deeper camps for tweens and teens, like our three-day improv and writing intensive, ending in a performance of their own work.',
          gel: 'purple',
        },
      ],
      notifyHeading: 'Get first dibs on summer',
      notifyBody: 'We’ll email you as soon as summer 2027 dates and registration open.',
      notifyNote: 'Scholarships are available for every camp. [Ask us](/contact?topic=scholarship).',
    },
    mini: {
      eyebrow: 'School holidays & weekends',
      heading: 'Mini camps & workshops',
      lede: 'Most cost about $50 a day and end with a short show at pickup.',
      recentHeading: 'Recent favorites',
      // Past mini camps and workshops, from the events archive on the old site.
      recent: [
        { when: 'Mar 2026', title: 'Into the Woods Workshop', gel: 'teal' },
        { when: 'Nov 2025', title: 'KPop-a-Palooza Workshop', gel: 'red' },
        { when: 'Nov 2025', title: 'Prop Making Workshop', gel: 'orange' },
        { when: 'Sep 2025', title: 'NEWSIES! Musical Theater Workshop', gel: 'yellow' },
        { when: 'Jan 2025', title: 'Family Improv Workshop (MLK Day)', gel: 'purple' },
        { when: 'Oct 2024', title: 'Fall Break Storybook Camp', gel: 'teal' },
        { when: 'Nov 2023', title: 'Here We Come A-Caroling: Thanksgiving Mini Camp', gel: 'red' },
      ],
    },
    day: {
      eyebrow: 'Summer camp',
      heading: 'A day at camp',
      lede: 'Every camp week builds toward the last day, when families come to see the show.',
      // From the summer camp pages on the old site.
      steps: [
        { time: '9:00', what: 'Camp starts', detail: 'Warm-ups and games. Campers are split up by age for different activities.' },
        { time: 'Morning', what: 'Act, improvise, create', detail: 'Acting and improv, emotions and characters, and lots of crafts. Some weeks we write our own show.' },
        { time: 'Midday', what: 'Snack break', detail: 'Snacks and materials are included. Bring a lunch.' },
        { time: '12:30 Fri', what: 'The performance', detail: 'On the last day, campers perform for parents and friends.' },
        { time: '1:00', what: 'Pickup', detail: 'Or stay for after-camp until 3:00, Monday to Thursday, for $30 a day.' },
      ],
    },
    faq: { heading: 'Camp questions' },
  },

  geode: {
    hero: {
      eyebrow: 'A Little Characters company',
      headline: 'Geode',
      line: 'For when you’re still a character, but not so little.',
      intro:
        'Beauty surprises us when we crack open our exterior and reveal what’s inside. Geode offers classes, events and private lessons for tweens, teens and adults: fun, community-building theater without the commitment of nightly rehearsals.',
      classesButton: 'Classes',
      improvButton: 'Adult improv nights',
    },
    growing: {
      heading: 'Geode used to be just for adults. Now it’s 11 and up.',
      paragraphs: [
        'Since 2022, Little Characters has worked with students of all ages and abilities. As we’ve grown, our little kids have turned into kids, and our kids have turned into big kids, and big kids don’t always like being called little.',
        'Starting in summer 2026, Geode includes kids 11 and up. We still have adult-only programs and 11–17 programs, all under the name Geode. And how cool will it be when we can mix these groups to put on family-friendly shows with actors the ages of their characters?',
      ],
    },
    classes: {
      heading: 'Classes this fall',
      note: 'Want something custom? Been writing a script and want people to read it? Pipe dreams of a show? Could your workplace use an improv-for-communication workshop? [Let’s make it happen](/contact?topic=general).',
    },
    improv: {
      eyebrow: 'Adults · 18+',
      heading: 'Third Thursday Improv Nights',
      lede: 'First Friday Improv Nights are back, and now they’re on the third Thursday! Come hang out, play as little or as much as you like, drink what you want (we’ll check IDs), and explore improv through group and partner games.',
    },
    past: {
      heading: 'Past events',
      items: [
        {
          photo: { src: 'builtin:photos/geode-marigold-festival', alt: 'Geode performers on an outdoor stage at the Winterville Marigold Festival' },
          caption: 'Our first performance at the Winterville Marigold Festival, May 2024. It was sweaty, it was silly, and it was FUN!',
        },
        {
          photo: { src: 'builtin:photos/geode-cast-group', alt: 'A group of Geode improvisers after a show' },
          caption: 'Performing with some amazing improvisers at the Bad Ath Babes show, June 2024.',
        },
        {
          photo: { src: 'builtin:photos/geode-improv-night', alt: 'Adults laughing at an improv night', position: '50% 45%' },
          caption: 'A sneak peek into one of our monthly improv nights.',
        },
      ],
    },
  },

  give: {
    hero: {
      eyebrow: 'The scholarship fund',
      headline: 'Help a kid take the stage.',
      intro:
        'Donations to Little Characters go directly to supporting our programs. Your gift gives kids in the Athens area a safe place to express themselves and step into the world of theater, and lets us offer pay-what-you-can rates to any family who needs them.',
      giveButton: 'Give now',
      scholarshipButton: 'Ask about a scholarship',
    },
    impact: {
      heading: 'What your gift covers',
      // Using real Fall 2026 prices.
      items: [
        { amount: '$30', what: 'A student’s performance fee, so they can be in the show', gel: 'yellow' },
        { amount: '$95', what: 'A month of Intro to Theater or Yes, And… Improv', gel: 'teal' },
        { amount: '$160', what: 'All 8 weeks of Stories and Songs for a 4- to 6-year-old', gel: 'red' },
        { amount: '$250', what: 'A full week of summer camp, snacks and materials included', gel: 'purple' },
      ],
    },
    ways: {
      heading: 'Other ways to help',
      // "How can I support LC?", from the FAQ page on the old site.
      items: [
        { title: 'Volunteer', body: 'Help with classes, camps, shows or events.', link: { label: 'Email us', href: 'mailto:{email}?subject=Volunteering' } },
        { title: 'Donate costumes & props', body: 'Costumes, props and set pieces all find a home on our stage.', link: { label: 'Email us', href: 'mailto:{email}?subject=Donation' } },
        { title: 'Shop our wish list', body: 'Pick up something we need from our Amazon Wish List.', link: { label: 'See the wish list', href: '{wishList}' } },
        { title: 'Become a sponsor', body: 'Local businesses help keep our programs going. Let’s talk.', link: { label: 'Get in touch', href: '/contact?topic=general' } },
      ],
    },
    scholarship: {
      heading: 'Need a scholarship?',
      body: 'We never want cost to keep a student from joining our programs, and we’re happy to arrange a pay-what-you-can rate. Email [{email}](mailto:{email}?subject=Scholarship) for the scholarship application.',
    },
  },

  contact: {
    hero: {
      eyebrow: 'Say hello',
      headline: 'Contact us!',
      intro: 'Interested but need more info? The class times don’t work for you? Questions about scholarships? We’re eager to make a class work for your family.',
    },
    parking: { eyebrow: 'One of our favorite topics', heading: 'Parking & drop-off' },
  },

  faq: {
    hero: {
      eyebrow: 'Parent handbook',
      headline: 'Questions parents ask',
      intro: 'Can’t find it here? Email [{email}](mailto:{email}) or call [{phone}]({phoneHref}).',
    },
  },

  classes: {
    hero: {
      eyebrow: 'Classes, camps & more',
      headline: 'Find a class',
      intro: 'Start with your child’s age. Every program shows its times, place, price and open spots, so you can enroll right from this page.',
    },
  },

  events: {
    hero: {
      eyebrow: 'House lights down',
      headline: 'Shows & events',
      intro:
        'Come see what our students have been working on, drop the kids off for a night of games and crafts, try a free class, or play along yourself.',
    },
    perform: {
      heading: 'Want your kid on this stage?',
      body: 'Every class has a mid-semester showcase and ends with a big show, and each student gets 2 free tickets for family.',
      button: 'Find a class',
    },
  },
};
