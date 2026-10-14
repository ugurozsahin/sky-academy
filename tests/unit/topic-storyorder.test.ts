import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { STORIES } from '../../src/curriculum/story';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// The oracle, keyed by hand again here: the order of the pictures, event by event.
const KEYED = ['🥚🐣🐔', '🌱🌷💐', '🥚🐛🦋', '⛄☀️💧', '🌾🍞🥪', '☁️🌧️🌈', '🍽️🦷🛏️', '🥣🎂🎉'];
const DRAWS = 150;
const DECOYS = [0, 1, 2];

describe('story order (#975)', () => {
  it('the production bank is the keyed bank: 8+ stories of exactly three events, unique emoji, short sentences, no AVOID word', () => {
    expect(STORIES.map(s => s.map(e => e[1]).join(''))).toEqual(KEYED);
    expect(STORIES.length).toBeGreaterThanOrEqual(8);
    for (const s of STORIES) {
      expect(s).toHaveLength(3);
      expect(new Set(s.map(e => e[1])).size).toBe(3);
      for (const [sentence] of s) {
        expect(sentence.split(' ').length, sentence).toBeLessThanOrEqual(6);
        for (const w of sentence.toLowerCase().replace(/[.!?,]/g, '').split(' ')) expect(AVOID.has(w), w).toBe(false);
      }
    }
  });

  for (const [id, shown] of [['r-storyorder', (d: Difficulty) => d >= 1], ['y1-storyorder', (d: Difficulty) => d === 1]] as const) {
    const topic = TOPICS.find(t => t.id === id)!;
    it(`${id}: sequence is the keyed order, decoys are other stories' events, card shown or spoken per year`, () => {
      expect(topic.subject).toBe('writing');
      expect(topic.sequenceFrom).toBe(1);
      for (const d of [1, 2, 3] as Difficulty[]) {
        const r = rng(975 + d);
        for (let i = 0; i < DRAWS; i++) {
          const q = topic.gen(d, r);
          expect(KEYED, q.answer).toContain(q.answer);
          expect(q.sequence!.join('')).toBe(q.answer);
          expect(q.options).toHaveLength(3 + DECOYS[d - 1]);
          for (const e of q.sequence!) expect(q.options).toContain(e);
          for (const o of q.options) if (!q.sequence!.includes(o)) expect(q.answer.includes(o), `decoy ${o} is in the story`).toBe(false);
          if (shown(d)) { expect(q.visual).toMatchObject({ type: 'sentence' }); expect(q.listen).toBeUndefined(); }
          else { expect(q.listen).toBeTruthy(); expect(q.peek).toBe(true); }
        }
      }
    });
  }
});
