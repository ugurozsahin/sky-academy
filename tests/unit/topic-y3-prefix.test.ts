import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { PREFIX_WORDS, PREFIX_MEANING } from '../../src/curriculum/year3-prefix';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-prefix')!;
const draws = (d: Difficulty, n = 400) => { const r = rng(1103 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
// Gap-spelling AVOID does not list every crude whole word (G13): a short local set too.
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const bad = (s: string) => [...AVOID, ...EXCLUDE].some(a => s.toLowerCase().includes(a));
const meaningOf = (p: string) => (p === 'dis' || p === 'mis' ? 'wrong' : p);
const prefixes = [...new Set(PREFIX_WORDS.map(r => r[1]))];
const rowOf = (word: string) => PREFIX_WORDS.find(r => r[0] === word);

describe('y3-prefix (#1103)', () => {
  it('is registered once in Year 3, sequencing from d3', () => {
    expect(TOPICS.filter(t => t.id === 'y3-prefix')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year3', subject: 'writing', sequenceFrom: 3 });
  });

  it('every bank row is prefix + root = word, all eight prefixes appear, each with at least 3 words', () => {
    for (const [w, p, r] of PREFIX_WORDS) expect(p + r, w).toBe(w);
    for (const p of ['dis', 'mis', 're', 'sub', 'inter', 'super', 'anti', 'auto'])
      expect(PREFIX_WORDS.filter(r => r[1] === p).length, p).toBeGreaterThanOrEqual(3);
  });

  it('d1 names the prefix for its stated meaning, asks only the six distinct ones, never dis or mis', () => {
    const asked = new Set<string>();
    for (const c of draws(1)) {
      const meaning = /means (.+)\?$/.exec(c.prompt)![1];
      expect(PREFIX_MEANING[c.answer], c.prompt).toBe(meaning);
      expect(c.options).toHaveLength(3);
      for (const o of c.options) expect(Object.keys(PREFIX_MEANING), o).toContain(o);
      asked.add(c.answer);
    }
    expect([...asked].sort()).toEqual(Object.keys(PREFIX_MEANING).sort());
  });

  it('d2: the answer is the word whose definition is shown, with 4 real-word bubbles and no decoy sharing its meaning', () => {
    const all = new Set(PREFIX_WORDS.flatMap(r => [r[0], r[2]]));
    for (const c of draws(2)) {
      const row = rowOf(c.answer)!;
      expect(c.prompt).toBe(`Which word means ${row[3]}?`);
      expect(c.options).toHaveLength(4);
      expect(c.options).toContain(row[2]);
      for (const o of c.options) {
        expect(all.has(o), o).toBe(true);
        const r = rowOf(o);
        if (o !== c.answer && r) expect(meaningOf(r[1]), `${c.answer} vs ${o}`).not.toBe(meaningOf(row[1]));
      }
    }
  });

  it('d3 is an ordered prefix + root build with a prefix decoy and a root decoy', () => {
    for (const c of draws(3)) {
      const row = rowOf(c.answer)!;
      expect(c.sequence).toEqual([row[1], row[2]]);
      expect(c.sequence!.join('')).toBe(c.answer);
      expect(c.options).toHaveLength(4);
      expect(new Set(c.options).size).toBe(4);
      for (const s of c.sequence!) expect(c.options).toContain(s);
      expect(c.prompt).toContain(row[3]);
      // The decoy rule on d3: two prefixes are offered and only one is in the answer's meaning group (never dis beside mis).
      // Cross-joins that happen to be real words (dis + appear, re + act) are deliberate: the shown definition fixes the answer.
      const offered = c.options.filter(o => prefixes.includes(o));
      expect(offered, c.answer).toHaveLength(2);
      expect(offered.filter(o => meaningOf(o) === meaningOf(row[1])), `${c.answer}: ${offered}`).toHaveLength(1);
    }
  });

  it('the six distinct meanings are the ones English Appendix 1 p.12 gives', () => {
    expect(PREFIX_MEANING).toEqual({ re: 'again', sub: 'under', inter: 'between', super: 'above', anti: 'against', auto: 'self' });
  });

  it('every label passes R-LBL on d1–d3', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) expect(rLblProblem(c), `${d} ${c.answer}`).toBeNull();
  });

  it('keeps crude words out: no bank word, root or definition word, and no prefix + root join a d3 card can offer', () => {
    for (const [w, , r, def] of PREFIX_WORDS) for (const x of [w, r, ...def.toLowerCase().match(/[a-z]+/g)!]) expect(AVOID.has(x) || EXCLUDE.includes(x), x).toBe(false);
    for (const [w] of PREFIX_WORDS) expect(bad(w), w).toBe(false);
    const roots = [...new Set(PREFIX_WORDS.map(r => r[2]))];
    for (const p of prefixes) for (const r of roots) expect(bad(p + r), p + r).toBe(false);
    for (const c of draws(3)) for (const p of c.options.filter(o => prefixes.includes(o))) for (const r of c.options.filter(o => roots.includes(o))) expect(bad(p + r), p + r).toBe(false);
  });
});
