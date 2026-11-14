// #2318 (y5-able): the why gives the root you can hear, or says there is none, or the kept e; never the bare ending.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { ableWhy, ADJ_BANK, ADV_BANK, KEEP_E_BANK } from '../../src/curriculum/year5-able';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y5-able')!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y5-able says why (#2318)', () => {
  it('words the root, the missing root and the kept e', () => {
    expect(ableWhy('depend', 'able')).toBe('The root word is "depend", so it is dependable.');
    expect(ableWhy('reli', 'able')).toBe('The root word is "rely", so it is reliable.');
    expect(ableWhy('ador', 'ably')).toBe('The root word is "adore", so it is adorably.');
    expect(ableWhy('poss', 'ible')).toBe('There is no root word to hear, so it is possible.');
    expect(ableWhy('horr', 'ibly')).toBe('There is no root word to hear, so it is horribly.');
    expect(ableWhy('chang', 'eable')).toBe('The e stays after g, so it is changeable.');
    expect(ableWhy('notic', 'eable')).toBe('The e stays after c, so it is noticeable.');
  });
  it('gives every bank row a why that names its whole word', () => {
    for (const [stem, answer] of [...ADJ_BANK, ...ADV_BANK, ...KEEP_E_BANK]) expect(ableWhy(stem, answer)).toContain(`${stem}${answer}.`);
  });
  it('sets a short why on every question, never the bare ending', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(d)) {
      expect(q.why).toBeTruthy();
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
      expect(q.why).not.toBe(q.answer);
    }
  });
});
