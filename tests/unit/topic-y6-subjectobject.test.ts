import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { SUBJ_OBJ, byNoun } from '../../src/curriculum/year6-subjectobject';
import { rLblProblem } from './helpers/r-lbl';
import { cardBudgetProblem } from './helpers/card-budget';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-subjectobject')!;
const draws = (d: Difficulty, n = 300) => { const r = rng(1283 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const text = (q: { visual?: unknown }) => (q.visual as { text: string }).text;
const row = (q: { visual?: unknown }) => SUBJ_OBJ.find(r => r[0] === text(q))!;
const wordsOf = (s: string): string[] => s.toLowerCase().match(/[a-z]+/g) ?? [];
const VERBS = ['chased', 'kicked', 'read', 'painted', 'fed', 'built', 'baked', 'opened', 'thanked', 'helped', 'called', 'followed', 'study', 'choose', 'bury', 'reach', 'draw', 'like', 'found', 'broken', 'eaten', 'written', 'won'];
const AUX = ['will', 'did', 'does', 'can'];

describe('y6-subjectobject (#1283)', () => {
  it('is registered once in Year 6 writing, in the grammar strand', () => {
    expect(TOPICS.filter(t => t.id === 'y6-subjectobject')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year6', subject: 'writing', strand: 'grammar' });
  });

  it('bank: 18–24 rows, each role word once and whole in its sentence, ≤8 letters, subject ≠ object', () => {
    expect(SUBJ_OBJ.length).toBeGreaterThanOrEqual(18); expect(SUBJ_OBJ.length).toBeLessThanOrEqual(24);
    for (const [s, subj, verb, obj, kind] of SUBJ_OBJ) {
      const w = wordsOf(s);
      for (const x of [subj, verb, obj, ...(kind === 'passive' ? [byNoun(s)] : [])].filter((x): x is string => x !== null)) {
        expect(x.length, x).toBeLessThanOrEqual(8);
        expect(w.filter(y => y === x.toLowerCase()), `${x} in ${s}`).toHaveLength(1);
      }
      expect(obj === null ? true : subj.toLowerCase() !== obj.toLowerCase()).toBe(true);
      expect(obj === null, s).toBe(kind === 'passive');
      expect(VERBS, s).toContain(verb);
    }
    expect(SUBJ_OBJ.filter(r => r[4] === 'passive').length).toBeGreaterThanOrEqual(4);
  });

  it('position rules are checked, not trusted', () => {
    for (const [s, subj, verb, obj, kind] of SUBJ_OBJ) {
      const w = wordsOf(s); const at = (x: string) => w.indexOf(x.toLowerCase());
      if (kind === 'statement' || kind === 'pronoun') { expect(at(subj), s).toBeLessThan(at(verb)); expect(at(obj!), s).toBeGreaterThan(at(verb)); }
      if (kind === 'question') { expect(AUX.some(a => at(a) >= 0 && at(a) < at(subj)), s).toBe(true); expect(at(subj), s).toBeLessThan(at(verb)); }
      if (kind === 'passive') { expect(at(subj), s).toBeLessThan(Math.max(at('was'), at('were'))); expect(w[w.indexOf('by') + 1] === byNoun(s).toLowerCase() || w.at(-1) === byNoun(s).toLowerCase(), s).toBe(true); }
    }
  });

  it('d1 asks the subject of a statement; d2 the object of a statement or pronoun row, never a passive; d3 only question and passive rows', () => {
    for (const q of draws(1)) { const r = row(q); expect(r[4]).toBe('statement'); expect(q.prompt).toBe('Which word is the subject?'); expect(q.answer).toBe(r[1]); expect(q.options).toContain(r[3]); }
    for (const q of draws(2)) { const r = row(q); expect(['statement', 'pronoun']).toContain(r[4]); expect(q.prompt).toBe('Which word is the object?'); expect(q.answer).toBe(r[3]); expect(q.options).toContain(r[1]); }
    const d3 = draws(3);
    for (const q of d3) {
      const r = row(q); expect(['question', 'passive']).toContain(r[4]);
      expect(q.answer).toBe(r[1]);
      expect(q.options).toContain(r[4] === 'passive' ? byNoun(r[0]) : r[3]);
    }
    expect(d3.some(q => text(q) === 'Will the children study the animals?' && q.answer === 'children')).toBe(true);
    expect(new Set(d3.filter(q => row(q)[4] === 'passive').map(text)).size).toBeGreaterThanOrEqual(4);
    expect(d3.some(q => text(q) === 'Which book did Sam choose?' && q.options.includes('book'))).toBe(true);
  });

  it('every option is a word of its own sentence, options are unique, and exactly one fits the role', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      const w = wordsOf(text(q));
      expect(new Set(q.options).size).toBe(q.options.length);
      q.options.forEach(o => expect(w.filter(x => x === o.toLowerCase()), o).toHaveLength(1));
      expect(q.options).toContain(q.answer);
    }
  });

  it('no word is in AVOID, say is set, labels pass R-LBL and the card budget; ASCII-British wording', () => {
    SUBJ_OBJ.flatMap(r => wordsOf(r[0])).forEach(w => expect(AVOID.has(w), w).toBe(false));
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.say).toContain(text(q));
      expect(rLblProblem(q), q.options.join()).toBeNull();
      expect(cardBudgetProblem(q)).toBeNull();
    }
  });
});
