import { beforeEach, describe, expect, it } from 'vitest';
import { load, recordGameEnd, reset } from '../../src/storage';
import { isNewBest, keepBest, speedLine, tablesSpeed } from '../../src/speed-record';
import type { FactEntry } from '../../src/fact-record';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };
const right = (n: number, ms: number): FactEntry[] => Array.from({ length: n }, () => ({ fact: '7×8', outcome: 'correct', ms }));

describe('tables speed (#1174)', () => {
  it('is null for any mode but mtc', () => {
    for (const m of ['mission', 'sprint', 'boss', 'endless', 'relaxed']) expect(tablesSpeed(m, right(25, 3000))).toBeNull();
  });
  it('is null under 10 correct answers, a number at 10', () => {
    expect(tablesSpeed('mtc', right(9, 3000))).toBeNull();
    expect(tablesSpeed('mtc', right(10, 3000))).toBe(3);
  });
  it('averages the correct answers only, to one decimal place', () => {
    const e = [...right(5, 2000), ...right(5, 3000), { fact: '2×3', outcome: 'wrong', ms: 9000 }, { fact: '2×3', outcome: 'miss' }];
    expect(tablesSpeed('mtc', e)).toBe(2.5);
    expect(tablesSpeed('mtc', [...right(9, 2800), ...right(1, 2900)])).toBe(2.8);
  });
  it('ignores correct answers with no measured time', () => {
    expect(tablesSpeed('mtc', [...right(9, 3000), { fact: '2×2', outcome: 'correct' }])).toBeNull();
  });
  it('never reports 0', () => expect(tablesSpeed('mtc', right(10, 10))).toBe(0.1));
});

describe('best speed', () => {
  it('isNewBest: unset or lower', () => {
    expect(isNewBest(2.8, undefined)).toBe(true);
    expect(isNewBest(2.4, 2.5)).toBe(true);
    expect(isNewBest(2.5, 2.5)).toBe(false);
    expect(isNewBest(2.8, 2.5)).toBe(false);
  });
  it('keepBest keeps the minimum and never raises it', () => {
    expect(keepBest(2.8, 2.5)).toBe(2.5);
    expect(keepBest(2.4, 2.5)).toBe(2.4);
    expect(keepBest(2.8, undefined)).toBe(2.8);
    expect(keepBest(null, 2.5)).toBe(2.5);
    expect(keepBest(null, undefined)).toBeUndefined();
  });
  it('the three line texts, and none for a run with no speed', () => {
    expect(speedLine(2.8, 2.5)).toBe('2.8 seconds per answer · your best 2.5');
    expect(speedLine(2.4, 2.5)).toBe('2.4 seconds per answer · a new personal best!');
    expect(speedLine(2.8, undefined)).toBe('2.8 seconds per answer · your first tables speed');
    expect(speedLine(3, 3)).toBe('3.0 seconds per answer · your best 3.0');
    expect(speedLine(null, 2.5)).toBeNull();
  });
});

describe('recordGameEnd stores the best speed (#1174)', () => {
  beforeEach(() => reset());
  const end = (speed: number | null | undefined) =>
    recordGameEnd({ mode: 'mtc', won: true, correct: 25, attempts: 25, bestCombo: 0, stars: 0, score: 0, speed }, 0);
  it('keeps the lower speed in the same save and never raises it', () => {
    end(2.8); expect(load().ks2.bestSpeed).toBe(2.8);
    end(3.4); expect(load().ks2.bestSpeed).toBe(2.8);
    end(2.5); expect(load().ks2.bestSpeed).toBe(2.5);
  });
  it('a run with no speed leaves the best alone', () => {
    end(2.5); end(null); end(undefined);
    expect(load().ks2.bestSpeed).toBe(2.5);
  });
});
