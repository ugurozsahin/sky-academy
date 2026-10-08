import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-shortdiv')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1188 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const f = (n: number) => n.toLocaleString('en-GB');
const num = (s: string) => Number(s.replace(/,/g, ''));
const sum = (p: string) => { const m = p.match(/^([\d,]+) ÷ (\d) = \?$/)!; return { n: num(m[1]), d: Number(m[2]) }; };
const story = (p: string) => { const m = p.match(/(\d+)[^.]*?of (\d)\./)!; return { n: Number(m[1]), d: Number(m[2]) }; };

describe('y5-shortdiv (#1188)', () => {
  it('is a Year 5 maths topic whose builds stay out of Ninja Duel', () => {
    expect([topic.year, topic.subject, topic.strand, topic.sequenceFrom]).toEqual(['year5', 'maths', 'calc', 2]);
  });

  it('oracle: q × d + r = n with 0 ≤ r < d on every d1 and d2 card', () => {
    for (const d of [1, 2] as Difficulty[]) for (const c of draw(d, 2000)) {
      const { n, d: div } = sum(c.prompt);
      const m = c.answer.match(/^(\d+)(?: r (\d))?$/)!;
      const r = m[2] === undefined ? 0 : Number(m[2]);
      expect(Number(m[1]) * div + r).toBe(n);
      expect(r).toBeLessThan(div);
      if (d === 1) { expect(r).toBe(0); expect(n).toBeGreaterThanOrEqual(100); expect(n).toBeLessThan(1000); expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4); expect(c.options).toContain(c.answer); }
    }
  });

  it('d2 builds: quotient of 3 digits, 4 slots with a pre-printed r, plain template when exact', () => {
    let exact = 0, rem = 0;
    for (const c of draw(2, 1000)) {
      const { n } = sum(c.prompt);
      expect(n).toBeGreaterThanOrEqual(1000); expect(n).toBeLessThanOrEqual(9999);
      if (c.answer.includes(' r ')) { rem++; expect(c.build!.template).toBe('___ r _'); expect(c.sequence).toHaveLength(4); }
      else { exact++; expect(c.build!.template).toBe('___'); expect(c.sequence).toHaveLength(3); }
      expect(c.sequence!.join('')).toBe(c.answer.replace(/\D/g, ''));
    }
    expect(exact).toBeGreaterThan(100); expect(rem).toBeGreaterThan(500);
  });

  it('d3: all three readings are offered and only the one the question asks for is right', () => {
    const seen = new Set<string>();
    for (const c of draw(3, 2000)) {
      const { n, d } = story(c.prompt);
      const quotient = Math.floor(n / d), r = n % d;
      expect(r).toBeGreaterThan(0);
      const kind = c.prompt.includes('full') ? 'down' : c.prompt.includes('needed') ? 'up' : 'left';
      seen.add(kind);
      const want = { down: quotient, up: quotient + 1, left: r }[kind];
      expect(num(c.answer)).toBe(want);
      for (const v of [quotient, quotient + 1, r]) expect(c.options).toContain(f(v));
      expect(c.options).toHaveLength(4); expect(new Set(c.options).size).toBe(4);
      expect(c.prompt.length).toBeLessThanOrEqual(90);
      expect(c.say).toBeTruthy();
    }
    expect([...seen].sort()).toEqual(['down', 'left', 'up']);
  });

  it('leak limit: at most 30 % of cards have a unique last or leading digit', () => {
    for (const d of [1, 3] as Difficulty[]) {
      const { units, leading, counted } = leakShares(topic.gen, d);
      if (counted > 0) { expect(units / counted).toBeLessThanOrEqual(0.3); expect(leading / counted).toBeLessThanOrEqual(0.3); }
    }
  });
});
