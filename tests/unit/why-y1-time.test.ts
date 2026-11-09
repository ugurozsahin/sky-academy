// #2317 (y1-time, y1-timewords): the why names the hand position, the faster or earlier one, or the unit, in 8 words or fewer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (id: string, d: Difficulty) => { const t = TOPICS.find(x => x.id === id)!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe('Year 1 time whys (#2317)', () => {
  it('y1-time: the long hand and the answer match the clock', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw('y1-time', d)) {
      const w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      const half = q.answer.startsWith('half');
      expect(w, q.answer).toBe(`Long hand on ${half ? 6 : 12}: ${q.answer}.`);
    }
  });
  it('y1-timewords: every why agrees with its answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw('y1-timewords', d)) {
      const w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      if (/in seconds/.test(q.prompt)) expect(w.endsWith(`takes ${q.answer}.`), w).toBe(true);
      else if (/earlier|later/.test(q.prompt)) { const other = q.options.find(o => o !== q.answer)!; expect(w.toLowerCase(), w).toBe(/earlier/.test(q.prompt) ? `${q.answer} comes before ${other}.` : `${other} comes before ${q.answer}.`); }
      else { const other = q.options.find(o => o !== q.answer)!; expect(w, w).toBe(`${q.answer} is ${/quicker/.test(q.prompt) ? 'quicker' : 'slower'} than ${other}.`); }
    }
  });
});
