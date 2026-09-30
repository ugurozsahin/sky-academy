import { describe, it, expect } from 'vitest';
import { TOPICS } from '../../src/curriculum';
import type { Difficulty } from '../../src/curriculum';

// Deterministic RNG (mulberry32), same construction curriculum.test.ts uses.
function rng(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/**
 * The "Slice Them All" form (#926): the first topic to draw an any-order card (#918/#919). Its own file,
 * not curriculum.test.ts's existing `y2-oddeven` describe block, because that file is frozen at its length
 * (`.claude/rules/guardrails.md`) — new tests go in a new file, never grow the frozen one.
 */
describe('y2-oddeven "Slice Them All" form (#926): 2–4 targets of the asked parity, decoys the other parity, ~1/3 share', () => {
  it('draws the any-order form about 1 card in 3 at d2–d3, with a correct oracle and decoy parity', () => {
    const t = TOPICS.find(x => x.id === 'y2-oddeven')!;
    for (const d of [2, 3] as Difficulty[]) {
      const r = rng(9260 + d);
      const DRAWS = 900;
      let anyOrder = 0;
      for (let i = 0; i < DRAWS; i++) {
        const q = t.gen(d, r);
        if (!q.anyOrder) continue;
        anyOrder++;
        expect(q.prompt, q.prompt).toMatch(/^Slice every (even|odd) number$/);
        const wantEven = q.prompt.includes('even');
        const targets = q.sequence!.map(Number);
        const decoys = q.options.filter(o => !q.sequence!.includes(o)).map(Number);
        expect(targets.length, q.prompt).toBeGreaterThanOrEqual(2);
        expect(targets.length, q.prompt).toBeLessThanOrEqual(4);
        expect(q.options.length, q.prompt).toBe(6);
        for (const n of targets) expect(n % 2 === 0, `${q.prompt}: target ${n}`).toBe(wantEven);
        for (const n of decoys) expect(n % 2 === 0, `${q.prompt}: decoy ${n}`).toBe(!wantEven);
        for (const n of [...targets, ...decoys]) {
          expect(n, q.prompt).toBeGreaterThanOrEqual(1);
          expect(n, q.prompt).toBeLessThanOrEqual(100);
        }
      }
      // A bigger sample than curriculum.test.ts's own mixed-form check, so this share estimate is tight
      // enough that ±5% (the issue's own acceptance criterion) is a real bound, not sampling noise: at
      // p=1/3 and 900 draws the standard error is ~1.6%, so ±5% is over 3 SE either side.
      const share = anyOrder / DRAWS;
      expect(share, `d${d}: any-order share ${share} drifted from 1/3`).toBeGreaterThan(1 / 3 - 0.05);
      expect(share, `d${d}: any-order share ${share} drifted from 1/3`).toBeLessThan(1 / 3 + 0.05);
    }
  });
});
