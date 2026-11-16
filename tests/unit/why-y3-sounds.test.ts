// #2318 (y3-sounds): every bank word has a short why that names the spelling of the sound, never the bare word.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { OU_BANK, SOUNDS_WHY, Y_BANK } from '../../src/curriculum/year3-sounds';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = TOPICS.find(x => x.id === 'y3-sounds')!.gen;

describe('y3-sounds says why (#2318)', () => {
  it('every bank word has a why of 14 words or fewer that is not just the word', () => {
    for (const [w] of [...Y_BANK, ...OU_BANK]) {
      const why = SOUNDS_WHY[w];
      expect(why, w).toBeTruthy();
      expect(why.split(/\s+/).length, why).toBeLessThanOrEqual(14);
      expect(why.toLowerCase().replace(/[^a-z]/g, ''), w).not.toBe(w.toLowerCase());
    }
  });
  it('names only real bank words', () => {
    const words = new Set([...Y_BANK, ...OU_BANK].map(r => r[0]));
    for (const w of Object.keys(SOUNDS_WHY)) expect(words.has(w), w).toBe(true);
  });
  it('every draw carries the why for its answer and the right letters', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (let n = 0; n < 200; n++) {
      const q = gen(d, rngOf((n + 1) * 104729 + d));
      expect(q.why).toBe(SOUNDS_WHY[q.answer]);
      expect(q.why).toContain(Y_BANK.some(r => r[0] === q.answer) ? 'spelt y' : 'spelt ou');
    }
  });
});
