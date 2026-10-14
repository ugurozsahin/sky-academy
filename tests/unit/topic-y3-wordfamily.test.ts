import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { FAMILIES } from '../../src/curriculum/year3-wordfamily';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-wordfamily')!;
const draws = (d: Difficulty, n = 300) => { const r = rng(1107 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];
const family = (prompt: string) => FAMILIES.find(f => prompt.includes(` ${f[0]} family`) || prompt.endsWith(` ${f[0]}?`))!;
const inFamily = (f: (typeof FAMILIES)[number], w: string) => f[1].includes(w);

describe('y3-wordfamily (#1107)', () => {
  it('is registered once in Year 3 writing, grammar strand, any-order from d3', () => {
    expect(TOPICS.filter(t => t.id === 'y3-wordfamily')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year3', subject: 'writing', strand: 'grammar', sequenceFrom: 3 });
  });

  it('bank: at least 8 families of 3–5 members, solve family present, no word in two families, no crude words', () => {
    expect(FAMILIES.length).toBeGreaterThanOrEqual(8);
    const all: string[] = [];
    for (const [root, ms] of FAMILIES) { expect(ms.length, root).toBeGreaterThanOrEqual(3); expect(ms.length, root).toBeLessThanOrEqual(5); all.push(root, ...ms); }
    expect(new Set(all).size).toBe(all.length);
    expect(FAMILIES.find(f => f[0] === 'solve')![1]).toEqual(expect.arrayContaining(['solution', 'solver', 'dissolve', 'insoluble']));
    for (const w of all) { expect(AVOID.has(w), w).toBe(false); expect(EXCLUDE, w).not.toContain(w); }
  });

  it('d1: the answer is a member of the named family, both decoys are not', () => {
    for (const q of draws(1)) {
      const f = family(q.prompt); expect(q.options).toHaveLength(3);
      expect(inFamily(f, q.answer), q.prompt).toBe(true);
      expect(q.options!.filter(o => inFamily(f, o))).toEqual([q.answer]);
    }
  });

  it('d2: the answer is the only option outside the named family', () => {
    for (const q of draws(2)) {
      const f = family(q.prompt); expect(q.options).toHaveLength(4);
      expect(inFamily(f, q.answer), q.prompt).toBe(false);
      expect(q.options!.filter(o => !inFamily(f, o))).toEqual([q.answer]);
    }
  });

  it('d3: any-order card, 2–3 family targets, 2 decoys from other families', () => {
    for (const q of draws(3)) {
      const f = family(q.prompt);
      expect(q.anyOrder).toBe(true);
      expect(q.sequence!.length).toBeGreaterThanOrEqual(2);
      for (const t of q.sequence!) expect(inFamily(f, t), q.prompt).toBe(true);
      const decoys = q.options!.filter(o => !q.sequence!.includes(o));
      expect(decoys).toHaveLength(2);
      for (const dcy of decoys) expect(inFamily(f, dcy), q.prompt).toBe(false);
    }
  });

  it('every label passes R-LBL (#1046)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 100))
      expect(rLblProblem(q as { options: string[] }), q.prompt).toBeNull();
  });
});
