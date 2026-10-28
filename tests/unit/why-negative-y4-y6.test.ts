// #2317 (y4-negative, y6-negative): each why restates the working its own question rests on, ending on the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === id)!.gen(d, rngOf((s + 1) * 104729 + d)));
const n = (s: string) => Number(s.replace('−', '-').replace(/,/g, ''));

describe('y4-negative whys (#2317)', () => {
  it('every question has a short why that names its answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws('y4-negative', d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.includes(q.answer), q.why).toBe(true);
    }
  });
  it('the hidden tick, the next count back and the missing term follow from the prompt', () => {
    let line = 0, back = 0, gap = 0, story = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws('y4-negative', d)) {
      let m: RegExpExecArray | null;
      if (q.prompt === 'Which number is hidden?') { line++; expect(q.why).toBe(`The ticks go up one at a time, so the hidden one is ${q.answer}`); }
      else if ((m = /^Count back in (\d+)s: /.exec(q.prompt))) { back++; expect(q.why).toBe(`One more ${m[1]} back from 0 is ${q.answer}`); expect(n(q.answer)).toBe(-Number(m[1])); }
      else if ((m = /^Start at (\d+)\. Count back (\d+) in (\d+)s/.exec(q.prompt))) {
        story++;
        const w = /^(\d+) × (\d+) = (\d+), and (\d+) − (\d+) = (.+)$/.exec(q.why!)!;
        expect(w, q.why).toBeTruthy();
        expect([w[1], w[2], w[4]]).toEqual([m[2], m[3], m[1]]);
        expect(Number(w[1]) * Number(w[2])).toBe(Number(w[3]));
        expect(w[5]).toBe(w[3]);
        expect(n(w[6])).toBe(n(q.answer));
        expect(Number(w[4]) - Number(w[5])).toBe(n(q.answer));
      } else {
        gap++;
        const terms = q.prompt.split(', ');
        const i = terms.indexOf('?');
        const w = /^Each step is (\d+) less: (−?\d+) − (\d+) = (.+)$/.exec(q.why!)!;
        expect(w, q.why).toBeTruthy();
        expect(n(w[2])).toBe(n(terms[i - 1]));
        expect(w[3]).toBe(w[1]);
        expect(n(w[2]) - Number(w[3])).toBe(n(q.answer));
        expect(n(w[4])).toBe(n(q.answer));
      }
    }
    expect(line).toBeGreaterThan(20); expect(back).toBeGreaterThan(20); expect(story).toBeGreaterThan(10); expect(gap).toBeGreaterThan(10);
  });
});

describe('y6-negative whys (#2317)', () => {
  it('every question has a why that ends on, or names, its answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws('y6-negative', d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.includes(q.answer), q.why).toBe(true);
      expect(q.why, q.why).not.toMatch(/\b1 (steps|floors|degrees)\b/);
    }
  });
  it('the interval adds the way up to zero and the rest', () => {
    for (const q of draws('y6-negative', 1)) {
      const m = /^How many degrees from −(\d+) °C to (\d+) °C\?$/.exec(q.prompt)!;
      expect(q.why).toBe(`${m[1]} up to 0, then ${m[2]} more: ${m[1]} + ${m[2]} = ${q.answer}`);
      expect(Number(m[1]) + Number(m[2])).toBe(n(q.answer));
    }
  });
  it('a sum goes via zero when it crosses it, and further down when it does not', () => {
    let via = 0, down = 0;
    for (const q of draws('y6-negative', 2)) {
      const m = /^(−?\d+) ([+−]) (\d+) = \?$/.exec(q.prompt)!;
      const a = n(m[1]), b = Number(m[3]);
      if (m[2] === '−' && a < 0) {
        down++;
        expect(q.why).toBe(`Minus ${b} goes further down: ${m[1]} − ${b} = ${q.answer}`);
      } else {
        via++;
        const w = /^(\d+) steps? to 0, then (\d+) more is (.+)$/.exec(q.why!)!;
        expect(w, q.why).toBeTruthy();
        expect(Number(w[1])).toBe(Math.abs(a));
        expect(Number(w[1]) + Number(w[2]), q.why).toBe(b);
        expect(w[3]).toBe(q.answer);
      }
      expect(n(q.answer)).toBe(m[2] === '+' ? a + b : a - b);
    }
    expect(via).toBeGreaterThan(20); expect(down).toBeGreaterThan(10);
  });
  it('a story counts to zero (or the surface, or the ground) and then the rest', () => {
    const seen = new Set<string>();
    for (const q of draws('y6-negative', 3)) {
      const w = /^(\d+) (?:(?:degrees?|steps?|floors?) to (?:0|the ground)|m up to the surface|up to 0), then (\d+) more(?: is |: (\d+) \+ \d+ = )(.+)$/.exec(q.why!)!;
      expect(w, q.why).toBeTruthy();
      expect(w[4], q.why).toBe(q.answer);
      seen.add(q.prompt.replace(/[−\d]+/g, '#').slice(0, 14));
      const nums = q.prompt.match(/−?\d+/g)!.map(n);
      const [s, c] = [nums[0], nums[1]];
      const first = Number(w[1]), rest = Number(w[2]);
      if (q.prompt.startsWith('Freezer')) expect(first + rest, q.why).toBe(n(q.answer));
      else expect(first + rest, q.why).toBe(Math.abs(c));
      expect([Math.abs(s), c].includes(first) || Math.abs(s) === first, q.why).toBe(true);
    }
    expect(seen.size, [...seen].join()).toBeGreaterThanOrEqual(4);
  });
});
