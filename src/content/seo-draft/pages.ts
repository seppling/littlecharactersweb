/** Wording drafts for the site pages and site settings. Format: docs/seo/drafts.md. */
import type { PageDraft } from './format';

export const pages: PageDraft[] = [
  {
    kind: 'pages',
    id: 'site',
    edits: [
      {
        path: 'description',
        from: 'Theater classes, camps, workshops and shows for ages 4 to 100 in Athens, Georgia. Encouraging creative hearts through theater since 2022.',
        to: 'Theater classes, camps and shows for kids 4 and up, teens and adults in Athens, GA and the Greater Athens area. Encouraging creative hearts since 2022.',
        why: 'Google shows this under any page without its own description, so it now names kids, teens and adults, “Athens, GA” and the wider area, in the 155 characters Google shows.',
      },
    ],
  },
  {
    kind: 'pages',
    id: 'home',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Kids Theater Classes & Camps, Athens GA',
        why: 'The words parents type most (“kids theater classes Athens GA”), with camps, in Google’s title for the home page.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Acting, improv and film classes, camps and shows for ages 4 and up in Athens, GA. Small classes, a show every term, and most weekly classes start free.',
        why: 'Answers a parent’s first questions in the search result (what, what ages, where) and gives a reason to click.',
      },
      {
        path: 'hero.intro',
        from: 'Through dramatic play, improv, storytelling and script writing, we help children, teens and adults discover confidence, creativity, and a place where they belong.',
        to: 'Theater classes, camps and shows for ages 4 and up in the Greater Athens area. Through dramatic play, improv, storytelling and script writing, we help children, teens and adults discover confidence, creativity, and a place where they belong.',
        why: 'The top of the page never said “classes”, “camps” or the ages; one plain opening line tells parents and Google what we offer and where.',
      },
      {
        path: 'trial.body',
        from: 'New students can try a weekly class free. Come see if it clicks, and only pay if your child wants to stay.',
        to: 'New students can try a weekly class free. Come see if it clicks, and only pay if your child wants to stay. After that, weekly classes are {tuitionRange}, by class length.',
        why: 'Answers “how much are kids theater classes?” on the home page; {tuitionRange} fills in from the class prices, so it stays current.',
      },
      {
        path: 'why.facts.3.text',
        from: 'Class buddies for students with higher needs, through the UGA Speech and Hearing Clinic, at no cost to parents.',
        to: 'Class buddies for students with higher needs, through the UGA Speech and Hearing Clinic, at no cost to parents. [Ovation](/programs/ovation) is our adaptive class.',
        why: 'Links families looking for special-needs or adaptive theater straight to Ovation.',
      },
      {
        path: 'extras.items.1.title',
        from: 'Parties',
        to: 'Birthday parties',
        why: 'Parents search for “birthday party places”, not “parties”; the card still says the parties suit any occasion.',
      },
      {
        path: 'extras.items.4.body',
        from: 'We’re a verified CCSD school vendor, running after-school programs around the county.',
        to: 'We’re a verified Clarke County School District (CCSD) vendor, running after-school programs around the county.',
        why: 'Spells out the school district’s name, which parents and schools search for in full.',
      },
      {
        path: 'story.paragraphs.0',
        from: 'A few years ago, Athens lost several of its historic kids’ theater companies. Hannah Eppling, a local mom and theater educator who has taught theater to 3- to 50-year-olds, started Little Characters in {founded} to keep the joy and connection of theater going for students of all ages and abilities, beginning with summer camps.',
        to: 'A few years ago, Athens lost several of its historic kids’ theater companies. Hannah Eppling, a local mom and theater educator who has taught theater to 3- to 50-year-olds, started Little Characters in {founded} to keep the joy and connection of theater going for students of all ages and abilities, beginning with summer camps. Today, families join us from across the Greater Athens area, including Watkinsville, Winterville, Bogart and Statham.',
        why: 'Names the nearby towns families come from, once, so parents searching from Watkinsville, Winterville, Bogart or Statham find us.',
      },
      {
        path: 'signup.body',
        from: 'Mini camps, workshops and summer camp fill fast. Get dates, new classes and show announcements by email.',
        to: 'Mini camps on school holidays, workshops and [summer camp](/camps) fill fast. Get dates, new classes and show announcements by email.',
        why: 'Summer camp is the biggest search of the year; this links the home page to the camps page by name.',
      },
    ],
  },
  {
    kind: 'pages',
    id: 'about',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'About Our Children’s Theater, Athens GA',
        why: 'Matches searches for “children’s theater Athens GA”, which this page answers most fully.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Founded in 2022 by Hannah Eppling, Little Characters is a children’s theater in Athens, GA: small classes, original shows and room for every ability.',
        why: 'Who we are, who started it and what sets us apart, in the words Google shows under the title.',
      },
      {
        path: 'hero.story.1',
        from: 'In {founded}, she started Little Characters with summer camps. Today we run weekly classes, camps, workshops and shows from our own 5,000 sq ft space on W Broad St, plus Geode for tweens, teens and adults.',
        to: 'In {founded}, she started Little Characters with summer camps. Today we run weekly classes, camps, workshops and shows from our own 5,000 sq ft space on W Broad St in Athens, plus Geode for tweens, teens and adults. Families come from across the Greater Athens area, including Watkinsville, Winterville, Bogart and Statham.',
        why: 'Says where we are and names the nearby towns families come from, once, for parents searching from those towns.',
      },
      {
        path: 'differences.items.2.body',
        from: 'All of our staff have worked with kids of all ages and abilities. Through the UGA Speech and Hearing Clinic, students with higher needs get a one-on-one class buddy at no cost to parents, and Ovation is our adaptive class.',
        to: 'All of our staff have worked with kids of all ages and abilities. Through the UGA Speech and Hearing Clinic, students with higher needs get a one-on-one class buddy at no cost to parents, and [Ovation](/programs/ovation), first launched with It’s Good to See You Productions, is our adaptive class.',
        why: 'Names Ovation’s founding partner (from the Ovation page) and links to Ovation, for families searching for adaptive or special-needs theater.',
      },
      {
        path: 'team.social',
        from: 'Follow along on [Instagram]({instagram}) and [Facebook]({facebook}).',
        to: 'Follow along on [Instagram]({instagram}) and [Facebook]({facebook}), or read [Macaroni KID Athens’s story about us](https://athens.macaronikid.com/articles/64cdb2aabfe2815b16aec3f8/little-characters-theatre-troupe).',
        why: 'Links the Macaroni KID Athens article about Little Characters, so families (and Google) see that a local parents’ guide has written about us.',
      },
      {
        path: 'schools.lede',
        from: 'Little Characters is a verified CCSD school vendor. We offer after-school programs and weekend events throughout the county.',
        to: 'Little Characters is a verified Clarke County School District (CCSD) school vendor. We offer after-school programs and weekend events throughout the county.',
        why: 'Spells out the school district’s name, which parents and school staff search for in full.',
      },
      {
        path: 'schools.body',
        from: 'We’ve run programs at Athens Academy, Athens Montessori School, Oglethorpe Ave. Elementary School and Love.Craft Athens. [Ask about bringing us to your school](/contact?topic=general).',
        to: 'We’ve run programs at Athens Academy, Athens Montessori School, Barrow Elementary School, Oglethorpe Ave. Elementary School, Timothy Elementary School and Love.Craft Athens. [Ask about bringing us to your school](/contact?topic=general).',
        why: 'Adds Barrow and Timothy Elementary, where programs run now, so families searching for their school’s after-school options find us.',
      },
      {
        path: 'facts.items.12.text',
        from: 'Verified CCSD school vendor. Programs at Athens Academy, Athens Montessori School, Oglethorpe Ave. Elementary School and Love.Craft Athens',
        to: 'Verified Clarke County School District (CCSD) school vendor. Programs at Athens Academy, Athens Montessori School, Barrow Elementary School, Oglethorpe Ave. Elementary School, Timothy Elementary School and Love.Craft Athens',
        why: 'Keeps the key facts (which search engines and AI assistants quote) in step with the schools list above.',
      },
    ],
  },
  {
    kind: 'pages',
    id: 'camps',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Theater Camps for Kids in Athens, GA',
        why: 'Matches “theater camp Athens GA”, the main search this page should win.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Summer theater camp for ages 4–17, plus mini camps on CCSD school holidays. Half days, 9 am–1 pm, about $50 a day, and camp weeks end in a show.',
        why: 'Gives the ages, hours and price parents compare camps by, right in the search result.',
      },
      {
        path: 'hero.intro',
        from: 'Each summer we offer 3–5 weeks of camp for students 4–17, from performing an original show to improv and technical theater. During the school year, we run half-day workshops and mini camps on CCSD school holidays.',
        to: 'Each summer we offer 3–5 weeks of half-day summer camp for students 4–17, from performing an original show to improv and technical theater. During the school year, we run half-day workshops and mini camps on Clarke County School District (CCSD) holidays. Past mini camps have covered fall break, Thanksgiving and MLK Day.',
        why: 'Adds “summer camp” and “half-day”, which parents type, and names the school breaks we’ve run camps for, without promising dates that aren’t set.',
      },
      {
        path: 'summer.formats.1.body',
        from: 'Shorter, deeper camps for tweens and teens, like our three-day improv and writing intensive, ending in a performance of their own work.',
        to: 'Shorter, deeper camps for tweens and teens through [Geode](/geode), like our three-day improv and writing intensive, ending in a performance of their own work.',
        why: 'Links teen camp searches to Geode, our tween, teen and adult program.',
      },
    ],
  },
  {
    kind: 'pages',
    id: 'geode',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Teen Acting & Adult Improv in Athens, GA',
        why: 'Matches “teen acting classes” and “adult improv” searches in Athens, GA, which nothing on the page said in plain words.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Geode, theater for tweens, teens and adults in Athens, GA: a beginner-friendly acting studio for ages 11–17, a performance troupe and adult improv nights.',
        why: 'Says who Geode is for, where, and that beginners are welcome, in the search result.',
      },
      {
        path: 'hero.eyebrow',
        from: 'A Little Characters company',
        to: 'Teen & adult theater in Athens, GA · A Little Characters company',
        why: 'Puts “teen”, “adult” and “Athens, GA” at the very top of the page, where parents and Google look first.',
      },
      {
        path: 'hero.intro',
        from: 'Beauty surprises us when we crack open our exterior and reveal what’s inside. Geode offers classes, events and private lessons for tweens, teens and adults: fun, community-building theater without the commitment of nightly rehearsals.',
        to: 'Beauty surprises us when we crack open our exterior and reveal what’s inside. Geode offers classes, events and [private lessons](/programs/private-lessons) for tweens, teens and adults in Athens: fun, community-building theater without the commitment of nightly rehearsals. New to acting? Beginners are welcome in the [Acting Studio](/programs/geode-acting-studio).',
        why: 'Tells teens and parents that no experience is needed, and links to the Acting Studio and private lessons.',
      },
      {
        path: 'classes.heading',
        from: 'Classes this fall',
        to: 'Acting & improv classes this fall',
        why: 'Says “acting” and “improv” classes in plain words, as people search for them.',
      },
      {
        path: 'improv.lede',
        from: 'First Friday Improv Nights are back, and now they’re on the third Thursday! Come hang out, play as little or as much as you like, drink what you want (we’ll check IDs), and explore improv through group and partner games.',
        to: 'First Friday Improv Nights are back, and now they’re on the third Thursday of the month, 6:30–8:30 pm, for $25! Come hang out, play as little or as much as you like, drink what you want (we’ll check IDs), and explore improv through group and partner games.',
        why: 'Gives the time and price in the text, the first things adults check before trying an improv night.',
      },
    ],
  },
  {
    kind: 'pages',
    id: 'give',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Donate to Kids Theater in Athens, GA',
        why: 'Matches how people search to support kids’ theater in Athens, GA.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Your gift funds scholarships and pay-what-you-can places so any child in Athens, GA can take the stage. $30 covers a performance fee; $250, a week of camp.',
        why: 'Shows donors what a gift does, with real amounts from the page, in the search result.',
      },
      {
        path: 'hero.intro',
        from: 'Donations to Little Characters go directly to supporting our programs. Your gift gives kids in the Athens area a safe place to express themselves and step into the world of theater, and lets us offer pay-what-you-can rates to any family who needs them.',
        to: 'Little Characters is a small local business, and donations go directly to supporting our programs. Your gift gives kids in the Greater Athens area a safe place to express themselves and step into the world of theater, and lets us offer pay-what-you-can rates to any family who needs them.',
        why: 'Answers donors’ first question plainly (who they’re giving to) and uses “Greater Athens area”, as the rest of the site does.',
      },
      {
        path: 'scholarship.body',
        from: 'We never want cost to keep a student from joining our programs, and we’re happy to arrange a pay-what-you-can rate. Email [{email}](mailto:{email}?subject=Scholarship) for the scholarship application.',
        to: 'We never want cost to keep a student from joining our programs, and we’re happy to arrange a pay-what-you-can rate. Email [{email}](mailto:{email}?subject=Scholarship) for the scholarship application, or see our [discounts in the parent FAQ](/faq).',
        why: 'Links families asking about cost to the FAQ’s answers on discounts and scholarships.',
      },
    ],
  },
  {
    kind: 'pages',
    id: 'contact',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Contact & Directions, W Broad St, Athens',
        why: 'Matches searches for our address and directions; the description adds “GA”.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Find us at 1635 W Broad St, Athens, GA, about a mile from downtown. Call, email or send a note, and see where to park and drop off.',
        why: 'Puts the address (as the rest of the site writes it) and parking in the search result.',
      },
      {
        path: 'hero.intro',
        from: 'Interested but need more info? The class times don’t work for you? Questions about scholarships? We’re eager to make a class work for your family.',
        to: 'Interested but need more info? The class times don’t work for you? Questions about scholarships? We’re eager to make a class work for your family. Families come to our W Broad St space in Athens from across the Greater Athens area, including Watkinsville, Winterville, Bogart and Statham.',
        why: 'Says where we are in words and names the nearby towns families come from, once, for parents searching from those towns.',
      },
    ],
  },
  {
    kind: 'pages',
    id: 'faq',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Parent FAQ: Classes, Camps & Tuition',
        why: 'Matches question searches like “how much are kids theater classes” from families deciding.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Class sizes, tuition, discounts, scholarships, parking and performances: straight answers for families at Little Characters in Athens, GA.',
        why: 'Lists the topics the page answers, so families see their question is covered before they click.',
      },
      {
        path: 'hero.intro',
        from: 'Can’t find it here? Email [{email}](mailto:{email}) or call [{phone}]({phoneHref}).',
        to: 'Answers for families across the Greater Athens area, from Watkinsville and Winterville to Bogart and Statham, about classes, camps, tuition and shows. Can’t find it here? Email [{email}](mailto:{email}) or call [{phone}]({phoneHref}).',
        why: 'Gives the page a plain opening about what it answers and names the nearby towns families come from, once.',
      },
    ],
  },
  {
    kind: 'pages',
    id: 'classes',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Kids Acting & Theater Classes, Athens GA',
        why: 'Matches “acting classes for kids Athens GA”, the main search for this page.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Weekly acting, improv, film and homeschool theater classes for ages 4–17 in Athens, GA. See times and prices, and try most weekly classes free.',
        why: 'Gives the kinds of classes, ages and place, and the free first class, in the search result.',
      },
      {
        path: 'hero.intro',
        from: 'Start with your child’s age. Every program shows its times, place, price and open spots, so you can enroll right from this page.',
        to: 'Weekly acting and theater classes in Athens, GA, for ages 4 and up. Start with your child’s age. Every program shows its times, place, price and open spots, so you can enroll right from this page. Weekly classes are {tuitionRange}, by class length; see the [parent FAQ](/faq) for discounts.',
        why: 'Adds “acting”, the ages and “Athens, GA” to the opening, answers the price question, and links to the FAQ on discounts.',
      },
    ],
  },
  {
    kind: 'pages',
    id: 'events',
    edits: [
      {
        path: 'seo.title',
        from: '',
        to: 'Kids Shows & Family Events in Athens, GA',
        why: 'Matches “kids events Athens GA” and family things-to-do searches.',
      },
      {
        path: 'seo.description',
        from: '',
        to: 'Student shows, Parents’ Night Out, a free monthly theater class and adult improv nights in Athens, GA. See what’s coming up and save your spot.',
        why: 'Names each kind of event and the place in the search result.',
      },
      {
        path: 'hero.intro',
        from: 'Come see what our students have been working on, drop the kids off for a night of games and crafts, try a free class, or play along yourself.',
        to: 'Student shows and family events in Athens, GA. Come see what our students have been working on, drop the kids off for a [night of games and crafts](/programs/parents-night-out), try a [free class](/programs/free-community-class), or [play along yourself](/programs/geode-adult-improv).',
        why: 'Adds the place to the opening and links each recurring event to its own page, for parents who want the details.',
      },
    ],
  },
];
