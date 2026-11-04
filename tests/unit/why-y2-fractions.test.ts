// #2317 (y2-fractions): the why names the shaded parts out of the equal parts, or the share worked as divide then multiply.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = () => { const t = TOPICS.find(x => x.id === 'y2-fractions')!; return ([1, 2, 3] as Difficulty[]).flatMap(d => Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d)))); };

describe('y2-fractions why (#2317)', () => {
  it('every question has a short why that matches its own answer', () => {
    const kinds = new Set<string>();
    for (const q of draw()) {
      const w = q.why!;
      expect(w, q.prompt).toBeTruthy();
      expect(w.split(/\s+/).length, w).toBeLessThanOrEqual(8);
      let m: RegExpExecArray | null;
      if ((m = /^(\d+) of (\d+) equal parts shaded\.$/.exec(w))) {
        expect(q.answer).toBe(`${m[1]}/${m[2]}`);
        expect(q.visual).toMatchObject({ parts: +m[2], shaded: +m[1] }); kinds.add('shaded');
      } else {
        m = /^(\d+) ÷ (\d+) = (\d+)(?:, × (\d+))?$/.exec(w);
        expect(m, w).toBeTruthy();
        const [whole, den, unit, num] = [+m![1], +m![2], +m![3], m![4] ? +m![4] : 1];
        expect(whole / den).toBe(unit);
        expect(unit * num).toBe(+q.answer);
        expect(q.prompt).toBe(`${num}/${den} of ${whole} = ?`); kinds.add(num > 1 ? 'multi' : 'unit');
      }
    }
    expect([...kinds].sort()).toEqual(['multi', 'shaded', 'unit']);
  });
});
