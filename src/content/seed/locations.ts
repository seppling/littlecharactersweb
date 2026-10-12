import type { Location } from '../types';

export const locations: Location[] = [
  {
    id: 'hq',
    name: 'Little Characters HQ',
    shortName: 'HQ · W Broad St',
    address: ['1635 W Broad St', 'Athens, GA 30606'],
    mapUrl: 'https://maps.app.goo.gl/2sAZXSFJ3HkdCYsn9',
    notes:
      'Right on W Broad St between Rocksprings and Alps, on the south side of the street. A 5,000 sq ft accessible space bursting with color and natural light, about a mile from downtown.',
    usedFor: 'All weekly classes, workshops, parties and Parents’ Night Out',
  },
  {
    id: 'athens-academy',
    name: 'Athens Academy · Harrison Center',
    shortName: 'Athens Academy',
    address: ['1281 Spartan Ln', 'Athens, GA 30606'],
    mapUrl: 'https://maps.google.com/?q=1281+Spartan+Lane+Athens+GA+30606',
    usedFor: 'After-school enrichment for Athens Academy students',
  },
];
