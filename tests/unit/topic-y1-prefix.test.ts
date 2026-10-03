import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y1-prefix')!;
const DRAWS = 200;
const ROOTS = ['kind', 'happy', 'fair', 'well', 'safe', 'tidy', 'lucky', 'wise', 'true', 'lock', 'tie', 'do', 'pack', 'zip', 'load'];
const BANK = new Set([...ROOTS, ...ROOTS.map(r => `un${r}`)]);
const rootOf = (prompt: string) => /(?:not|opposite of) (\w+)/.exec(prompt)![1];

describe('y1-prefix (#977)', () => {
  it('the answer is exactly un + the root named in the prompt, and it is the only such option', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9770 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const root = rootOf(q.prompt);
        expect(q.answer, `d${d} draw ${i}`).toBe(`un${root}`);
        expect(q.options.filter(o => o === `un${root}`)).toHaveLength(1);
        expect(q.options).toContain(root);
      }
    }
  });
  it('every option is a bank word, none in AVOID, labels at most 7 letters, options unique', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9780 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        for (const o of q.options) { expect(BANK.has(o), o).toBe(true); expect(AVOID.has(o)).toBe(false); expect(o.length).toBeLessThanOrEqual(7); }
        expect(new Set(q.options).size).toBe(q.options.length);
      }
    }
  });
  it('ladder: d1 has 3 options and d2/d3 have 4; only d3 asks "opposite of", for undoing verbs', () => {
    const verbs = new Set(['lock', 'tie', 'do', 'pack', 'zip', 'load']);
    const seen = { 1: 0, 2: 0, 3: 0 };
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9790 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        expect(q.options).toHaveLength(d === 1 ? 3 : 4);
        const opp = q.prompt.includes('opposite of');
        if (opp) { seen[d]++; expect(verbs.has(rootOf(q.prompt))).toBe(true); }
        else expect(verbs.has(rootOf(q.prompt))).toBe(false);
      }
    }
    expect(seen[1]).toBe(0);
    expect(seen[2]).toBe(0);
    expect(seen[3]).toBeGreaterThan(40);
  });
});
