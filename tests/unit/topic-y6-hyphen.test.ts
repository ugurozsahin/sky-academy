import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { RE_PAIRS, HYPHEN_ROOTS, SOLID_ROOTS, COMPOUNDS, needsHyphen } from '../../src/curriculum/year6-hyphen';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-hyphen')!;
const draws = (d: Difficulty, n = 300) => { const r = rng(1275 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const text = (q: { visual?: unknown }) => (q.visual as { text: string }).text;

describe('y6-hyphen (#1275)', () => {
  it('is registered once in Year 6 grammar', () => {
    expect(TOPICS.filter(t => t.id === 'y6-hyphen')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year6', subject: 'writing', strand: 'grammar' });
  });

  it('d1: one gap per sentence, the answer is the word for that sentence, hyphened about half the time', () => {
    let hy = 0;
    const qs = draws(1);
    for (const q of qs) {
      const s = text(q);
      expect(s.split('_')).toHaveLength(2);
      const row = RE_PAIRS.find(r => r[2] === s || r[3] === s)!;
      expect(q.answer).toBe(row[2] === s ? row[0] : row[1]);
      expect([...q.options].sort()).toEqual([row[0], row[1]].sort());
      expect(q.say).toContain('blank');
      if (q.answer.includes('-')) hy++;
    }
    expect(hy / qs.length).toBeGreaterThan(0.4); expect(hy / qs.length).toBeLessThan(0.6);
  });

  it('d2: exactly one option meets the vowel rule and it is the answer', () => {
    const all = [...HYPHEN_ROOTS, ...SOLID_ROOTS];
    for (const h of HYPHEN_ROOTS) expect(needsHyphen(h)).toBe(true);
    for (const s of SOLID_ROOTS) expect(needsHyphen(s)).toBe(false);
    for (const q of draws(2)) {
      const hits = q.options.filter(o => all.some(p => p[0] + p[1] === o && needsHyphen(p)));
      expect(hits).toEqual([q.answer]);
      expect(q.options).toHaveLength(3);
      expect(q.say).not.toContain(q.answer);
    }
  });

  it('d3: stems alternate and the answer letter matches the stem form', () => {
    const stems = new Set<string>(), letters = new Set<string>();
    for (const q of draws(3)) {
      const [, a, b] = /^A: (.*) \/ B: (.*)$/.exec(text(q))!;
      const row = COMPOUNDS.find(r => [r[0], r[1]].includes(a))!;
      expect([a, b].sort()).toEqual([row[0], row[1]].sort());
      const only = q.prompt.startsWith('Which one can only mean');
      expect(q.prompt).toContain(only ? row[2] : row[3]);
      expect(q.answer).toBe((only ? row[0] : row[1]) === a ? 'A' : 'B');
      stems.add(only ? 'only' : 'could'); letters.add(q.answer);
      expect(q.say).not.toMatch(/^[AB]$/);
    }
    expect(stems.size).toBe(2); expect(letters.size).toBe(2);
  });

  it('every row is asked both ways and uses ASCII hyphens only', () => {
    const seen = new Set<string>();
    for (const q of draws(3, 600)) seen.add(`${q.prompt}`);
    for (const r of COMPOUNDS) { expect(seen.has(`Which one can only mean ${r[2]}?`)).toBe(true); expect(seen.has(`Which one could mean ${r[3]}?`)).toBe(true); }
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 100)) expect(JSON.stringify(q)).not.toMatch(/[–—]/);
  });

  it('no bank word is in AVOID and labels pass R-LBL', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 200)) {
      const words = (JSON.stringify(q).toLowerCase().match(/[a-z]+/g) ?? []);
      for (const w of words) expect(AVOID.has(w), w).toBe(false);
      expect(rLblProblem(q), q.options.join()).toBeNull();
    }
  });
});
