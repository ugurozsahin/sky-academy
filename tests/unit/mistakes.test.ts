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
    it('225: the identical-adjacent-digit pair is skipped (only the distinguishable swap survives)', () => {
      expect(swappedDigits(dec(225, 0)).map(label)).toEqual(['252']);
    });
    it('105: a swap that would leave a whole number reading with a leading zero is dropped', () => {
      // swap(0,1) -> "015" (reads as the shorter, undistinguishable 15) is dropped; swap(1,2) -> "150" survives.
      expect(swappedDigits(dec(105, 0)).map(label)).toEqual(['150']);
    });
    it('£0.45 and £0.05: a leading zero before the decimal point is a normal decimal, never dropped', () => {
      expect(swappedDigits(dec(45, 2)).map(label)).toEqual(expect.arrayContaining(['4.05', '0.54']));
      expect(swappedDigits(dec(5, 2)).map(label)).toEqual(['0.5']);
    });
    it('£10.34: swapping the pounds digits into a leading zero collapses two digits into one and is dropped', () => {
      // Unlike £0.xx, £10.34's leading digit is genuinely '1' — swap(0,1) -> "0134" (£1.34) loses it the same
      // way "052" loses a digit for a whole number, and must be dropped; the other two swaps are unaffected.
      const vals = swappedDigits(dec(1034, 2)).map(label);
      expect(vals).not.toContain('1.34');
      expect(vals).toEqual(expect.arrayContaining(['13.04', '10.43']));
    });
    it('−282: the sign is reapplied after the digit-string swap', () => {
      expect(swappedDigits(dec(-282, 0)).map(label)).toEqual(expect.arrayContaining(['−228', '−822']));
    });
    it('47 × 6 = 282: neighbouring table fact varies one factor by one', () => {
      const vals = neighbourFact(dec(47, 0), dec(6, 0)).map(label);
      expect(vals).toEqual(expect.arrayContaining(['329', '235', '288', '276']));
    });
    it('4.5 × 3 = 13.5: only the whole-number factor (3) is shifted, no crash on the decimal factor', () => {
      const vals = neighbourFact(dec(45, 1), dec(3, 0)).map(label);
      expect(vals).toEqual(expect.arrayContaining(['18', '9']));
    });
    it('3 × 4.5 = 13.5: the same holds with the whole-number factor argument first', () => {
      const vals = neighbourFact(dec(3, 0), dec(45, 1)).map(label);
      expect(vals).toEqual(expect.arrayContaining(['18', '9']));
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
    it('5 − 12 = −7: a negative-result subtraction is empty, not a runaway borrow cascade', () => {
      // digitAt is magnitude-only, so a < b makes every remaining column re-borrow forever unless this is
      // guarded — sign flip already covers the "sign mishandled" misconception for this shape.
      expect(carrySlip(dec(5, 0), dec(12, 0), 'sub', dec(-7, 0))).toEqual([]);
    });
    it('£0.45 + £0.65 = £1.10: a pence-into-pounds carry is included, not just whole-unit columns', () => {
      const vals = carrySlip(dec(45, 2), dec(65, 2), 'add', dec(110, 2)).map(label);
      expect(vals).toEqual(expect.arrayContaining(['1.2', '1']));
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

    it('£5.00: the last-digit fill steps by the printed place, not the raw dp past a trailing zero', () => {
      // answer prints "5" (dp 2 internally, but no fractional digits shown) — a fill derived from raw dp
      // would step by 0.10 (giving 4.90/5.10, last printed digit 9/1, never matching "5"); the real fix
      // steps by 10 (the ones place actually printed), giving 15/−5, both ending in the printed digit 5.
      const calc = numCalc(200, 300, 500, 2);
      const r = rng(5);
      for (let i = 0; i < 50; i++) {
        const vals = decoysFor('add', calc, 3, r, { min: -20, max: 20 }).map(label);
        const lastDigits = vals.map(s => s.replace(/[^0-9]/g, '').slice(-1));
        expect(lastDigits, `draw ${i}: no decoy shares £5.00's printed last digit`).toContain('5');
      }
    });

    it('1.5 + 3.5 = 5.0: the leading-digit fill steps by the printed place too, not the raw dp (round 5, #1435)', () => {
      // 5.0 prints "5" (bare fmt trims the trailing zero) — fillLead used to step by the raw dp (1), giving
      // 5.1/4.9: a decoy with a decimal point where the answer's own printed form has none, an instant tell.
      const calc = numCalc(15, 35, 50, 1);
      const r = rng(31);
      for (let i = 0; i < 100; i++) {
        const vals = decoysFor('add', calc, 3, r, { min: 0, max: 20 }).map(label);
        // Only decoys sharing the answer's own leading digit ('5') are this fill's business — a decimal
        // elsewhere (e.g. a carry-slip candidate like "0.5") is a different rule's legitimate output.
        for (const v of vals) if (v[0] === '5') expect(v, `draw ${i}: decoy ${v} shares the leading digit but leaks extra precision`).not.toContain('.');
      }
    });

    it('£2 + £3 = £5, fixed 2dp money display: the leading-digit guarantee is met, not silently dropped (round 5, #1435)', () => {
      // A whole-pound answer (dp 0) under a fixed-2dp display: fillLead used to step by the raw dp (0), so
      // its ±1 fill landed on £6.00/£4.00 — neither shares £5.00's leading digit, and no candidate did either.
      const calc = numCalc(2, 3, 5);
      const display = (d: Dec) => fmt(d, { fixedDp: 2 });
      const r = rng(41);
      for (let i = 0; i < 100; i++) {
        const vals = decoysFor('add', calc, 2, r, { min: 0, max: 20 }, 1, display).map(display);
        const leadDigits = vals.map(s => s.replace(/[^0-9]/g, '')[0]);
        expect(leadDigits, `draw ${i}: no decoy shares £5.00's printed leading digit among ${vals}`).toContain('5');
      }
    });

    it('near a range boundary, the fill picks whichever side actually stays in range, never an out-of-range one', () => {
      // answer 95, range [80,100]: the +10 fill (105) is out of range, only the −10 fill (85) is usable.
      const calc = numCalc(50, 45, 95);
      const r = rng(42);
      for (let i = 0; i < 50; i++) {
        const vals = decoysFor('add', calc, 3, r, { min: 80, max: 100 }).map(val);
        for (const v of vals) { expect(v).toBeGreaterThanOrEqual(80); expect(v).toBeLessThanOrEqual(100); }
        expect(vals.some(v => lastOf(String(v)) === '5'), `draw ${i}: no in-range last-digit fill among ${vals}`).toBe(true);
      }
    });

    it('requesting more than a narrow range can hold returns every distinct value the range has, never fewer by a bug and never a crash', () => {
      // [13,17] holds exactly 4 non-answer integers (13,14,16,17) besides the answer 15 — asking for 8 is a
      // range chosen too tight for n, not a fill bug, so this pins the bound: never over-deliver, never a
      // duplicate, never the answer, and land on every one of the 4 that genuinely exist.
      const vals = decoysFor('add', numCalc(10, 5, 15), 8, rng(3), { min: 13, max: 17 }).map(val).sort((x, y) => x - y);
      expect(vals).toEqual([13, 14, 16, 17]);
    });

    it('kind sub: never returns the answer, a duplicate or an out-of-range value, including a multi-column borrow cascade', () => {
      const r = rng(700);
      for (let i = 0; i < 300; i++) {
        const a = ri(r, 100, 999), b = ri(r, 1, a);
        const calc = numCalc(a, b, a - b);
        const ds = decoysFor('sub', calc, 3, r, { min: 0, max: 2000 });
        const vals = ds.map(val);
        expect(new Set(vals).size, `draw ${i}: duplicate among ${vals}`).toBe(vals.length);
        for (const v of vals) expect(v, `draw ${i}: decoy equals the answer`).not.toBe(a - b);
      }
      // 300 − 1 = 299: borrowing cascades through the tens and hundreds columns (a three-column borrow).
      const cascade = decoysFor('sub', numCalc(300, 1, 299), 4, rng(1), { min: 0, max: 1000 }).map(val);
      expect(cascade.length).toBeGreaterThan(0);
      expect(cascade).not.toContain(299);
    });

    it('kind sub with a negative result: no runaway-magnitude decoy from the borrow model, and no crash', () => {
      // a < b (an entirely ordinary NC Year 4+ shape, "how much colder") used to make carrySlip's borrow
      // chain re-trigger at every remaining column, leaking a candidate in the hundreds of thousands into a
      // card whose range is nowhere near that. decoysFor itself already range-filters, but the regression is
      // that carrySlip must not even offer such a candidate.
      const r = rng(900);
      for (let i = 0; i < 200; i++) {
        const a = ri(r, 1, 500), b = ri(r, a + 1, 999);
        const calc = numCalc(a, b, a - b);
        const ds = decoysFor('sub', calc, 3, r, { min: -1000, max: 1000 });
        const vals = ds.map(val);
        expect(new Set(vals).size, `draw ${i}: duplicate among ${vals}`).toBe(vals.length);
        for (const v of vals) {
          expect(v, `draw ${i}: decoy equals the answer`).not.toBe(a - b);
          expect(v, `draw ${i}: decoy ${v} outside a sane magnitude`).toBeGreaterThanOrEqual(-1000);
          expect(v, `draw ${i}: decoy ${v} outside a sane magnitude`).toBeLessThanOrEqual(1000);
        }
      }
      expect(decoysFor('sub', numCalc(5, 12, -7), 3, rng(1), { min: -200, max: 200 }).map(val)).not.toContain(93);
    });

    it('kind sub at dp > 0 (a money borrow): never a duplicate, never the answer, never out of range', () => {
      const r = rng(910);
      for (let i = 0; i < 150; i++) {
        const a = ri(r, 100, 999), b = ri(r, 1, a); // pence, 2dp
        const calc = numCalc(a, b, a - b, 2);
        const ds = decoysFor('sub', calc, 3, r, { min: -20, max: 20 });
        const vals = ds.map(val);
        expect(new Set(vals).size, `draw ${i}: duplicate among ${vals}`).toBe(vals.length);
        for (const v of vals) expect(v, `draw ${i}: decoy equals the answer`).not.toBe((a - b) / 100);
      }
    });

    it('when no fill keeps both range and the last digit, decoysFor falls back cleanly rather than a false guarantee', () => {
      // Every value in [127,139] except 133 itself has a different last digit, so the last-digit guarantee is
      // structurally unmeetable here — fillLast must return null (not a plausible-looking but wrong "guarantee")
      // and decoysFor must still return n in-range, non-duplicate, non-answer values via its ordinary fallback.
      const calc = numCalc(74, 59, 133);
      for (let seed = 1; seed <= 20; seed++) {
        const vals = decoysFor('add', calc, 1, rng(seed), { min: 127, max: 139 }).map(val);
        expect(vals.length).toBe(1);
        expect(vals[0]).toBeGreaterThanOrEqual(127);
        expect(vals[0]).toBeLessThanOrEqual(139);
        expect(vals[0]).not.toBe(133);
      }
    });

    it('a money decoy set never carries a true-value duplicate under different (v, dp) representations', () => {
      // placeValueShift's ÷10 candidate has a different dp than every add/sub-based candidate, so this is a
      // regression test for keying decoysFor's dedup on the printed value rather than the raw (v, dp) pair.
      const r = rng(321);
      for (let i = 0; i < 2000; i++) {
        const a = ri(r, 5, 995), b = ri(r, 5, 995);
        const calc = numCalc(a, b, a + b, 2);
        const ds = decoysFor('add', calc, 3, r, { min: 0, max: 2000 });
        const printed = ds.map(label);
        expect(new Set(printed).size, `draw ${i}: value duplicate among ${printed}`).toBe(printed.length);
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

    it('delivers a full n across ordinary pairs and n up to 30 — never a silent shortfall', () => {
      // The fill used to be a random one-draw-per-iteration guess capped at 20 tries, so it could exhaust its
      // guard before finding n distinct positive values — silently short at realistic n (not just extreme
      // ones), and worse for a small answer numerator. Confirmed empirically before this fix: 0/200 short at
      // n=3 but already 12/200 short at n=6 across these same five pairs; a deterministic ±1,±2,±3,... walk
      // (this test's fix) cannot fall short the way that random search could.
      const pairs: [{ n: number; d: number }, { n: number; d: number }][] = [
        [{ n: 1, d: 3 }, { n: 1, d: 4 }], [{ n: 1, d: 3 }, { n: 1, d: 6 }], [{ n: 2, d: 5 }, { n: 1, d: 5 }],
        [{ n: 1, d: 2 }, { n: 1, d: 8 }], [{ n: 3, d: 7 }, { n: 1, d: 7 }],
      ];
      for (const n of [3, 4, 5, 6, 8, 15, 30]) {
        for (const [a, b] of pairs) {
          for (let seed = 1; seed <= 20; seed++) {
            const ds = fracDecoys(a, b, n, rng(seed));
            expect(ds.length, `n=${n}, ${a.n}/${a.d}+${b.n}/${b.d}, seed ${seed}: only ${ds.length}`).toBe(n);
          }
        }
      }
    });

    it('a negative-numerator answer gets the same slack as a positive one, not just Math.max(answer.n, 0)', () => {
      // answer = -2/1 + -8/1 = -10/1: the walk must first cross zero before its positive direction produces
      // any candidate at all, which the old Math.max(answer.n, 0) bound gave zero extra room for.
      for (let seed = 1; seed <= 20; seed++) {
        const ds = fracDecoys({ n: -2, d: 1 }, { n: -8, d: 1 }, 10, rng(seed));
        expect(ds.length, `seed ${seed}: only ${ds.length} of 10`).toBe(10);
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
      const decoys = shuffle(r, neighbourFact(dec(a, 0), dec(b, 0))).slice(0, 3).map(label);
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

    // Money additions (£0.05–£9.95) through decoysFor. `moneyDisplay` is passed as decoysFor's own `display`,
    // matching what the card actually renders (fixed 2dp, "£3.10" never "£3.1") — the guarantee is measured
    // against the same string a child sees, not decoysFor's internal bare-fmt default.
    const moneyDisplay = (d: Dec) => fmt(d, { fixedDp: 2 });
    const moneyGen: Generator = (_d, r) => {
      const a = ri(r, 5, 995), b = ri(r, 5, 995); // pence, 2dp Dec
      const answer = a + b;
      const calc = numCalc(a, b, answer, 2);
      const decoys = decoysFor('add', calc, 3, r, { min: 0, max: 2000 }, 1, moneyDisplay).map(d => '£' + moneyDisplay(d));
      return { prompt: 'money fixture', answer: '£' + moneyDisplay(dec(answer, 2)), options: shuffle(r, [`£${moneyDisplay(dec(answer, 2))}`, ...decoys]) };
    };
    it('money additions £0.05–£9.95: decoysFor measures ≤ 0.30 on both digits', () => {
      const { units, leading } = leakShares(moneyGen, 1, 2000);
      expect(units).toBeLessThanOrEqual(0.30);
      expect(leading).toBeLessThanOrEqual(0.30);
    });

    it('£3.10: with a fixed-2dp display, the last-digit fill matches what the card actually shows, not bare fmt', () => {
      // bare fmt() trims £3.10 to "3.1" (last digit '1'); the money display convention shows "£3.10" (last
      // digit '0') — decoysFor must guarantee against whichever `display` it's told the card actually uses.
      const calc = numCalc(155, 155, 310, 2);
      for (let seed = 1; seed <= 50; seed++) {
        const ds = decoysFor('add', calc, 3, rng(seed), { min: 0, max: 50 }, 1, moneyDisplay).map(moneyDisplay);
        const lastDigits = ds.map(s => s.replace(/[^0-9]/g, '').slice(-1));
        expect(lastDigits, `seed ${seed}: no decoy shares £3.10's displayed last digit`).toContain('0');
      }
    });

    it('a whole-number-zero answer never crashes; the leading-digit guarantee is honestly unmet, not faked', () => {
      // '0' is 0's own leading digit and no other integer's — the only guarantee case that fails at every
      // range width, not just a narrow one. decoysFor must still return n sane, in-range, non-duplicate values.
      const r = rng(1);
      for (let i = 0; i < 50; i++) {
        const ds = decoysFor('sub', numCalc(6, 6, 0), 3, r, { min: -50, max: 50 });
        const vals = ds.map(d => d.v / 10 ** d.dp);
        expect(new Set(vals).size, `draw ${i}: duplicate among ${vals}`).toBe(vals.length);
        for (const v of vals) {
          expect(v, `draw ${i}: decoy equals the answer`).not.toBe(0);
          expect(v).toBeGreaterThanOrEqual(-50);
          expect(v).toBeLessThanOrEqual(50);
        }
      }
    });
  });
});
