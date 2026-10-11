import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-fdp')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1264 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };

/** Exact value of a label as [n, d]: "3/5", "60%" or a decimal such as "0.375" (integer arithmetic only). */
function value(label: string): [number, number] {
  let m = label.match(/^(\d+)\/(\d+)$/);
  if (m) return [+m[1], +m[2]];
  m = label.match(/^(\d+(?:\.\d+)?)%$/);
  if (m) return decimal(m[1], 100);
  m = label.match(/^(\d+(?:\.\d+)?)$/);
  if (m) return decimal(m[1], 1);
  throw new Error(`unreadable label ${label}`);
}
function decimal(s: string, den: number): [number, number] {
  const [i, f = ''] = s.split('.');
  return [+(i + f), 10 ** f.length * den];
}
const equal = (a: [number, number], b: [number, number]) => a[0] * b[1] === b[0] * a[1];
const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
const kind = (l: string) => l.includes('/') ? 'F' : l.endsWith('%') ? 'P' : 'D';
const rounded = (n: number, d: number) => Math.floor((2000 * n + d) / (2 * d));

describe('y6-fdp (#1264)', () => {
  it('is a Year 6 fractions topic', () => {
    expect([topic.year, topic.subject, topic.strand]).toEqual(['year6', 'maths', 'fractions']);
  });

  it('d1: the division and the fraction agree; proper, lowest terms, tops 1–11, bottoms 2–12', () => {
    let reverse = 0;
    for (const c of draw(1)) {
      const m = c.prompt.match(/^(\d+) ÷ (\d+) as a fraction$/) ?? c.prompt.match(/^Which division gives (\d+)\/(\d+)\?$/);
      expect(m, c.prompt).not.toBeNull();
      const n = +m![1], d = +m![2];
      expect(n).toBeGreaterThanOrEqual(1); expect(n).toBeLessThan(d); expect(d).toBeLessThanOrEqual(12); expect(gcd(n, d)).toBe(1);
      if (c.prompt.startsWith('Which')) { reverse++; expect(c.answer).toBe(`${n} ÷ ${d}`); } else expect(c.answer).toBe(`${n}/${d}`);
    }
    expect(reverse).toBeGreaterThan(60); expect(reverse).toBeLessThan(240);
  });

  it('d1 offers the tops-and-bottoms slip on most cards', () => {
    const flipped = draw(1).filter(c => { const m = c.prompt.match(/(\d+)(?: ÷ |\/)(\d+)/)!; return c.options.some(o => o === (c.answer.includes('÷') ? `${m[2]} ÷ ${m[1]}` : `${m[2]}/${m[1]}`)); });
    expect(flipped.length).toBeGreaterThan(250);
  });

  it('d2: the answer is equal in value to the source, in the notation asked for', () => {
    for (const c of draw(2)) {
      const m = c.prompt.match(/^(\S+) as (a fraction|a decimal|a percentage)$/)!;
      expect(m, c.prompt).not.toBeNull();
      expect(equal(value(c.answer), value(m[1])), c.prompt).toBe(true);
      expect(kind(c.answer)).toBe({ 'a fraction': 'F', 'a decimal': 'D', 'a percentage': 'P' }[m[2]]);
    }
  });

  it('d2 draws all six directions', () => {
    const seen = new Set<string>();
    for (const c of draw(2)) seen.add(kind(c.prompt.split(' ')[0]) + kind(c.answer));
    expect([...seen].sort()).toEqual(['DF', 'DP', 'FD', 'FP', 'PD', 'PF']);
  });

  it('d3: x × 1000 = round(1000·n/d), half up, for eighths and for recurring cases', () => {
    let eighths = 0, recurring = 0;
    for (const c of draw(3)) {
      const m = c.prompt.match(/^(\d+)(?: ÷ |\/)(\d+)/)!;
      const n = +m[1], d = +m[2];
      const [an, ad] = value(c.answer);
      expect(an * 1000, c.prompt).toBe(rounded(n, d) * ad);
      if (d === 8) eighths++; else { recurring++; expect(c.prompt).toContain('3 decimal places'); }
    }
    expect(eighths).toBeGreaterThan(50); expect(recurring).toBeGreaterThan(50);
  });

  it('no label is a float artefact: decimals have at most 3 places, percentages are whole', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) for (const o of c.options) {
      if (kind(o) === 'D' && !o.includes('÷')) expect(o, c.prompt).toMatch(/^\d+(\.\d{1,3})?$/);
      if (kind(o) === 'D' && o.includes('.')) expect(o.endsWith('0'), o).toBe(false);
    }
  });

  it('no decoy is equal in value to the answer; four distinct options', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d)) {
      expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4); expect(c.options).toContain(c.answer);
      for (const o of c.options.filter(x => x !== c.answer)) {
        if (o.includes('÷') || c.answer.includes('÷')) { expect(o, c.prompt).not.toBe(c.answer); continue; }
        expect(equal(value(o), value(c.answer)), `${c.prompt}: ${o}`).toBe(false);
      }
    }
  });

  it('a fixed table: 3/8 = 0.375, 2/3 → 0.667, 3/5 = 60%, 0.25 = 1/4', () => {
    expect(rounded(3, 8)).toBe(375); expect(rounded(2, 3)).toBe(667); expect(rounded(1, 6)).toBe(167);
    expect(equal(value('3/5'), value('60%'))).toBe(true); expect(equal(value('0.25'), value('1/4'))).toBe(true);
    expect(equal(value('3/5'), value('0.35'))).toBe(false);
  });

  it('d3 carries the rounding and place-value slips, d2 the digit join', () => {
    const has = (d: Difficulty, f: (c: ReturnType<typeof draw>[number]) => boolean) => draw(d).filter(f).length;
    expect(has(3, c => c.answer === '0.375' && c.options.includes('0.38'))).toBeGreaterThan(0);
    expect(has(3, c => c.answer === '0.667' && c.options.includes('0.666'))).toBeGreaterThan(0);
    expect(has(2, c => c.answer === '0.6' && c.options.includes('0.35'))).toBeGreaterThan(0);
    expect(has(2, c => c.answer === '60%' && c.options.includes('35%'))).toBeGreaterThan(0);
  });

  it('say reads no raw fraction and is safe', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 80)) {
      expect(c.say, c.prompt).toBeTruthy();
      expect(c.say).not.toMatch(/\d+\/\d+/);
      expect(sayIsSafe(c.say!), c.say).toBe(true);
    }
  });

  it('the last and leading digit leak shares stay at or under 0.30 (#1058)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const { units, leading, counted } = leakShares(topic.gen, d, 2000);
      if (counted === 0) continue;
      expect(units / counted, `d${d} last digit`).toBeLessThanOrEqual(0.3);
      expect(leading / counted, `d${d} leading digit`).toBeLessThanOrEqual(0.3);
    }
  });
});
