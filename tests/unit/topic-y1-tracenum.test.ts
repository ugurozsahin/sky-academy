import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

// Deterministic RNG (mulberry32), same construction `curriculum.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y1-tracenum')!;
const RANGE: Record<number, string> = { 1: '12345', 2: '06789', 3: '0123456789' };

/** #992: Y1 handwriting asks children to form digits 0-9; the answer is the single digit drawn on the card. */
describe('y1-tracenum (#992)', () => {
  it('is a tracing topic whose answer is the one digit shown, within the difficulty range', () => {
    expect(topic.input).toBe('tracing');
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9920 + d);
      for (let i = 0; i < 150; i++) {
        const q = topic.gen(d, r);
        expect(RANGE[d], `d${d} draw ${i}: ${q.answer}`).toContain(q.answer);
        expect(q.answer).toMatch(/^[0-9]$/);
        expect(q.options).toEqual([q.answer]);
        expect(q.visual).toEqual({ type: 'word', text: q.answer });
        expect(q.prompt).toBe(`Trace the number ${q.answer}`);
      }
    }
  });

  it('reaches all ten digits at d3', () => {
    const r = rng(9929);
    const seen = new Set<string>();
    for (let i = 0; i < 150; i++) seen.add(topic.gen(3, r).answer as string);
    expect([...seen].sort().join('')).toBe('0123456789');
  });
});
