import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { isPrime } from '../../src/curriculum/year5-primes';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-primes')!;
const draw = (d: Difficulty, n = 2000) => { const r = rng(1186 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const PRIMES_TO_100 = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
const LOOK_PRIME = [1, 9, 15, 21, 27, 33, 39, 49, 51, 57, 63, 69, 77, 81, 87, 91, 93];
const isComposite = (x: number) => x > 1 && PRIMES_TO_100.indexOf(x) < 0;

describe('y5-primes (#1186)', () => {
  it('is registered for Year 5 maths and draws a sequence from d2', () => {
    expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.sequenceFrom).toBe(2);
  });

  it('isPrime agrees with the fixed list for 1–100', () => {
    for (let k = 1; k <= 100; k++) expect(isPrime(k), String(k)).toBe(PRIMES_TO_100.includes(k));
  });

  it('d1 answers a prime ≤ 19 among four distinct options, with 1, 9 or 15 as a decoy', () => {
    for (const q of draw(1)) {
      expect(PRIMES_TO_100.includes(Number(q.answer)) && Number(q.answer) <= 19, q.answer).toBe(true);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4);
      expect(q.options.filter(o => isPrime(Number(o)))).toEqual([q.answer]);
      expect(q.options.some(o => ['1', '9', '15'].includes(o))).toBe(true);
    }
  });

  it('d2 prime cards: six numbers, 2–4 primes as targets, a look-prime decoy, 1 never a target', () => {
    let cards = 0;
    for (const q of draw(2)) {
      if (!q.anyOrder) continue;
      cards++;
      expect(q.prompt).toBe('Slice every prime number');
      const targets = q.sequence!;
      expect(q.options).toHaveLength(6); expect(new Set(q.options).size).toBe(6);
      expect(targets.length).toBeGreaterThanOrEqual(2); expect(targets.length).toBeLessThanOrEqual(4);
      for (const o of q.options) { expect(isPrime(Number(o)), o).toBe(targets.includes(o)); expect(Number(o)).toBeLessThanOrEqual(100); }
      expect(targets).not.toContain('1');
      expect(q.options.some(o => LOOK_PRIME.includes(Number(o)) && !targets.includes(o)), q.options.join()).toBe(true);
    }
    expect(cards).toBeGreaterThan(800);
  });

  it('d2 composite cards: one odd composite not ending in 5, three primes, one prime sharing its last digit', () => {
    let cards = 0;
    for (const q of draw(2)) {
      if (q.anyOrder) continue;
      cards++;
      const c = Number(q.answer);
      expect(q.prompt).toBe('Which number is composite?');
      expect(isComposite(c)).toBe(true); expect(c % 2).toBe(1); expect(c % 5).not.toBe(0);
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4);
      const others = q.options.filter(o => o !== q.answer).map(Number);
      expect(others.every(isPrime)).toBe(true);
      expect(others.some(p => p % 10 === c % 10)).toBe(true);
    }
    expect(cards).toBeGreaterThan(300);
  });

  it('d3 prime-factor cards: targets are exactly the prime factors shown, with a composite factor and a non-factor prime as decoys', () => {
    for (const q of draw(3)) {
      const n = Number(q.prompt.match(/^Slice every prime factor of (\d+)$/)![1]);
      expect(n).toBeLessThanOrEqual(100);
      expect(q.anyOrder).toBe(true); expect(q.options).toHaveLength(6); expect(new Set(q.options).size).toBe(6);
      const targets = q.sequence!;
      expect(targets.length).toBeGreaterThanOrEqual(2); expect(targets.length).toBeLessThanOrEqual(3);
      for (const o of q.options) expect(isPrime(Number(o)) && n % Number(o) === 0, `${q.prompt} ${o}`).toBe(targets.includes(o));
      const decoys = q.options.filter(o => !targets.includes(o)).map(Number);
      expect(decoys.some(x => isComposite(x)), q.prompt).toBe(true);
      expect(decoys.some(x => isPrime(x)), q.prompt).toBe(true);
    }
  });

  it('say carries no raw symbol and every bubble label is plain digits', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 300)) {
      expect(q.say ?? '').not.toMatch(/[×=]/);
      for (const o of q.options) expect(o).toMatch(/^\d+$/);
    }
  });
});
