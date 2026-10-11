import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { FORMAL_WORDS, REGISTER_PAIRS } from '../../src/curriculum/year6-formal';
import { rLblProblem } from './helpers/r-lbl';
import { cardBudgetProblem } from './helpers/card-budget';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-formal')!;
const draws = (d: Difficulty, n = 300) => { const r = rng(1277 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const informals = FORMAL_WORDS.map(r => r[0]);
const formals = FORMAL_WORDS.map(r => r[1]);
const TAG = [/, \w+n't \w+\?$/, /, (is|are|was|do|does|did|can|will) \w+\?$/];
const hasInformalPhrase = (s: string) => informals.some(p => new RegExp(`\\b${p}\\b`, 'i').test(s));
const isInformal = (s: string) => s.includes("'") || TAG.some(r => r.test(s)) || hasInformalPhrase(s);
const lettered = (q: Question) => q.options.every(o => /^[A-D]$/.test(o));
/** The words a card offers, read back through its letters when it is a lettered card. */
const wordsOf = (q: Question): { words: string[]; answer: string } => {
  if (!lettered(q) || q.visual?.type !== 'sentence' || !q.visual.text.includes('A: ')) return { words: q.options, answer: q.answer };
  const m = Object.fromEntries([...q.visual.text.matchAll(/^([A-D]): (.*)$/gm)].map(x => [x[1], x[2]]));
  return { words: q.options.map(o => m[o]), answer: m[q.answer] };
};

describe('y6-formal (#1277)', () => {
  it('is registered once in Year 6 writing, in the grammar strand', () => {
    expect(TOPICS.filter(t => t.id === 'y6-formal')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year6', subject: 'writing', strand: 'grammar' });
  });

  it('the bank holds the three NC pairs, each word in one row, no informal phrase also a formal word', () => {
    for (const [i, f] of [['find out', 'discover'], ['ask for', 'request'], ['go in', 'enter']]) expect(FORMAL_WORDS.some(r => r[0] === i && r[1] === f), i).toBe(true);
    expect(FORMAL_WORDS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(formals).size).toBe(formals.length);
    expect(new Set(informals).size).toBe(informals.length);
    expect(informals.filter(i => formals.includes(i))).toEqual([]);
    for (const [, , s] of FORMAL_WORDS) expect(s.split('_'), s).toHaveLength(2);
  });

  it('every register pair: the formal sentence passes the formality rule, the informal one has a marker', () => {
    expect(REGISTER_PAIRS.length).toBeGreaterThanOrEqual(10);
    for (const [f, i] of REGISTER_PAIRS) { expect(isInformal(f), f).toBe(false); expect(isInformal(i), i).toBe(true); }
  });

  it('d1: the three options are formal words from three different rows, the answer is the row’s own', () => {
    for (const q of draws(1)) {
      const { words, answer } = wordsOf(q);
      expect(words, q.prompt).toHaveLength(3);
      words.forEach(w => expect(formals, w).toContain(w));
      expect(new Set(words).size).toBe(3);
      const informal = /"(.*)"/.exec(q.prompt)![1];
      expect(answer, q.prompt).toBe(FORMAL_WORDS.find(r => r[0] === informal)![1]);
    }
    const all = new Set(draws(1).map(q => wordsOf(q).answer));
    for (const f of ['discover', 'request', 'enter']) expect(all.has(f), f).toBe(true);
  });

  it('d1: request and require never share a card', () => {
    for (const q of draws(1, 600)) { const w = wordsOf(q).words; expect(w.includes('request') && w.includes('require'), q.prompt).toBe(false); }
  });

  it('d2: exactly one option is formal, and the informal original is a decoy', () => {
    for (const q of draws(2)) {
      const { words, answer } = wordsOf(q);
      const informal = /\((.*)\)/.exec((q.visual as { text: string }).text.split('\n')[1])![1];
      expect(words, q.prompt).toHaveLength(4);
      expect(words.filter(w => formals.includes(w))).toEqual([answer]);
      expect(words).toContain(informal);
      expect(answer).toBe(FORMAL_WORDS.find(r => r[0] === informal)![1]);
    }
  });

  it('d3: one sentence is formal, the other informal, and the answer is A on 40–60 % of 300 draws', () => {
    const qs = draws(3);
    for (const q of qs) {
      const [a, b] = (q.visual as { text: string }).text.split('\n').map(l => l.slice(3));
      expect(q.options).toEqual(expect.arrayContaining(['A', 'B']));
      const [good, bad] = q.answer === 'A' ? [a, b] : [b, a];
      expect(isInformal(good), good).toBe(false);
      expect(isInformal(bad), bad).toBe(true);
    }
    const share = qs.filter(q => q.answer === 'A').length / qs.length;
    expect(share).toBeGreaterThan(0.4); expect(share).toBeLessThan(0.6);
  });

  it('no card asks about the subjunctive, and the stem never calls a choice wrong', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 100)) expect(`${q.prompt} ${q.hint}`, q.prompt).not.toMatch(/subjunctive|wrong|incorrect|mistake/i);
  });

  it('every card has a say, no word is in AVOID, labels pass R-LBL and the card budget', () => {
    const bank = [...FORMAL_WORDS.flatMap(r => [r[0], r[1], ...r[2].toLowerCase().match(/[a-z]+/g)!]), ...REGISTER_PAIRS.flatMap(p => p.flatMap(s => s.toLowerCase().match(/[a-z]+/g)!))];
    bank.forEach(w => expect(AVOID.has(w), w).toBe(false));
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.say).toBeTruthy();
      expect(rLblProblem(q), q.options.join()).toBeNull();
      expect(cardBudgetProblem(q)).toBeNull();
    }
  });

  it('approximately is reachable, as a lettered card', () => {
    const cards = draws(1, 600).filter(q => wordsOf(q).answer === 'approximately');
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach(q => expect(lettered(q)).toBe(true));
  });
});
