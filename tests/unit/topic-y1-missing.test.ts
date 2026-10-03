import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

// Deterministic RNG (mulberry32), same construction `curriculum.test.ts` uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const topic = TOPICS.find(t => t.id === 'y1-missing')!;
const DRAWS = 300;
const MIRRORED = /^\d+ = /;

/** The unknown's value read from "c = a op b" by substitution, never by the generator's own formula. */
function holds(prompt: string, ans: number): boolean {
  const [lhs, rhs] = prompt.replace(/−/g, '-').split(' = ');
  return Function(`return (${lhs.replace('?', String(ans))}) === (${rhs.replace('?', String(ans))})`)() as boolean;
}

/** #984: "7 = ? − 9" is the KS1 PoS's own example, so d2–d3 put the sum after the equals sign sometimes. */
describe('y1-missing, equals on the left (#984)', () => {
  const cards = (d: Difficulty) => { const r = rng(9840 + d); return Array.from({ length: DRAWS }, () => topic.gen(d, r)); };

  it('substituting the answer for ? makes both sides equal, on every card', () => {
    for (const d of [1, 2, 3] as Difficulty[])
      for (const q of cards(d)) expect(holds(q.prompt, +q.answer), q.prompt).toBe(true);
  });

  it('d1 never shows the new form; d2 shows it on 15–35 % of cards and d3 on 40–60 %', () => {
    const share = (d: Difficulty) => cards(d).filter(q => MIRRORED.test(q.prompt)).length / DRAWS;
    expect(share(1)).toBe(0);
    expect(share(2)).toBeGreaterThanOrEqual(0.15); expect(share(2)).toBeLessThanOrEqual(0.35);
    expect(share(3)).toBeGreaterThanOrEqual(0.4); expect(share(3)).toBeLessThanOrEqual(0.6);
  });

  it('all four shapes appear, every value and the answer sit in 0–20, and each card has a spoken form', () => {
    const shapes = new Set<string>();
    for (const q of cards(3)) {
      for (const n of q.prompt.match(/\d+/g)!) expect(+n).toBeLessThanOrEqual(20);
      expect(+q.answer).toBeGreaterThanOrEqual(0); expect(+q.answer).toBeLessThanOrEqual(20);
      expect(q.say).toBeTruthy();
      if (MIRRORED.test(q.prompt)) { shapes.add(q.prompt.replace(/\d+/g, 'n')); expect(q.say).toContain('equals'); }
    }
    expect([...shapes].sort()).toEqual(['n = ? + n', 'n = ? − n', 'n = n + ?', 'n = n − ?']);
  });

  it('offers the number beside "=" as a decoy whenever it is not the answer', () => {
    for (const q of cards(3)) {
      const m = MIRRORED.test(q.prompt) && q.prompt.match(/^(\d+) = /);
      if (m && m[1] !== q.answer) expect(q.options, q.prompt).toContain(m[1]);
    }
  });
});
