import { describe, it, expect, vi, afterEach } from 'vitest';
import { R_WORD_POOLS, R_POOL_FLOOR, rPoolShortfalls } from '../../src/curriculum/reception';
import { spellQ, PHASE2 } from '../../src/curriculum/util';

// Deterministic RNG (mulberry32), same construction curriculum.test.ts uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/**
 * #134: a narrower Reception letter pool used to empty `rWords()` and throw a TypeError at an unlucky question
 * (`const [w, e] = pick(rng, [])`) in front of a child. The pools are now built once and named, a floor test
 * says which one shrank, and the draw falls back instead of destructuring `undefined`.
 */
describe('Reception word pools (#134)', () => {
  afterEach(() => { vi.doUnmock('../../src/curriculum/util'); vi.resetModules(); });

  it('every pool a Reception generator draws from holds at least the floor', () => {
    expect(R_POOL_FLOOR).toBe(12);
    expect(Object.keys(R_WORD_POOLS).length).toBe(5);   // the three pools and the two filtered sub-pools
    expect(rPoolShortfalls()).toEqual([]);
  });

  it('a pool below the floor is reported by name, with its size', () => {
    const five = [['cat', '🐱'], ['dog', '🐶'], ['sun', '☀️'], ['pig', '🐷'], ['cup', '🥤']];
    expect(rPoolShortfalls({ 'rWords(1): the narrow one': five, 'rWords(2): fine': [...five, ...five, ...five] }))
      .toEqual(['rWords(1): the narrow one has 5 words, needs 12']);
  });

  it('spellQ refuses to deal a card whose decoys cannot be found', () => {
    // 'cat' with a pool of c, a, t and one other letter has one decoy to give, and two are asked for.
    expect(() => spellQ(rng(1), 'cat', undefined, 2, ['c', 'a', 't', 'x'])).toThrow(/spellQ "cat": 1 decoy letters available, 2 needed/);
    expect(spellQ(rng(1), 'cat', undefined, 2, ['c', 'a', 't', 'x', 'y']).options.length).toBe(5);
  });

  // Five letters is the narrowing the issue names; two empties `rWords(1)` outright, the case the fallback is for.
  for (const keep of [5, 2]) it(`cutting PHASE2 to ${keep} letters fails the floor by pool name, and no Reception generator draws undefined`, async () => {
    vi.resetModules();
    vi.doMock('../../src/curriculum/util', async orig => {
      const real = await orig<typeof import('../../src/curriculum/util')>();
      return { ...real, PHASE2: PHASE2.slice(0, keep) };
    });
    const narrow = await import('../../src/curriculum/reception');
    const short = narrow.rPoolShortfalls();
    expect(short.length, 'the floor must see the narrowing').toBeGreaterThan(0);
    expect(short[0], 'and name the pool').toMatch(/^rWords\(1\): .* has \d+ words, needs 12$/);
    for (const id of ['r-sounds', 'r-build', 'r-read']) {
      const t = narrow.RECEPTION_TOPICS.find(x => x.id === id)!;
      for (const d of [1, 2, 3] as const) for (let i = 0; i < 200; i++) {
        const q = t.gen(d, rng(i + d));   // a thrown TypeError here is the frozen arena
        expect(q.answer, `${id} d${d}`).toBeTruthy();
      }
    }
  });
});
