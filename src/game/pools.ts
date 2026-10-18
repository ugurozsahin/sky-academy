// One rule for "which topics can this answer surface play" (#1065). Mixed pools (Sky Storm, Sprint, Boss, Sensei)
// and the split-screen Duel all draw bubbles, so a topic answered by tracing or the number pad stays out of them.
import type { Difficulty, Topic } from '../curriculum';

export type Surface = 'mission' | 'mixed' | 'duel';

/** `d` only matters for `duel`: a build or spelling sequence has no "first correct slice" from `sequenceFrom` up,
 *  and a sequence topic asked about without a difficulty is out (fail closed). `mixed` never reads `sequenceFrom`
 *  on purpose: a Session can ask sequence questions, only a two-player duel cannot. */
export function answerableBy(topic: Topic, surface: Surface, d?: Difficulty): boolean {
  if (surface === 'mission') return true;
  if (topic.solo) return false;   // #1017: a story topic is a mission only
  if (topic.input === 'tracing' || topic.input === 'keypad') return false;
  return surface !== 'duel' || topic.sequenceFrom === undefined || (d !== undefined && d < topic.sequenceFrom);
}

/** A topic a mixed mode may draw (#1017): the one predicate Sprint, Storm, Boss and Sensei filter by. */
export const mixable = (t: Topic): boolean => answerableBy(t, 'mixed');

/** A year's bubble topics for one subject, in registry order (#908) — what the island's Mixed modes draw from and the
 *  chooser lists. Pure over `topics` (a `topicsFor(year.id)` list), the shape `weakestTopics` and `duelPool` take. */
export const subjectTopics = (topics: Topic[], subject: Topic['subject']): Topic[] =>
  topics.filter(t => t.subject === subject && answerableBy(t, 'mixed'));

/** The Mixed pool for the open subject tab (#908): `subjectTopics`, or the whole year's bubble topics when the subject
 *  has none (#1325), so a subject that is still empty never hands `Session.pickTopic()` an empty pool — that throws.
 *  Unreachable with today's registry (`tests/unit/curriculum.test.ts` pins every shown year's subjects non-empty). */
export function subjectPool(topics: Topic[], subject: Topic['subject']): Topic[] {
  const own = subjectTopics(topics, subject);
  if (own.length) return own;
  console.warn(`Sharpwise: no ${subject} bubble topic on this island — drawing from the whole year (#1325)`);   // a degrade a child would not notice must still leave a trace
  return topics.filter(t => answerableBy(t, 'mixed'));
}
