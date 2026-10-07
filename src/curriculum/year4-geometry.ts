// Year 4 geometry strand (#1069). No topic lands here yet — each slot below is a future PR's own ticket.
// import: y4-shapes
// import: y4-angles
// import: y4-symmetry
// import: y4-coords
import type { Topic } from './types';
import { y4Coords } from './year4-coords';
import { y4Angles } from './year4-angles';

export const Y4_GEOMETRY: Topic[] = [
  // slot: y4-shapes
  { id: 'y4-angles', title: 'Acute and Obtuse Angles', icon: '📐', subject: 'maths', year: 'year4', nc: 'Y4 Geometry: acute, obtuse, compare and order angles (4M35)', sequenceFrom: 3, gen: y4Angles },
  // slot: y4-symmetry
  { id: 'y4-coords', title: 'Coordinates', icon: '🧭', subject: 'maths', year: 'year4', nc: 'Y4 Geometry: describe positions as coordinates in the first quadrant, translate a point, complete a polygon (4M38–40)', gen: y4Coords },
];
