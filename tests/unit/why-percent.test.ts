// #2317 (per cent family: y5-percent): each why is true arithmetic about its own card and ends on the card's answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y5-percent')!.gen(d, rngOf((s + 1) * 104729 + d)));

describe('y5-percent whys (#2317)', () => {
  const seen = new Set<string>();
  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: every why ends on the answer and its numbers are true`, () => {
      for (const q of draws(d)) {
        const w = q.why!;
        expect(w, q.prompt).toBeTruthy();
        expect(w.endsWith(q.answer) || w.endsWith(`/100`), `${w} should end on ${q.answer}`).toBe(true);
        let m: RegExpExecArray | null;
        if ((m = /^(\d+) squares out of 100 are shaded: (\d+)\/100 = (\d+)%$/.exec(w))) {
          expect([m[1], m[2], `${m[3]}%`], w).toEqual([m[1], m[1], q.answer]);
          seen.add('squares');
        } else if ((m = /^Per cent means out of 100, so (\d+)% = (\d+)\/100$/.exec(w))) {
          expect(m[1], w).toBe(m[2]); expect(m[2], w).toBe(q.answer); seen.add('over100');
        } else if ((m = /^(\d+)% = (\d+) ÷ 100 = (.+)$/.exec(w))) {
          expect(m[1], w).toBe(m[2]); expect(Number(m[3]) * 100, w).toBeCloseTo(Number(m[1]), 6); expect(m[3], w).toBe(q.answer); seen.add('asDecimal');
        } else if ((m = /^([\d.]+) × 100 = (\d+)%$/.exec(w))) {
          expect(Math.round(Number(m[1]) * 100), w).toBe(Number(m[2])); expect(`${m[2]}%`, w).toBe(q.answer); seen.add('decToPc');
        } else if ((m = /^(\d+)\/(\d+) = (\d+)\/100 \(× (\d+) on top and bottom\) = (.+)$/.exec(w))) {
          const [n, dn, p, k] = m.slice(1, 5).map(Number);
          expect(dn * k, w).toBe(100); expect(n * k, w).toBe(p); expect(m[5], w).toBe(q.answer);
          expect(q.prompt.startsWith(`${n}/${dn} = `), w).toBe(true); seen.add('fraction');
        } else throw new Error(`unrecognised why: ${w}`);
      }
    });
  }
  it('every branch of the working is drawn', () => {
    expect([...seen].sort()).toEqual(['asDecimal', 'decToPc', 'fraction', 'over100', 'squares']);
  });
});
