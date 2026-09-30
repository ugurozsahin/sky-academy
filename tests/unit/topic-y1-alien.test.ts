import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID, GAP_WORDS } from '../../src/curriculum/util';
import { ALIEN_REAL, ALIEN_FAKE } from '../../src/curriculum/year1';
import { correctionLine } from '../../src/ui/hud';

// Deterministic RNG (mulberry32), same construction `curriculum.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y1-alien')!;
const DRAWS = 150;
const realWords = ALIEN_REAL.map(([w]) => w);
const fakeWords = ALIEN_FAKE.map(([w]) => w);

/**
 * #982: "Real or Alien?" decodes a *printed* word, the Phonics Screening Check's other half. Both banks are
 * hand-curated, never generated — a denylist check on a generated string cannot catch a genuine real word
 * slipping into the alien bank, so the banks themselves are checked here instead.
 */
describe('y1-alien (#982): Real or Alien?, both banks hand-curated', () => {
  it('REAL ∩ ALIEN = ∅', () => {
    const real = new Set(realWords);
    for (const w of fakeWords) expect(real.has(w), `"${w}" is in both banks`).toBe(false);
  });

  it('no ALIEN word is a real word: ALIEN ∩ (GAP_WORDS ∪ AVOID) = ∅', () => {
    for (const w of fakeWords) {
      expect(GAP_WORDS.has(w.toLowerCase()), `"${w}" is a real word (GAP_WORDS)`).toBe(false);
      expect(AVOID.has(w.toLowerCase()), `"${w}" is a denylisted word (AVOID)`).toBe(false);
    }
  });

  it('no REAL word is denylisted: REAL ∩ AVOID = ∅', () => {
    for (const w of realWords) expect(AVOID.has(w.toLowerCase()), `"${w}" is denylisted (AVOID)`).toBe(false);
  });

  /**
   * Four review rounds on this PR each found a genuine real word or taught-alternative-spelling
   * sound-alike in ALIEN_FAKE that GAP_WORDS/AVOID (curriculum vocabulary lists, not a dictionary)
   * could not catch: 'yow' (real interjection), 'thob' (echoes thawb/thobe), 'zue'/'zew' (decode via
   * taught ue/ew → /uː/ to "zoo"), 'yoe' (oe → /oʊ/ to "yo"), 'zow' (echoes "wow"/"zowie"), 'shund'
   * (sh+u+n+d → "shunned"), 'zute' (split-digraph u_e → homophone of "zoot"). Each was swapped out in
   * turn, but nothing stopped one of them being reinstated by a future edit — a hardcoded pin on the
   * exact words already found is the cheap alternative the round-4 review asked for.
   */
  it('a previously-fixed real word/sound-alike never returns to ALIEN_FAKE (#982)', () => {
    const RETIRED = ['yow', 'thob', 'zue', 'zew', 'yoe', 'zow', 'shund', 'zute', 'zeak', 'chun', 'mulk', 'phum', 'zade', 'chok'];
    for (const w of RETIRED) expect(fakeWords, `"${w}" was already fixed out of ALIEN_FAKE once`).not.toContain(w);
  });

  /**
   * #982 review round 5: a `RETIRED` pin (round 4) only ever catches a word already found once — it cannot
   * catch a *new* real word or taught-alternative-spelling sound-alike, which is exactly what 'zeak' (→
   * "Zeke") was. Five review rounds have each found a different instance that `GAP_WORDS`/`AVOID` (curriculum
   * vocabulary lists, not a dictionary or a phonics decoder) cannot catch. This pins the **whole bank**
   * instead, the same method `curriculum.test.ts` already uses for Reception's gap spellings and the y1
   * digraph bank: every entry in `fixtures/y1-alien-bank.txt` has been read once for this failure class, and
   * an addition, removal or edit to either bank shows up as a diff a person reads, rather than waiting for a
   * sixth round's eye. Round 6 found a seventh instance anyway ('chok' → taught `ch` + short `o` + `k`
   * decodes to "chock"), because the fixture only proves a word was *looked at*, not that this specific
   * failure mode was caught — so 'chok' joins `RETIRED` below the same way 'zeak' did.
   */
  it('every ALIEN_REAL/ALIEN_FAKE entry has been looked at for a real-word/sound-alike risk (#982)', () => {
    const expected = readFileSync(new URL('./fixtures/y1-alien-bank.txt', import.meta.url), 'utf8')
      .split('\n').map(l => l.trim()).filter(Boolean);
    expect(expected.length, 'the fixture is empty or unreadable, which would make this rail vacuous').toBeGreaterThan(80);
    const actual = [
      ...ALIEN_REAL.map(([w, p]) => `REAL ${p} ${w}`),
      ...ALIEN_FAKE.map(([w, p]) => `FAKE ${p} ${w}`),
    ].sort();
    const set = new Set(expected);
    const added = actual.filter(l => !set.has(l));
    const gone = expected.filter(l => !actual.includes(l));
    expect(added, 'a new/changed bank entry has not been checked for a real-word/sound-alike risk — read it, '
      + 'then update fixtures/y1-alien-bank.txt in the same commit').toEqual([]);
    expect(gone, 'a bank entry the fixture expects is gone; if that was the intent, update the fixture').toEqual([]);
  });

  it('every bank word is 6 letters or fewer', () => {
    for (const w of [...realWords, ...fakeWords]) expect(w.length, `"${w}" is longer than 6 letters`).toBeLessThanOrEqual(6);
  });

  it('each phase band (1/2/3) of each bank has at least 12 words', () => {
    for (const phase of [1, 2, 3] as const) {
      expect(ALIEN_REAL.filter(([, p]) => p === phase).length, `REAL phase ${phase}`).toBeGreaterThanOrEqual(12);
      expect(ALIEN_FAKE.filter(([, p]) => p === phase).length, `ALIEN phase ${phase}`).toBeGreaterThanOrEqual(12);
    }
  });

  it('d1: exactly one real option among 3, the rest alien, all drawn from the phase-1 banks', () => {
    const real1 = new Set(ALIEN_REAL.filter(([, p]) => p === 1).map(([w]) => w));
    const fake1 = new Set(ALIEN_FAKE.filter(([, p]) => p === 1).map(([w]) => w));
    const r = rng(9821);
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(1, r);
      expect(q.options.length, `draw ${i}`).toBe(3);
      expect(real1.has(q.answer), `draw ${i}: answer "${q.answer}" is not a phase-1 real word`).toBe(true);
      const decoys = q.options.filter(o => o !== q.answer);
      expect(decoys.length, `draw ${i}`).toBe(2);
      for (const o of decoys) expect(fake1.has(o), `draw ${i}: decoy "${o}" is not a phase-1 alien word`).toBe(true);
    }
  });

  it('d2: exactly one real option among 4, the rest alien, all drawn from the phase-2 banks', () => {
    const real2 = new Set(ALIEN_REAL.filter(([, p]) => p === 2).map(([w]) => w));
    const fake2 = new Set(ALIEN_FAKE.filter(([, p]) => p === 2).map(([w]) => w));
    const r = rng(9822);
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(2, r);
      expect(q.options.length, `draw ${i}`).toBe(4);
      expect(real2.has(q.answer), `draw ${i}: answer "${q.answer}" is not a phase-2 real word`).toBe(true);
      const decoys = q.options.filter(o => o !== q.answer);
      expect(decoys.length, `draw ${i}`).toBe(3);
      for (const o of decoys) expect(fake2.has(o), `draw ${i}: decoy "${o}" is not a phase-2 alien word`).toBe(true);
    }
  });

  it('d3: every card has 4 options from the phase-3 banks; both a "real" and an "alien" form appear', () => {
    const real3 = new Set(ALIEN_REAL.filter(([, p]) => p === 3).map(([w]) => w));
    const fake3 = new Set(ALIEN_FAKE.filter(([, p]) => p === 3).map(([w]) => w));
    const r = rng(9823);
    let sawRealCard = false, sawAlienCard = false;
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(3, r);
      expect(q.options.length, `draw ${i}`).toBe(4);
      const decoys = q.options.filter(o => o !== q.answer);
      expect(decoys.length, `draw ${i}`).toBe(3);
      if (real3.has(q.answer)) {
        sawRealCard = true;
        for (const o of decoys) expect(fake3.has(o), `draw ${i}: "real" card decoy "${o}" is not a phase-3 alien word`).toBe(true);
      } else {
        expect(fake3.has(q.answer), `draw ${i}: answer "${q.answer}" is neither a phase-3 real nor alien word`).toBe(true);
        sawAlienCard = true;
        for (const o of decoys) expect(real3.has(o), `draw ${i}: "alien" card decoy "${o}" is not a phase-3 real word`).toBe(true);
      }
    }
    expect(sawRealCard, 'no "real" card seen across all draws').toBe(true);
    expect(sawAlienCard, 'no "alien" card seen across all draws').toBe(true);
  });

  it('`say` is the instruction only — it never contains one of the card\'s own options', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9830 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const say = (q.say ?? '').toLowerCase();
        for (const o of q.options) expect(say, `d${d} draw ${i}: say "${q.say}" names option "${o}"`).not.toContain(o.toLowerCase());
      }
    }
  });

  it('👾 never appears on a bubble, only in the d3 alien prompt', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9840 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        for (const o of q.options) expect(o, `d${d} draw ${i}`).not.toContain('👾');
      }
    }
  });

  it('the correction line never speaks a word from this topic, real or alien (#893)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(9850 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        expect(correctionLine(q, 'y1-alien'), `d${d} draw ${i}`).toBeNull();
      }
    }
  });
});

// `y1-alien` is listed in `NO_REPEATED_SET` in `helpers/topic-lists.ts` (#982): `ALIEN_REAL` and `ALIEN_FAKE` are
// disjoint, so any option set has a fixed count of real vs alien members — 1 real + 2/3 alien at d1/d2 (only "real
// word" cards exist there), and either 1 real + 3 alien or 3 real + 1 alien at d3 (never both shapes for the same
// set, since the counts differ). The answer is always the set's unique minority-bank member, so a set can only ever
// recur with the one answer it was drawn with.
