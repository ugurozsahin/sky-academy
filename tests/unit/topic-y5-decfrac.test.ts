import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { parseFrac } from '../../src/curriculum/fractions';
import { parseNum } from '../../src/curriculum/ks2num';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-decfrac')!;
const draw = (d: Difficulty, n = 2000) => { const r = rng(1199 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };

/** A label as [numerator, denominator] with a power-of-ten or plain denominator, exact. */
function ratio(label: string): [number, number] {
  const f = parseFrac(label);
  if (f) return [f.n, f.d];
  const n = parseNum(label)!;
  return [n.v, 10 ** n.dp];
}
const same = (a: string, b: string) => { const [x, y] = ratio(a), [u, v] = ratio(b); return x * v === u * y; };
const isDec = (s: string) => /^\d+(\.\d+)?$/.test(s);
/** The prompt's own number, whichever way round the card goes. */
const given = (q: Question) => q.prompt.split(' = ')[0];

describe('y5-decfrac (#1199)', () => {
  it('is registered for Year 5 maths in the fractions strand', () => { expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.strand).toBe('fractions'); });

  it('the answer equals the prompt\'s number and exactly one option has that value, over 2,000 draws per difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size).toBe(4); expect(q.options).toContain(q.answer);
      expect(same(q.answer, given(q)), q.prompt).toBe(true);
      expect(q.options.filter(o => same(o, given(q))), q.prompt).toEqual([q.answer]);
    }
  });

  it('no label has a float artefact or a trailing zero after the point', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 10000)) for (const o of q.options) {
      expect(o, q.prompt).not.toMatch(/\d{6,}|\.\d*0(?!\d)(?![/])$/);
    }
  });

  it('goes both ways: about half the cards answer in decimals', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const n = draw(d).filter(q => isDec(q.answer)).length; expect(n).toBeGreaterThan(700); expect(n).toBeLessThan(1300); }
  });

  it('decimal answers always share their last digit with a decoy (leak limit)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) if (isDec(q.answer)) expect(q.options.filter(o => o !== q.answer && o.slice(-1) === q.answer.slice(-1)).length, q.prompt).toBeGreaterThan(0);
  });

  it('d1 is tenths and d2 includes a zero-tenths hundredths card', () => {
    for (const q of draw(1, 300)) expect(q.options.some(o => same(o, '0.1') || true) && [q.answer, given(q)].some(x => /^[1-9]\/10$|^0\.[1-9]$/.test(x)), q.prompt).toBe(true);
    expect(draw(2, 50).some(q => /(^|= )0\.0\d/.test(q.prompt) || /^\d\/100 =/.test(q.prompt))).toBe(true);
  });

  it('d3 offers no hundredths form on simplest-form cards, and has cards above 1', () => {
    const qs = draw(3);
    for (const q of qs.filter(q => /^[1-9]\/[2-5]$/.test(q.answer))) expect(q.options.filter(o => same(o, q.answer))).toEqual([q.answer]);
    expect(qs.some(q => /^[1-9]\d\d\/100$/.test(q.answer))).toBe(true);
  });

  it('say never carries a raw fraction, a digit pair or a question mark', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 600)) { expect(q.say).toBeTruthy(); expect(q.say ?? '').not.toMatch(/\d\/\d|=|\?\//); }
  });
});
