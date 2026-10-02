import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { AN_D1, AN_D2, AN_D3, type AnRow } from '../../src/curriculum/year3-an';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-an')!;
const draws = (d: Difficulty, seed: number, n = 300) => { const r = rng(seed + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const sentenceOf = (q: { visual?: { type: string; text?: string } }) => q.visual!.text!;
const EXCLUDE = new Set(['gay', 'queer', 'bitch', 'butt']);
const sets: [string, readonly AnRow[]][] = [['d1', AN_D1], ['d2', AN_D2], ['d3', AN_D3]];
const rowFor = (s: string) => [...AN_D1, ...AN_D2, ...AN_D3].find(r => r[0] === s)!;

describe('y3-an (#1106)', () => {
  it('is registered once, in Year 3 writing', () => {
    expect(TOPICS.filter(t => t.id === 'y3-an')).toHaveLength(1);
    expect(topic.year).toBe('year3');
  });

  it('oracle: d1 and d2 rows agree with the first letter, d3 rows disagree with it', () => {
    for (const [name, set] of sets) for (const [s, word, vowel] of set)
      expect(vowel, `${name}: ${s}`).toBe(name === 'd3' ? !/^[aeiou]/i.test(word) : /^[aeiou]/i.test(word));
  });

  it('every set has at least 10 rows, both answers present, and one gap with the next word right after it', () => {
    for (const [name, set] of sets) {
      expect(set.length, name).toBeGreaterThanOrEqual(10);
      expect(set.some(r => r[2]) && set.some(r => !r[2]), name).toBe(true);
      for (const [s, word] of set) {
        expect(s.split('___'), s).toHaveLength(2);
        expect(s.length, s).toBeLessThanOrEqual(60);
        expect(s, s).toContain(`___ ${word}`);
      }
    }
  });

  it('every sentence is unique across the three banks (rowFor keys on it)', () => {
    const all = [...AN_D1, ...AN_D2, ...AN_D3].map(r => r[0]);
    expect(new Set(all).size).toBe(all.length);
  });

  it('every answer is an exactly when the next word starts with a vowel sound; every card offers exactly a and an', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 1106_100)) {
      const [, , vowel] = rowFor(sentenceOf(q));
      expect(q.answer, q.prompt).toBe(vowel ? 'an' : 'a');
      expect([...q.options].sort(), sentenceOf(q)).toEqual(['a', 'an']);
      expect(q.prompt).toBe('a or an?');
      expect(q.say, sentenceOf(q)).toBe(sentenceOf(q).replace('___', 'blank'));
      expect(q.hintIsData).toBe(false);
    }
  });

  it('ladder: d1 draws only the d1 set, d2 only the d2 set, d3 only d3 and d2 rows and both occur (the exceptions never reach d1 or d2: the oracle test pins that)', () => {
    const inSet = (set: readonly AnRow[], s: string) => set.some(r => r[0] === s);
    for (const q of draws(1, 1106_200)) expect(inSet(AN_D1, sentenceOf(q)), sentenceOf(q)).toBe(true);
    for (const q of draws(2, 1106_300)) expect(inSet(AN_D2, sentenceOf(q)), sentenceOf(q)).toBe(true);
    const d3 = draws(3, 1106_400).map(sentenceOf);
    expect(d3.every(s => inSet(AN_D3, s) || inSet(AN_D2, s))).toBe(true);
    expect(d3.some(s => inSet(AN_D3, s)) && d3.some(s => inSet(AN_D2, s))).toBe(true);
    const answers = draws(3, 1106_500).filter(q => AN_D3.some(r => r[0] === sentenceOf(q))).map(q => q.answer);
    expect(new Set(answers)).toEqual(new Set(['a', 'an']));
  });

  it('no sentence word is in AVOID or the local EXCLUDE set', () => {
    for (const [name, set] of sets) for (const [s] of set)
      for (const w of s.toLowerCase().match(/[a-z]+/g) ?? []) {
        expect(AVOID.has(w), `${name}: ${s} (${w})`).toBe(false);
        expect(EXCLUDE.has(w), `${name}: ${s} (${w})`).toBe(false);
      }
  });
});
