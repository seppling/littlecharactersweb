import type { Price, Program, Session, Weekday } from './types';

/*
 * Program catalog.
 *
 * Program names, descriptions, ages bands, prices and policies come from the
 * current littlecharacters.org site (see docs/content-inventory.md).
 * Days, times and term dates below are PLACEHOLDERS so the class finder can
 * be designed against realistic data; Hannah should replace them with the
 * real schedule before launch.
 */

// Monthly tuition tiers from the current Classes page.
const TUITION = {
  short: { amount: 85, unit: 'month', note: '45-minute class' },
  hour: { amount: 95, unit: 'month', note: '1-hour class' },
  long: { amount: 115, unit: 'month', note: '1¼-hour class' },
} satisfies Record<string, Price>;

const CAMP_DAY: Price = { amount: 50, unit: 'day' };

const FALL = { term: 'Fall 2026', startDate: '2026-09-08', endDate: '2026-12-12' };
const SPRING = { term: 'Spring 2027', startDate: '2027-01-11', endDate: '2027-05-15' };

function weekly(
  id: string,
  days: Weekday[],
  start: string,
  end: string,
  price: Price | undefined,
  extra: Partial<Session> = {},
): Session {
  return { id, ...FALL, days, start, end, locationId: 'hq', price, status: 'open', ...extra };
}

