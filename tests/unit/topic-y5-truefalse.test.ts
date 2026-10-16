import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { BANK } from '../../src/curriculum/year5-truefalse';
import { AVOID } from '../../src/curriculum/util';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-truefalse')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1231 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const text = (q: Question) => (q.visual as { text: string }).text;

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
const prime = (n: number) => n > 1 && Array.from({ length: n - 2 }, (_, i) => i + 2).every(k => n % k !== 0);

/** The statement's truth, recomputed from the numbers in its own text; `null` for a shape this oracle does not know. */
function truth(s: string): boolean | null {
  let m = s.match(/^(\d+) is a multiple of (\d+)\.$/); if (m) return Number(m[1]) % Number(m[2]) === 0;
  m = s.match(/^(\d+) is a factor of (\d+)\.$/); if (m) return Number(m[2]) % Number(m[1]) === 0;
  m = s.match(/^(\d+) is a prime number\.$/); if (m) return prime(Number(m[1]));
  m = s.match(/^(\d+) is a square number\.$/); if (m) return Number.isInteger(Math.sqrt(Number(m[1])));
  m = s.match(/^(\d+) is a cube number\.$/); if (m) return Math.round(Math.cbrt(Number(m[1]))) ** 3 === Number(m[1]);
  m = s.match(/^(\d+)² = (\d+)$/); if (m) return Number(m[1]) ** 2 === Number(m[2]);
  return null;
}

/** The d3 bank as a literal list, for review in the PR (#666): [text, truth]. */
const REVIEWED: [string, boolean][] = [
  ['The sum of two odd numbers is always even.', true],
  ['The sum of two even numbers is always even.', true],
  ['The product of two even numbers is always even.', true],
  ['Every multiple of 4 is also a multiple of 2.', true],
  ['Every multiple of 6 is also a multiple of 3.', true],
  ['A square number never ends in 7.', true],
  ['Every number that ends in 5 is a multiple of 5.', true],
  ['All prime numbers are odd.', false],
  ['Every odd number is a prime number.', false],
  ['The product of two odd numbers is always even.', false],
  ['The sum of two odd numbers is always odd.', false],
  ['Every multiple of 2 is also a multiple of 4.', false],
  ['Every multiple of 3 is also a multiple of 6.', false],
  ['Every square number is even.', false],
  ['Every number that ends in 3 is a multiple of 3.', false],
];
const EXCLUDE = new Set(['gay', 'queer', 'bitch', 'butt']);

describe('y5-truefalse (#1231)', () => {
  it('is a Year 5 maths topic in the calculation strand with a plain title', () => {
    expect([topic.year, topic.subject, topic.strand, topic.title]).toEqual(['year5', 'maths', 'calc', 'True or false?']);
  });

  it('oracle d1–d2: each statement\'s truth is recomputed from its numbers and matches the answer', () => {
    for (const d of [1, 2] as Difficulty[]) for (const c of draw(d, 2000)) {
      const t = truth(text(c));
      expect(t, text(c)).not.toBeNull();
      expect(c.answer, text(c)).toBe(t ? 'True' : 'False');
    }
  });

  it('d3 draws are exactly the reviewed bank, with the bank\'s truth', () => {
    const seen = new Set<string>();
    for (const c of draw(3, 2000)) {
      const entry = REVIEWED.find(([s]) => s === text(c)); expect(entry, text(c)).toBeDefined();
      expect(c.answer).toBe(entry![1] ? 'True' : 'False'); seen.add(text(c));
    }
    expect(seen.size).toBe(REVIEWED.length);
  });

  it('the bank matches the reviewed list, entry for entry', () => {
    expect(BANK.map(e => [e.text, e.truth])).toEqual(REVIEWED);
  });

  it('oracle d3: every true claim holds over its whole range; every false one is broken by its stored counter-example', () => {
    for (const e of BANK) {
      if (e.truth) {
        for (let a = 1; a <= e.bound; a++) for (let b = 1; b <= (e.pairs ? e.bound : 1); b++) if (!e.claim(a, b)) throw new Error(`${e.text} fails at ${a}, ${b}`);
      } else {
        expect(e.counter, e.text).toBeDefined();
        expect(e.claim(e.counter![0], e.counter![1]), `${e.text} should break at ${e.counter}`).toBe(false);
      }
    }
  });

  it('no statement is "sometimes" true', () => {
    for (const e of BANK) expect(e.text.toLowerCase()).not.toMatch(/sometimes|can be|might|may be/);
  });

  it('between 40% and 60% of cards are true at each difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const cs = draw(d, 2000), share = cs.filter(c => c.answer === 'True').length / cs.length;
      expect(share, `d${d}`).toBeGreaterThan(0.4); expect(share, `d${d}`).toBeLessThan(0.6);
    }
  });

  it('numbers stay within the Year 5 ranges (multiples ≤144, primes ≤100, squares ≤144, cubes ≤125)', () => {
    for (const c of [...draw(1, 1000), ...draw(2, 1000)]) {
      const t = text(c), nums = (t.match(/\d+/g) ?? []).map(Number);
      if (/prime/.test(t)) expect(nums[0], t).toBeLessThanOrEqual(100);
      else if (/cube/.test(t)) expect(nums[0], t).toBeLessThanOrEqual(126);
      else if (/square/.test(t)) expect(nums[0], t).toBeLessThanOrEqual(145);
      else if (/²/.test(t)) expect(nums[0], t).toBeLessThanOrEqual(12);
      else for (const n of nums) expect(n, t).toBeLessThanOrEqual(145);
      expect(t).not.toMatch(/NaN|undefined|\.\d{5}/);
    }
    expect(PRIMES.every(p => prime(p))).toBe(true);
  });

  it('the statement sits in a sentence visual and is spoken; the prompt never carries it', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 300)) {
      expect(c.prompt).toBe('True or false?');
      expect(c.visual?.type).toBe('sentence');
      expect(c.say).toBe(`${(c.visual as { text: string }).text.replace(/(\d+)² = (\d+)/, '$1 squared equals $2')} True or false?`);
      expect([...c.options].sort()).toEqual(['False', 'True']);
      expect(c.wide).toBe(true);
    }
  });

  it('crude-word guard: no word of any template or bank entry is in AVOID or EXCLUDE', () => {
    const words = new Set<string>(REVIEWED.flatMap(([s]) => s.toLowerCase().match(/[a-z]+/g) ?? []));
    for (const d of [1, 2] as Difficulty[]) for (const c of draw(d, 300)) for (const w of text(c).toLowerCase().match(/[a-z]+/g) ?? []) words.add(w);
    for (const w of words) { expect(AVOID.has(w), w).toBe(false); expect(EXCLUDE.has(w), w).toBe(false); }
  });
});
