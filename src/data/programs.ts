import type { Focus, Price, Program, Session, Weekday } from './types';

import castSillyFaces from '@/assets/photos/cast-silly-faces.webp';
import rehearsalCircle from '@/assets/photos/rehearsal-circle.webp';
import campShowStage from '@/assets/photos/camp-show-stage.webp';
import teacherWithStudents from '@/assets/photos/teacher-with-students.webp';
import rehearsingOnStage from '@/assets/photos/rehearsing-on-stage.webp';
import carnivalShow from '@/assets/photos/carnival-show.webp';
import filmArmsOut from '@/assets/photos/film-green-screen-arms-out.webp';
import filmWand from '@/assets/photos/film-green-screen-wand.webp';
import filmSunhat from '@/assets/photos/film-green-screen-sunhat.webp';
import filmPirate from '@/assets/photos/film-green-screen-pirate.webp';
import filmMask from '@/assets/photos/film-green-screen-mask.webp';
import filmSuperhero from '@/assets/photos/film-green-screen-superhero.webp';
import trustGame from '@/assets/photos/trust-game-outdoors.webp';
import geodeImprovNight from '@/assets/photos/geode-improv-night.webp';

/*
 * Program catalog.
 *
 * Source: the live "Fall 2026 Classes" page (littlecharacters.org/classes-1),
 * the FAQ, the Fall 2026 tuition guidelines and past event pages, captured in
 * content/scraped/ on Sep 25, 2026. Descriptions are the site's own words with
 * light edits for length.
 */

// Monthly tuition tiers from the FAQ.
const TUITION = {
  short: { amount: 85, unit: 'month', note: '45-minute class' },
  hour: { amount: 95, unit: 'month', note: '1-hour class' },
  long: { amount: 115, unit: 'month', note: '1¼-hour class' },
} satisfies Record<string, Price>;

// Fall 2026 term: Aug 17 – Dec 18. Produce a Show and Performance Troupe run through Mar 31, 2027.
const FALL = { term: 'Fall 2026', startDate: '2026-08-17', endDate: '2026-12-18' };
const FALL_TO_MARCH = { term: 'Fall 2026 – Spring 2027', startDate: '2026-08-17', endDate: '2027-03-31' };

const PNO_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSceXu5NWca5TztIjA44qk9WdC4FWK77re6xsBDdUg9uuAFz7w/viewform';
const ADULT_IMPROV_FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSdtbKfY86bY81dHuNwBVomyLUmm7LbEXpPS9NCg-gpXEKIHXA/viewform';

function weekly(
  id: string,
  day: Weekday,
  start: string,
  end: string,
  price: Price | undefined,
  extra: Partial<Session> = {},
): Session {
  return { id, ...FALL, days: [day], start, end, locationId: 'hq', price, status: 'open', ...extra };
}

function oneNight(id: string, label: string, day: Weekday, date: string, start: string, end: string, extra: Partial<Session>): Session {
  return { id, term: 'Fall 2026', label, days: [day], start, end, startDate: date, endDate: date, locationId: 'hq', status: 'open', ...extra };
}

