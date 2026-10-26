// #2317 (squares and cubes): each why restates the multiplication its own question rests on, ending in the answer.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === 'y5-squares')!.gen(d, rngOf((s + 1) * 104729 + d)));
const num = (s: string) => Number(s.replace(/,/g, ''));

describe('y5-squares whys (#2317)', () => {
  it('n² and n³ cards show the repeated product from their own prompt, ending in the answer', () => {
    let seen = 0;
    for (const q of [...draws(1), ...draws(2)]) {
      const m = /^(\d+)([²³]) = ?\?$/.exec(q.prompt);
      if (!m) continue;
      seen++;
      const n = Number(m[1]), p = m[2] === '²' ? 2 : 3;
      expect(q.why, q.prompt).toBe(`${n}${m[2]} = ${Array(p).fill(n).join(' × ')} = ${q.answer}`);
      expect(n ** p, q.why).toBe(num(q.answer));
    }
    expect(seen).toBeGreaterThan(200);
  });
  it('"which is a square / cube" shows the number multiplied out to the right answer', () => {
    for (const [d, word, p] of [[1, 'square', 2], [2, 'cube', 3]] as const) {
      const qs = draws(d as Difficulty).filter(q => q.prompt === `Which is a ${word} number?`);
      expect(qs.length).toBeGreaterThan(20);
      for (const q of qs) {
        const parts = q.why!.split(' = ');
        expect(parts[1], q.why).toBe(q.answer);
        const fs = parts[0].split(' × ').map(Number);
        expect(fs.length, q.why).toBe(p);
        expect(new Set(fs).size, q.why).toBe(1);
        expect(fs[0] ** p, q.why).toBe(num(q.answer));
      }
    }
  });
  it('the d3 forms: sum of squares, the root, the side and the one both', () => {
    const forms = new Set<string>();
    for (const q of draws(3)) {
      let m: RegExpExecArray | null;
      if ((m = /^(\d+)² \+ (\d+)² = \?$/.exec(q.prompt))) {
        const [a, b] = [Number(m[1]), Number(m[2])];
        expect(q.why).toBe(`${a * a} + ${b * b} = ${a * a + b * b}`);
        expect(String(a * a + b * b)).toBe(q.answer); forms.add('sum');
      } else if ((m = /^What number squared is (\d+)\?$/.exec(q.prompt))) {
        expect(q.why).toBe(`${q.answer} × ${q.answer} = ${m[1]}, so the number is ${q.answer}`);
        expect(Number(q.answer) ** 2).toBe(Number(m[1])); forms.add('root');
      } else if ((m = /^A square has an area of (\d+) cm²/.exec(q.prompt))) {
        const n = parseInt(q.answer, 10);
        expect(q.why).toBe(`${n} × ${n} = ${m[1]}, so each side is ${q.answer}`);
        expect(n * n).toBe(Number(m[1])); forms.add('side');
      } else {
        expect(q.why, q.prompt).toBe('8 × 8 = 64 and 4 × 4 × 4 = 64');
        expect(q.answer).toBe('64'); forms.add('both');
      }
    }
    expect([...forms].sort()).toEqual(['both', 'root', 'side', 'sum']);
  });
});
