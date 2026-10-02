import { describe, it, expect, vi } from 'vitest';
import { Session } from '../../src/game/session';
import { YEARS, topicById } from '../../src/curriculum';

function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const events = (): any => ({ onQuestion: vi.fn(), onCorrect: vi.fn(), onWrong: vi.fn(), onMiss: vi.fn(), onProgress: vi.fn(), onLives: vi.fn(), onStageClear: vi.fn(), onTime: vi.fn(), onBoss: vi.fn(), onEnd: vi.fn() });
const Y1 = YEARS[1];
const solve = (s: Session) => { const c = s.current!; for (const l of c.sequence ?? [c.answer]) s.hit(l); };

/**
 * #931: "Retry stage N" restarts a lost mission at its stage with the stars it had, full lives, and no second
 * payment for those stars.
 */
describe('resume a lost mission (#931)', () => {
  const run = (resume: { stage: number; stageStars: number[] } | undefined, seed = 3) => {
    const ev = events();
    const s = new Session({ mode: 'mission', year: Y1, topic: topicById('y1-add')!, rng: rng(seed), resume }, ev);
    s.start();
    return { s, ev };
  };
  const playOut = (s: Session) => { while (!s.ended) { for (let i = 0; i < Y1.perStage; i++) { solve(s); s.advance(); } s.nextStage(); } };

  it('starts at the resumed stage with full lives and the carried stars, and its questions use that stage', () => {
    const { s, ev } = run({ stage: 4, stageStars: [3, 2, 3] });
    expect(s.stage).toBe(4); expect(s.index).toBe(0); expect(s.lives).toBe(Y1.lives);
    expect(s.stageStars).toEqual([3, 2, 3]);
    expect(ev.onQuestion.mock.calls[0][1].stage).toBe(4);
    expect(s.difficulty).toBe(Y1.diffs[3]);
  });

  it('a win of stages 4–5 at 3★ rates all five stages: round(14 / 5) = 3', () => {
    const { s, ev } = run({ stage: 4, stageStars: [3, 2, 3] });
    playOut(s);
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.won).toBe(true); expect(r.stageStars).toEqual([3, 2, 3, 3, 3]); expect(r.stars).toBe(3);
  });

  it('coins exclude the carried stars: only the new stages\' stars, the correct answers and the win bonus', () => {
    const { s, ev } = run({ stage: 4, stageStars: [3, 2, 3] });
    playOut(s);
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.correct).toBe(2 * Y1.perStage);
    expect(r.coins).toBe(2 * Y1.perStage + (3 + 3) * 5 + 20);   // not + 8 × 5 for the carried 8 stars
  });

  it('a retry that is lost again reports the stage it was lost in', () => {
    const { s, ev } = run({ stage: 3, stageStars: [3, 3] });
    while (!s.ended) { s.hit('definitely not an answer'); s.advance(); }
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.won).toBe(false); expect(r.stage).toBe(3); expect(r.stageStars).toEqual([3, 3]);
  });

  it('without `resume` a session still starts at stage 1 with no carried stars', () => {
    const { s } = run(undefined);
    expect(s.stage).toBe(1); expect(s.stageStars).toEqual([]);
  });

  it('the opts\' carried array is copied, never mutated by the session', () => {
    const carried = [3, 3];
    const { s } = run({ stage: 3, stageStars: carried });
    playOut(s);
    expect(carried).toEqual([3, 3]);
  });

  it('a second retry carries the first retry\'s stars and still pays only the new stages', () => {
    const first = run({ stage: 3, stageStars: [3, 3] });
    for (let i = 0; i < Y1.perStage; i++) { solve(first.s); first.s.advance(); }   // clear stage 3
    first.s.nextStage();
    while (!first.s.ended) { first.s.hit('nope'); first.s.advance(); }             // lose in stage 4
    const lost = first.ev.onEnd.mock.calls[0][0];
    expect(lost.stage).toBe(4); expect(lost.stageStars).toEqual([3, 3, 3]);
    const again = run({ stage: lost.stage, stageStars: lost.stageStars.slice(0, lost.stage - 1) });
    playOut(again.s);
    const r = again.ev.onEnd.mock.calls[0][0];
    expect(r.stageStars).toEqual([3, 3, 3, 3, 3]);
    expect(r.coins).toBe(2 * Y1.perStage + 2 * 3 * 5 + 20);
  });
});