export const programs: Program[] = [
  // ───────────────────────── Weekly classes (Fall 2026) ─────────────────────────
  {
    slug: 'stories-and-songs',
    focus: ['acting', 'music'],
    title: 'Stories and Songs',
    kind: 'class',
    brand: 'lc',
    gel: 'yellow',
    ages: { min: 4, max: 6 },
    tagline: 'For the littlest characters who love to perform and play pretend.',
    summary:
      'An 8-week class where 4- to 6-year-olds act out favorite books, learn songs and, of course, play in the costume box.',
    description: [
      'This 8-week class is for the littlest characters who show a lot of interest in performing and playing pretend! Students act out some of their favorite books, learn songs, and of course, play in the costume box.',
      'We help nurture the physical and emotional development of your growing child, all while having a whole lot of fun.',
    ],
    highlights: ['Acting out favorite books', 'Singing and movement', 'Costumes and pretend play', 'Emotional development'],
    showcase: 'Ends with a performance at our Variety Show in December.',
    duration: '45 minutes, Tuesdays for 8 weeks',
    priceFrom: { amount: 160, unit: 'session', note: '8 weeks' },
    fee: { amount: 30, label: 'performance fee' },
    teachers: ['Zack Newcott'],
    image: { src: filmSunhat, alt: 'A young student in a sun hat and floral dress in front of a green screen', position: '50% 30%' },
    sessions: [
      { id: 'stories-songs-f26', term: 'Fall 2026', days: ['Tue'], start: '16:15', end: '17:00', startDate: '2026-10-20', endDate: '2026-12-15', locationId: 'hq', price: { amount: 160, unit: 'session' }, status: 'open', teacher: 'Zack Newcott' },
    ],
    featured: true,
  },
  {
    slug: 'intro-to-theater',
    focus: ['acting'],
    title: 'Intro to Theater',
    kind: 'class',
    brand: 'lc',
    gel: 'red',
    ages: { min: 7, max: 10 },
    tagline: 'All things theater: voice, movement and character.',
    summary:
      'This course broadens students’ view of all things theater, covering vocality, movement and character exploration, full of games and activities.',
    description: [
      'This course will broaden your Little Character’s view of all things theater! We cover vocality, movement and character exploration onstage while working individually and in groups to build confidence, teamwork and individualism.',
      'Class is full of games and activities geared toward learning all of the aspects of theater.',
    ],
    highlights: ['Vocality', 'Movement', 'Character exploration', 'Confidence and teamwork'],
    showcase: 'Mid-semester showcase and a big show at the end of the term.',
    duration: '1 hour, Tuesdays',
    priceFrom: TUITION.hour,
    fee: { amount: 30, label: 'performance fee' },
    teachers: ['Zack Newcott', 'Alli Tyra'],
    image: { src: rehearsingOnStage, alt: 'Students rehearsing a scene on stage with their teacher', position: '50% 60%' },
    sessions: [weekly('intro-f26-tue', 'Tue', '17:15', '18:15', TUITION.hour, { teacher: 'Zack Newcott & Alli Tyra' })],
    featured: true,
  },
  {
    slug: 'yes-and-improv',
    focus: ['improv'],
    title: 'Yes, And… Improv',
    kind: 'class',
    brand: 'lc',
    gel: 'teal',
    ages: { min: 8, max: 17 },
    agesLabel: 'Ages 8+',
    tagline: 'Accept an idea and build on it. On stage and off.',
    summary:
      'Fast-paced games, creative storytelling and unscripted scenes that grow confidence, creativity and collaboration.',
    description: [
      'In improv, “Yes, And…” means accepting an idea and building on it, and that’s exactly what this class is all about!',
      'Through fast-paced games, creative storytelling and unscripted scenes, students grow their confidence, creativity and collaboration skills in a fun, supportive environment. Whether they’re new to improv or experienced performers, every class is full of laughter, surprises and endless possibilities. Your student might just learn that “Yes, And” works outside of theater, too.',
    ],
    highlights: ['Confidence', 'Creativity', 'Collaboration', 'Unscripted scenes'],
    showcase: 'Mid-semester showcase and a big show at the end of the term.',
    duration: '1 hour, Wednesdays',
    priceFrom: TUITION.hour,
    fee: { amount: 20, label: 'performance fee' },
    teachers: ['CC Conner'],
    image: { src: trustGame, alt: 'Students playing a blindfolded trust game outdoors', position: '50% 40%' },
    sessions: [weekly('yesand-f26-wed', 'Wed', '16:30', '17:30', TUITION.hour, { teacher: 'CC Conner' })],
    featured: true,
  },
  {
    slug: 'produce-a-show',
    focus: ['produce', 'writing', 'tech', 'acting'],
    title: 'Produce a Show',
    kind: 'class',
    brand: 'lc',
    gel: 'orange',
    ages: { min: 7, max: 17 },
    agesLabel: 'Ages 7+',
    tagline: 'Where imagination takes center stage.',
    summary:
      'Students dream up an original story, create characters, explore technical theater, and turn their ideas into a fully staged production.',
    description: [
      'Produce a Show is where imagination takes center stage! Students work together to dream up an original story, create unforgettable characters, explore the world of technical theater, and turn their ideas into a fully staged production.',
      'From brainstorming and script writing to set design, costumes and performance, every student plays an important role in bringing the story to life. Whether they love being in the spotlight or behind the scenes, this class celebrates creativity, collaboration, and the magic of creating something entirely your own.',
    ],
    highlights: ['Writing an original story', 'Creating characters', 'Set, costume and prop design', 'Performing a full production'],
    showcase: 'A fully staged, completely original production.',
    duration: '1¼ hours, Mondays',
    runs: 'August – March',
    priceFrom: TUITION.long,
    fee: { amount: 50, label: 'performance fee' },
    teachers: ['CC Conner', 'Zack Newcott'],
    image: { src: carnivalShow, alt: 'Students performing an original carnival-themed show on stage', position: '60% 50%' },
    sessions: [
      { id: 'produce-f26-mon', ...FALL_TO_MARCH, days: ['Mon'], start: '17:45', end: '19:00', locationId: 'hq', price: TUITION.long, status: 'open', teacher: 'CC Conner & Zack Newcott' },
    ],
    featured: true,
  },
  {
    slug: 'performance-troupe',
    focus: ['acting', 'improv'],
    title: 'LC/Geode Performance Troupe',
    kind: 'class',
    brand: 'lc',
    gel: 'purple',
    ages: { min: 9, max: 17 },
    agesLabel: 'Ages 9+',
    tagline: 'For students itching to perform more than once a semester.',
    summary:
      'Short performances around town all fall, then a full-length production from December to March. For students who have worked in theater before.',
    description: [
      'Have a student who is itching to perform more than once a semester? This class is for students who have worked in theater before and want to sharpen their acting skills. We spend the fall putting on short performances around town, then use December through March to prepare a full-length production.',
      'Students dig deep into characterization through pre-written short plays, scenes and monologues, and learn more advanced improv techniques. Oh, and still have a lot of fun doing so!',
    ],
    highlights: ['Characterization', 'Scenes and monologues', 'Advanced improv', 'Performing around town'],
    showcase: 'Short performances around town this fall, then a full-length production in spring.',
    duration: '1¼ hours, Wednesdays',
    runs: 'August – March',
    prerequisite: 'For students who have worked in theater before.',
    priceFrom: TUITION.long,
    fee: { amount: 50, label: 'performance fee' },
    teachers: ['Hannah Eppling', 'CC Conner'],
    image: { src: campShowStage, alt: 'A troupe of students dancing across the stage in front of an audience', position: '55% 40%' },
    sessions: [
      { id: 'troupe-f26-wed', ...FALL_TO_MARCH, days: ['Wed'], start: '17:45', end: '19:00', locationId: 'hq', price: TUITION.long, status: 'open', teacher: 'Hannah Eppling & CC Conner' },
    ],
    featured: true,
  },
  {
    slug: 'film-creation',
    focus: ['film', 'writing', 'acting'],
    title: 'Film Creation',
    kind: 'class',
    brand: 'lc',
    gel: 'teal',
    ages: { min: 9, max: 17 },
    agesLabel: 'Ages 9+',
    tagline: 'Learn how a film comes to life, from storyboard to screen.',
    summary:
      'Storytelling, scriptwriting, directing, acting, camera work, special effects and basic editing, from storyboarding to mini-film production.',
    description: [
      'Explore acting behind the camera, create short film storylines, and learn how a film comes to life!',
      'Students explore storytelling, scriptwriting, directing, acting, camera work, special effects and basic editing. Activities range from storyboarding to mini-film production.',
    ],
    highlights: ['Storyboarding and scriptwriting', 'Directing and acting', 'Camera work and special effects', 'Basic editing'],
    showcase: 'Student films screen at our Variety Show.',
    duration: '1 hour, Thursdays',
    priceFrom: TUITION.hour,
    fee: { amount: 30, label: 'materials fee' },
    teachers: ['Kidd Fielteau'],
    image: { src: filmArmsOut, alt: 'A student in a costume hat posing in front of the film class green screen', position: '50% 30%' },
    sessions: [weekly('film-f26-thu', 'Thu', '17:30', '18:30', TUITION.hour, { teacher: 'Kidd Fielteau' })],
    featured: true,
  },
  {
    slug: 'homeschool-class',
    focus: ['acting', 'tech'],
    title: 'LC Homeschool Class',
    kind: 'class',
    brand: 'lc',
    gel: 'yellow',
    ages: { min: 6, max: 17 },
    agesLabel: 'Ages 6+',
    tagline: 'Here’s one for the homeschoolers, y’all!',
    summary:
      'An 8-week Friday class exploring everything involved with theater, from acting onstage to making props and costumes, ending in a show on October 30.',
    description: [
      'Here’s one for the homeschoolers, y’all! This 8-week class lets students explore everything involved with theater. Some weeks focus on acting onstage, while others focus on creating props, exploring costumes and more.',
      'It all culminates in a fun show on October 30. Classes are prorated if you start after September 11.',
    ],
    highlights: ['Acting onstage', 'Prop making', 'Costumes', 'A show on October 30'],
    showcase: 'A show on October 30.',
    duration: '1½ hours, Fridays for 8 weeks',
    priceFrom: { amount: 200, unit: 'session', note: '8 weeks, prorated after Sep 11' },
    fee: { amount: 30, label: 'materials fee' },
    image: { src: filmPirate, alt: 'A student dressed as a pirate in front of a green screen', position: '50% 30%' },
    sessions: [
      { id: 'homeschool-f26', term: 'Fall 2026', days: ['Fri'], start: '13:00', end: '14:30', startDate: '2026-09-11', endDate: '2026-10-30', locationId: 'hq', price: { amount: 200, unit: 'session' }, status: 'open' },
    ],
  },
  {
    slug: 'athens-academy-enrichment',
    focus: ['acting', 'improv'],
    title: 'Athens Academy Enrichment',
    kind: 'class',
    brand: 'lc',
    gel: 'red',
    ages: { min: 5, max: 11 },
    agesLabel: 'Lower School',
    tagline: 'After-school theater for Athens Academy Lower School students.',
    summary:
      'An 8-week course covering voice, movement, emotion, character exploration and improv, ending in a performance. Registration is through Athens Academy.',
    description: [
      'Little Characters is proud to present the first-ever Lower School theater enrichment course at Athens Academy. This 8-week course broadens students’ view of all things theater, covering voice, movement, emotion, character exploration and improv.',
      'Teachers meet students where they are, whether they are made for the stage or more interested in what happens behind the scenes.',
    ],
    highlights: ['Voice and movement', 'Emotion and character', 'Improv', 'Teamwork and individuality'],
    showcase: 'Ends with a performance for families.',
    duration: '1¼ hours, Mondays for 8 weeks',
    image: { src: teacherWithStudents, alt: 'A teacher leading young students in a class' },
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
        teacher: 'CC Conner & Carley Pedan',
        externalUrl: 'https://www.activekids.com/athens-ga/performing-arts/camp/lower-school-little-characters-enrichment-2026',
        externalLabel: 'Register via Athens Academy',
      },
    ],
  },

  // ───────────────────────── Camps & free classes ─────────────────────────
  {
    slug: 'summer-camp',
    focus: ['acting', 'improv', 'produce', 'writing', 'tech'],
    title: 'Summer Camp',
    kind: 'camp',
    brand: 'lc',
    gel: 'orange',
    ages: { min: 4, max: 17 },
    tagline: 'Three to five weeks of camp every summer, ending with a show.',
    summary:
      'Each summer we offer 3–5 weeks of camp for students 4–17. From performing an original show to improv and technical theater, there’s something for all of your Little Characters.',
    description: [
      'Each summer, we offer 3–5 weeks of camp for students 4–17. From performing an original show to improv and technical theater, there is something for all of your Little Characters!',
      'Camp weeks for ages 4–10 run 9 am to 1 pm with acting and improv, emotions and characters, and lots of crafts and games. Some weeks we write our own show from scratch. Tweens and teens get their own intensives through Geode. Every camp ends with a performance for parents and friends.',
    ],
    highlights: ['Acting and improv', 'Writing our own show', 'Sets, props and costumes', 'A performance for families'],
    showcase: 'A performance for parents and friends at the end of the week.',
    duration: '9:00 am – 1:00 pm',
    priceFrom: { amount: 50, unit: 'day', note: 'About $250 a week, snacks and materials included' },
    image: { src: castSillyFaces, alt: 'A cast of campers and counselors making silly faces after a show', position: '45% 40%' },
    sessions: [],
    notify: true,
  },
  {
    slug: 'mini-camps-and-workshops',
    focus: ['music', 'tech'],
    title: 'Mini Camps & Workshops',
    kind: 'camp',
    brand: 'lc',
    gel: 'red',
    ages: { min: 4, max: 17 },
    tagline: 'Theater on school holidays and weekends.',
    summary: 'Weekend workshops 1–2 times a semester, plus half-day workshops and mini camps on CCSD school holidays.',
    description: [
      'We hold weekend workshops 1–2 times a semester, as well as half-day workshops and mini camps on CCSD school holidays.',
      'Recent favorites include a Thanksgiving-break caroling mini camp, a Fall Break Storybook Camp, the KPop-a-Palooza and Prop Making workshops, a NEWSIES musical theater workshop, and an Into the Woods workshop.',
    ],
    highlights: ['Holiday mini camps', 'Musical theater workshops', 'Tech and prop making', 'A short show for families'],
    showcase: 'Most mini camps end with a short performance at pickup.',
    duration: 'Half days, usually 9:00 am – 1:00 pm',
    priceFrom: { amount: 50, unit: 'day' },
    image: { src: filmWand, alt: 'A student with a wand and scarf in front of a green screen', position: '50% 30%' },
    sessions: [],
    notify: true,
  },
  {
    slug: 'free-community-class',
    focus: ['acting'],
    title: 'Free Community Theater Class',
    kind: 'workshop',
    brand: 'lc',
    gel: 'yellow',
    ages: { min: 4, max: null },
    agesLabel: 'All ages',
    tagline: 'A free theater class, once a month, for anyone.',
    summary: 'Join us once a month for a free community theater class. All ages welcome, with a different teacher each month.',
    description: [
      'Join us once a month for a FREE community theater class! All ages are welcome, and our teachers rotate every month, so each class is a little different.',
    ],
    highlights: ['Free', 'All ages welcome', 'A new teacher each month'],
    duration: '1 hour, once a month',
    priceFrom: { amount: 0, unit: 'class', note: 'Free' },
    image: { src: rehearsalCircle, alt: 'Students sitting in a circle on the stage floor', position: '50% 60%' },
    sessions: [
      oneNight('free-class-2026-10-15', 'Thu, Oct 15', 'Thu', '2026-10-15', '16:15', '17:15', { price: { amount: 0, unit: 'class' }, status: 'coming-soon' }),
      oneNight('free-class-2026-11-02', 'Mon, Nov 2', 'Mon', '2026-11-02', '16:00', '17:00', { price: { amount: 0, unit: 'class' }, status: 'coming-soon' }),
    ],
  },

  // ───────────────────────── Everything else ─────────────────────────
  {
    slug: 'parents-night-out',
    title: 'Parents’ Night Out',
    kind: 'party',
    brand: 'lc',
    gel: 'red',
    ages: { min: 4, max: 12 },
    agesLabel: 'All kids welcome',
    tagline: 'Drop the kiddos off and head out for a night on the town.',
    summary:
      'Once a month, 5–8 pm. Kids play games, learn theater activities and make friends while you enjoy downtown, only a mile away.',
    description: [
      'Drop your kiddos off and head out for a night on the town. Childcare is on us! With downtown only 1 mile away, pencil in date night while the kids play, craft and snack all night long.',
      'Kids spend the night playing games, learning fun theater activities and making new friends, all in a safe and creative environment. It’s a win for parents and kids!',
    ],
    highlights: ['Theater games', 'Crafts and snacks', 'New friends', 'Downtown is a mile away'],
    duration: '5:00 – 8:00 pm, once a month',
    priceFrom: { amount: 30, unit: 'child', note: '$10 for each additional child' },
    image: { src: filmSuperhero, alt: 'A child in a superhero mask and costume', position: '50% 30%' },
    sessions: [
      oneNight('pno-2026-09-25', 'Fri, Sep 25', 'Fri', '2026-09-25', '17:00', '20:00', { price: { amount: 30, unit: 'child', additional: 10 }, externalUrl: PNO_FORM, externalLabel: 'Register' }),
      oneNight('pno-2026-10-24', 'Sat, Oct 24', 'Sat', '2026-10-24', '17:00', '20:00', { price: { amount: 30, unit: 'child', additional: 10 }, externalUrl: PNO_FORM, externalLabel: 'Register' }),
      oneNight('pno-2026-11-14', 'Sat, Nov 14', 'Sat', '2026-11-14', '17:00', '20:00', { price: { amount: 30, unit: 'child', additional: 10 }, externalUrl: PNO_FORM, externalLabel: 'Register' }),
      oneNight('pno-2026-12-19', 'Sat, Dec 19', 'Sat', '2026-12-19', '17:00', '20:00', { price: { amount: 30, unit: 'child', additional: 10 }, externalUrl: PNO_FORM, externalLabel: 'Register' }),
    ],
  },
  {
    slug: 'private-lessons',
    focus: ['acting', 'writing', 'music'],
    title: 'Private Lessons',
    kind: 'lesson',
    brand: 'lc',
    gel: 'purple',
    ages: { min: 4, max: null },
    agesLabel: 'All ages',
    tagline: 'One-on-one help, booked by the hour.',
    summary: 'Audition help, playwriting assistance, one-on-one acting or singing lessons, on an hourly basis.',
    description: [
      'Looking for audition help, assistance in playwriting, one-on-one acting, or singing lessons? We provide private lessons on an hourly basis.',
    ],
    highlights: ['Audition help', 'Playwriting', 'One-on-one acting', 'Singing'],
    duration: 'By the hour',
    image: { src: teacherWithStudents, alt: 'A teacher working with students' },
    sessions: [],
    requestCta: { label: 'Request a lesson', href: '/contact?topic=private-lessons' },
  },
  {
    slug: 'parties',
    title: 'Parties',
    kind: 'party',
    brand: 'lc',
    gel: 'orange',
    ages: { min: 4, max: null },
    agesLabel: 'Any occasion',
    tagline: 'Name the occasion, and we’ll make it happen!',
    summary:
      'Two-hour parties on evenings or weekends at our space, with customizable theater games, your own teacher/party coordinator, a stage, and tables for cake.',
    description: [
      'Heck yeah we do parties! Name the occasion, and we’ll make it happen. We offer two-hour parties on evenings or weekends at our space.',
      'Every party includes customizable theater games and content, your own Teacher/Party Coordinator, a stage for dance parties and present opening, and tables and chairs for cake and snacks. Don’t tempt us with a good time. Or, do!',
    ],
    highlights: ['Customizable theater games', 'Your own Teacher/Party Coordinator', 'A stage for dance parties and presents', 'Tables and chairs for cake and snacks'],
    duration: '2 hours, evenings or weekends',
    image: { src: filmMask, alt: 'A child in a bright orange dress and mask', position: '50% 30%' },
    sessions: [],
    requestCta: { label: 'Ask about a party', href: '/contact?topic=party' },
  },
  {
    slug: 'ovation',
    focus: ['acting'],
    title: 'Ovation',
    kind: 'inclusive',
    brand: 'lc',
    gel: 'teal',
    ages: { min: 4, max: null },
    agesLabel: 'All ages & abilities',
    tagline: 'A space to interact, create and play.',
    summary:
      'Our adaptive theater class for people with special needs, first launched with It’s Good to See You Productions: an hour of games, movement and costumes in a fun, safe environment.',
    description: [
      'Ovation is our adaptive theater class for our differently-abled friends and their caregivers, first launched in partnership with It’s Good to See You Productions. Each hour is spent playing games, exploring movement and costumes, and enjoying a fun and safe environment.',
      'Ovation students performed in our Spring 2026 Variety Show. Scholarships are available.',
    ],
    highlights: ['Games and movement', 'Costume exploration', 'Caregivers welcome', 'Scholarships available'],
    duration: '1 hour',
    priceFrom: { amount: 15, unit: 'class', note: 'Scholarships available' },
    sessions: [],
    requestCta: { label: 'Ask about the next Ovation dates', href: '/contact?topic=needs' },
  },

  // ───────────────────────── Geode (tweens, teens & adults) ─────────────────────────
  {
    slug: 'geode-acting-studio',
    focus: ['acting', 'improv'],
    title: 'Geode: Acting Studio',
    kind: 'class',
    brand: 'geode',
    gel: 'purple',
    ages: { min: 11, max: 17 },
    tagline: 'For tweens and teens ready to explore the world of acting.',
    summary: 'A weekly class building acting skills through improv, scene work, character exploration and creative theater games.',
    description: [
      'Geode’s Acting Studio is a weekly class for tweens and teens ready to explore the world of acting! Students build acting skills through improv, scene work, character exploration and creative theater games.',
      'Every class is designed to inspire confidence, encourage collaboration, and help young performers discover their unique voice.',
    ],
    highlights: ['Improv', 'Scene work', 'Character exploration', 'Finding your voice'],
    showcase: 'Ends with a performance at our Variety Show in December.',
    duration: '1 hour, Tuesdays',
    // Pricing conflict on the old site ($180 per 8-week session vs $95/month):
    // resolved to the monthly price per Stephen, Sep 2026.
    priceFrom: TUITION.hour,
    fee: { amount: 30, label: 'performance fee' },
    image: { src: rehearsalCircle, alt: 'Teen actors sitting in a circle on stage', position: '50% 60%' },
    sessions: [
      { id: 'acting-studio-f26', term: 'Fall 2026', days: ['Tue'], start: '18:15', end: '19:15', startDate: '2026-10-20', endDate: '2026-12-15', locationId: 'hq', price: TUITION.hour, status: 'open' },
    ],
  },
  {
    slug: 'geode-adult-improv',
    focus: ['improv'],
    title: 'Geode: Adult Improv Night',
    kind: 'class',
    brand: 'geode',
    gel: 'purple',
    ages: { min: 18, max: null },
    tagline: 'Let it all loose on the third Thursday of every month.',
    summary: 'Group and partner improv games for grown-ups in a low-stakes environment. Play as little or as much as you like.',
    description: [
      'Let it all loose as you play group games to explore your inner improviser! Join us for laughter and community as we get silly and learn some improv games in a low-stakes environment.',
      'Scared about trying improv? Most activities are group focused, and we’ll never ask you to do something you don’t feel comfortable with. Feel free to sign up and just come hang out! Attendees must be 18+; BYOB with a 21+ ID, or bring a snack to share.',
    ],
    highlights: ['Group and partner games', 'No experience needed', 'BYOB (21+)', 'Meet people in Athens'],
    duration: '6:30 – 8:30 pm, third Thursday of the month',
    priceFrom: { amount: 25, unit: 'class' },
    teachers: ['Hannah Eppling'],
    image: { src: geodeImprovNight, alt: 'Adults laughing together at a Geode improv night', position: '50% 45%' },
    sessions: [
      oneNight('adult-improv-2026-10', 'Thu, Oct 15', 'Thu', '2026-10-15', '18:30', '20:30', { price: { amount: 25, unit: 'class' }, teacher: 'Hannah Eppling', externalUrl: ADULT_IMPROV_FORM, externalLabel: 'Register' }),
      oneNight('adult-improv-2026-11', 'Thu, Nov 19', 'Thu', '2026-11-19', '18:30', '20:30', { price: { amount: 25, unit: 'class' }, teacher: 'Hannah Eppling', externalUrl: ADULT_IMPROV_FORM, externalLabel: 'Register' }),
      oneNight('adult-improv-2026-12', 'Thu, Dec 17', 'Thu', '2026-12-17', '18:30', '20:30', { price: { amount: 25, unit: 'class' }, teacher: 'Hannah Eppling', externalUrl: ADULT_IMPROV_FORM, externalLabel: 'Register' }),
    ],
  },
];

export const lcPrograms = programs.filter((p) => p.brand === 'lc');
export const geodePrograms = programs.filter((p) => p.brand === 'geode');
export const programBySlug = (slug: string) => programs.find((p) => p.slug === slug);

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
