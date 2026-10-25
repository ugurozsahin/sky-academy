// #2317 (place value family): the why lines state the true fact behind each answer, not just any short line.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = (id: string) => TOPICS.find(t => t.id === id)!.gen;
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, s) => gen(id)(d, rngOf((s + 1) * 104729 + d)));

describe('place value whys (#2317)', () => {
  it('y2-pv: tens and ones are the number\'s own digits', () => {
    for (const q of [1, 2, 3].flatMap(d => draws('y2-pv', d as Difficulty))) {
      const m = /^(\d+) is (\d+) tens? and (\d+) ones?$/.exec(q.why!);
      if (m) expect(Number(m[2]) * 10 + Number(m[3])).toBe(Number(m[1]));
      else expect(q.why).toMatch(/^(\d+) \+ (\d+) = (\d+)$/);
    }
  });
  it('y3-pv: every sum in a why is true', () => {
    for (const q of [1, 2, 3].flatMap(d => draws('y3-pv', d as Difficulty))) {
      const m = /(\d[\d + ]*) = (\d[\d + ]*)/.exec(q.why!);
      if (!m) { expect(q.why).toContain(' column: '); continue; }
      const sum = (s: string) => s.split(' + ').reduce((a, b) => a + Number(b), 0);
      expect(sum(m[1]), q.why).toBe(sum(m[2]));
    }
  });
  it('y4-pv: the digit named in a why is worth the answer', () => {
    for (const q of draws('y4-pv', 1)) expect(q.why).toContain(`worth ${q.answer}`);
  });
  it('y6-pv d1: the column named matches the answer\'s zeros', () => {
    const names: Record<string, number> = { tens: 1, hundreds: 2, thousands: 3, 'ten thousands': 4, 'hundred thousands': 5, millions: 6 };
    for (const q of draws('y6-pv', 1)) {
      const col = /in the (.+) place/.exec(q.why!)![1];
      expect(q.answer.replace(/,/g, '').length - 1, q.why).toBe(names[col]);
    }
  });
});
