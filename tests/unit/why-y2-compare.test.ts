// #2317 (y2-compare): the why names the digit that decides, and is true of the pair shown.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y2-compare whys (#2317)', () => {
  it('names tens or ones in the direction of the sign, and equal pairs say so', () => {
    const t = TOPICS.find(x => x.id === 'y2-compare')!;
    const seen = new Set<string>();
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      const [a, b] = q.prompt.split(' ? ').map(Number);
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      expect(q.answer).toBe(a < b ? '<' : a > b ? '>' : '=');
      if (a === b) { expect(w).toBe(`${a} and ${b} are the same number.`); seen.add('eq'); continue; }
      let m: RegExpExecArray | null;
      if ((m = /^(\d+) tens? is (more|fewer) than (\d+) tens?\.$/.exec(w))) {
        expect(Math.floor(a / 10)).toBe(Number(m[1])); expect(Math.floor(b / 10)).toBe(Number(m[3]));
        expect(m[2] === 'more').toBe(a > b); seen.add('tens');
      } else if ((m = /^(\d+) has no tens, but (\d+) does\.$/.exec(w))) {
        expect(Math.min(a, b)).toBe(Number(m[1])); expect(Math.min(a, b)).toBeLessThan(10); expect(Math.max(a, b)).toBe(Number(m[2])); seen.add('none');
      } else if ((m = /^(Same tens, and|Single digits:) (\d) is (more|less) than (\d)\.$/.exec(w))) {
        expect(Math.floor(a / 10)).toBe(Math.floor(b / 10));
        expect(Number(m[2])).toBe(a % 10); expect(Number(m[4])).toBe(b % 10); expect(m[3] === 'more').toBe(a > b); seen.add('ones');
      } else throw new Error(`unexpected why: ${w}`);
    }
    expect([...seen].sort()).toEqual(['eq', 'none', 'ones', 'tens']);
  });
});
