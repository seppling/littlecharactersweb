import type { TeamMember } from './types';

import hannah from '@/assets/team/hannah-eppling.webp';
import cc from '@/assets/team/cc-conner.webp';
import zack from '@/assets/team/zack-newcott.webp';
import shondra from '@/assets/team/shondra-taylor.webp';
import kidd from '@/assets/team/kidd-fielteau.webp';
import carley from '@/assets/team/carley-pedan.webp';
import emily from '@/assets/team/emily-greene.webp';
import alli from '@/assets/team/alli-tyra.webp';
import ileana from '@/assets/team/ileana-deppner.webp';

/* From the live "Our Team" page (captured Sep 25, 2026), lightly trimmed. */
export const team: TeamMember[] = [
  {
    name: 'Hannah Eppling',
    role: 'Owner + Creative Director + Teacher',
    gel: 'red',
    bio: [
      'Hi! I’m Hannah Eppling, and I’m so happy you are here! I have a yearning to encourage the hearts of others, and my favorite way to do so is through theater. When I started directing my sister in our basement at the age of four, my parents knew they needed to get me in drama classes ASAP. I was in my first play at eight, and continued on through high school, college and professional work on stage, film and improvisation.',
      'In 2016, I made the move from my 9-to-5 job to start apprenticing in theater education. I’ve taught theater to 3- to 50-year-olds and started Little Characters to bring more play and creativity to the Athens community. I am trained in theater for social change and programming for all ages and abilities.',
      'My favorite teaching topics are emotional development, improv and characterization on stage. I believe theater is a beautiful way to grow and share the gifts we were born with. When not working, I love getting outside with my husband, Stephen, and kiddos, Colette and Everett.',
    ],
    image: { src: hannah, alt: 'Hannah Eppling', position: '50% 8%' },
  },
  {
    name: 'CC Conner',
    role: 'Associate Director + Teacher',
    gel: 'teal',
    bio: [
      'CC has always been a wisecrackin’ merrymaker. She has lived inside her imagination since she was a child and is the embodiment of a class clown. She graduated magna cum laude from the University of Georgia with a B.S. in Psychology, and has worked in fashion, social work, carpentry, trivia quiz-mastering and yodeling. (When asked to list the fields she’s worked in, she always adds yodeling for fun.) CC is a trained improviser, seamstress and clown.',
    ],
    image: { src: cc, alt: 'CC Conner', position: '50% 20%' },
  },
  {
    name: 'Zack Newcott',
    role: 'Lead Teacher',
    gel: 'orange',
    bio: [
      'Also known as “Mr. Zack” in classrooms across the county, Zack has worked as a long-term substitute teacher in Athens, piloted boats and warded off hippos as a skipper on Disneyland’s Jungle Cruise, and played colorful characters (even Prince Charming) in productions from Bethesda, MD, to Visalia, CA.',
      'He has written a humor column for USA Today, created the animated series “Humorous Vacuum Robot,” and published two novels. He holds a degree in Film/Screenwriting from Biola University, is GACE certified for grades K–12, and is a Georgia Certified Peer Counselor.',
    ],
    image: { src: zack, alt: 'Zack Newcott', position: '50% 30%' },
  },
  {
    name: 'Shondra Taylor',
    role: 'Operations Manager',
    gel: 'purple',
    bio: [
      'Shondra holds an Associate’s Degree in Early Childhood Education and has worked as a teacher and director of a daycare center, and as an assistant manager and instructor at Board and Brush of Athens. She brings structure, positivity and fresh ideas to everything she does, and is the proud mother of two, ages 7 and 14.',
    ],
    image: { src: shondra, alt: 'Shondra Taylor', position: '50% 38%' },
  },
  {
    name: 'Kidd Fielteau',
    role: 'Teacher',
    gel: 'teal',
    bio: [
      'Kidd is a food and product photographer based in Athens. Photography and filmmaking started as a hobby that became a passionate career. He is a devoted husband and father of four who spends his free time playing video games and riding motorcycles.',
    ],
    image: { src: kidd, alt: 'Kidd Fielteau', position: '50% 25%' },
  },
  {
    name: 'Carley Pedan',
    role: 'Teacher',
    gel: 'yellow',
    bio: [
      'Carley took drama all four years of high school, playing characters, building sets, writing scripts, stage managing and student directing across fifteen-plus productions, including Wednesday in The Addams Family and Dragon in Shrek. She sang and played guitar with School of Rock and Roll for seven years, and now studies Landscape Architecture and Music Business at UGA.',
    ],
    image: { src: carley, alt: 'Carley Pedan', position: '50% 25%' },
  },
  {
    name: 'Emily Greene',
    role: 'Set, Costume and Prop Designer',
    gel: 'red',
    bio: [
      'Emily is a set and costume designer who has worked on Broadway productions, regional theater and film. She has a BFA from the University of Montevallo and an MFA in Set and Costume Design from Ohio University, designed 75+ productions in the San Francisco Bay Area, and spent five years at stop-motion studio Laika working on three Academy Award–nominated films. She is now the mother of a little character.',
    ],
    image: { src: emily, alt: 'Emily Greene', position: '50% 30%' },
  },
  {
    name: 'Alli Tyra',
    role: 'Assistant Teacher',
    gel: 'orange',
    bio: [
      'Alli is a student at the University of Georgia who has always had a passion for theatre and anything to do with performing. She has worked with kids of all ages and loves introducing theatre to people.',
    ],
    image: { src: alli, alt: 'Alli Tyra', position: '50% 30%' },
  },
  {
    name: 'Ileana Deppner',
    role: 'Assistant Teacher',
    gel: 'purple',
    bio: [
      'Ileana is a third-year student at UGA studying Psychology with a focus on child development. She loves to perform, has been in several shows with Town and Gown, and has assisted Little Characters classes over the past year.',
    ],
    image: { src: ileana, alt: 'Ileana Deppner', position: '50% 30%' },
  },
];
