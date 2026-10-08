import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { parseNum, mulDecByInt, compareDec } from '../../src/curriculum/ks2num';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-x10')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1190 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => parseNum(s)!;
/** Exact check of "a × b = ?", "a ÷ b = ?", "a × ? = c" and "c ÷ ? = a" against the answer, on scaled integers. */
function holds(prompt: string, answer: string): boolean {
  let m = prompt.match(/^(\S+) ([×÷]) (\S+) = \?$/);
  if (m) {
    const [a, b, ans] = [num(m[1]), num(m[3]), num(answer)];
    return m[2] === '×' ? compareDec(ans, mulDecByInt(a, b.v)) === 0 : compareDec(mulDecByInt(ans, b.v), a) === 0;
  }
  m = prompt.match(/^(\S+) ([×÷]) \? = (\S+)$/)!;
  const [x, y, k] = [num(m[1]), num(m[3]), num(answer)];
  return m[2] === '×' ? compareDec(mulDecByInt(x, k.v), y) === 0 : compareDec(mulDecByInt(y, k.v), x) === 0;
}
const whole = (s: string) => !s.includes('.');

describe('y5-x10 (#1190)', () => {
  it('is a Year 5 maths topic whose builds stay out of Ninja Duel', () => {
    expect([topic.year, topic.subject, topic.strand, topic.sequenceFrom]).toEqual(['year5', 'maths', 'calc', 2]);
  });

  it('oracle: exact over 2,000 draws per difficulty, ≤ 3 decimal places, no trailing zero or float artefact', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 2000)) {
      expect(holds(c.prompt, c.answer)).toBe(true);
      expect(c.answer).toMatch(/^\d{1,3}(,\d{3})*(\.\d{0,2}[1-9])?$|^\d+(\.\d{0,2}[1-9])?$/);
      expect(new Set(c.options).size).toBe(c.options.length);
      if (!c.build) expect(c.options).toContain(c.answer);
    }
  });

  it('d1: pick-one with a whole answer and four distinct options', () => {
    for (const c of draw(1, 1000)) { expect(whole(c.answer)).toBe(true); expect(c.options).toHaveLength(4); expect(c.build).toBeUndefined(); }
  });

  it('d2 builds: ≤ 6 slots, a point slot exactly when the answer is not whole', () => {
    let pointed = 0, plain = 0;
    for (const c of draw(2, 2000)) {
      expect(c.build).toBeDefined();
      const slots = c.sequence!.length, points = c.sequence!.filter(s => s === '.').length;
      expect(slots).toBeLessThanOrEqual(6);
      expect(points).toBe(whole(c.answer) ? 0 : 1);
      expect(c.build!.template).toBe(c.answer.replace(/[0-9.]/g, '_'));
      expect(c.sequence!.join('')).toBe(c.answer.replace(/,/g, ''));
      expect(c.options).toContain('.'.repeat(Number(!whole(c.answer))) || c.options[0]);
      if (points) pointed++; else plain++;
    }
    expect(pointed).toBeGreaterThan(1000); expect(plain).toBeGreaterThan(50);
  });

  it('d3: half builds (≤ 6 slots, point sliced) and half "which power?" cards over 10, 100, 1,000, 10,000', () => {
    let builds = 0, missing = 0;
    for (const c of draw(3, 2000)) {
      if (c.build) {
        builds++; expect(c.sequence!.length).toBeLessThanOrEqual(6);
        expect(c.sequence!.includes('.')).toBe(!whole(c.answer));
      } else {
        missing++; expect(c.prompt).toContain('?'); expect(c.prompt).toMatch(/[×÷] \? =/);
        expect([...c.options].sort((a, b) => Number(a.replace(/,/g, '')) - Number(b.replace(/,/g, '')))).toEqual(['10', '100', '1,000', '10,000']);
      }
    }
    expect(builds).toBeGreaterThan(700); expect(missing).toBeGreaterThan(700);
  });

  it('leak limit: at most 30 % of pick-one cards have a unique last or leading digit', () => {
    for (const d of [1, 3] as Difficulty[]) {
      const { units, leading, counted } = leakShares(topic.gen, d);
      if (counted > 0) { expect(units / counted).toBeLessThanOrEqual(0.3); expect(leading / counted).toBeLessThanOrEqual(0.3); }
    }
  });
});
