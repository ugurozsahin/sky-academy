import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { parseNum } from '../../src/curriculum/ks2num';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y4-count')!;
const DRAWS = 400;
const num = (label: string) => parseNum(label)!.v;
const isRun = (prompt: string) => !prompt.startsWith('1,000 ');
const parts = (prompt: string) => prompt.replace(/\s*=\s*\?$/, '').split(', '); // fmt()'s "1,000" has no space

/** Re-derive the "?" from the other terms alone (never from the generator's logic). */
function checkRun(prompt: string, answer: string) {
  const p = parts(prompt);
  expect(p, prompt).toHaveLength(4);
  const gap = p.indexOf('?');
  expect(gap, prompt).toBeGreaterThanOrEqual(0);
  const known = [0, 1, 2, 3].filter(i => i !== gap);
  const step = (num(p[known[1]]) - num(p[known[0]])) / (known[1] - known[0]);
  expect(Number.isInteger(step), prompt).toBe(true);
  expect([6, 7, 9, 25, 1000], prompt).toContain(Math.abs(step));
  const base = num(p[known[0]]) - known[0] * step;
  for (const i of known) expect(num(p[i]), prompt).toBe(base + i * step);
  expect(num(answer), prompt).toBe(base + gap * step);
}

function checkMoreLess(prompt: string, answer: string) {
  const m = prompt.match(/^1,000 (more|less) than ([\d,]+) = \?$/);
  expect(m, prompt).toBeTruthy();
  expect(num(answer), prompt).toBe(num(m![2]) + (m![1] === 'more' ? 1000 : -1000));
}

describe('y4-count (#1069)', () => {
  it('every card is a run or a 1,000 more/less phrase, and the oracle agrees with the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1069_000 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        if (isRun(q.prompt)) checkRun(q.prompt, q.answer); else checkMoreLess(q.prompt, q.answer);
      }
    }
  });

  it('d1: runs count in 25s or 1,000s asking the next term; more/less stays within 1,000–9,999', () => {
    const r = rng(1069_100);
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(1, r);
      if (isRun(q.prompt)) {
        const p = parts(q.prompt);
        expect(p.indexOf('?'), q.prompt).toBe(3);
        expect([25, 1000], q.prompt).toContain(num(p[1]) - num(p[0]));
        expect(num(p[0]), q.prompt).toBe(0);
      } else {
        const base = num(q.prompt.match(/than ([\d,]+) =/)![1]);
        expect(base, q.prompt).toBeGreaterThanOrEqual(1000);
        expect(base, q.prompt).toBeLessThanOrEqual(9999);
        expect(num(q.answer), q.prompt).toBeGreaterThanOrEqual(1000);
        expect(num(q.answer), q.prompt).toBeLessThanOrEqual(9999);
      }
    }
  });

  it('d2: runs ask the next term, count on from 0 in 6/7/9 (up to 12 × step), 25s start at any multiple up to 1,000', () => {
    const r = rng(1069_200);
    const starts25 = new Set<number>();
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(2, r);
      if (!isRun(q.prompt)) continue;
      const p = parts(q.prompt);
      expect(p.indexOf('?'), q.prompt).toBe(3);
      const step = num(p[1]) - num(p[0]);
      expect(step, q.prompt).toBeGreaterThan(0);
      if (step === 6 || step === 7 || step === 9) { expect(num(p[0]), q.prompt).toBe(0); expect(num(q.answer), q.prompt).toBeLessThanOrEqual(12 * step); }
      if (step === 25) { expect(num(p[0]) % 25, q.prompt).toBe(0); expect(num(p[0]), q.prompt).toBeLessThanOrEqual(1000); starts25.add(num(p[0])); }
    }
    expect([...starts25].some(s => s !== 0), 'expected a non-zero start in 25s').toBe(true);
  });

  it('d3: counts back (never below 0), asks inside the run, and 1,000 more can cross ten thousand', () => {
    const r = rng(1069_300);
    let back = false, inside = false, crossed = false;
    for (let i = 0; i < DRAWS * 2; i++) {
      const q = topic.gen(3, r);
      if (isRun(q.prompt)) {
        const p = parts(q.prompt);
        const known = [0, 1, 2, 3].filter(k => p[k] !== '?');
        if (num(p[known[1]]) < num(p[known[0]])) back = true;
        if (p.indexOf('?') !== 3) inside = true;
        for (const k of known) expect(num(p[k]), q.prompt).toBeGreaterThanOrEqual(0);
        expect(num(q.answer), q.prompt).toBeGreaterThanOrEqual(0);
      } else if (num(q.answer) >= 10000) crossed = true;
    }
    expect(back, 'a counting-back run').toBe(true);
    expect(inside, 'a gap inside the run').toBe(true);
    expect(crossed, '9,450 → 10,450 style card').toBe(true);
  });

  it('answers and options stay within 0–10,999, are unique, include the answer and are comma-formatted', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1069_500 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        expect(q.options, q.prompt).toHaveLength(4);
        expect(new Set(q.options).size, q.prompt).toBe(4);
        expect(q.options, q.prompt).toContain(q.answer);
        for (const label of q.options) {
          expect(num(label), `${q.prompt} "${label}"`).toBeGreaterThanOrEqual(0);
          expect(num(label), `${q.prompt} "${label}"`).toBeLessThanOrEqual(10999);
          expect(label, q.prompt).not.toMatch(/\d{4,}/);
        }
      }
    }
  });

  it('KS2 leak limit: over 2,000 draws, ≤30% of answers ≥ 20 have a units or leading digit no decoy shares', () => {
    const digits = (s: string) => s.replace(/[^0-9]/g, '');
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1069_700 + d);
      let total = 0, unitsLeak = 0, leadLeak = 0;
      for (let i = 0; i < 2000; i++) {
        const q = topic.gen(d, r);
        if (num(q.answer) < 20) continue;
        total++;
        const others = q.options.filter(o => o !== q.answer).map(digits);
        const a = digits(q.answer);
        if (!others.some(o => o.at(-1) === a.at(-1))) unitsLeak++;
        if (!others.some(o => o[0] === a[0])) leadLeak++;
      }
      expect(unitsLeak / total, `d${d} units ${unitsLeak}/${total}`).toBeLessThanOrEqual(0.30);
      expect(leadLeak / total, `d${d} leading ${leadLeak}/${total}`).toBeLessThanOrEqual(0.30);
    }
  });
});
