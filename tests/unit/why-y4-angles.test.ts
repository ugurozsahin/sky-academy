// #2317 (y4-angles): the why is the angle against 90°, the lettered angle's size, or the sizes in order.
import { describe, expect, it } from 'vitest';
import { TOPICS, type Difficulty } from '../../src/curriculum';

const rngOf = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const draw = (d: Difficulty) => { const t = TOPICS.find(x => x.id === 'y4-angles')!; return Array.from({ length: 200 }, (_, s) => t.gen(d, rngOf((s + 1) * 104729 + d))); };
const angles = (q: ReturnType<typeof draw>[number]) => (q.visual as { parts: { deg: number; label?: string }[] }).parts;

describe('y4-angles why (#2317)', () => {
  it('d1 compares the drawn angle with 90° and names the class', () => {
    for (const q of draw(1)) {
      const deg = angles(q)[0].deg, w = q.why!;
      expect(w.split(/\s+/).length).toBeLessThanOrEqual(14);
      expect(w).toBe(deg === 90 ? '90° is a right angle.' : `${deg}° is ${deg < 90 ? 'less' : 'more'} than 90°, so ${q.answer.toLowerCase()}.`);
    }
  });
  it('d2 quotes the answer letter\'s own size', () => {
    for (const q of draw(2)) {
      const deg = angles(q).find(p => p.label === q.answer)!.deg, w = q.why!;
      expect(w.startsWith(`${q.answer} is ${deg}°`), w).toBe(true);
      if (/largest/.test(q.prompt)) expect(w).toMatch(/the largest\.$/);
      else expect(w).toMatch(deg > 90 ? /more than 90°\.$/ : /less than 90°\.$/);
    }
  });
  it('d3 lists the sizes in the answer order, ascending', () => {
    for (const q of draw(3)) {
      const got = [...q.why!.matchAll(/([ABC]) (\d+)°/g)];
      expect(got.map(m => m[1]).join(',')).toBe(q.answer);
      const ds = got.map(m => +m[2]);
      expect(ds).toEqual(ds.slice().sort((a, b) => a - b));
      expect(q.why!.split(/\s+/).length).toBeLessThanOrEqual(14);
    }
  });
});
