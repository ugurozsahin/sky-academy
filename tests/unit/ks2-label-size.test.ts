import { describe, it, expect } from 'vitest';
import { TOPICS, isKs2 } from '../../src/curriculum';
import { bubbleRadius, LINE_BUDGET, LABEL_READABLE_FS, splitLabel } from '../../src/game/bubbles';
import { FREDOKA_700_ADVANCES } from './helpers/fredoka-700-advances';
import { labelEm, rLblProblem } from './helpers/r-lbl';

// Deterministic RNG (mulberry32), same construction `curriculum.test.ts`/`ks2-naming.test.ts` use.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const DRAWS = 150;

describe('R-LBL (#1046): every KS2 bubble label reads at 13px or above on a 390px phone', () => {
  // With no KS2 YearId defined yet (#1050+ adds the first), this set is empty and the sweep passes by having
  // nothing to check — the fixtures below carry the proof until a real KS2 topic lands (same idiom as
  // `ks2-naming.test.ts`'s own registry sweep).
  it('every KS2 registry row draws 150 questions at each difficulty with no unreadable label', () => {
    const ks2 = TOPICS.filter(t => isKs2(t.year));
    expect(ks2.length, 'no KS2 topics yet (#1050+) — this sweep is inert until one lands').toBe(0);
    for (const t of ks2) {
      for (const d of [1, 2, 3] as const) {
        const r = rng(1046_000 + d);
        for (let i = 0; i < DRAWS; i++) {
          const problem = rLblProblem(t.gen(d, r));
          expect(problem, `${t.id} d${d} draw ${i}`).toBeNull();
        }
      }
    }
  });

  // EYFS/KS1 topics are not checked (#1046 acceptance criteria) — they already ship words like "sunflower"
  // and "accommodate" would never appear at those years, but this pins the exemption itself.
  it('a non-KS2 year is never swept', () => {
    for (const y of ['reception', 'year1', 'year2'] as const) expect(isKs2(y)).toBe(false);
  });

  describe('labelEm: the committed Fredoka-700 advance table', () => {
    it('matches the issue\'s own fontTools measurements within 0.01 em', () => {
      expect(labelEm('perpendicular')).toBeCloseTo(6.33, 2);
      expect(labelEm('accommodate')).toBeCloseTo(6.34, 2);
      expect(labelEm('10,000,000')).toBeCloseTo(4.78, 2);
      expect(labelEm('MCMXCIX')).toBeCloseTo(4.497, 2);
      expect(labelEm('1,000,000')).toBeCloseTo(4.215, 2);
    });

    it('throws on a character missing from the table rather than counting it as zero width', () => {
      expect(() => labelEm('café')).toThrow(/no entry for/);
    });

    it('throws on an empty label rather than dividing to an infinite, maximally-readable size', () => {
      expect(() => labelEm('')).toThrow(/empty label/);
    });

    it('every table entry is a positive em width', () => {
      for (const [ch, em] of Object.entries(FREDOKA_700_ADVANCES)) expect(em, `"${ch}"`).toBeGreaterThan(0);
    });
  });

  describe('rLblProblem fixtures (#1046 acceptance criteria)', () => {
    const opts = (options: string[], wide?: boolean) => ({ options, wide });

    it('"perpendicular" fails even wide, on a plain 4-option card', () => {
      expect(rLblProblem(opts(['perpendicular', 'a', 'b', 'c'], true))).toMatch(/perpendicular.*put the term on the card/);
    });

    it('"10,000,000" fails plain (≤6 options) …', () => {
      expect(rLblProblem(opts(['10,000,000', 'a', 'b', 'c']))).toMatch(/10,000,000/);
    });

    it('… and passes wide with 4 options', () => {
      expect(rLblProblem(opts(['10,000,000', 'a', 'b', 'c'], true))).toBeNull();
    });

    it('"1,000,000" passes with 4 plain options …', () => {
      expect(rLblProblem(opts(['1,000,000', 'a', 'b', 'c']))).toBeNull();
    });

    it('… and fails with 7 (the crowded-wave 0.9× radius)', () => {
      expect(rLblProblem(opts(['1,000,000', 'a', 'b', 'c', 'd', 'e', 'f']))).toMatch(/1,000,000/);
    });

    it('"−15" and "3 1/4" both pass, plain', () => {
      expect(rLblProblem(opts(['−15', 'a', 'b', 'c']))).toBeNull();
      expect(rLblProblem(opts(['3 1/4', 'a', 'b', 'c']))).toBeNull();
    });

    it('a breakable label that still overflows both lines fails', () => {
      // "perpendicular shape" splits on the space, but even wrapped onto two lines at the hard floor it is
      // wider than its bubble — `fitLabelLines` reports 'overflow', which is also unreadable.
      const split = splitLabel('perpendicular shape');
      expect(split).not.toBeNull();
      expect(rLblProblem(opts(['perpendicular shape', 'a', 'b', 'c']))).toMatch(/perpendicular shape/);
    });
  });

  describe('regression: rLblProblem drives the real fitLabelLines, not a re-derived formula (review finding)', () => {
    const opts = (options: string[], wide?: boolean) => ({ options, wide });
    // A first cut of this rail computed `fs = LINE_BUDGET * r / em` directly instead of calling
    // `fitLabelLines`. That formula assumes a label always shrinks exactly down to the width budget, but
    // `fitLabel`'s real shrink loop starts from a fixed, length-bucketed size (`startFs`) and only ever
    // shrinks — it never grows past that bucket even when the width budget would allow a bigger size. A
    // label made of narrow characters (all descenders/ascenders like "i"/"l") is short in em-width but long
    // in character count, so it starts at the smallest bucket (0.4×r) regardless of how little room its
    // narrow glyphs actually need — and the naive formula, unaware of that ceiling, computed a far larger
    // "readable" size than the game would ever draw. Confirmed against the real code before pinning here:
    // at 7 options (r≈29.8) the naive formula gave ~23.9px for "illiilii" while `fitLabelLines` draws it at
    // 11.9px — genuinely unreadable and exactly the class of miss this rail exists to catch.
    it('a narrow 8-character label fails once the wave is crowded enough to shrink it under 13px', () => {
      expect(rLblProblem(opts(['illiilii', 'a', 'b', 'c']))).toBeNull();   // 4 options: still readable (13.3px)
      expect(rLblProblem(opts(['illiilii', 'a', 'b', 'c', 'd', 'e', 'f']))).toMatch(/illiilii/);   // 7: 11.9px
    });

    // The same gap, on the two-line wrap path: the naive formula measured a split label's wider half against
    // `LINE_BUDGET` (1.75), but `fitLabelLines`'s real wrap branch seeds from the longer half's own
    // length-bucketed `fitLabel` size (capped at `WRAP_MAX_FS × r`) and only shrinks from there — a
    // different, generally smaller, ceiling. "mmm iiiiiiii" splits on its space; the naive wider-half
    // estimate gave ~22.0px at 7 options where `fitLabelLines` draws it at 11.9px.
    it('a wrapped label with a narrow-character half fails at the same crowded threshold', () => {
      expect(rLblProblem(opts(['mmm iiiiiiii', 'a', 'b', 'c']))).toBeNull();   // 4 options: 13.3px
      expect(rLblProblem(opts(['mmm iiiiiiii', 'a', 'b', 'c', 'd', 'e', 'f']))).toMatch(/mmm iiiiiiii/);   // 7: 11.9px
    });
  });

  describe('regression: the real wave can carry one more bubble than the card has options (review finding, round 2)', () => {
    const opts = (options: string[], extra?: { wide?: boolean; sequence?: unknown[] }) => ({ options, ...extra });
    // Villain modes (Sky Storm, Boss Battle — `deps.villain` in `src/ui/play-session.ts`) mix a 💣 bubble into
    // a non-sequence card's wave every third question past the fourth, with no key-stage gate. So the real
    // wave a 6-option KS2 card can face carries 7 labels, and an 8-option card can face 9 — one crowding
    // bucket narrower than the card's own option count alone predicts. `rLblProblem` used to key its radius
    // on `q.options.length` only, so a card at exactly the 6- or 8-option boundary could be certified
    // readable while the real bomb-carrying wave draws it smaller.
    it('a 6-option card at the bomb-shifted 6→7 boundary: readable by option count alone, not with the bomb folded in', () => {
      const six = ['1,000,000', 'a', 'b', 'c', 'd', 'e'];
      expect(rLblProblem(opts(six))).toMatch(/1,000,000/);                 // real wave: 7 labels, 11.9px — fails
      expect(rLblProblem(opts(six, { sequence: ['1'] }))).toBeNull();      // a sequence card never sees a bomb — 6 labels, 13.3px — passes
    });

    it('an 8-option card at the bomb-shifted 8→9 boundary: readable by option count alone, not with the bomb folded in', () => {
      const eight = ['500,000', 'a', 'b', 'c', 'd', 'e', 'f', 'g'];
      expect(rLblProblem(opts(eight))).toMatch(/500,000/);                 // real wave: 9 labels, 12.3px — fails
      expect(rLblProblem(opts(eight, { sequence: ['1'] }))).toBeNull();    // exempt: 8 labels, 13.9px — passes
    });
  });

  describe('the sizing rule itself, against the issue\'s own worked numbers', () => {
    it('matches the phone radius (33.15px) and wide radius (41.4px) the issue measured against', () => {
      expect(bubbleRadius(390, 664, false)).toBeCloseTo(33.15, 1);
      expect(bubbleRadius(390, 664, true)).toBeCloseTo(41.4, 1);
    });

    it('D3: a label is readable up to ~4.46 em plain, ~5.57 em wide, at ≤6 options', () => {
      const rPlain = bubbleRadius(390, 664, false), rWide = bubbleRadius(390, 664, true);
      expect((LINE_BUDGET * rPlain) / LABEL_READABLE_FS).toBeCloseTo(4.46, 1);
      expect((LINE_BUDGET * rWide) / LABEL_READABLE_FS).toBeCloseTo(5.57, 1);
    });
  });
});
