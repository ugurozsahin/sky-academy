import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-hundredths')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1143 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
/** Whole hundredths from a 2-dp label, read from the digits (no float). */
const hun = (s: string) => Number(s.replace('.', ''));
const TWO_DP = /^\d\.\d\d$/;
const COUNT = /^Count (up|down) in hundredths: (.+), \?$/;
const DIVIDE = /^(\d\.\d) ÷ 10 = \?$/;
const HOWMANY = /^How many hundredths make (\d\.\d)\?$/;

describe('y4-hundredths (#1143)', () => {
  it('is registered for Year 4', () => { expect(topic.year).toBe('year4'); });

  it('d1: six ticks in 0.01 steps inside one tenth; the answer is the hidden tick; labels are exact', () => {
    for (const q of draw(1, 300)) {
      const v = q.visual as Extract<NonNullable<typeof q.visual>, { type: 'numberline' }>;
      expect(v.type).toBe('numberline'); expect(v.step).toBe(0.01); expect(v.labels).toHaveLength(6);
      const hs = v.labels!.map(hun);
      hs.forEach((h, i) => expect(h).toBe(hs[0] + i));
      expect(Math.floor(hs[0] / 10)).toBe(Math.floor(hs[5] / 10));
      v.labels!.forEach(l => expect(l).toMatch(TWO_DP));
      expect(v.mark).toBe(hun(q.answer) / 100);
      expect(hs).toContain(hun(q.answer));
      expect(Number(v.mark!.toFixed(2))).toBe(v.mark);
    }
  });

  it('d2: the oracle recomputes the answer from the shown terms, and the run crosses a tenth or a whole', () => {
    for (const q of draw(2, 400)) {
      const m = q.prompt.match(COUNT)!, s = m[1] === 'up' ? 1 : -1;
      const terms = m[2].split(', ').map(hun);
      expect(terms).toHaveLength(3);
      terms.forEach((t, i) => expect(t).toBe(terms[0] + s * i));
      const a = hun(q.answer);
      expect(a).toBe(terms[2] + s);
      expect(Math.floor(terms[0] / 10)).not.toBe(Math.floor(a / 10));
      expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThanOrEqual(200);
    }
  });

  it('d2 covers counting up and down, and crossing a whole', () => {
    const qs = draw(2, 600);
    expect(qs.some(q => q.prompt.includes('up in'))).toBe(true);
    expect(qs.some(q => q.prompt.includes('down in'))).toBe(true);
    expect(qs.some(q => q.answer === '1.00')).toBe(true);
  });

  it('d3: half are d2 counts; the rest divide a tenth by 10 or ask how many hundredths', () => {
    let count = 0, div = 0, how = 0;
    for (const q of draw(3, 800)) {
      let m: RegExpMatchArray | null;
      if (COUNT.test(q.prompt)) count++;
      else if ((m = q.prompt.match(DIVIDE))) { div++; expect(hun(q.answer)).toBe(Number(m[1].replace('.', ''))); expect(q.answer).toMatch(TWO_DP); }
      else if ((m = q.prompt.match(HOWMANY))) { how++; expect(Number(q.answer)).toBe(Number(m[1]) * 100); }
      else throw new Error(`unexpected d3 card: ${q.prompt}`);
    }
    expect(count).toBeGreaterThan(300); expect(count).toBeLessThan(500);
    expect(div).toBeGreaterThan(100); expect(how).toBeGreaterThan(100);
  });

  it('every decimal option has exactly 2 decimal places, none is negative or a float artefact, and options are distinct', () => {
    for (const d of [1, 2, 3] as const) for (const q of draw(d, 300)) {
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
      expect(q.options).toHaveLength(4);
      if (HOWMANY.test(q.prompt)) { q.options.forEach(o => expect(o).toMatch(/^\d+$/)); continue; }
      q.options.forEach(o => { expect(o).toMatch(TWO_DP); expect(Number(o)).toBeLessThanOrEqual(2); });
      expect(q.prompt).not.toMatch(/\d{4,}|e-|−|-/);
    }
  });

  it('every decimal-answer card offers the tenths-slip decoy (±0.10) on d1, d2 and ÷ 10 cards', () => {
    for (const d of [1, 2, 3] as const) for (const q of draw(d, 400)) {
      if (HOWMANY.test(q.prompt)) continue;
      const a = hun(q.answer), hs = q.options.map(hun);
      const m = q.prompt.match(COUNT);
      const slip = a + (m && m[1] === 'down' ? -10 : 10);
      expect(hs, q.prompt).toContain(slip);
      // a count also offers the step-of-0.10 slip on its last term (0.99 → 1.09)
      if (m) { const last = hun(m[2].split(', ')[2]); expect(hs, q.prompt).toContain(last + (m[1] === 'up' ? 10 : -10)); }
    }
  });

  it('how-many cards offer the place-value shifts (4 and 400 for 40)', () => {
    for (const q of draw(3, 600).filter(q => HOWMANY.test(q.prompt))) {
      const t = Number(q.prompt.match(HOWMANY)![1].replace('.', ''));
      expect(q.options).toContain(String(t)); expect(q.options).toContain(String(t * 100));
    }
  });

  it('speech never carries a digit-point number or a divide sign', () => {
    for (const d of [1, 2, 3] as const) for (const q of draw(d, 200)) expect(q.say ?? '').not.toMatch(/\d\.\d|÷/);
  });

  it.each([1, 2, 3] as const)('d%i leak shares stay at or under 30%% for the last and leading digit', d => {
    const s = leakShares(topic.gen, d, 2000, d === 1 ? { skipLeading: true } : {});
    expect(s.counted).toBeGreaterThan(500);
    expect(s.units).toBeLessThanOrEqual(0.3);
    if (d !== 1) expect(s.leading).toBeLessThanOrEqual(0.3);
  });
});
