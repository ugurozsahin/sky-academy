import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-sequences')!;
const draw = (d: Difficulty, n = 300) => { const r = rng(1271 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
/** Hundredths from a printed label, so no float decides a comparison. */
const h = (s: string) => { const m = /^(−?)(\d+)(?:\.(\d+))?$/.exec(s.replace(/,/g, ''))!; return (m[1] ? -1 : 1) * (Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'))); };
const shown = (q: Question) => (q.prompt.replace(/^Term after next: /, '').replace(/^Which rule makes /, '').replace(/[?]$/, '').replace(/, $/, '')).split(', ').filter(x => x !== '').map(h);
const after = (q: Question) => q.prompt.startsWith('Term after next') ? 2 : 1;
/** Rule "+ 3" / "− 3" / "× 2" applied to a pair. */
const fits = (r: string, a: number, b: number) => { const [op, n] = r.split(' '), v = Number(n) * 100; return op === '+' ? b - a === v : op === '−' ? a - b === v : op === '×' ? b === a * Number(n) : false; };

describe('y6-sequences (#1271)', () => {
  it('is registered for Year 6 maths in the algebra strand', () => { expect(topic).toMatchObject({ year: 'year6', subject: 'maths', strand: 'algebra' }); });

  it('every card has four distinct options including the answer and a speakable say; the prompt stays visible', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(4); expect(q.options).toContain(q.answer);
      expect(q.sequence).toBeUndefined(); expect(q.prompt.length).toBeLessThanOrEqual(60);
      expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true);
    }
  });

  it('oracle: d1–d2 answers continue the arithmetic sequence t(k) = t(1) + (k − 1)·step', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d)) {
      const t = shown(q), step = t[1] - t[0];
      expect(t).toHaveLength(4);
      t.forEach((v, i) => expect(v, q.prompt).toBe(t[0] + i * step));
      expect(h(q.answer), q.prompt).toBe(t[0] + (3 + after(q)) * step);
    }
  });

  it('d1 is rising with start 1–50, step 2–12 and an answer of at most 200', () => {
    for (const q of draw(1)) { const t = shown(q), s = t[1] - t[0]; expect(t[0]).toBeGreaterThanOrEqual(100); expect(t[0]).toBeLessThanOrEqual(5000); expect(s).toBeGreaterThanOrEqual(200); expect(s).toBeLessThanOrEqual(1200); expect(h(q.answer)).toBeLessThanOrEqual(20000); expect(after(q)).toBe(1); }
  });

  it('d2 draws zero-crossing, 0.5 / 0.25-step, falling and term-after-next cards, with no float artefact and no ASCII hyphen', () => {
    const cards = draw(2);
    const all = (q: Question) => [...shown(q), h(q.answer)];
    expect(cards.filter(q => all(q).some(v => v < 0) && all(q).some(v => v > 0)).length).toBeGreaterThan(20);
    expect(cards.filter(q => [50, 25].includes(Math.abs(shown(q)[1] - shown(q)[0]))).length).toBeGreaterThan(20);
    expect(cards.filter(q => shown(q)[1] < shown(q)[0]).length).toBeGreaterThan(20);
    expect(cards.filter(q => after(q) === 2).length).toBeGreaterThan(20);
    for (const q of cards) for (const o of [...q.options, q.prompt]) { expect(o, o).not.toMatch(/\.\d{3}|\d-\d|(^|[ ,])-\d/); }
    for (const q of cards) for (const o of q.options) expect(o, o).toMatch(/^−?\d+(\.\d{1,2})?$/);
  });

  it('d3: exactly one option rule fits every consecutive pair of the shown terms (#666 class)', () => {
    for (const q of draw(3)) {
      const t = shown(q);
      expect(t).toHaveLength(4); expect(q.optionsAreContent).toBe(true);
      const fitting = q.options.filter(o => t.slice(1).every((v, i) => fits(o, t[i], v)));
      expect(fitting, q.prompt).toEqual([q.answer]);
    }
  });

  it('d3 distractors include the wrong sign, and a multiplicative rule that fits the first pair only where possible', () => {
    const cards = draw(3);
    expect(cards.filter(q => q.options.some(o => o.startsWith('×'))).length).toBe(cards.length);
    expect(cards.filter(q => { const t = shown(q); return q.options.some(o => o.startsWith('×') && fits(o, t[0], t[1])); }).length).toBeGreaterThan(20);
    for (const q of cards) { const a = q.answer, flip = (a[0] === '+' ? '−' : '+') + a.slice(1); expect(q.options, q.prompt).toContain(flip); }
  });

  it('the step added twice is an option on every d1 card', () => {
    for (const q of draw(1)) { const t = shown(q), s = t[1] - t[0]; expect(q.options.map(h), q.prompt).toContain(t[3] + 2 * s); }
  });

  it('#1058 leak limit: no digit of the answer is unshared more than 30% of the time', () => {
    for (const d of [1, 2, 3] as Difficulty[]) { const s = leakShares(topic.gen, d); expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.3); expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3); }
  });
});
