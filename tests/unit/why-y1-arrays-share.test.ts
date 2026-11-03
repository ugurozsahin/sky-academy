// #2317 (y1-arrays, y1-share): the why shows the repeated addition or the multiplication behind the answer, built from the card's own numbers.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const run = (id: string, each: (q: { prompt: string; answer: string; why: string }) => void) => {
  const t = TOPICS.find(x => x.id === id)!;
  for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
    const q = t.gen(d, rngOf((s + 1) * 104729 + d));
    expect(q.why, q.prompt).toBeTruthy();
    expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(10);
    each(q as never);
  }
};

describe('y1-arrays / y1-share whys (#2317)', () => {
  it('y1-arrays: rows of the same number added up to the answer', () => run('y1-arrays', q => {
    const m = /^(\d+) rows of (\d+)/.exec(q.prompt)!;
    expect(q.why).toBe(`${Array(Number(m[1])).fill(m[2]).join(' + ')} = ${q.answer}`);
  }));
  it('y1-share: the multiplication that checks the sharing or grouping', () => run('y1-share', q => {
    const share = /^Share (\d+) between (\d+)/.exec(q.prompt);
    if (share) expect(q.why).toBe(`${q.answer} × ${share[2]} = ${share[1]}, so ${q.answer} each`);
    else {
      const g = /^How many groups of (\d+) in (\d+)/.exec(q.prompt)!;
      expect(q.why).toBe(`${q.answer} groups of ${g[1]} make ${g[2]}`);
      expect(Number(q.answer) * Number(g[1])).toBe(Number(g[2]));
    }
  }));
});
