// #2317 (y1-compare): the why is true of the numbers in the question, in few words.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y1-compare whys (#2317)', () => {
  it('every question has a short why that matches its numbers', () => {
    const t = TOPICS.find(x => x.id === 'y1-compare')!;
    const seen = new Set<string>();
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      let m: RegExpExecArray | null;
      if ((m = /^(\d+) and (\d+) are equal\.$/.exec(w))) {
        expect(m[1]).toBe(m[2]); expect(q.answer).toBe('equal'); seen.add('eq');
      } else if ((m = /^(\d+) is (more|fewer) than (\d+)\.$/.exec(w))) {
        const [x, y] = [Number(m[1]), Number(m[3])];
        expect(m[2] === 'more' ? x > y : x < y).toBe(true); expect(q.answer).not.toBe('equal'); seen.add('groups');
      } else if ((m = /^(\d+) is the (most|least) here\.$/.exec(w))) {
        expect(q.answer).toBe(m[1]); expect(q.prompt).toBe(`Which number is the ${m[2]}?`); seen.add('ml');
      } else throw new Error(`unexpected why: ${w}`);
    }
    expect([...seen].sort()).toEqual(['eq', 'groups', 'ml']);
  });
});
