import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { coinLabel } from '../../src/curriculum/util';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-money')!;
const draws = (d: Difficulty, seed: number, n = 400) => { const r = rng(seed + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
/** Inverse of `coinLabel`: `£1 and 50p` → 150. Throws on anything coinLabel could not have written (a decimal, say). */
function pence(label: string): number {
  const m = label.match(/^(?:£(\d+))?(?: and )?(?:(\d+)p)?$/);
  expect(m, label).toBeTruthy();
  return (m![1] ? 100 * Number(m![1]) : 0) + (m![2] ? Number(m![2]) : 0);
}
const amounts = (s: string) => (s.match(/£\d+(?: and \d+p)?|\d+p/g) ?? []).map(pence);

describe('y3-money (#1099)', () => {
  it('is registered once, in Year 3, in the measure strand', () => {
    expect(TOPICS.filter(t => t.id === 'y3-money')).toHaveLength(1);
    expect(topic.year).toBe('year3');
  });

  it('oracle in pence: every answer is the total, difference or change, written by coinLabel', () => {
    for (const c of draws(1, 1099_100)) {
      const total = (c.visual as { coins: number[] }).coins.reduce((s, x) => s + x, 0);
      expect(c.answer, c.prompt).toBe(coinLabel(total));
    }
    for (const c of draws(2, 1099_200)) {
      const [a, b] = amounts(c.prompt);
      expect(pence(c.answer), c.prompt).toBe(c.prompt.includes('+') ? a + b : a - b);
    }
    for (const c of draws(3, 1099_300)) {
      const [note, price] = amounts(c.prompt);
      expect([500, 1000], c.prompt).toContain(note);
      expect(price % 5, c.prompt).toBe(0);
      expect(pence(c.answer), c.prompt).toBe(note - price);
    }
  });

  it('d2 crosses a pound, and the answer stays within £9 and 95p', () => {
    for (const c of draws(2, 1099_400)) {
      const [a, b] = amounts(c.prompt), r = pence(c.answer);
      expect(c.prompt.includes('+') ? a % 100 + b % 100 >= 100 : a % 100 < b % 100, c.prompt).toBe(true);
      expect(r, c.prompt).toBeLessThanOrEqual(995);
    }
  });

  it('options are four distinct coinLabel amounts, each over 0 and at most £9 and 95p', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1099_500)) {
      expect(new Set(c.options).size, c.prompt).toBe(4);
      expect(c.options, c.prompt).toContain(c.answer);
      for (const o of c.options) { const p = pence(o); expect(coinLabel(p), o).toBe(o); expect(p).toBeGreaterThan(0); expect(p).toBeLessThanOrEqual(995); }
    }
  });

  it('no prompt, option or say carries a decimal point, and every say amount is a coinLabel', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1099_600)) {
      for (const s of [c.prompt, c.say ?? '', ...c.options]) expect(s, s).not.toMatch(/\d\.\d|\.\d/);
      for (const p of amounts(c.say ?? '')) expect(c.say, c.say).toContain(coinLabel(p));
    }
  });

  it('every wrong option is a slip a child could make: ±100p, ±10p, the wrong operation or the pence alone', () => {
    for (const d of [2, 3] as Difficulty[]) for (const c of draws(d, 1099_700)) {
      const r = pence(c.answer), ns = amounts(c.prompt);
      const slips = new Set([r + 100, r - 100, r + 10, r - 10, r % 100, ns[0] + ns[1], Math.abs(ns[0] - ns[1])]);
      const near = c.options.filter(o => o !== c.answer && slips.has(pence(o)));
      expect(near.length, c.prompt).toBeGreaterThanOrEqual(1);
    }
  });

  it('ladder shape: d1 shows 2–4 coins, d2 uses both operations, d3 uses both notes with prices over £1 and is slow', () => {
    for (const c of draws(1, 1099_800)) {
      const v = c.visual as { type: string; coins: number[] };
      expect(v.type).toBe('coins');
      expect(v.coins.length).toBeGreaterThanOrEqual(2);
      expect(v.coins.length).toBeLessThanOrEqual(4);
      expect(v.coins.reduce((s, x) => s + x, 0)).toBeGreaterThanOrEqual(10);
    }
    expect(new Set(draws(2, 1099_900).map(c => c.prompt.includes('+'))).size).toBe(2);
    const d3 = draws(3, 1099_950);
    expect(new Set(d3.map(c => amounts(c.prompt)[0]))).toEqual(new Set([500, 1000]));
    for (const c of d3) { expect(amounts(c.prompt)[1], c.prompt).toBeGreaterThan(100); expect(c.slow, c.prompt).toBe(true); }
    for (const d of [1, 2] as Difficulty[]) for (const c of draws(d, 1099_960, 50)) expect(c.slow).toBeFalsy();
  });

  it.each([1, 2, 3] as Difficulty[])('d%i: leak limit over 2,000 draws (#1058)', d => {
    const s = leakShares(topic.gen, d, 2000);
    expect(s.counted).toBeGreaterThan(1500);
    expect(s.units).toBeLessThanOrEqual(0.3);
    expect(s.leading).toBeLessThanOrEqual(0.3);
  });
});
