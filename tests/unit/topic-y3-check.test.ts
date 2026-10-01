import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

// Deterministic RNG (mulberry32), same construction `topic-y3-mental.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y3-check')!;
const DRAWS = 400;
const draws = (d: Difficulty, seed: number) => { const r = rng(seed + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };

const EST = /^About how much is (\d+) ([+−]) (\d+)\?$/;
const CHK = /^Which checks (\d+) ([+−]) (\d+) = (\d+)\?$/;
const CALC = /^(\d+) ([+−]) (\d+)$/;
const calc = (s: string) => { const m = s.match(CALC)!; expect(m, s).toBeTruthy(); return { x: Number(m[1]), op: m[2], y: Number(m[3]) }; };
const isEstimate = (p: string) => EST.test(p);
/** Independent oracle for a check card: the option that uses the inverse operation and evaluates to the starting number. */
// A subtraction is checked by adding back to the number it started from; an addition by taking either addend off the total.
const checks = (o: string, from: number[], add: boolean) => { const { x, op, y } = calc(o); return op === (add ? '−' : '+') && from.includes(op === '+' ? x + y : x - y); };
const all = (seed: number) => ([1, 2, 3] as Difficulty[]).flatMap(d => draws(d, seed));

describe('y3-check (#1085)', () => {
  it('is registered once, in Year 3', () => {
    expect(TOPICS.filter(t => t.id === 'y3-check')).toHaveLength(1);
    expect(topic.year).toBe('year3');
  });

  it('estimate cards: the answer is the sum or difference of the nearest hundreds, and every operand is within 4 of one', () => {
    let n = 0;
    for (const c of all(1085_100).filter(c => isEstimate(c.prompt))) {
      const [, a, op, b] = c.prompt.match(EST)!; const x = Number(a), y = Number(b);
      for (const v of [x, y]) { expect(Math.abs(v - Math.round(v / 100) * 100), c.prompt).toBeLessThanOrEqual(4); expect(Math.abs(v - Math.round(v / 100) * 100), c.prompt).toBeGreaterThan(0); }
      const h = (v: number) => Math.round(v / 100) * 100;
      expect(Number(c.answer), c.prompt).toBe(op === '+' ? h(x) + h(y) : h(x) - h(y));
      expect(op === '+' ? x + y : x - y).toBeLessThanOrEqual(1000);
      expect(op === '+' ? x + y : x - y).toBeGreaterThan(0);
      for (const o of c.options) { expect(Number(o)).toBeGreaterThan(0); expect(Number(o)).toBeLessThanOrEqual(1000); }
      expect(c.options, c.prompt).toContain(c.answer);
      expect(new Set(c.options).size, c.prompt).toBe(4);
      n++;
    }
    expect(n).toBeGreaterThan(500);
  });

  it('estimate decoys: the neighbouring hundreds and the place slip turn up', () => {
    const cards = draws(1, 1085_200);
    expect(cards.filter(c => c.options.includes(String(Number(c.answer) + 100)) || c.options.includes(String(Number(c.answer) - 100))).length).toBeGreaterThan(DRAWS * 0.5);
    expect(cards.filter(c => c.options.includes(String(Number(c.answer) / 10))).length).toBeGreaterThan(DRAWS * 0.5);
  });

  it('check cards: exactly one option uses the inverse and evaluates to the starting number', () => {
    let n = 0;
    for (const c of all(1085_300).filter(c => CHK.test(c.prompt))) {
      const [, a, op, b, r] = c.prompt.match(CHK)!;
      const add = op === '+';
      expect(Number(op === '+' ? Number(a) + Number(b) : Number(a) - Number(b)), c.prompt).toBe(Number(r));
      const right = c.options.filter(o => checks(o, add ? [Number(a), Number(b)] : [Number(a)], add));
      expect(right, c.prompt).toEqual([c.answer]);
      // Mathematically, whichever way it is written, no other option may be a valid check either (a − c = b checks a − b = c).
      const sameValue = c.options.filter(o => { const { x, op: p, y } = calc(o); return [Number(a), Number(b)].includes(p === '+' ? x + y : x - y); });
      expect(sameValue, c.prompt).toEqual([c.answer]);
      expect(c.options, c.prompt).toHaveLength(4);
      expect(new Set(c.options).size, c.prompt).toBe(4);
      n++;
    }
    expect(n).toBeGreaterThan(500);
  });

  it('an addition card never shows both c − a and c − b', () => {
    for (const c of all(1085_400).filter(c => CHK.test(c.prompt))) {
      const [, a, op, b, r] = c.prompt.match(CHK)!;
      if (op !== '+') continue;
      const shown = [...new Set([a, b])].filter(v => c.options.includes(`${r} − ${v}`));
      expect(shown, c.prompt).toHaveLength(1);
    }
  });

  it('every number on a check card is 100-999', () => {
    for (const c of all(1085_500).filter(c => CHK.test(c.prompt))) {
      for (const s of [c.prompt.replace(/^Which checks /, '').replace('?', '').replace('=', '+').replace(/−/g, '+'), ...c.options]) {
        for (const v of s.split(/ [+−] /).map(Number)) { expect(v, c.prompt).toBeGreaterThanOrEqual(100); expect(v, c.prompt).toBeLessThanOrEqual(999); }
      }
    }
  });

  it('d1 is all estimates, d2 is subtraction checks only, d3 mixes both with exchanges and carries', () => {
    for (const c of draws(1, 1085_600)) expect(isEstimate(c.prompt), c.prompt).toBe(true);
    for (const c of draws(2, 1085_600)) { expect(CHK.test(c.prompt), c.prompt).toBe(true); expect(c.prompt, c.prompt).toContain('−'); }
    const d3 = draws(3, 1085_600);
    expect(d3.some(c => isEstimate(c.prompt))).toBe(true);
    const chk = d3.filter(c => CHK.test(c.prompt)).map(c => c.prompt.match(CHK)!);
    expect(chk.some(m => m[2] === '+') && chk.some(m => m[2] === '−')).toBe(true);
    for (const [p, a, op, b] of chk) {
      const [x, y] = [Number(a), Number(b)];
      const hard = [1, 10].some(k => op === '+' ? Math.floor(x / k) % 10 + Math.floor(y / k) % 10 > 9 : Math.floor(x / k) % 10 < Math.floor(y / k) % 10);
      expect(hard, p).toBe(true);
    }
  });

  it('uses a real minus sign and the say reads it aloud', () => {
    for (const c of all(1085_700)) {
      expect(c.prompt).not.toMatch(/ - /);
      for (const o of c.options) expect(o).not.toMatch(/ - /);
      expect(c.say).not.toMatch(/[=−+]/);
      expect(c.say).toMatch(c.prompt.includes('+') ? /plus/ : /minus/);
    }
  });
});
