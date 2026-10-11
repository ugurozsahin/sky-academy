import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { CLAUSE_PAIRS, SUB_PAIRS } from '../../src/curriculum/year6-clauses';
import { rLblProblem } from './helpers/r-lbl';
import { cardBudgetProblem } from './helpers/card-budget';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-clauses')!;
const draws = (d: Difficulty, n = 300) => { const r = rng(1281 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const text = (q: { visual?: unknown }) => (q.visual as { text: string }).text;
const MARKS = [';', ':', '–'];
const isMarkCard = (q: { prompt: string }) => q.prompt === 'Which mark joins these two clauses?';

describe('y6-clauses (#1281)', () => {
  it('is registered once in Year 6 writing, in the grammar strand', () => {
    expect(TOPICS.filter(t => t.id === 'y6-clauses')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year6', subject: 'writing', strand: 'grammar' });
  });

  it('bank: 12+ independent rows with the NC example, 4+ colon fits, 6–8 subordinate rows', () => {
    expect(CLAUSE_PAIRS.length).toBeGreaterThanOrEqual(12);
    expect(CLAUSE_PAIRS.some(r => r[0] === "It's raining" && r[1] === "I'm fed up")).toBe(true);
    expect(CLAUSE_PAIRS.filter(r => r[2]).length).toBeGreaterThanOrEqual(4);
    CLAUSE_PAIRS.forEach(r => { expect(r[0].split(' ').length).toBeGreaterThanOrEqual(2); expect(r[1].split(' ').length).toBeGreaterThanOrEqual(2); });
    expect(SUB_PAIRS.length).toBeGreaterThanOrEqual(6); expect(SUB_PAIRS.length).toBeLessThanOrEqual(8);
    SUB_PAIRS.forEach(r => expect(r[0]).toMatch(/^(Although|When|Because|If|While|After|Unless) /));
  });

  it('mark cards: exactly one of ; : – per card, the comma always a decoy, never - or .', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d).filter(isMarkCard)) {
      expect(q.options.filter(o => MARKS.includes(o)), q.options.join()).toEqual([q.answer]);
      expect(MARKS).toContain(q.answer);
      expect(q.options).toContain(',');
      expect(q.options).not.toContain('-');
      expect(q.options).not.toContain('.');
    }
  });

  it('d1 reaches the NC example with a semicolon; d2 answers : and – both, the colon only on an explaining row', () => {
    const d1 = draws(1);
    expect(d1.every(q => q.answer === ';')).toBe(true);
    expect(d1.some(q => text(q) === "It's raining _ I'm fed up.")).toBe(true);
    const d2 = draws(2).filter(isMarkCard);
    expect(new Set(d2.map(q => q.answer))).toEqual(new Set([':', '–']));
    for (const q of d2.filter(q => q.answer === ':')) {
      const row = CLAUSE_PAIRS.find(r => text(q) === `${r[0]} _ ${r[1]}.`)!;
      expect(row[2], text(q)).toBe(true);
    }
  });

  it('d2 position cards: three gaps A, B, C, the answer is the gap at the clause boundary, and every letter is an answer', () => {
    const qs = draws(2).filter(q => !isMarkCard(q));
    expect(qs.length).toBeGreaterThan(80);
    for (const q of qs) {
      const t = text(q);
      expect(t.match(/\[[ABC]\]/g)).toEqual(['[A]', '[B]', '[C]']);
      expect([...q.options].sort()).toEqual(['A', 'B', 'C']);
      const row = CLAUSE_PAIRS.find(r => t.replace(/\[[ABC]\] /g, '').replace(/\.$/, '') === `${r[0]} ${r[1]}`)!;
      expect(row, t).toBeTruthy();
      const before = t.slice(0, t.indexOf(`[${q.answer}]`)).replace(/\[[ABC]\] /g, '').trim();
      expect(before, t).toBe(row[0]);
    }
    expect(new Set(qs.map(q => q.answer))).toEqual(new Set(['A', 'B', 'C']));
  });

  it('d3: yes on independent rows, no on subordinate ones, yes 40–60 % of 300 draws', () => {
    const qs = draws(3);
    for (const q of qs) {
      const t = text(q);
      const indep = CLAUSE_PAIRS.some(r => t === `${r[0]} _ ${r[1]}.`);
      const sub = SUB_PAIRS.some(r => t === `${r[0]} _ ${r[1]}.`);
      expect(indep || sub, t).toBe(true);
      expect(q.answer, t).toBe(indep ? 'yes' : 'no');
      expect([...q.options].sort()).toEqual(['no', 'yes']);
    }
    const share = qs.filter(q => q.answer === 'yes').length / qs.length;
    expect(share).toBeGreaterThan(0.4); expect(share).toBeLessThan(0.6);
    expect(new Set(qs.filter(q => q.answer === 'no').map(text)).size).toBeGreaterThanOrEqual(5);
  });

  it('no word is in AVOID, say never reads a mark, labels pass R-LBL and the card budget', () => {
    const words = [...CLAUSE_PAIRS, ...SUB_PAIRS].flatMap(r => [r[0], r[1]]).flatMap(s => s.toLowerCase().match(/[a-z]+/g) ?? []);
    words.forEach(w => expect(AVOID.has(w), w).toBe(false));
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.say).toBeTruthy();
      expect(q.say).not.toMatch(/[;:–]/);
      expect(rLblProblem(q), q.options.join()).toBeNull();
      expect(cardBudgetProblem(q)).toBeNull();
    }
  });
});
