// #1325: `Session.pickTopic()` used to return `undefined` on an empty pool — `pool[0]` of `[]` — so `topic.gen` threw
// a TypeError inside `nextQuestion()`'s `try`, and the `catch` then threw a *second*, uncaught TypeError reading
// `topic.id` for its own log line: the run died with no error written and `start()` itself blew up in the caller.
// Now the draw happens inside the `try`, an empty (or missing) pool throws a plain Error from `pickTopic()` (its
// `weightedPick`, `sensei.ts`, whose own `pool[0]` had the same hole), and the run ends once, as incomplete, exactly as
// a generator that throws does (#444/#522). Unreachable with today's
// registry (`curriculum.test.ts` pins every shown year's subject pools non-empty; `pools.test.ts` pins the degrade),
// so this file is the only place the path is driven. Its own file because `session.test.ts` is frozen (#1388).
import { describe, it, expect, vi } from 'vitest';
import { Session, type SessionOpts } from '../../src/game/session';
import { YEARS, topicById } from '../../src/curriculum';

const events = (): any => ({ onQuestion: vi.fn(), onCorrect: vi.fn(), onWrong: vi.fn(), onMiss: vi.fn(), onProgress: vi.fn(), onLives: vi.fn(), onStageClear: vi.fn(), onTime: vi.fn(), onBoss: vi.fn(), onEnd: vi.fn() });
const Y1 = YEARS[1];
/** Every mode that draws its topics from `pool` — the `playMixed`/`chooseThenPlay` modes and Sensei training's mission. */
const POOL_MODES: SessionOpts['mode'][] = ['endless', 'sprint', 'boss', 'relaxed', 'mission'];

/** Start `s` with `console.error` captured; returns the captured calls. */
const startQuietly = (s: Session): unknown[][] => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
  try { expect(() => s.start()).not.toThrow(); return spy.mock.calls; } finally { spy.mockRestore(); }
};

describe('Session.pickTopic() on an empty pool (#1325)', () => {
  it.each(POOL_MODES)('%s: ends once as incomplete, with one logged Error and no second exception', (mode) => {
    const ev = events();
    const s = new Session({ mode, year: Y1, pool: [], rng: () => 0.5 }, ev);
    const logged = startQuietly(s);
    expect(s.ended).toBe(true);
    expect(s.current).toBeNull(); expect(s.currentTopic).toBeNull();   // nothing was drawn, so nothing is "current"
    expect(ev.onQuestion).not.toHaveBeenCalled();
    expect(logged).toHaveLength(1);
    expect(logged[0][0]).toMatch(/no topic/); expect(String(logged[0][0])).toContain(`${mode} run for year1`); expect(String(logged[0][0])).toContain('(empty pool)');
    expect(logged[0][1]).toBeInstanceOf(Error);
    expect((logged[0][1] as Error).message).toContain('empty pool');   // a deliberate throw, not a TypeError from dereferencing undefined
    expect(ev.onEnd).toHaveBeenCalledTimes(1);
    expect(ev.onEnd.mock.calls[0][0]).toMatchObject({ won: false, incomplete: true, questions: 0, correct: 0, attempts: 0 });
  });

  it('a pool mode given no pool at all fails the same way, not with a TypeError outside the try', () => {
    const ev = events();
    const s = new Session({ mode: 'endless', year: Y1, rng: () => 0.5 }, ev);   // neither `topic` nor `pool`
    const logged = startQuietly(s);
    expect(s.ended).toBe(true);
    expect(logged).toHaveLength(1); expect((logged[0][1] as Error).message).toContain('empty pool');
    expect(String(logged[0][0])).toContain('(no pool given)');   // the log tells a missing pool from an empty one
    expect(ev.onEnd.mock.calls[0][0]).toMatchObject({ won: false, incomplete: true, questions: 0 });
  });

  it('a generator that throws still names its topic in the one logged line (#444 unchanged)', () => {
    const ev = events();
    const bad = { ...topicById('y1-add')!, gen: () => { throw new Error('boom'); } };
    const s = new Session({ mode: 'endless', year: Y1, pool: [bad], rng: () => 0.5 }, ev);
    const logged = startQuietly(s);
    expect(s.ended).toBe(true); expect(s.currentTopic).toBe(bad);   // the draw succeeded; the generator did not
    expect(logged).toHaveLength(1); expect(logged[0][0]).toContain('"y1-add" question generator threw');
    expect(ev.onEnd.mock.calls[0][0]).toMatchObject({ won: false, incomplete: true });
  });

  it('a single-topic run never consults the pool, and a one-topic pool draws that topic', () => {
    const topic = topicById('y1-add')!;
    const single = new Session({ mode: 'mission', year: Y1, topic, pool: [], rng: () => 0.5 }, events());
    single.start(); expect(single.ended).toBe(false); expect(single.currentTopic).toBe(topic);
    const one = new Session({ mode: 'endless', year: Y1, pool: [topic], rng: () => 0.999 }, events());
    one.start(); expect(one.ended).toBe(false); expect(one.currentTopic).toBe(topic); expect(one.current).not.toBeNull();
  });

  it('a question that was asked before the pool emptied is still paid for: the run ends on the normal path', () => {
    // A pool cannot shrink mid-run today (`SessionOpts.pool` is read, never written), so this drives the array itself —
    // the point is that `end(false, true)` is reached through `catch`, with the earlier correct answer kept.
    const ev = events(); const pool = [topicById('y1-add')!];
    const s = new Session({ mode: 'endless', year: Y1, pool, rng: () => 0.5 }, ev);
    s.start(); expect(s.hit(s.current!.answer)).toBe('correct');
    pool.length = 0;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => s.advance()).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1); expect(spy.mock.calls[0][0]).toMatch(/no topic/);   // not "y1-add threw": `topic` is per call, never a stale field
    spy.mockRestore();
    expect(s.ended).toBe(true);
    expect(ev.onEnd.mock.calls[0][0]).toMatchObject({ won: false, incomplete: true, correct: 1, attempts: 1, questions: 1 });
  });
});
