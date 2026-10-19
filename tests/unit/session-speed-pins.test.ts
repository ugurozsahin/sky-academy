import { describe, it, expect, vi } from 'vitest';
import { Session } from '../../src/game/session';
import { YEARS, topicsFor } from '../../src/curriculum';

/**
 * #336: the seam between `Session` and the mode table. `modes.test.ts` pins the table by value through a
 * hand-built `ModeCtx`, so it never crosses `Session.ctx` — replace `enraged: this.enraged` with `enraged: false`
 * there and the boss never speeds up for anyone while every other test stays green. These drive a real boss
 * `Session` and read the speed both as `s.speed` and as the `onQuestion` payload the arena launches with.
 */
const rng = (seed: number) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const events = (): any => ({ onQuestion: vi.fn(), onCorrect: vi.fn(), onWrong: vi.fn(), onMiss: vi.fn(), onProgress: vi.fn(), onLives: vi.fn(), onStageClear: vi.fn(), onTime: vi.fn(), onBoss: vi.fn(), onEnd: vi.fn() });
const Y2 = YEARS.find(y => y.id === 'year2')!;
const launched = (ev: any): number => ev.onQuestion.mock.lastCall[1].speed;

describe('Session carries the mode table\'s speed across the seam (#336)', () => {
  it('a boss on Year 2 flies at step 2, and at step 3 once enraged; a flagged question eases one step in both', () => {
    expect([Y2.speeds[1], Y2.speeds[2]], 'the premise: boss reads step 2 normally and step 3 enraged').toEqual([2, 3]);
    const ev = events();
    const pool = topicsFor('year2').filter(t => t.input !== 'tracing');
    const s = new Session({ mode: 'boss', year: Y2, pool, rng: rng(21), bossHp: 4 }, ev);
    s.start();
    const q = () => s.current!;
    q().sequence = undefined; q().slow = false;
    expect(s.enraged).toBe(false);
    expect(s.speed, 'plain, calm').toBe(2);
    q().slow = true;
    expect(s.speed, 'flagged, calm').toBe(1);
    q().slow = false;
    expect(s.hit(q().answer)).toBe('correct');   // 4 HP -> 3 HP
    expect(s.bossHp).toBe(3);
    expect(s.enraged).toBe(true);
    s.advance();
    q().sequence = undefined; q().slow = false;
    expect(s.speed, 'plain, enraged').toBe(3);
    q().slow = true;
    expect(s.speed, 'flagged, enraged').toBe(2);
  });

  it('respawn() relaunches with the eased speed of the question on screen, not the table\'s plain one', () => {
    const ev = events();
    const pool = topicsFor('year2').filter(t => t.input !== 'tracing');
    const s = new Session({ mode: 'boss', year: Y2, pool, rng: rng(21), bossHp: 4 }, ev);
    s.start();
    s.current!.sequence = undefined; s.current!.slow = false;
    s.respawn();
    expect(launched(ev), 'plain relaunch').toBe(2);
    s.current!.slow = true;
    s.respawn();
    expect(launched(ev), 'flagged relaunch').toBe(1);
  });
});
