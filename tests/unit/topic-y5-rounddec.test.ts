import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { parseNum, roundTo, compareDec } from '../../src/curriculum/ks2num';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-rounddec')!;
const draw = (d: Difficulty, n = 2000) => { const r = rng(1200 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => parseNum(s.replace('£', ''))!;
const given = (q: Question) => num(/Round (£?[\d.]+) /.exec(q.prompt)![1]);
/** Half-up rounding by string digits, independent of the generator's helper. */
function oracle(q: Question): string {
  const [, g] = /Round (£?[\d.]+) /.exec(q.prompt)!;
  const money = g.startsWith('£'), [i, f = ''] = g.replace('£', '').split('.');
  if (/one decimal place/.test(q.prompt)) {
    const t = Number(i + f[0]) + (Number(f[1]) >= 5 ? 1 : 0);
    return `${Math.floor(t / 10)}.${t % 10}`;
  }
  const w = Number(i) + (Number(f[0] ?? 0) >= 5 ? 1 : 0);
  return money ? `£${w}` : String(w);
}

const TABLE: [string, string][] = [
  ['Round 3.7 to the nearest whole number.', '4'], ['Round 12.5 to the nearest whole number.', '13'], ['Round 12.4 to the nearest whole number.', '12'],
  ['Round 12.49 to the nearest whole number.', '12'], ['Round 12.51 to the nearest whole number.', '13'], ['Round 0.5 to the nearest whole number.', '1'],
  ['Round 9.5 to the nearest whole number.', '10'], ['Round 99.4 to the nearest whole number.', '99'], ['Round £3.46 to the nearest pound.', '£3'],
  ['Round £3.50 to the nearest pound.', '£4'], ['Round 4.65 to one decimal place.', '4.7'], ['Round 3.96 to one decimal place.', '4.0'],
  ['Round 7.04 to one decimal place.', '7.0'], ['Round 1.05 to one decimal place.', '1.1'], ['Round 1.04 to one decimal place.', '1.0'],
  ['Round 8.95 to one decimal place.', '9.0'], ['Round 0.35 to one decimal place.', '0.4'], ['Round 2.34 to one decimal place.', '2.3'],
  ['Round 15.99 to one decimal place.', '16.0'], ['Round 6.25 to one decimal place.', '6.3'],
];

describe('y5-rounddec (#1200)', () => {
  it('is registered for Year 5 maths in the fractions strand', () => { expect(topic.year).toBe('year5'); expect(topic.subject).toBe('maths'); expect(topic.strand).toBe('fractions'); });

  it('the fixed 20-case table agrees with the oracle (and so does ks2num roundTo)', () => {
    expect(TABLE).toHaveLength(20);
    for (const [prompt, want] of TABLE) {
      expect(oracle({ prompt, answer: '', options: [] }), prompt).toBe(want);
      const n = num(/Round (£?[\d.]+) /.exec(prompt)![1]);
      const r = /one decimal/.test(prompt) ? roundTo(n, 0.1) : roundTo(n, 1);
      expect(compareDec(r, num(want)), prompt).toBe(0);
    }
  });

  it('every answer is half-up rounding, in the answer options, over 2,000 draws per difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(q.answer, q.prompt).toBe(oracle(q));
      expect(new Set(q.options).size).toBe(4); expect(q.options).toContain(q.answer);
    }
  });

  it('no decoy is worth the answer by value, and none is negative or has a float artefact', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) for (const o of q.options) {
      expect(o, q.prompt).not.toMatch(/\d{6,}|−|,/);
      if (o !== q.answer) expect(compareDec(num(o), num(q.answer)), q.prompt).not.toBe(0);
    }
  });

  it('d3 answers always show exactly one decimal place; d1 and d2 answers are whole', () => {
    for (const q of draw(3)) expect(q.answer, q.prompt).toMatch(/^\d+\.\d$/);
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d)) expect(q.answer, q.prompt).toMatch(/^£?\d+$/);
  });

  it('d1 asks one place, d2 two places and pounds, d3 two places to one', () => {
    for (const q of draw(1, 300)) expect(given(q).dp, q.prompt).toBe(1);
    for (const q of draw(2, 300)) expect(given(q).dp, q.prompt).toBe(2);
    expect(draw(2, 100).some(q => q.prompt.includes('£'))).toBe(true);
    expect(draw(2, 100).some(q => !q.prompt.includes('£'))).toBe(true);
    for (const q of draw(3, 300)) { expect(given(q).dp, q.prompt).toBe(2); expect(q.prompt).toMatch(/one decimal place/); }
  });

  it('each difficulty includes a half case, and d3 includes the 3.96 → 4.0 carry', () => {
    for (const d of [1, 2, 3] as Difficulty[]) expect(draw(d, 100).some(q => /\.5$|\.\d5$|\.50$/.test(q.prompt.match(/Round £?[\d.]+/)![0])), `d${d}`).toBe(true);
    expect(draw(3, 100).some(q => /\.0$/.test(q.answer) && parseNum(q.answer)!.v === 10 * (given(q).v >= 100 ? Math.ceil(given(q).v / 100) : 1) )).toBe(true);
  });

  it('the cut-off slip is offered when it differs from the answer', () => {
    for (const q of draw(3).filter(q => given(q).v % 10 >= 5)) {
      const g = given(q), trunc = `${Math.floor(g.v / 100)}.${Math.floor(g.v / 10) % 10}`;
      expect(q.options, q.prompt).toContain(trunc);
    }
  });

  it('a decoy shares the answer\'s last printed digit (leak limit)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const qs = draw(d), unshared = qs.filter(q => !q.options.some(o => o !== q.answer && o.slice(-1) === q.answer.slice(-1))).length;
      expect(unshared / qs.length, `d${d}`).toBeLessThanOrEqual(0.3);
    }
  });

  it('say is present and carries no raw pound sign or digit-dot pair', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 600)) { expect(q.say).toBeTruthy(); expect(q.say ?? '', q.prompt).not.toMatch(/£|\d\.\d/); }
  });
});
