// #2317 (y6-mental family): each why shows the step taken and agrees with the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y6-mental')!.gen(d, rngOf((s + 1) * 104729 + d)));
const num = (s: string) => parseInt(s.replace(/,/g, ''));

describe('y6-mental whys (#2317)', () => {
  it('every question at every level has a why of at most 14 words', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) { expect(q.why, q.prompt).toBeTruthy(); expect(q.why!.split(' ').length, q.why).toBeLessThanOrEqual(14); }
  });
  it('level 1 counts in ten thousands and reaches the answer', () => {
    for (const q of draws(1)) { const m = q.why!.match(/^([\d,]+) ([+−]) ([\d,]+) = ([\d,]+) ten thousands$/)!; expect(m, q.why).toBeTruthy(); expect(num(m[4]) * 10_000, q.why).toBe(num(q.answer as string)); expect(num(m[1]) + (m[2] === '+' ? 1 : -1) * num(m[3]), q.why).toBe(num(m[4])); }
  });
  it('level 2 gives the table fact, and the zeros put the answer right', () => {
    for (const q of draws(2)) { expect(q.why, q.prompt).toMatch(/^\d+ [×÷] \d+ = \d+, then (no zeros|\d+ zeros?) on$/); const z = q.why!.includes('no zeros') ? 0 : parseInt(q.why!.match(/then (\d+)/)![1]); const base = num(q.why!.match(/= (\d+),/)![1]); expect(base * 10 ** z, q.why).toBe(num(q.answer as string)); }
  });
  it('level 3 ends in the answer', () => {
    for (const q of draws(3)) expect(q.why!.endsWith(`= ${q.answer}`), q.why).toBe(true);
  });
});
