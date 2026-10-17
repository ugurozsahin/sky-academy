// Challenge code (#1294): 40 bits, 8 Crockford base-32 characters, shown as XXXX-XXXX. It holds a topic, a seed, a score and a
// check, never a name, an avatar or a date. Pure: no DOM, no storage, no network.
import type { Question, Topic } from '../curriculum';
import { TOPICS, YEARS } from '../curriculum';
import { MODES, type ModeCtx } from './modes';
import { drawFresh } from './repeat-key';
import { seeded } from './dojo';

export interface Challenge { topic: number; seed: number; score: number; check: number }
export const CHALLENGE_BOUNDS = { topic: 511, seed: 4095, score: 127, check: 4095 } as const;
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';   // Crockford: no I, L, O, U
const HALF = 1 << 20;

/** Pack into two 20-bit halves (no BigInt on older WebViews): topic 9 + seed 11 high bits, then seed 1 + score 7 + check 12. */
export function encode(c: Challenge): string {
  const b = CHALLENGE_BOUNDS;
  for (const k of Object.keys(b) as (keyof Challenge)[]) if (!Number.isInteger(c[k]) || c[k] < 0 || c[k] > b[k]) throw new RangeError(`challenge ${k} out of range`);
  const hi = (c.topic << 11) | (c.seed >> 1), lo = ((c.seed & 1) << 19) | (c.score << 12) | c.check;
  const chars = (n: number) => [15, 10, 5, 0].map(s => ALPHABET[(n >> s) & 31]).join('');
  return `${chars(hi)}-${chars(lo)}`;
}

/** The fields, or `null` for anything that is not eight code characters. I and L read as 1, O as 0; case, spaces and hyphens are ignored. */
export function decode(text: string): Challenge | null {
  const s = text.toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  if (s.length !== 8) return null;
  const v = [...s].map(ch => ALPHABET.indexOf(ch));
  if (v.some(x => x < 0)) return null;
  const half = (a: number[]) => a.reduce((n, x) => n * 32 + x, 0);
  const hi = half(v.slice(0, 4)), lo = half(v.slice(4));
  if (hi >= HALF || lo >= HALF) return null;
  return { topic: hi >> 11, seed: ((hi & 0x7ff) << 1) | (lo >> 19), score: (lo >> 12) & 127, check: lo & 4095 };
}

/** A Sprint on `topic` runs on this rng, so the same seed asks the same questions. */
export const challengeSeed = (topic: Topic, seed: number): string => `challenge:${topic.id}:${seed}`;

/** 12-bit FNV-1a over the first ten `prompt|answer` pairs a seeded Sprint draws: a generator edit changes it for the same seed.
 *  Draws the way `Session.nextQuestion()` does (the Sprint's difficulty ramp, `drawFresh`'s re-roll) without building a Session. */
export function challengeCheck(topic: Topic, seed: number): number {
  const rng = seeded(challengeSeed(topic, seed)), year = YEARS.find(y => y.id === topic.year)!;
  let h = 2166136261, prev: Question | null = null;
  for (let i = 0; i < 10; i++) {
    const difficulty = MODES.sprint.difficulty({ year, questionsAsked: i } as ModeCtx);
    const { q } = drawFresh(() => topic.gen(difficulty, rng), prev);
    for (const ch of `${q.prompt}|${q.answer}\n`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    prev = q;
  }
  return (h >>> 0) & 4095;
}

/** A topic can carry a challenge when its respawn does not re-shuffle (a `sequenceFrom` topic would drift) and it is not a drill. */
export const challengeable = (t: Topic): boolean => t.sequenceFrom === undefined && !t.drill;
export const topicIndex = (t: Topic): number => TOPICS.indexOf(t);
