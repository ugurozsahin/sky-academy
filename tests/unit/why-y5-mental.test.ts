// #2317 (y5-mental): each why is a true step about its own card, within 14 words.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const nums = (s: string) => (s.match(/\d[\d,]*/g) ?? []).map(x => Number(x.replace(/,/g, '')));
const t = TOPICS.find(x => x.id === 'y5-mental')!;

describe('y5-mental whys (#2317)', () => {
  it('every card has a short why that is true of its own card', () => {
    let kinds = { thousands: 0, rest: 0, comp: 0, inverse: 0 };
    for (const d of [1, 2, 3] as Difficulty[]) for (let s = 0; s < 200; s++) {
      const q = t.gen(d, rngOf((s + 1) * 104729 + d)), w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(14);
      const m = nums(w), p = nums(q.prompt), ans = nums(q.answer)[0];
      if (/thousand/.test(w)) {
        kinds.thousands++;
        const [a, b] = p, add = q.prompt.includes('+'), rest = /stays/.test(w) ? m[3] : 0;
        if (rest) kinds.rest++;
        expect(rest, w).toBe(a % 1000);
        expect(m[0] * 1000 + rest).toBe(Math.floor(a / 1000) * 1000 + a % 1000);
        expect(m[1] * 1000).toBe(b);
        expect(add ? m[0] + m[1] : m[0] - m[1]).toBe(m[2]);
        expect(m[2] * 1000 + rest, w).toBe(ans);
      } else if (/^[\d,]+ [+−] [\d,]+ = [\d,]+, [+−] \d$/.test(w)) {
        kinds.comp++;
        const [a] = p, add = q.prompt.includes('+');
        expect(m[0]).toBe(a);
        expect(add ? m[0] + m[1] : m[0] - m[1]).toBe(m[2]);
        expect(add ? m[2] - m[3] : m[2] + m[3]).toBe(ans);
      } else {
        kinds.inverse++;
        expect(w).toMatch(/^[\d,]+ [+−] [\d,]+ = [\d,]+$/);
        expect(p).toContain(m[0] === ans ? -1 : m[0]);
        expect(m[2]).toBe(ans);
        expect(w.includes('+') ? m[0] + m[1] : m[0] - m[1]).toBe(m[2]);
      }
    }
    expect(kinds.thousands).toBeGreaterThan(0);
    expect(kinds.rest).toBeGreaterThan(0);
    expect(kinds.comp).toBeGreaterThan(0);
    expect(kinds.inverse).toBeGreaterThan(0);
  });
});
