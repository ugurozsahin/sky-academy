// #2317 (y4-hundredths family): each why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y4-hundredths')!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('y4-hundredths whys (#2317)', () => {
  it('line and count whys do one real 0.01 step and land on the answer', () => {
    let seen = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      const m = /^([\d.]+) ([+−]) 0\.01 = ([\d.]+)$/.exec(q.why!);
      if (!m) continue;
      seen++;
      expect(Number(m[1]) + (m[2] === '+' ? 0.01 : -0.01), q.why).toBeCloseTo(Number(m[3]), 6);
      expect(m[3], q.why).toBe(q.answer);
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('÷ 10 and how-many whys use the asked tenths', () => {
    const seen = { div: 0, many: 0 };
    for (const q of draws(3)) {
      const d = /^(\d) tenths? ÷ 10 = (\d) hundredths?, which is ([\d.]+)$/.exec(q.why!);
      if (d) { seen.div++; expect(q.prompt, q.why).toBe(`0.${d[1]} ÷ 10 = ?`); expect(d[2]).toBe(d[1]); expect(d[3]).toBe(q.answer); expect(q.why).toMatch(d[1] === '1' ? /1 tenth ÷ 10 = 1 hundredth,/ : /tenths ÷ 10 = \d hundredths,/); continue; }
      const m = /^1 tenth is 10 hundredths, so (\d) × 10 = (\d+)$/.exec(q.why!);
      if (m) { seen.many++; expect(q.prompt, q.why).toBe(`How many hundredths make 0.${m[1]}?`); expect(m[2]).toBe(q.answer); }
    }
    expect(seen.div).toBeGreaterThan(0);
    expect(seen.many).toBeGreaterThan(0);
  });
  it('every question at every level has a why', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) expect(q.why, q.prompt).toBeTruthy();
  });
});
