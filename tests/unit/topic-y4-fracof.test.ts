import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { decoys } from '../../src/curriculum/year4-fracof';
import { sayIsSafe } from '../../src/curriculum/ks2say';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-fracof')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1144 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
/** The whole number a label shows: commas and a trailing unit dropped. */
const val = (s: string) => Number(s.replace(/,/g, '').replace(/ [a-z]+$/, ''));
const PLAIN = /^(\d+)\/(\d+) of ([\d,]+) = \?$/;
const STORY = /^.* ([\d,]+) (cm|m|ml|kg|litres)\b.* (\d+)\/(\d+) of (?:it|the water) .*$/;
const digits = (s: string) => s.replace(/[^0-9]/g, '');
const leadOf = (s: string) => digits(s)[0], unitsOf = (s: string) => digits(s).slice(-1);

/** Oracle: the card's own numbers recomputed (whole ÷ den × num; whole − that on a "left" story). */
function expected(prompt: string): number {
  const p = prompt.match(PLAIN);
  if (p) return val(p[3]) / Number(p[2]) * Number(p[1]);
  const s = prompt.match(STORY)!;
  const part = val(s[1]) / Number(s[4]) * Number(s[3]);
  return /How much is left\?/.test(prompt) ? val(s[1]) - part : part;
}

describe('y4-fracof (#1144)', () => {
  it('99/100 of 1,000 (answer 990) never gets a 4-digit decoy', () => {
    for (let s = 1; s <= 50; s++) { const ds = decoys(rng(s), 1000, 100, 99, 990); expect(ds).toHaveLength(3); ds.forEach(v => { expect(v).toBeLessThan(1000); expect(v).not.toBe(990); }); }
  });

  it('is registered for Year 4', () => { expect(topic.year).toBe('year4'); });

  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: the oracle holds; every answer and decoy is a whole number above 0 of at most 3 digits`, () => {
      for (const q of draw(d, 400)) {
        const a = val(q.answer);
        expect(a).toBe(expected(q.prompt));
        expect(Number.isInteger(a) && a > 0).toBe(true);
        expect(q.options).toContain(q.answer);
        expect(new Set(q.options).size).toBe(4);
        q.options.forEach(o => { const v = val(o); expect(Number.isInteger(v) && v > 0 && v < 1000).toBe(true); });
        expect(q.visual).toBeUndefined();
      }
    });

    it(`d${d}: speech has no raw fraction or unit code`, () => {
      for (const q of draw(d, 400)) { expect(q.say).toBeTruthy(); expect(sayIsSafe(q.say!)).toBe(true); expect(q.say).not.toMatch(/\d\/\d/); }
    });
  }

  it('d1 uses unit fractions to 144 only', () => {
    for (const q of draw(1, 400)) {
      const m = q.prompt.match(PLAIN)!;
      expect(m[1]).toBe('1'); expect(Number(m[2])).toBeGreaterThanOrEqual(2); expect(Number(m[2])).toBeLessThanOrEqual(12);
      expect(val(m[3])).toBeLessThanOrEqual(144);
    }
  });

  it('d2 uses non-unit fractions, denominators 3–12, to 144, and always offers the unit-fraction slip', () => {
    for (const q of draw(2, 400)) {
      const m = q.prompt.match(PLAIN)!;
      const n = Number(m[1]), den = Number(m[2]), w = val(m[3]);
      expect(n).toBeGreaterThan(1); expect(n).toBeLessThan(den); expect(den).toBeGreaterThanOrEqual(3); expect(den).toBeLessThanOrEqual(12);
      expect(w).toBeLessThanOrEqual(144);
      expect(q.options.map(val)).toContain(w / den);
    }
  });

  it('d3 is tenths/hundredths of an amount to 1,000, or a story; the slip is always offered; 1,000 carries its comma', () => {
    let tenths = 0, hundredths = 0, stories = 0, thousand = 0;
    for (const q of draw(3, 800)) {
      const p = q.prompt.match(PLAIN);
      if (p) {
        const n = Number(p[1]), den = Number(p[2]), w = val(p[3]);
        expect([10, 100]).toContain(den); expect(n).toBeGreaterThan(1); expect(w).toBeLessThanOrEqual(1000);
        expect(w % den).toBe(0); expect(q.options.map(val)).toContain(w / den);
        den === 10 ? tenths++ : hundredths++;
        if (w === 1000) { thousand++; expect(p[3]).toBe('1,000'); }
      } else {
        const s = q.prompt.match(STORY)!; stories++;
        expect(q.answer).toMatch(/ (cm|m|ml|kg|litres)$/);
        q.options.forEach(o => expect(o.endsWith(q.answer.replace(/^\S+ /, ' '))).toBe(true));
        expect(q.options.map(val)).toContain(val(s[1]) / Number(s[4]));
      }
    }
    expect(tenths).toBeGreaterThan(50); expect(hundredths).toBeGreaterThan(50); expect(stories).toBeGreaterThan(200); expect(thousand).toBeGreaterThan(0);
  });

  it('story bank: at least six templates appear, with both the part and what is left asked', () => {
    const seen = new Set<string>(); let left = 0, part = 0;
    for (const q of draw(3, 1500)) {
      if (PLAIN.test(q.prompt)) continue;
      seen.add(q.prompt.replace(/[\d,/]+/g, '#'));
      /left\?/.test(q.prompt) ? left++ : part++;
    }
    expect(new Set([...seen].map(s => s.split('. ')[0].replace(/ #? ?/g, ' ').split(' ').slice(0, 3).join(' '))).size).toBeGreaterThanOrEqual(6);
    expect(left).toBeGreaterThan(0); expect(part).toBeGreaterThan(0);
  });

  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: over 2,000 draws at most 30% of cards with answers ≥ 20 have a unique units digit or a unique leading digit`, () => {
      let big = 0, uu = 0, ul = 0;
      for (const q of draw(d, 2000)) {
        if (val(q.answer) < 20) continue;
        big++;
        const others = q.options.filter(o => o !== q.answer);
        if (!others.some(o => unitsOf(o) === unitsOf(q.answer))) uu++;
        if (!others.some(o => leadOf(o) === leadOf(q.answer))) ul++;
      }
      if (big > 0) { expect(uu / big).toBeLessThanOrEqual(0.3); expect(ul / big).toBeLessThanOrEqual(0.3); }
    });
  }
});
