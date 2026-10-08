// Pooled Sprints (#1234): a fixed list of our own topics, never a copy of a paper. Pure; #1235 adds its arithmetic lists here.
import { topicById, type Topic, type YearId } from '../curriculum';
import { answerableBy } from './pools';

/** Grammar and punctuation topics in year order. An id with no generator yet is skipped by `grammarPool`. */
export const GRAMMAR: string[] = [
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
