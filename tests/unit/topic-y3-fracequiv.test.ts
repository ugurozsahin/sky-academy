import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { equal, parseFrac } from '../../src/curriculum/fractions';
import { sayIsSafe } from '../../src/curriculum/ks2say';

// Deterministic RNG (mulberry32), same construction `topic-y3-pv.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-fracequiv')!;
const DRAWS = 400;
const draws = (d: Difficulty) => { const r = rng(1094_000 + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
const fr = (label: string) => parseFrac(label)!;
/** The label as written — `parseFrac` reduces, which would hide the denominator the child actually sees. */
const den = (label: string) => Number(label.split('/')[1]);
/** `a/b = ?/c` or `a/b = c/?`, parsed back out of the prompt. */
const gap = (prompt: string) => {
  const m = /^(\d+)\/(\d+) = (\?|\d+)\/(\?|\d+)$/.exec(prompt)!;
  return { left: { n: Number(m[1]), d: Number(m[2]) }, top: m[3], bottom: m[4] };
};

describe('y3-fracequiv (#1094)', () => {
  it('is registered once, in Year 3, in the fractions strand', () => {
    expect(TOPICS.filter(t => t.id === 'y3-fracequiv')).toHaveLength(1);
    expect(topic.year).toBe('year3');
  });

  it('d1/d2: exactly one option is equal in value to the target, and the shown fraction is never an option', () => {
    for (const d of [1, 2] as Difficulty[]) {
      for (const q of draws(d)) {
        const v = q.visual;
        const label = v?.type === 'fraction' ? `${v.shaded}/${v.parts}` : /(\d+\/\d+)/.exec(q.prompt)![1];
        expect(q.options.filter(o => equal(fr(o), fr(label))), q.prompt).toEqual([q.answer]);
        expect(q.options, q.prompt).not.toContain(label);
        expect(q.options.length, q.prompt).toBe(4);
        for (const o of q.options) { expect(den(o), o).toBeLessThanOrEqual(10); expect(den(o), o).toBeGreaterThanOrEqual(2); }
      }
    }
  });

  it('d1 uses the existing bar: the shaded part is worth the answer, over at most 8 parts', () => {
    for (const q of draws(1)) {
      expect(q.visual, q.prompt).toMatchObject({ type: 'fraction', shape: 'bar' });
      if (q.visual?.type !== 'fraction') continue;
      expect(q.visual.parts).toBeLessThanOrEqual(8);
      expect(equal({ n: q.visual.shaded, d: q.visual.parts }, fr(q.answer)), q.prompt).toBe(true);
      expect(`${q.visual.shaded}/${q.visual.parts}`).not.toBe(q.answer);
    }
  });

  it('d2 has no picture and asks both ways round', () => {
    const cards = draws(2);
    expect(cards.every(q => !q.visual)).toBe(true);
    const asked = cards.map(q => den(/(\d+\/\d+)/.exec(q.prompt)![1]));
    const answers = cards.map(q => den(q.answer));
    expect(asked.some((a, i) => a > answers[i])).toBe(true);
    expect(asked.some((a, i) => a < answers[i])).toBe(true);
  });

  it('d3: the answer completes the equality and no other option does', () => {
    const cards = draws(3);
    let top = 0, bottom = 0;
    for (const q of cards) {
      const { left, top: t, bottom: b } = gap(q.prompt);
      const completes = (o: string) => t === '?' ? equal(left, { n: Number(o), d: Number(b) }) : equal(left, { n: Number(t), d: Number(o) });
      if (t === '?') top++; else bottom++;
      expect(q.options.filter(completes), q.prompt).toEqual([q.answer]);
      expect(q.options.length, q.prompt).toBe(4);
      expect(Math.max(...q.options.map(Number)), q.prompt).toBeLessThanOrEqual(10);
    }
    expect(top).toBeGreaterThan(100);
    expect(bottom).toBeGreaterThan(100);
  });

  it('every card says its fractions in words, never raw', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      for (const q of draws(d)) {
        expect(q.say, q.prompt).toBeTruthy();
        expect(sayIsSafe(q.say!), q.say).toBe(true);
        expect(q.say, q.prompt).not.toMatch(/\d|\//);
      }
    }
  });

  it('d3 cards read as sentences a child can follow', () => {
    const says = new Set(draws(3).map(q => q.say!));
    for (const s of says) expect(s, s).toMatch(/^[A-Z][a-z -]+ is the same as (how many \w+s\?|\w[\w -]* over what\?)$/);
  });
});
