// Year 4 measure strand (#1069). Each slot below is a future PR's own ticket.
import { y4Convert } from './year4-convert';
// import: y4-area
// import: y4-time
import type { Topic } from './types';

export const Y4_MEASURE: Topic[] = [
  { id: 'y4-convert', title: 'Converting Units', icon: '📏', subject: 'maths', year: 'year4', nc: 'Y4 Measurement: convert between units (4M28, 4M33)', gen: y4Convert },
  // slot: y4-area
  // slot: y4-time
];
