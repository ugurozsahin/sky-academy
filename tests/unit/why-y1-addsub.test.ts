// #2317 (y1-add, y1-sub, y1-missing): the why is the complete number sentence, true and built from the card's own numbers.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const holds = (s: string) => {
  const m = /^(\d+) ([+−]) (\d+) = (\d+)$/.exec(s) ?? /^(\d+) = (\d+) ([+−]) (\d+)$/.exec(s);
  if (!m) return false;
  if (s.startsWith(`${m[1]} =`)) return Number(m[1]) === (m[3] === '+' ? Number(m[2]) + Number(m[4]) : Number(m[2]) - Number(m[4]));
  return Number(m[4]) === (m[2] === '+' ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3]));
};
const run = (id: string, each: (q: { prompt: string; answer: string; why: string }) => void) => {
  const t = TOPICS.find(x => x.id === id)!;
  for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
    const q = t.gen(d, rngOf((s + 1) * 104729 + d));
    expect(q.why, q.prompt).toBeTruthy();
    expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(8);
    expect(holds(q.why!), q.why).toBe(true);
    each(q as never);
  }
};
// The why is the prompt with "?" replaced by the answer.
const filled = (q: { prompt: string; answer: string }) => q.prompt.replace('?', q.answer);

describe('y1-add / y1-sub / y1-missing whys (#2317)', () => {
  it('y1-add: the why is the sum worked out', () => run('y1-add', q => expect(q.why).toBe(filled(q))));
  it('y1-sub: the why is the subtraction worked out', () => run('y1-sub', q => expect(q.why).toBe(filled(q))));
  it('y1-missing: the why is the sentence with the missing number filled in', () => run('y1-missing', q => expect(q.why).toBe(filled(q))));
});
