import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { parseNum } from '../../src/curriculum/ks2num';

// Deterministic RNG (mulberry32), same construction `topic-y3-pv.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-compare')!;
const DRAWS = 400;
const num = (label: string) => parseNum(label)!.v;
const draws = (d: Difficulty, seed: number) => { const r = rng(seed + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
const pair = (prompt: string) => prompt.split(' ? ').map(num) as [number, number];
const signCards = (d: Difficulty) => draws(d, 1080_000).filter(q => !q.sequence);
const sign = (a: number, b: number) => a < b ? '<' : a > b ? '>' : '=';

describe('y3-compare (#1080)', () => {
  it('is registered once, in Year 3, and says it draws a sequence from d3', () => {
    expect(TOPICS.filter(t => t.id === 'y3-compare')).toHaveLength(1);
    expect(topic.year).toBe('year3');
    expect(topic.sequenceFrom).toBe(3);
  });

  it('every sign card offers all three signs and the answer matches the values', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      for (const q of signCards(d)) {
        const [a, b] = pair(q.prompt);
        expect(q.answer, q.prompt).toBe(sign(a, b));
        expect([...q.options].sort(), q.prompt).toEqual(['<', '=', '>']);
      }
    }
  });

  it('d1 and d2 never draw a sequence; d3 does', () => {
    for (const d of [1, 2] as Difficulty[]) expect(draws(d, 1080_100).some(q => q.sequence)).toBe(false);
    expect(draws(3, 1080_100).some(q => q.sequence)).toBe(true);
  });

  it('d1: 3-digit numbers only, never equal, half sharing a hundreds digit', () => {
    const cards = signCards(1).map(q => pair(q.prompt));
    for (const [a, b] of cards) { expect(a).toBeGreaterThanOrEqual(100); expect(b).toBeGreaterThanOrEqual(100); expect(a).not.toBe(b); }
    const share = cards.filter(([a, b]) => Math.floor(a / 100) === Math.floor(b / 100)).length / cards.length;
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.7);
  });

  it('d2 draws each named pair kind, as a share of the cards (a lucky pair cannot satisfy it)', () => {
    const cards = signCards(2).map(q => pair(q.prompt));
    const digits = (n: number) => String(n).split('').sort().join('');
    const share = (f: (a: number, b: number) => boolean) => cards.filter(([a, b]) => f(a, b)).length / cards.length;
    const reorder = (a: number, b: number) => a !== b && a >= 100 && b >= 100 && digits(a) === digits(b);
    expect(share(reorder), 'reordered digits').toBeGreaterThan(0.15);
    expect(share((a, b) => a !== b && !reorder(a, b) && Math.min(a, b) >= 100 && Math.floor(a / 100) === Math.floor(b / 100)), 'same hundreds, different digits').toBeGreaterThan(0.08);
    expect(share((a, b) => Math.min(a, b) < 100), '2-digit against 3-digit').toBeGreaterThan(0.1);
    expect(share((a, b) => Math.max(a, b) === 1000), '1,000').toBeGreaterThan(0.08);
    expect(share((a, b) => a === b), 'equal').toBeGreaterThan(0.08);
  });

  it('1,000 is printed with its comma, never bare', () => {
    const labels = draws(2, 1080_200).flatMap(q => [q.prompt, q.say ?? '']);
    expect(labels.some(l => l.includes('1,000'))).toBe(true);
    expect(labels.some(l => /(^|[^,\d])1000(?!\d)/.test(l))).toBe(false);
  });

  it('d3 ordering: the answer is the three numbers ascending, sharing a hundreds digit', () => {
    const cards = draws(3, 1080_300).filter(q => q.sequence);
    expect(cards.length).toBeGreaterThan(50);
    for (const q of cards) {
      const nums = q.sequence!.map(num);
      expect(nums, q.prompt).toHaveLength(3);
      expect(nums, q.prompt).toEqual([...nums].sort((x, y) => x - y));
      expect(new Set(nums).size, q.prompt).toBe(3);
      expect(new Set(nums.map(n => Math.floor(n / 100))).size, q.prompt).toBe(1);
      expect(q.answer).toBe(q.sequence!.join(','));
      expect([...q.options].sort()).toEqual([...q.sequence!].sort());
    }
  });
});
