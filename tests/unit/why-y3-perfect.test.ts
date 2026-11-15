// #2318 (y3-perfect): the why names the time word and the form it asks for, never the bare answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { PERFECT_D1, PERFECT_D2, PERFECT_D3_AUX, perfectWhy } from '../../src/curriculum/year3-perfect';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y3-perfect')!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y3-perfect says why (#2318)', () => {
  it('words each kind of row', () => {
    expect(perfectWhy(PERFECT_D1[0])).toBe('"yesterday" is a finished time, so use the past: "went".');
    expect(perfectWhy(PERFECT_D1[2])).toBe('"already" links to now, so use has or have: "has eaten".');
    expect(perfectWhy(PERFECT_D3_AUX[0])).toBe('After has or have, use "seen", not "saw".');
  });
  it('every row has a why that is not the bare answer', () => {
    for (const r of [...PERFECT_D1, ...PERFECT_D2, ...PERFECT_D3_AUX]) expect(perfectWhy(r).split(/\s+/).length).toBeLessThanOrEqual(14);
  });
  it('every draw has a short why', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(d)) { expect(q.why).toBeTruthy(); expect(q.why).not.toBe(q.answer); expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14); }
  });
});
