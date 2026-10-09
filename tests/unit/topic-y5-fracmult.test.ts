import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { equal, parseFrac } from '../../src/curriculum/fractions';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-fracmult')!;
const draw = (d: Difficulty, n = 2000) => { const r = rng(1198 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const fr = (s: string) => parseFrac(s)!;

/** The answer re-derived from the prompt alone: k × (a/b or w a/b). */
function oracle(q: Question) {
  const m = q.prompt.match(/^(\d+) × (?:(\d+) )?(\d+)\/(\d+) = \?/)!;
  const [k, w, n, d] = [+m[1], +(m[2] ?? 0), +m[3], +m[4]];
  return { value: { n: k * (w * d + n), d }, k, d, unit: n === 1 && !m[2] };
}

describe('y5-fracmult (#1198)', () => {
  it('is registered for Year 5 maths in the fractions strand', () => { expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.strand).toBe('fractions'); });

  it('the oracle holds and exactly one option has the answer\'s value, over 2,000 draws per difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.options).toContain(q.answer); expect(new Set(q.options).size).toBe(4);
      const { value } = oracle(q);
      expect(equal(fr(q.answer), value), q.prompt).toBe(true);
      expect(q.options.filter(o => equal(fr(o), value)), q.prompt).toEqual([q.answer]);
    }
  });

  it('d1 shows the unit fraction only, and the product stays under 1', () => {
    for (const q of draw(1)) {
      const v = q.visual, o = oracle(q);
      expect(v?.type).toBe('fraction');
      if (v?.type !== 'fraction') continue;
      expect(v.shaded).toBe(1); expect(v.parts).toBe(o.d); expect(o.unit).toBe(true);
      expect(o.value.n).toBeLessThan(o.value.d);
    }
  });

  it('d2 and d3 answers are mixed numbers over 1', () => {
    for (const d of [2, 3] as Difficulty[]) for (const q of draw(d)) { expect(q.answer).toMatch(/^\d+ \d+\/\d+$/); expect(q.visual).toBeUndefined(); }
  });

  it('d3 is mostly mixed numbers times a whole', () => {
    expect(draw(3).filter(q => /× \d+ \d+\/\d+ =/.test(q.prompt)).length).toBeGreaterThan(1000);
  });

  it('the multiply-the-bottom-too slip is offered whenever it differs from the answer', () => {
    for (const q of draw(1, 600)) { const { k, d } = oracle(q); expect(q.options, q.prompt).toContain(`${k}/${d * k}`); }
  });

  it('say never carries a raw fraction, a multiplication sign or a question mark', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 600)) { expect(q.say ?? '').not.toMatch(/\d\/\d|×|=|\?\//); expect(q.say).toBeTruthy(); }
  });
});
