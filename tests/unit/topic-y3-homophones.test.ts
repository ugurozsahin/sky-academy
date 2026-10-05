import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { Y34_HOMOPHONE_SETS_1, HOMOPHONE_BANK } from '../../src/curriculum/year3-homophones';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-homophones')!;
const draws = (d: Difficulty, n = 400) => { const r = rng(1112 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const setOf = (w: string) => Y34_HOMOPHONE_SETS_1.findIndex(s => s.includes(w.toLowerCase()));
const D1 = [2, 3, 4, 5, 6, 7, 8, 10];

describe('y3-homophones (#1112)', () => {
  it('is registered once in Year 3 writing', () => {
    expect(TOPICS.filter(t => t.id === 'y3-homophones')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year3', subject: 'writing' });
  });

  it('the 11 sets are Appendix 1 p.15 sets 1–11, in order', () => {
    expect(Y34_HOMOPHONE_SETS_1.map(s => s.join('/'))).toEqual(['accept/except', 'affect/effect', 'ball/bawl', 'berry/bury', 'brake/break', 'fair/fare',
      'grate/great', 'groan/grown', 'here/hear', "heel/heal/he'll", 'knot/not']);
  });

  it('every sentence has one gap, fits 60 characters, and its answer belongs to its set', () => {
    for (const [s, si, a] of HOMOPHONE_BANK) {
      expect(s.split('___'), s).toHaveLength(2);
      expect(s.length, s).toBeLessThanOrEqual(60);
      expect(Y34_HOMOPHONE_SETS_1[si], s).toContain(a.toLowerCase());
      if (s.startsWith('___')) expect(a, s).toBe(a[0].toUpperCase() + a.slice(1));
    }
  });

  it('every member of every set is the answer at least twice', () => {
    Y34_HOMOPHONE_SETS_1.forEach((set, si) => set.forEach(w => {
      expect(HOMOPHONE_BANK.filter(r => r[1] === si && r[2].toLowerCase() === w).length, w).toBeGreaterThanOrEqual(2);
    }));
  });

  it('options are exactly one set (case-folded), the answer is among them, and the card is a one-gap sentence', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.prompt.split('___')).toHaveLength(2);
      expect(q.options).toContain(q.answer);
      const si = setOf(q.answer);
      expect([...q.options.map(o => o.toLowerCase())].sort()).toEqual([...Y34_HOMOPHONE_SETS_1[si]].sort());
      expect(q.visual).toMatchObject({ type: 'sentence' });
      expect(q.hintIsData).toBe(false);
    }
  });

  it('d1 draws the eight concrete sets, d2 adds heel/heal/he\'ll, only d3 draws accept/except or affect/effect', () => {
    const seen = (d: Difficulty) => new Set(draws(d, 600).map(q => setOf(q.answer)));
    expect([...seen(1)].sort((a, b) => a - b)).toEqual(D1);
    expect([...seen(2)].sort((a, b) => a - b)).toEqual([...D1, 9].sort((a, b) => a - b));
    expect(seen(3).has(0) && seen(3).has(1)).toBe(true);
  });

  it('no sentence word or option is in AVOID or the local EXCLUDE set, and labels pass R-LBL', () => {
    for (const [s, si] of HOMOPHONE_BANK) for (const w of [...s.toLowerCase().match(/[a-z']+/g)!, ...Y34_HOMOPHONE_SETS_1[si]]) {
      expect(AVOID.has(w), w).toBe(false);
      expect(EXCLUDE, w).not.toContain(w);
    }
    for (const q of draws(3)) expect(rLblProblem(q), q.prompt).toBeFalsy();
  });
});
