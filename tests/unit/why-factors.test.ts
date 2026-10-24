// #2317: the factors, multiples and primes why agrees with its card — every sum it prints is true.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(x => x.id === id)!.gen(d, rngOf((s + 1) * 104729 + d)));
const isPrime = (k: number) => { if (k < 2) return false; for (let i = 2; i * i <= k; i++) if (k % i === 0) return false; return true; };

describe('the factors why is true of its card (#2317)', () => {
  it('y5-primes d1: the answer is prime and the why names its two factors', () => {
    for (const q of draws('y5-primes', 1)) { expect(isPrime(Number(q.answer))).toBe(true); expect(q.why).toBe(`${q.answer} has only two factors: 1 and ${q.answer}.`); }
  });
  it('y5-primes composite card: the product in the why is the answer', () => {
    const qs = draws('y5-primes', 2).filter(q => q.why?.includes('not prime'));
    expect(qs.length).toBeGreaterThan(10);
    for (const q of qs) { const [, a, b] = /= (\d+) × (\d+)/.exec(q.why!)!; expect(Number(a) * Number(b)).toBe(Number(q.answer)); expect(Number(a)).toBeGreaterThan(1); }
  });
  it('y5-primes d3: the primes the why lists are exactly the targets', () => {
    for (const q of draws('y5-primes', 3)) expect(q.why).toContain(`Only ${q.sequence!.slice().sort((a, b) => Number(a) - Number(b)).join(', ')} are prime`);
  });
  it('y5-factors d1 and y4-factorpairs: the multiplication in the why is true', () => {
    for (const [id, d] of [['y5-factors', 1], ['y4-factorpairs', 1], ['y4-factorpairs', 2], ['y4-factorpairs', 3]] as const) for (const q of draws(id, d)) {
      const m = /^(\d+) × (\d+)(?: × (\d+))? = (\d+)/.exec(q.why!);
      expect(m, `${id}: ${q.why}`).toBeTruthy();
      expect(Number(m![1]) * Number(m![2]), q.why).toBe(Number(m![4]));
    }
  });
  it('y6-factors: every card carries a why', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws('y6-factors', d)) expect(q.why).toBeTruthy();
  });
});
