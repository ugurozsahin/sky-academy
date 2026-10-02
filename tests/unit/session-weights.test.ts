import { describe, it, expect, vi } from 'vitest';
import { Session } from '../../src/game/session';
import { YEARS, topicsFor } from '../../src/curriculum';
import { seededRng } from '../../src/game/rng';

const events = (): any => ({ onQuestion: vi.fn(), onCorrect: vi.fn(), onWrong: vi.fn(), onMiss: vi.fn(), onProgress: vi.fn(), onLives: vi.fn(), onStageClear: vi.fn(), onTime: vi.fn(), onBoss: vi.fn(), onEnd: vi.fn() });

// #909: the weights a Session is given reach its topic draw (the pure maths is in sensei.test.ts).
describe('weighted topic draw (#909)', () => {
  const pool = topicsFor('year1').filter(t => t.input !== 'tracing').slice(0, 3);
  const drawn = (weights?: number[], n = 300) => {
    const s = new Session({ mode: 'endless', year: YEARS[1], pool, weights, rng: seededRng(5) }, events());
    s.start();
    const seen = new Map<string, number>();
    for (let i = 0; i < n; i++) { seen.set(s.currentTopic!.id, (seen.get(s.currentTopic!.id) ?? 0) + 1); s.hit(s.current!.answer); s.advance(); }
    return seen;
  };

  it('draws topics in proportion to the weights it is given', () => {
    const seen = drawn([0, 1, 3]);
    expect(seen.has(pool[0].id)).toBe(false);
    const ratio = seen.get(pool[2].id)! / seen.get(pool[1].id)!;
    expect(ratio).toBeGreaterThan(2); expect(ratio).toBeLessThan(4.5);
  });

  it('stays uniform without weights', () => {
    const seen = drawn();
    for (const t of pool) expect(seen.get(t.id) ?? 0).toBeGreaterThan(60);
  });
});
