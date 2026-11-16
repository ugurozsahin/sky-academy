// #2318 (y6-spellgap): every gap word has a short why that names the tricky part, never the bare word.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { GAP_BANK } from '../../src/curriculum/year6-spellgap';
import { GAP_WHY } from '../../src/curriculum/year6-spellgap-why';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(x => x.id === 'y6-spellgap')!.gen;

describe('y6-spellgap says why (#2318)', () => {
  it('every bank word has a why of 14 words or fewer, and no why is only the word', () => {
    for (const x of GAP_BANK) {
      const why = GAP_WHY[x.w];
      expect(why, x.w).toBeTruthy();
      expect(why.split(/\s+/).length, why).toBeLessThanOrEqual(14);
      expect(why.toLowerCase().replace(/[^a-z]/g, ''), x.w).not.toBe(x.w);
    }
  });
  it('names only real bank words', () => {
    const words = new Set(GAP_BANK.map(x => x.w));
    for (const w of Object.keys(GAP_WHY)) expect(words.has(w), w).toBe(true);
  });
  it('every draw carries the why of its own word', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let n = 0; n < 200; n++) {
      const q = gen(d, rngOf((n + 1) * 104729 + d));
      const x = GAP_BANK.find(b => q.say?.startsWith(`The word is ${b.w}.`));
      expect(x, q.prompt).toBeTruthy();
      expect(q.why).toBe(GAP_WHY[x!.w]);
    }
  });
});
