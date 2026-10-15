import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { DOUBLE_BANK } from '../../src/curriculum/year3-double';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-double')!;
const DRAWS = 600;
const draws = (d: Difficulty) => { const r = rng(1105_000 + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
const EXCLUDE = new Set(['gay', 'queer', 'bitch', 'butt']);
const oracle = (root: string, suffix: string, stressed: boolean) => stressed ? root + root.at(-1) + suffix : root + suffix;

describe('y3-double (#1105)', () => {
  it('is registered once, in Year 3, as writing spelling', () => {
    expect(TOPICS.filter(t => t.id === 'y3-double')).toHaveLength(1);
    expect(topic.year).toBe('year3');
    expect(topic.subject).toBe('writing');
    expect(topic.strand).toBe('spelling');
  });

  it('the bank has 10+ of each kind, consonant-vowel-consonant roots, none ending in l, and the Appendix 1 stress marks', () => {
    expect(DOUBLE_BANK.filter(r => r[2]).length).toBeGreaterThanOrEqual(10);
    expect(DOUBLE_BANK.filter(r => !r[2]).length).toBeGreaterThanOrEqual(10);
    for (const [root] of DOUBLE_BANK) {
      expect(root, root).toMatch(/[^aeiou][aeiou][^aeiouwxy]$/);
      expect(root.endsWith('l'), root).toBe(false);
    }
    const stress = (w: string) => DOUBLE_BANK.find(r => r[0] === w)![2];
    for (const w of ['forget', 'begin', 'prefer']) expect(stress(w), w).toBe(true);
    for (const w of ['garden', 'limit']) expect(stress(w), w).toBe(false);
  });

  it('crude-word guard: no root, answer or non-word hits AVOID or EXCLUDE', () => {
    for (const [root, suf, st] of DOUBLE_BANK) for (const w of [root, oracle(root, suf, st), oracle(root, suf, !st)]) {
      expect(EXCLUDE.has(w), w).toBe(false);
      expect([...AVOID].some(a => w.includes(a)), w).toBe(false);
    }
  });

  it('spelling cards recompute from the oracle, with the other form as the one decoy', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d).filter(c => c.prompt.includes('='))) {
      const row = DOUBLE_BANK.find(r => c.prompt === `${r[0]} + ${r[1]} = ?`)!;
      expect(c.answer, c.prompt).toBe(oracle(row[0], row[1], row[2]));
      expect(c.options.slice().sort(), c.prompt).toEqual([oracle(row[0], row[1], row[2]), oracle(row[0], row[1], !row[2])].sort());
      expect(c.say).toBe(`Add ${row[1]} to ${row[0]}. Which spelling is right?`);
    }
  });

  it('d1 is stressed roots only, d2 mixes both kinds and never asks yes/no', () => {
    for (const c of draws(1)) {
      expect(c.prompt).toContain('=');
      expect(DOUBLE_BANK.find(r => c.prompt.startsWith(`${r[0]} +`))![2]).toBe(true);
    }
    const d2 = draws(2);
    expect(d2.every(c => c.prompt.includes('='))).toBe(true);
    const kinds = new Set(d2.map(c => DOUBLE_BANK.find(r => c.prompt.startsWith(`${r[0]} +`))![2]));
    expect(kinds.size).toBe(2);
  });

  it('d3 adds yes/no cards whose answer equals stressedLast, mixed with spelling cards', () => {
    const d3 = draws(3), yn = d3.filter(c => c.prompt.includes('double the last letter'));
    expect(yn.length).toBeGreaterThan(0);
    expect(yn.length).toBeLessThan(d3.length);
    for (const c of yn) {
      const row = DOUBLE_BANK.find(r => c.prompt.startsWith(`${r[0]} + ${r[1]}:`))!;
      expect(c.answer, c.prompt).toBe(row[2] ? 'yes' : 'no');
      expect([...c.options].sort()).toEqual(['no', 'yes']);
    }
  });

  it('every label passes R-LBL', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      expect(c.options.filter(o => o === c.answer), c.prompt).toHaveLength(1);
      expect(rLblProblem(c), c.prompt).toBeNull();
    }
  });
});
