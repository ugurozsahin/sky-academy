import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { equal, type Frac } from '../../src/curriculum/fractions';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-fracadd')!;
const DRAWS = 300;
const draws = (d: Difficulty) => { const r = rng(1095 + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
const F = '(\\d+)\\/(\\d+)';
/** A written answer or option as a fraction: the digit 1 is a whole. */
const val = (s: string): Frac => { const m = s.match(/^(\d+)\/(\d+)$/); return m ? { n: Number(m[1]), d: Number(m[2]) } : { n: Number(s), d: 1 }; };
/** The oracle: solve the prompt from its own numbers (the missing part when there is a `?` beside the sum or difference). */
function solve(c: Question): Frac {
  let m = c.prompt.match(new RegExp(`^${F} ([+−]) ${F} = \\?$`));
  if (m) { const a = Number(m[1]), b = Number(m[4]); return { n: m[3] === '+' ? a + b : a - b, d: Number(m[2]) }; }
  m = c.prompt.match(new RegExp(`^${F} \\+ \\? = (?:${F}|1)$`));
  if (m) return { n: (m[3] ? Number(m[3]) : Number(m[2])) - Number(m[1]), d: Number(m[2]) };
  m = c.prompt.match(new RegExp(`^\\? − ${F} = ${F}$`));
  if (m) return { n: Number(m[1]) + Number(m[3]), d: Number(m[2]) };
  throw new Error(`unparsed ${c.prompt}`);
}

describe('y3-fracadd (#1095)', () => {
  it('is registered once, in Year 3', () => {
    expect(TOPICS.filter(t => t.id === 'y3-fracadd')).toHaveLength(1);
    expect(topic.year).toBe('year3');
  });

  it('the answer is the computed sum, difference or missing part, over the same denominator, in (0, 1]', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const want = solve(c), got = val(c.answer);
      expect(equal(got, want), c.prompt).toBe(true);
      expect(got.n, c.prompt).toBeGreaterThan(0);
      expect(got.n, c.prompt).toBeLessThanOrEqual(got.d);
      const dens = [...c.prompt.matchAll(/\/(\d+)/g)].map(x => Number(x[1]));
      expect(new Set(dens).size, c.prompt).toBe(1);
      expect(dens[0], c.prompt).toBeLessThanOrEqual(10);
      if (c.answer.includes('/')) expect(c.answer, c.prompt).toBe(`${want.n}/${want.d}`); // as computed, never simplified
    }
  });

  it('no option equals the answer or another option in value, and there are four', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      expect(c.options, c.prompt).toHaveLength(4);
      const fs = c.options.map(val);
      for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) expect(equal(fs[i], fs[j]), `${c.prompt} ${c.options}`).toBe(false);
      expect(c.options).toContain(c.answer);
    }
  });

  it('every addition card carries the added-bottoms decoy', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const m = c.prompt.match(new RegExp(`^${F} \\+ ${F} = \\?$`));
      if (m) expect(c.options, c.prompt).toContain(`${Number(m[1]) + Number(m[3])}/${Number(m[2]) * 2}`);
    }
  });

  it('d1 only adds, below one whole; d3 reaches one whole as the digit 1 with no d/d option', () => {
    for (const c of draws(1)) { expect(c.prompt).toContain(' + '); expect(c.answer).toContain('/'); }
    const wholes = draws(3).filter(c => c.answer === '1');
    expect(wholes.length).toBeGreaterThan(20);
    for (const c of wholes) for (const o of c.options) expect(o, c.prompt).not.toMatch(/^(\d+)\/\1$/);
  });

  it('every card has a say without a raw fraction or digit', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) expect(c.say, c.prompt).toMatch(/^[A-Za-z ,.?']+$/);
  });
});
