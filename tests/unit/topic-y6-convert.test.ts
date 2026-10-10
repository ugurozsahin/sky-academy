import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { parseNum } from '../../src/curriculum/ks2num';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-convert')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1242 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
// The test's own table: small units per one big unit.
const F: Record<string, number> = { 'km>m': 1000, 'm>cm': 100, 'cm>mm': 10, 'kg>g': 1000, 'l>ml': 1000, 'h>min': 60, 'min>s': 60 };
/** Thousandths as an exact integer. */
const milli = (s: string) => { const n = parseNum(s)!; return n.v * 10 ** (3 - n.dp); };
const dp = (s: string) => parseNum(s)!.dp;
const SIMPLE = /^([\d,.]+) (\S+) = \? (\S+)$/;
const MILES = /^Use 5 miles = 8 km: ([\d,]+) (miles|km) is about \? (miles|km)$/;
const SUM = /^([\d,.]+) (km|kg|l) ([+−]) ([\d,]+) (m|g|ml) = \? (m|g|ml)$/;
const factor = (a: string, b: string) => F[`${a}>${b}`] ?? (F[`${b}>${a}`] ? 1 / F[`${b}>${a}`] : undefined);

describe('y6-convert (#1242)', () => {
  it('is registered for Year 6 maths in the measure strand', () => { expect(topic.year).toBe('year6'); expect(topic.subject).toBe('maths'); expect(topic.strand).toBe('measure'); });

  it('every card has four distinct parseable options including the answer, with no float artefact and at most 3 dp', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(4); expect(q.options).toContain(q.answer);
      for (const o of q.options) { expect(parseNum(o), o).not.toBeNull(); expect(dp(o), o).toBeLessThanOrEqual(3); expect(o).not.toMatch(/\d{9,}|\.\d*0$|0{4,}\./); }
      for (const n of q.prompt.match(/[\d,]+(\.\d+)?/g) ?? []) expect(dp(n), q.prompt).toBeLessThanOrEqual(3);
    }
  });

  it('oracle: every two-unit card equals the factor-table conversion', () => {
    let seen = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 600)) {
      const mm = SIMPLE.exec(q.prompt); if (!mm) continue;
      const f = factor(mm[2], mm[3]); expect(f, q.prompt).toBeDefined(); seen++;
      expect(milli(q.answer) * (f! < 1 ? 1 / f! : 1), q.prompt).toBe(milli(mm[1]) * (f! < 1 ? 1 : f!));
    }
    expect(seen).toBeGreaterThan(600);
  });

  it('oracle: miles and kilometres use 5 miles = 8 km, sums add in the small unit', () => {
    const qs = draw(3, 1200); let miles = 0, sums = 0;
    for (const q of qs) {
      const mi = MILES.exec(q.prompt);
      if (mi) { miles++; const a = Number(mi[1].replace(/,/g, '')), r = Number(q.answer.replace(/,/g, '')); expect(mi[2] === 'miles' ? r * 5 : r * 8, q.prompt).toBe(mi[2] === 'miles' ? a * 8 : a * 5); }
      const su = SUM.exec(q.prompt);
      if (su) { sums++; const big = milli(su[1]) , s = Number(su[4].replace(/,/g, '')); expect(Number(q.answer.replace(/,/g, '')), q.prompt).toBe(big + (su[3] === '+' ? s : -s)); }
    }
    expect(miles).toBeGreaterThan(100); expect(sums).toBeGreaterThan(100);
  });

  it('d1 is larger to smaller only, up to three decimal places', () => {
    const qs = draw(1, 600);
    for (const q of qs) { const mm = SIMPLE.exec(q.prompt)!; expect(mm, q.prompt).not.toBeNull(); expect(['km', 'm', 'cm', 'kg', 'l'], q.prompt).toContain(mm[2]); expect(dp(q.answer), q.prompt).toBe(0); }
    expect(qs.filter(q => dp(SIMPLE.exec(q.prompt)![1]) === 3).length).toBeGreaterThan(30);
  });

  it('d2 goes both ways across metric and time', () => {
    const qs = draw(2, 600);
    expect(qs.filter(q => dp(q.answer) > 0 && /^[\d,]+ (m|cm|g|ml) =/.test(q.prompt)).length).toBeGreaterThan(50);
    expect(qs.filter(q => /\b(h|min|s)\b/.test(q.prompt)).length).toBeGreaterThan(100);
    expect(qs.filter(q => /^[\d,]+ (m|cm|g|ml|min|s) =/.test(q.prompt)).length).toBeGreaterThan(100);
  });

  it('a place-value-shift decoy is on at least 50% of metric cards, the inverse ratio on every miles card', () => {
    const metric = [...draw(1, 600), ...draw(2, 600)].filter(q => { const mm = SIMPLE.exec(q.prompt); return mm && F[`${mm[2]}>${mm[3]}`] >= 10 || mm && F[`${mm[3]}>${mm[2]}`] >= 10; }).filter(q => !/\b(h|min|s)\b/.test(q.prompt));
    const shift = metric.filter(q => { const a = milli(q.answer); return q.options.some(o => o !== q.answer && (milli(o) === a * 10 || milli(o) * 10 === a)); });
    expect(shift.length / metric.length).toBeGreaterThanOrEqual(0.5);
    const mi = draw(3, 1200).map(q => ({ q, m: MILES.exec(q.prompt) })).filter(x => x.m);
    for (const { q, m } of mi) {
      const a = Number(m![1].replace(/,/g, ''));
      const inv = a * (m![2] === 'miles' ? 625 : 1600); // 5/8 and 8/5 of a, in thousandths
      expect(q.options.some(o => milli(o) === inv), q.prompt).toBe(true);
    }
  });

  it('leak limit: at most 30% of in-scope cards have an answer whose last or leading digit no decoy shares', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const s = leakShares(topic.gen, d); expect(s.counted, `d${d}`).toBeGreaterThan(300); expect(s.units, `d${d} last`).toBeLessThanOrEqual(0.3); expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3); }
  });

  it('say is present and safe to speak', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) { expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true); }
  });
});
