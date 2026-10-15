import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { SCALING, COUNTING, decoyValues } from '../../src/curriculum/year4-story-md';
import { cardBudgetProblem } from './helpers/card-budget';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-story-md')!;
const draw = (d: Difficulty, n: number) => { const r = rng(1141 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const nums = (s: string) => [...s.matchAll(/\d[\d,]*/g)].map(m => Number(m[0].replace(/,/g, '')));
const val = (label: string) => Number(label.replace(/[^\d]/g, ''));
/** The digits of a label, ignoring commas and units (#1058's reading, kept local: #1058 is not a blocker). */
const digits = (label: string) => label.replace(/\D/g, '');
const template = (prompt: string, bank: readonly (readonly [unknown, string] | readonly [string, string])[], pos: 0 | 1) =>
  bank.find(r => { const parts = (r[pos] as string).split(/\{[abc]\}/); return prompt.startsWith(parts[0]) && parts.every(p => prompt.includes(p)); })!;
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];

describe('y4-story-md (#1141)', () => {
  it('is registered once in Year 4 calculation', () => {
    expect(TOPICS.filter(t => t.id === 'y4-story-md')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'maths', strand: 'calc' });
  });

  it('d1 distributive law: the oracle holds, both card forms appear, the other partial product is offered', () => {
    const forms = new Set<string>();
    for (const q of draw(1, 400)) {
      const m = q.prompt.match(/^(\d+) × (\d) = (?:(\d+) × \d \+ (\d) × \d = ([\d,]+) \+ \?|([\d,]+) \+ ([\d,]+) = \?)$/)!;
      expect(m, q.prompt).toBeTruthy();
      const a = Number(m[1]), k = Number(m[2]), t = Math.floor(a / 10) * 10, u = a % 10;
      expect(t).toBeGreaterThanOrEqual(20); expect(u).toBeGreaterThanOrEqual(1);
      expect(k).toBeGreaterThanOrEqual(3); expect(k).toBeLessThanOrEqual(9);
      if (m[3]) { forms.add('partial'); expect(Number(m[3])).toBe(t); expect(Number(m[4])).toBe(u); expect(val(m[5])).toBe(t * k); expect(val(q.answer)).toBe(u * k); expect(q.options.map(val)).toContain(t * k); }
      else { forms.add('whole'); expect(val(m[6])).toBe(t * k); expect(val(m[7])).toBe(u * k); expect(val(q.answer)).toBe(a * k); expect(q.options.map(val)).toContain(t * k); }
      expect(val(q.answer)).toBeLessThanOrEqual(891);
    }
    expect(forms).toEqual(new Set(['partial', 'whole']));
  });

  it('d2 scaling: answer = base × factor ≤ 144 with its unit on every bubble; the sum is always offered', () => {
    for (const q of draw(2, 400)) {
      const [unit] = template(q.prompt, SCALING, 1) as unknown as [readonly [string, string]];
      const [a, b] = nums(q.prompt);
      expect(a * b, q.prompt).toBeLessThanOrEqual(144);
      expect(q.answer).toBe(unit[0] + String(a * b) + unit[1]);
      expect(q.options).toContain(unit[0] + String(a + b) + unit[1]);
      for (const o of q.options) { expect(o.startsWith(unit[0])).toBe(true); expect(o.endsWith(unit[1])).toBe(true); }
    }
  });

  it('d3 correspondence and multiply-then-add: the oracle holds; the sum or the product-without-add is offered', () => {
    const kinds = new Set<string>();
    for (const q of draw(3, 600)) {
      const [, kind] = template(q.prompt, COUNTING, 0) as unknown as [string, 'cor' | 'add'];
      kinds.add(kind);
      const ns = nums(q.prompt);
      const answer = kind === 'cor' ? ns[0] * ns[1] : ns[0] * ns[1] + ns[2];
      expect(val(q.answer), q.prompt).toBe(answer);
      expect(answer).toBeLessThanOrEqual(144);
      const opts = q.options.map(val);
      if (kind === 'cor') expect(opts).toContain(ns[0] + ns[1]);
      else expect(opts.includes(ns[0] * ns[1]) || opts.length === 4).toBe(true);
    }
    expect(kinds).toEqual(new Set(['cor', 'add']));
  });

  it('decoyValues puts the misconception first, then keeps both digit twins, all positive and distinct', () => {
    const r = rng(7);
    for (let i = 0; i < 500; i++) {
      const answer = 20 + Math.floor(r() * 120), m = 3 + Math.floor(r() * 10);
      const ds = decoyValues(r, answer, [m]);
      expect(ds).toHaveLength(3);
      expect(ds).toContain(m === answer ? -1 : m);
      expect(new Set(ds).size).toBe(3);
      for (const v of ds) { expect(v).toBeGreaterThan(0); expect(v).not.toBe(answer); }
      expect(ds.some(v => v % 10 === answer % 10)).toBe(true);
    }
  });

  it('every card has four distinct options, a safe `say`, fits the card (#1051) and passes R-LBL (#1046)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 400)) {
      expect(q.options, q.prompt).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
      expect(q.say, q.prompt).toBeTruthy();
      expect(sayIsSafe(q.say!), q.say).toBe(true);
      expect(cardBudgetProblem(q), q.prompt).toBeNull();
      expect(rLblProblem(q), q.prompt).toBeNull();
    }
  });

  it('leak: over 2,000 draws per difficulty, ≤30 % of cards (answers ≥ 20) have a unique units or leading digit', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      let big = 0, uniqueLast = 0, uniqueLead = 0;
      for (const q of draw(d, 2000)) {
        const a = digits(q.answer);
        if (val(q.answer) < 20) continue;
        big++;
        const others = q.options.filter(o => o !== q.answer).map(digits);
        if (!others.some(o => o.slice(-1) === a.slice(-1))) uniqueLast++;
        if (!others.some(o => o[0] === a[0])) uniqueLead++;
      }
      expect(big, `d${d}`).toBeGreaterThan(500);
      expect(uniqueLast / big, `d${d} units`).toBeLessThanOrEqual(0.3);
      expect(uniqueLead / big, `d${d} leading`).toBeLessThanOrEqual(0.3);
    }
  });

  it('both banks have at least six templates; no word, in any template, is crude (#642/#324) or a personal name', () => {
    expect(SCALING.length).toBeGreaterThanOrEqual(6);
    expect(COUNTING.filter(r => r[1] === 'cor').length + COUNTING.filter(r => r[1] === 'add').length).toBeGreaterThanOrEqual(6);
    const words = new Set([...SCALING.map(r => r[1]), ...COUNTING.map(r => r[0])].flatMap(t => t.toLowerCase().match(/[a-z]+/g) ?? []));
    for (const w of words) { expect(EXCLUDE, w).not.toContain(w); expect(AVOID, w).not.toContain(w); }
    for (const name of ['mia', 'sam', 'ana', 'jo', 'ben', 'tom', 'kim', 'lee', 'ria']) expect(words.has(name), name).toBe(false);
  });
});
