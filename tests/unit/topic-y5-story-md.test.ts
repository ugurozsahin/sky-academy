import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { BANK, MAX } from '../../src/curriculum/year5-story-md';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { AVOID } from '../../src/curriculum/util';
import { cardBudgetProblem } from './helpers/card-budget';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y5-story-md')!;
const draw = (d: Difficulty, n: number, seed = 1193) => { const r = rng(seed * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/[^0-9]/g, ''));
const nums = (s: string) => [...s.matchAll(/\d[\d,]*/g)].map(m => Number(m[0].replace(/,/g, '')));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templateOf = (prompt: string) => BANK.flat().find(t => new RegExp('^' + t.text.split('#').map(esc).join('\\d[\\d,]*') + '$').test(prompt))!;

/** Hand-written, per wording: [answer, one-step slip] from the numbers in the prompt; the fraction words are a fixed table. */
const FRACTION: Record<string, number> = { tenth: 1 / 10, quarter: 1 / 4, 'Three quarters': 3 / 4, 'Three fifths': 3 / 5 };
const ORACLE: Record<string, (v: number[], text: string) => [number, number]> = {
  'A recipe for # uses # g of flour. How much for #?': v => [v[1] / v[0] * v[2], v[1] / v[0]],
  'A pump moves # litres a minute. How many litres in # minutes?': v => [v[0] * v[1], v[0]],
  '# pens cost £#. How much do # pens cost?': v => [v[1] / v[0] * v[2], v[1] / v[0]],
  'A car uses # litres to go # km. How far on # litres?': v => [v[1] / v[0] * v[2], v[1] / v[0]],
  '# tickets cost £#. What does 1 ticket cost?': v => [v[1] / v[0], v[1] / v[0]],
  'A runner covers # km in # hours. How far in 1 hour?': v => [v[0] / v[1], v[0] / v[1]],
  '# kg cost £#. How much do # kg cost?': v => [v[1] / v[0] * v[2], v[1] / v[0]],
  'A train takes # hours to go # km. How far in # hours?': v => [v[1] / v[0] * v[2], v[1] / v[0]],
};
for (const [text, word] of [['A model is a tenth of the height of a # m tower. How tall is it?', 'tenth'], ['A drawing is a quarter of the width of a # cm poster. How wide is it?', 'quarter'],
  ['Three quarters of a # km trail has been walked. How far?', 'Three quarters'], ['Three fifths of # sweets are red. How many are red?', 'Three fifths']] as const) {
  const unitFraction = word === 'tenth' || word === 'quarter';
  ORACLE[text] = v => [v[0] * FRACTION[word], unitFraction ? v[0] * FRACTION[word] : v[0] / (word === 'Three fifths' ? 5 : 4)];
}
const oracle = (prompt: string) => { const t = templateOf(prompt); return ORACLE[t.text](nums(prompt), t.text); };
const rank = (prompt: string) => BANK.findIndex(row => row.includes(templateOf(prompt))) + 1;

describe('y5-story-md (#1193)', () => {
  it('is registered for Year 5 maths, 12 templates, four at each difficulty, each with an oracle', () => {
    expect(topic.year).toBe('year5');
    expect(BANK.map(r => r.length)).toEqual([4, 4, 4]);
    expect(Object.keys(ORACLE).sort()).toEqual(BANK.flat().map(t => t.text).sort());
  });

  it('the oracle: the answer recomputed from the prompt, every division exact, over 2,000 draws per difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 2000)) {
      const [answer] = oracle(q.prompt);
      expect(Number.isInteger(answer), q.prompt).toBe(true);
      expect(num(q.answer), q.prompt).toBe(answer);
      expect(q.options).toContain(q.answer);
      expect(rank(q.prompt), q.prompt).toBe(d);
    }
  });

  it('the one-step slip is on every d3 card; options are four distinct positive whole numbers', () => {
    for (const q of draw(3, 600)) {
      const [answer, oneStep] = oracle(q.prompt);
      if (oneStep !== answer) expect(q.options.map(num), q.prompt).toContain(oneStep);
    }
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 300)) {
      expect(q.options).toHaveLength(4); expect(new Set(q.options).size).toBe(4);
      for (const o of q.options) { expect(num(o)).toBeGreaterThanOrEqual(1); expect(num(o)).toBeLessThanOrEqual(10000); }
    }
  });

  it('the story reads right: each number sits beside its own unit (#1897 round 1)', () => {
    const by = (prompt: string, re: RegExp) => { const m = prompt.match(re); return m ? Number(m[1].replace(/,/g, '')) : NaN; };
    const SPEED: [RegExp, RegExp, number, number][] = [
      [/A train takes (\d[\d,]*) hours to go/, /to go (\d[\d,]*) km/, 40, 80],   // km an hour
      [/A runner covers (\d[\d,]*) km/, /in (\d[\d,]*) hours/, 6, 14],
      [/A car uses (\d[\d,]*) litres/, /to go (\d[\d,]*) km/, 12, 25],
    ];
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 400)) {
      if (q.prompt.includes('train')) expect(q.prompt, 'the hours come first').toMatch(/^A train takes \d+ hours to go [\d,]+ km\. How far in \d+ hours\?$/);
      for (const [a, b, lo, hi] of SPEED) {
        if (!a.test(q.prompt)) continue;
        const x = by(q.prompt, a), y = by(q.prompt, b), per = a.source.includes('hours') && a.source.includes('train') ? y / x : a.source.includes('runner') ? x / y : y / x;
        expect(per, q.prompt).toBeGreaterThanOrEqual(lo); expect(per, q.prompt).toBeLessThanOrEqual(hi);
      }
      const kg = q.prompt.match(/^(\d+) kg cost £(\d+)\./);
      if (kg) expect(Number(kg[2]) / Number(kg[1]), q.prompt).toBeGreaterThanOrEqual(2);
    }
  });

  it('every template is dealt, only d3 is slow', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const qs = draw(d, 400);
      expect(new Set(qs.map(q => templateOf(q.prompt).text)).size).toBe(4);
      for (const q of qs) expect(!!q.slow, q.prompt).toBe(d === 3);
    }
  });

  it('every prompt is ≤ 90 characters, fits the card, has a safe `say` with no "/", and no personal names', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 500)) {
      expect(q.prompt.length, q.prompt).toBeLessThanOrEqual(MAX);
      expect(q.prompt).not.toContain('/');
      expect(q.say, q.prompt).toBeTruthy();
      expect(q.say).not.toContain('/');
      expect(sayIsSafe(q.say!), q.say).toBe(true);
      expect(cardBudgetProblem(q), q.prompt).toBeNull();
    }
  });

  it('no bank word is in the crude-word guard', () => {
    const words = BANK.flat().flatMap(t => t.text.toLowerCase().match(/[a-z]+/g) ?? []);
    for (const w of words) expect(AVOID.has?.(w) ?? (AVOID as unknown as string[]).includes(w), w).toBe(false);
  });

  it('distractors: ≤ 30 % unique units digit or leading digit at every difficulty (#1058)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.3);
      expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3);
    }
  });
});
