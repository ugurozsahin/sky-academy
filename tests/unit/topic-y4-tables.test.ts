import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { rLblProblem } from './helpers/r-lbl';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/** STA Multiplication Tables Check, assessment framework §5.2.1 Table 1 (maximum items per table), hard-coded as the oracle. */
const STA_TABLE_1: Record<number, number> = { 2: 2, 3: 3, 4: 3, 5: 3, 6: 4, 7: 4, 8: 4, 9: 4, 10: 2, 11: 3, 12: 4 };
const PRODUCTS = new Set(Array.from({ length: 11 }, (_, i) => i + 2).flatMap(a => Array.from({ length: 11 }, (_, j) => a * (j + 2))));

const topic = TOPICS.find(t => t.id === 'y4-tables')!;
const isReverse = (c: { prompt: string }) => c.prompt.startsWith('Which makes');   // #1127
const allDraws = (d: Difficulty, seed: number, n = 400) => { const r = rng(seed + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
/** The forward cards only: the original #1070 oracle reads a calculation off the prompt. */
const draws = (d: Difficulty, seed: number, n = 400) => allDraws(d, seed, n * 3 / 2).filter(c => !isReverse(c));

/** Independent oracle: the table, the other factor and the answer, read from the prompt alone. */
function parse(prompt: string) {
  let m = prompt.match(/^(\d+) × (\d+) = \?$/);
  if (m) return { form: 'mul', t: Number(m[1]), n: Number(m[2]), answer: Number(m[1]) * Number(m[2]) };
  m = prompt.match(/^(\d+) ÷ (\d+) = \?$/);
  if (m) return { form: 'div', t: Number(m[2]), n: Number(m[1]) / Number(m[2]), answer: Number(m[1]) / Number(m[2]) };
  m = prompt.match(/^\? × (\d+) = (\d+)$/);
  expect(m, prompt).toBeTruthy();
  return { form: 'missing', t: Number(m![2]) / Number(m![1]), n: Number(m![1]), answer: Number(m![2]) / Number(m![1]) };
}

const fwd = (d: Difficulty, r: () => number) => { let c; do c = topic.gen(d, r); while (isReverse(c)); return c; };   // #1058's stat leaves reverse cards out (#1127)
const val = (label: string) => { const m = /^(\d+) ([×÷]) (\d+)$/.exec(label)!; expect(m, label).toBeTruthy(); return { a: +m[1], op: m[2], b: +m[3] }; };

describe('y4-tables (#1070)', () => {
  it('is registered once, in Year 4', () => {
    expect(TOPICS.filter(t => t.id === 'y4-tables')).toHaveLength(1);
    expect(topic.year).toBe('year4');
  });

  it('every answer matches the prompt, factors are 2–12, quotients are whole, options are distinct and short', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1070_100)) {
      const { t, n, answer } = parse(c.prompt);
      expect(Number(c.answer), c.prompt).toBe(answer);
      expect(Number.isInteger(answer) && Number.isInteger(t) && Number.isInteger(n), c.prompt).toBe(true);
      expect(t >= 2 && t <= 12 && n >= 2 && n <= 12, c.prompt).toBe(true);
      expect(c.options.filter(o => o === c.answer), c.prompt).toHaveLength(1);
      expect(new Set(c.options).size, c.prompt).toBe(4);
      for (const o of c.options) expect(o.length, c.prompt).toBeLessThanOrEqual(3);
    }
  });

  it('d1 uses the 6 and 11 tables, d2 the 7, 9 and 12, both × and ÷ only', () => {
    for (const [d, tables] of [[1, [6, 11]], [2, [7, 9, 12]]] as [Difficulty, number[]][]) {
      const seen = new Set<number>(), forms = new Set<string>();
      for (const c of draws(d, 1070_200)) { const p = parse(c.prompt); seen.add(p.t); forms.add(p.form); }
      expect([...seen].sort((a, b) => a - b)).toEqual(tables);
      expect([...forms].sort()).toEqual(['div', 'mul']);
    }
  });

  it('d3 draws all three forms and every table 2–12', () => {
    const forms = new Set<string>(), tables = new Set<number>();
    for (const c of draws(3, 1070_300, 1000)) { const p = parse(c.prompt); forms.add(p.form); tables.add(p.t); }
    expect([...forms].sort()).toEqual(['div', 'missing', 'mul']);
    expect(tables.size).toBe(11);
  });

  it('d3 table frequencies sit within ±2 points of the STA Table 1 weights', () => {
    const total = Object.values(STA_TABLE_1).reduce((a, b) => a + b, 0);
    const counts: Record<number, number> = {};
    const all = draws(3, 1070_400, 10000);
    for (const c of all) { const { t } = parse(c.prompt); counts[t] = (counts[t] ?? 0) + 1; }
    for (const [t, w] of Object.entries(STA_TABLE_1)) {
      expect(Math.abs((counts[Number(t)] ?? 0) / all.length - w / total) * 100, `table ${t}`).toBeLessThan(2);
    }
  });

  it('product cards carry a neighbouring fact among the decoys', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1070_500)) {
      const p = parse(c.prompt);
      if (p.form !== 'mul') continue;
      // A neighbour is only on offer when both factors stay in 2–12; at the edge (2 × 2, 12 × 12) some are missing.
      const pairs = [[p.t - 1, p.n], [p.t + 1, p.n], [p.t, p.n - 1], [p.t, p.n + 1]].filter(([x, y]) => x >= 2 && x <= 12 && y >= 2 && y <= 12);
      const legal = pairs.map(([x, y]) => x * y).filter(v => v !== p.answer);
      expect(c.options.some(o => legal.includes(Number(o))), c.prompt).toBe(true);
    }
  });

  it('every product option is a real 2–12 table product', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1070_600)) {
      if (parse(c.prompt).form !== 'mul') continue;
      for (const o of c.options) expect(PRODUCTS.has(Number(o)), `${c.prompt} → ${o}`).toBe(true);
    }
  });

  it('division and missing-factor cards keep every option in 2–12 and offer x±1 and the other factor', () => {
    let checked = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1070_700, 600)) {
      const p = parse(c.prompt);
      if (p.form === 'mul') continue;
      const other = p.form === 'div' ? p.t : p.n;
      const wanted = [...new Set([p.answer - 1, p.answer + 1, other])].filter(v => v >= 2 && v <= 12 && v !== p.answer);
      const opts = c.options.map(Number);
      for (const o of opts) expect(o >= 2 && o <= 12, `${c.prompt} → ${o}`).toBe(true);
      // Three decoys: the wanted ones come first, so min(3, wanted) of them must be on offer.
      expect(wanted.filter(v => opts.includes(v)).length, c.prompt).toBe(wanted.length);
      checked++;
    }
    expect(checked).toBeGreaterThan(300);
  });

  it('≤30% of product cards of 20 or more have a unique units or leading digit', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const { units, leading, counted } = leakShares(fwd, d, 2000);
      expect(counted, `d${d}`).toBeGreaterThan(0);
      expect(units, `d${d} units`).toBeLessThanOrEqual(0.3);
      expect(leading, `d${d} leading`).toBeLessThanOrEqual(0.3);
    }
  });
});

