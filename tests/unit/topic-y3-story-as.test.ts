import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { UNIT_WORD } from '../../src/curriculum/util';
import { BANK } from '../../src/curriculum/year3-story-as';
import { cardBudgetProblem } from './helpers/card-budget';
import { leakShares } from './helpers/decoy-leak';

// Deterministic RNG (mulberry32), same construction `topic-y3-mental.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-story-as')!;
const DRAWS = 400;
const draws = (d: Difficulty, seed: number) => { const r = rng(seed + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const sentence = (t: string, unit: string) => new RegExp('^' + esc(t).replace('#', unit ? `(\\d+) ${unit}` : '(\\d+)') + '$');

/** Independent oracle: find the template whose sentences the prompt is made of, and apply its operations in order. */
function parse(prompt: string) {
  const parts = prompt.split(/(?<=[.?]) /);
  for (const [unit, start, add, sub, ask] of BANK) {
    const first = parts[0].match(sentence(start, unit));
    if (!first || parts[parts.length - 1] !== ask) continue;
    const vals = [Number(first[1])];
    const ops: boolean[] = [];
    for (const p of parts.slice(1, -1)) {
      const a = p.match(sentence(add, unit)), s = p.match(sentence(sub, unit));
      const m = a ?? s;
      expect(m, p).toBeTruthy();
      ops.push(!!a);
      vals.push(vals[vals.length - 1] + (a ? 1 : -1) * Number(m![1]));
    }
    return { unit, vals, ops, answer: vals[vals.length - 1] };
  }
  throw new Error('no template matches: ' + prompt);
}

describe('y3-story-as (#1090)', () => {
  it('is registered once, in Year 3, directly after y3-missing in the calc strand', () => {
    expect(TOPICS.filter(t => t.id === 'y3-story-as')).toHaveLength(1);
    expect(topic.year).toBe('year3');
    const ids = TOPICS.filter(t => t.id.startsWith('y3-')).map(t => t.id);
    expect(ids.indexOf('y3-story-as')).toBe(ids.indexOf('y3-missing') + 1);
  });

  it('the bank holds at most 12 hand-written templates, one # in each sentence, with only the six unit codes', () => {
    expect(BANK.length).toBeLessThanOrEqual(12);
    for (const [unit, ...rest] of BANK.map(r => [r[0], r[1], r[2], r[3]])) {
      expect(['', 'cm', 'm', 'g', 'kg', 'ml', 'l']).toContain(unit);
      for (const s of rest) expect(s.match(/#/g)).toHaveLength(1);
    }
  });

  it('the oracle: every answer is the template operations on the card numbers, in the options once', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1090_100)) {
      const { unit, answer, vals } = parse(c.prompt);
      expect(vals.length, c.prompt).toBe(d === 3 ? 3 : 2);
      expect(c.answer, c.prompt).toBe(unit ? `${answer} ${unit}` : String(answer));
      expect(c.options.filter(o => o === c.answer), c.prompt).toHaveLength(1);
      expect(new Set(c.options).size, c.prompt).toBe(4);
    }
  });

  it('every value (start, intermediate, answer and option) is 100-999', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1090_200)) {
      for (const v of parse(c.prompt).vals) { expect(v, c.prompt).toBeGreaterThanOrEqual(100); expect(v, c.prompt).toBeLessThanOrEqual(999); }
      for (const o of c.options) { const n = Number(o.replace(/\D/g, '')); expect(n, c.prompt).toBeGreaterThanOrEqual(100); expect(n, c.prompt).toBeLessThanOrEqual(999); }
    }
  });

  it('each card uses exactly one unit, on every option of a measure card and on none of a count card', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1090_300)) {
      const { unit } = parse(c.prompt);
      const units = new Set((c.prompt.match(/\d+ (cm|m|g|kg|ml|l)\b/g) ?? []).map(x => x.split(' ')[1]));
      expect(units.size, c.prompt).toBe(unit ? 1 : 0);
      for (const o of c.options) expect(o, c.prompt).toMatch(unit ? new RegExp(`^\\d+ ${unit}$`) : /^\d+$/);
    }
  });

  it('d1: one step by ones, tens or hundreds; d2: one step with an exchange; d3: two steps', () => {
    const amounts = new Set<string>();
    for (const c of draws(1, 1090_400)) { const p = c.prompt.match(/\d+/g)!.map(Number); expect(p).toHaveLength(2); amounts.add(p[1] < 10 ? 'ones' : p[1] < 100 ? 'tens' : 'hundreds'); expect(p[1] < 10 || p[1] % 10 === 0, c.prompt).toBe(true); }
    expect([...amounts].sort()).toEqual(['hundreds', 'ones', 'tens']);
    for (const c of draws(2, 1090_500)) {
      const { vals, ops } = parse(c.prompt);
      const b = Math.abs(vals[1] - vals[0]);
      const carry = [1, 10].some(p => ops[0] ? Math.floor(vals[0] / p) % 10 + Math.floor(b / p) % 10 > 9 : Math.floor(vals[0] / p) % 10 < Math.floor(b / p) % 10);
      expect(carry, c.prompt).toBe(true);
    }
    expect(new Set(draws(3, 1090_600).map(c => parse(c.prompt).ops.join())).size).toBe(4);
  });

  it('no sentence is singular-ungrammatical: no amount is 1, over 3,000 draws per difficulty', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1090_990 + d);
      for (let i = 0; i < 3000; i++) {
        const c = topic.gen(d, r);
        expect(c.prompt, c.prompt).not.toMatch(/\b1 (?!\d)/);
        expect(c.say, c.prompt).not.toMatch(/\b1 (?!\d)/);
      }
    }
  });

  it('decoys: the wrong operation turns up on one-step cards', () => {
    for (const d of [1, 2] as Difficulty[]) {
      const cards = draws(d, 1090_700).map(c => ({ ...parse(c.prompt), options: c.options.map(o => Number(o.replace(/\D/g, ''))) }));
      const wrong = cards.filter(x => x.options.includes(x.vals[0] + (x.ops[0] ? -1 : 1) * Math.abs(x.vals[1] - x.vals[0])));
      expect(wrong.length, `d${d}`).toBeGreaterThan(DRAWS / 4);
    }
  });

  it('decoys: every d3 card offers the answer after the first step only, and ±10 or ±100 slips turn up', () => {
    const cards = draws(3, 1090_800).map(c => ({ ...parse(c.prompt), options: c.options.map(o => Number(o.replace(/\D/g, ''))) }));
    for (const x of cards) expect(x.options, `${x.vals}`).toContain(x.vals[1]);
    const slips = cards.filter(x => x.options.some(o => [10, 100].includes(Math.abs(o - x.answer))));
    expect(slips.length).toBeGreaterThan(DRAWS / 5);
  });

  it('every card has a say that reads the unit as a word and no symbols; d3 is slow, d1 and d2 are not', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1090_900)) {
      expect(c.say, c.prompt).toBeTruthy();
      expect(c.say, c.prompt).not.toMatch(/\b(cm|ml|kg|g|m|l)\b/);
      for (const n of c.prompt.match(/\d+/g)!) expect(c.say, c.prompt).toContain(n);
      const { unit } = parse(c.prompt);
      expect(c.say, c.prompt).toMatch(unit ? new RegExp(UNIT_WORD[unit]) : /are there now\?$/);
      expect(!!c.slow, c.prompt).toBe(d === 3);
    }
  });

  it('every prompt passes the KS2 card budget (#1051)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const c of draws(d, 1090_950)) expect(cardBudgetProblem(c), c.prompt).toBeNull();
  });

  it('decoys: leading and last digit shares stay within the KS2 ceiling (#1058)', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const s = leakShares(topic.gen, d, 2000);
      expect(s.counted, `d${d}`).toBeGreaterThan(200);
      expect(s.units, `d${d} units`).toBeLessThanOrEqual(0.30);
      expect(s.leading, `d${d} leading`).toBeLessThanOrEqual(0.30);
    }
  });
});
