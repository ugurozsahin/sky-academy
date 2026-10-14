import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/** Oracle for #1016: the sum is re-solved from the prompt, never read from the generator's own answer. */
describe('y2-add / y2-sub d3 "build the answer" cards (#1016)', () => {
  const solve = (p: string) => {
    const m = /^(\d+) ([+−]) (\d+) = \?$/.exec(p)!;
    return m[2] === '+' ? +m[1] + +m[3] : +m[1] - +m[3];
  };
  it.each(['y2-add', 'y2-sub'])('%s: build cards slice the digits in order, five bubbles each, at d3 only', (id) => {
    const t = TOPICS.find(x => x.id === id)!;
    expect(t.sequenceFrom).toBe(3);
    const r = rng(1016);
    let built = 0, plain = 0;
    for (let i = 0; i < 400; i++) {
      for (const d of [1, 2] as const) expect(t.gen(d, r).sequence, `${id} d${d}`).toBeUndefined();
      const q = t.gen(3, r);
      if (!q.sequence) { plain++; continue; }
      built++;
      const ans = String(solve(q.prompt));
      expect(q.sequence.join('')).toBe(ans);
      expect(q.answer).toBe(ans);
      expect(q.slow).toBe(true);
      const launched = q.sequence.length + q.options.filter(o => !q.sequence!.includes(o)).length;
      expect(launched, q.prompt).toBe(5);
      for (const o of q.options) if (!q.sequence.includes(o)) expect(ans.includes(o)).toBe(false);
    }
    expect(built).toBeGreaterThan(100);
    expect(plain).toBeGreaterThan(100);
  });
});
