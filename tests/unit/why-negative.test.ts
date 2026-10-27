// #2317 (y5-negative): each why restates the working its own question rests on, ending in the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y5-negative')!.gen(d, rngOf((s + 1) * 104729 + d)));
const n = (s: string) => Number(s.replace('−', '-'));

describe('y5-negative whys (#2317)', () => {
  it('every question has a why of at most 14 words that ends on its answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(' ').length, q.why).toBeLessThanOrEqual(14);
      expect(q.why!.includes(q.answer), q.why).toBe(true);
      expect(q.why, q.why).not.toMatch(/\b1 steps\b/);
    }
  });
  it('counting through zero: the steps to zero plus the rest land on the answer', () => {
    let seen = 0, one = 0;
    for (const q of draws(1)) {
      const m = /^Start at (−?\d+) and count (back|on) (\d+)/.exec(q.prompt);
      if (!m) continue;
      seen++;
      const w = /^(\d+) steps? to 0, then (\d+) more is (.+)$/.exec(q.why!)!;
      expect(w, q.why).toBeTruthy();
      expect(Number(w[1]) + Number(w[2]), q.why).toBe(Number(m[3]));
      expect(w[3]).toBe(q.answer);
      expect(q.why!.startsWith(`${w[1]} ${w[1] === '1' ? 'step' : 'steps'} to 0`), q.why).toBe(true);
      if (w[1] === '1') one++;
      expect(n(w[3]), q.why).toBe(m[2] === 'back' ? n(m[1]) - Number(m[3]) : n(m[1]) + Number(m[3]));
    }
    expect(seen).toBeGreaterThan(20);
    expect(one, 'a start of 1 is drawn').toBeGreaterThan(0);
  });
  it('number line: the marks step and the answer match the visual', () => {
    let seen = 0;
    for (const q of draws(1)) {
      if (q.prompt !== 'What number is at A?') continue;
      seen++;
      const v = q.visual as { step: number };
      const m = /^The marks go up (one at a time|in (\d+)s), so A is (.+)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      expect(m[3]).toBe(q.answer);
      expect(m[1] === 'one at a time' ? 1 : Number(m[2]), q.why).toBe(v.step);
    }
    expect(seen).toBeGreaterThan(20);
  });
  it('temperature change and gap show a sum that equals the answer', () => {
    let seen = 0, gaps = 0;
    for (const q of draws(2)) {
      let m = /^It is (−?\d+) °C\. It gets (\d+) degrees (warmer|colder)/.exec(q.prompt);
      if (m) {
        seen++;
        expect(q.why).toBe(m[3] === 'warmer' ? `Warmer is up: ${m[1]} + ${m[2]} = ${q.answer}` : `Colder is down: ${m[1]} − ${m[2]} = ${q.answer}`);
        expect(n(q.answer)).toBe(m[3] === 'warmer' ? n(m[1]) + Number(m[2]) : n(m[1]) - Number(m[2]));
      } else if ((m = /^How many degrees warmer is (\d+) °C than (−\d+) °C/.exec(q.prompt))) {
        gaps++;
        expect(q.why).toBe(`${-n(m[2])} up to 0, then ${m[1]} more: ${-n(m[2])} + ${m[1]} = ${q.answer}`);
        expect(-n(m[2]) + Number(m[1])).toBe(Number(q.answer));
      }
    }
    expect(seen).toBeGreaterThan(20); expect(gaps).toBeGreaterThan(10);
  });
  it('sequences step from the last shown term to the answer; coldest names its answer', () => {
    let seq = 0, cold = 0;
    for (const q of draws(3)) {
      if (q.prompt === 'Which temperature is the coldest?') { cold++; expect(q.why).toBe(`${q.answer} is furthest below zero, so it is coldest`); continue; }
      seq++;
      const terms = q.prompt.replace(', … what comes next?', '').split(', ').map(n);
      const m = /^Each step goes (down|up) (\d+): (−?\d+) [−+] \d+ = (.+)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      expect(n(m[3])).toBe(terms[2]);
      expect(n(m[4])).toBe(n(q.answer));
      expect(terms[2] + (m[1] === 'up' ? 1 : -1) * Number(m[2])).toBe(n(q.answer));
    }
    expect(seq).toBeGreaterThan(20); expect(cold).toBeGreaterThan(20);
  });
});
