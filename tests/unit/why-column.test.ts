// #2317 (y3-column, y4-column, y5-column): each why is one true, short step of the written method for its own card.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { columnWhy } from '../../src/curriculum/column-why';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const nums = (s: string) => (s.match(/\d[\d,]*/g) ?? []).map(x => Number(x.replace(/,/g, '')));

const COLS = ['Units', 'Tens', 'Hundreds', 'Thousands', 'Ten thousands', 'Hundred thousands'];
const digitAt = (n: number, col: number) => Math.floor(n / 10 ** col) % 10;
const roundTo = (n: number, to: number) => Math.round(n / to) * to;
/** #2525: true when the why's numbers come from the card's own operands (the part of the prompt the child is asked about). */
function tiedToOperands(prompt: string, why: string): boolean {
  const m = nums(why), col = COLS.findIndex(c => why.startsWith(c + ':'));
  const shown = nums(prompt.includes('Check:') ? prompt.split('Check:')[1] : prompt);
  if (col >= 0) { const [a, b] = shown; return m[0] === digitAt(a, col) && m[1] === digitAt(b, col); }
  if (/^Round/.test(prompt)) { const to = shown[0], [a, b] = shown.slice(1); return m[0] === roundTo(a, to) && m[1] === roundTo(b, to); }
  return nums(prompt).includes(m[0]) && nums(prompt).includes(m[1]); // missing digit: the inverse reuses the prompt's numbers
}

describe('columnWhy (#2317)', () => {
  it('fixed cases read as the step a child follows', () => {
    expect(columnWhy(347, 285, true)).toBe('Units: 7 + 5 = 12, write 2, carry 1');
    expect(columnWhy(341, 285, true)).toBe('Tens: 4 + 8 = 12, write 2, carry 1');
    expect(columnWhy(21, 14, true)).toBe('Units: 1 + 4 = 5, no carry');
    expect(columnWhy(503, 178, false)).toBe('Units: 3 < 8, so 13 − 8 = 5');
    expect(columnWhy(587, 34, false)).toBe('Units: 7 − 4 = 3, no exchange');
    expect(columnWhy(50300, 1780, false)).toBe('Tens: 0 < 8, so 10 − 8 = 2');
  });
  it('the arithmetic of every why is true', () => {
    for (const id of ['y3-column', 'y4-column', 'y5-column']) {
      const t = TOPICS.find(x => x.id === id)!;
      for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
        const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
        expect(w, q.prompt).toBeTruthy();
        expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(14);
        const m = nums(w);
        if (/^(Units|Tens|Hundreds|Thousands|Ten thousands|Hundred thousands):/.test(w)) {
          if (/< /.test(w)) { expect(m[0] + 10, w).toBe(m[2]); expect(m[2] - m[3], w).toBe(m[4]); }
          else if (/\+/.test(w)) expect(m[0] + m[1], w).toBe(m[2]);
          else expect(m[0] - m[1], w).toBe(m[2]);
        } else if (/−/.test(w) || /\+/.test(w)) {
          const [x, y, z] = m; // inverse check or rounded estimate
          expect(/−/.test(w) ? x - y : x + y, w).toBe(z);
        }
      }
    }
  });
  it('an estimate why uses the rounded numbers and a missing-digit why is the inverse', () => {
    const e = TOPICS.find(x => x.id === 'y5-column')!;
    let est = 0;
    for (let s = 0; s < 300; s++) {
      const q = e.gen(3, rngOf((s + 1) * 7 + 3));
      if (/^Round/.test(q.prompt)) { est++; expect(nums(q.why!).pop(), q.why).toBe(nums(q.answer)[0]); }
    }
    expect(est).toBeGreaterThan(0);
  });
  it('every why is built from its own card\'s operands, not another number (#2525)', () => {
    for (const id of ['y3-column', 'y4-column', 'y5-column']) {
      const t = TOPICS.find(x => x.id === id)!;
      for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
        const q = t.gen(d, rngOf((s + 1) * 15485863 + d));
        expect(tiedToOperands(q.prompt, q.why!), `${q.prompt} → ${q.why}`).toBe(true);
      }
    }
  });
  it('the operand check rejects a swapped or foreign why', () => {
    expect(tiedToOperands('347 + 285 = ?', columnWhy(347, 285, true))).toBe(true);
    expect(tiedToOperands('347 + 285 = ?', columnWhy(285, 347, true))).toBe(false);
    expect(tiedToOperands('503 − 178 = ?', columnWhy(178, 503, false))).toBe(false);
    expect(tiedToOperands('6,499 + 174 = 6,673. Check: 6,673 − 174 = ?', columnWhy(6499, 174, false))).toBe(false);
    expect(tiedToOperands('6,499 + 174 = 6,673. Check: 6,673 − 174 = ?', columnWhy(6673, 174, false))).toBe(true);
  });
});
