import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { TRICKY, trickyDecoys } from '../../src/curriculum/tricky-gaps';
import { AVOID, GAP_WORDS, Y1_CEW, Y2_CEW } from '../../src/curriculum/util';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const gen = (id: string) => TOPICS.find(t => t.id === id)!.gen;

describe('y1-spelling / y2-spelling gap the tricky letter (#2277)', () => {
  it('every table word is a listed exception word and has an in-range index', () => {
    for (const [w, [idx]] of Object.entries(TRICKY)) {
      expect([...Y1_CEW, ...Y2_CEW], w).toContain(w);
      expect(idx, w).toBeGreaterThanOrEqual(0);
      expect(idx, w).toBeLessThan(w.length);
    }
  });
  it('every word offers five candidate decoys, none the answer, none spelling another word', () => {
    for (const w of Object.keys(TRICKY)) {
      const [idx] = TRICKY[w];
      const ds = trickyDecoys(w);
      expect(ds, w).toHaveLength(5);
      for (const l of ds) {
        const s = w.slice(0, idx) + l + w.slice(idx + 1);
        expect(l, w).not.toBe(w[idx]);
        expect(GAP_WORDS.has(s) || AVOID.has(s), s).toBe(false);
      }
    }
  });
  it('the gap covers the tricky letter over 200 seeds at every difficulty', () => {
    for (const id of ['y1-spelling', 'y2-spelling']) for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(2277 + d);
      for (let i = 0; i < 200; i++) {
        const q = gen(id)(d, r);
        if (q.sequence) continue;   // the d3 spell-in-order card has no gap
        const shown = q.visual && 'text' in q.visual ? q.visual.text : '';
        const word = Object.keys(TRICKY).find(w => w.length === shown.length && shown.indexOf('_') === TRICKY[w][0] && [...shown].every((c, k) => c === '_' || c === w[k]));
        expect(word, `${id} d${d} ${shown}`).toBeDefined();
        expect(q.answer).toBe(word![TRICKY[word!][0]]);
      }
    }
  });
});
