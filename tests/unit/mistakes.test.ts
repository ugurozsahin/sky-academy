import { describe, it, expect } from 'vitest';
import {
  placeValueShift, carrySlip, swappedDigits, neighbourFact, wrongOperation, signFlip, topsAndBottoms,
  decoysFor, fracDecoys, type NumCalc,
} from '../../src/curriculum/mistakes';
import { dec, fmt, type Dec } from '../../src/curriculum/ks2num';
import { nearby, ri, shuffle } from '../../src/curriculum/util';
import type { Generator, Rng } from '../../src/curriculum/types';
import { leakShares, inLeakScope } from './helpers/decoy-leak';

function rng(seed: number): Rng {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const label = (d: Dec) => fmt(d);
const numCalc = (a: number, b: number, answer: number, dp = 0): NumCalc => ({ a: dec(a, dp), b: dec(b, dp), answer: dec(answer, dp) });

describe('mistakes (#1058): misconception decoys', () => {
  describe('the seven rules, fixed cases', () => {
    it('47 × 6 = 282: place-value shift is ×10 and ÷10', () => {
      const vals = placeValueShift(dec(282, 0)).map(label);
      expect(vals).toContain('2,820');
      expect(vals).toContain('28.2');
    });
    it('47 × 6 = 282: swapped digits exchanges the tens and units, or the hundreds and tens', () => {
      const vals = swappedDigits(dec(282, 0)).map(label);
      expect(vals).toEqual(expect.arrayContaining(['228', '822']));
    });
    it('47 × 6 = 282: neighbouring table fact varies one factor by one', () => {
      const vals = neighbourFact(47, 6).map(label);
      expect(vals).toEqual(expect.arrayContaining(['329', '235', '288', '276']));
    });
    it('47 × 6: wrong operation reads it as 47 + 6', () => {
      expect(wrongOperation(dec(47, 0), dec(6, 0), 'mul').map(label)).toEqual(['53']);
    });
    it('19 + 6: wrong operation reads it as 19 − 6', () => {
      expect(wrongOperation(dec(19, 0), dec(6, 0), 'add').map(label)).toEqual(['13']);
    });
    it('348 − 129 = 219: a units-column borrow shows up, mishandled, as the tens column off by 10', () => {
      const vals = carrySlip(dec(348, 0), dec(129, 0), 'sub', dec(219, 0)).map(label);
      expect(vals).toEqual(expect.arrayContaining(['229', '209']));
    });
    it('123 + 456 = 579: carry slip is empty when no column carries', () => {
      expect(carrySlip(dec(123, 0), dec(456, 0), 'add', dec(579, 0))).toEqual([]);
    });
    it('sign flip on 219 gives −219', () => {
      expect(signFlip(dec(219, 0)).map(label)).toEqual(['−219']);
    });
    it('1/3 + 1/4 gives 2/7 (tops and bottoms, unreduced)', () => {
      const vals = topsAndBottoms({ n: 1, d: 3 }, { n: 1, d: 4 });
      expect(vals).toEqual([{ n: 2, d: 7 }]);
    });
    it('tops-and-bottoms is dropped on the degenerate case where it coincides with the true sum (0/5 + 0/3)', () => {
      expect(topsAndBottoms({ n: 0, d: 5 }, { n: 0, d: 3 })).toEqual([]);
    });
  });

  describe('decoysFor', () => {
    const val = (d: Dec) => d.v / 10 ** d.dp;
    const digits = (d: Dec) => label(d).replace(/[^0-9]/g, '');
    const lastOf = (s: string) => s[s.length - 1];

    it('never returns the answer, a duplicate, or a value out of range', () => {
      const r = rng(500);
      for (let i = 0; i < 300; i++) {
        const a = ri(r, 2, 900), b = ri(r, 2, 900);
        const calc = numCalc(a, b, a + b);
        const ds = decoysFor('add', calc, 3, r, { min: 0, max: 2000 });
        const vals = ds.map(val);
        expect(new Set(vals).size, `draw ${i}: duplicate among ${vals}`).toBe(vals.length);
        for (const v of vals) {
          expect(v, `draw ${i}: decoy equals the answer`).not.toBe(a + b);
          expect(v, `draw ${i}: decoy ${v} below range`).toBeGreaterThanOrEqual(0);
          expect(v, `draw ${i}: decoy ${v} above range`).toBeLessThanOrEqual(2000);
        }
      }
    });

    it('145 gets a ±10 fill (135 or 155) when no rule candidate already shares its last digit, never 144 or 146', () => {
      // n = 2 keeps the output to exactly the two guaranteed slots, so no nearby()-fallback noise (which is
      // legitimately allowed to land on 144/146) can be mistaken for the fill mechanism itself.
      const calc = numCalc(100, 45, 145);
      const r = rng(7);
      for (let i = 0; i < 50; i++) {
        const vals = decoysFor('add', calc, 2, r, { min: 130, max: 160 }).map(val);
        expect(vals).not.toContain(144);
        expect(vals).not.toContain(146);
        expect(vals.some(v => v === 135 || v === 155), `draw ${i}: no ±10 fill among ${vals}`).toBe(true);
      }
    });

    it('with step = 5, a leading-digit step fill of a multiple-of-5 answer never leaves the multiple-of-5 set', () => {
      // 55 is itself a multiple of 5; ±10 keeps the last digit but crosses into the 60s/40s (changing the
      // leading digit), so the step fill (±5, staying in the 50s) must supply the leading-digit guarantee.
      const calc = numCalc(0, 55, 55);
      const r = rng(11);
      for (let i = 0; i < 50; i++) {
        const vals = decoysFor('add', calc, 2, r, { min: 50, max: 100 }, 5).map(val);
        for (const v of vals) expect(v % 5, `${v} is not a multiple of 5`).toBe(0);
        expect(vals.some(v => Math.floor(v / 10) === 5), `draw ${i}: no leading-digit fill among ${vals}`).toBe(true);
      }
    });

    it('guarantees a decoy sharing the last printed digit, and one sharing the leading digit', () => {
      const r = rng(123);
      for (let i = 0; i < 300; i++) {
        const a = ri(r, 20, 8000), b = ri(r, 2, 12);
        const answer = a * b;
        const calc = numCalc(a, b, answer);
        const ds = decoysFor('mul', calc, 4, r, { min: 0, max: 100000 });
        const aDigits = digits(dec(answer, 0));
        const last = lastOf(aDigits), lead = aDigits[0];
        expect(ds.some(d => lastOf(digits(d)) === last), `draw ${i}: no decoy shares last digit`).toBe(true);
        expect(ds.some(d => digits(d)[0] === lead), `draw ${i}: no decoy shares leading digit`).toBe(true);
      }
    });
  });

  describe('fracDecoys', () => {
    it('never returns the true sum, always positive, always the right denominator family', () => {
      const r = rng(9);
      for (let i = 0; i < 100; i++) {
        const ds = fracDecoys({ n: 1, d: 3 }, { n: 1, d: 4 }, 3, r);
        for (const d of ds) { expect(d.n).toBeGreaterThan(0); expect(`${d.n}/${d.d}`).not.toBe('7/12'); }
      }
    });
  });

  describe('the KS2 distractor rule (leak limit), via leakShares', () => {
    it('inLeakScope: whole numbers below 20 are out of scope; 20+, and any money/decimal, are in scope', () => {
      expect(inLeakScope('19')).toBe(false);
      expect(inLeakScope('0')).toBe(false);
      expect(inLeakScope('20')).toBe(true);
      expect(inLeakScope('56')).toBe(true);
      expect(inLeakScope('132')).toBe(true);
      expect(inLeakScope('3.45')).toBe(true);
      expect(inLeakScope('£1.20')).toBe(true);
      expect(inLeakScope('8p')).toBe(true);
    });

    // A fixture generator whose decoys are ONLY neighbouring-table facts (no fill guarantee) — the
    // multiplication-table structure means a neighbour fact shares the product's units digit far more often
    // than chance, which is exactly the leak this rule exists to catch.
    const neighbourOnlyGen: Generator = (_d, r) => {
      const a = ri(r, 2, 12), b = ri(r, 2, 12);
      const answer = a * b;
      const decoys = shuffle(r, neighbourFact(a, b)).slice(0, 3).map(label);
      return { prompt: `${a} × ${b} = ?`, answer: label(dec(answer, 0)), options: shuffle(r, [label(dec(answer, 0)), ...decoys]) };
    };
    const misconceptionGen: Generator = (_d, r) => {
      const a = ri(r, 2, 12), b = ri(r, 2, 12);
      const answer = a * b;
      const calc = numCalc(a, b, answer);
      const decoys = decoysFor('mul', calc, 3, r, { min: 0, max: 200 }).map(label);
      return { prompt: `${a} × ${b} = ?`, answer: label(dec(answer, 0)), options: shuffle(r, [label(dec(answer, 0)), ...decoys]) };
    };
    it('2–12 × 2–12 products: neighbour-fact-only decoys leak the units digit above 0.6', () => {
      const { units, counted } = leakShares(neighbourOnlyGen, 2, 2000);
      expect(counted).toBeGreaterThan(200);
      expect(units).toBeGreaterThan(0.6);
    });
    it('2–12 × 2–12 products: decoysFor measures ≤ 0.30 on both digits', () => {
      const { units, leading } = leakShares(misconceptionGen, 2, 2000);
      expect(units).toBeLessThanOrEqual(0.30);
      expect(leading).toBeLessThanOrEqual(0.30);
    });

    // A fixture generator over 4-digit answers whose decoys come only from `nearby()` (the pre-#1058
    // behaviour) — proving the leak this rule closes, before showing `decoysFor` closes it.
    const nearbyOnlyGen: Generator = (_d, r) => {
      const answer = ri(r, 1000, 9999);
      const decoys = nearby(r, answer, 3, 0, 20000).map(v => label(dec(v, 0)));
      return { prompt: 'nearby-only fixture', answer: label(dec(answer, 0)), options: shuffle(r, [label(dec(answer, 0)), ...decoys]) };
    };
    const misconceptionAddGen: Generator = (_d, r) => {
      const a = ri(r, 500, 4999), b = ri(r, 500, 4999);
      const answer = a + b;
      const calc = numCalc(a, b, answer);
      const decoys = decoysFor('add', calc, 3, r, { min: 0, max: 20000 }).map(label);
      return { prompt: `${a} + ${b} = ?`, answer: label(dec(answer, 0)), options: shuffle(r, [label(dec(answer, 0)), ...decoys]) };
    };
    it('4-digit answers: nearby()-only decoys leak the units digit above 0.6', () => {
      const { units, counted } = leakShares(nearbyOnlyGen, 3, 2000);
      expect(counted).toBeGreaterThan(1900);
      expect(units).toBeGreaterThan(0.6);
    });
    it('4-digit answers: decoysFor measures ≤ 0.30 on both digits', () => {
      const { units, leading } = leakShares(misconceptionAddGen, 3, 2000);
      expect(units).toBeLessThanOrEqual(0.30);
      expect(leading).toBeLessThanOrEqual(0.30);
    });

    // Money additions (£0.05–£9.95) through decoysFor.
    const moneyGen: Generator = (_d, r) => {
      const a = ri(r, 5, 995), b = ri(r, 5, 995); // pence, 2dp Dec
      const answer = a + b;
      const calc = numCalc(a, b, answer, 2);
      const decoys = decoysFor('add', calc, 3, r, { min: 0, max: 2000 }).map(d => '£' + fmt(d, { fixedDp: 2 }));
      return { prompt: 'money fixture', answer: '£' + fmt(dec(answer, 2), { fixedDp: 2 }), options: shuffle(r, [`£${fmt(dec(answer, 2), { fixedDp: 2 })}`, ...decoys]) };
    };
    it('money additions £0.05–£9.95: decoysFor measures ≤ 0.30 on both digits', () => {
      const { units, leading } = leakShares(moneyGen, 1, 2000);
      expect(units).toBeLessThanOrEqual(0.30);
      expect(leading).toBeLessThanOrEqual(0.30);
    });
  });
});
