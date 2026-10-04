import { describe, it, expect, vi, afterEach } from 'vitest';
import { Session } from '../../src/game/session';
import { MODES } from '../../src/game/modes';
import { YEARS, topicById } from '../../src/curriculum';

// #1063: the per-question clock. No shipped mode sets `questionMs`, so these borrow the mission entry and put it back.
const Y1 = YEARS[1];
const events = (): any => ({ onQuestion: vi.fn(), onCorrect: vi.fn(), onWrong: vi.fn(), onMiss: vi.fn(), onProgress: vi.fn(), onLives: vi.fn(), onStageClear: vi.fn(), onTime: vi.fn(), onBoss: vi.fn(), onEnd: vi.fn() });
const make = (timeScale?: number, ms: number | null = 6000) => {
  if (ms === null) delete MODES.mission.questionMs; else MODES.mission.questionMs = ms;
  const ev = events();
  const s = new Session({ mode: 'mission', year: Y1, topic: topicById('y1-add')!, rng: () => 0.3, timeScale }, ev);
  s.start(); s.armQuestionClock();
  return { s, ev };
};
afterEach(() => { delete MODES.mission.questionMs; });

describe('per-question clock (#1063)', () => {
  it('keeps the question live at 5,999 ms and misses it one ms later', () => {
    const { s, ev } = make();
    expect(s.questionLeft).toBe(6000);
    s.tick(5999);
    expect(ev.onMiss).not.toHaveBeenCalled(); expect(s.waiting).toBe(false); expect(s.questionLeft).toBe(1);
    s.tick(1);
    expect(ev.onMiss).toHaveBeenCalledTimes(1); expect(s.attempts).toBe(1); expect(s.correct).toBe(0); expect(ev.onCorrect).not.toHaveBeenCalled();
    expect(s.waiting).toBe(true); expect(s.questionLeft).toBe(0); expect(s.lives).toBe(Y1.lives - 1);
  });
  it('ignores a zero or negative tick, and a tick while the card is decided', () => {
    const { s, ev } = make();
    s.tick(0); s.tick(-5);
    expect(s.questionLeft).toBe(6000);
    s.tick(1000); s.hit(s.current!.answer);
    const took = s.lastAnswerMs; s.tick(10000);
    expect(s.questionLeft).toBe(0); expect(s.lastAnswerMs).toBe(took); expect(ev.onMiss).not.toHaveBeenCalled();
  });
  it('a slice before expiry decides the card, disarms the clock and records the time taken', () => {
    const { s, ev } = make();
    s.tick(2500);
    expect(s.hit(s.current!.answer)).toBe('correct');
    expect(s.lastAnswerMs).toBe(2500); expect(s.questionLeft).toBe(0);
    s.tick(10000);
    expect(ev.onMiss).not.toHaveBeenCalled(); expect(s.attempts).toBe(1);
  });
  it('timeScale 1.5 expires at 9,000 ms; Infinity never expires', () => {
    const a = make(1.5);
    a.s.tick(8999); expect(a.ev.onMiss).not.toHaveBeenCalled();
    a.s.tick(1); expect(a.ev.onMiss).toHaveBeenCalledTimes(1);
    const b = make(Infinity);
    b.s.tick(10 ** 9); expect(b.ev.onMiss).not.toHaveBeenCalled(); expect(b.s.waiting).toBe(false);
  });
  it('an expired card is in the result misses with picked null, and lastAnswerMs is the full budget', () => {
    const { s, ev } = make();
    s.tick(6000);
    expect(s.lastAnswerMs).toBe(6000);
    s.end(false);
    const r = ev.onEnd.mock.calls[0][0];
    expect(r.misses).toHaveLength(1); expect(r.misses[0].picked).toBeNull(); expect(r.misses[0].topic).toBe('y1-add');
  });
  it('a falling target does not decide the card in a questionMs mode, and still does in mission', () => {
    const { s, ev } = make();
    s.fall(s.current!.answer);
    expect(ev.onMiss).not.toHaveBeenCalled(); expect(s.waiting).toBe(false);
    delete MODES.mission.questionMs;
    const plain = events();
    const p = new Session({ mode: 'mission', year: Y1, topic: topicById('y1-add')!, rng: () => 0.3 }, plain);
    p.start(); p.fall(p.current!.answer);
    expect(plain.onMiss).toHaveBeenCalledTimes(1);
  });
  it('a mode without questionMs has no clock', () => {
    const { s } = make(undefined, null);
    expect(s.questionLeft).toBe(0); s.tick(60000); expect(s.waiting).toBe(false);
  });
  it('the next question starts with the clock disarmed until the UI arms it', () => {
    const { s } = make();
    s.hit(s.current!.answer); s.advance();
    expect(s.questionLeft).toBe(0);
    s.armQuestionClock(ms => ms / 2); expect(s.questionLeft).toBe(3000);
  });
  it('a question replaced while armed disarms the clock: no stale miss on the next card', () => {
    const { s, ev } = make();
    s.tick(2000); s.advance();
    expect(s.questionLeft).toBe(0);
    s.tick(10000);
    expect(ev.onMiss).not.toHaveBeenCalled(); expect(s.attempts).toBe(0);
  });
  it('a deck question replaced while armed disarms the clock too', () => {
    MODES.mission.questionMs = 6000;
    const t = topicById('y1-add')!; const q = t.gen(1, () => 0.3);
    const ev = events();
    const s = new Session({ mode: 'mission', year: Y1, deck: [{ topic: t, q }, { topic: t, q: t.gen(1, () => 0.6) }] }, ev);
    s.start(); s.armQuestionClock(); s.tick(2000); s.advance();
    expect(s.questionLeft).toBe(0); s.tick(10000);
    expect(ev.onMiss).not.toHaveBeenCalled();
  });
});
