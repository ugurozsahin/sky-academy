import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { AVOID } from '../../src/curriculum/util';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { PLAIN, TRAPS, OPS, apply, agreeing } from '../../src/curriculum/year4-whichop';
import type { Op } from '../../src/curriculum/year4-whichop';
import { cardBudgetProblem } from './helpers/card-budget';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-whichop')!;
const draw = (d: Difficulty, n = 2000) => { const r = rng(1172 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const nums = (s: string) => [...s.matchAll(/\d[\d,]*/g)].map(m => Number(m[0].replace(/,/g, '')));
const split = (s: string) => s.split(/\{[ab]\}/);
const rowOf = (prompt: string) => [...PLAIN, ...TRAPS].find(r => { const parts = split(r[0]); return parts.every(p => prompt.includes(p)) && prompt.startsWith(parts[0]); })!;
// `AVOID` is a gap-spelling denylist and lists no crude whole words (G13): a short local set too.
const EXCLUDE = ['gay', 'queer', 'bitch', 'butt'];

describe('y4-whichop (#1172)', () => {
  it('is registered once in Year 4 calculation with a plain title', () => {
    expect(TOPICS.filter(t => t.id === 'y4-whichop')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'maths', strand: 'calc', title: 'Which operation?' });
  });

  it('every template is pinned here, for review', () => {
    expect(PLAIN.map(r => `${r[1]} ${r[0]}`)).toEqual([
      '+ {a} children are on a bus. {b} more get on. How many now?',
      '+ A shop sold {a} pens on Monday and {b} on Tuesday. How many?',
      '+ Mia has {a} stickers and Sam has {b}. How many have they got together?',
      '+ A farmer has {a} hens and {b} ducks. How many birds is that?',
      '− Mia has {a} stickers and Sam has {b}. How many more does Mia have?',
      '− A book has {a} pages. Jo has read {b}. How many pages are left?',
      '− There are {a} fans at a match and {b} go home. How many are left?',
      '− A tank holds {a} litres. {b} litres are used. How many are left?',
      '× {a} boxes have {b} pencils in each. How many pencils are there?',
      '× A tray holds {b} eggs. Ana buys {a} trays. How many eggs does she buy?',
      '× Each of {a} bags has {b} apples. How many apples are there?',
      '× A bus has {b} seats in each row and {a} rows. How many seats is that?',
      '÷ {a} sweets are shared equally by {b} children. How many each?',
      '÷ {a} pencils go into pots of {b}. How many pots are filled?',
      '÷ {a} books go into {b} equal piles. How many are in each pile?',
      '÷ {a} children make teams of {b}. How many teams are there?',
    ]);
    expect(TRAPS.map(r => `${r[1]} [${r[2]}] ${r[0]}`)).toEqual([
      '+ [left] Sam gave away {b} cards and has {a} left. How many at the start?',
      '+ [shorter] Tom is {b} cm shorter than Jo. Tom is {a} cm tall. How tall is Jo?',
      '+ [lost] Ria lost {b} marbles and now has {a}. How many at the start?',
      '− [added] A jar has {a} sweets after {b} were added. How many at first?',
      '− [more] Ben saved £{a}, which is £{b} more than Ana. How much did Ana save?',
      '− [new] Kim has {a} stickers. {b} are new, the rest old. How many are old?',
      '÷ [each] Each bag holds {b} marbles. Ana has {a}. How many bags?',
      '÷ [each] Lee has {a} cards and puts {b} in each pile. How many piles?',
      '÷ [each] {a} pens are shared out, {b} to each child. How many children?',
      '× [in all] Each of {a} children has {b} stickers. How many are there in all?',
      '× [altogether] {a} boxes hold {b} pencils each. How many altogether?',
      '× [in total] Mia buys {a} packs of {b} cards each. How many cards in total?',
    ]);
  });

  it('every trap row carries the word it is a trap for, and the word is in its text', () => {
    for (const r of TRAPS) { expect(r[2], r[0]).toBeTruthy(); expect(r[0].toLowerCase(), r[0]).toContain(r[2]!); }
  });

  it('oracle: over 2,000 draws per difficulty exactly one operation gives the answer, and it is the card’s', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const [x, y] = nums(q.prompt), a = Math.max(x, y), b = Math.min(x, y), op = rowOf(q.prompt)[1];
      expect(q.answer, q.prompt).toBe(op);
      const hits = OPS.filter(o => (o !== '÷' || a % b === 0) && apply(o, a, b) === apply(op, a, b));
      expect(hits, q.prompt).toEqual([op]);
      expect(agreeing(op, a, b)).toEqual([op]);
    }
  });

  it('the agreeing check catches the known clashes', () => {
    expect(agreeing('+', 2, 2)).toEqual(['+', '×']);
    expect(agreeing('−', 4, 2)).toEqual(['−', '÷']);
  });

  it('every card has exactly the bubbles + − × ÷ in a fixed order; the minus is U+2212', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 300)) {
      expect(q.options).toEqual(['+', '−', '×', '÷']);
      expect(q.options).toContain(q.answer);
      expect(rLblProblem(q)).toBeNull();
    }
  });

  it('ladder: d1 only + and −; d2 all four; d3 only trap templates, each with its trap word', () => {
    for (const q of draw(1, 400)) expect(['+', '−']).toContain(q.answer);
    expect(new Set(draw(2, 600).map(q => q.answer))).toEqual(new Set(OPS));
    for (const q of draw(3, 600)) { const r = rowOf(q.prompt); expect(TRAPS).toContain(r); expect(q.prompt.toLowerCase()).toContain(r[2]!); }
    expect(new Set(draw(3, 600).map(q => q.answer))).toEqual(new Set(OPS));
  });

  it('numbers: d1 within 1,000; × and ÷ within 12 × 12; d3 + and − up to 9,999; four digits print with a comma', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 600)) {
      const ns = nums(q.prompt), op = q.answer as Op;
      for (const n of ns) { expect(n).toBeGreaterThanOrEqual(2); expect(n).toBeLessThanOrEqual(9999); }
      if (d === 1) { for (const n of ns) expect(n).toBeLessThanOrEqual(1000); expect(ns[0] + ns[1]).toBeLessThanOrEqual(op === '+' ? 1000 : 2000); }
      if (op === '×' || op === '÷') { const b = Math.min(...ns), a = Math.max(...ns); expect(b).toBeLessThanOrEqual(12); op === '×' ? expect(a).toBeLessThanOrEqual(12) : (expect(a % b).toBe(0), expect(a / b).toBeLessThanOrEqual(12)); }
      if (d === 3 && (op === '+' || op === '−')) for (const n of ns) expect(n).toBeGreaterThanOrEqual(1000);
      expect(q.prompt).not.toMatch(/\d{4}/);
    }
  });

  it('every card has a safe `say` of its own and its prompt fits the card (#1051)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 300)) {
      expect(q.say, q.prompt).toBeTruthy();
      expect(sayIsSafe(q.say!), q.say).toBe(true);
      expect(cardBudgetProblem(q), q.prompt).toBeNull();
    }
  });

  it('no template word, names and nouns included, is crude (#642/#324)', () => {
    const words = new Set([...PLAIN, ...TRAPS].flatMap(r => r[0].toLowerCase().match(/[a-z]+/g) ?? []));
    for (const w of words) { expect(EXCLUDE, w).not.toContain(w); expect(AVOID, w).not.toContain(w); }
  });
});
