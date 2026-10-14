// #1072: Boss Battle over one strand (Fractions, Place value…). Pure: groups an island's topics by `Topic.strand` (#1068).
import { STRANDS, type Strand } from '../curriculum/strands';
import type { Topic } from '../curriculum';
import { answerableBy } from './pools';

export const MIN_STRAND_TOPICS = 3;

export interface StrandPool { strand: Strand; title: string; topics: Topic[] }

/** Core bubble topics (no drills, no tracing or keypad) grouped by strand, strands with fewer than 3 topics dropped, in the list's order. */
export function strandPools(topics: Topic[]): StrandPool[] {
  const by = new Map<Strand, Topic[]>();
  for (const t of topics) {
    if (!t.strand || t.drill || !answerableBy(t, 'mixed')) continue;
    by.set(t.strand, [...(by.get(t.strand) ?? []), t]);
  }
  return [...by].filter(([, ts]) => ts.length >= MIN_STRAND_TOPICS).map(([strand, ts]) => ({ strand, title: STRANDS[strand], topics: ts }));
}
