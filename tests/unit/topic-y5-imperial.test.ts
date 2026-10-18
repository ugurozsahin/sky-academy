import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { parseNum } from '../../src/curriculum/ks2num';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-imperial')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1204 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const val = (s: string) => { const n = parseNum(s)!; return n.v / 10 ** n.dp; };
// The test's own exact factors: the `to` unit per one `from` unit.
const EXACT: Record<string, number> = { 'in>cm': 2.54, 'foot>cm': 30.48, 'kg>lb': 2.2046, 'pint>ml': 568.26 };
const CONV = /^([\d,.]+) (in|foot|feet|kg|lb|cm|pint|pints|ml) is about \? (in|foot|feet|kg|lb|cm|pint|pints|ml)$/;
const base = (u: string) => (u === 'feet' ? 'foot' : u === 'pints' ? 'pint' : u);
const exactOf = (q: Question) => {
  const m = CONV.exec(q.prompt)!, from = base(m[2]), to = base(m[3]), src = val(m[1]);
  const f = EXACT[`${from}>${to}`] ?? 1 / EXACT[`${to}>${from}`];
  return src * f;
};
const UNITS = /\b(in|foot|feet|kg|lb|cm|pints?|ml)\b/g;

describe('y5-imperial (#1204)', () => {
  it('is registered for Year 5 maths in the measure strand', () => { expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.strand).toBe('measure'); });

  it('no decoy is more than 100x or less than 1/100 of the exact conversion (#1902)', () => {
    let seen = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 600)) {
      if (!CONV.test(q.prompt)) continue;
      seen++;
      const e = exactOf(q);
      for (const o of q.options) { expect(val(o), `${q.prompt} ${o}`).toBeLessThanOrEqual(100 * e); expect(val(o), `${q.prompt} ${o}`).toBeGreaterThanOrEqual(e / 100); }
    }
    expect(seen).toBeGreaterThan(100);
  });

  it('conversion cards: four distinct options, answer within 10 % of the exact value, every decoy at least 40 % away', () => {
    let seen = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      if (!CONV.test(q.prompt)) continue;
      seen++;
      expect(new Set(q.options).size, q.prompt).toBe(4); expect(q.options).toContain(q.answer);
      const e = exactOf(q);
      expect(Math.abs(val(q.answer) - e) / e, q.prompt).toBeLessThanOrEqual(0.1);
      for (const o of q.options.filter(o => o !== q.answer)) expect(Math.abs(val(o) - e) / e, `${q.prompt} ${o}`).toBeGreaterThanOrEqual(0.4);
      for (const o of q.options) {
        expect(val(o), `${q.prompt} ${o}`).toBeGreaterThan(0);
        const dp = parseNum(o)!.dp; expect(dp, o).toBeLessThanOrEqual(1);
        if (val(q.answer) >= 10) expect(dp, `${q.prompt} ${o}`).toBe(0);
      }
    }
    expect(seen).toBeGreaterThan(600);
  });

  it('d1 is one equivalence from 1; d2 scales it; d3 reverses it or compares', () => {
    for (const q of draw(1)) expect(q.prompt).toMatch(/^1 (in|foot|kg|pint) is about \? (cm|lb|ml)$/);
    for (const q of draw(2)) { const m = CONV.exec(q.prompt)!; expect(m, q.prompt).not.toBeNull(); expect(val(m[1])).toBeGreaterThanOrEqual(2); }
    const d3 = draw(3, 600);
    expect(d3.filter(q => CONV.test(q.prompt)).length).toBeGreaterThan(200);
    expect(d3.filter(q => /^Which is /.test(q.prompt)).length).toBeGreaterThan(150);
  });

  it('the school table: one inch is about 2.5 cm, a foot 30 cm, a kilogram 2.2 lb and a pint 570 ml', () => {
    const r = rng(7), first = (re: RegExp) => { for (let i = 0; i < 400; i++) { const q = topic.gen(1, r); if (re.test(q.prompt)) return q.answer; } return undefined; };
    expect(first(/^1 in /)).toBe('2.5'); expect(first(/^1 foot /)).toBe('30'); expect(first(/^1 kg /)).toBe('2.2'); expect(first(/^1 pint /)).toBe('570');
  });

  it('comparison: the named quantity is truly larger on the exact conversion, by at least 25 %', () => {
    const TO_METRIC: Record<string, number> = { in: 2.54, foot: 30.48, feet: 30.48, lb: 1 / 2.2046, pint: 568.26, pints: 568.26, cm: 1, kg: 1, ml: 1 };
    let seen = 0;
    for (const q of draw(3, 800)) {
      if (!/^Which is /.test(q.prompt)) continue;
      seen++;
      expect(q.options).toHaveLength(2); expect(q.options).toContain(q.answer);
      const [x, y] = q.options.map(o => { const m = /^([\d,]+) (\S+)$/.exec(o)!; return val(m[1]) * TO_METRIC[m[2]]; });
      const win = val(/^[\d,]+/.exec(q.answer)![0]) * TO_METRIC[/ (\S+)$/.exec(q.answer)![1]];
      expect(win, q.prompt + q.options).toBe(Math.max(x, y));
      expect(Math.max(x, y) / Math.min(x, y), q.options.join()).toBeGreaterThanOrEqual(1.25);
    }
    expect(seen).toBeGreaterThan(200);
  });

  it('only inches, feet, pounds and pints appear as imperial units, and speech is safe', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const all = [q.prompt, ...q.options].join(' ');
      for (const w of all.match(UNITS) ?? []) expect(['in', 'foot', 'feet', 'kg', 'lb', 'cm', 'pint', 'pints', 'ml']).toContain(w);
      expect(all).not.toMatch(/mile|stone|ounce|gallon|oz\b|yard/i);
      expect(sayIsSafe(q.say!), q.say).toBe(true);
    }
  });

  it('decoy digits: leak shares stay within 0.30 on both digits at every difficulty (#1058)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      // The two-option comparison cards ("Which is heavier?") have one decoy by design, so the digit rule is measured on the numeric cards.
      const numeric: typeof topic.gen = (lv, r) => { let q = topic.gen(lv, r); while (/^Which is /.test(q.prompt)) q = topic.gen(lv, r); return q; };
      const s = leakShares(numeric, d);
      expect(s.units, `d${d} last digit`).toBeLessThanOrEqual(0.3); expect(s.leading, `d${d} leading digit`).toBeLessThanOrEqual(0.3);
    }
  });
});
