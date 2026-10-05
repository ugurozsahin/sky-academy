// One rule for "which topics can this answer surface play" (#1065). Mixed pools (Sky Storm, Sprint, Boss, Sensei)
// and the split-screen Duel all draw bubbles, so a topic answered by tracing or the number pad stays out of them.
import type { Difficulty, Topic } from '../curriculum';

export type Surface = 'mission' | 'mixed' | 'duel';

/** `d` only matters for `duel`: a build or spelling sequence has no "first correct slice" from `sequenceFrom` up,
 *  and a sequence topic asked about without a difficulty is out (fail closed). `mixed` never reads `sequenceFrom`
 *  on purpose: a Session can ask sequence questions, only a two-player duel cannot. */
export function answerableBy(topic: Topic, surface: Surface, d?: Difficulty): boolean {
  if (surface === 'mission') return true;
  if (topic.input === 'tracing' || topic.input === 'keypad') return false;
  return surface !== 'duel' || topic.sequenceFrom === undefined || (d !== undefined && d < topic.sequenceFrom);
}
