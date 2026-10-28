// #2317 (order of operations): each why does the step that comes first, then rewrites the sum with it done, ending on the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y6-order-ops')!.gen(d, rngOf((s + 1) * 104729 + d)));
const num = (s: string) => Number(s.replace(/,/g, ''));
/** Evaluates a plain sum such as `4 + 3 × (7 − 2)` with ordinary precedence. */
const calc = (s: string): number => new Function(`return ${s.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')}`)();

describe('y6-order-ops whys (#2317)', () => {
  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: the first step is true, the second uses its result and lands on the answer`, () => {
      for (const q of draws(d)) {
        const m = /^(.+) = (-?[\d,]+), so (.+) = ([\d,]+)$/.exec(q.why ?? '');
        expect(m, `${q.prompt} → ${q.why}`).not.toBeNull();
        const [, step, mid, rest, end] = m!;
        expect(end, q.why).toBe(q.answer);
        expect(calc(step), q.why).toBe(num(mid));
        expect(calc(rest), q.why).toBe(num(q.answer));
        expect(rest.replace(/,/g, '').split(/[^\d]+/).includes(String(num(mid))), `${q.why} uses the first result`).toBe(true);
      }
    });
    it(`d${d}: the first step is taken from the prompt's own numbers`, () => {
      for (const q of draws(d)) {
        const nums = (q.prompt.match(/\d+/g) ?? []);
        const used = (q.why!.split(', so ')[0].split(' = ')[0].match(/\d+/g) ?? []);
        for (const n of used) expect(nums, `${q.prompt} → ${q.why}`).toContain(n);
      }
    });
  }
});
