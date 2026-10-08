// The Year 6 topic registry (#1212). Concatenates every strand, in this fixed order, and nothing else — a new
// Year 6 topic fills its own slot in its own strand module, never edits this file.
// Import direction: year6-topics → year6-* → shared modules (util.ts, ks2num.ts, types.ts). No Year 6 file
// imports another year's file, and no shared module imports a year file.
import type { Topic } from './types';
import type { Strand } from './strands';
import { Y6_NUMBER } from './year6-number';
import { Y6_CALC } from './year6-calc';
import { Y6_FRACTIONS } from './year6-fractions';
import { Y6_RATIO } from './year6-ratio';
import { Y6_ALGEBRA } from './year6-algebra';
import { Y6_MEASURE } from './year6-measure';
import { Y6_GEOMETRY } from './year6-geometry';
import { Y6_STATS } from './year6-stats';
import { Y6_READING } from './year6-reading';
import { Y6_SPELLING } from './year6-spelling';
import { Y6_GRAMMAR } from './year6-grammar';

// #1068: each module's rows take its strand unless a row already names its own.
const tag = (strand: Strand, rows: Topic[]): Topic[] => rows.map(t => ({ ...t, strand: t.strand ?? strand }));

export const YEAR6_TOPICS: Topic[] = [
  ...tag('number', Y6_NUMBER), ...tag('calc', Y6_CALC), ...tag('fractions', Y6_FRACTIONS), ...tag('ratio', Y6_RATIO),
  ...tag('algebra', Y6_ALGEBRA), ...tag('measure', Y6_MEASURE), ...tag('geometry', Y6_GEOMETRY), ...tag('stats', Y6_STATS),
  ...tag('reading', Y6_READING), ...tag('spelling', Y6_SPELLING), ...tag('grammar', Y6_GRAMMAR),
];
