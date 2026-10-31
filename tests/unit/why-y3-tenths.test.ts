// #2317 (y3-tenths): each why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y3-tenths')!.gen(d, rngOf((s + 1) * 104729 + d)));

const val = (s: string) => { const f = /^(\d+)\/(\d+)$/.exec(s); return f ? Number(f[1]) / Number(f[2]) : Number(s); };

describe('y3-tenths whys (#2317)', () => {
  it('every card has a short why', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(10);
    }
  });
  it('a line why steps one tenth to the hidden number or from it', () => {
    for (const d of [1, 2] as Difficulty[]) for (const q of draws(d)) {
      if (q.prompt.startsWith('What is one tenth')) continue;
      const m = /^(\S+) \+ 1 tenth = (\S+)$/.exec(q.why!);
      expect(m, q.why).not.toBeNull();
      expect([m![1], m![2]]).toContain(q.answer);
      expect(val(m![2]) - val(m![1]), q.why).toBeCloseTo(0.1, 9);
    }
  });
  it('a more/less why agrees with its prompt and answer', () => {
    let n = 0;
    for (const q of draws(2)) {
      const p = /^What is one tenth (more|less) than (\S+)\?$/.exec(q.prompt);
      if (!p) continue;
      n++;
      expect(q.why).toBe(`${p[2]} ${p[1] === 'more' ? '+' : '−'} 0.1 = ${q.answer}`);
    }
    expect(n).toBeGreaterThan(0);
  });
  it('a d3 why multiplies or divides into the answer', () => {
    let tenths = 0, div = 0;
    for (const q of draws(3)) {
      let m: RegExpExecArray | null;
      if ((m = /^How many tenths make (\d)\?$/.exec(q.prompt))) {
        tenths++;
        expect(q.why).toBe(`${m[1]} × 10 = ${q.answer} tenths`);
      } else if ((m = /^(\d) ÷ 10 = \? \(as a (fraction|decimal)\)$/.exec(q.prompt))) {
        div++;
        expect(q.why).toBe(`${m[1]} ÷ 10 = ${q.answer}`);
        expect(q.answer).toBe(m[2] === 'fraction' ? `${m[1]}/10` : `0.${m[1]}`);
      }
    }
    expect(tenths).toBeGreaterThan(0); expect(div).toBeGreaterThan(0);
  });
});
