// #2317 (decimals family): each y6-decimals why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y6-decimals')!.gen(d, rngOf((s + 1) * 104729 + d)));
const COLUMN = ['tens', 'ones', 'tenths', 'hundredths', 'thousandths'];

describe('y6-decimals whys (#2317)', () => {
  it('d1 names the column the asked digit really sits in, and its value', () => {
    for (const q of draws(1)) {
      const m = /^What is the value of the (\d) in ([\d,.]+)\?$/.exec(q.prompt)!;
      const m2 = /^The (\d) is in the (\w+) column: (.+)$/.exec(q.why!)!;
      expect(m2, q.why).toBeTruthy();
      const [whole, frac] = m[2].replace(/,/g, '').split('.');
      const num = (whole + frac.padEnd(3, '0')).padStart(5, '0');   // tens … thousandths
      // a trailing zero is dropped from the printed number, but the asked digit is never zero, so the column is its one occurrence
      expect(num.split(m[1]).length - 1, q.prompt).toBe(1);
      expect(COLUMN[num.indexOf(m[1])], q.why).toBe(m2[2]);
      expect(m2[3], q.why).toBe(q.answer);
    }
  });
  it('d2 and d3 name the direction and the number of places the digits really moved', () => {
    for (const q of draws(2)) {
      const m = /^([\d,.]+) (×|÷) ([\d,]+) = \?$/.exec(q.prompt)!;
      const n = String(m[3]).replace(/,/g, '').length - 1;
      expect(q.why, q.prompt).toBe(`Digits move ${['one place', 'two places', 'three places'][n - 1]} ${m[2] === '×' ? 'left' : 'right'}: ${q.answer}`);
    }
    for (const q of draws(3)) {
      const a = /^([\d,.]+) (×|÷) \? = ([\d,.]+)$/.exec(q.prompt);
      if (a) { expect(q.why, q.prompt).toMatch(new RegExp(`^Digits moved (one|two|three) places?s?, so \\${a[2]} ${q.answer}$`)); continue; }
      const b = /^\? (×|÷) ([\d,]+) = ([\d,.]+)$/.exec(q.prompt)!;
      expect(q.why, q.prompt).toBe(`Undo it: ${b[3]} ${b[1] === '×' ? '÷' : '×'} ${b[2]} = ${q.answer}`);
    }
  });
});