describe('y4-tables reverse cards, "Which makes P?" (#1127)', () => {
  const rev = (d: Difficulty, n = 3000) => allDraws(d, 1127_100, n).filter(isReverse);

  it('d1 draws none; d2 and d3 draw about one card in three, half × and half ÷', () => {
    expect(allDraws(1, 1127_200, 600).filter(isReverse)).toHaveLength(0);
    for (const d of [2, 3] as Difficulty[]) {
      const all = allDraws(d, 1127_300, 6000), r = all.filter(isReverse);
      expect(Math.abs(r.length / all.length - 1 / 3), `d${d} share`).toBeLessThan(0.05);
      const mul = r.filter(c => c.answer.includes('×')).length;
      expect(Math.abs(mul / r.length - 0.5), `d${d} × share`).toBeLessThan(0.05);
      expect(r.length - mul).toBe(r.filter(c => c.answer.includes('÷')).length);
    }
  });

  it('exactly one option makes the target; every factor is 2–12; every ÷ option is a whole quotient', () => {
    for (const d of [2, 3] as Difficulty[]) for (const c of rev(d)) {
      const target = +/^Which makes (\d+)\?$/.exec(c.prompt)![1];
      expect(c.options).toHaveLength(4);
      expect(new Set(c.options).size, c.prompt).toBe(4);
      const makes = c.options.filter(o => { const { a, op, b } = val(o); return (op === '×' ? a * b : a / b) === target; });
      expect(makes, c.prompt).toEqual([c.answer]);
      for (const o of c.options) {
        const { a, op, b } = val(o);
        if (op === '×') expect(a >= 2 && a <= 12 && b >= 2 && b <= 12, o).toBe(true);
        else { expect(a % b, o).toBe(0); expect(b >= 2 && b <= 12 && a / b >= 2 && a / b <= 12, o).toBe(true); }
      }
      expect(new Set(c.options.map(o => val(o).op)).size, 'one operation per card').toBe(1);
      expect(c.say, c.prompt).toMatch(/^Which (fact|division) makes \d+\?$/);
    }
  });

  it('decoys are neighbouring table steps, never another factorisation of the target', () => {
    for (const d of [2, 3] as Difficulty[]) for (const c of rev(d)) {
      const t = val(c.answer);
      for (const o of c.options.filter(x => x !== c.answer)) {
        const v = val(o);
        if (t.op === '×') expect(Math.abs(v.a - t.a) + Math.abs(v.b - t.b), `${c.answer} / ${o}`).toBeLessThanOrEqual(2);
        else expect(Math.abs(v.a / v.b - t.a / t.b), `${c.answer} / ${o}`).toBeLessThanOrEqual(4);
      }
    }
  });

  it('labels are wide and every one passes R-LBL (#1046)', () => {
    for (const d of [2, 3] as Difficulty[]) for (const c of rev(d, 1500)) {
      expect(c.wide, c.prompt).toBe(true);
      expect(rLblProblem(c), c.prompt).toBeNull();
    }
  });

  it('the drills never draw a reverse card', async () => {
    const { TOPICS } = await import('../../src/curriculum');
    for (const t of TOPICS.filter(x => /^y4-tables-\d+$/.test(x.id))) {
      const r = rng(1127_400);
      for (const d of [1, 2, 3] as Difficulty[]) for (let i = 0; i < 300; i++) expect(isReverse(t.gen(d, r)), t.id).toBe(false);
    }
  });
});
