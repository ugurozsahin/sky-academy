import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { GAP_BANK, CLASS_BANK } from '../../src/curriculum/year3-conjunctions';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-conjunctions')!;
const draws = (d: Difficulty, n = 400) => { const r = rng(1108 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const APPENDIX = ['when', 'before', 'after', 'while', 'so', 'because', 'then', 'next', 'soon', 'therefore', 'during', 'in', 'because of'];
const ALLOWED = [...APPENDIX, 'although', 'if'];
const isGap = (prompt: string) => prompt.includes('___');

describe('y3-conjunctions (#1108)', () => {
  it('is registered once in Year 3 writing', () => {
    expect(TOPICS.filter(t => t.id === 'y3-conjunctions')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year3', subject: 'writing' });
  });

  it('bank A: exactly three decoys, none the answer, all from Appendix 2 or although/if, one gap, at most 60 characters', () => {
    expect(GAP_BANK.length).toBeGreaterThanOrEqual(30);
    for (const [s, a, ds] of GAP_BANK) {
      expect(ds, s).toHaveLength(3);
      expect(new Set([a, ...ds]).size, s).toBe(4);
      for (const w of [a, ...ds]) expect(ALLOWED, `${s} ${w}`).toContain(w);
      expect(s.split('___'), s).toHaveLength(2);
      expect(s.length, s).toBeLessThanOrEqual(60);
    }
  });

  it('every Appendix 2 example word is an answer at least twice within its class', () => {
    const want: Record<string, string[]> = {
      conjunction: ['when', 'before', 'after', 'while', 'so', 'because'],
      adverb: ['then', 'next', 'soon', 'therefore'],
      preposition: ['before', 'after', 'during', 'in', 'because of'],
    };
    for (const [cls, words] of Object.entries(want))
      for (const w of words) expect(GAP_BANK.filter(r => r[1] === w && r[3] === cls).length, `${cls} ${w}`).toBeGreaterThanOrEqual(2);
    for (const w of APPENDIX) expect(GAP_BANK.some(r => r[1] === w), w).toBe(true);
  });

  it('bank B: before, after and since in all three classes, the word once, shape follows the class', () => {
    expect(CLASS_BANK.length).toBeGreaterThanOrEqual(15);
    for (const w of ['before', 'after', 'since']) for (const c of ['conjunction', 'preposition', 'adverb'])
      expect(CLASS_BANK.filter(r => r[1] === w && r[2] === c).length, `${w} ${c}`).toBeGreaterThanOrEqual(1);
    for (const [s, w, c] of CLASS_BANK) {
      const words = s.replace(/[.?!]$/, '').split(' ');
      expect(s.endsWith('.'), s).toBe(true);
      expect(words.filter(x => x === w), s).toHaveLength(1);
      const after = words.length - 1 - words.indexOf(w);
      if (c === 'conjunction') expect(after, s).toBeGreaterThanOrEqual(2);
      if (c === 'preposition') expect(after, s).toBeGreaterThanOrEqual(1);
      if (c === 'adverb') expect(s.endsWith(`${w}.`), s).toBe(true);
      expect(s.length, s).toBeLessThanOrEqual(60);
    }
  });

  it('no conjunction gap offers before or after against the other: either one reads sensibly in a time gap (#666)', () => {
    for (const [s, a, ds, c] of GAP_BANK) if (c === 'conjunction' && (a === 'before' || a === 'after')) expect(ds, s).not.toContain(a === 'before' ? 'after' : 'before');
  });

  it('every gap and class sentence is unique', () => {
    expect(new Set(GAP_BANK.map(r => r[0])).size).toBe(GAP_BANK.length);
    expect(new Set(CLASS_BANK.map(r => r[0])).size).toBe(CLASS_BANK.length);
  });

  it('d1: conjunction answers only, 3 bubbles', () => {
    for (const c of draws(1)) {
      expect(c.options).toHaveLength(3);
      const row = GAP_BANK.find(r => r[0] === c.prompt && r[1] === c.answer);
      expect(row?.[3], c.prompt).toBe('conjunction');
      expect(c.options, c.prompt).toContain(c.answer);
      for (const o of c.options) expect([row![1], ...row![2]], o).toContain(o);
    }
  });

  it('d2: gap cards of every class, 4 bubbles, the answer plus all three decoys', () => {
    const classes = new Set<string>();
    for (const c of draws(2)) {
      const row = GAP_BANK.find(r => r[0] === c.prompt && r[1] === c.answer)!;
      expect(row, c.prompt).toBeDefined();
      expect([...c.options].sort()).toEqual([row[1], ...row[2]].sort());
      classes.add(row[3]);
    }
    expect([...classes].sort()).toEqual(['adverb', 'conjunction', 'preposition']);
  });

  it('d3 mixes gap cards with 3 wide word-class cards', () => {
    let gaps = 0, classCards = 0;
    for (const c of draws(3)) {
      if (isGap(c.prompt)) { gaps++; expect(c.options).toHaveLength(4); continue; }
      classCards++;
      expect([...c.options].sort()).toEqual(['adverb', 'conjunction', 'preposition']);
      expect(c.wide).toBe(true);
      const row = CLASS_BANK.find(r => r[0] === (c.visual as { text: string }).text && c.prompt === `What is ${r[1]} in this sentence?`)!;
      expect(c.answer, c.prompt).toBe(row[2]);
    }
    expect(gaps).toBeGreaterThan(0);
    expect(classCards).toBeGreaterThan(0);
  });

  it('every label passes R-LBL on d1–d3', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) expect(rLblProblem(c), `${d} ${c.answer}`).toBeNull();
  });

  it('keeps crude words out of every bank word and option', () => {
    const words = [...GAP_BANK.flatMap(r => [r[0], r[1], ...r[2]]), ...CLASS_BANK.map(r => r[0])].flatMap(s => s.toLowerCase().match(/[a-z]+/g)!);
    for (const w of words) expect(AVOID.has(w) || EXCLUDE.includes(w), w).toBe(false);
  });
});
