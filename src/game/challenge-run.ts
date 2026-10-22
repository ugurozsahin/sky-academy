// Challenge code (#1294), the run side: which Sprints carry a seed, the last code in memory, and the friend's target.
// In memory only (the save's field list is closed, #903), so closing the app loses the code. No name, avatar or date is held.
import type { Topic } from '../curriculum';
import { TOPICS } from '../curriculum';
import { gameHidden, HIDDEN_LINE } from './hidden-game';
import { challengeable, challengeCheck, challengeSeed, CHALLENGE_BOUNDS, decode, encode, topicIndex } from './challenge';

let kept: { code: string; title: string } | null = null;
let target: number | null = null;

const freshSeed = (): number => Math.floor(Math.random() * (CHALLENGE_BOUNDS.seed + 1));
/** The seed number inside a Sprint's seed string, or null for any other seed (the Daily Sprint's). */
export const seedNumber = (seed?: string): number | null => { const m = /^challenge:.+:(\d+)$/.exec(seed ?? ''); return m ? Number(m[1]) : null; };

/** The seed for a child's own single-topic Sprint: a fresh one per start, and no target to beat. */
export function sprintSeed(topic: Topic): string | undefined {
  target = null;
  return challengeable(topic) ? challengeSeed(topic, freshSeed()) : undefined;
}
/** "Play again" re-deals a child's own Sprint, but replays a friend's challenge so the code can be tried again. */
export const replaySeed = (topic: Topic | undefined, seed?: string): string | undefined =>
  seedNumber(seed) !== null && topic && target === null ? challengeSeed(topic, freshSeed()) : seed;

export type Entered = { topic: Topic; seed: string } | { error: string };
/** Read a typed code: the topic and seed to play (the target is remembered), or a plain reason it cannot be played. */
export function enterCode(text: string): Entered {
  const c = decode(text);
  if (!c) return { error: "That code doesn't look right — check the letters." };
  const topic = TOPICS[c.topic], version = { error: 'That code was made on a different version of the game.' };
  if (!topic || !challengeable(topic) || challengeCheck(topic, c.seed) !== c.check) return version;
  if (gameHidden(topic)) return { error: HIDDEN_LINE };   // #2197: the code stays valid (the position index is unchanged); only the start is refused
  target = c.score;
  return { topic, seed: challengeSeed(topic, c.seed) };
}

/** Keep the code of the Sprint just finished and, when a friend's code is being played, the line saying whether it was beaten. */
export function challengeResult(topic: Topic, seed: string | undefined, correct: number): string | null {
  const n = seedNumber(seed);
  if (n === null || !challengeable(topic)) return null;
  const score = Math.min(correct, CHALLENGE_BOUNDS.score);
  kept = { code: encode({ topic: topicIndex(topic), seed: n, score, check: challengeCheck(topic, n) }), title: topic.title };
  if (target === null) return null;
  return `Challenge: ${target} to beat. You got ${correct} — ${correct > target ? 'you beat it!' : 'try the code again.'}`;
}
export const lastChallenge = () => kept;
export const forgetChallenge = () => { kept = null; target = null; };
