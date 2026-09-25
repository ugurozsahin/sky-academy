import { describe, expect, it } from 'vitest';
import { gentleRelaunchSet } from '../../src/game/gentleRelaunch';
import { rngFor } from './sim/harness';

describe('gentleRelaunchSet (#742): the answer bubble never comes back alone', () => {
  it('returns just the target when no decoy fell', () => {
    expect(gentleRelaunchSet('answer', [], rngFor(1))).toEqual(['answer']);
  });

  it('always includes the target, whatever the seed', () => {
    for (let seed = 0; seed < 50; seed++) expect(gentleRelaunchSet('answer', ['a', 'b', 'c'], rngFor(seed))).toContain('answer');
  });

  it('brings at least one decoy along when at least one fell', () => {
    for (let seed = 0; seed < 50; seed++) expect(gentleRelaunchSet('answer', ['a', 'b', 'c'], rngFor(seed)).length).toBeGreaterThanOrEqual(2);
  });

  it('can reach every decoy the wave had, and never more', () => {
    const sizes = new Set<number>();
    for (let seed = 0; seed < 50; seed++) sizes.add(gentleRelaunchSet('answer', ['a', 'b', 'c'], rngFor(seed)).length);
    expect(Math.max(...sizes)).toBe(4);         // the answer plus all three decoys
    expect(Math.min(...sizes)).toBe(2);          // the answer plus exactly one decoy
  });

  it('the set size varies — not a fixed count of decoys every time', () => {
    const sizes = new Set(Array.from({ length: 50 }, (_, seed) => gentleRelaunchSet('answer', ['a', 'b', 'c', 'd', 'e'], rngFor(seed)).length));
    expect(sizes.size, 'at least three different sizes across 50 seeds').toBeGreaterThanOrEqual(3);
  });

  it('never invents a decoy or drops one that was not a duplicate', () => {
    const set = gentleRelaunchSet('answer', ['a', 'b', 'c'], rngFor(7));
    for (const label of set) expect(['answer', 'a', 'b', 'c']).toContain(label);
    expect(new Set(set).size, 'no duplicates').toBe(set.length);
  });
});
