import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { GAP_BANK, THAT_BANK, OMIT_BANK, DECOYS, PRONOUNS } from '../../src/curriculum/year5-relative';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-relative')!;
const draws = (d: Difficulty, n = 1500) => { const r = rng(1224 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const text = (q: { visual?: unknown }) => (q.visual as { text: string }).text;
const wordsOf = (s: string) => s.toLowerCase().match(/[a-z]+/g)!;
const pronounsIn = (s: string) => wordsOf(s).filter(w => PRONOUNS.includes(w));
// `AVOID` is a gap-spelling denylist and lists no crude whole words (G13): a short local set too.
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];

describe('y5-relative (#1224)', () => {
  it('is registered once in Year 5 grammar', () => {
    expect(TOPICS.filter(t => t.id === 'y5-relative')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year5', subject: 'writing', strand: 'grammar' });
  });

  it('d1: the sentence holds exactly one relative pronoun, the answer, among 4 single-word bubbles', () => {
    for (const q of draws(1)) {
      expect(pronounsIn(text(q)), text(q)).toEqual([q.answer]);
      expect(q.prompt).toBe('Slice the relative pronoun');
      expect(q.options).toHaveLength(4);
      expect(q.options).toContain(q.answer);
      for (const o of q.options) { expect(o).toMatch(/^[A-Za-z]+$/); expect(wordsOf(text(q)), o).toContain(o.toLowerCase()); }
      expect(q.options.filter(o => PRONOUNS.includes(o))).toEqual([q.answer]);
    }
  });

  it('every bank sentence holds exactly one pronoun, and `which` only follows a comma', () => {
    for (const [t, a] of GAP_BANK) {
      expect(pronounsIn(t.replace('___', a)), t).toEqual([a]);
      expect(t.split('___'), t).toHaveLength(2);
      if (a === 'which') expect(t, t).toContain(', ___');
    }
    for (const s of THAT_BANK) expect(pronounsIn(s), s).toEqual(['that']);
  });

  it('who, which, where, when and whose each answer at least 3 gap entries; all five show up at d1 and d2', () => {
    for (const p of ['who', 'which', 'where', 'when', 'whose']) {
      expect(GAP_BANK.filter(r => r[1] === p).length, p).toBeGreaterThanOrEqual(3);
      for (const d of [1, 2] as Difficulty[]) expect(draws(d, 600).some(q => q.answer === p), `d${d} ${p}`).toBe(true);
    }
  });

  it('d2: the answer is the entry pronoun, decoys come only from its allowed list, never `that`; when never meets where', () => {
    for (const q of draws(2)) {
      const row = GAP_BANK.find(r => r[0] === text(q))!;
      expect(row, text(q)).toBeDefined();
      expect(q.answer).toBe(row[1]);
      expect(q.options).toHaveLength(3);
      expect(q.options).not.toContain('that');
      for (const o of q.options.filter(x => x !== q.answer)) expect(DECOYS[q.answer], text(q)).toContain(o);
      if (q.answer === 'when') expect(q.options).not.toContain('where');
    }
    for (const list of Object.values(DECOYS)) expect(list).not.toContain('that');
    expect(DECOYS.when).not.toContain('where');
  });

  it('d3: putting "that" back after the answer gives the entry sentence, and the answer occurs once', () => {
    for (const q of draws(3)) {
      expect(q.prompt).toBe('Which word comes before the missing pronoun?');
      const [before, after] = text(q).split(' ___ ');
      const row = OMIT_BANK.find(r => r[0] === before && r[1] === after)!;
      expect(row, text(q)).toBeDefined();
      expect(`${before} that ${after}`).toBe(`${row[0]} that ${row[1]}`);
      expect(before.endsWith(q.answer)).toBe(true);
      expect(wordsOf(`${before} ${after}`).filter(w => w === q.answer.toLowerCase())).toHaveLength(1);
      expect(q.options).toHaveLength(4);
      expect(q.options).toContain(q.answer);
      expect(pronounsIn(`${before} ${after}`)).toEqual([]);
    }
  });

  it('no bubble is a grammar term, every card has a sentence visual and a say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 400)) {
      expect(q.visual?.type).toBe('sentence');
      expect(q.say).toBeTruthy();
      for (const o of q.options) expect(['pronoun', 'clause', 'noun', 'verb', 'adjective']).not.toContain(o.toLowerCase());
    }
  });

  it('the banks are clean: no crude or AVOID word in a sentence or bubble', () => {
    for (const s of [...GAP_BANK.map(r => r[0]), ...THAT_BANK, ...OMIT_BANK.flat()]) for (const w of wordsOf(s)) expect(AVOID.has(w) || EXCLUDE.includes(w), w).toBe(false);
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 400)) for (const o of q.options) expect(AVOID.has(o.toLowerCase()) || EXCLUDE.includes(o.toLowerCase()), o).toBe(false);
  });

  it('every label passes R-LBL on d1–d3', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 400)) expect(rLblProblem(c), `${d} ${c.answer}`).toBeNull();
  });
});
