import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { parseNum } from '../../src/curriculum/ks2num';
import { leakShares } from './helpers/decoy-leak';

// Deterministic RNG (mulberry32), same construction `topic-y3-count.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-pv')!;
const DRAWS = 400;
const num = (label: string) => parseNum(label)!.v;
const WORD: Record<string, number> = { hundred: 100, ten: 10, one: 1 };
const draws = (d: Difficulty, seed: number) => { const r = rng(seed + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };

/** Independent oracle for a d2/d3 build card: sum "N hundreds, N tens and N ones" from the words alone. */
function built(prompt: string): number {
  const parts = [...prompt.replace(/ = \?$/, '').matchAll(/(\d+) (hundred|ten|one)s?\b/g)];
  return parts.reduce((sum, m) => sum + Number(m[1]) * WORD[m[2]], 0);
}

describe('y3-pv (#1079)', () => {
  it('is registered once, in Year 3', () => {
    expect(TOPICS.filter(t => t.id === 'y3-pv')).toHaveLength(1);
    expect(topic.year).toBe('year3');
  });

  it('d1: the answer is the digit times its column, and the digit is never 0 or repeated', () => {
    for (const q of draws(1, 1079_100)) {
      const m = q.prompt.match(/^What is the (\d) worth in (\d{3})\?$/)!;
      expect(m, q.prompt).toBeTruthy();
      const [, digit, n] = m;
      expect(digit, q.prompt).not.toBe('0');
      expect(n.split('').filter(c => c === digit), q.prompt).toHaveLength(1);
      expect(num(q.answer), q.prompt).toBe(Number(digit) * 10 ** (2 - n.indexOf(digit)));
    }
  });

  it('d1: the face value is always among the decoys (the commonest slip)', () => {
    for (const q of draws(1, 1079_150)) expect(q.options, q.prompt).toContain(q.prompt.match(/the (\d) worth/)![1]);
  });

  it('d2 and d3 build cards: the answer is 100h + 10t + o, recomputed from the words', () => {
    for (const d of [2, 3] as Difficulty[]) {
      for (const q of draws(d, 1079_200).filter(c => c.prompt.endsWith(' = ?'))) expect(num(q.answer), q.prompt).toBe(built(q.prompt));
    }
  });

  it('d2 mostly keeps the parts in order, sometimes not, and about a quarter have no tens', () => {
    const d2 = draws(2, 1079_300);
    const inOrder = d2.filter(q => /^\d+ hundreds?/.test(q.prompt) && / \d+ ones? = \?$/.test(q.prompt)).length / DRAWS;
    expect(inOrder).toBeGreaterThan(0.5);
    expect(inOrder).toBeLessThan(0.95);
    const noTens = d2.filter(q => !/tens?\b/.test(q.prompt)).length / DRAWS;
    expect(noTens).toBeGreaterThan(0.15);
    expect(noTens).toBeLessThan(0.35);
    for (const q of d2.filter(c => !/tens?\b/.test(c.prompt))) expect(num(q.answer) % 100, q.prompt).toBe(num(q.answer) % 10);
  });

  it('d3 partition cards: the shown parts plus the answer make the whole', () => {
    const cards = draws(3, 1079_400).filter(q => !q.prompt.endsWith(' = ?'));
    expect(cards.length).toBeGreaterThan(50);
    for (const q of cards) {
      const m = q.prompt.match(/^(\d{3}) = (\d+) \+ (\?|(\d+))(?: \+ (\d+))?$/) ?? q.prompt.match(/^(\d{3}) = (\d+) \+ \? \+ (\d+)$/);
      expect(m, q.prompt).toBeTruthy();
      const shown = (q.prompt.replace(/^\d+ = /, '').match(/\d+/g) ?? []).reduce((s, x) => s + Number(x), 0);
      expect(Number(q.prompt.slice(0, 3)), q.prompt).toBe(shown + num(q.answer));
    }
    expect(cards.some(q => /\+ \? \+/.test(q.prompt)) && cards.some(q => /\+ \?$/.test(q.prompt))).toBe(true);
  });

  it('every number on a card is 100-999 and every answer and option is at most 999', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 1079_500)) {
      for (const o of q.options) { expect(num(o), q.prompt).toBeGreaterThan(0); expect(num(o), q.prompt).toBeLessThanOrEqual(999); }
      for (const n of q.prompt.match(/\d{3,}/g) ?? []) { expect(Number(n), q.prompt).toBeGreaterThanOrEqual(100); expect(Number(n), q.prompt).toBeLessThanOrEqual(999); }
    }
  });

  it('singular forms: never "1 hundreds", "1 tens" or "1 ones", with the 1 forced in each column', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 1079_600)) {
      expect(q.prompt, q.prompt).not.toMatch(/\b1 (hundreds|tens|ones)\b/);
      expect(q.say, q.say).not.toMatch(/\b1 (hundreds|tens|ones)\b/);
    }
    const all = draws(2, 1079_610).map(q => q.prompt).join('|');
    expect(all).toMatch(/\b1 hundred\b/);
    expect(all).toMatch(/\b1 ten\b/);
    expect(all).toMatch(/\b1 one\b/);
  });

  it('every card has a say with no raw "=" or "?"', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 1079_700)) expect(q.say, q.prompt).toBeTruthy();
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d, 1079_700)) expect(q.say, q.prompt).not.toMatch(/[=?]/);
  });

  it('build cards carry the swapped-digit decoy where the swap is a different number', () => {
    for (const q of draws(2, 1079_800)) {
      const a = String(num(q.answer));
      const swaps = [a[1] + a[0] + a[2], a[0] + a[2] + a[1]].filter(s => s !== a && s[0] !== '0');
      if (swaps.length) expect(q.options.some(o => swaps.includes(o)), q.prompt).toBe(true);
    }
  });

  it('decoys: leading and last digit shares stay within the KS2 ceiling (#1058)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d, 2000);
      expect(s.counted, `d${d}`).toBeGreaterThan(200);
      expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.30);
      expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.30);
    }
  });
});
