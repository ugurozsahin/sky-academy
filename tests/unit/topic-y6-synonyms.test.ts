import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { SYN_ANT } from '../../src/curriculum/year6-synonyms';
import { rLblProblem } from './helpers/r-lbl';
import { cardBudgetProblem } from './helpers/card-budget';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-synonyms')!;
const draws = (d: Difficulty, n = 300) => { const r = rng(1278 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };

/** Every word the test accepts in each meaning family. A decoy from another row is from another family, so it is neither relation. */
const FAMILY_WORDS: Record<string, string[]> = {
  size: ['big', 'large', 'little'], speed: ['quick', 'rapid', 'slow'], temperature: ['hot', 'boiling', 'cold'],
  mood: ['happy', 'cheerful', 'sad'], strength: ['strong', 'powerful', 'weak'], loudness: ['loud', 'noisy', 'quiet'],
  age: ['young', 'youthful', 'elderly'], cost: ['cheap', 'affordable', 'costly'], difficulty: ['easy', 'simple', 'difficult'],
  wetness: ['wet', 'damp', 'dry'], bravery: ['brave', 'courageous', 'cowardly'], distance: ['far', 'distant', 'near'],
  cleanliness: ['clean', 'spotless', 'dirty'], fullness: ['empty', 'vacant', 'full'], beginning: ['begin', 'start', 'finish'],
  trade: ['buy', 'purchase', 'sell'], travel: ['arrive', 'reach', 'depart'], safety: ['safe', 'protected', 'dangerous'],
  texture: ['rough', 'bumpy', 'smooth'],
};
const POLYSEMOUS = ['light', 'old', 'fair', 'right', 'hard', 'fine', 'cool', 'bright', 'kind', 'mean', 'fast', 'even'];
/** Kept here, not in the child-facing AVOID list (#1278). */
const NOT_IN_BANK = ['gay', 'queer', 'bitch', 'butt', 'screw', 'knob', 'tit', 'fanny', 'pussy', 'sexy'];
const rowOf = (word: string) => SYN_ANT.find(r => r[0] === word)!;
const words = SYN_ANT.flatMap(r => [r[0], r[1], r[2]]);

describe('y6-synonyms (#1278)', () => {
  it('is registered once in Year 6 writing, in the grammar strand', () => {
    expect(TOPICS.filter(t => t.id === 'y6-synonyms')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year6', subject: 'writing', strand: 'grammar' });
  });

  it('curation: 16–20 rows, no word twice, one family per row, each word in its own family list only', () => {
    expect(SYN_ANT.length).toBeGreaterThanOrEqual(16); expect(SYN_ANT.length).toBeLessThanOrEqual(20);
    expect(new Set(words).size).toBe(words.length);
    const fams = SYN_ANT.map(r => r[4]);
    expect(new Set(fams).size).toBe(fams.length);
    expect(Object.keys(FAMILY_WORDS).sort()).toEqual([...fams].sort());
    const listed = Object.values(FAMILY_WORDS).flat();
    expect(new Set(listed).size).toBe(listed.length);
    for (const [w, s, a, , f] of SYN_ANT) for (const x of [w, s, a]) expect(FAMILY_WORDS[f], x).toContain(x);
  });

  it('no headword has two common senses, and big / large / little is in the bank', () => {
    for (const r of SYN_ANT) expect(POLYSEMOUS, r[0]).not.toContain(r[0]);
    expect(rowOf('big').slice(1, 3)).toEqual(['large', 'little']);
  });

  it('every sentence holds its headword exactly once', () => {
    for (const [w, , , s] of SYN_ANT) expect(s.toLowerCase().match(new RegExp(`\\b${w}\\b`, 'g')), s).toHaveLength(1);
  });

  it('d1: three options, the synonym is right, the antonym is the decoy, the third is from another family', () => {
    for (const q of draws(1)) {
      const w = /synonym of (\w+)\?/.exec(q.prompt)![1]; const [, syn, ant, , fam] = rowOf(w);
      expect(q.options).toHaveLength(3); expect(q.answer).toBe(syn); expect(q.options).toContain(ant);
      q.options.filter(o => o !== syn && o !== ant).forEach(o => expect(FAMILY_WORDS[fam], o).not.toContain(o));
    }
  });

  it('d2: four options, the antonym is right, the synonym is the decoy, the others are from other families', () => {
    for (const q of draws(2)) {
      const w = /antonym of (\w+)\?/.exec(q.prompt)![1]; const [, syn, ant, , fam] = rowOf(w);
      expect(q.options).toHaveLength(4); expect(q.answer).toBe(ant); expect(q.options).toContain(syn);
      q.options.filter(o => o !== syn && o !== ant).forEach(o => expect(FAMILY_WORDS[fam], o).not.toContain(o));
    }
  });

  it('d3: the sentence carries the word in capitals, four options, exactly one in the named relation', () => {
    for (const q of draws(3)) {
      const m = /(same as|opposite of) ([A-Z]+) here\?/.exec(q.prompt)!;
      const [, syn, ant, , fam] = rowOf(m[2].toLowerCase());
      const text = (q.visual as { text: string }).text;
      expect(text.match(new RegExp(`\\b${m[2]}\\b`, 'g')), text).toHaveLength(1);
      expect(q.options).toHaveLength(4);
      expect(q.answer).toBe(m[1] === 'same as' ? syn : ant);
      expect(q.options).toContain(m[1] === 'same as' ? ant : syn);
      q.options.filter(o => o !== syn && o !== ant).forEach(o => expect(FAMILY_WORDS[fam], o).not.toContain(o));
    }
  });

  it('d3 asks for the synonym and the antonym each 40–60 % of 300 draws', () => {
    const same = draws(3).filter(q => q.prompt.includes('same as')).length / 300;
    expect(same).toBeGreaterThan(0.4); expect(same).toBeLessThan(0.6);
  });

  it('no bank word is in AVOID or the topic’s own exclusion list; every card has a say; labels pass R-LBL and the budget', () => {
    words.forEach(w => { expect(AVOID.has(w), w).toBe(false); expect(NOT_IN_BANK, w).not.toContain(w); });
    SYN_ANT.forEach(r => r[3].toLowerCase().match(/[a-z]+/g)!.forEach(w => { expect(AVOID.has(w), w).toBe(false); expect(NOT_IN_BANK, w).not.toContain(w); }));
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.say).toBeTruthy();
      expect(rLblProblem(q), q.options.join()).toBeNull();
      expect(cardBudgetProblem(q)).toBeNull();
    }
  });
});
