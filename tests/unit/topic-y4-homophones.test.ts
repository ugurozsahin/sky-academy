import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { Y34_HOMOPHONE_SETS_2, HOMOPHONE_BANK_2 } from '../../src/curriculum/year4-homophones';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-homophones')!;
const draws = (d: Difficulty, n = 400) => { const r = rng(1112 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const setOf = (w: string) => Y34_HOMOPHONE_SETS_2.findIndex(s => s.includes(w.toLowerCase()));
const D1 = [0, 1, 2, 5, 6, 8];

describe('y4-homophones (#1171)', () => {
  it('is registered once in Year 3 writing', () => {
    expect(TOPICS.filter(t => t.id === 'y4-homophones')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'writing' });
  });

  it('the 11 sets are Appendix 1 p.15 sets 12–22, in order', () => {
    expect(Y34_HOMOPHONE_SETS_2.map(s => s.join('/'))).toEqual(['mail/male', 'main/mane', 'meat/meet', 'medal/meddle', 'missed/mist', 'peace/piece',
      'plain/plane', 'rain/rein/reign', 'scene/seen', 'weather/whether', "whose/who's"]);
  });

  it('every sentence has one gap, fits 60 characters, and its answer belongs to its set', () => {
    for (const [s, si, a] of HOMOPHONE_BANK_2) {
      expect(s.split('___'), s).toHaveLength(2);
      expect(s.length, s).toBeLessThanOrEqual(60);
      expect(Y34_HOMOPHONE_SETS_2[si], s).toContain(a.toLowerCase());
      if (s.startsWith('___')) expect(a, s).toBe(a[0].toUpperCase() + a.slice(1));
    }
  });

  it('every member of every set is the answer at least twice', () => {
    Y34_HOMOPHONE_SETS_2.forEach((set, si) => set.forEach(w => {
      expect(HOMOPHONE_BANK_2.filter(r => r[1] === si && r[2].toLowerCase() === w).length, w).toBeGreaterThanOrEqual(2);
    }));
  });

  it('options are exactly one set (case-folded), the answer is among them, and the card is a one-gap sentence', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.prompt.split('___')).toHaveLength(2);
      expect(q.options).toContain(q.answer);
      const si = setOf(q.answer);
      expect([...q.options.map(o => o.toLowerCase())].sort()).toEqual([...Y34_HOMOPHONE_SETS_2[si]].sort());
      expect(q.visual).toMatchObject({ type: 'sentence' });
      expect(q.hintIsData).toBe(false);
    }
  });

  it('d1 draws the six concrete sets, d2 adds rain/rein/reign, only d3 draws the rest', () => {
    const seen = (d: Difficulty) => [...new Set(draws(d, 800).map(q => setOf(q.answer)))].sort((a, b) => a - b);
    expect(seen(1)).toEqual(D1);
    expect(seen(2)).toEqual([...D1, 7].sort((a, b) => a - b));
    expect(seen(3)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('no sentence word or option is in AVOID or the local EXCLUDE set, and labels pass R-LBL', () => {
    for (const [s, si] of HOMOPHONE_BANK_2) for (const w of [...s.toLowerCase().match(/[a-z']+/g)!, ...Y34_HOMOPHONE_SETS_2[si]]) {
      expect(AVOID.has(w), w).toBe(false);
      expect(EXCLUDE, w).not.toContain(w);
    }
    for (const q of draws(3)) expect(rLblProblem(q), q.prompt).toBeFalsy();
  });
});
