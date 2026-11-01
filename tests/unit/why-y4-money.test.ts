// #2317 (y4-money family): each why is the same sum in whole pence and matches its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y4-money')!.gen(d, rngOf((s + 1) * 104729 + d)));
const pence = (label: string) => Math.round(Number(label.replace('£', '')) * 100);

describe('y4-money whys (#2317)', () => {
  it('every question at every level has a why', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) expect(q.why, q.prompt).toBeTruthy();
  });
  it('sums do the real arithmetic in pence and land on the answer', () => {
    let seen = 0;
    for (const q of draws(2)) {
      const m = /^(\d+)p ([+−]) (\d+)p = (\d+)p$/.exec(q.why!);
      if (!m) continue;
      seen++;
      expect(m[2] === '+' ? +m[1] + +m[3] : +m[1] - +m[3], q.why).toBe(+m[4]);
      expect(pence(q.answer), q.why).toBe(+m[4]);
    }
    expect(seen).toBeGreaterThan(0);
  });
  it('notation and comparison whys agree with the answer', () => {
    for (const q of draws(1)) {
      const n = /^100p make £1, so (\d+)p = (£[\d.]+)$/.exec(q.why!);
      if (n) { expect(q.prompt, q.why).toBe(`${n[1]}p = ?`); expect(n[2]).toBe(q.answer); continue; }
      const c = /^(\d+)p and (\d+)p, so (\d+)p is more$/.exec(q.why!)!;
      expect(c, q.why).not.toBeNull();
      expect(Math.max(+c[1], +c[2])).toBe(+c[3]);
      expect(pence(q.answer), q.why).toBe(+c[3]);
    }
  });
  it('problem whys multiply, share or take a fraction correctly', () => {
    const seen = { mul: 0, div: 0, frac: 0, left: 0 };
    for (const q of draws(3)) {
      let m;
      if ((m = /^(\d+) × (\d+)p = (\d+)p$/.exec(q.why!))) { seen.mul++; expect(+m[1] * +m[2]).toBe(+m[3]); expect(pence(q.answer)).toBe(+m[3]); }
      else if ((m = /^(\d+)p ÷ (\d+) = (\d+)p$/.exec(q.why!))) {
        // a unit fraction off ("÷ 4 = 300p") and an equal share ("÷ 3 friends") read alike
        expect(+m[1] / +m[2]).toBe(+m[3]); expect(pence(q.answer)).toBe(+m[3]);
        q.prompt.includes('shared') ? seen.div++ : seen.frac++;
      } else if ((m = /^(\d+)p ÷ (\d+) = (\d+)p, × (\d+) = (\d+)p$/.exec(q.why!))) { seen.frac++; expect((+m[1] / +m[2]) * +m[4]).toBe(+m[5]); expect(pence(q.answer)).toBe(+m[5]); }
      else if ((m = /^(\d)\/(\d+) off is (\d+)p, so (\d+)p − (\d+)p = (\d+)p$/.exec(q.why!))) { seen.left++; expect((+m[4] / +m[2]) * +m[1]).toBe(+m[3]); expect(+m[4] - +m[5]).toBe(+m[6]); expect(m[3]).toBe(m[5]); expect(pence(q.answer)).toBe(+m[6]); }
      else throw new Error(`unrecognised why: ${q.why}`);
    }
    expect(seen.mul).toBeGreaterThan(0); expect(seen.div).toBeGreaterThan(0); expect(seen.frac).toBeGreaterThan(0); expect(seen.left).toBeGreaterThan(0);
  });
});