export const programs: Program[] = [
  // ───────────────────────── Weekly classes ─────────────────────────
  {
    slug: 'abcs-of-theater',
    title: 'ABCs of Theater',
    kind: 'class',
    brand: 'lc',
    gel: 'amber',
    ages: { min: 4, max: 6 },
    tagline: 'First steps on stage, with songs, games and a lot of pretending.',
    summary:
      'Our youngest characters learn the building blocks of theater through games, activities and songs, and finish the term with a sweet little show for families.',
    description: [
      'ABCs of Theater is where it all starts. Each class mixes circle games, movement, music and pretend play so four- to six-year-olds can practice listening, taking turns and using their big voices in a room that feels safe and silly.',
      'Students build characters, try on costumes and act out simple stories together.',
    ],
    highlights: ['Listening and taking turns', 'Using voice and body to tell a story', 'Confidence in front of a friendly crowd', 'Songs and movement games'],
    showcase: 'Ends with a short end-of-term show for families.',
    duration: '45 minutes, once a week',
    priceFrom: TUITION.short,
    image: { alt: 'Preschoolers in costume hats playing a pretend game', placeholder: 'ABCs class in costume hats' },
    sessions: [
      weekly('abcs-f26-tue', ['Tue'], '16:00', '16:45', TUITION.short, { spotsLeft: 4, capacity: 12, status: 'few-left' }),
      weekly('abcs-f26-sat', ['Sat'], '09:30', '10:15', TUITION.short, { spotsLeft: 7, capacity: 12 }),
    ],
    featured: true,
  },
  {
    slug: 'theater-games',
    title: 'Theater Games',
    kind: 'class',
    brand: 'lc',
    gel: 'green',
    ages: { min: 5, max: 8 },
    tagline: 'Play-first theater for kids who learn by moving.',
    summary:
      'High-energy theater games that build focus, teamwork and quick thinking. Great for first-timers and kids who would rather play than memorize lines.',
    description: [
      'Theater Games is a playground for the imagination. Students warm up their voices and bodies, then play the classic games actors use to build focus, trust and quick thinking.',
      'No scripts and no pressure, just a room full of laughter and a teacher who knows when to push and when to play.',
    ],
    highlights: ['Focus and self-control', 'Teamwork and trust', 'Thinking on your feet', 'Stage presence'],
    showcase: 'Performs a game or two in the LC Variety Show.',
    duration: '45 minutes, once a week',
    priceFrom: TUITION.short,
    image: { alt: 'Kids in a circle mid-game, arms in the air', placeholder: 'Theater Games warm-up circle' },
    sessions: [weekly('games-f26-thu', ['Thu'], '16:00', '16:45', TUITION.short, { spotsLeft: 6, capacity: 14 })],
  },
  {
    slug: 'intro-to-theater',
    title: 'Intro to Theater',
    kind: 'class',
    brand: 'lc',
    gel: 'magenta',
    ages: { min: 6, max: 9 },
    tagline: 'Singing, dancing, and finding your character.',
    summary:
      'A well-rounded first class in vocality, movement and character exploration, with singing, dancing and plenty of cuteness along the way.',
    description: [
      'Intro to Theater gives young performers a taste of everything: voice, movement, character work and a little bit of song and dance.',
      'Students learn how actors warm up, how to project, and how to make choices about who their character is and what they want. It is the perfect launch pad for Produce a Show or Kids Improv.',
    ],
    highlights: ['Voice and projection', 'Movement and dance basics', 'Building a character', 'Performing with a group'],
    showcase: 'Performs in the end-of-term LC Variety Show.',
    duration: '1 hour, once a week',
    priceFrom: TUITION.hour,
    image: { alt: 'Students striking big character poses on stage', placeholder: 'Intro to Theater character poses' },
    sessions: [
      weekly('intro-f26-mon', ['Mon'], '16:30', '17:30', TUITION.hour, { spotsLeft: 5, capacity: 14 }),
      weekly('intro-f26-wed', ['Wed'], '16:30', '17:30', TUITION.hour, { spotsLeft: 0, capacity: 14, status: 'waitlist' }),
    ],
    featured: true,
  },
  {
    slug: 'kids-improv',
    title: 'Kids Improv',
    kind: 'class',
    brand: 'lc',
    gel: 'cyan',
    ages: { min: 7, max: 10 },
    tagline: 'Say “yes, and…” to confidence.',
    summary:
      'Through theater games, improv scenes and performance opportunities, students learn collaboration, confidence and communication skills.',
    description: [
      'Improv teaches kids to listen closely, build on each other’s ideas and trust themselves when they don’t know what comes next. Those are stage skills and life skills.',
      'Each class moves from warm-ups to games to short scenes, with lots of chances to perform for classmates in a supportive room.',
    ],
    highlights: ['Collaboration', 'Confidence', 'Communication', 'Comedy basics'],
    showcase: 'Performs in the LC Variety Show.',
    duration: '1 hour, once a week',
    priceFrom: TUITION.hour,
    image: { alt: 'Two kids mid-scene, one pretending to be a robot', placeholder: 'Kids Improv scene work' },
    sessions: [weekly('improv-f26-tue', ['Tue'], '17:00', '18:00', TUITION.hour, { spotsLeft: 3, capacity: 14, status: 'few-left' })],
    featured: true,
  },
  {
    slug: 'produce-a-show',
    title: 'Produce a Show',
    kind: 'class',
    brand: 'lc',
    gel: 'amber',
    ages: { min: 7, max: 11 },
    tagline: 'For creative minds and mini producers.',
    summary:
      'Students create their own story, turn it into a script, and prepare to bring it to life on stage at the end of the semester.',
    description: [
      'In Produce a Show, the students are the playwrights, designers and cast. Together they dream up a story, write the script, plan costumes and props, and rehearse it into a real show.',
      'It is the class where shy kids find their voice and big personalities learn to share the spotlight.',
      'Produce a Show is open to students who have already taken a Little Characters class or camp.',
    ],
    highlights: ['Story and script writing', 'Rehearsal and blocking', 'Costume and prop design', 'Working as an ensemble'],
    showcase: 'Performs an original show at the end of the semester.',
    duration: '1¼ hours, once a week',
    priceFrom: TUITION.long,
    image: { alt: 'Students gathered around a handwritten script', placeholder: 'Writing the script together' },
    sessions: [
      weekly('produce-f26-wed', ['Wed'], '17:00', '18:15', TUITION.long, { spotsLeft: 6, capacity: 14 }),
      weekly('produce-f26-sat', ['Sat'], '10:30', '11:45', TUITION.long, { spotsLeft: 2, capacity: 14, status: 'few-left' }),
    ],
    featured: true,
  },
  {
    slug: 'intermediate-improv',
    title: 'Intermediate Improv',
    kind: 'class',
    brand: 'lc',
    gel: 'cyan',
    ages: { min: 9, max: 13 },
    tagline: 'Level 2 for kids who already love improv.',
    summary:
      'For students with prior improv experience. We dig deeper into characters and explore scene work, rhyming, puns and more.',
    description: [
      'Intermediate Improv builds on the basics with longer scenes, stronger characters and the wordplay kids love: rhyming games, puns and song improv.',
      'Students should have taken Kids Improv or have similar experience. Not sure? Ask us and we will help you pick.',
    ],
    highlights: ['Scene structure', 'Character depth', 'Wordplay and rhyme', 'Performing for an audience'],
    showcase: 'Performs in the LC Variety Show.',
    duration: '1 hour, once a week',
    priceFrom: TUITION.hour,
    image: { alt: 'Improv students laughing on stage', placeholder: 'Level 2 improv scene' },
    sessions: [weekly('improv2-f26-thu', ['Thu'], '17:00', '18:00', TUITION.hour, { spotsLeft: 5, capacity: 14 })],
  },
  {
    slug: 'film-101',
    title: 'Film 101',
    kind: 'class',
    brand: 'lc',
    gel: 'magenta',
    ages: { min: 9, max: 14 },
    tagline: 'Acting for the camera, from script to screen.',
    summary:
      'An introduction to all things acting for the camera. Students explore genres, storytelling, acting, scriptwriting and camera work.',
    description: [
      'Film 101 introduces young performers to how acting changes when the camera is rolling. Students try on different genres, write short scripts, and take turns in front of and behind the camera.',
      'By the end of the term, the class has made short films together.',
    ],
    highlights: ['On-camera acting', 'Genre and storytelling', 'Scriptwriting', 'Camera basics'],
    showcase: 'Short films screen at the LC Variety Show.',
    duration: '1¼ hours, once a week',
    priceFrom: TUITION.long,
    image: { alt: 'A student filming classmates with a phone on a tripod', placeholder: 'Film 101 on set' },
    sessions: [weekly('film-f26-mon', ['Mon'], '17:45', '19:00', TUITION.long, { spotsLeft: 5, capacity: 12 })],
  },
  {
    slug: 'scenes-and-monologues',
    title: 'Scenes & Monologues',
    kind: 'class',
    brand: 'lc',
    gel: 'lilac',
    ages: { min: 10, max: 14 },
    tagline: 'Dig deep into character with real scripts.',
    summary:
      'Students dig deep into characterization through pre-written short plays, scenes and monologues, and pick up more advanced improv techniques.',
    description: [
      'Scenes & Monologues is for students ready to work with scripts. They learn how to read a scene, make choices about their character, and memorize and perform with intention.',
      'It is great preparation for school productions and auditions.',
    ],
    highlights: ['Script analysis', 'Memorization', 'Characterization', 'Audition confidence'],
    showcase: 'Performs scenes in the LC Variety Show.',
    duration: '1¼ hours, once a week',
    priceFrom: TUITION.long,
    image: { alt: 'A student performing a monologue under a spotlight', placeholder: 'Monologue in the spotlight' },
    sessions: [weekly('scenes-f26-thu', ['Thu'], '18:15', '19:30', TUITION.long, { spotsLeft: 6, capacity: 12 })],
  },
  {
    slug: 'middle-school-improv',
    title: 'Middle School Improv',
    kind: 'class',
    brand: 'lc',
    gel: 'green',
    ages: { min: 11, max: 14 },
    tagline: 'A place to be weird, quick and funny with your people.',
    summary: 'Improv for middle schoolers: games, scenes and characters in a room built for trying things and laughing at the result.',
    description: [
      'Middle school is a lot. Middle School Improv is a weekly hour where students get to be quick, silly and brave with peers their own age.',
      'We work on listening, building scenes together and the comedic instincts that make great improvisers.',
    ],
    highlights: ['Scene work', 'Comedic timing', 'Group games', 'Confidence with peers'],
    showcase: 'Performs in the LC Variety Show.',
    duration: '1 hour, once a week',
    priceFrom: TUITION.hour,
    image: { alt: 'Middle schoolers mid-laugh in an improv game', placeholder: 'Middle School Improv' },
    sessions: [weekly('msimprov-f26-tue', ['Tue'], '18:15', '19:15', TUITION.hour, { spotsLeft: 8, capacity: 14 })],
  },
  {
    slug: 'techies',
    title: 'Techies',
    kind: 'class',
    brand: 'lc',
    gel: 'amber',
    ages: { min: 10, max: 17 },
    tagline: 'For students who’d rather be behind the curtain.',
    summary:
      'Technical theater for students who love building, designing and running the show: sets, props, costumes, lights and sound.',
    description: [
      'Not every theater kid wants the spotlight. Techies is for students who want to build it. Students learn set and prop construction, costume basics, lighting and sound, and what a stage manager actually does.',
      'Techies get hands-on experience supporting our showcases from backstage.',
    ],
    highlights: ['Set and prop building', 'Costume basics', 'Lighting and sound', 'Stage management'],
    showcase: 'Supports the LC Variety Show from backstage.',
    duration: '1¼ hours, once a week',
    priceFrom: TUITION.long,
    image: { alt: 'Students painting a set piece', placeholder: 'Techies painting a set' },
    sessions: [
      { id: 'techies-s27-sat', ...SPRING, days: ['Sat'], start: '12:00', end: '13:15', locationId: 'hq', price: TUITION.long, status: 'coming-soon' },
    ],
  },
  {
    slug: 'athens-academy-enrichment',
    title: 'Athens Academy Enrichment',
    kind: 'class',
    brand: 'lc',
    gel: 'cyan',
    ages: { min: 5, max: 11 },
    tagline: 'After-school theater for Athens Academy Lower School students.',
    summary:
      'An 8-week course covering voice, movement, emotion, character exploration and improv, ending in a performance. Registration is through Athens Academy.',
    description: [
      'Little Characters is proud to present the first-ever Lower School theater enrichment course at Athens Academy. This 8-week course broadens students’ view of all things theater, covering voice, movement, emotion, character exploration and improv.',
      'Teachers meet students where they are, whether they are made for the stage or more interested in what happens behind the scenes.',
    ],
    highlights: ['Voice and movement', 'Emotion and character', 'Improv', 'Teamwork and individuality'],
    showcase: 'Ends with a performance for families.',
    duration: '1¼ hours, once a week for 8 weeks',
    image: { alt: 'Lower School students on stage at Athens Academy', placeholder: 'Athens Academy enrichment' },
    sessions: [
      {
        id: 'aa-lower-f26',
        term: 'Fall 2026',
        days: ['Mon'],
        start: '16:00',
        end: '17:15',
        startDate: '2026-09-14',
        endDate: '2026-11-09',
        locationId: 'athens-academy',
        status: 'open',
        teacher: 'CC Conner & Carley Peden',
        externalUrl: 'https://www.activekids.com/athens-ga/performing-arts/camp/lower-school-little-characters-enrichment-2026',
        externalLabel: 'Register via Athens Academy',
      },
    ],
  },

  // ───────────────────────── Camps ─────────────────────────
  {
    slug: 'thanksgiving-mini-camp',
    title: 'Thanksgiving Mini Camp',
    kind: 'camp',
    brand: 'lc',
    gel: 'amber',
    ages: { min: 5, max: 11 },
    tagline: 'Three mornings of theater while school is out.',
    summary: 'A holiday mini camp on CCSD’s Thanksgiving break: games, crafts and a short show for families on the last day.',
    description: [
      'When school is out, the stage is open. Our holiday mini camps pack a week of theater fun into a few mornings, with warm-ups, games, crafts and a mini performance on the final day.',
      'Book one day or all three.',
    ],
    highlights: ['Theater games', 'Crafts and costumes', 'A mini show on the last day'],
    showcase: 'Families are invited to a short show at pickup on the last day.',
    duration: '9:00 am – 1:00 pm',
    priceFrom: CAMP_DAY,
    image: { alt: 'Campers in paper crowns taking a bow', placeholder: 'Holiday mini camp bow' },
    sessions: [
      { id: 'tg-mini-26', term: 'Thanksgiving 2026', days: ['Mon', 'Tue', 'Wed'], start: '09:00', end: '13:00', startDate: '2026-11-23', endDate: '2026-11-25', locationId: 'hq', price: CAMP_DAY, spotsLeft: 9, capacity: 16, status: 'open' },
    ],
    featured: true,
  },
  {
    slug: 'winter-break-mini-camp',
    title: 'Winter Break Mini Camp',
    kind: 'camp',
    brand: 'lc',
    gel: 'cyan',
    ages: { min: 5, max: 11 },
    tagline: 'Cozy, silly, stage-y mornings over winter break.',
    summary: 'Three mornings of winter-themed theater games, stories and crafts during CCSD winter break.',
    description: [
      'Winter Break Mini Camp keeps kids moving, creating and laughing during the break. Each morning has a theme and ends with a short sharing for friends.',
    ],
    highlights: ['Themed theater games', 'Story building', 'Crafts', 'A sharing on the last day'],
    duration: '9:00 am – 1:00 pm',
    priceFrom: CAMP_DAY,
    image: { alt: 'Kids in scarves acting out a snowy scene', placeholder: 'Winter break mini camp' },
    sessions: [
      { id: 'winter-mini-26', term: 'Winter break 2026', days: ['Mon', 'Tue', 'Wed'], start: '09:00', end: '13:00', startDate: '2026-12-21', endDate: '2026-12-23', locationId: 'hq', price: CAMP_DAY, spotsLeft: 14, capacity: 16, status: 'open' },
    ],
  },
  {
    slug: 'little-characters-camp',
    title: 'Little Characters Camp',
    kind: 'camp',
    brand: 'lc',
    gel: 'magenta',
    ages: { min: 4, max: 6 },
    tagline: 'A first summer camp, sized for small people.',
    summary: 'Half-day summer camp for our youngest campers, with songs, stories, games and a tiny show at the end of the week.',
    description: [
      'Little Characters Camp is a gentle first camp for ages 4–6. Each day mixes story time, dress-up, music and movement, and the week ends with a tiny show for families.',
      'Like all our camps, it runs with at most 8 campers per counselor.',
    ],
    highlights: ['Songs and stories', 'Dress-up and pretend play', 'Making friends', 'A tiny show on Friday'],
    showcase: 'Friday performance for families.',
    duration: '9:00 am – 12:00 pm, Monday to Friday',
    priceFrom: CAMP_DAY,
    image: { alt: 'Four-year-olds in animal costumes', placeholder: 'Little Characters Camp' },
    sessions: [
      { id: 'lcc-s27-w1', term: 'Summer 2027', label: 'Week 1', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start: '09:00', end: '12:00', startDate: '2027-06-07', endDate: '2027-06-11', locationId: 'hq', price: CAMP_DAY, status: 'coming-soon' },
      { id: 'lcc-s27-w4', term: 'Summer 2027', label: 'Week 4', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start: '09:00', end: '12:00', startDate: '2027-07-12', endDate: '2027-07-16', locationId: 'hq', price: CAMP_DAY, status: 'coming-soon' },
    ],
  },
  {
    slug: 'produce-a-show-camp',
    title: 'Produce a Show Camp',
    kind: 'camp',
    brand: 'lc',
    gel: 'amber',
    ages: { min: 6, max: 10 },
    tagline: 'Write it Monday. Perform it Friday.',
    summary: 'Campers create an original show from scratch in one week, then perform it on the Marigold Auditorium stage.',
    description: [
      'In Produce a Show Camp, campers pitch the story, write the script, design costumes and props, and rehearse, all in five days. On Friday, they perform it for families on a real stage.',
    ],
    highlights: ['Writing an original story', 'Costumes, props and sets', 'Rehearsing as a cast', 'Performing on a real stage'],
    showcase: 'Friday performance at Marigold Auditorium.',
    duration: '9:00 am – 1:00 pm, Monday to Friday',
    priceFrom: CAMP_DAY,
    image: { alt: 'Campers performing an original show at Marigold Auditorium', placeholder: 'Friday show at Marigold' },
    sessions: [
      { id: 'pasc-s27-w1', term: 'Summer 2027', label: 'Week 1', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start: '09:00', end: '13:00', startDate: '2027-06-07', endDate: '2027-06-11', locationId: 'marigold', price: CAMP_DAY, status: 'coming-soon' },
      { id: 'pasc-s27-w3', term: 'Summer 2027', label: 'Week 3', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start: '09:00', end: '13:00', startDate: '2027-06-21', endDate: '2027-06-25', locationId: 'marigold', price: CAMP_DAY, status: 'coming-soon' },
      { id: 'pasc-s27-w5', term: 'Summer 2027', label: 'Week 5', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start: '09:00', end: '13:00', startDate: '2027-07-19', endDate: '2027-07-23', locationId: 'marigold', price: CAMP_DAY, status: 'coming-soon' },
    ],
    featured: true,
  },
  {
    slug: 'improv-camp',
    title: 'Improv Camp',
    kind: 'camp',
    brand: 'lc',
    gel: 'cyan',
    ages: { min: 8, max: 12 },
    tagline: 'A week of games, scenes and big laughs.',
    summary: 'A week of improv games and scene work that ends with an improv show for families.',
    description: [
      'Improv Camp is a week of “yes, and.” Campers learn the games and skills improvisers use, build characters on the fly, and finish with a show where the audience makes the suggestions.',
    ],
    highlights: ['Improv games', 'Characters on the fly', 'Listening and teamwork', 'A Friday improv show'],
    showcase: 'Friday improv show with audience suggestions.',
    duration: '9:00 am – 1:00 pm, Monday to Friday',
    priceFrom: CAMP_DAY,
    image: { alt: 'Campers mid-improv game', placeholder: 'Improv Camp' },
    sessions: [
      { id: 'improvc-s27-w2', term: 'Summer 2027', label: 'Week 2', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start: '09:00', end: '13:00', startDate: '2027-06-14', endDate: '2027-06-18', locationId: 'hq', price: CAMP_DAY, status: 'coming-soon' },
      { id: 'improvc-s27-w4', term: 'Summer 2027', label: 'Week 4', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start: '09:00', end: '13:00', startDate: '2027-07-12', endDate: '2027-07-16', locationId: 'hq', price: CAMP_DAY, status: 'coming-soon' },
    ],
  },
  {
    slug: 'technical-theater-camp',
    title: 'Technical Theater Camp',
    kind: 'camp',
    brand: 'lc',
    gel: 'green',
    ages: { min: 10, max: 17 },
    tagline: 'Build the world the actors live in.',
    summary: 'Sets, props, lights and sound. Campers design and build the tech for a real show.',
    description: [
      'Technical Theater Camp is for makers. Campers design and build set pieces and props, learn to hang and focus lights, run sound, and call the cues for the Friday show.',
    ],
    highlights: ['Set and prop building', 'Lighting and sound', 'Calling a show', 'Working as a crew'],
    showcase: 'Runs the tech for the Friday show.',
    duration: '9:00 am – 1:00 pm, Monday to Friday',
    priceFrom: CAMP_DAY,
    image: { alt: 'Teen campers focusing a stage light', placeholder: 'Tech camp on the catwalk' },
    sessions: [
      { id: 'techc-s27-w3', term: 'Summer 2027', label: 'Week 3', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start: '09:00', end: '13:00', startDate: '2027-06-21', endDate: '2027-06-25', locationId: 'marigold', price: CAMP_DAY, status: 'coming-soon' },
    ],
  },
  {
    slug: 'teen-improv-intensive',
    title: 'Teen Improv & Writing Intensive',
    kind: 'camp',
    brand: 'lc',
    gel: 'lilac',
    ages: { min: 11, max: 17 },
    tagline: 'Three days to write and perform your own material.',
    summary:
      'A three-day intensive for 11–17 year olds focused on improv techniques and writing their own performance. $150 covers the week, snacks and materials.',
    description: [
      'The intensive is built for older students who want to go deeper. Mornings are improv technique; the rest of the day is spent writing and polishing original material, which the group performs on the last day.',
      'Lunch is not included.',
    ],
    highlights: ['Improv technique', 'Writing original material', 'Performing your own work'],
    showcase: 'Performance on the final day.',
    duration: '9:00 am – 1:00 pm, three days',
    priceFrom: { amount: 150, unit: 'session', note: 'Covers the week, snacks and materials' },
    image: { alt: 'Teens workshopping a sketch around a table', placeholder: 'Teen writing intensive' },
    sessions: [
      { id: 'teen-int-s27', term: 'Summer 2027', days: ['Tue', 'Wed', 'Thu'], start: '09:00', end: '13:00', startDate: '2027-06-22', endDate: '2027-06-24', locationId: 'hq', price: { amount: 150, unit: 'session' }, status: 'coming-soon' },
    ],
  },
  {
    slug: 'fun-mondays',
    title: 'Fun Mondays with CC',
    kind: 'camp',
    brand: 'lc',
    gel: 'magenta',
    ages: { min: 5, max: 11 },
    tagline: 'Summer afternoons of theater, one Monday at a time.',
    summary: 'Drop-in summer afternoons at HQ where students discover the best parts of theater through weekly themes. Can be added on to a camp week.',
    description: [
      'Fun Mondays with CC are summer afternoons at HQ built around a new theme each week. Come to one or come to all of them.',
      'Register by noon the Sunday before.',
    ],
    highlights: ['A new theme every week', 'Theater games and crafts', 'Pairs well with a morning camp'],
    duration: '1:00 – 5:00 pm',
    image: { alt: 'CC leading a group game', placeholder: 'Fun Mondays with CC' },
    sessions: [
      { id: 'funmon-s27', term: 'Summer 2027', label: 'Summer Mondays', days: ['Mon'], start: '13:00', end: '17:00', startDate: '2027-06-07', endDate: '2027-07-12', locationId: 'hq', status: 'coming-soon', teacher: 'CC Conner' },
    ],
  },

  // ───────────────────────── Everything else ─────────────────────────
  {
    slug: 'private-lessons',
    title: 'Private Lessons',
    kind: 'lesson',
    brand: 'lc',
    gel: 'lilac',
    ages: { min: 5, max: null },
    tagline: 'One-on-one coaching, booked by the hour.',
    summary: 'Hourly private lessons for audition help, playwriting, one-on-one acting and singing.',
    description: [
      'Private lessons are booked by the hour and built around what the student needs: preparing an audition, working on a monologue, writing a play, or building singing confidence.',
    ],
    highlights: ['Audition prep', 'Playwriting help', 'One-on-one acting', 'Singing lessons'],
    showcase: 'Private lesson students are welcome to perform in the LC Variety Show.',
    duration: 'By the hour',
    image: { alt: 'A teacher coaching a student with a script', placeholder: 'Private lesson' },
    sessions: [],
    requestCta: { label: 'Request a lesson', href: '/contact?topic=private-lessons' },
  },
  {
    slug: 'ovation',
    title: 'Ovation',
    kind: 'inclusive',
    brand: 'lc',
    gel: 'green',
    ages: { min: 4, max: null },
    tagline: 'A space to interact, create and play.',
    summary:
      'A monthly class for people with special needs, in partnership with It’s Good to See You Productions. An hour of games, movement and costumes in a fun, safe environment.',
    description: [
      'Ovation is a monthly class for people with special needs, offered in partnership with It’s Good to See You Productions and hosted at Brella Studio.',
      'Participants spend an hour playing games, exploring movement and costumes, and enjoying a fun and safe environment. Scholarships are available.',
    ],
    highlights: ['Games and movement', 'Costume exploration', 'A welcoming, sensory-aware room'],
    duration: '1 hour, monthly',
    priceFrom: { amount: 15, unit: 'class', note: 'Scholarships available' },
    image: { alt: 'Ovation participants playing a movement game', placeholder: 'Ovation' },
    sessions: [
      { id: 'ovation-f26', term: 'Fall 2026', label: 'Oct 10 · Nov 14 · Dec 12', days: ['Sat'], start: '10:00', end: '11:00', startDate: '2026-10-10', endDate: '2026-12-12', locationId: 'brella', price: { amount: 15, unit: 'class' }, status: 'open' },
    ],
  },
  {
    slug: 'birthday-parties',
    title: 'Birthday Parties',
    kind: 'party',
    brand: 'lc',
    gel: 'magenta',
    ages: { min: 4, max: 12 },
    tagline: 'Two hours, one stage, and the birthday kid as the star.',
    summary:
      'Customizable two-hour parties on evenings or weekends at HQ, with theater games, your own teacher and party coordinator, a stage for dance parties and presents, and tables for cake.',
    description: [
      'Birthday parties at Little Characters are two hours long and fully customizable. Your teacher and party coordinator leads theater games built around the birthday kid’s favorite story or theme.',
      'The stage doubles as a dance floor and a spot for present-opening, and there are tables and chairs ready for cake and snacks.',
    ],
    highlights: ['Theater games and content', 'Your own teacher/party coordinator', 'A stage for dance parties and presents', 'Tables and chairs for cake and snacks'],
    duration: '2 hours, evenings or weekends',
    image: { alt: 'A birthday kid in a cape on stage with friends', placeholder: 'Birthday on stage' },
    sessions: [],
    requestCta: { label: 'Request a party date', href: '/contact?topic=party' },
  },
  {
    slug: 'parents-night-out',
    title: 'Parents’ Night Out',
    kind: 'party',
    brand: 'lc',
    gel: 'cyan',
    ages: { min: 4, max: 11 },
    tagline: 'They play, craft and snack. You get a night out.',
    summary:
      'An evening of crafts and theater games at HQ while you head downtown, only a mile away. Kids play, craft and snack until 8.',
    description: [
      'Bring the kids for an evening full of crafts and theater games while you and your loved one get some time to yourselves.',
      'Downtown is only a mile away, so pencil in date night while the kids play, craft and snack until 8.',
    ],
    highlights: ['Theater games', 'Crafts', 'Snacks', 'Pickup by 8 pm'],
    duration: 'Evenings until 8:00 pm',
    image: { alt: 'Kids crafting masks at a long table', placeholder: 'Parents’ Night Out crafts' },
    sessions: [
      { id: 'pno-2026-10-16', term: 'Fall 2026', label: 'Fri, Oct 16', days: ['Fri'], start: '17:00', end: '20:00', startDate: '2026-10-16', endDate: '2026-10-16', locationId: 'hq', status: 'open', spotsLeft: 10, capacity: 20 },
      { id: 'pno-2026-12-11', term: 'Fall 2026', label: 'Fri, Dec 11', days: ['Fri'], start: '17:00', end: '20:00', startDate: '2026-12-11', endDate: '2026-12-11', locationId: 'hq', status: 'open', spotsLeft: 18, capacity: 20 },
    ],
  },

  // ───────────────────────── Geode (teens & adults) ─────────────────────────
  {
    slug: 'geode-acting-improv',
    title: 'Acting & Improv Deep Dive',
    kind: 'class',
    brand: 'geode',
    gel: 'lilac',
    ages: { min: 12, max: 17 },
    tagline: 'For teens ready to go deeper.',
    summary:
      'A deep dive into acting and improvisation. Performers strengthen characterization, explore voice and movement, and sharpen their comedic instincts in scripted and unscripted scenes.',
    description: [
      'This Geode class is a deep dive into acting and improvisation. Performers strengthen characterization, explore voice and movement, and sharpen their comedic instincts in both scripted and unscripted scenes.',
      'The term culminates in a live public performance.',
    ],
    highlights: ['Characterization', 'Voice and movement', 'Scripted and unscripted scenes', 'Comedic instincts'],
    showcase: 'Culminates in a live public performance.',
    duration: '1¼ hours, once a week',
    priceFrom: TUITION.long,
    image: { alt: 'Teen actors rehearsing a scene', placeholder: 'Geode teen ensemble' },
    sessions: [weekly('geode-teen-f26-wed', ['Wed'], '18:30', '19:45', TUITION.long, { spotsLeft: 7, capacity: 14 })],
  },
  {
    slug: 'geode-adult-improv',
    title: 'Improv for Grown-Ups',
    kind: 'class',
    brand: 'geode',
    gel: 'lilac',
    ages: { min: 18, max: null },
    tagline: 'Play is not just for kids.',
    summary: 'A weekly adult improv class for anyone who wants to laugh more, think faster and meet new people in Athens.',
    description: [
      'Geode brings the joy of theater to adults. This weekly class is for total beginners and rusty performers alike: games, scenes and a lot of laughing.',
      'Geode strives to deepen social and emotional health in a safe, fun environment through the art of theater.',
    ],
    highlights: ['Beginner friendly', 'Listening and spontaneity', 'Meet people in Athens'],
    duration: '1½ hours, once a week',
    image: { alt: 'Adults laughing in an improv circle', placeholder: 'Geode adult improv' },
    sessions: [weekly('geode-adult-f26-tue', ['Tue'], '19:30', '21:00', undefined, { spotsLeft: 5, capacity: 14 })],
  },
];

export const lcPrograms = programs.filter((p) => p.brand === 'lc');
export const geodePrograms = programs.filter((p) => p.brand === 'geode');
export const programBySlug = (slug: string) => programs.find((p) => p.slug === slug);

export const kindLabels: Record<Program['kind'], { singular: string; plural: string }> = {
  class: { singular: 'Weekly class', plural: 'Weekly classes' },
  camp: { singular: 'Camp', plural: 'Camps' },
  workshop: { singular: 'Workshop', plural: 'Workshops' },
  lesson: { singular: 'Private lessons', plural: 'Private lessons' },
  inclusive: { singular: 'Inclusive program', plural: 'Inclusive programs' },
  party: { singular: 'Parties & nights out', plural: 'Parties & nights out' },
};

/** Age bands used by the age picker and finder. */
export const ageBands = [
  { id: '4-6', label: '4–6', min: 4, max: 6 },
  { id: '7-10', label: '7–10', min: 7, max: 10 },
  { id: '11-13', label: '11–13', min: 11, max: 13 },
  { id: '14-17', label: '14–17', min: 14, max: 17 },
  { id: 'adult', label: 'Adults', min: 18, max: 120 },
] as const;
