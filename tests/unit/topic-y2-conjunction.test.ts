import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';
import { JOIN_BANK, JOINERS } from '../../src/curriculum/year2-conjunction';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y2-conjunction')!;
const DRAWS = 200;
const COORD = ['and', 'or', 'but'];
const YEAR3_PLUS = ['although', 'though', 'unless', 'whereas', 'however', 'since', 'despite', 'while'];

/** #1007: choose the joining word for a gap sentence. */
describe('y2-conjunction (#1007)', () => {
  it('the bank has exactly 3 decoys per row, all from the seven, none equal to the answer or each other', () => {
    expect(JOIN_BANK.length).toBeGreaterThanOrEqual(24);
    for (const [s, answer, decoys] of JOIN_BANK) {
      expect(s, 'one gap').toMatch(/^[^_]*___[^_]*$/);
      expect(JOINERS).toContain(answer);
      expect(decoys).toHaveLength(3);
      expect(new Set(decoys).size).toBe(3);
      for (const x of decoys) { expect(JOINERS).toContain(x); expect(x, s).not.toBe(answer); }
    }
  });
  it('never lists a word that also fits: because/when/if never decoy each other, and/or/but rows never offer and or but', () => {
    const SUB = ['because', 'when', 'if'];
    for (const [s, answer, decoys] of JOIN_BANK) {
      if (SUB.includes(answer)) for (const x of decoys) expect(SUB, `${x} also fits "${s}"`).not.toContain(x);
      if (answer === 'but') expect(decoys, s).not.toContain('and');
      if (answer === 'and' || answer === 'or') for (const x of decoys) expect(COORD, s).not.toContain(x);
    }
  });
  it('each of the seven words is the answer at least twice', () => {
    for (const w of JOINERS) expect(JOIN_BANK.filter(r => r[1] === w).length, w).toBeGreaterThanOrEqual(2);
  });
  it('follows the ladder: d1 and/or/but with 3 bubbles, d2 because/when/if/that with 3, d3 any with 4', () => {
    const seen: Record<number, Set<string>> = { 1: new Set(), 2: new Set(), 3: new Set() };
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(10070 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        seen[d].add(q.answer);
        expect(q.options.length).toBe(d === 3 ? 4 : 3);
        expect(new Set(q.options).size).toBe(q.options.length);
        if (d === 1) expect(COORD).toContain(q.answer);
        if (d === 2) expect(COORD).not.toContain(q.answer);
        const row = JOIN_BANK.find(x => (q.visual as { text: string }).text === x[0])!;
        expect(row[1]).toBe(q.answer);
        for (const o of q.options) expect(o === q.answer || row[2].includes(o as never), `${o} is not from the row's own decoys`).toBe(true);
      }
    }
    expect([...seen[1]].sort()).toEqual(['and', 'but', 'or']);
    expect([...seen[2]].sort()).toEqual(['because', 'if', 'that', 'when']);
    expect(seen[3].size).toBe(7);
  });
  it('every card has a sentence visual and a say that reads the gap as "blank"', () => {
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(10080 + d);
      for (let i = 0; i < DRAWS; i++) {
        const q = topic.gen(d, r);
        expect(q.visual?.type).toBe('sentence');
        expect(q.say).toContain('blank');
        expect(q.say).not.toContain('___');
      }
    }
  });
  it('no Year 3+ subordinator reaches a sentence or a bubble', () => {
    for (const [s, a, decoys] of JOIN_BANK) for (const w of [...s.toLowerCase().replace(/[.!?,]/g, '').split(' '), a, ...decoys]) {
      expect(YEAR3_PLUS, `"${w}" is Year 3+ in "${s}"`).not.toContain(w);
    }
  });
});
