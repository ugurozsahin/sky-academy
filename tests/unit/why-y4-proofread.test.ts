// #2318 (y4-proofread): the why says what is wrong with the shown spelling and gives the right one.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { proofreadWhy } from '../../src/curriculum/year4-proofread';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, n) => TOPICS.find(x => x.id === 'y4-proofread')!.gen(d, rngOf((n + 1) * 104729 + d)));

describe('y4-proofread says why (#2318)', () => {
  it('every draw has a short why naming the right spelling, not the bare answer', () => {
    for (const d of [1, 2, 3] as const) for (const q of draws(d)) {
      expect(q.why).toBeTruthy(); expect(q.why).not.toBe(q.answer);
      expect(q.why).toContain(`"${q.spelt}"`); expect(q.why!.length).toBeLessThanOrEqual(70);
    }
  });
  it('names the kind of slip', () => {
    expect(proofreadWhy('pretty', 'prety')).toContain('missing a letter');
    expect(proofreadWhy('busy', 'bizzy')).toContain('extra letter');
    expect(proofreadWhy('height', 'hieght')).toContain('wrong letter');
  });
});
