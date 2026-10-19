import { describe, it, expect } from 'vitest';
import { topicsFor } from '../../src/curriculum';
import { HOMOPHONES, HOMOPHONE_SETS } from '../../src/curriculum/year2';

/**
 * #324 item 7. Two claims the Year 2 generators make that nothing held:
 *  - `y2Fractions` says `1/2` sits second in its decoy list so `wordQ`'s first-three slice keeps it on the 1/4,
 *    1/3 and 3/4 cards; a reorder of `ds` dropped it with every rail green.
 *  - rail 3 in `curriculum.test.ts` matched a homophone row to its set as a subset, so a one-option row passed.
 * Prove it red: move `'1/2'` to the end of `ds` in `year2/number.ts`; or cut a `HOMOPHONES` row to one option.
 */
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

describe('Year 2 generators keep what their comments claim (#324 item 7)', () => {
  it('y2-fractions: 1/2 is offered on every 1/3, 1/4 and 3/4 shaded card', () => {
    const t = topicsFor('year2').find(x => x.id === 'y2-fractions')!;
    const r = rng(324);
    const seen = new Map<string, number>();
    for (let i = 0; i < 900; i++) {
      const q = t.gen(3, r);
      if (!q.prompt.startsWith('What fraction') || !['1/3', '1/4', '3/4'].includes(q.answer)) continue;
      seen.set(q.answer, (seen.get(q.answer) ?? 0) + 1);
      expect(q.options, `${q.answer}: 1/2 is the misconception this card must offer`).toContain('1/2');
    }
    expect([...seen.keys()].sort(), 'all three answers must be drawn, or the loop proves nothing').toEqual(['1/3', '1/4', '3/4']);
  });

  it('y2-homophones: every row offers its whole homophone set, not a part of it', () => {
    expect(HOMOPHONES.length).toBeGreaterThan(10);
    for (const [sent, opts] of HOMOPHONES) {
      const lower = opts.map(o => o.toLowerCase());
      const set = HOMOPHONE_SETS.find(s => lower.every(o => s.includes(o)));
      expect(set, `${sent}: ${opts.join('/')} is not a homophone set`).toBeDefined();
      expect(lower.length, `${sent}: ${opts.join('/')} offers part of ${set?.join('/')}`).toBe(set!.length);
    }
  });
});
