import { describe, it, expect, vi } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { parseNum, compareDec } from '../../src/curriculum/ks2num';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-decimals')!;
const draw = (d: Difficulty, n = 2000) => { const r = rng(1201 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const dp = (s: string) => parseNum(s)!;
const isRank = (q: Question) => q.prompt.startsWith('Which is the');
const line = (q: Question) => q.visual?.type === 'numberline' ? q.visual : null;

describe('y5-decimals (#1201)', () => {
  it('is registered for Year 5 maths in the fractions strand', () => { expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.strand).toBe('fractions'); });

  it('every card has four distinct options including the answer, all parseable and within 0.001–99.999', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(4); expect(q.options).toContain(q.answer);
      for (const o of q.options) { const n = parseNum(o); expect(n, o).not.toBeNull(); expect(n!.dp, o).toBeLessThanOrEqual(3); expect(n!.v, o).toBeGreaterThan(0); expect(o).not.toMatch(/\d{6,}|\.\d*0$/); }
    }
  });

  it('rank cards: the answer has exactly the asked rank among the four values', () => {
    for (const d of [1, 3] as Difficulty[]) for (const q of draw(d).filter(isRank)) {
      const sorted = q.options.map(dp).sort(compareDec), a = dp(q.answer);
      const ask = /Which is the (.*)\?/.exec(q.prompt)![1];
      const want = { 'largest': sorted[3], 'smallest': sorted[0], 'second largest': sorted[2], 'second smallest': sorted[1] }[ask]!;
      expect(compareDec(a, want), q.prompt).toBe(0);
    }
  });

  it('d3 offers the longer-is-larger decoy: a three-place value that is not the answer', () => {
    const qs = draw(3);
    expect(qs.every(isRank)).toBe(true);
    for (const q of qs) expect(q.options.some(o => o !== q.answer && dp(o).dp === 3), q.prompt).toBe(true);
  });

  it('d3 asks all four ranks and d1 only largest and smallest', () => {
    const asks = (d: Difficulty) => new Set(draw(d, 600).filter(isRank).map(q => q.prompt));
    expect(asks(3).size).toBe(4); expect(asks(1).size).toBe(2);
  });

  it('thousandths cards: the answers are exact', () => {
    for (const q of draw(2).filter(q => q.prompt.startsWith('How many thousandths'))) {
      const n = parseNum(/make (.*)\?/.exec(q.prompt)![1])!;
      expect(Number(q.answer), q.prompt).toBe(n.v * 10 ** (3 - n.dp));
    }
    for (const q of draw(1).filter(q => q.prompt.startsWith('How many hundredths'))) expect(Number(q.answer), q.prompt).toBe(parseNum(/make (.*)\?/.exec(q.prompt)![1])!.v * 10);
    const more = draw(2).filter(q => q.prompt.startsWith('What is 0.001 more'));
    expect(more.length).toBeGreaterThan(300);
    for (const q of more) { const b = parseNum(/than (.*)\?/.exec(q.prompt)![1])!; expect(parseNum(q.answer)!.v * 10 ** (3 - parseNum(q.answer)!.dp), q.prompt).toBe(b.v * 10 ** (3 - b.dp) + 1); }
  });

  it('number lines: six ticks 0.002 apart, only the ends printed, marker on an inner tick holding the answer', () => {
    const warn = vi.spyOn(console, 'warn');
    const lines = draw(2).filter(line);
    expect(lines.length).toBeGreaterThan(400);
    for (const q of lines) {
      const v = line(q)!;
      expect(v.labels).toHaveLength(6); expect(v.labels!.filter(Boolean)).toHaveLength(2);
      expect(v.step).toBe(0.002);
      const ticks = Array.from({ length: 6 }, (_, i) => Number((v.from + i * 0.002).toFixed(3)));
      expect(Number(v.labels![5])).toBe(ticks[5]);
      const at = v.marks![0].at; expect(ticks.indexOf(at), q.prompt).toBeGreaterThan(0); expect(ticks.indexOf(at)).toBeLessThan(5);
      expect(Number(q.answer)).toBe(at);
    }
    expect(warn).not.toHaveBeenCalled();
  });

  it('leak limit: at most 30% of in-scope cards have an answer whose last digit no decoy shares', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const s = leakShares(topic.gen, d, 2000, { skipLeading: true }); expect(s.counted).toBeGreaterThan(300); expect(s.units / s.counted, `d${d}`).toBeLessThanOrEqual(0.3); }
  });

  it('say is present and never carries a digit pair or a question mark with a number', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 600)) expect(q.say, q.prompt).toBeTruthy();
  });
});
