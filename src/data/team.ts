import type { TeamMember } from './types';

/*
 * Bios are taken from the current Team page as surfaced by search. Last names
 * and roles marked TODO need confirming, and headshots go in public/images/team/.
 */
export const team: TeamMember[] = [
  {
    name: 'Hannah Eppling',
    role: 'Founder & Director',
    gel: 'magenta',
    bio: [
      'Hannah has a yearning to encourage the hearts of others, and her favorite way to do that is through theater. She started directing her sister in their basement at age four, was in her first play at eight, and kept going through high school, college and professional work on stage, on film and in improv.',
      'In 2016 she left a 9-to-5 job to apprentice in theater education. After eight years of teaching theater to people ages 3 to 50, she started Little Characters to bring more play and creativity to the Athens community.',
    ],
    image: { alt: 'Hannah Eppling', placeholder: 'Hannah' },
  },
  {
    name: 'CC Conner',
    role: 'Teaching Artist', // TODO(hannah): confirm title
    gel: 'amber',
    bio: ['CC leads Fun Mondays at HQ and co-teaches our Athens Academy enrichment program.'],
    image: { alt: 'CC Conner', placeholder: 'CC' },
  },
  {
    name: 'Carley Peden',
    role: 'Teaching Artist',
    gel: 'cyan',
    bio: [
      'Carley performed in more than fifteen productions at Statesboro High, including Wednesday in The Addams Family, Dr. Vivian Bearing in Wit, and the Dragon in Shrek. She played guitar and sang with School of Rock and Roll for seven years.',
      'Now at the University of Georgia studying Landscape Architecture with a certificate in Music Business, she was inspired by her “Theatre for Change” seminar and is excited to share the power of drama with our students.',
    ],
    image: { alt: 'Carley Peden', placeholder: 'Carley' },
  },
  {
    name: 'Emily',
    role: 'Set & Costume Designer', // TODO(hannah): last name
    gel: 'green',
    bio: [
      'Emily is a set and costume designer who has worked on Broadway productions, regional theater and film. She has a BFA in Theatre from the University of Montevallo and an MFA in Set and Costume Design from Ohio University.',
      'She designed 75+ productions as a freelancer in the San Francisco Bay Area and spent five years as a set designer at Laika Studios, working on three Academy Award–nominated films. She is also the mom of a 9-year-old little character.',
    ],
    image: { alt: 'Emily, set and costume designer', placeholder: 'Emily' },
  },
  {
    name: 'Shondra Taylor',
    role: 'Teaching Artist', // TODO(hannah): confirm role and bio
    gel: 'lilac',
    bio: ['Shondra holds an Associate’s Degree in Early Childhood Education and has worked as a teacher and as the director of a daycare center.'],
    image: { alt: 'Shondra Taylor', placeholder: 'Shondra' },
  },
  {
    name: 'Alli Tyra',
    role: 'Teaching Artist',
    gel: 'amber',
    bio: ['Alli is a student at the University of Georgia who has always had a passion for theatre and performing. She has worked with kids of all ages and loves introducing people to theatre.'],
    image: { alt: 'Alli Tyra', placeholder: 'Alli' },
  },
  {
    name: 'Sunny Cantarella',
    role: 'Teaching Artist',
    gel: 'magenta',
    bio: ['Sunny is a second-year student at the University of Georgia majoring in Entertainment and Media Studies.'],
    image: { alt: 'Sunny Cantarella', placeholder: 'Sunny' },
  },
];
