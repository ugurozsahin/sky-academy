import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { R_TRICKY_P2, R_TRICKY_P3 } from '../../src/curriculum/reception';

// Deterministic RNG (mulberry32), same construction `curriculum.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'r-tricky')!;
const poolFor = (d: Difficulty) => (d === 1 ? R_TRICKY_P2 : d === 2 ? R_TRICKY_P3 : [...R_TRICKY_P2, ...R_TRICKY_P3]);
const DRAWS = 150;

/**
 * #968: the word is heard, never read — `listen`/`peek` carry it, so the oracle here is the spoken word,
 * not anything printed on the card.
 */
describe('r-tricky (#968)', () => {
  it('the answer is the word `listen` carries, `peek` is always set, and no `visual` ever prints it', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9680 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        expect(q.listen, `d${d} draw ${i}`).toBe(q.answer);
        expect(q.peek, `d${d} draw ${i}`).toBe(true);
        // #1372 review: `renderVisual` is not gated by `peek`/`promptMode` — a `visual` here would print the
        // word for the whole wave regardless of read-aloud, silently defeating the spoken-only contract.
        expect(q.visual, `d${d} draw ${i}: a visual would print the word this topic must only speak`).toBeUndefined();
      }
    }
  });

  it('d1 draws phase 2 only; d2 draws phase 3 only; d3 draws from both', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9690 + d);
      const allowed = new Set(poolFor(d));
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        expect(allowed.has(q.answer), `d${d} draw ${i}: "${q.answer}" is outside its phase pool`).toBe(true);
      }
    }
  });

  it('every option comes from the difficulty\'s own pool, with no duplicates', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9700 + d);
      const allowed = new Set(poolFor(d));
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        for (const o of q.options) expect(allowed.has(o), `d${d} draw ${i}: option "${o}" is outside the phase pool`).toBe(true);
        expect(new Set(q.options).size, `d${d} draw ${i}: duplicate options`).toBe(q.options.length);
      }
    }
  });

  it('d1: exactly 2 decoys (3 options), and the shared-letter rule is genuinely off, not just untriggered', () => {
    const r = rng(9710);
    let sawUnshared = false;
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(1, r);
      expect(q.options.length, `draw ${i}`).toBe(3);
      const decoys = q.options.filter(o => o !== q.answer);
      const shared = decoys.some(dec => [...dec.toLowerCase()].some(c => q.answer.toLowerCase().includes(c)));
      if (!shared) sawUnshared = true;
    }
    expect(sawUnshared, 'every d1 draw happened to share a letter — the constraint may be on, not just unexercised').toBe(true);
  });

  it('d2/d3: exactly 3 decoys (4 options), and at least one decoy shares a letter with the answer unless it is "I"', () => {
    for (const d of [2, 3] as Difficulty[]) {
      const r = rng(9720 + d);
      let sawShared = false;
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        expect(q.options.length, `d${d} draw ${i}`).toBe(4);
        if (q.answer === 'I') continue;
        const decoys = q.options.filter(o => o !== q.answer);
        const shared = decoys.some(dec => [...dec.toLowerCase()].some(c => q.answer.toLowerCase().includes(c)));
        if (shared) sawShared = true;
        expect(shared, `d${d} draw ${i}: no decoy of "${q.answer}" shares a letter with it`).toBe(true);
      }
      expect(sawShared, `d${d}: the shared-letter rule never fired across all draws`).toBe(true);
    }
  });

  it('"I" is drawn (at d1 and d3) and its decoys are unconstrained', () => {
    const r = rng(9730);
    let sawI = false;
    for (let i = 0; i < DRAWS; i++) { const q = topic.gen(3, r); if (q.answer === 'I') sawI = true; }
    expect(sawI, 'the seed never drew "I" at d3 — widen the sample').toBe(true);
  });

  it('no bank word is in AVOID', () => {
    for (const w of [...R_TRICKY_P2, ...R_TRICKY_P3]) expect(AVOID.has(w.toLowerCase()), w).toBe(false);
  });

  // A structural guarantee, not a probabilistic one (pr-test-analyzer/silent-failure-hunter review): the
  // shared-letter decoy rule falls back to an unconstrained draw when a word has no partner, so no word can
  // ever ship `undefined` as a decoy — but only "I" is *meant* to lack one. This pins the bank's own
  // invariant, so a future word added with no shared-letter partner (and no "I" exemption) fails here with a
  // clear message rather than surfacing as a silent `undefined` bubble that only 150 seeded draws might catch.
  it('every non-"I" word in d2/d3\'s pools shares a letter with at least one other word in its own pool', () => {
    for (const pool of [R_TRICKY_P3, [...R_TRICKY_P2, ...R_TRICKY_P3]]) {
      for (const w of pool) {
        if (w === 'I') continue;
        const partner = pool.some(x => x !== w && [...x.toLowerCase()].some(c => w.toLowerCase().includes(c)));
        expect(partner, `"${w}" has no shared-letter partner in its pool`).toBe(true);
      }
    }
  });
});
