// #2317 (unit conversion): each why states a true fact about its own question and ends in the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string) => ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === id)!.gen(d, rngOf((s + 1) * 104729 + d))));
const n = (s: string) => Number(s.replace(/,/g, ''));

describe.each(['y5-convert', 'y6-convert'])('%s whys (#2317)', id => {
  const qs = draws(id);
  it('every why ends in the card answer', () => {
    for (const q of qs) expect(q.why!.split(/[=:]/).pop()!.trim().replace(/,/g, ''), q.why).toBe(q.answer.replace(/,/g, ''));
  });
  it('a scale why multiplies or divides by the stated factor to reach the answer', () => {
    const scale = qs.filter(q => /^1 \S+ = [\d,]+ \S+: /.test(q.why!));
    expect(scale.length).toBeGreaterThan(100);
    for (const q of scale) {
      const m = /^1 \S+ = ([\d,]+) \S+: ([\d.,]+) ([×÷]) ([\d,]+) = ([\d.,]+)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      const [f, a, f2, r] = [n(m[1]), n(m[2]), n(m[4]), n(m[5])];
      expect(f2, q.why).toBe(f);
      expect(m[3] === '×' ? a * f : a / f, q.why).toBeCloseTo(r, 9);
    }
  });
  it('a multi-step why has true arithmetic in every step', () => {
    for (const q of qs.filter(x => !/^1 \S+ = [\d,]+ \S+: /.test(x.why!))) {
      for (const step of q.why!.split(';')) {
        const m = /(?:^|=\s)?([\d.,]+) ([×÷+−]) ([\d.,]+) = ([\d.,]+)$/.exec(step.trim());
        if (!m) continue;
        const [a, b, r] = [n(m[1]), n(m[3]), n(m[4])];
        const v = m[2] === '×' ? a * b : m[2] === '÷' ? a / b : m[2] === '+' ? a + b : a - b;
        expect(v, q.why).toBeCloseTo(r, 9);
      }
    }
  });
});
