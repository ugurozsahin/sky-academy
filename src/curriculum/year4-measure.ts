// Year 4 measure strand (#1069). Each slot below is a future PR's own ticket.
import { y4Convert } from './year4-convert';
import { y4Area } from './year4-area';
import { y4Time } from './year4-time';
import type { Topic } from './types';

export const Y4_MEASURE: Topic[] = [
  { id: 'y4-convert', title: 'Converting Units', icon: '📏', subject: 'maths', year: 'year4', nc: 'Y4 Measurement: convert between units (4M28, 4M33)', gen: y4Convert },
  { id: 'y4-area', title: 'Area and Perimeter', icon: '📐', subject: 'maths', year: 'year4', nc: 'Y4 Measurement: area by counting squares, perimeter (4M29–30)', gen: y4Area },
  { id: 'y4-time', title: '12- and 24-hour Time', icon: '🕒', subject: 'maths', year: 'year4', nc: 'Y4 Measurement: analogue, 12- and 24-hour clocks (4M32)', gen: y4Time },
];
