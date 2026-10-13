/** Wording drafts: Classes, camps, workshops, lessons and parties. Format: docs/seo/drafts.md. */
import type { CollectionDraft } from './format';

export const programs: CollectionDraft<'programs'>[] = [
  {
    kind: 'programs',
    id: 'stories-and-songs',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Theater Class for Ages 4–6 in Athens, GA',
        why: 'Puts the ages and the place in the search title, the first things a parent checks.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'A preschool and kindergarten theater class in Athens, GA, where 4- to 6-year-olds act out favorite books, sing songs and play in the costume box.',
        why: 'Uses the words parents of young children search for (“preschool”, “kindergarten”) and says where.',
      },
      {
        path: 'description.0',
        from: 'This 8-week class is for the littlest characters who show a lot of interest in performing and playing pretend! Students act out some of their favorite books, learn songs, and of course, play in the costume box.',
        to: 'This 8-week class is for the littlest characters, ages 4 to 6 (pre-K and kindergarten), who are always putting on a show and playing pretend! Students act out some of their favorite books, learn songs, and of course, raid the costume box. No experience needed, just a big imagination.',
        why: 'Replaces the SEO version: keeps its search words and adds a warmer, more playful tone.',
      },
      {
        path: 'description.1',
        from: 'We help nurture the physical and emotional development of your growing child, all while having a whole lot of fun.',
        to: 'We help nurture the physical and emotional development of your growing child, all while having a whole lot of fun (and a few wiggles). When they turn 7, [Intro to Theater](/programs/intro-to-theater) is the next step.',
        why: 'Replaces the SEO version: keeps its search words and adds a warmer, more playful tone.',
      },
      {
        path: 'tagline',
        from: 'For the littlest characters who love to perform and play pretend.',
        to: 'For the littlest characters who love to sing, pretend and put on a show.',
        why: 'Says what the youngest students actually love doing, in a lighter voice.',
      },
      {
        path: 'summary',
        from: 'An 8-week class where 4- to 6-year-olds act out favorite books, learn songs and, of course, play in the costume box.',
        to: 'An 8-week class where 4- to 6-year-olds jump into their favorite books, learn songs and, of course, dive into the costume box.',
        why: 'Same facts as today, with livelier verbs for the class cards.',
      },
      {
        path: 'showcase',
        from: 'Ends with a performance at our Variety Show in December.',
        to: 'Ends with a performance at our Variety Show in December, bows and all.',
        why: 'Adds a small smile to the line about the show; the event and month are unchanged.',
      },
    ],
  },
  {
    kind: 'programs',
    id: 'intro-to-theater',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Acting Class for Kids 7–10 in Athens, GA',
        why: 'Matches “acting classes for kids Athens GA”, with the ages and the place.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'A Tuesday acting class for ages 7–10 in Athens, GA: voice, movement and character through games, with a showcase and a big show. First class free.',
        why: 'Says what the class is, for whom and where, and gives a reason to click (the free first class, which applies to this class).',
      },
      {
        path: 'description.0',
        from: 'This course will broaden your Little Character’s view of all things theater! We cover vocality, movement and character exploration onstage while working individually and in groups to build confidence, teamwork and individualism.',
        to: 'This acting class for ages 7 to 10 raises the curtain on all things theater for your Little Character, no experience needed! We cover vocality, movement and character exploration onstage while working individually and in groups to build confidence, teamwork and individualism.',
        why: 'Replaces the SEO version: keeps its search words and adds a warmer, more playful tone.',
      },
      {
        path: 'description.1',
        from: 'Class is full of games and activities geared toward learning all of the aspects of theater.',
        to: 'Class is packed with games and activities, so learning every part of theater feels a lot like play. Want more? Students often pair it with [Yes, And… Improv](/programs/yes-and-improv) or [Produce a Show](/programs/produce-a-show).',
        why: 'Replaces the SEO version: keeps its search words and adds a warmer, more playful tone.',
      },
      {
        path: 'tagline',
        from: 'All things theater: voice, movement and character.',
        to: 'All things theater: voice, movement, character and lots of games.',
        why: 'Tells families up front that class is full of games, as the description already says.',
      },
      {
        path: 'summary',
        from: 'This course broadens students’ view of all things theater, covering vocality, movement and character exploration, full of games and activities.',
        to: 'A playful tour of all things theater: vocality, movement and character exploration, learned through games and activities.',
        why: 'Says the same things in a warmer, shorter way for class cards.',
      },
    ],
  },
  {
    kind: 'programs',
    id: 'yes-and-improv',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Improv Class for Kids 8+ in Athens, GA',
        why: 'Matches “improv class for kids Athens GA”, with the ages and the place.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Fast-paced games and unscripted scenes that build confidence and creativity: a Wednesday improv class for ages 8 and up in Athens, GA. First class free.',
        why: 'Leads with what parents want (confidence), then says when, for whom and where.',
      },
      {
        path: 'description.0',
        from: 'In improv, “Yes, And…” means accepting an idea and building on it, and that’s exactly what this class is all about!',
        to: 'In improv, “Yes, And…” means accepting an idea and building on it, and that’s exactly what this improv class for kids and teens, ages 8 and up, is all about! No script? No problem.',
        why: 'Replaces the SEO version: keeps its search words and adds a warmer, more playful tone.',
      },
      {
        path: 'description.1',
        from: 'Through fast-paced games, creative storytelling and unscripted scenes, students grow their confidence, creativity and collaboration skills in a fun, supportive environment. Whether they’re new to improv or experienced performers, every class is full of laughter, surprises and endless possibilities. Your student might just learn that “Yes, And” works outside of theater, too.',
        to: 'Through fast-paced games, creative storytelling and unscripted scenes, students grow their confidence, creativity and collaboration skills in a fun, supportive environment. Whether they’re new to improv or experienced performers, every class is full of laughter, surprises and endless possibilities. Your student might just learn that “Yes, And” works outside of theater, too. Itching to perform more? See the [Performance Troupe](/programs/performance-troupe), and [Geode](/geode) for tweens and teens.',
        why: 'Links to the next steps for students who want more stage time or are older.',
      },
      {
        path: 'tagline',
        from: 'Accept an idea and build on it. On stage and off.',
        to: 'Say “yes”, add an idea, and see where the scene goes. On stage and off.',
        why: 'Shows what “Yes, And” means in action instead of defining it.',
      },
      {
        path: 'summary',
        from: 'Fast-paced games, creative storytelling and unscripted scenes that grow confidence, creativity and collaboration.',
        to: 'Fast-paced games, creative storytelling and unscripted scenes, full of laughter and surprises, that grow confidence, creativity and collaboration.',
        why: 'Brings the description’s “laughter and surprises” onto the class cards.',
      },
    ],
  },
  {
    kind: 'programs',
    id: 'produce-a-show',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Write & Stage a Show: Kids 7+, Athens GA',
        why: 'Says what makes this class different (students write and stage their own play), with the ages and the place.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Students write an original play, design sets and costumes, and stage it for an audience. Mondays, August to March, for ages 7 and up in Athens, GA.',
        why: 'Answers “playwriting class for kids” and “technical theater for kids” searches, with when, for whom and where.',
      },
      {
        path: 'description.1',
        from: 'From brainstorming and script writing to set design, costumes and performance, every student plays an important role in bringing the story to life. Whether they love being in the spotlight or behind the scenes, this class celebrates creativity, collaboration, and the magic of creating something entirely your own.',
        to: 'From brainstorming and playwriting to set design, costumes and performance, every student plays an important role in bringing the story to life. Whether they love being in the spotlight or behind the scenes, this class celebrates creativity, collaboration, and the magic of creating something entirely your own. Love telling stories on screen too? Try [Film Creation](/programs/film-creation).',
        why: 'Uses “playwriting”, the word parents search, and links to the film class for storytellers.',
      },
      {
        path: 'summary',
        from: 'Students dream up an original story, create characters, explore technical theater, and turn their ideas into a fully staged production.',
        to: 'Students dream up an original story, invent the characters, try their hand at technical theater, and turn their big ideas into a fully staged production.',
        why: 'Same steps as today, in livelier words for the class cards.',
      },
      {
        path: 'showcase',
        from: 'A fully staged, completely original production.',
        to: 'A fully staged, completely original production, dreamed up by the cast.',
        why: 'Reminds families the show is the students’ own, as the description says.',
      },
    ],
  },
  {
    kind: 'programs',
    id: 'performance-troupe',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Youth Theater Troupe (9+) in Athens, GA',
        why: 'Matches “youth theater Athens GA”, with the ages and the place.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'A youth theater troupe in Athens, GA, for ages 9+ who’ve worked in theater before: short shows around town in fall, then a full-length spring production.',
        why: 'Says who it’s for (some stage experience) and what students get: more chances to perform.',
      },
      {
        path: 'description.0',
        from: 'Have a student who is itching to perform more than once a season? This class is for students who have worked in theater before and want to sharpen their acting skills. We spend the fall putting on short performances around town, then use December through March to prepare a full-length production.',
        to: 'Have a student who is itching to perform more than once a season? This youth theater troupe is for students ages 9 and up who have worked in theater before and want to sharpen their acting skills. We spend the fall putting on short performances around town, then use December through March to prepare a full-length production.',
        why: 'Says “youth theater troupe” and the ages in plain words near the top.',
      },
      {
        path: 'description.1',
        from: 'Students dig deep into characterization through pre-written short plays, scenes and monologues, and learn more advanced improv techniques. Oh, and still have a lot of fun doing so!',
        to: 'Students dig deep into characterization through pre-written short plays, scenes and monologues, and learn more advanced improv techniques. Oh, and still have a lot of fun doing so! See where the troupe performs next on our [shows and events](/events) page.',
        why: 'Links to the events page, where families find the troupe’s performances.',
      },
      {
        path: 'summary',
        from: 'Short performances around town all fall, then a full-length production from December to March. For students who have worked in theater before.',
        to: 'Short performances around town all fall, then a full-length production from December to March. For students who have worked in theater before and can’t wait for their next curtain call.',
        why: 'Adds the troupe’s eagerness to perform; the months and who it’s for are unchanged.',
      },
    ],
  },
  {
    kind: 'programs',
    id: 'film-creation',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Filmmaking Class for Kids 9+, Athens GA',
        why: 'Matches “filmmaking class for kids Athens GA”, with the ages and the place.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Kids ages 9+ write, direct, act and shoot short films with green-screen effects and basic editing. Thursdays in Athens, GA. Try the first class free.',
        why: 'Names what kids actually do (green screen, editing), which is what parents compare.',
      },
      {
        path: 'description.0',
        from: 'Explore acting behind the camera, create short film storylines, and learn how a film comes to life!',
        to: 'In this filmmaking class for ages 9 and up, students step behind the camera (and in front of it), dream up short film storylines, act and shoot on a green screen, and learn how a film comes to life!',
        why: 'Replaces the SEO version: keeps its search words and adds a warmer, more playful tone.',
      },
      {
        path: 'description.1',
        from: 'Students explore storytelling, scriptwriting, directing, acting, camera work, special effects and basic editing. Activities range from storyboarding to mini-film production.',
        to: 'Students explore storytelling, scriptwriting, directing, acting, camera work, special effects and basic editing. Activities range from storyboarding to mini-film production, and student films screen at our Variety Show. Love writing stories for the stage too? See [Produce a Show](/programs/produce-a-show).',
        why: 'Answers “will my child’s work be shown?” and links to the class for young writers.',
      },
      {
        path: 'tagline',
        from: 'Learn how a film comes to life, from storyboard to screen.',
        to: 'Lights, camera, action! Learn how a film comes to life, from storyboard to screen.',
        why: 'Opens with the line every young filmmaker wants to shout.',
      },
      {
        path: 'summary',
        from: 'Storytelling, scriptwriting, directing, acting, camera work, special effects and basic editing, from storyboarding to mini-film production.',
        to: 'Young filmmakers try it all: storytelling, scriptwriting, directing, acting, camera work, special effects and basic editing, from the first storyboard to their own mini-film.',
        why: 'Turns the list into a sentence about the students, keeping every item.',
      },
      {
        path: 'showcase',
        from: 'Student films screen at our Variety Show.',
        to: 'Student films get their big-screen moment at our Variety Show.',
        why: 'Makes the screening sound like the celebration it is; same event.',
      },
    ],
  },
  {
    kind: 'programs',
    id: 'homeschool-class',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Homeschool Theater Class in Athens, GA',
        why: 'Matches “homeschool theater class Athens GA”, a search no other Athens page answers.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'An 8-week Friday afternoon drama class for homeschoolers ages 6 and up in Athens, GA: acting onstage, prop making and costumes, ending in a show.',
        why: 'Uses “drama”, which homeschool families also search, and leaves out dates so it doesn’t go stale.',
      },
      {
        path: 'description.0',
        from: 'Here’s one for the homeschoolers, y’all! This 8-week class lets students explore everything involved with theater. Some weeks focus on acting onstage, while others focus on creating props, exploring costumes and more.',
        to: 'Here’s one for the homeschoolers, y’all! This 8-week homeschool drama class for ages 6 and up lets students explore everything involved with theater. Some weeks focus on acting onstage, while others focus on creating props, exploring costumes and more.',
        why: 'Says “homeschool drama class” and the ages in plain words.',
      },
      {
        path: 'description.1',
        from: 'It all culminates in a fun show on October 30. Classes are prorated if you start after September 11.',
        to: 'It all culminates in a fun show on October 30. Classes are prorated if you start after September 11. Looking for more? See our [camps](/camps) and [private lessons](/programs/private-lessons).',
        why: 'Links homeschool families to other daytime options. The dates in this paragraph are unchanged and still need updating after October 30.',
      },
    ],
  },
  {
    kind: 'programs',
    id: 'athens-academy-enrichment',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Athens Academy Lower School Theater',
        why: 'Matches what Athens Academy families search for; the school’s name places it.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'After-school theater for Athens Academy Lower School: voice, movement, character and improv over 8 weeks, ending in a show. Register through the school.',
        why: 'Says what the course covers and makes clear that registration is through Athens Academy.',
      },
      {
        path: 'description.1',
        from: 'Teachers meet students where they are, whether they are made for the stage or more interested in what happens behind the scenes.',
        to: 'Teachers meet students where they are, whether they are made for the stage or more interested in what happens behind the scenes. Registration is through Athens Academy. We also run programs at [other Athens schools](/about/schools).',
        why: 'Answers “how do I sign up?” in the text and links to the other schools, for families at those schools.',
      },
    ],
  },
  {
    kind: 'programs',
    id: 'summer-camp',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Summer Theater Camp 2027 in Athens, GA',
        why: 'Matches “summer camp Athens GA 2027”, the largest group of searches, from January on. Change the year each fall.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Half-day theater camp weeks for ages 4–10, 9 am–1 pm, about $250 a week, and teen intensives through Geode. Summer 2027 dates coming soon: get on the list.',
        why: 'Gives the hours and price parents compare, and asks them to sign up for dates.',
      },
      {
        path: 'description.0',
        from: 'Each summer, we offer 3–5 weeks of camp for students 4–17. From performing an original show to improv and technical theater, there is something for all of your Little Characters!',
        to: 'Each summer, we offer 3–5 weeks of summer theater camp in Athens for students 4–17. From performing an original show to improv and technical theater, there is something for all of your Little Characters!',
        why: 'Says “summer theater camp in Athens” in the first sentence, the words parents type.',
      },
      {
        path: 'description.1',
        from: 'Camp weeks for ages 4–10 run 9 am to 1 pm with acting and improv, emotions and characters, and lots of crafts and games. Some weeks we write our own show from scratch. Tweens and teens get their own intensives through Geode. Every camp ends with a performance for parents and friends.',
        to: 'Camp weeks for ages 4–10 run 9 am to 1 pm with acting and improv, emotions and characters, and lots of crafts and games. Some weeks we write our own show from scratch. Tweens and teens get their own intensives through [Geode](/geode). Every camp ends with a performance for parents and friends. Need a camp on a school holiday? See [all our camps](/camps).',
        why: 'Links to Geode for teens and to the camps page for holiday mini camps.',
      },
      {
        path: 'tagline',
        from: 'Three to five weeks of camp every summer, ending with a show.',
        to: 'Three to five weeks of summer fun, and every camp ends with a show.',
        why: 'Warmer, and says every camp ends in a show, as the description does.',
      },
      {
        path: 'showcase',
        from: 'A performance for parents and friends at the end of the week.',
        to: 'A performance for parents and friends at the end of the week. Bring your loudest applause!',
        why: 'Invites families to the show with a little fun; the timing is unchanged.',
      },
    ],
  },
  {
    kind: 'programs',
    id: 'mini-camps-and-workshops',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'School Holiday Mini Camps in Athens, GA',
        why: 'Matches searches for camps on school breaks (“fall break camp”, “Thanksgiving break camp”).',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Half-day theater mini camps on CCSD school holidays and weekend workshops in Athens, GA, about $50 a day. Most end with a short show at pickup.',
        why: 'Says when, where and how much, the three things a parent with a day to cover needs.',
      },
      {
        path: 'description.0',
        from: 'We hold weekend workshops 1–2 times a season, as well as half-day workshops and mini camps on CCSD school holidays.',
        to: 'We hold weekend workshops 1–2 times a season, as well as half-day workshops and mini camps on Clarke County School District (CCSD) school holidays.',
        why: 'Spells out the school district, which parents also search for by its full name.',
      },
      {
        path: 'description.1',
        from: 'Recent favorites include a Thanksgiving-break caroling mini camp, a Fall Break Storybook Camp, the KPop-a-Palooza and Prop Making workshops, a NEWSIES musical theater workshop, and an Into the Woods workshop.',
        to: 'Recent favorites include a Thanksgiving-break caroling mini camp, a Fall Break Storybook Camp, the KPop-a-Palooza and Prop Making workshops, a NEWSIES musical theater workshop, and an Into the Woods workshop. For longer camps, see [Summer Camp](/programs/summer-camp) and [all our camps](/camps).',
        why: 'Links to the summer camp and camps pages.',
      },
      {
        path: 'tagline',
        from: 'Theater on school holidays and weekends.',
        to: 'School’s out? Theater’s in! Mini camps and workshops on school holidays and weekends.',
        why: 'A playful hook that still says exactly when these run.',
      },
      {
        path: 'showcase',
        from: 'Most mini camps end with a short performance at pickup.',
        to: 'Most mini camps end with a short performance at pickup, so come ready to cheer.',
        why: 'Tells parents the pickup show is for them; “most” stays.',
      },
    ],
  },
  {
    kind: 'programs',
    id: 'free-community-class',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Free Monthly Theater Class in Athens, GA',
        why: 'Matches “free kids activities Athens GA” and “free theater class”.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Once a month, a free one-hour theater class for all ages, with a different teacher each time, at our space on W Broad St in Athens, GA.',
        why: 'Leaves out dates so it never goes stale; the dates show on the page.',
      },
      {
        path: 'description.0',
        from: 'Join us once a month for a FREE community theater class! All ages are welcome, and our teachers rotate every month, so each class is a little different.',
        to: 'Join us once a month for a FREE community theater class at our W Broad St space in Athens! All ages are welcome, and our teachers rotate every month, so each class brings a little surprise. Caught the theater bug? [Find a weekly class](/programs) to keep going.',
        why: 'Replaces the SEO version: keeps its search words and adds a warmer, more playful tone.',
      },
      {
        path: 'tagline',
        from: 'A free theater class, once a month, for anyone.',
        to: 'A free theater class, once a month, for anyone who wants to play.',
        why: 'Adds an invitation to the line under the name.',
      },
      {
        path: 'summary',
        from: 'Join us once a month for a free community theater class. All ages welcome, with a different teacher each month.',
        to: 'Come play with us! Once a month, a free community theater class for all ages, with a different teacher each month.',
        why: 'Opens with a warm invitation; free, monthly, all ages and the rotating teacher all stay.',
      },
    ],
  },
  {
    kind: 'programs',
    id: 'parents-night-out',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Parents’ Night Out in Athens, GA',
        why: 'Matches “parents night out Athens GA”, a search no other Athens, GA page answers.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Kids 4–12 play theater games, craft and snack, 5–8 pm once a month, while you head to downtown Athens, GA, a mile away. $30, $10 each extra child.',
        why: 'Gives the ages, hours and price a parent planning a date night needs.',
      },
      {
        path: 'description.0',
        from: 'Drop your kiddos off and head out for a night on the town. Childcare is on us! With downtown only 1 mile away, pencil in date night while the kids play, craft and snack all night long.',
        to: 'Drop your kiddos (ages 4–12) off and head out for a night on the town. Childcare is on us! With downtown Athens only 1 mile away, pencil in date night while the kids play, craft and snack all night long.',
        why: 'Puts the ages in the text and names Athens.',
      },
      {
        path: 'summary',
        from: 'Once a month, 5–8 pm. Kids play games, learn theater activities and make friends while you enjoy downtown, only a mile away.',
        to: 'Once a month, 5–8 pm. Kids play games, learn theater activities and make new friends while you enjoy a night out downtown, only a mile away.',
        why: 'Puts the grown-ups’ night out into the card, matching the page’s “night on the town”.',
      },
    ],
  },
  {
    kind: 'programs',
    id: 'private-lessons',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Private Acting & Voice Lessons in Athens',
        why: 'Matches “private acting lessons” and “voice lessons”, the more searched name for singing lessons.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'One-on-one acting, singing and audition coaching, plus playwriting help, booked by the hour, for all ages in Athens, GA.',
        why: 'Says what a lesson can cover and where; there’s no price to give yet.',
      },
      {
        path: 'description.0',
        from: 'Looking for audition help, assistance in playwriting, one-on-one acting, or singing lessons? We provide private lessons on an hourly basis.',
        to: 'Looking for audition help, assistance in playwriting, one-on-one acting, or singing (voice) lessons in Athens? We provide private lessons on an hourly basis, for all ages. Tweens, teens and adults can also find us at [Geode](/geode).',
        why: 'Adds “voice lessons” beside “singing lessons”, names Athens, and links to Geode, which offers lessons too.',
      },
      {
        path: 'tagline',
        from: 'One-on-one help, booked by the hour.',
        to: 'One-on-one help for your next audition, script or song, booked by the hour.',
        why: 'Says what a lesson can be for, using the page’s own list.',
      },
    ],
  },
  {
    kind: 'programs',
    id: 'parties',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Kids Theater Birthday Parties, Athens GA',
        why: 'Matches “kids birthday party places Athens GA”; the page doesn’t say “birthday” anywhere today.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Two-hour birthday parties on our stage in Athens, GA, with theater games, your own party coordinator, a dance party and tables for cake. Ask for a date.',
        why: 'Lists what’s included, which is how parents compare party places.',
      },
      {
        path: 'description.0',
        from: 'Heck yeah we do parties! Name the occasion, and we’ll make it happen. We offer two-hour parties on evenings or weekends at our space.',
        to: 'Heck yeah we do parties, birthday parties included! Name the occasion, and we’ll make it happen. We offer two-hour parties on evenings or weekends at our space on W Broad St in Athens.',
        why: 'Adds “birthday parties” to the first sentence and says where, keeping “name the occasion”.',
      },
    ],
  },
  {
    kind: 'programs',
    id: 'ovation',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Special Needs & Adaptive Theater, Athens',
        why: 'Matches “special needs theater class” and “adaptive drama class”, searches with almost no Athens answer.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'An adaptive theater class in Athens, GA, for people of all ages with special needs, caregivers welcome: games, movement and costumes. Ask about dates.',
        why: 'Says who it’s for in the words parents search, and keeps to the facts while dates and price are being set.',
      },
      {
        path: 'description.0',
        from: 'Ovation is our adaptive theater class for our differently-abled friends and their caregivers, first launched in partnership with It’s Good to See You Productions. Each hour is spent playing games, exploring movement and costumes, and enjoying a fun and safe environment.',
        to: 'Ovation is our adaptive theater class for our differently-abled friends and their caregivers, welcoming people of all ages with special needs. It was first launched in partnership with It’s Good to See You Productions. Each hour is spent playing games, exploring movement and costumes, and enjoying a fun and safe environment.',
        why: 'Adds “special needs” beside the brand’s own “differently-abled”, so parents searching those words find the class.',
      },
      {
        path: 'description.1',
        from: 'Ovation students performed in our Spring 2026 Variety Show. Scholarships are available.',
        to: 'Ovation students performed in our Spring 2026 Variety Show. Scholarships are available. Ovation continues, with new dates to come: ask us about the next ones. In our other classes, students with higher needs can have a one-on-one class buddy through the UGA Speech and Hearing Clinic, at no cost to parents ([more in our FAQ](/faq)).',
        why: 'Says Ovation continues and points parents of a child who’d join a regular class to the class buddies.',
      },
    ],
  },
  {
    kind: 'programs',
    id: 'geode-acting-studio',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Acting Class for Teens 11–17 in Athens',
        why: 'Matches “teen acting class Athens GA”, with the ages.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'A weekly Tuesday acting class for tweens and teens 11–17 in Athens, GA: improv, scene work and character. Beginners welcome. Ends in our Variety Show.',
        why: 'Says it’s for teens, where, and that beginners are welcome, the question a teen new to acting asks first.',
      },
      {
        path: 'description.0',
        from: 'Geode’s Acting Studio is a weekly class for tweens and teens ready to explore the world of acting! Students build acting skills through improv, scene work, character exploration and creative theater games.',
        to: 'Geode’s Acting Studio is a weekly acting class for tweens and teens, ages 11 to 17, ready to explore the world of acting! Beginners are welcome. Students build acting skills through improv, scene work, character exploration and creative theater games.',
        why: 'Says “teen acting class” and the ages in plain words, and that beginners are welcome.',
      },
      {
        path: 'description.1',
        from: 'Every class is designed to inspire confidence, encourage collaboration, and help young performers discover their unique voice.',
        to: 'Every class is designed to inspire confidence, encourage collaboration, and help young performers discover their unique voice. Want to perform more? See the [Performance Troupe](/programs/performance-troupe), and everything else at [Geode](/geode).',
        why: 'Links to the troupe and to Geode’s other programs for teens.',
      },
      {
        path: 'tagline',
        from: 'For tweens and teens ready to explore the world of acting.',
        to: 'For tweens and teens ready to step into the world of acting.',
        why: 'A touch more action for teens; who it’s for is unchanged.',
      },
    ],
  },
  {
    kind: 'programs',
    id: 'geode-adult-improv',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Adult Improv Night in Athens, GA (18+)',
        why: 'Matches “adult improv Athens GA” and “improv night”.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Low-stakes improv games for grown-ups on the third Thursday of each month, 6:30–8:30 pm. No experience needed; BYOB with a 21+ ID. $25.',
        why: 'Gives when, the price, and that beginners are welcome: what an adult deciding on a night out checks.',
      },
      {
        path: 'description.0',
        from: 'Let it all loose as you play group games to explore your inner improviser! Join us for laughter and community as we get silly and learn some improv games in a low-stakes environment.',
        to: 'Let it all loose as you play group games to explore your inner improviser! This monthly improv night for adults is beginner-friendly: join us for laughter and community as we get silly and learn some improv games in a low-stakes environment.',
        why: 'Says “improv night for adults” and “beginner” in plain words.',
      },
    ],
  },
];
