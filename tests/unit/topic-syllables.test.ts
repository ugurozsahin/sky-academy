import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { BEAT_WORDS } from '../../src/curriculum/syllables';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// The oracle, keyed by hand again here: word → beats. No syllable algorithm anywhere.
const KEYED: Record<string, number> = {
  cat: 1, dog: 1, sun: 1, fish: 1, tree: 1, ball: 1, cake: 1, star: 1, bee: 1, frog: 1,
  rabbit: 2, pencil: 2, monkey: 2, tiger: 2, apple: 2, spider: 2, candle: 2, rocket: 2, turtle: 2, penguin: 2,
  elephant: 3, banana: 3, octopus: 3, tomato: 3, butterfly: 3, umbrella: 3, dinosaur: 3, kangaroo: 3, potato: 3, crocodile: 3,
};
const DRAWS = 150;
const YEARS = [['r-syllables', 2, (d: Difficulty) => (d === 1 ? [1, 2] : [1, 2, 3])], ['y1-syllables', 3, (d: Difficulty) => (d === 3 ? [1, 2, 3, 4] : [1, 2, 3])]] as const;

describe('syllables (#974)', () => {
  it('the production bank is the keyed bank, with at least 8 words per beat count and no AVOID word', () => {
    expect(Object.fromEntries(BEAT_WORDS.map(w => [w[0], w[1]]))).toEqual(KEYED);
    for (const n of [1, 2, 3]) expect(BEAT_WORDS.filter(w => w[1] === n).length).toBeGreaterThanOrEqual(8);
    for (const [w] of BEAT_WORDS) expect(AVOID.has(w), w).toBe(false);
  });

  for (const [id, max, opts] of YEARS) {
    const topic = TOPICS.find(t => t.id === id)!;
    it(`${id}: answer is the keyed beat count, ≤ ${max}, option set is exact, word spoken and pictured`, () => {
      expect(topic.subject).toBe('writing');
      for (const d of [1, 2, 3] as Difficulty[]) {
        const r = rng(9740 + d + max);
        for (let i = 0; i < DRAWS; i++) {
          const q = topic.gen(d, r);
          const v = q.visual as { type: 'word'; text: string; emoji: string };
          expect(v.type).toBe('word');
          expect(v.emoji, `d${d} draw ${i}`).toBeTruthy();
          expect(q.answer, `d${d} draw ${i}: ${v.text}`).toBe(String(KEYED[v.text]));
          expect(Number(q.answer)).toBeLessThanOrEqual(max);
          if (id === 'y1-syllables' && d === 1) expect(Number(q.answer)).toBeLessThanOrEqual(2);
          expect([...q.options].sort(), `d${d} draw ${i}`).toEqual(opts(d).map(String));
          expect(q.prompt).toBe(`How many beats in ${v.text}?`);
          expect(q.say).toBe(`${v.text}. How many beats in ${v.text}?`);
        }
      }
    });
  }

  it('Reception never draws a 3-beat word; Year 1 d2 reaches all three counts', () => {
    const rec = TOPICS.find(t => t.id === 'r-syllables')!, y1 = TOPICS.find(t => t.id === 'y1-syllables')!;
    for (const d of [1, 2, 3] as Difficulty[]) { const r = rng(9750 + d); for (let i = 0; i < 400; i++) expect(rec.gen(d, r).answer).not.toBe('3'); }
    const r = rng(9760);
    expect(new Set(Array.from({ length: 400 }, () => y1.gen(2, r).answer))).toEqual(new Set(['1', '2', '3']));
  });
});
