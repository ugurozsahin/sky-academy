import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty, Question } from '../../src/curriculum';
import { sayIsSafe } from '../../src/curriculum/ks2say';
import { countPairs } from '../../src/curriculum/year6-twounknowns';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = TOPICS.find(t => t.id === 'y6-twounknowns')!;
const draw = (d: Difficulty, n = 300): Question[] => { const r = rng(1273 * 10 + d); return Array.from({ length: n }, () => topic.gen(d, r)); };
const pair = (s: string): [number, number] => { const m = /^(\d+) and (\d+)$/.exec(s)!; return [Number(m[1]), Number(m[2])]; };

/** Whether (a, b) satisfies the card's equation and condition, from the prompt alone. */
function fits(prompt: string, [a, b]: [number, number]): boolean {
  let m = /^a \+ b = (\d+)\./.exec(prompt);
  if (m) return a + b === Number(m[1]);
  m = /^(\d)a \+ b = (\d+)\./.exec(prompt) as RegExpExecArray;
  if (m) return Number(m[1]) * a + b === Number(m[2]);
  m = /^a × b = (\d+), and a is less than b/.exec(prompt) as RegExpExecArray;
  if (m) return a * b === Number(m[1]) && a < b;
  throw new Error(`unknown card: ${prompt}`);
}

describe('y6-twounknowns (#1273)', () => {
  it('is registered last in the Year 6 algebra strand', () => {
    expect(topic).toMatchObject({ year: 'year6', subject: 'maths', strand: 'algebra' });
    const ids = TOPICS.filter(t => t.year === 'year6' && t.strand === 'algebra').map(t => t.id);
    expect(ids[ids.length - 1]).toBe('y6-twounknowns');
  });

  it('every card has four distinct options with the answer and a safe say', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) {
      expect(new Set(q.options).size, q.prompt).toBe(4); expect(q.options).toContain(q.answer);
      expect(q.say, q.prompt).toBeTruthy(); expect(sayIsSafe(q.say!), q.say).toBe(true);
    }
  });

  it('d1–d2: exactly one option satisfies the equation, by enumeration', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d)) {
      const good = q.options.filter(o => fits(q.prompt, pair(o)));
      expect(good, q.prompt).toEqual([q.answer]);
    }
  });

  it('d1–d2: labels fit the bubble, with numbers up to 20', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draw(d)) for (const o of q.options) {
      expect(o.length, o).toBeLessThanOrEqual(9); expect(Math.max(...pair(o)), o).toBeLessThanOrEqual(20);
    }
  });

  it('d1 never offers the swapped answer pair', () => {
    for (const q of draw(1)) { const [a, b] = pair(q.answer); expect(q.options, q.prompt).not.toContain(`${b} and ${a}`); }
  });

  it('d3: the answer equals a brute-force count and the card states whether order matters', () => {
    for (const q of draw(3)) {
      const m = /1 to (\d+)/.exec(q.prompt)!, t = /a \+ b = (\d+)/.exec(q.prompt)![1];
      const ordered = q.prompt.includes('Order matters');
      expect(ordered || q.prompt.includes('a is less than b'), q.prompt).toBe(true);
      expect(q.answer, q.prompt).toBe(String(countPairs(Number(m[1]), Number(t), ordered ? 'order' : 'less')));
      expect(q.options, q.prompt).toContain(String(countPairs(Number(m[1]), Number(t), ordered ? 'less' : 'order')));
      expect(Number(q.answer)).toBeLessThan(20);
    }
  });

  it('fixed table: a + b = 12 from 1 to 9 has 3 pairs with a < b and 6 with order mattering', () => {
    expect(countPairs(9, 12, 'less')).toBe(3);
    expect(countPairs(9, 12, 'order')).toBe(6);
  });

  it('is marked slow at d3 and nowhere else', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draw(d)) expect(!!q.slow, `${d} ${q.prompt}`).toBe(d === 3);
  });
});
