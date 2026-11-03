// #2317 (y2-oddeven): each why names the ones digit and the parity it decides, true for the card shown.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

describe('y2-oddeven whys (#2317)', () => {
  it('a digit why is true of the answer; the any-order rule matches the word asked', () => {
    const t = TOPICS.find(x => x.id === 'y2-oddeven')!;
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      if (q.anyOrder) {
        const even = /even/.test(q.prompt);
        expect(w).toBe(`${even ? 'Evens' : 'Odds'} end in ${even ? '0, 2, 4, 6, 8' : '1, 3, 5, 7, 9'}.`);
      } else {
        const m = /^(\d+) ends in (\d), so it is (odd|even)\.$/.exec(w)!;
        expect(m, w).not.toBeNull();
        const n = Number(m[1]);
        expect(n % 10).toBe(Number(m[2]));
        expect(n % 2 ? 'odd' : 'even').toBe(m[3]);
        if (/^Is /.test(q.prompt)) { expect(q.prompt).toContain(` ${n} `); expect(q.answer).toBe(m[3]); }
        else expect(q.answer).toBe(String(n));
      }
    }
  });
});
