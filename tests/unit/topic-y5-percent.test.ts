import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { parseNum } from '../../src/curriculum/ks2num';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-percent')!;
const draw = (d: Difficulty, n = 2000) => { const r = rng(1202 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
/** A label's value in millionths, exactly: "37%" and "0.37" and "37" (the ?/100 card's answer) all come to 370000. */
const U = 10 ** 6;
function value(label: string, q: Question): number {
  if (label.endsWith('%')) { const n = parseNum(label.slice(0, -1))!; return n.v * 10 ** (4 - n.dp); }
  if (/^\d+\/\d+$/.test(label)) { const [n, d] = label.split('/').map(Number); return n * U / d; }
  const n = parseNum(label)!;
  return q.prompt.endsWith('/100') ? n.v * 10 ** 4 : n.v * 10 ** (6 - n.dp);
}
/** The value the prompt is asking about, in millionths. */
function target(q: Question): number {
  const m = q.prompt.match(/^(\S+) = \?/) ?? q.prompt.match(/^Write (\S+) as/);
  if (!m) throw new Error(q.prompt);
  return value(m[1].replace(/\/100$/, ''), { ...q, prompt: '' });
}
const OK = new Set(['1/2', '1/4', '1/5', '2/5', '4/5']);
const NC_BOTTOMS = new Set([10, 20, 25, 50]);

describe('y5-percent (#1202)', () => {
  it('is registered for Year 5 maths in the fractions strand', () => { expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.strand).toBe('fractions'); });

  it('d1 draws a 10 × 10 grid with no mirror line, and the answer is the shaded count', () => {
    for (const q of draw(1)) {
      const v = q.visual as { type: string; grid: string[]; mirror?: false };
      expect(v.type).toBe('symmetry'); expect(v.mirror).toBe(false);
      expect(v.grid.length).toBe(10); for (const r of v.grid) expect(r).toMatch(/^[#.]{10}$/);
      expect(q.answer).toBe(`${v.grid.join('').split('#').length - 1}%`);
    }
  });

  it('every answer has the right value and exactly one option has it, over 2,000 draws per difficulty', () => {
    for (const d of [2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size).toBe(4); expect(q.options).toContain(q.answer);
      const v = target(q);
      expect(value(q.answer, q), q.prompt).toBe(v);
      expect(q.options.filter(o => value(o, q) === v), q.prompt).toEqual([q.answer]);
    }
    for (const q of draw(1)) expect(new Set(q.options).size).toBe(4);
  });

  it('d3 fractions come only from 1/2, 1/4, 1/5, 2/5, 4/5 and tenths, twentieths, twenty-fifths and fiftieths', () => {
    let seen = 0;
    for (const q of draw(3)) { const m = q.prompt.match(/^(\d+)\/(\d+) = \?/); if (!m) continue; seen++; expect(OK.has(`${m[1]}/${m[2]}`) || NC_BOTTOMS.has(+m[2]), q.prompt).toBe(true); }
    expect(seen).toBeGreaterThan(500);
  });

  it('the concatenation decoy (4/5 → 45%) is offered whenever it differs', () => {
    const qs = draw(3).filter(q => /^\d+\/\d+ = \?%$/.test(q.prompt));
    const withConcat = qs.filter(q => { const [n, d] = q.prompt.split(' = ')[0].split('/'); return q.options.includes(`${n}${d}%`); });
    expect(withConcat.length).toBeGreaterThan(qs.length * 0.5);
  });

  it('whole-number answers of 20 or more, and decimal answers, share a last digit with a decoy (leak limit)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      let n = 0, leaks = 0;
      for (const q of draw(d)) {
        const a = q.answer.replace('%', '');
        if (!(a.includes('.') || +a >= 20)) continue;
        n++; if (!q.options.some(o => o !== q.answer && o.replace('%', '').slice(-1) === a.slice(-1))) leaks++;
      }
      expect(leaks, `d${d}`).toBeLessThanOrEqual(n * 0.3);
    }
  });

  it('say never carries a raw fraction, a percent sign or a question mark', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 600)) { expect(q.say).toBeTruthy(); expect(q.say ?? '').not.toMatch(/\d\/\d|%|\?\/|=/); }
  });
});
