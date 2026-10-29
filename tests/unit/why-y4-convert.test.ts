// #2317 (y4-convert): each why states a true fact about its own question and ends in the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const qs = ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y4-convert')!.gen(d, rngOf((s + 1) * 104729 + d))));
const n = (s: string) => Number(s.replace(/,/g, ''));

describe('y4-convert whys (#2317)', () => {
  it('every why ends in the card answer', () => {
    for (const q of qs) expect(q.why!.split(/[=:]/).pop()!.trim(), q.why).toBe(q.answer);
  });
  it('a scale why multiplies or divides by the stated factor, and the factor is the pair on the card', () => {
    const scale = qs.filter(q => /^1 \S+ = [\d,]+ \S+: /.test(q.why!));
    expect(scale.length).toBeGreaterThan(300);
    for (const q of scale) {
      const m = /^1 (\S+) = ([\d,]+) (\S+): ([\d.,]+) ([×÷]) ([\d,]+) = ([\d.,]+)$/.exec(q.why!)!;
      expect(m, q.why).toBeTruthy();
      const [f, a, f2, r] = [n(m[2]), n(m[4]), n(m[6]), n(m[7])];
      expect(f2, q.why).toBe(f);
      expect(m[5] === '×' ? a * f : a / f, q.why).toBeCloseTo(r, 9);
      expect(q.prompt.includes(`= ? ${m[3]}`) || q.prompt.endsWith(`How many ${m[3]}?`) || m[5] === '÷', `${q.prompt} / ${q.why}`).toBe(true);
      expect(q.prompt.startsWith(`${m[4]} `) || q.prompt.includes(` ${m[4]} `), `${q.prompt} / ${q.why}`).toBe(true);
    }
  });
  it('never opens with a plural big unit', () => {
    for (const q of qs) expect(q.why, q.prompt).not.toMatch(/^1 (hours|minutes|years|weeks|months)/);
  });
  it('a compound why has true arithmetic in both steps', () => {
    const comp = qs.filter(q => q.why!.includes(';'));
    expect(comp.length).toBeGreaterThan(50);
    expect(comp.some(q => /\d,\d{3} \+ /.test(q.why!)), 'a four-digit step carries its comma').toBe(true);
    for (const q of comp) for (const step of q.why!.split(';')) {
      const m = /^([\d,]+) ([×+]) ([\d,]+) = ([\d,]+)$/.exec(step.trim())!;
      expect(m, q.why).toBeTruthy();
      expect(m[2] === '×' ? n(m[1]) * n(m[3]) : n(m[1]) + n(m[3]), q.why).toBe(n(m[4]));
    }
  });
});
