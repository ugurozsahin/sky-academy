// #2317 (y3-charts): the why states the sum or the reading behind the answer, and it is true.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y3-charts')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };

describe('y3-charts why (#2317)', () => {
  for (const d of [1, 2, 3] as Difficulty[]) {
    it(`d${d}: every question has a why that fits 14 words, and the last number is the answer`, () => {
      for (const q of draw(d)) {
        expect(q.why, q.prompt).toBeTruthy();
        expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
        if (!/^(The .* bar reaches|Each )/.test(q.why!)) expect(q.why!.replace(/\.$/, '').split(/[= ]+/).pop(), q.why).toBe(q.answer);
      }
    });
    it(`d${d}: any sum in the why is arithmetically true`, () => {
      for (const q of draw(d)) for (const m of q.why!.matchAll(/([\d +−]+?) = (\d+)/g)) {
        const parts = m[1].trim().split(' ');
        let v = Number(parts[0]);
        for (let i = 1; i < parts.length; i += 2) v += parts[i] === '+' ? Number(parts[i + 1]) : -Number(parts[i + 1]);
        expect(v, q.why).toBe(Number(m[2]));
      }
    });
  }
  it('d1: a bar reading names the category and the answer', () => {
    for (const q of draw(1)) { const m = /^The (\w+) bar reaches (\d+)\.$/.exec(q.why!); expect(m, q.why).toBeTruthy(); expect(m![2]).toBe(q.answer); expect(q.prompt).toContain(m![1]); }
  });
});
