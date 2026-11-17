// #2318: y3-check and y4-mistake say why after a wrong slice; each why is tied to its own card.
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const gen = (id: string) => TOPICS.find(t => t.id === id)!.gen;
const hundred = (n: number) => Math.round(n / 100) * 100;

describe('y3-check says why (#2318)', () => {
  it.each([1, 2, 3] as const)('the why matches the stem and the right option at difficulty %i', d => {
    const seen = new Set<string>();
    for (let s = 1; s <= 200; s++) {
      const q = gen('y3-check')(d, rngOf(s));
      const w = q.why!;
      const est = q.prompt.match(/^About how much is (\d+) ([+−]) (\d+)\?$/);
      if (est) {
        const [, a, sign, b] = est;
        expect(w).toBe(`${a} is near ${hundred(+a)} and ${b} is near ${hundred(+b)}: ${hundred(+a)} ${sign} ${hundred(+b)} = ${q.answer}.`);
        seen.add('estimate'); continue;
      }
      const [, a, sign, b, c] = q.prompt.match(/^Which checks (\d+) ([+−]) (\d+) = (\d+)\?$/)!;
      if (sign === '+') {
        const m = w.match(/^Take away one part: (\d+) − (\d+) = (\d+), the other part\.$/)!;
        expect(`${m[1]} − ${m[2]}`).toBe(q.answer);
        expect(m[1]).toBe(c);
        expect([+m[2], +m[3]].sort()).toEqual([+a, +b].sort());
        seen.add('add');
      } else {
        expect(w).toBe(`Add back what you took: ${c} + ${b} = ${a}.`);
        expect(q.answer).toBe(`${c} + ${b}`);
        seen.add('subtract');
      }
    }
    expect(seen.size).toBeGreaterThan(0);
  });
  it('every branch of the why is reached', () => {
    const seen = new Set<string>();
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 200; s++) seen.add(/^\d/.test(gen('y3-check')(d, rngOf(s)).why!) ? 'estimate' : gen('y3-check')(d, rngOf(s)).why!.split(' ')[0]);
    expect([...seen].sort()).toEqual(['Add', 'Take', 'estimate']);
  });
});

describe('y4-mistake says why (#2318)', () => {
  const WORD: Record<string, string> = { O: 'ones', T: 'tens', H: 'hundreds', Th: 'thousands' };
  it.each([1, 2, 3] as const)('the why names the answer column and the right digits, difficulty %i', d => {
    const kinds = new Set<string>();
    for (let s = 1; s <= 300; s++) {
      const q = gen('y4-mistake')(d, rngOf(s));
      const w = q.why!, word = WORD[q.answer];
      const [, a, sign, b, shown] = (q.visual as { text: string }).text.replace(/,/g, '').match(/^(\d+) ([+−]) (\d+) = (\d+)$/)!;
      const r = sign === '+' ? +a + +b : +a - +b;
      const col = Object.keys(WORD).indexOf(q.answer);
      expect(w).toContain(word);
      const slip = w.match(/^The (\w+) column should be (\d), not (\d)\.$/);
      if (slip) {
        expect(slip[1]).toBe(word);
        expect(+slip[2]).toBe(Math.floor(r / 10 ** col) % 10);
        expect(+slip[3]).toBe(Math.floor(+shown / 10 ** col) % 10);
        kinds.add('slip');
      } else if (sign === '+') {
        expect(w).toBe(`The carry from the ${Object.values(WORD)[col - 1]} column was left out of the ${word} column.`);
        kinds.add('carry');
      } else {
        expect(w).toBe(`The exchange from the ${word} column was not crossed out.`);
        kinds.add('exchange');
      }
    }
    expect(kinds.has('slip')).toBe(true);
  });
  it('the carry and exchange sentences are both reached', () => {
    const kinds = new Set<string>();
    for (const d of [1, 2, 3] as const) for (let s = 1; s <= 300; s++) kinds.add(gen('y4-mistake')(d, rngOf(s)).why!.split(' ').slice(0, 2).join(' '));
    expect(kinds.has('The carry')).toBe(true);
    expect(kinds.has('The exchange')).toBe(true);
  });
});
