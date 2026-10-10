import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { wordsFor } from '../../src/curriculum/ks2num';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-pv')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1252 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/,/g, ''));

// An independent words-to-number parser (not wordsFor run backwards): sums the groups.
const SMALL: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
function parseWords(w: string): number {
  let total = 0, group = 0;
  for (const tok of w.replace(/,/g, '').split(/[\s-]+/)) {
    if (tok === 'and') continue;
    if (tok === 'hundred') group *= 100;
    else if (tok === 'thousand') { total += group * 1000; group = 0; }
    else if (tok === 'million') { total += group * 1000000; group = 0; }
    else group += SMALL[tok];
  }
  return total + group;
}

describe('wordsFor to 10,000,000 (#1252)', () => {
  const table: [number, string][] = [
    [7, 'seven'], [403050, 'four hundred and three thousand and fifty'], [1000000, 'one million'], [2000007, 'two million and seven'],
    [2040007, 'two million, forty thousand and seven'], [2400000, 'two million, four hundred thousand'], [3500100, 'three million, five hundred thousand one hundred'],
    [9999999, 'nine million, nine hundred and ninety-nine thousand nine hundred and ninety-nine'], [10000000, 'ten million'],
    [5060000, 'five million, sixty thousand'], [1000100, 'one million, one hundred'],
  ];
  it.each(table)('%i reads %s', (n, words) => { expect(wordsFor(n)).toBe(words); });
  it('refuses a number outside 1 to 10,000,000', () => { expect(() => wordsFor(0)).toThrow(); expect(() => wordsFor(10000001)).toThrow(); });
  it('the independent parser reads back every sampled value', () => {
    const r = rng(7);
    for (let i = 0; i < 3000; i++) { const n = 1 + Math.floor(r() * 10000000); expect(parseWords(wordsFor(n))).toBe(n); }
  });
});

describe('y6-pv (#1252)', () => {
  it('is a Year 6 maths topic, first in the number strand', () => {
    expect(topic.year).toBe('year6'); expect(topic.subject).toBe('maths');
    expect(TOPICS.filter(t => t.year === 'year6' && t.strand === 'number')[0].id).toBe('y6-pv');
  });

  it('every card has four distinct comma-grouped options and the answer among them', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 300)) {
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4); expect(q.options).toContain(q.answer);
      q.options.forEach(o => expect(o).toMatch(/^\d{1,3}(,\d{3})*$/));
    }
  });

  it('d1: the value is digit × 10^place, from a seven-digit number, the digit once and not in the units', () => {
    for (const q of draw(1, 400)) {
      const [, c, label] = q.prompt.match(/value of the (\d) in ([\d,]+)\?/)!, s = String(num(label));
      expect(s).toHaveLength(7);
      expect(s.split(c).length - 1).toBe(1);
      const k = 6 - s.indexOf(c);
      expect(k).toBeGreaterThan(0);
      expect(num(q.answer)).toBe(Number(c) * 10 ** k);
      q.options.forEach(o => { expect(num(o)).toBeGreaterThanOrEqual(1); expect(num(o)).toBeLessThanOrEqual(9000000); });
    }
  });

  it('d1 decoys are the neighbouring places and the face value (millions: shifted the other way)', () => {
    for (const q of draw(1, 400)) {
      const [, c, label] = q.prompt.match(/value of the (\d) in ([\d,]+)\?/)!, k = 6 - String(num(label)).indexOf(c), digit = Number(c);
      const got = q.options.map(num).filter(v => v !== num(q.answer)).sort((a, b) => a - b);
      const want = [k + 1, k - 1, 0, k + 2, k - 2, k + 3, k - 3].filter(j => j >= 0 && j <= 6).map(j => digit * 10 ** j).filter((v, i, a) => v !== num(q.answer) && a.indexOf(v) === i).slice(0, 3).sort((a, b) => a - b);
      expect(got).toEqual(want);
    }
  });

  it('d2: the words parse to the answer, with at most three non-zero digit groups', () => {
    for (const q of draw(2, 400)) {
      const words = q.prompt.replace(/^In digits: /, '');
      expect(parseWords(words)).toBe(num(q.answer));
      expect(num(q.answer)).toBeGreaterThanOrEqual(1000000); expect(num(q.answer)).toBeLessThanOrEqual(9999999);
      expect(q.answer.replace(/[0,]/g, '').length).toBeLessThanOrEqual(3);
      expect(q.prompt.length).toBeLessThanOrEqual(70);
      expect(q.say).toBe(q.prompt);
    }
  });

  it('d2 shows the zero slips: one decoy drops a zero and one adds a zero', () => {
    for (const q of draw(2, 300)) {
      const a = q.answer.replace(/,/g, ''), ds = q.options.filter(o => o !== q.answer).map(o => o.replace(/,/g, ''));
      expect(ds.some(o => o.length === a.length - 1) || !a.slice(1).includes('0')).toBe(true);
      expect(ds.some(o => o.length === a.length + 1)).toBe(true);
    }
  });

  it('d3: the answer is the true greatest or smallest, the numbers share a leading and last digit, and the bubbles are the question', () => {
    const seen = new Set<string>();
    for (const q of draw(3, 400)) {
      const vals = q.options.map(num); seen.add(q.prompt);
      expect(num(q.answer)).toBe(q.prompt.includes('greatest') ? Math.max(...vals) : Math.min(...vals));
      vals.forEach(v => { expect(v).toBeGreaterThanOrEqual(1000000); expect(v).toBeLessThanOrEqual(9999999); });
      expect(new Set(q.options.map(o => o[0])).size).toBe(1);
      expect(new Set(q.options.map(o => o[o.length - 1])).size).toBe(1);
      expect(q.optionsAreContent).toBe(true);
    }
    expect([...seen].sort()).toEqual(['Which is the greatest?', 'Which is the smallest?']);
  });

  it('every label with seven or more digits is drawn wide', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 300)) {
      expect(q.options.length).toBeLessThanOrEqual(6);
      if (q.options.some(o => o.replace(/,/g, '').length >= 7)) expect(q.wide).toBe(true);
    }
  });

  it('leak limit: at most 30% of cards have a leading or last digit no decoy shares', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      expect(s.counted).toBeGreaterThan(1900);
      expect(s.leading).toBeLessThanOrEqual(0.3); expect(s.units).toBeLessThanOrEqual(0.3);
    }
  });
});
