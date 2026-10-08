import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { equal, parseFrac } from '../../src/curriculum/fractions';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-fracequiv')!;
const draw = (d: Difficulty, n = 2000) => { const r = rng(1195 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const fr = (s: string) => parseFrac(s)!;

type Shape = 'bar' | 'missing' | 'odd';
function shape(q: Question): Shape { return q.visual?.type === 'fraction' ? 'bar' : q.prompt.startsWith('Which fraction is not') ? 'odd' : 'missing'; }

/** The answer re-derived from the prompt alone. */
function oracle(q: Question): string {
  let m: RegExpMatchArray | null;
  if ((m = q.prompt.match(/^(\d+) of (\d+) parts are shaded/))) { const g = (a: number, b: number): number => (b ? g(b, a % b) : a), d = g(+m[1], +m[2]); return `${+m[1] / d}/${+m[2] / d}`; }
  if ((m = q.prompt.match(/^(\d+)\/(\d+) = \?\/(\d+)$/))) return String(+m[1] * (+m[3] / +m[2]));
  throw new Error(`no oracle for ${q.prompt}`);
}

describe('y5-fracequiv (#1195)', () => {
  it('is registered for Year 5 maths in the fractions strand', () => { expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.strand).toBe('fractions'); });

  it('the oracle holds, and exactly one option is right by value, over 2,000 draws per difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.options).toContain(q.answer); expect(new Set(q.options).size).toBe(4);
      if (shape(q) === 'odd') {
        const base = fr(q.prompt.match(/not equal to (\d+\/\d+)\?/)![1]);
        const odd = q.options.filter(o => !equal(fr(o), base));
        expect(odd).toEqual([q.answer]);
      } else {
        expect(q.answer).toBe(oracle(q));
        if (shape(q) === 'bar') {
          const sh = fr(q.prompt.match(/^(\d+ of \d+)/)![1].replace(' of ', '/'));
          expect(q.options.filter(o => equal(fr(o), sh))).toEqual([q.answer]);
        }
      }
    }
  });

  it('d1 is always a bar of at most 12 parts that simplifies', () => {
    for (const q of draw(1)) {
      const v = q.visual; expect(v?.type).toBe('fraction');
      if (v?.type !== 'fraction') continue;
      expect(v.shape).toBe('bar'); expect(v.parts).toBeLessThanOrEqual(12); expect(v.parts).toBeGreaterThanOrEqual(4);
      expect(q.prompt).toContain(`${v.shaded} of ${v.parts} parts`);
      expect(q.answer).not.toBe(`${v.shaded}/${v.parts}`);
    }
  });

  it('every missing-number card with room offers the add-the-same slip', () => {
    let cards = 0;
    for (const d of [2, 3] as Difficulty[]) for (const q of draw(d)) {
      const m = q.prompt.match(/^(\d+)\/(\d+) = \?\/(\d+)$/); if (!m) continue;
      const [n, b, to] = [+m[1], +m[2], +m[3]], slip = n + (to - b);
      if (to < b) continue;
      cards++;
      if (slip !== +q.answer && slip <= 100 && slip >= 1) expect(q.options, q.prompt).toContain(String(slip));
    }
    expect(cards).toBeGreaterThan(1000);
  });

  it('d3 offers tenths and hundredths both ways, and the odd-one-out card', () => {
    const seen = new Set<string>();
    for (const q of draw(3)) { if (/\/100 = \?\/10$/.test(q.prompt)) seen.add('to-tenths'); else if (/\/10 = \?\/100$/.test(q.prompt)) seen.add('to-hundredths'); else if (shape(q) === 'odd') seen.add('odd'); }
    expect([...seen].sort()).toEqual(['odd', 'to-hundredths', 'to-tenths']);
  });

  it('say never carries a raw fraction or a question mark', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 600)) { expect(q.say ?? '').not.toMatch(/\d\/\d|\?\/|=/); expect(q.say).toBeTruthy(); }
  });

  it('leak limit on the whole-number answers: at most 30% have a last digit no decoy shares', () => {
    for (const d of [2, 3] as Difficulty[]) {
      const gen = (lvl: Difficulty, r: () => number) => { let q: Question; do q = topic.gen(lvl, r); while (q.answer.includes('/')); return q; };
      expect(leakShares(gen, d, 2000, { skipLeading: true }).units).toBeLessThanOrEqual(0.3);
    }
  });
});
