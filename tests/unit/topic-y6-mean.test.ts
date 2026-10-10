import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-mean')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1251 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const nums = (s: string) => (s.split(/[:.]\s/).pop() ?? s).split(', ').map(Number);
const isMissing = (q: Question) => q.prompt === 'The missing number?';
/** Mean in tenths, so 4.5 is 45: no float ever decides a comparison. */
const tenths = (s: string) => { const [i, f = ''] = s.split('.'); return Number(i) * 10 + Number(f.padEnd(1, '0')); };

/** The independent recomputation, from the card's own hint. */
function expected(q: Question): { answer: number; total: number } {
  if (isMissing(q)) {
    const m = /^Mean (\d+) of (\d+) numbers\. Known: (.*)$/.exec(q.hint!)!;
    const known = m[3].split(', ').map(Number);
    return { answer: (Number(m[2]) * Number(m[1]) - known.reduce((a, b) => a + b, 0)) * 10, total: Number(m[2]) * Number(m[1]) * 10 };
  }
  const xs = nums(q.hint!), total = xs.reduce((a, b) => a + b, 0);
  return { answer: total * 10 / xs.length, total: total * 10 };
}

describe('y6-mean (#1251)', () => {
  it('is registered for Year 6 maths in the stats strand', () => { expect(topic).toMatchObject({ year: 'year6', subject: 'maths', strand: 'stats' }); });

  it('every card has four distinct options including the answer, a data hint and a speakable say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(4); expect(q.options).toContain(q.answer);
      expect(q.hintIsData).toBe(true); expect(q.hint).not.toContain(' · '); expect(q.prompt.length).toBeLessThanOrEqual(60);
      expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true);
    }
  });

  it('oracle: every answer equals the recomputation from the hint, 300 draws per difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) expect(tenths(q.answer), q.hint).toBe(expected(q).answer);
  });

  it('the total (not divided) is an option on every card where it differs from the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) expect(q.options.map(tenths), q.hint).toContain(expected(q).total);
  });

  it('means are whole at d1–d2 and have at most one decimal place, no artefacts, at d3', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d)) expect(q.answer, q.hint).toMatch(/^\d+$/);
    let dec = 0;
    for (const q of draw(3)) { expect(q.answer).toMatch(/^\d+(\.\d)?$/); if (q.answer.includes('.')) dec++; }
    expect(dec).toBeGreaterThan(50);
  });

  it('keeps the d1–d3 ranges and shapes', () => {
    for (const q of draw(1)) { const xs = nums(q.hint!); expect(xs).toHaveLength(3); expect(Math.max(...xs)).toBeLessThanOrEqual(20); }
    for (const q of draw(2)) { const xs = nums(q.hint!); expect(xs.length).toBeGreaterThanOrEqual(4); expect(xs.length).toBeLessThanOrEqual(6); expect(Math.max(...xs)).toBeLessThanOrEqual(100); }
    expect(draw(3).filter(isMissing).length).toBeGreaterThan(50);
  });

  it('#1058 leak limit: no digit of the answer is unshared more than 30% of the time', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const s = leakShares(topic.gen, d); expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.3); expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3); }
  });
  it('the hint values stay out of the prompt, and say speaks exactly the hint numbers (plus the stated mean and count)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      for (const n of q.hint!.match(/\d+/g)!) expect(q.prompt, q.hint).not.toMatch(new RegExp(`(?<!\\d)${n}(?!\\d)`));
      const spoken = (q.say!.match(/\d+/g) ?? []).sort().join(' '), hinted = (q.hint!.match(/\d+/g) ?? []).sort().join(' ');
      expect(spoken, q.say).toBe(hinted);
    }
  });

  it('d3 missing value: the other numbers number n − 1, and the answer differs from the mean', () => {
    const cards = draw(3).filter(isMissing);
    for (const q of cards) {
      const m = /^Mean (\d+) of (\d+) numbers\. Known: (.*)$/.exec(q.hint!)!;
      expect(m[3].split(', ')).toHaveLength(Number(m[2]) - 1);
      expect(Number(q.answer)).toBeGreaterThanOrEqual(1); expect(q.answer).not.toBe(m[1]);
      expect(q.say).toContain(['', '', 'two', 'three', 'four'][Number(m[2]) - 1] + ' of them');
    }
  });
});
