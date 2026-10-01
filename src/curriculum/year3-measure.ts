// Year 3 measure strand (#1050). No topic lands here yet — each slot below is a future PR's own ticket.
// import: y3-measures
// import: y3-perimeter
// import: y3-money
// import: y3-roman
// import: y3-calendar
import type { Topic } from './types';
import { y3Time } from './year3-time';

export const Y3_MEASURE: Topic[] = [
  // slot: y3-measures
  // slot: y3-perimeter
  // slot: y3-money
  { id: 'y3-time', title: 'Time to the Minute', icon: '🕒', subject: 'maths', year: 'year3', nc: 'Y3 Measurement: time to the minute, am/pm, 12- and 24-hour clocks (3M24, 3M25)', gen: y3Time },
  // slot: y3-roman
  // slot: y3-calendar
];
