import { describe, it, expect } from 'vitest';
import { y2AnyOrder } from '../../src/curriculum/year2-anyorder';

function mulberry32(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const DRAWS = 300;
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
/** Value of "a op b" for the four operators the topic uses. */
const evalX = (s: string): number => {
  const m = s.match(/^(\d+) ([+−×÷]) (\d+)$/)!;
  const [a, b] = [Number(m[1]), Number(m[3])];
  return m[2] === '+' ? a + b : m[2] === '−' ? a - b : m[2] === '×' ? a * b : a / b;
};
const yesNo = (p: string) => p.match(/^Is (\d+ [+−×÷] \d+) the same as (\d+ [+−×÷] \d+)\?$/);
const same = (p: string) => p.match(/^Which is the same as (.+)\?$/);

describe('y2-anyorder (#999)', () => {
  for (const d of [1, 2] as const) {
    it(`d${d}: yes/no answers "Yes" exactly for + and ×; the numbers differ and stay in range`, () => {
      const rng = mulberry32(999 + d);
      let seen = 0;
      for (let i = 0; i < DRAWS; i++) {
        const q = y2AnyOrder(d, rng), m = yesNo(q.prompt);
        expect(q.say).toBeTruthy();
        if (!m) continue;
        seen++;
        const [a, op, b] = m[1].split(' '), [c, op2, e] = m[2].split(' ');
        expect([c, op2, e]).toEqual([b, op, a]);
        expect(a).not.toBe(b);
        expect(q.answer).toBe(op === '+' || op === '×' ? 'Yes' : 'No');
        expect([...q.options].sort()).toEqual(['No', 'Yes']);
        for (const n of nums(q.prompt)) expect(n).toBeLessThanOrEqual(d === 1 ? 20 : 100);
        expect(['+', '−', '×', '÷'].indexOf(op) < 2).toBe(d === 1);
        if (op === '−') expect(Number(a)).toBeGreaterThan(Number(b));
        if (op === '÷') { expect(Number(a) % Number(b)).toBe(0); expect([2, 5, 10]).toContain(Number(b)); }
        if (op === '×') expect([2, 5, 10].some(t => t === Number(a) || t === Number(b))).toBe(true);
      }
      expect(seen).toBeGreaterThan(d === 1 ? 250 : 100);
    });
  }

  it('d3 asks no yes/no cards', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < DRAWS; i++) expect(yesNo(y2AnyOrder(3, rng).prompt)).toBeNull();
  });

  for (const d of [2, 3] as const) {
    it(`d${d}: which-is-the-same cards have exactly one option with the prompt's value, the swapped operands`, () => {
      const rng = mulberry32(1999 + d);
      let seen = 0;
      for (let i = 0; i < DRAWS; i++) {
        const q = y2AnyOrder(d, rng), m = same(q.prompt);
        if (!m) continue;
        seen++;
        const [a, op, b] = m[1].split(' ');
        expect(['+', '×']).toContain(op);
        expect(q.answer).toBe(`${b} ${op} ${a}`);
        expect(new Set(q.options).size).toBe(4);
        expect(q.options).toContain(q.answer);
        expect(q.options.filter(o => evalX(o) === evalX(m[1]))).toEqual([q.answer]);
        for (const o of q.options) {
          const v = evalX(o), [x, , y] = o.split(' ');
          expect(Number.isInteger(v) && v >= 0 && v <= 100).toBe(true);
          if (o.includes('−')) expect(Number(x)).toBeGreaterThan(Number(y)); // never a − with the larger number second
          expect(o.includes('÷')).toBe(false);
        }
        if (op === '×') expect([2, 5, 10]).toContain(Number(a));
        else expect(Number(a) + Number(b)).toBeLessThanOrEqual(99);
        expect(Number(a)).not.toBe(Number(b));
        expect(q.say).toBeTruthy();
      }
      expect(seen).toBeGreaterThan(100);
    });
  }

  it('d3 draws both + and × which-is-the-same cards', () => {
    const rng = mulberry32(31), ops = new Set<string>();
    for (let i = 0; i < DRAWS; i++) ops.add(same(y2AnyOrder(3, rng).prompt)![1].split(' ')[1]);
    expect(ops).toEqual(new Set(['+', '×']));
  });

  it('the value-collision filter holds over many draws (2 × 2-style clashes, edge n of 1, 9 and 10)', () => {
    for (let i = 0; i < 3000; i++) {
      const q = y2AnyOrder(3, mulberry32(i));
      const mm = same(q.prompt);
      if (!mm) continue;
      expect(q.options.filter(o => evalX(o) === evalX(mm[1]))).toHaveLength(1);
      expect(new Set(q.options).size).toBe(4);
    }
  });
});
