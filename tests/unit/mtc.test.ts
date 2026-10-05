import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { mtcDeck, mtcScore, mtcArmDelay, MTC_PRACTICE, MTC_SIZE, mtcForm, mtcPractice, MTC_LIMITS, MTC_TABLES, KS1_TABLES, KS1_LIMIT } from '../../src/game/mtc';
import { Session } from '../../src/game/session';
import { MODES } from '../../src/game/modes';
import { YEARS } from '../../src/curriculum';
import { seededRng } from '../../src/game/rng';

const SEEDS = 2000;
const forms = Array.from({ length: SEEDS }, (_, s) => mtcForm(seededRng(s + 1)));
const countBy = (f: readonly { a: number; b: number }[], key: 'a' | 'b', t: number) => f.filter(i => i[key] === t).length;

describe('mtcForm (#1116)', () => {
  it('never throws and gives 25 items with both factors in 2–12', () => {
    for (const f of forms) {
      expect(f).toHaveLength(25);
      for (const { a, b } of f) { expect(a).toBeGreaterThanOrEqual(2); expect(a).toBeLessThanOrEqual(12); expect(b).toBeGreaterThanOrEqual(2); expect(b).toBeLessThanOrEqual(12); }
    }
  });
  it('keeps each first-factor table inside Table 1', () => {
    for (const f of forms) for (const t of MTC_TABLES) {
      const n = countBy(f, 'a', t);
      expect(n).toBeGreaterThanOrEqual(MTC_LIMITS[t].min);
      expect(n).toBeLessThanOrEqual(MTC_LIMITS[t].max);
    }
  });
  it('keeps KS1 at 3–7 and KS2 at 18–22', () => {
    for (const f of forms) {
      const ks1 = f.filter(i => (KS1_TABLES as readonly number[]).includes(i.a)).length;
      expect(ks1).toBeGreaterThanOrEqual(KS1_LIMIT.min);
      expect(ks1).toBeLessThanOrEqual(KS1_LIMIT.max);
      expect(25 - ks1).toBeGreaterThanOrEqual(18);
      expect(25 - ks1).toBeLessThanOrEqual(22);
    }
  });
  it('keeps each second factor within ±1 of Table 1 (footnote 5)', () => {
    for (const f of forms) for (const t of MTC_TABLES) {
      const n = countBy(f, 'b', t);
      expect(n).toBeGreaterThanOrEqual(Math.max(0, MTC_LIMITS[t].min - 1));
      expect(n).toBeLessThanOrEqual(MTC_LIMITS[t].max + 1);
    }
  });
  it('has no repeat and no reversal', () => {
    for (const f of forms) {
      const seen = new Set<string>();
      for (const { a, b } of f) {
        expect(seen.has(`${a}x${b}`)).toBe(false);
        expect(seen.has(`${b}x${a}`)).toBe(false);
        seen.add(`${a}x${b}`);
      }
    }
  });
  it('never includes the 1× table', () => {
    for (const f of forms) for (const { a, b } of f) { expect(a).not.toBe(1); expect(b).not.toBe(1); }
  });
  it('is deterministic for a seed', () => {
    for (const s of [1, 42, 977]) {
      expect(mtcForm(seededRng(s))).toEqual(mtcForm(seededRng(s)));
      expect(mtcPractice(seededRng(s))).toEqual(mtcPractice(seededRng(s)));
    }
    expect(new Set(forms.slice(0, 50).map(f => JSON.stringify(f))).size).toBeGreaterThan(40);
  });
  it('is shuffled, not ordered by table', () => {
    const sorted = forms.filter(f => f.every((it, i) => i === 0 || f[i - 1].a <= it.a));
    expect(sorted.length).toBeLessThan(5);
  });
  it('reaches all 121 items over the seeds', () => {
    const seen = new Set(forms.flat().map(i => `${i.a}x${i.b}`));
    expect(seen.size).toBe(121);
  });
});

describe('mtcPractice (#1116)', () => {
  it('gives three distinct 1 × n, n in 2–12', () => {
    for (let s = 1; s <= SEEDS; s++) {
      const p = mtcPractice(seededRng(s));
      expect(p).toHaveLength(3);
      expect(new Set(p.map(i => i.b)).size).toBe(3);
      for (const { a, b } of p) { expect(a).toBe(1); expect(b).toBeGreaterThanOrEqual(2); expect(b).toBeLessThanOrEqual(12); }
    }
  });
});

describe('src/game/mtc.ts imports (#1116)', () => {
  it('imports nothing from src/ui', () => {
    expect(readFileSync('src/game/mtc.ts', 'utf8')).not.toMatch(/from\s+['"][^'"]*\/ui\//);
  });
});

describe('Tables Check practice run (#1118)', () => {
  const deck = mtcDeck(seededRng(7));
  it('mtcDeck is 3 practice cards, then exactly mtcForm\'s 25 for the same seed, each with 4 distinct options holding the answer', () => {
    expect(deck).toHaveLength(MTC_PRACTICE + MTC_SIZE);
    expect(deck.slice(0, 3).map(d => d.q.prompt)).toEqual(mtcPractice(seededRng(7)).map(i => `1 × ${i.b} = ?`));
    // mtcForm draws after mtcPractice on the same stream, so replay both to get the same 25
    const rng = seededRng(7); mtcPractice(rng);
    expect(deck.slice(3).map(d => d.q.prompt)).toEqual(mtcForm(rng).map(i => `${i.a} × ${i.b} = ?`));
    for (const d of deck) { expect(new Set(d.q.options).size).toBe(4); expect(d.q.options).toContain(d.q.answer); expect(d.topic.id).toBe('y4-tables'); }
  });
  const miss = (i: number) => ({ q: deck[i].q });
  it('mtcScore ignores practice: 3 practice misses plus 5 check misses is 20 out of 25', () => {
    const r = mtcScore(deck, [0, 1, 2, 3, 7, 11, 15, 19].map(miss));
    expect(r.score).toBe(20);
    expect(r.missed.map(m => m.prompt)).toEqual([3, 7, 11, 15, 19].map(i => deck[i].q.prompt.replace(' = ?', '')));
    expect(r.missed[0].answer).toBe(deck[3].q.answer);
  });
  it('mtcScore: all 25 check cards missed is 0 out of 25 with all 25 facts listed', () => {
    const r = mtcScore(deck, deck.map((_, i) => miss(i)));
    expect(r.score).toBe(0);
    expect(r.missed).toHaveLength(25);
  });
  it('mtcArmDelay: no clock for deck indices 0–2, then the last launch', () => {
    expect([0, 1, 2].map(i => mtcArmDelay(i, 1500))).toEqual([null, null, null]);
    expect(mtcArmDelay(3, 1500)).toBe(1500);
  });
});

describe('Tables Check practice misses cap (#1118)', () => {
  it('keeps all 25 check misses (+3 practice) where other modes stop at 20', () => {
    let kept = -1;
    const noop = () => {};
    const ev = { onQuestion: noop, onCorrect: noop, onWrong: noop, onMiss: noop, onProgress: noop, onLives: noop, onStageClear: noop, onBoss: noop, onTime: noop, onEnd: (r: { misses: unknown[] }) => { kept = r.misses.length; } };
    const s = new Session({ mode: 'mtc', year: YEARS.find(y => y.id === 'year4')!, deck: mtcDeck(seededRng(3)) }, ev as never);
    s.start();
    for (let i = 0; i < 28; i++) { s.hit('nope'); s.advance(); }
    expect(MODES.mtc.missesCap).toBe(28);
    expect(kept).toBe(28);
  });
});
