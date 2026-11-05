// #2317 (y3-compare): the why names the column that decides, or the order of three numbers.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const num = (s: string) => +s.replace(/,/g, '');
const cols = (n: number) => [Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10];
const draw = () => { const t = TOPICS.find(x => x.id === 'y3-compare')!; return ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d)))); };

describe('y3-compare why (#2317)', () => {
  it('every why matches its own question and answer', () => {
    const kinds = new Set<string>();
    for (const q of draw()) {
      const w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(14);
      if (q.sequence) {
        expect(w).toBe(`Compare tens, then ones: ${q.sequence.join(', ')}.`); kinds.add('order');
        const ns = q.sequence.map(num);
        expect(ns, w).toEqual([...ns].sort((x, y) => x - y));
        expect(new Set(ns.map(n => Math.floor(n / 100))).size, w).toBe(1);
      } else if (/ are the same number\.$/.test(w)) {
        expect(q.answer).toBe('='); kinds.add('=');
      } else {
        const m = /^([\d,]+) ([<>]) ([\d,]+): (\d+) (hundred|ten|one)s? is (more|less) than (\d+) \5s?\.$/.exec(w);
        expect(m, w).toBeTruthy();
        expect(q.prompt).toBe(`${m![1]} ? ${m![3]}`);
        expect(q.answer).toBe(m![2]);
        expect(num(m![1]) > num(m![3])).toBe(m![2] === '>');
        expect(+m![4] > +m![7]).toBe(m![6] === 'more');
        // the unit and both digits are those of the FIRST column where the two numbers differ (#2317 review)
        const da = cols(num(m![1])), db = cols(num(m![3])), i = da.findIndex((x, k) => x !== db[k]);
        expect(m![5], w).toBe(['hundred', 'ten', 'one'][i]);
        expect([+m![4], +m![7]], w).toEqual([da[i], db[i]]);
        kinds.add(m![2]);
      }
    }
    expect([...kinds].sort()).toEqual(['<', '=', '>', 'order']);
  });

  it('names the right column in the fixed edge cases', () => {
    const t = TOPICS.find(x => x.id === 'y3-compare')!;
    const whys = new Set<string>();
    for (let seed = 1; seed < 4000; seed++) for (const d of [2, 3] as Difficulty[]) whys.add(t.gen(d, rngOf(seed * 7919 + d)).why!);
    expect([...whys].some(w => /^1,000 [<>] \d+: 10 hundreds is (more|less) than 9 hundreds\.$/.test(w))).toBe(true);
    expect([...whys].some(w => /^\d\d [<>] \d{3}: 0 hundreds is less than 1 hundred\.$/.test(w))).toBe(true);
  });
});
