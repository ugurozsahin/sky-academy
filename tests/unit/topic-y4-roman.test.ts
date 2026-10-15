import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { fromRoman, isRoman } from '../../src/curriculum/roman';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-roman')!;
const DRAWS = 400;
const draws = (d: Difficulty, n = DRAWS) => { const r = rng(1135_000 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const card = (q: Question) => (q.visual?.type === 'word' ? q.visual.text : '');
const isRead = (q: Question) => isRoman(card(q));
const isWrite = (q: Question) => /^Which Roman numeral is \d+\?$/.test(q.prompt);
const isBank = (q: Question) => q.options.length === 2;
const isZero = (q: Question) => q.prompt === 'Which one needs a 0 in our digits?';

describe('y4-roman (#1135)', () => {
  it('is registered once in Year 4 maths, after y4-round', () => {
    expect(TOPICS.filter(t => t.id === 'y4-roman')).toHaveLength(1);
    expect(topic.year).toBe('year4');
    expect(topic.subject).toBe('maths');
    const ids = TOPICS.filter(t => t.year === 'year4').map(t => t.id);
    expect(ids.indexOf('y4-roman')).toBe(ids.indexOf('y4-round') + 1);
  });

  it('oracle: both directions, every value in 1 to 100, exactly one option correct', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      if (isRead(q)) {
        const v = fromRoman(card(q))!;
        expect(v >= 1 && v <= 100).toBe(true);
        expect(q.answer).toBe(String(v));
        expect(q.options.filter(o => Number(o) === v)).toHaveLength(1);
        for (const o of q.options) expect(Number(o) >= 1 && Number(o) <= 100, q.prompt).toBe(true);
      } else if (isWrite(q)) {
        const v = Number(q.prompt.match(/\d+/)![0]);
        expect(fromRoman(q.answer)).toBe(v);
        expect(q.options.filter(o => fromRoman(o) === v)).toHaveLength(1);
      }
    }
  });

  it('d1 uses only I, V, X on the card, values 1 to 39, numeral to number', () => {
    for (const q of draws(1)) {
      expect(isRead(q)).toBe(true);
      expect(card(q)).toMatch(/^[IVX]+$/);
      expect(Number(q.answer)).toBeLessThanOrEqual(39);
    }
  });

  it('d2 goes both ways and uses L and C', () => {
    const qs = draws(2);
    expect(qs.some(isRead)).toBe(true);
    expect(qs.some(isWrite)).toBe(true);
    expect(qs.every(q => isRead(q) || isWrite(q))).toBe(true);
    expect(qs.some(q => /[LC]/.test((card(q) || q.answer)))).toBe(true);
    expect(qs.some(q => /XL|XC/.test((card(q) || q.answer)))).toBe(true);
  });

  it('no bubble shows a numeral wider than the register: nothing over 6 letters, LXXXVIII never an option', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      if (isBank(q)) continue;
      if (!isRead(q)) for (const o of q.options) expect(o.length, `${q.prompt}: ${o}`).toBeLessThanOrEqual(6);
      expect(q.options).not.toContain('LXXXVIII');
    }
    expect(draws(2, 2000).some(q => card(q) === 'LXXXVIII')).toBe(true);
  });

  it('every Roman option is canonical', () => {
    for (const d of [2, 3] as Difficulty[]) for (const q of draws(d)) if (isWrite(q) || isZero(q)) for (const o of q.options) expect(isRoman(o), o).toBe(true);
  });

  it('the subtractive pair read as adding is a decoy (XLIX read as 71, IV as 6)', () => {
    const qs = draws(2, 2000).filter(q => isRead(q) && card(q) === 'XLIX');
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.every(q => q.options.includes('71'))).toBe(true);
  });

  it('say spells the letters and never holds a raw numeral', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.say, q.prompt).toBeDefined();
      expect(q.say!, q.prompt).not.toMatch(/\b[IVXLCDM]{2,}\b/);
      if (isRead(q)) expect(q.say).toContain('Roman numeral ');
    }
  });

  it('d3 carries the zero cards: exactly one multiple of 10 among three numerals', () => {
    const qs = draws(3, 1500).filter(isZero);
    expect(qs.length).toBeGreaterThan(20);
    for (const q of qs) {
      expect(q.options).toHaveLength(3);
      expect(q.options.filter(o => fromRoman(o)! % 10 === 0)).toHaveLength(1);
      expect(fromRoman(q.answer)! % 10).toBe(0);
    }
  });

  it('d3 carries the true/false bank exactly as written', () => {
    const bank = new Map([
      ['The Romans had no numeral for zero.', 'True'],
      ['In 305, the 0 shows there are no tens.', 'True'],
      ['In 505, both 5s are worth the same.', 'False'],
      ['In 250, the 0 can be left out without changing the number.', 'False'],
    ]);
    const seen = new Set<string>();
    for (const q of draws(3, 1500).filter(isBank)) { expect(bank.get(q.prompt), q.prompt).toBe(q.answer); seen.add(q.prompt); }
    expect(seen.size).toBe(4);
  });

  it('number answers (20 and over) do not give themselves away by a unique units or leading digit', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const qs = draws(d, 2000).filter(q => isRead(q) && Number(q.answer) >= 20);
      const share = (f: (s: string) => string) => qs.filter(q => q.options.filter(o => f(o) === f(q.answer)).length === 1).length / qs.length;
      expect(share(s => s.slice(-1)), `d${d} units`).toBeLessThanOrEqual(0.3);
      expect(share(s => s[0]), `d${d} leading`).toBeLessThanOrEqual(0.3);
    }
  });
});
