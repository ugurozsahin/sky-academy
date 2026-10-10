// Pooled Sprints (#1234): a fixed list of our own topics, never a copy of a paper. Pure.
import { topicById, topicsFor, type Topic, type YearId } from '../curriculum';
import { answerableBy } from './pools';

/** Grammar and punctuation topics in year order. An id with no generator yet is skipped by `grammarPool`. */
export const GRAMMAR: readonly string[] = [
  'y3-wordfamily', 'y3-perfect', 'y3-speech',
  'y4-plural-poss', 'y4-standard', 'y4-nounphrase', 'y4-speech', 'y4-pronouns', 'y4-determiners',
  'y5-verbs', 'y5-verbprefix', 'y5-relative', 'y5-modal', 'y5-parenthesis', 'y5-commas', 'y5-cohesion', 'y5-perfect',
  'y6-hyphen', 'y6-formal', 'y6-synonyms', 'y6-passive', 'y6-subjunctive', 'y6-clauses', 'y6-lists', 'y6-subjectobject', 'y6-cohesion', 'y6-consistency',
];
// Left out for now, their prompts fail the paper-voice rail ("Slice…"/"Which…" at d2–d3): y3-an ("a or an?"),
// y3-conjunctions (a bare sentence), y4-adverbials ("Where does the comma go?"). Re-add each once reworded.
export const GRAMMAR_MIN = 6;
const YEAR_NUMBER: Record<string, number> = { year5: 5, year6: 6 };

/** The listed ids from Year 3 up to and including `year`'s that exist as core bubble topics. Empty off the KS2 upper islands. */
export function grammarPool(year: YearId): Topic[] {
  const n = YEAR_NUMBER[year]; if (!n) return [];
  return GRAMMAR.filter(id => Number(id[1]) <= n).map(topicById).filter((t): t is Topic => !!t && !t.drill && t.subject === 'writing' && answerableBy(t, 'mixed'));
}

/** The play screen's heading: a fix round, Sensei, the topic, a titled pool (Grammar mix), else the mode's own. */
export const playTitle = (o: { practice?: unknown; topic?: Topic; title?: string }, staged: boolean, training: boolean, modeTitle: string): string =>
  o.practice ? 'Fix my mistakes' : staged ? (training ? 'Sensei Training' : o.topic!.title) : o.title ?? modeTitle;

/** The pool the island offers as a row: `pool` itself once it holds `GRAMMAR_MIN` topics, else nothing (no row). */
export const offeredPool = (pool: Topic[]): Topic[] => pool.length >= GRAMMAR_MIN ? pool : [];

/** Context-free calculation topics per island (#1235). An id with no generator yet is skipped by `poolFor`, so later topics join by themselves. */
export const ARITHMETIC: Record<string, string[]> = {
  year5: ['y5-column', 'y5-mental', 'y5-longmult', 'y5-shortdiv', 'y5-mentalmd', 'y5-x10', 'y5-squares', 'y5-fracadd', 'y5-fracmult'],
  year6: ['y6-longmult', 'y6-longdiv', 'y6-mental', 'y6-order-ops', 'y6-fracadd', 'y6-fracmult', 'y6-fracdiv', 'y6-decimals', 'y6-decmult', 'y6-decdiv', 'y6-percentof'],
};
export const ARITHMETIC_MIN = 4;

/** The listed ids that exist as core Sprint-answerable topics of `year`. Empty for a year with no list. */
export const poolFor = (list: Record<string, string[]>, year: YearId): Topic[] =>
  topicsFor(year).filter(t => (list[year] ?? []).includes(t.id) && answerableBy(t, 'mixed'));

/** The Arithmetic Sprint's pool, or nothing (no row) below `ARITHMETIC_MIN` topics. */
export const arithmeticPool = (year: YearId): Topic[] => { const p = poolFor(ARITHMETIC, year); return p.length >= ARITHMETIC_MIN ? p : []; };
