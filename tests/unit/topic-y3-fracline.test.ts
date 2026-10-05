import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { equal } from '../../src/curriculum/fractions';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-fracline')!;
const DRAWS = 300;
const draws = (d: Difficulty) => { const r = rng(1093 + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
const nl = (c: Question) => { const v = c.visual; if (v?.type !== 'numberline') throw new Error('not a number line'); return v; };
/** A written tick or option as [n, d]; whole numbers 0, 1, 2 are read against the line's denominator. */
const val = (s: string, den: number): [number, number] => { const m = s.match(/^(\d+)\/(\d+)$/); return m ? [Number(m[1]), Number(m[2])] : [Number(s) * den, den]; };

describe('y3-fracline (#1093)', () => {
  it('is registered once, in Year 3', () => {
    expect(TOPICS.filter(t => t.id === 'y3-fracline')).toHaveLength(1);
    expect(topic.year).toBe('year3');
  });

  it('d1 and d3: the answer is the value at the hidden tick, counted from the line, and no label is a mixed number', () => {
    for (const d of [1, 3] as Difficulty[]) for (const c of draws(d)) {
      const v = nl(c), i = v.labels!.indexOf('?'), den = Number(c.answer.split('/')[1]);
      expect(v.labels!.length, c.prompt).toBeLessThanOrEqual(6);
      expect(c.answer, c.prompt).toBe(`${v.from + i}/${den}`);
      expect(v.mark).toBe(v.from + i);
      for (const l of [...v.labels!, ...c.options]) expect(l, c.prompt).toMatch(/^(\d+|\d+\/\d+|\?)$/);
      if (d === 1) { expect(v.from).toBe(0); expect(v.to).toBe(den); expect(i).toBeGreaterThan(0); expect(i).toBeLessThan(den); }
    }
  });

  it('d3 crosses 1 (a tick labelled 1) in quarters or fifths and hides no whole tick', () => {
    for (const c of draws(3)) {
      const v = nl(c), den = Number(c.answer.split('/')[1]);
      expect([4, 5]).toContain(den);
      expect(v.labels, c.prompt).toContain('1');
      expect(v.from, c.prompt).toBeLessThan(den);
      expect(v.to, c.prompt).toBeGreaterThan(den);
      expect(v.from + v.labels!.indexOf('?'), c.prompt).not.toBe(den);
      expect(v.from + v.labels!.indexOf('?'), c.prompt).not.toBe(2 * den);
    }
  });

  it('no option equals the answer or another option in value, and there are four', () => {
    for (const d of [1, 3] as Difficulty[]) for (const c of draws(d)) {
      const den = Number(c.answer.split('/')[1]);
      expect(c.options, c.prompt).toHaveLength(4);
      const fs = c.options.map(o => { const [n, dd] = val(o, den); return { n, d: dd }; });
      for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) expect(equal(fs[i], fs[j]), `${c.prompt} ${c.options}`).toBe(false);
    }
  });

  it('d2: four letters, the right one is at the asked fraction, and the line has at most 6 ticks', () => {
    for (const c of draws(2)) {
      const v = nl(c), m = c.prompt.match(/^Which letter is at (\d+)\/(\d+)\?$/)!;
      expect(m, c.prompt).toBeTruthy();
      expect(v.labels!.length).toBeLessThanOrEqual(6);
      expect(v.marks).toHaveLength(4);
      expect(new Set(v.marks!.map(x => x.at)).size).toBe(4);
      expect(v.to).toBe(Number(m[2]));
      expect(v.marks!.find(x => x.at === Number(m[1]))!.label, c.prompt).toBe(c.answer);
      expect([...c.options].sort()).toEqual(['A', 'B', 'C', 'D']);
    }
  });

  it('every card has a say without a raw fraction or digit', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d)) expect(c.say, c.prompt).toMatch(/^[A-Za-z ,.?']+$/);
  });

  it('a lettered card with another asked letter repeats under a different key', () => {
    const a = draws(2);
    expect(new Set(a.map(c => JSON.stringify(c.visual) + c.answer)).size).toBeGreaterThan(5);
  });
});
