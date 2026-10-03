import { describe, expect, it } from 'vitest';
import { BELTS, beltFor, totalStarsOf } from '../../src/game/belts';
import { parentSummary } from '../../src/game/parents';
import { listedTopics, shownYears } from '../../src/curriculum';
import { load, reset } from '../../src/storage';

const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

describe('beltFor (#951)', () => {
  it('maps total stars to the eight pinned belts at every edge', () => {
    const table: [number, string][] = [[0, 'White'], [2, 'White'], [3, 'Yellow'], [9, 'Yellow'], [10, 'Orange'], [19, 'Orange'], [20, 'Green'], [34, 'Green'],
      [35, 'Blue'], [54, 'Blue'], [55, 'Purple'], [79, 'Purple'], [80, 'Brown'], [109, 'Brown'], [110, 'Black'], [261, 'Black']];
    for (const [stars, name] of table) expect(beltFor(stars).name, `${stars} stars`).toBe(name);
  });
  it('is monotonic from 0 to 261 and never leaves the ladder', () => {
    let prev = 0;
    for (let s = 0; s <= 261; s++) { const n = beltFor(s).n; expect(n).toBeGreaterThanOrEqual(prev); prev = n; }
    expect(prev).toBe(BELTS.length);
  });
  it('reads a negative or non-finite total as White', () => {
    expect(beltFor(-5).name).toBe('White');
    expect(beltFor(NaN).name).toBe('White');
  });
});

describe('totalStarsOf (#951)', () => {
  const topics = listedTopics();
  it('agrees with the dashboard star total on the same save', () => {
    reset();
    const save = { ...load(), progress: { [topics[0].id]: { stars: 3, best: 1, plays: 1 }, [topics[1].id]: { stars: 2, best: 1, plays: 1 } } };
    expect(totalStarsOf(save.progress, topics)).toBe(5);
    expect(totalStarsOf(save.progress, topics)).toBe(parentSummary(save, topics, shownYears(), 0).starsEarned);
    expect(parentSummary(save, topics, shownYears(), 0).belt).toBe(beltFor(5).name);
  });
  it('survives a corrupted progress (#95)', () => {
    for (const bad of [null, undefined, 'x', 7, [], [1, 2]]) expect(totalStarsOf(bad, topics)).toBe(0);
  });
});
