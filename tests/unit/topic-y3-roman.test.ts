import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { fromRoman, isRoman } from '../../src/curriculum/roman';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y3-roman')!;
const DRAWS = 300;
const draws = (d: Difficulty) => { const r = rng(1100_000 + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
const HARD = new Set(['IV', 'IX', 'VIII', 'XI', 'XII', 'VII', 'III']);

describe('y3-roman (#1100)', () => {
  it('is registered once, in Year 3 maths, directly after y3-time', () => {
    expect(TOPICS.filter(t => t.id === 'y3-roman')).toHaveLength(1);
    expect(topic.year).toBe('year3');
    expect(topic.subject).toBe('maths');
    const ids = TOPICS.filter(t => t.year === 'year3').map(t => t.id);
    expect(ids.indexOf('y3-roman')).toBe(ids.indexOf('y3-time') + 1);
  });

  it('oracle: the card\'s target converts to the answer with fromRoman, and exactly one option does', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.options, q.prompt).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      if (q.visual?.type === 'word') {
        const target = fromRoman(q.visual.text)!;
        expect(q.options.filter(o => Number(o) === target), q.prompt).toHaveLength(1);
        expect(q.answer).toBe(String(target));
      } else {
        const m = q.prompt.match(/Roman numeral is (\d+)\?/);
        const target = m ? Number(m[1]) : q.prompt.includes('top') ? 12 : 6;
        expect(q.options.filter(o => fromRoman(o) === target), q.prompt).toHaveLength(1);
        expect(fromRoman(q.answer)).toBe(target);
      }
    }
  });

  it('every Roman option is canonical and every value is 1 to 12', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) for (const o of q.options) {
      const v = isRoman(o) ? fromRoman(o)! : Number(o);
      expect(Number.isInteger(v) && v >= 1 && v <= 12, `${q.prompt}: ${o}`).toBe(true);
    }
  });

  it('no say holds a raw numeral: a run of two or more Roman capitals, or the card\'s numeral as one token', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.say, q.prompt).toBeDefined();
      expect(q.say!, q.prompt).not.toMatch(/\b[IVXLCDM]{2,}\b/);
      if (q.visual?.type === 'word') expect(q.say).not.toContain(q.visual.text.length === 1 ? ` ${q.visual.text}?` : q.visual.text);
      expect(q.noSayAnswer === true || q.visual?.type === 'word', q.prompt).toBe(true);
    }
  });

  it('d1 reads numerals only; d2 writes numerals only', () => {
    expect(draws(1).every(q => q.visual?.type === 'word')).toBe(true);
    expect(draws(2).every(q => !q.visual && isRoman(q.answer))).toBe(true);
  });

  it('d3 draws only the listed forms and the clock cards', () => {
    const seen = new Set<string>();
    for (const q of draws(3)) {
      const target = q.visual?.type === 'word' ? q.visual.text : q.answer;
      seen.add(q.prompt.includes('clock') ? q.prompt : target);
      if (q.prompt.includes('clock')) expect(['XII', 'VI']).toContain(q.answer);
      else expect(HARD.has(target), target).toBe(true);
    }
    expect(seen.size).toBeGreaterThan(3);
    expect([...seen].some(s => s.includes('top'))).toBe(true);
    expect([...seen].some(s => s.includes('bottom'))).toBe(true);
  });

  it('carries the subtractive swap as a decoy (IV beside VI, IX beside XI)', () => {
    const q4 = draws(2).filter(q => q.answer === 'IV'), q9 = draws(2).filter(q => q.answer === 'IX');
    expect(q4.length).toBeGreaterThan(0);
    expect(q4.every(q => q.options.includes('VI'))).toBe(true);
    expect(q9.every(q => q.options.includes('XI'))).toBe(true);
  });
});
