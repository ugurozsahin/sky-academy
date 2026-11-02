// #2317 (y5-mentalmd family): each why shows the table fact or the swap, and agrees with the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 300 }, (_, s) => TOPICS.find(t => t.id === 'y5-mentalmd')!.gen(d, rngOf((s + 1) * 104729 + d)));
const num = (s: string) => parseInt(s.replace(/,/g, ''));

describe('y5-mentalmd whys (#2317)', () => {
  it('every question at every level has a why of at most 14 words', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) { expect(q.why, q.prompt).toBeTruthy(); expect(q.why!.split(' ').length, q.why).toBeLessThanOrEqual(14); }
  });
  const bare = (n: number) => { while (n >= 10 && n % 10 === 0) n /= 10; return n; };
  const promptNums = (s: string) => (s.match(/\d[\d,]*/g) ?? []).map(x => bare(num(x)));
  const FACT = /^(\d+) ([×÷]) (\d+) = (\d+), then (\d+) zeros? on$/;
  it('a table-fact why is true arithmetic, its zeros reach the answer, and its factors come from the prompt', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      if (q.why!.includes(' = ') && /^\d+ × \d+ = \d+ × \d+ = /.test(q.why!)) continue;
      const m = q.why!.match(FACT)!; expect(m, q.why).toBeTruthy();
      const [a, b, r, z] = [num(m[1]), num(m[3]), num(m[4]), num(m[5])];
      expect(m[2] === '×' ? a * b : a / b, q.why).toBe(r);
      expect(r * 10 ** z, q.why).toBe(num(q.answer as string));
      const seen = promptNums(q.prompt);
      expect(seen, `${q.prompt} / ${q.why}`).toContain(bare(a)); expect(seen, `${q.prompt} / ${q.why}`).toContain(bare(b));
    }
  });
  it('the double-and-halve why swaps the factors truthfully, uses the prompt operands and formats the product', () => {
    const swaps = draws(3).filter(q => /^\d+ × \d+ = \d+ × \d+ = /.test(q.why!));
    expect(swaps.length).toBeGreaterThan(0);
    for (const q of swaps) {
      const m = q.why!.match(/^(\d+) × (\d+) = (\d+) × (\d+) = ([\d,]+)$/)!; expect(m, q.why).toBeTruthy();
      expect(num(m[1]) * num(m[2]), q.why).toBe(num(m[3]) * num(m[4]));
      expect(num(m[5]), q.why).toBe(num(q.answer as string)); expect(m[5], q.why).toBe(q.answer);
      expect(promptNums(q.prompt), q.prompt).toEqual(expect.arrayContaining([bare(num(m[1])), bare(num(m[2]))]));
    }
  });
});
