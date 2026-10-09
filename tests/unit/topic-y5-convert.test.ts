import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { parseNum } from '../../src/curriculum/ks2num';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-convert')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1203 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
// The test's own factor table: units per one of the larger unit, as exact integer ratios (small per big).
const F: Record<string, number> = { 'km>m': 1000, 'm>cm': 100, 'cm>mm': 10, 'kg>g': 1000, 'l>ml': 1000, 'h>min': 60, 'min>s': 60, 'days>h': 24, 'weeks>days': 7, 'years>months': 12 };
const num = (s: string) => parseNum(s.replace(/\s/g, ''))!;
/** Scaled to thousandths so the comparison is integer-exact. */
const milli = (s: string) => { const n = num(s); return n.v * 10 ** (3 - n.dp); };
const SIMPLE = /^([\d,.]+) (\S+) = \? (\S+)$/;
const simple = (q: Question) => SIMPLE.exec(q.prompt);
const factor = (a: string, b: string) => F[`${a}>${b}`] ?? (F[`${b}>${a}`] ? 1 / F[`${b}>${a}`] : undefined);
const dp = (s: string) => parseNum(s)!.dp;

describe('y5-convert (#1203)', () => {
  it('is registered for Year 5 maths in the measure strand', () => { expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.strand).toBe('measure'); });

  it('every card has four distinct parseable options including the answer, with no float artefact', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(4); expect(q.options).toContain(q.answer);
      for (const o of q.options) { expect(parseNum(o), o).not.toBeNull(); expect(o).not.toMatch(/\d{9,}|\.\d*0$|0{4,}\./); }
    }
  });

  it('oracle: every two-unit card equals the factor-table conversion', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const m = simple(q); if (!m || m[2] === 'hours') continue;
      const f = factor(m[2], m[3]); expect(f, q.prompt).toBeDefined();
      expect(milli(q.answer) * 1, q.prompt).toBe(milli(m[1]) * f! + 0);
    }
  });

  it('oracle: mixed cards', () => {
    const qs = draw(3, 1200);
    const hm = qs.map(q => /^(\d+) h (\d+) min = \? min$/.exec(q.prompt)).filter(Boolean) as RegExpExecArray[];
    const hours = qs.filter(q => /hours = \? minutes$/.test(q.prompt)), rest = qs.filter(q => / and \? min$/.test(q.prompt));
    const mix = qs.map(q => /^(\d+) (km|m|kg|l) (\d+) (m|cm|g|ml) = \? (\S+)$/.exec(q.prompt)).filter(Boolean) as RegExpExecArray[];
    for (const arr of [hm, hours, rest, mix]) expect(arr.length).toBeGreaterThan(100);
    for (const q of qs) {
      let m = /^(\d+) h (\d+) min = \? min$/.exec(q.prompt); if (m) { expect(Number(q.answer)).toBe(Number(m[1]) * 60 + Number(m[2])); continue; }
      m = /^([\d.]+) hours = \? minutes$/.exec(q.prompt); if (m) { expect(Number(q.answer)).toBe(Math.round(Number(m[1]) * 60)); continue; }
      m = /^(\d+) min = (\d+) h and \? min$/.exec(q.prompt); if (m) { expect(Number(q.answer)).toBe(Number(m[1]) - Number(m[2]) * 60); continue; }
      m = /^(\d+) (km|m|kg|l) (\d+) (m|cm|g|ml) = \? \S+$/.exec(q.prompt); if (m) expect(Number(q.answer.replace(/,/g, ''))).toBe(Number(m[1]) * F[`${m[2]}>${m[4]}`] + Number(m[3]));
    }
  });

  it('d1 is whole-number metric only, at most 10 of the larger unit', () => {
    for (const q of draw(1)) {
      const m = simple(q)!; expect(m, q.prompt).not.toBeNull();
      expect(['km', 'm', 'cm', 'mm', 'kg', 'g', 'l', 'ml'], q.prompt).toContain(m[2]);
      expect(dp(m[1]) + dp(q.answer), q.prompt).toBe(0);
      const big = Number(F[`${m[2]}>${m[3]}`] ? m[1].replace(/,/g, '') : q.answer.replace(/,/g, ''));
      expect(big, q.prompt).toBeLessThanOrEqual(10);
    }
  });

  it('d2 has decimal metric cards and single-unit time cards, each one or two places', () => {
    const qs = draw(2, 600);
    expect(qs.filter(q => /\./.test(q.prompt + q.answer)).length).toBeGreaterThan(100);
    expect(qs.filter(q => /\b(h|min|s|days?|weeks?|years?|months?)\b/.test(q.prompt)).length).toBeGreaterThan(100);
    for (const q of qs) { const m = simple(q)!; expect(Math.max(dp(m[1]), dp(q.answer)), q.prompt).toBeLessThanOrEqual(2); }
  });

  it('the decimal-time and place-value-shift decoys each appear on at least 20% of eligible cards', () => {
    const qs = draw(3, 1200).filter(q => /^(\d+) h (\d+) min = \? min$/.test(q.prompt));
    const hit = qs.filter(q => { const [, h, min] = /^(\d+) h (\d+) min/.exec(q.prompt)!; return q.options.includes(`${Number(h) * 100 + Number(min)}`); });
    expect(hit.length / qs.length).toBeGreaterThanOrEqual(0.2);
    const metric = draw(2, 1200).filter(q => { const m = simple(q); return m && F[`${m[2]}>${m[3]}`] >= 10 && /^(km|m|cm|kg|l)$/.test(m[2]); });
    const shift = metric.filter(q => { const a = milli(q.answer); return q.options.some(o => o !== q.answer && (milli(o) === a * 10 || milli(o) * 10 === a)); });
    expect(shift.length / metric.length).toBeGreaterThanOrEqual(0.2);
    const hours = draw(3, 1200).filter(q => /hours = \? minutes$/.test(q.prompt));
    const dh = hours.filter(q => q.options.includes(String(Math.round(Number(/^([\d.]+) hours/.exec(q.prompt)![1]) * 100))));
    expect(dh.length / hours.length).toBeGreaterThanOrEqual(0.2);
  });

  it('leak limit: at most 30% of in-scope cards have an answer whose last or leading digit no decoy shares', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const s = leakShares(topic.gen, d); expect(s.counted, `d${d}`).toBeGreaterThan(300); expect(s.units / s.counted, `d${d} last`).toBeLessThanOrEqual(0.3); expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3); }
  });

  it('say is present, safe to speak, and writes the units as words', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) { expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true); }
  });
});
