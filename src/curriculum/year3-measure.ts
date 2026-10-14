// Year 3 measure strand (#1050). No topic lands here yet — each slot below is a future PR's own ticket.
// import: y3-roman
import type { Topic } from './types';
import { y3Measures } from './year3-measures';
import { y3Perimeter } from './year3-perimeter';
import { y3Money } from './year3-money';
import { y3Time } from './year3-time';
import { y3Calendar } from './year3-calendar';

export const Y3_MEASURE: Topic[] = [
  { id: 'y3-measures', title: 'Length, Mass and Capacity', icon: '📏', subject: 'maths', year: 'year3', nc: 'Y3 Measurement: measure, compare, add and subtract lengths, mass, capacity (3M21)', gen: y3Measures },
  { id: 'y3-perimeter', title: 'Perimeter', icon: '📐', subject: 'maths', year: 'year3', nc: 'Y3 Measurement: perimeter of simple 2-D shapes (3M22)', gen: y3Perimeter },
  { id: 'y3-money', title: 'Money and Change', icon: '💷', subject: 'maths', year: 'year3', nc: 'Y3 Measurement: add and subtract money, give change, £ and p (3M23)', gen: y3Money },
  { id: 'y3-time', title: 'Time to the Minute', icon: '🕒', subject: 'maths', year: 'year3', nc: 'Y3 Measurement: time to the minute, am/pm, 12- and 24-hour clocks (3M24, 3M25)', gen: y3Time },
  // slot: y3-roman
  { id: 'y3-calendar', title: 'Calendar and Durations', icon: '📅', subject: 'maths', year: 'year3', nc: 'Y3 Measurement: seconds, days in months and years, compare durations (3M26, 3M27)', gen: y3Calendar },
];
