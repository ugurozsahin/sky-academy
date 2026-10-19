import { describe, it, expect } from 'vitest';
import type { Visual } from '../../src/curriculum';
import { POOL_CARDS } from './helpers/duel-cards';

// #677 (from #404 finding 4): the duel layout sweeps in `tests/e2e/duel.spec.ts` iterate `POOL_CARDS`, which
// `renderVisual()` builds from the real generators. That derivation covers every kind a duel can DEAL, but
// nothing made a NEW `Visual` variant a failure. This table is keyed over `Visual['type']`, so a variant with
// no entry is a `tsc` error here, and the test below fails if a 'swept' entry has no card in the sweep. A
// variant a duel genuinely cannot deal is declared 'unreachable' (with its reason in the PR), never silently.
// (`renderVisual`'s own `RENDERERS` map is already `{ [T in Visual['type']]: ... }`, so rendering is exhaustive.)
const DUEL: Record<Visual['type'], 'swept' | 'unreachable'> = {
  objects: 'swept', tenframe: 'swept', dots: 'swept', array: 'swept', coins: 'swept', clock: 'swept',
  fraction: 'swept', numberline: 'swept', scales: 'swept', chart: 'swept', symmetry: 'swept', geometry: 'swept',
  coords: 'swept', pie: 'swept', word: 'swept', sentence: 'swept', strip: 'swept',
};

describe('every Visual variant has a card in the duel sweep (#677)', () => {
  const dealt = new Set<string>(POOL_CARDS.map(c => c.kind));
  const types = Object.keys(DUEL) as Visual['type'][];
  it.each(types)('%s: swept, or declared unreachable', type => {
    if (DUEL[type] === 'swept') expect(dealt.has(type), `no POOL_CARDS card draws "${type}"`).toBe(true);
    else expect(dealt.has(type), `"${type}" is declared unreachable but a duel deals it`).toBe(false);
  });
});
