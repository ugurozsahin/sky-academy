// Year 4 measure strand (#1069). No topic lands here yet — each slot below is a future PR's own ticket.
// import: y4-convert
import { y4Area } from './year4-area';
// import: y4-time
import type { Topic } from './types';

export const Y4_MEASURE: Topic[] = [
  // slot: y4-convert
  { id: 'y4-area', title: 'Area and Perimeter', icon: '📐', subject: 'maths', year: 'year4', nc: 'Y4 Measurement: area by counting squares, perimeter (4M29–30)', gen: y4Area },
  // slot: y4-time
];
