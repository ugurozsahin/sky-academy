import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-negative')!;
const draw = (d: Difficulty, n = 2000) => { const r = rng(1180 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace('−', '-'));
const nums = (s: string) => (s.match(/−?\d+/g) ?? []).map(num);

/** The answer re-derived from the prompt alone, per card shape. */
function oracle(q: Question): number {
  let m: RegExpMatchArray | null;
  if (q.visual?.type === 'numberline') return q.visual.marks![0].at;
  if ((m = q.prompt.match(/^Start at (\S+) and count back (\d+)/))) return num(m[1]) - Number(m[2]);
  if ((m = q.prompt.match(/^Start at (\S+) and count on (\d+)/))) return num(m[1]) + Number(m[2]);
  if ((m = q.prompt.match(/^It is (\S+) °C\. It gets (\d+) degrees (warmer|colder)/))) return num(m[1]) + (m[3] === 'warmer' ? 1 : -1) * Number(m[2]);
  if ((m = q.prompt.match(/^How many degrees warmer is (\S+) °C than (\S+) °C/))) return num(m[1]) - num(m[2]);
  if ((m = q.prompt.match(/^(.*), … what comes next\?$/))) { const t = nums(m[1]); return t[2] + (t[2] - t[1]); }
  throw new Error(`no oracle for ${q.prompt}`);
}

describe('y5-negative (#1180)', () => {
  it('is registered for Year 5 maths', () => { expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); });

  it('the oracle holds on every card: 2,000 draws per difficulty, answers −30..30, four distinct options', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      if (q.prompt === 'Which temperature is the coldest?') expect(num(q.answer)).toBe(Math.min(...q.options.map(num)));
      else expect(num(q.answer)).toBe(oracle(q));
      expect(num(q.answer)).toBeGreaterThanOrEqual(-30); expect(num(q.answer)).toBeLessThanOrEqual(30);
      expect(q.options).toContain(q.answer); expect(new Set(q.options).size).toBe(4);
      for (const o of q.options) { expect(o).not.toMatch(/-/); expect(o).toMatch(/^−?\d+$/); }
    }
  });

  it('every d1 number line has at most 6 ticks, one label per tick with a real minus, and its marker on an inner tick', () => {
    let lines = 0;
    for (const q of draw(1)) {
      const v = q.visual; if (v?.type !== 'numberline') continue;
      lines++;
      const ticks = v.labels!.length, step = v.step!;
      expect(ticks).toBeLessThanOrEqual(6); expect(v.to).toBe(v.from + (ticks - 1) * step);
      expect(v.from).toBeLessThan(0); expect(v.to).toBeGreaterThan(0);
      v.labels!.forEach(l => expect(l).not.toMatch(/-/));
      const at = v.marks![0].at; expect(at).toBeGreaterThan(v.from); expect(at).toBeLessThan(v.to);
      expect((at - v.from) % step).toBe(0);
    }
    expect(lines).toBeGreaterThan(800);
  });

  it('a move that crosses zero offers the zero-counted decoy', () => {
    let crossing = 0;
    for (const q of draw(1)) {
      const m = q.prompt.match(/^Start at (\S+) and count (back|on) (\d+)/); if (!m) continue;
      const a = num(q.answer), start = num(m[1]);
      if (Math.sign(a) !== Math.sign(start)) { crossing++; expect(q.options).toContain(f(m[2] === 'back' ? a - 1 : a + 1)); }
    }
    expect(crossing).toBeGreaterThan(200);
  });

  it('d2 and d3 name the sign-flip slip', () => {
    for (const d of [2, 3] as Difficulty[]) for (const q of draw(d, 400)) {
      if (q.prompt === 'Which temperature is the coldest?') continue;
      const a = num(q.answer); if (a !== 0 && Math.abs(a) <= 30 && Math.abs(-a) <= 30) expect(q.options).toContain(f(-a));
    }
  });

  it('say never carries a raw minus, degree sign or digit-less symbol', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 400)) expect(q.say ?? '').not.toMatch(/[−°-]/);
  });

  it('leak limit: at most 30% of in-scope cards have a last digit no decoy shares', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d, 2000, { skipLeading: true });
      expect(s.units).toBeLessThanOrEqual(0.3);
    }
  });
});

function f(n: number): string { return n < 0 ? `−${-n}` : String(n); }
