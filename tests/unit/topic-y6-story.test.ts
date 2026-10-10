import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { BANK, MAX, runs, round } from '../../src/curriculum/year6-story';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { cardBudgetProblem } from './helpers/card-budget';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-story')!;
const draw = (d: Difficulty, n: number, seed = 1259) => { const r = rng(seed * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const num = (s: string) => Number(s.replace(/[^0-9]/g, ''));
const nums = (s: string) => [...s.matchAll(/\d[\d,]*/g)].map(m => Number(m[0].replace(/,/g, '')));
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const templateOf = (prompt: string) => BANK.find(t => new RegExp('^' + t[1].split('#').map(esc).join('\\d[\\d,]*') + ' ' + esc(t[2]) + '$').test(prompt))!;
const CEILING: Record<number, number> = { 1: 10000, 2: 100000 };
const isEstimate = (p: string) => p.includes('is about');

describe('y6-story (#1259)', () => {
  it('is the last Year 6 calc row, with 12 templates (4 adding and subtracting, 8 with × or ÷)', () => {
    expect([topic.year, topic.subject, topic.strand]).toEqual(['year6', 'maths', 'calc']);
    expect(TOPICS.filter(t => t.strand === 'calc' && t.year === 'year6').pop()!.id).toBe('y6-story');
    expect(BANK).toHaveLength(12);
    expect(BANK.filter(t => t[0].every(o => o === '+' || o === '-'))).toHaveLength(4);
    for (const t of BANK) expect(t[1].split('#').length - 1, t[1]).toBe(3);
  });

  it('hand-checked rows: fixed numbers give the answer and the first-step result', () => {
    // [text, numbers, first step, answer], worked by hand.
    const ROWS: Record<string, [number[], number, number]> = {
      'A library had #. It got #, gave away #.': [[4250, 875, 1300], 5125, 3825],
      'A shop had #. # sold, # delivered.': [[2000, 750, 1200], 1250, 2450],
      'A hall has #. # taken, then # more.': [[5000, 1200, 900], 3800, 2900],
      'A club had #. # joined, then # more.': [[1500, 320, 180], 1820, 2000],
      '# rows of # seats. # seats are empty.': [[24, 35, 186], 840, 654],
      '# boxes of # pens. # more pens arrive.': [[20, 15, 60], 300, 360],
      '# pens shared by # pupils. Each gets # more.': [[1200, 24, 15], 50, 65],
      '# apples in bags of #. # bags are sold.': [[960, 12, 30], 80, 50],
      '# red, # blue beads, shared by # pupils.': [[300, 500, 8], 800, 100],
      '# pens, # lost. The rest go in boxes of #.': [[800, 200, 6], 600, 100],
      '# adults and # children carry # bags each.': [[150, 250, 4], 400, 1600],
      '# pupils, # away. Each pupil here has # pens.': [[300, 30, 5], 270, 1350],
    };
    expect(BANK.map(t => t[1]).sort()).toEqual(Object.keys(ROWS).sort());
    for (const [ops, text] of BANK) {
      const [vals, first, answer] = ROWS[text], r = runs(ops, vals);
      expect([r[1], r[2]], text).toEqual([first, answer]);
    }
  });

  it('oracle d1–d2: the template\'s operations over the prompt\'s numbers give the answer; every step is a whole number above 0', () => {
    for (const d of [1, 2] as Difficulty[]) for (const c of draw(d, 400)) {
      const t = templateOf(c.prompt), v = nums(c.prompt), r = runs(t[0], v);
      expect(v).toHaveLength(3);
      for (const x of r) { expect(Number.isInteger(x), c.prompt).toBe(true); expect(x, c.prompt).toBeGreaterThan(0); expect(x).toBeLessThanOrEqual(CEILING[d]); }
      expect(num(c.answer), c.prompt).toBe(r[2]);
      expect(c.options).toContain(c.answer);
    }
  });

  it('d1 is adding and subtracting, d2 has a × or ÷ in every story, and every template is dealt', () => {
    for (const c of draw(1, 200)) expect(templateOf(c.prompt)[0].every(o => o === '+' || o === '-'), c.prompt).toBe(true);
    for (const c of draw(2, 400)) expect(templateOf(c.prompt)[0].some(o => o === '×' || o === '÷'), c.prompt).toBe(true);
    expect(new Set(draw(1, 400).map(c => templateOf(c.prompt)[1])).size).toBe(4);
    expect(new Set(draw(2, 800).map(c => templateOf(c.prompt)[1])).size).toBe(8);
  });

  it('d1–d2: the first-step result is always a decoy, with the last operation turned round; four distinct options', () => {
    for (const d of [1, 2] as Difficulty[]) for (const c of draw(d, 400)) {
      const t = templateOf(c.prompt), r = runs(t[0], nums(c.prompt)), opts = c.options.map(num);
      expect(opts, c.prompt).toContain(r[1]);
      expect(new Set(c.options).size).toBe(4);
      for (const o of opts) { expect(o).toBeGreaterThanOrEqual(1); expect(o).toBeLessThanOrEqual(CEILING[d]); }
    }
  });

  it('oracle d3: the answer is the rounded numbers combined (100s for 3 digits, 10s for 2, 1,000s for 4)', () => {
    for (const c of draw(3, 600)) {
      expect(isEstimate(c.prompt), c.prompt).toBe(true);
      const m = c.prompt.match(/^([\d,]+) ([+−×]) ([\d,]+) is about …\? Round each number first\.$/)!;
      const a = Number(m[1].replace(/,/g, '')), b = Number(m[3].replace(/,/g, ''));
      const place = (v: number) => v >= 1000 ? 1000 : v >= 100 ? 100 : 10;
      const ra = round(a, place(a)), rb = round(b, place(b));
      const est = m[2] === '+' ? ra + rb : m[2] === '−' ? ra - rb : ra * rb;
      expect(est, c.prompt).toBeGreaterThanOrEqual(1000);
      expect(num(c.answer), c.prompt).toBe(est);
      const opts = c.options.map(num);
      expect(opts.includes(est * 10) || opts.includes(est / 10), c.prompt).toBe(true);
      expect(new Set(c.options).size).toBe(4);
    }
  });

  it('d3 is all estimates and all slow; d1 and d2 are never slow', () => {
    for (const c of draw(3, 200)) expect(c.slow, c.prompt).toBe(true);
    for (const d of [1, 2] as Difficulty[]) for (const c of draw(d, 100)) { expect(isEstimate(c.prompt)).toBe(false); expect(c.slow, c.prompt).toBeFalsy(); }
  });

  it('every prompt fits the card (#1051), has a safe `say`, and no problem text is in the hint', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draw(d, 400)) {
      expect(c.prompt.length, c.prompt).toBeLessThanOrEqual(isEstimate(c.prompt) ? 70 : MAX + 12);
      expect(c.say, c.prompt).toBeTruthy();
      expect(sayIsSafe(c.say!), c.say).toBe(true);
      expect(cardBudgetProblem(c), c.prompt).toBeNull();
      expect(c.hint ?? '', c.prompt).not.toMatch(/\d/);
    }
  });

  it('distractors: ≤ 30 % unique units digit or leading digit at every difficulty (#1058)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d);
      expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.3);
      expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.3);
    }
  });
});
