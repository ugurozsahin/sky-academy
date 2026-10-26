// #2317 (ratio and percentage family): each y6-ratio / y6-percentof why restates the sum its own answer comes from.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === id)!.gen(d, rngOf((s + 1) * 104729 + d)));
const num = (s: string) => Number(s.replace(/,/g, ''));

describe('y6-ratio whys (#2317)', () => {
  it('"for every" multiplies the groups found by the other part', () => {
    for (const q of draws('y6-ratio', 1)) {
      const m = /^(\d+) is (\d+) groups of (\d+), and (\d+) × (\d+) = (\d+)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      expect(num(m[1]) / num(m[3]), q.why).toBe(num(m[2]));
      expect(num(m[2]) * num(m[5]), q.why).toBe(num(m[6]));
      expect(m[6], q.why).toBe(q.answer);
      // the figures come from the prompt: known amount, group size (first "for every" number), other part (second)
      const r = /^For every (\d+) .+? there (?:is|are) (\d+) .+?\. ([\d,]+) .+?: how many/.exec(q.prompt)!;
      expect(r, q.prompt).toBeTruthy();
      expect(num(m[1]), q.why).toBe(num(r[3]));
      expect(num(m[3]), q.why).toBe(num(r[1]));
      expect(num(m[5]), q.why).toBe(num(r[2]));
    }
  });
  it('sharing: parts × part size is the whole, and the second factor is the share asked for', () => {
    for (const q of draws('y6-ratio', 2)) {
      const m = /^(\d+) parts, each (\d+)\. (\d+) × (\d+) = (\d+)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      const [parts, unit, share, again, ans] = m.slice(1).map(Number);
      expect(again, q.why).toBe(unit);
      expect(share * unit, q.why).toBe(ans);
      expect(q.why!.endsWith(`= ${q.answer}`), q.why).toBe(true);
      const r = /^(\d+) \w+: (\w+) gets (\d+) for every (\d+) (\w+) gets\. How many for (\w+)\?$/.exec(q.prompt);
      if (r) {   // ratio share: parts = a + b, the share is the asked name's side
        const [total, a, b] = [r[1], r[3], r[4]].map(Number);
        expect(parts, q.why).toBe(a + b);
        expect(parts * unit, q.why).toBe(total);
        expect(share, q.why).toBe(r[6] === r[2] ? a : b);
        continue;
      }
      const f = /^(\d+)\/(\d+) of a \w+ of (\d+) are \w+\. How many (are not|are)\?$/.exec(q.prompt)!;   // fraction: parts = denominator
      expect(f, q.prompt).toBeTruthy();
      const [n, d, total] = [f[1], f[2], f[3]].map(Number);
      expect(parts, q.why).toBe(d);
      expect(parts * unit, q.why).toBe(total);
      expect(share, q.why).toBe(f[4] === 'are not' ? d - n : n);
    }
  });
  it('scale cards: each form shows its own operation, operands from the prompt, and ends on the answer', () => {
    const seen = new Set<string>();
    for (const q of draws('y6-ratio', 3)) {
      const w = q.why!;
      let m: RegExpExecArray | null;
      if ((m = /^A (\d+) cm by (\d+) cm rectangle, scale factor (\d+)\. New longer side, in cm\?$/.exec(q.prompt))) {
        const [s, l, k] = [m[1], m[2], m[3]].map(Number);
        expect(l, q.prompt).toBeGreaterThan(s);
        expect(w, q.prompt).toBe(`Longer side: ${l} × ${k} = ${l * k} cm`);
        expect(String(l * k), w).toBe(q.answer); seen.add('rectangle');
      } else {
        m = /^A (\d+) cm side becomes (\d+) cm\. What is the scale factor\?$/.exec(q.prompt)!;
        expect(m, q.prompt).toBeTruthy();
        const [old, nw] = [m[1], m[2]].map(Number);
        expect(w, q.prompt).toBe(`New ÷ old: ${nw} ÷ ${old} = ${nw / old}`);
        expect(String(nw / old), w).toBe(q.answer); seen.add('factor');
      }
    }
    expect([...seen].sort()).toEqual(['factor', 'rectangle']);
  });
});

