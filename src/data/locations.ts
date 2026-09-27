import type { Location } from './types';

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

/** How to get to HQ, from the "Parking Instructions" guide on the current site. */
export const parking = {
  walkIn:
    'Park in one of the 25 spots on Minor St and walk your child to the front of the building. A teacher will be waiting by the front door to check them in. You’re welcome to wait in the lobby or run errands.',
  dropOff:
    'After 5 pm, you can stay in the car: at the crosswalk where W Hancock meets W Broad, turn into the neighbor’s circle driveway at the green building (GPS: 1655 W Hancock Ave) and pull up to our front door.',
  staffOnly: 'The lot behind the building is staff-only, so please don’t use the 1635 driveway.',
  late: 'Doors lock 5 minutes after class starts. If you’re running late, walk your student to the front door and knock.',
  guideUrl: 'https://www.littlecharacters.org/s/Little-Characters-Parking-Instructions.pdf',
};

export const locationById = (id: string) => locations.find((l) => l.id === id);
