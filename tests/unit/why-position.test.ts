// #2317 (y1-position, y2-position): the why names the way the arrow points, the turn's end, the right angles, or the animal's place in the row.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (id: string, d: Difficulty) => { const t = TOPICS.find(x => x.id === id)!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe.each(['y1-position', 'y2-position'])('%s why (#2317)', id => {
  it('every question has a short why', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(id, d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
    }
  });
});

describe('position why wording', () => {
  it('arrow questions say which arrow points which way', () => {
    for (const q of draw('y1-position', 1)) if (/^Which (way does|arrow points)/.test(q.prompt)) expect(q.why).toMatch(/^\S+ points (up|down|left|right)\.$/);
  });
  it('turn questions name where the turn ends', () => {
    for (const q of draw('y2-position', 2)) if (q.prompt.startsWith('Face') && q.prompt.endsWith('Which way now?')) expect(q.why).toMatch(/ faces (up|down|left|right)\.$/);
  });
  it('right-angle questions state the count', () => {
    for (const q of draw('y2-position', 2)) if (/right angle/.test(q.prompt)) expect(q.why).toMatch(/right angles? (is|are)|is \d right angles?/);
  });
});
