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

  it('every option is a proper fraction, or the answer 1: n < d, never a whole or above except the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) for (const o of c.options) {
      const v = val(o);
      if (o === c.answer) expect(v.n, c.prompt).toBeLessThanOrEqual(v.d);
      else { expect(v.d, `${c.prompt} ${c.options}`).toBeGreaterThan(1); expect(v.n, `${c.prompt} ${c.options}`).toBeLessThan(v.d); }
    }
  });

  it('every card carries the added-bottoms decoy', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const sum = c.prompt.match(new RegExp(`^${F} [+−] ${F} = \\?$`));       // a/d ± b/d: the answer's top over 2d (d over 2d for a whole)
      const gap = c.prompt.match(new RegExp(`^${F} \\+ \\? = (\\d+)(?:\\/\\d+)?$`)); // a/d + ? = c/d: c over d + a
      const gap2 = c.prompt.match(new RegExp(`^\\? − ${F} = ${F}$`));          // ? − a/d = c/d: c over d + a
      let want: string;
      if (sum) want = `${c.answer === '1' ? sum[2] : val(c.answer).n}/${Number(sum[2]) * 2}`;
      else if (gap) want = `${c.prompt.endsWith('= 1') ? gap[2] : gap[3]}/${Number(gap[2]) + Number(gap[1])}`;
      else want = `${gap2![3]}/${Number(gap2![2]) + Number(gap2![1])}`;
      expect(c.options, c.prompt).toContain(want);
    }
  });

  it('all four card kinds appear, d1 stays on bottoms 3–8, d2 adds and subtracts', () => {
    for (const c of draws(1)) expect(Number(c.prompt.match(/\/(\d+)/)![1]), c.prompt).toBeLessThanOrEqual(8);
    const kinds = (d: Difficulty) => new Set(draws(d).map(c => /\? −/.test(c.prompt) ? 'minus-missing' : /\+ \?/.test(c.prompt) ? 'plus-missing' : / − /.test(c.prompt) ? 'sub' : 'add'));
    expect(kinds(2)).toEqual(new Set(['add', 'sub']));
    expect(kinds(3)).toEqual(new Set(['add', 'sub', 'plus-missing', 'minus-missing']));
  });

  it('the level bands hold: d2 bottoms 3–10, d3 bottoms 4–10, and a missing-part sum to one whole appears', () => {
    const bottom = (c: Question) => Number(c.prompt.match(/\/(\d+)/)![1]);
    for (const c of draws(2)) { expect(bottom(c), c.prompt).toBeGreaterThanOrEqual(3); expect(bottom(c), c.prompt).toBeLessThanOrEqual(10); }
    for (const c of draws(3)) expect(bottom(c), c.prompt).toBeGreaterThanOrEqual(3);
    expect(draws(3).some(c => /\+ \? = 1$/.test(c.prompt))).toBe(true);
  });

  it('the say matches the operator: plus, take away, minus', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      if (/\? −/.test(c.prompt)) expect(c.say, c.prompt).toMatch(/^What minus /);
      else if (/ − /.test(c.prompt)) expect(c.say, c.prompt).toMatch(/ take away /);
      else expect(c.say, c.prompt).toMatch(/ plus /);
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
