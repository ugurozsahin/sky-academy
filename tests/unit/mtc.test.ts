import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { mtcForm, mtcPractice, MTC_LIMITS, MTC_TABLES, KS1_TABLES, KS1_LIMIT } from '../../src/game/mtc';
import { seededRng } from '../../src/game/rng';

const SEEDS = 2000;
const forms = Array.from({ length: SEEDS }, (_, s) => mtcForm(seededRng(s + 1)));
const countBy = (f: readonly { a: number; b: number }[], key: 'a' | 'b', t: number) => f.filter(i => i[key] === t).length;

describe('mtcForm (#1116)', () => {
  it('never throws and gives 25 items with both factors in 2–12', () => {
    for (const f of forms) {
      expect(f).toHaveLength(25);
      for (const { a, b } of f) { expect(a).toBeGreaterThanOrEqual(2); expect(a).toBeLessThanOrEqual(12); expect(b).toBeGreaterThanOrEqual(2); expect(b).toBeLessThanOrEqual(12); }
    }
  });
  it('keeps each first-factor table inside Table 1', () => {
    for (const f of forms) for (const t of MTC_TABLES) {
      const n = countBy(f, 'a', t);
      expect(n).toBeGreaterThanOrEqual(MTC_LIMITS[t].min);
      expect(n).toBeLessThanOrEqual(MTC_LIMITS[t].max);
    }
  });
  it('keeps KS1 at 3–7 and KS2 at 18–22', () => {
    for (const f of forms) {
      const ks1 = f.filter(i => (KS1_TABLES as readonly number[]).includes(i.a)).length;
      expect(ks1).toBeGreaterThanOrEqual(KS1_LIMIT.min);
      expect(ks1).toBeLessThanOrEqual(KS1_LIMIT.max);
      expect(25 - ks1).toBeGreaterThanOrEqual(18);
      expect(25 - ks1).toBeLessThanOrEqual(22);
    }
  });
  it('keeps each second factor within ±1 of Table 1 (footnote 5)', () => {
    for (const f of forms) for (const t of MTC_TABLES) {
      const n = countBy(f, 'b', t);
      expect(n).toBeGreaterThanOrEqual(Math.max(0, MTC_LIMITS[t].min - 1));
      expect(n).toBeLessThanOrEqual(MTC_LIMITS[t].max + 1);
    }
  });
  it('has no repeat and no reversal', () => {
    for (const f of forms) {
      const seen = new Set<string>();
      for (const { a, b } of f) {
        expect(seen.has(`${a}x${b}`)).toBe(false);
        expect(seen.has(`${b}x${a}`)).toBe(false);
        seen.add(`${a}x${b}`);
      }
    }
  });
  it('never includes the 1× table', () => {
    for (const f of forms) for (const { a, b } of f) { expect(a).not.toBe(1); expect(b).not.toBe(1); }
  });
  it('is deterministic for a seed', () => {
    for (const s of [1, 42, 977]) {
      expect(mtcForm(seededRng(s))).toEqual(mtcForm(seededRng(s)));
      expect(mtcPractice(seededRng(s))).toEqual(mtcPractice(seededRng(s)));
    }
    expect(new Set(forms.slice(0, 50).map(f => JSON.stringify(f))).size).toBeGreaterThan(40);
  });
  it('is shuffled, not ordered by table', () => {
    const sorted = forms.filter(f => f.every((it, i) => i === 0 || f[i - 1].a <= it.a));
    expect(sorted.length).toBeLessThan(5);
  });
  it('reaches all 121 items over the seeds', () => {
    const seen = new Set(forms.flat().map(i => `${i.a}x${i.b}`));
    expect(seen.size).toBe(121);
  });
});

describe('mtcPractice (#1116)', () => {
  it('gives three distinct 1 × n, n in 2–12', () => {
    for (let s = 1; s <= SEEDS; s++) {
      const p = mtcPractice(seededRng(s));
      expect(p).toHaveLength(3);
      expect(new Set(p.map(i => i.b)).size).toBe(3);
      for (const { a, b } of p) { expect(a).toBe(1); expect(b).toBeGreaterThanOrEqual(2); expect(b).toBeLessThanOrEqual(12); }
    }
  });
});

describe('src/game/mtc.ts imports (#1116)', () => {
  it('imports nothing from src/ui', () => {
    expect(readFileSync('src/game/mtc.ts', 'utf8')).not.toMatch(/from\s+['"][^'"]*\/ui\//);
  });
});
