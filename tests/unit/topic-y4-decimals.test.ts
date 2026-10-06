import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-decimals')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1146 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };

const FRAC = /^(\d+)\/(\d+)$/, DEC = /^(\d+)\.(\d+)$/;
/** Exact value as [numerator, denominator]; decimals are read from their digits, never as floats. */
function value(s: string): [number, number] {
  const f = s.match(FRAC); if (f) return [Number(f[1]), Number(f[2])];
  const d = s.match(DEC)!; return [Number(d[1] + d[2]), 10 ** d[2].length];
}
const eq = (a: [number, number], b: [number, number]) => a[0] * b[1] === b[0] * a[1];
const promptLabel = (p: string) => p.replace(' = ?', '');
const dpOf = (s: string) => (DEC.test(s) ? s.split('.')[1].length : 0);
const digits = (s: string) => s.replace(/[^0-9]/g, '');
const SIMPLE = new Set(['1/4', '1/2', '3/4', '0.25', '0.5', '0.75']);

describe('y4-decimals (#1146)', () => {
  it('is registered for Year 4', () => { expect(topic.year).toBe('year4'); });

  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: the oracle holds by exact value in the card's direction, options are distinct and no decoy equals the answer`, () => {
      let toDec = 0, toFrac = 0;
      for (const q of draw(d, 400)) {
        const p = promptLabel(q.prompt);
        expect(eq(value(p), value(q.answer))).toBe(true);
        expect(q.options).toContain(q.answer);
        expect(new Set(q.options).size).toBe(4);
        q.options.filter(o => o !== q.answer).forEach(o => expect(eq(value(o), value(q.answer))).toBe(false));
        expect(q.visual).toBeUndefined();
        FRAC.test(p) ? toDec++ : toFrac++;
        // no float artefact, no stray exponent
        q.options.forEach(o => expect(o).toMatch(/^\d+(\.\d+)?$|^\d+\/\d+$/));
      }
      expect(toDec).toBeGreaterThan(100); expect(toFrac).toBeGreaterThan(100);
    });

    it(`d${d}: every decimal label on a card has the card's number of decimal places`, () => {
      for (const q of draw(d, 400)) {
        const labels = [promptLabel(q.prompt), ...q.options].filter(s => DEC.test(s));
        if (!labels.length) continue;
        const f = [promptLabel(q.prompt), q.answer].find(s => FRAC.test(s))!;
        const want = ['1/2'].includes(f) || /\/10$/.test(f) ? 1 : 2;
        const wantFixed = DEC.test(q.answer) ? dpOf(q.answer) : dpOf(promptLabel(q.prompt));
        expect(wantFixed).toBe(want);
        labels.forEach(l => expect(dpOf(l)).toBe(wantFixed));
      }
    });

    it(`d${d}: speech has no raw fraction`, () => {
      for (const q of draw(d, 400)) { expect(q.say).toBeTruthy(); expect(sayIsSafe(q.say!)).toBe(true); expect(q.say).not.toMatch(/\d\/\d/); }
    });
  }

  it('d1 is tenths 1/10 to 9/10; d2 is hundredths that are not whole tenths', () => {
    for (const q of draw(1, 400)) { const v = value(promptLabel(q.prompt)); expect(v[1]).toBe(10); expect(v[0]).toBeGreaterThanOrEqual(1); expect(v[0]).toBeLessThanOrEqual(9); }
    for (const q of draw(2, 400)) { const v = value(promptLabel(q.prompt)); expect(v[1]).toBe(100); expect(v[0] % 10).not.toBe(0); }
  });

  it('d3 mixes ¼ ½ ¾ with tenths beyond one', () => {
    let simple = 0, beyond = 0;
    for (const q of draw(3, 600)) { const p = promptLabel(q.prompt); const other = FRAC.test(p) ? p : q.answer; SIMPLE.has(other) || SIMPLE.has(p) ? simple++ : (beyond++, expect(value(DEC.test(p) ? p : q.answer)[0] / 10).toBeGreaterThan(1)); }
    expect(simple).toBeGreaterThan(100); expect(beyond).toBeGreaterThan(100);
  });

  it('every tenths and hundredths decimal-answer card offers the place-value shift and the whole-number slip', () => {
    for (const d of [1, 2] as Difficulty[]) {
      for (const q of draw(d, 400)) {
        if (!DEC.test(q.answer)) continue;
        const a = value(q.answer), opts = q.options.map(value);
        expect(opts.some(o => eq(o, [a[0] * 10, a[1]]))).toBe(true);
        expect(opts.some(o => eq(o, [a[0] + a[1], a[1]]))).toBe(true);
      }
    }
  });

  it('a fraction answer of tenths or hundredths shares its digits with at least two options', () => {
    for (const d of [1, 2] as Difficulty[]) {
      for (const q of draw(d, 400)) {
        if (!FRAC.test(q.answer)) continue;
        const num = (s: string) => digits(s.split('/')[0]).split('').sort().join('');
        expect(q.options.filter(o => num(o) === num(q.answer)).length).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('¼ ½ ¾ fraction answers stay 1/4, 1/2 or 3/4, in lowest terms', () => {
    let n = 0;
    for (const q of draw(3, 800)) if (FRAC.test(q.answer) && SIMPLE.has(promptLabel(q.prompt))) { n++; expect(['1/4', '1/2', '3/4']).toContain(q.answer); }
    expect(n).toBeGreaterThan(50);
  });

  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: over 2,000 draws at most 30% of decimal-answer cards have a unique last or leading digit`, () => {
      let n = 0, uLast = 0, uLead = 0;
      for (const q of draw(d, 2000)) {
        if (!DEC.test(q.answer)) continue;
        n++;
        const a = digits(q.answer), others = q.options.filter(o => o !== q.answer).map(digits);
        if (!others.some(o => o.slice(-1) === a.slice(-1))) uLast++;
        if (!others.some(o => o[0] === a[0])) uLead++;
      }
      expect(n).toBeGreaterThan(300);
      expect(uLast / n).toBeLessThanOrEqual(0.3); expect(uLead / n).toBeLessThanOrEqual(0.3);
    });
  }
});
