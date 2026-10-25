// #2317 (fraction multiplication family): each y5-fracmult and y6-fracmult why states true working for its own card.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === id)!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('y5-fracmult whys (#2317)', () => {
  it('d1 multiplies the top and keeps the bottom', () => {
    for (const q of draws('y5-fracmult', 1)) {
      const [k, b] = [/^(\d+) ×/.exec(q.prompt)![1], /1\/(\d+) =/.exec(q.prompt)![1]];
      expect(q.why, q.prompt).toBe(`${k} × 1 = ${k} on top; the bottom stays ${b}`);
    }
  });
  it('d2 and d3 show the product on top and end on the answer', () => {
    for (const q of [...draws('y5-fracmult', 2), ...draws('y5-fracmult', 3)]) {
      const m = /^(\d+) × (?:(\d+) )?(\d+)\/(\d+) =/.exec(q.prompt)!, k = +m[1], b = +m[4];
      const improper = (m[2] ? +m[2] * b : 0) + +m[3], top = k * improper;
      expect(q.why, q.prompt).toContain(`${k} × ${m[2] ? improper : +m[3]} = ${top}`);
      expect(q.why!.endsWith(q.answer), q.why).toBe(true);
    }
  });
});

describe('y6-fracmult whys (#2317)', () => {
  it('multiply the tops and the bottoms, then name the simplified answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws('y6-fracmult', d)) {
      const f = [...q.prompt.matchAll(/(\d+)\/(\d+)/g)].map(m => [+m[1], +m[2]]);
      expect(f.length, q.prompt).toBe(2);
      const [n, dn] = [f[0][0] * f[1][0], f[0][1] * f[1][1]], g = gcd(n, dn);
      expect(q.why, q.prompt).toBe(`Tops ${f[0][0]}×${f[1][0]}=${n}, bottoms ${f[0][1]}×${f[1][1]}=${dn}, so ${g > 1 ? `${n}/${dn} = ` : ''}${q.answer}`);
    }
  });
  it('shows the simplifying step on some cards and omits it on others', () => {
    const whys = [2, 3].flatMap(d => draws('y6-fracmult', d as Difficulty)).map(q => q.why!);
    expect(whys.some(w => w.includes(' = ')), 'a simplifying card').toBe(true);
    expect(whys.some(w => !w.includes('/') || !/so \d+\/\d+ = /.test(w)), 'a non-simplifying card').toBe(true);
  });
});
