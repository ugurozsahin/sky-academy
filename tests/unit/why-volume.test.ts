// #2317 (y5-volume, y6-volume): each why states a true fact about its own question.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';
import { CAPACITY, capLabel } from '../../src/curriculum/year5-volume';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draws = (id: string, d: Difficulty) => Array.from({ length: 200 }, (_, s) => TOPICS.find(t => t.id === id)!.gen(d, rngOf((s + 1) * 104729 + d)));
const num = (s: string) => Number(s.replace(/,/g, ''));

describe('volume whys (#2317)', () => {
  it('every card has a short why', () => {
    for (const id of ['y5-volume', 'y6-volume']) for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws(id, d)) {
      expect(q.why, q.prompt).toBeTruthy();
      expect(q.why!.split(/\s+/).length, q.why).toBeLessThanOrEqual(14);
    }
  });
  it('a y5 layer why multiplies the layers into the answer', () => {
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws('y5-volume', d)) {
      if (q.prompt.startsWith('About how much')) {
        const [thing, ml] = CAPACITY.find(([t]) => q.why!.toLowerCase().startsWith(t))!;
        expect(q.why).toBe(`${thing[0].toUpperCase()}${thing.slice(1)} holds about ${capLabel(ml)}`);
        expect(q.answer).toBe(capLabel(ml));
        continue;
      }
      const one = /^(\d+) cubes in the layer = (\d+) cm³$/.exec(q.why!), many = /^(\d+) cubes × (\d+) layers = (\d+) cm³$/.exec(q.why!);
      const m = one ?? many;
      expect(m, q.why).not.toBeNull();
      const layers = many ? Number(many[2]) : 1;
      expect(Number(m![1]) * layers).toBe(Number(m![m!.length - 1]));
      expect(String(q.answer)).toBe(m![m!.length - 1]);
      expect(q.prompt.startsWith(many ? `${layers} layers` : 'One layer')).toBe(true);
    }
  });
  it('a y6 why agrees with its prompt and its answer', () => {
    let vol = 0, height = 0, cmp = 0;
    for (const d of [1, 2, 3] as Difficulty[]) for (const q of draws('y6-volume', d)) {
      let m: RegExpExecArray | null;
      if ((m = /^(\d+) × (\d+) × (\d+) = ([\d,]+) (cm|m|mm|km)³$/.exec(q.why!))) {
        vol++;
        expect(Number(m[1]) * Number(m[2]) * Number(m[3])).toBe(num(m[4]));
        expect(q.answer).toBe(`${m[4]} ${m[5]}³`);
      } else if ((m = /^([\d,]+) ÷ (\d+) ÷ (\d+) = (\d+) cm$/.exec(q.why!))) {
        height++;
        expect(num(m[1]) / Number(m[2]) / Number(m[3])).toBe(Number(m[4]));
        expect(q.prompt).toBe(`Volume ${m[1]} cm³, base ${m[2]} cm × ${m[3]} cm. Height?`);
        expect(q.answer).toBe(`${m[4]} cm`);
      } else {
        m = /^A is ([\d,]+) cm³ and B is ([\d,]+) cm³$/.exec(q.why!);
        expect(m, q.why).not.toBeNull();
        cmp++;
        expect(q.answer).toBe(num(m![1]) > num(m![2]) ? 'A' : 'B');
      }
    }
    expect(vol).toBeGreaterThan(0); expect(height).toBeGreaterThan(0); expect(cmp).toBeGreaterThan(0);
  });
});
