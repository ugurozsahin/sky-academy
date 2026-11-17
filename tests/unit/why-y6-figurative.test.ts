// #2318: y6-figurative says why: the test that makes the device that device.
import { describe, expect, it } from 'vitest';
import { BANK, HUMAN_ACTIONS, whyDevice } from '../../src/curriculum/year6-figurative';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(t => t.id === 'y6-figurative')!.gen;

describe('y6-figurative says why (#2318)', () => {
  it('every personification sentence holds a human action the why can quote', () => {
    for (const i of BANK.filter(x => x.device === 'personification')) {
      const w = whyDevice(i);
      expect(HUMAN_ACTIONS.some(v => w.includes(` ${v}:`)), i.text).toBe(true);
    }
  });
  it('every why fits 14 words and follows the sentence it was drawn for', () => {
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 200; s++) {
      const q = gen(d, rngOf(s));
      const item = BANK.find(i => i.text === (q.visual as { text: string }).text)!;
      expect(q.why).toBe(whyDevice(item));
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});
