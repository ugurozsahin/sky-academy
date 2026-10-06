// #1124: Tricky Facts — the deck is the least-secure list plus reversed pairs, every card meets the oracle.
import { describe, it, expect } from 'vitest';
import { TRICKY, trickyDeck, trickyOffer } from '../../src/game/tricky-facts';
import { leastSecure } from '../../src/fact-record';
import { seededRng } from '../../src/game/rng';
import type { Ks2Fact } from '../../src/save-records';

const bad = (day = '2026-10-01'): Ks2Fact => ({ right: 0, wrong: 2, slow: 0, last: 'ww', day });
const FACTS: Record<string, Ks2Fact> = { '9×6': bad(), '7×7': bad(), '12×8': bad('2026-09-30'), '3×4': { right: 3, wrong: 0, slow: 0, last: 'rrr' } };

describe('trickyDeck (#1124)', () => {
  it('is the least-secure facts plus their reversed pairs, a square once', () => {
    for (let s = 1; s <= 200; s++) {
      const deck = trickyDeck(FACTS, seededRng(s));
      expect(deck.map(d => d.q.fact).sort()).toEqual(['12×8', '6×9', '7×7', '8×12', '9×6'].sort());
      expect(deck.length).toBeLessThanOrEqual(16);
      for (const d of deck) expect(d.topic).toBe(TRICKY);
    }
  });
  it('caps at 8 lines, so at most 16 cards', () => {
    const many: Record<string, Ks2Fact> = {};
    for (let a = 2; a <= 12; a++) for (let b = 2; b <= 12; b++) many[`${a}×${b}`] = bad();
    expect(trickyDeck(many, seededRng(3)).length).toBeLessThanOrEqual(16);
    expect(leastSecure(many)).toHaveLength(8);
  });
  it('every card meets the oracle, with four distinct options and no decoy equal to the answer', () => {
    for (let s = 1; s <= 300; s++) for (const { q } of trickyDeck(FACTS, seededRng(s))) {
      const [a, b] = q.fact!.split('×').map(Number);
      expect(q.prompt).toBe(`${a} × ${b} = ?`);
      expect(q.answer).toBe(String(a * b));
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
    }
  });
  it('the fallback generator draws a valid 2–12 fact', () => {
    for (let s = 1; s <= 200; s++) {
      const q = TRICKY.gen(2, seededRng(s)), [a, b] = q.fact!.split('×').map(Number);
      expect(a).toBeGreaterThanOrEqual(2); expect(b).toBeLessThanOrEqual(12); expect(q.answer).toBe(String(a * b));
    }
  });
  it('is empty with no insecure fact', () => expect(trickyDeck({ '3×4': FACTS['3×4'] }, seededRng(1))).toEqual([]));
});

describe('trickyOffer (#1124)', () => {
  it('speaks only when a fact is insecure', () => {
    expect(trickyOffer(FACTS)).toBe("Sensei says: let's fix your tricky facts!");
    expect(trickyOffer({})).toBeNull();
    expect(trickyOffer({ '3×4': FACTS['3×4'] })).toBeNull();
  });
});
