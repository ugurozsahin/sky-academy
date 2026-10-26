// #2317 (fractions of amounts family): each y3-fracof and y4-fracof why states true working for its own card.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === id)!.gen(d, rngOf((s + 1) * 104729 + d)));
const int = (s: string) => +s.replace(/,/g, '');

describe('y3-fracof whys (#2317)', () => {
  it('divide by the bottom, then multiply by the top', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws('y3-fracof', d)) {
      const f = /^(\d+)\/(\d+) of (\d+) = \?$/.exec(q.prompt);
      if (f) {
        const [n, den, whole] = [+f[1], +f[2], +f[3]], k = whole / den;
        expect(q.why, q.prompt).toBe(n === 1 ? `${whole} ÷ ${den} = ${k}` : `${whole} ÷ ${den} = ${k}, ${k} × ${n} = ${k * n}`);
      } else {
        const r = /^1\/(\d+) of a number is (\d+)\./.exec(q.prompt)!;
        expect(q.why, q.prompt).toBe(`${r[2]} × ${r[1]} = ${q.answer}`);
      }
    }
  });
});

describe('y4-fracof whys (#2317)', () => {
  it('plain cards divide then multiply; "left" stories subtract the used part', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws('y4-fracof', d)) {
      const plain = /^(\d+)\/(\d+) of ([\d,]+) = \?$/.exec(q.prompt);
      if (plain) {
        const [n, den, whole] = [+plain[1], +plain[2], int(plain[3])], k = whole / den;
        expect(int(q.why!.split(' ÷ ')[0]), q.why).toBe(whole);
        expect(q.why, q.prompt).toContain(`÷ ${den} = `);
        if (n > 1) expect(q.why!.endsWith(`= ${q.answer}`), q.why).toBe(true);
        else expect(k, q.why).toBe(int(q.answer));
      } else {
        const m = /(\d+)\/(\d+)/.exec(q.prompt)!, w = /([\d,]+) (?:cm|litres|m|ml|kg)/.exec(q.prompt)![1];
        const part = +m[1] * (int(w) / +m[2]);
        if (/left\?$/.test(q.prompt)) expect(q.why, q.prompt).toBe(`${m[0]} is ${part}; ${w} − ${part} = ${q.answer.split(' ')[0]}`);
        else expect(q.why!.endsWith(`= ${q.answer.split(' ')[0]}`), q.why).toBe(true);
      }
    }
  });
});
