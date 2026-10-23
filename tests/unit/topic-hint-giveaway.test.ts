import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// #2274: a hint that teaches is fine; one that names exactly one of the options leaves nothing to work out.
const NAMES: Record<string, string[]> = {
  ';': ['semicolon', 'semi-colon'], ':': ['colon'], '–': ['dash'], S: ['simile'], M: ['metaphor'], P: ['personification'],
};
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Marks, gap letters and numbers have no name in prose, so only words of four letters or more can be named.
const named = (hint: string, option: string) => (NAMES[option] ?? (option.length > 3 ? [esc(option)] : [])).some(n => new RegExp(`\\b${n}\\b`, 'i').test(hint));

describe('hints do not name the answer (#2274)', () => {
  for (const id of ['y6-clauses', 'y6-figurative', 'y4-determiners', 'y6-fdp']) {
    for (const d of [1, 2, 3] as Difficulty[]) {
      it(`${id} d${d}: no hint names exactly one option`, () => {
        const topic = TOPICS.find(t => t.id === id)!;
        for (let s = 0; s < 200; s++) {
          const q = topic.gen(d, rng(s));
          if (!q.hint) continue;
          const hits = q.options.filter(o => named(q.hint!, o));
          expect(hits.length, `${q.prompt} | ${q.hint}`).not.toBe(1);
        }
      });
    }
  }
  it('y6-figurative keeps the like/as hint at difficulty 1 only', () => {
    const topic = TOPICS.find(t => t.id === 'y6-figurative')!;
    for (let s = 0; s < 50; s++) {
      expect(topic.gen(1, rng(s)).hint).toBe('Is there a like or an as?');
      expect(topic.gen(2, rng(s)).hint).toBeUndefined();
    }
  });
  it('y4-determiners hints name no determiner and no possessive pronoun', () => {
    const topic = TOPICS.find(t => t.id === 'y4-determiners')!;
    for (const d of [1, 2] as Difficulty[]) {
      const hint = topic.gen(d, rng(1)).hint!;
      expect(hint).not.toMatch(/\b(this|my|mine|theirs)\b/i);
    }
  });
});
