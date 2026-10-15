import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { equal, type Frac } from '../../src/curriculum/fractions';
import { sayIsSafe } from '../../src/curriculum/ks2say';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-fracadd')!;
const DRAWS = 300;
const draws = (d: Difficulty, n = DRAWS) => { const r = rng(1145 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const F = '(\\d+)\\/(\\d+)';
const val = (s: string): Frac => { const m = s.match(/^(\d+)\/(\d+)$/)!; return { n: Number(m[1]), d: Number(m[2]) }; };
const nums = (p: string) => [...p.matchAll(/(\d+)\/(\d+)/g)].map(m => Number(m[1]));
const den = (p: string) => Number(p.match(/\/(\d+)/)![1]);
/** The oracle: solve the prompt from its own numbers. */
function solve(c: Question): number {
  const p = c.prompt;
  let m = p.match(new RegExp(`^${F} \\+ \\? = ${F}$`));
  if (m) return Number(m[3]) - Number(m[1]);
  m = p.match(/^1 − (\d+)\/(\d+) = \?$/);
  if (m) return Number(m[2]) - Number(m[1]);
  const ns = nums(p);
  return / − /.test(p) ? ns[0] - ns[1] : ns.reduce((a, b) => a + b, 0);
}
const isAdd = (c: Question) => !/ − /.test(c.prompt);

describe('y4-fracadd (#1145)', () => {
  it('is registered once, in Year 4', () => {
    expect(TOPICS.filter(t => t.id === 'y4-fracadd')).toHaveLength(1);
    expect(topic.year).toBe('year4');
  });

  it('the oracle holds, every answer is > 0 and keeps the card denominator, bottoms 3–12', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      const got = val(c.answer), dd = den(c.prompt);
      expect(got.n, c.prompt).toBe(solve(c));
      expect(got.n, c.prompt).toBeGreaterThan(0);
      expect(got.d, c.prompt).toBe(dd);
      expect(dd).toBeGreaterThanOrEqual(3); expect(dd).toBeLessThanOrEqual(12);
      expect(new Set([...c.prompt.matchAll(/\/(\d+)/g)].map(x => x[1])).size, c.prompt).toBe(1);
    }
  });

  it('d1 stays within one whole; d2 and d3 go beyond it', () => {
    for (const c of draws(1)) expect(val(c.answer).n, c.prompt).toBeLessThanOrEqual(val(c.answer).d);
    for (const d of [2, 3] as Difficulty[]) expect(draws(d).some(c => val(c.answer).n > val(c.answer).d), `d${d}`).toBe(true);
    expect(draws(2).filter(c => isAdd(c) && val(c.answer).n > val(c.answer).d).length).toBeGreaterThan(50);
    expect(draws(2).some(c => !isAdd(c) && Math.max(...nums(c.prompt)) > den(c.prompt))).toBe(true);
  });

  it('all the d3 kinds appear: three fractions, 1 − x, a missing addend', () => {
    const kind = (c: Question) => /^1 −/.test(c.prompt) ? 'one' : /\?/.test(c.prompt.replace(/= \?$/, '')) ? 'missing' : (c.prompt.match(/ \+ /g) ?? []).length === 2 ? 'three' : 'two';
    expect(new Set(draws(3).map(kind))).toEqual(new Set(['one', 'missing', 'three']));
  });

  it('numerators stay within 2 × the bottom', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) for (const n of [...nums(c.prompt), val(c.answer).n]) expect(n, c.prompt).toBeLessThanOrEqual(2 * den(c.prompt));
  });

  it('four options, none equal in value to the answer or each other', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      expect(c.options, c.prompt).toHaveLength(4);
      expect(c.options).toContain(c.answer);
      const fs = c.options.map(val);
      for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) expect(equal(fs[i], fs[j]), `${c.prompt} ${c.options}`).toBe(false);
      for (const o of fs) expect(o.n, c.prompt).toBeGreaterThanOrEqual(1);
    }
  });

  it('every addition card offers the tops-and-bottoms slip', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d).filter(isAdd)) {
      const dd = den(c.prompt), n = val(c.answer).n;
      const k = /^\d+\/\d+ \+ \d+\/\d+ \+/.test(c.prompt) ? 3 : 2;
      const want = /\+ \?/.test(c.prompt) ? `${n}/${2 * dd}` : `${n}/${k * dd}`; // a missing addend keeps the answer's top over added bottoms
      expect(c.options, c.prompt).toContain(want);
    }
    for (const c of draws(2).filter(c => !isAdd(c))) expect(c.options.some(o => val(o).d !== den(c.prompt)), c.prompt).toBe(false);
  });

  it('at least one decoy shares the answer bottom on ≥70% of cards at every level', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const cs = draws(d, 2000);
      const share = cs.filter(c => c.options.some(o => o !== c.answer && val(o).d === val(c.answer).d)).length / cs.length;
      expect(share, `d${d}`).toBeGreaterThanOrEqual(0.7);
    }
  });

  it('say names fractions in words, never a raw fraction or digit', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) {
      expect(sayIsSafe(c.say!), c.prompt).toBe(true);
      expect(c.say, c.prompt).toMatch(/^[A-Za-z ,.?'-]+$/);
      expect(c.say, c.prompt).toMatch(/plus|take away/);
    }
  });
});
