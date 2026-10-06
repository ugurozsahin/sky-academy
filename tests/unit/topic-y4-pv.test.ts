import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { parseNum } from '../../src/curriculum/ks2num';
import { leakShares } from './helpers/decoy-leak';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y4-pv')!;
const DRAWS = 400;
const num = (label: string) => parseNum(label)!.v;
const FOUR = /^\d,\d{3}$/;

describe('y4-pv (#1133)', () => {
  it('is registered with sequenceFrom 3', () => {
    expect(topic.year).toBe('year4');
    expect(topic.sequenceFrom).toBe(3);
  });

  it('digit-value cards: the asked digit is non-zero, appears once, and the answer is digit x column', () => {
    let seen = 0;
    for (const d of [1, 2] as Difficulty[]) {
      const r = rng(1133_000 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        const m = q.prompt.match(/^In (\d,\d{3}), what is the (\d) worth\?$/);
        if (!m) continue;
        seen++;
        const n = m[1].replace(',', ''), dg = m[2];
        expect(n.length, q.prompt).toBe(4);
        expect(dg, q.prompt).not.toBe('0');
        expect(n.split(dg).length - 1, q.prompt).toBe(1);
        if (d === 1) expect(num(m[1]), q.prompt).toBeLessThan(2000);
        const col = 10 ** (n.length - 1 - n.indexOf(dg));
        expect(num(q.answer), q.prompt).toBe(Number(dg) * col);
        expect(q.options, q.prompt).toContain(q.answer);
        expect(q.options.map(num), q.prompt).toContain(Number(dg)); // the bare digit
        for (const o of q.options) if (num(o) >= 1000) expect(o, q.prompt).toMatch(/^\d,000$/);
      }
    }
    expect(seen).toBeGreaterThan(DRAWS);
  });

  it('compare cards: sign by value, shared thousands digit, about one in five equal', () => {
    const r = rng(1133_200);
    let cmp = 0, eq = 0;
    for (let i = 0; i < 2000; i++) {
      const q = topic.gen(2, r);
      const m = q.prompt.match(/^(\d,\d{3}) \? (\d,\d{3})$/);
      if (!m) continue;
      cmp++;
      const [a, b] = [num(m[1]), num(m[2])];
      expect(q.answer, q.prompt).toBe(a < b ? '<' : a > b ? '>' : '=');
      expect(Math.floor(a / 1000), q.prompt).toBe(Math.floor(b / 1000));
      if (a === b) eq++;
    }
    expect(cmp).toBeGreaterThan(500);
    expect(eq / cmp).toBeGreaterThan(0.1);
    expect(eq / cmp).toBeLessThan(0.3);
  });

  it('ordering cards: four ascending numbers, comma-formatted, answer is the space join', () => {
    const r = rng(1133_300);
    for (let i = 0; i < DRAWS; i++) {
      const q = topic.gen(3, r);
      const seq = q.sequence!;
      expect(seq).toHaveLength(4);
      for (const s of seq) expect(s).toMatch(FOUR);
      const nums = seq.map(num);
      expect(nums, q.prompt).toEqual([...nums].sort((a, b) => a - b));
      expect(new Set(nums).size).toBe(4);
      expect(new Set(nums.map(n => Math.floor(n / 1000))).size).toBe(1);
      expect(q.answer).toBe(seq.join(' '));
      expect([...q.options].sort()).toEqual([...seq].sort());
    }
  });

  it('never asks "how many hundreds / tens" and never prints a bare four-digit number', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(1133_400 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        expect(q.prompt).not.toMatch(/how many/i);
        for (const s of [q.prompt, q.answer, ...q.options]) expect(s).not.toMatch(/(^|[^\d,])\d{4}($|[^\d])/);
      }
    }
  });

  it('digit-value cards leak neither a unique units nor a unique leading digit (#1058)', () => {
    for (const d of [1, 2] as Difficulty[]) {
      const s = leakShares(topic.gen, d, 2000);
      expect(s.units, `d${d}`).toBeLessThanOrEqual(0.3);
      expect(s.leading, `d${d}`).toBeLessThanOrEqual(0.3);
    }
  });
});
