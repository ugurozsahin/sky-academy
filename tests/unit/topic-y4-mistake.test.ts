import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { carrySlip } from '../../src/curriculum/mistakes';
import { dec } from '../../src/curriculum/ks2num';
import { LETTERS, MINUS, carryColumns, wrongAnswers } from '../../src/curriculum/year4-mistake';
import { cardBudgetProblem } from './helpers/card-budget';
import { rLblProblem } from './helpers/r-lbl';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y4-mistake')!;
const draw = (d: Difficulty, n = 2000) => { const r = rng(1173 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const text = (q: Question) => (q.visual as { type: 'sentence'; text: string }).text;
const parse = (q: Question) => {
  const m = /^([\d,]+) ([+−]) ([\d,]+) = ([\d,]+)$/.exec(text(q))!;
  const n = (s: string) => Number(s.replace(/,/g, ''));
  return { a: n(m[1]), b: n(m[3]), add: m[2] === '+', shown: n(m[4]), raw: m[4] };
};
const digitsDiffering = (x: number, y: number) => [...String(x)].map((c, i) => String(y)[i] === c ? -1 : String(x).length - 1 - i).filter(k => k >= 0);

describe('y4-mistake (#1173)', () => {
  it('is registered once in Year 4 calculation with a plain title', () => {
    expect(TOPICS.filter(t => t.id === 'y4-mistake')).toHaveLength(1);
    expect(topic).toMatchObject({ year: 'year4', subject: 'maths', strand: 'calc', title: 'Spot the mistake' });
  });

  it('oracle: the shown answer differs from the true result in exactly one digit, and the card’s answer is that column', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      const { a, b, add, shown } = parse(q), r = add ? a + b : a - b;
      expect(shown, text(q)).not.toBe(r);
      expect(String(shown).length).toBe(String(r).length);
      const cols = digitsDiffering(r, shown);
      expect(cols, text(q)).toHaveLength(1);
      expect(q.answer, text(q)).toBe(LETTERS[cols[0]]);
    }
  });

  it('rule link: every wrong answer is a dropped carry (exchange) or a one-column fact slip for those operands', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 600)) {
      const { a, b, add, shown } = parse(q), r = add ? a + b : a - b;
      const w = wrongAnswers(a, b, add).find(x => x.value === shown)!;
      expect(w, text(q)).toBeTruthy();
      expect(LETTERS[w.col]).toBe(q.answer);
      if (w.kind === 'carry') {
        // the dropped carry is one of #1058's `carrySlip` outputs, and only a column that really carried can drop one
        const slips = carrySlip(dec(a, 0), dec(b, 0), add ? 'add' : 'sub', dec(r, 0)).map(x => x.v);
        expect(slips, text(q)).toContain(shown);
        expect(carryColumns(a, b, add)).toContain(w.col - 1);
      } else expect(Math.abs(shown - r)).toBe(10 ** w.col);
    }
  });

  it('wrongAnswers on the issue’s own sum: 3,457 + 1,285 drops the hundreds carry to give 4,642', () => {
    expect(wrongAnswers(3457, 1285, true)).toContainEqual({ kind: 'carry', col: 2, value: 4642 });
    expect(wrongAnswers(4005, 1238, false)).toContainEqual({ kind: 'carry', col: 1, value: 2777 });
  });

  it('across 2,000 d2 draws each of Th, H, T and O is the answer at least 10 % of the time', () => {
    const qs = draw(2);
    for (const l of ['Th', 'H', 'T', 'O']) expect(qs.filter(q => q.answer === l).length / qs.length, l).toBeGreaterThanOrEqual(0.1);
  });

  it('ladder: d1 is 3-digit addition under 1,000 with H T O; d2 is 4-digit + and − with 4 bubbles; d3 has a zero in the top number', () => {
    for (const q of draw(1, 500)) { const { a, b, add, shown } = parse(q); expect(add).toBe(true); expect(a + b).toBeLessThan(1000); expect(shown).toBeLessThan(1000); expect(q.options).toEqual(['H', 'T', 'O']); }
    const d2 = draw(2, 500);
    expect(new Set(d2.map(q => parse(q).add))).toEqual(new Set([true, false]));
    for (const q of d2) { expect(q.options).toEqual(['Th', 'H', 'T', 'O']); expect(parse(q).a).toBeGreaterThanOrEqual(1000); }
    const d3 = draw(3, 500);
    expect(new Set(d3.map(q => parse(q).add))).toEqual(new Set([true, false]));
    for (const q of d3) { const { a } = parse(q); expect(String(a).slice(1), text(q)).toMatch(/0/); expect(q.options).toEqual(['Th', 'H', 'T', 'O']); }
  });

  it('the sum sits in the sentence visual, never the prompt; four digits print with a comma and the minus is U+2212', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 300)) {
      expect(q.prompt).toBe('Which column has the mistake?');
      expect(q.visual?.type).toBe('sentence');
      expect(text(q)).not.toMatch(/\d{4}/);
      expect(text(q)).not.toContain('-');
      if (parse(q).raw.length > 3) expect(parse(q).raw).toContain(',');
      if (!parse(q).add) expect(text(q)).toContain(MINUS);
    }
  });

  it('every card has a safe `say`, passes R-LBL and fits the card', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d, 300)) {
      expect(q.say, text(q)).toBeTruthy();
      expect(sayIsSafe(q.say!), q.say).toBe(true);
      expect(q.options).toContain(q.answer);
      expect(rLblProblem(q), text(q)).toBeNull();
      expect(cardBudgetProblem(q), text(q)).toBeNull();
    }
  });

  it('both slips occur at every difficulty, and exchanges occur when taking away', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const kinds = draw(d, 600).map(q => { const { a, b, add, shown } = parse(q); return { add, kind: wrongAnswers(a, b, add).find(w => w.value === shown)!.kind }; });
      expect(kinds.some(k => k.kind === 'carry'), `d${d} carry`).toBe(true);
      expect(kinds.some(k => k.kind === 'slip'), `d${d} slip`).toBe(true);
      if (d > 1) expect(kinds.some(k => !k.add && k.kind === 'carry'), `d${d} exchange`).toBe(true);
    }
  });

  it('ladder limits: d1 one carry and a 3-digit sum; d2 one carry or exchange; d2–d3 a 4-digit result; d3 top number has a zero below the thousands', () => {
    for (const q of draw(1, 600)) { const { a, b } = parse(q); expect(carryColumns(a, b, true)).toHaveLength(1); expect(a + b).toBeGreaterThanOrEqual(100); }
    for (const q of draw(2, 600)) { const { a, b, add } = parse(q), r = add ? a + b : a - b; expect(carryColumns(a, b, add), text(q)).toHaveLength(1); expect(r).toBeGreaterThanOrEqual(1000); expect(r).toBeLessThanOrEqual(9999); }
    for (const q of draw(3, 600)) { const { a, b, add } = parse(q), r = add ? a + b : a - b; expect(r).toBeGreaterThanOrEqual(1000); expect(r).toBeLessThanOrEqual(9999); expect(String(a).slice(1)).toMatch(/0/); }
  });

  it('every offered column is the answer sometimes: d1 H T O, d3 Th H T O; sums vary', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const qs = draw(d, 1500);
      expect(new Set(qs.map(q => q.answer)), `d${d}`).toEqual(new Set(qs[0].options));
      expect(new Set(qs.map(q => text(q))).size, `d${d} variety`).toBeGreaterThan(1000);
    }
  });

  it('the spoken card names the same columns as its bubbles, in the same order', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const say = draw(d, 1)[0].say!;
      expect(say.includes('thousands')).toBe(d > 1);
      expect(say).toMatch(d > 1 ? /thousands, hundreds, tens or ones\?$/ : /hundreds, tens or ones\?$/);
    }
  });

  it('wrongAnswers never returns a negative or different-length value, including subtractions across zeros', () => {
    for (const [a, b, add] of [[4005, 1238, false], [5000, 1999, false], [9009, 2345, false], [4005, 1238, true], [999, 999, true]] as [number, number, boolean][]) {
      const r = add ? a + b : a - b;
      for (const w of wrongAnswers(a, b, add)) { expect(w.value).toBeGreaterThanOrEqual(0); expect(String(w.value)).toHaveLength(String(r).length); expect(w.value).not.toBe(r); }
    }
  });
});
