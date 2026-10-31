import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const topic = (id: string) => TOPICS.find(x => x.id === id)!;
const N = 200;

describe('#2320 y1-compare groups are close enough to need counting', () => {
  it('two groups are never more than 3 apart at d1, 2 apart at d2-d3', () => {
    const t = topic('y1-compare');
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(23200 + d);
      let groups = 0;
      for (let i = 0; i < N; i++) {
        const q = t.gen(d, r);
        const v = q.visual;
        if (!v || v.type !== 'objects' || v.n2 === undefined) continue;
        groups++;
        expect(Math.abs(v.n - v.n2), `${q.prompt} ${v.n} v ${v.n2}`).toBeLessThanOrEqual(d === 1 ? 3 : 2);
      }
      expect(groups).toBeGreaterThan(50);
    }
  });
});

describe('#2320 y2-patterns decoys are the pattern\'s own objects first', () => {
  it('every other object in the pattern is a decoy, at every stage', () => {
    const t = topic('y2-patterns');
    for (const d of [1, 2, 3] as Difficulty[]) {
      const r = rng(23201 + d);
      for (let i = 0; i < N; i++) {
        const q = t.gen(d, r);
        const seq = (q.visual as { text: string }).text.split(' ');
        const used = new Set(seq.filter(x => x !== '_'));
        for (const o of used) if (o !== q.answer) expect(q.options, q.prompt).toContain(o);
      }
    }
  });
  it('d1 sometimes shows a three-object unit, so there is more than one real slip', () => {
    const t = topic('y2-patterns');
    const r = rng(23205);
    const kinds = new Set<number>();
    for (let i = 0; i < N; i++) kinds.add(new Set((t.gen(1, r).visual as { text: string }).text.split(' ').filter(x => x !== '_')).size);
    expect(kinds.has(2) && kinds.has(3)).toBe(true);
  });
});
