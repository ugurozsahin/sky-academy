import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { wordsFor } from '../../src/curriculum/ks2num';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-pv')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1179 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/,/g, ''));

let wordsIndex: Map<string, number> | undefined;
/** Every number the word cards can show (at most three non-zero digits), keyed by its words. */
function fromWords(): Map<string, number> {
  if (!wordsIndex) {
    wordsIndex = new Map();
    for (let n = 10000; n < 1000000; n++) if (String(n).replace(/0/g, '').length <= 3) wordsIndex.set(wordsFor(n), n);
  }
  return wordsIndex;
}

/** The answer worked out from the card's own text, independent of the generator. */
function oracle(prompt: string, options: string[]): number {
  let m = prompt.match(/^What is the value of the (\d) in ([\d,]+)\?$/);
  if (m) { const s = String(num(m[2])); return Number(m[1]) * 10 ** (s.length - 1 - s.indexOf(m[1])); }
  m = prompt.match(/^What is ([\d,]+) (more|less) than ([\d,]+)\?$/);
  if (m) return num(m[3]) + (m[2] === 'more' ? 1 : -1) * num(m[1]);
  m = prompt.match(/^In digits: (.+)$/);
  if (m) { const n = fromWords().get(m[1]); if (n === undefined) throw new Error(`no number for "${m[1]}"`); return n; }
  const vals = options.map(num);
  if (prompt === 'Which number is the second largest?') return [...vals].sort((a, b) => b - a)[1];
  if (prompt === 'Which number is greater than 999,990?') return vals.filter(v => v > 999990)[0];
  throw new Error(`unknown prompt ${prompt}`);
}

describe('wordsFor (#1179)', () => {
  const table: [number, string][] = [
    [1, 'one'], [20, 'twenty'], [45, 'forty-five'], [100, 'one hundred'], [101, 'one hundred and one'], [1000, 'one thousand'],
    [2100, 'two thousand one hundred'], [12050, 'twelve thousand and fifty'], [403050, 'four hundred and three thousand and fifty'],
    [340000, 'three hundred and forty thousand'], [999999, 'nine hundred and ninety-nine thousand nine hundred and ninety-nine'], [1000000, 'one million'],
  ];
  it.each(table)('%i reads %s', (n, words) => { expect(wordsFor(n)).toBe(words); });
  it('refuses a number outside 1 to 1,000,000', () => { expect(() => wordsFor(0)).toThrow(); expect(() => wordsFor(1000001)).toThrow(); });
});

describe('y5-pv (#1179)', () => {
  it('is a Year 5 maths topic', () => { expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); });

  it('the oracle holds on every card, with 4 distinct options and commas from four digits', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 2000)) {
      expect(num(q.answer)).toBe(oracle(q.prompt, q.options));
      expect(q.options).toContain(q.answer);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4);
      q.options.forEach(o => { expect(o).toMatch(/^\d{1,3}(,\d{3})*$/); expect(o.length).toBeLessThanOrEqual('1,000,000'.length); expect(num(o)).toBeLessThanOrEqual(1000000); });
    }
  });

  it('the ladder: d1 five-digit numbers, d2 six-digit numbers and words, d3 rank and compare', () => {
    for (const q of draw(1, 300)) { const big = q.prompt.match(/[\d,]{6,}/g)!.map(num); big.forEach(v => expect(v).toBeLessThanOrEqual(99999)); }
    const kinds = new Set(draw(2, 300).map(q => q.prompt.split(' ').slice(0, 2).join(' ')));
    expect([...kinds].sort()).toEqual(['In digits:', 'What is']);
    const d3 = new Set(draw(3, 300).map(q => q.prompt));
    expect([...d3].sort()).toEqual(['Which number is greater than 999,990?', 'Which number is the second largest?']);
    expect(draw(3, 600).some(q => q.answer === '1,000,000')).toBe(true);
  });

  it('a word card keeps its text within 48 characters and the digit value names a digit that appears once', () => {
    for (const q of draw(2, 600)) if (q.prompt.startsWith('In digits: ')) expect(q.prompt.slice('In digits: '.length).length).toBeLessThanOrEqual(48);
    for (const q of [...draw(1, 600), ...draw(2, 600)]) {
      const m = q.prompt.match(/the (\d) in ([\d,]+)\?/);
      if (m) expect(m[2].split(m[1]).length - 1).toBe(1);
    }
  });

  it('digit-value decoys are the same digit at other places; count decoys include the wrong direction', () => {
    for (const q of draw(2, 600)) {
      const m = q.prompt.match(/the (\d) in /);
      if (m) q.options.forEach(o => expect(o.replace(/[,0]/g, '')).toBe(m[1]));
      const c = q.prompt.match(/^What is ([\d,]+) (more|less) than ([\d,]+)\?$/);
      const wrong = c ? num(c[3]) + (c[2] === 'more' ? -1 : 1) * num(c[1]) : 0;
      if (c && wrong >= 0 && wrong <= 1000000) expect(q.options).toContain(fmtNum(wrong));
    }
  });

  it('every d3 rank card shows four distinct numbers sharing their first two digits, with exactly one second largest', () => {
    for (const q of draw(3, 800)) if (q.prompt.includes('second largest')) {
      const vals = q.options.map(num);
      expect(new Set(vals.map(v => String(v).slice(0, 2))).size).toBe(1);
      expect(vals.filter(v => v === num(q.answer))).toHaveLength(1);
      expect(vals.filter(v => v > num(q.answer))).toHaveLength(1);
    }
  });

  it('leak limit: at most 30% of cards have a leading or last digit no decoy shares', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      expect(s.counted).toBeGreaterThan(1500);
      expect(s.leading).toBeLessThanOrEqual(0.3); expect(s.units).toBeLessThanOrEqual(0.3);
    }
  });
});

const fmtNum = (n: number) => n.toLocaleString('en-GB');