describe('y6-percentof whys (#2317)', () => {
  it('the 5% step times its count is the answer, and 5% itself has no "1 lots"', () => {
    const seen = new Set<string>();
    for (const d of [1, 2] as Difficulty[]) for (const q of draws('y6-percentof', d)) {
      const pr = /^(\d+)% of ([\d,]+) = \?$/.exec(q.prompt)!;
      expect(pr, q.prompt).toBeTruthy();
      expect(q.why, q.prompt).not.toMatch(/\b1 lots/);
      if (Number(pr[1]) === 5) {
        expect(q.why, q.prompt).toBe(`5% of ${pr[2]} is ${q.answer}`); seen.add('five');
        continue;
      }
      const m = /^5% of ([\d,]+) is ([\d,]+); (\d+) lots of that is ([\d,]+)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      expect(num(m[1]), q.why).toBe(num(pr[2]));
      expect(num(m[1]) / 20, q.why).toBe(num(m[2]));
      expect(Number(m[3]) * 5, q.why).toBe(Number(pr[1]));
      expect(num(m[2]) * num(m[3]), q.why).toBe(num(m[4]));
      expect(m[4], q.why).toBe(q.answer); seen.add('lots');
    }
    expect([...seen].sort()).toEqual(['five', 'lots']);
  });
  it('every word problem shows true arithmetic and ends on the card\'s own answer', () => {
    const seen = new Set<string>();
    for (const q of draws('y6-percentof', 3)) {
      const w = q.why!, pr = q.prompt;
      let m: RegExpExecArray | null;
      if ((m = /^A coat costs £([\d,]+)\. It has (\d+)% off/.exec(pr))) {
        const w2 = /^(\d+)% of £([\d,]+) is £([\d,]+), so pay £([\d,]+)$/.exec(w)!;
        expect(w2, w).toBeTruthy();
        expect([num(w2[2]), Number(w2[1])], w).toEqual([num(m[1]), Number(m[2])]);
        expect(num(w2[2]) * Number(w2[1]) / 100, w).toBe(num(w2[3]));
        expect(num(w2[2]) - num(w2[3]), w).toBe(num(w2[4]));
        expect(w.endsWith(`£${q.answer}`), w).toBe(true); seen.add('coat');
      } else if ((m = /^What is (\d+)% of (\d+) (kg|litres|m), in (grams|ml|cm)\?$/.exec(pr))) {
        const w2 = /^(\d+) (\w+) is ([\d,]+) (\w+); (\d+)% of that is ([\d,]+)$/.exec(w)!;
        expect(w2, w).toBeTruthy();
        const f = m[4] === 'cm' ? 100 : 1000;
        expect([w2[1], w2[2], w2[4], w2[5]], w).toEqual([m[2], m[3], m[4], m[1]]);
        expect(Number(m[2]) * f, w).toBe(num(w2[3]));
        expect(num(w2[3]) * Number(m[1]) / 100, w).toBe(num(w2[6]));
        expect(w.endsWith(` ${q.answer}`), w).toBe(true); seen.add('measure');
      } else if ((m = /^A: (\d+)% of (\d+)\. B: (\d+)% of (\d+)\./.exec(pr))) {
        const w2 = /^A is (\d+), B is (\d+); they differ by (\d+)$/.exec(w)!;
        expect(w2, w).toBeTruthy();
        expect([Number(m[1]) * Number(m[2]) / 100, Number(m[3]) * Number(m[4]) / 100], w).toEqual([Number(w2[1]), Number(w2[2])]);
        expect(Math.abs(Number(w2[1]) - Number(w2[2])), w).toBe(Number(w2[3]));
        expect(w.endsWith(` ${q.answer}`), w).toBe(true); seen.add('compare');
      } else {
        m = /^([\d,]+) \w+: (\d+)% /.exec(pr)!;
        expect(m, pr).toBeTruthy();
        const w2 = /^(\d+)% of ([\d,]+) is ([\d,]+); ([\d,]+) − ([\d,]+) = ([\d,]+)$/.exec(w)!;
        expect(w2, w).toBeTruthy();
        expect([Number(w2[1]), num(w2[2])], w).toEqual([Number(m[2]), num(m[1])]);
        expect(num(w2[2]) * Number(w2[1]) / 100, w).toBe(num(w2[3]));
        expect([num(w2[4]), num(w2[5])], w).toEqual([num(w2[2]), num(w2[3])]);
        expect(num(w2[4]) - num(w2[5]), w).toBe(num(w2[6]));
        expect(w.endsWith(` ${q.answer}`), w).toBe(true); seen.add('items');
      }
    }
    expect([...seen].sort()).toEqual(['coat', 'compare', 'items', 'measure']);
  });
});
