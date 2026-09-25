import type { Location } from './types';

export const locations: Location[] = [
  {
    id: 'hq',
    name: 'Little Characters HQ',
    shortName: 'HQ · W Broad St',
    address: ['1635 W Broad St', 'Athens, GA 30606'],
    mapUrl: 'https://maps.google.com/?q=1635+W+Broad+St+Athens+GA+30606',
    notes:
      'On the south side of W Broad St, between Rocksprings and Alps. A 5,000 sq ft accessible space bursting with color and natural light, and only a mile from downtown.',
    usedFor: 'Weekly classes, workshops, parties and Parents’ Night Out',
  },
  {
    id: 'marigold',
    name: 'Marigold Auditorium',
    shortName: 'Marigold · Winterville',
    address: ['Winterville Campus for Arts & Culture', '371 N Church St', 'Winterville, GA 30683'],
    mapUrl: 'https://maps.google.com/?q=371+N+Church+St+Winterville+GA+30683',
    notes: 'A real stage with real lights, where our production camps rehearse and our variety shows go up.',
    usedFor: 'Summer production camps and showcases',
  },
  {
    id: 'athens-academy',
    name: 'Athens Academy · Harrison Center',
    shortName: 'Athens Academy',
    address: ['1281 Spartan Ln', 'Athens, GA 30606'],
    mapUrl: 'https://maps.google.com/?q=1281+Spartan+Lane+Athens+GA+30606',
    usedFor: 'After-school enrichment for Athens Academy students',
  },
  {
    id: 'brella',
    name: 'Brella Studio',
    shortName: 'Brella Studio',
    address: ['Athens, GA'],
    mapUrl: 'https://maps.google.com/?q=Brella+Studio+Athens+GA',
    usedFor: 'Ovation, with It’s Good to See You Productions',
  },
];

export const locationById = (id: string) => locations.find((l) => l.id === id);
