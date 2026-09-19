import { describe, it, expect, vi } from 'vitest';
import { Duel, DUEL_ROUNDS } from '../../src/game/duel';
import { topicById } from '../../src/curriculum';

function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const events = (): any => ({ onQuestion: vi.fn(), onRoundWon: vi.fn(), onRoundMiss: vi.fn(), onRoundDraw: vi.fn(), onMatchEnd: vi.fn() });
const topic = topicById('y1-add')!;

describe('Duel (#16 item 1: pure scorer, no UI)', () => {
  it('starting fires the first question for round 1 of the default 10', () => {
    const ev = events();
    const d = new Duel({ topic, difficulty: 1, rng: rng(1) }, ev);
    d.start();
    expect(d.rounds).toBe(DUEL_ROUNDS);
    expect(d.round).toBe(1);
    expect(ev.onQuestion).toHaveBeenCalledTimes(1);
    expect(ev.onQuestion.mock.calls[0][1]).toEqual({ round: 1, total: DUEL_ROUNDS });
  });

  it('the first correct slice wins the round, whichever player it is — but the round only advances on waveEnd', () => {
    const ev = events();
    const d = new Duel({ topic, difficulty: 1, rng: rng(2) }, ev);
    d.start();
    const answer = d.current!.answer;
    expect(d.hit('b', answer)).toBe('won');
    expect(d.scoreB).toBe(1); expect(d.scoreA).toBe(0);
    expect(ev.onRoundWon).toHaveBeenCalledWith('b', expect.objectContaining({ answer }));
    // mirrors session.ts: deciding a round is not the same as the wave finishing — other bubbles from the
    // same wave (the other player's included) can still be flying, so the round has not moved on yet.
    expect(d.round).toBe(1);
    d.waveEnd();
    expect(d.round).toBe(2);
    expect(ev.onRoundDraw).not.toHaveBeenCalled(); // the round was already decided; waveEnd must not also draw it
  });

  it('a wrong slice does not decide the round; the other player can still win it', () => {
    const ev = events();
    const d = new Duel({ topic, difficulty: 1, rng: rng(3) }, ev);
    d.start();
    const q = d.current!;
    const wrong = q.options.find(o => o !== q.answer)!;
    expect(d.hit('a', wrong)).toBe('wrong');
    expect(ev.onRoundMiss).toHaveBeenCalledWith('a', expect.objectContaining({ answer: q.answer }), wrong);
    expect(d.hit('b', q.answer)).toBe('won');
    expect(d.scoreB).toBe(1); expect(d.scoreA).toBe(0);
  });

  it('once a round is decided, further hits from either player are ignored until the next round', () => {
    const ev = events();
    const d = new Duel({ topic, difficulty: 1, rng: rng(4) }, ev);
    d.start();
    const answer = d.current!.answer;
    expect(d.hit('a', answer)).toBe('won');
    expect(d.hit('a', answer)).toBe('ignored');
    expect(d.hit('b', answer)).toBe('ignored');
    expect(d.scoreA).toBe(1); expect(d.scoreB).toBe(0);
    d.waveEnd(); // advance to round 2 — a fresh round accepts hits again
    expect(d.hit('b', d.current!.answer)).toBe('won');
    expect(d.scoreB).toBe(1);
  });

  it('a wave that ends with nobody correct is a draw: no score, round advances', () => {
    const ev = events();
    const d = new Duel({ topic, difficulty: 1, rng: rng(5) }, ev);
    d.start();
    const q = d.current!;
    d.waveEnd();
    expect(ev.onRoundDraw).toHaveBeenCalledWith(q);
    expect(d.scoreA).toBe(0); expect(d.scoreB).toBe(0);
    expect(d.round).toBe(2);
  });

  it('after the last round the higher score wins the match', () => {
    const ev = events();
    const d = new Duel({ topic, difficulty: 1, rounds: 3, rng: rng(7) }, ev);
    d.start();
    d.hit('a', d.current!.answer); d.waveEnd();  // round 1: a
    d.hit('a', d.current!.answer); d.waveEnd();  // round 2: a
    d.hit('b', d.current!.answer); d.waveEnd();  // round 3: b
    expect(d.ended).toBe(true);
    expect(ev.onMatchEnd).toHaveBeenCalledTimes(1);
    expect(ev.onMatchEnd.mock.calls[0][0]).toEqual({ winner: 'a', scoreA: 2, scoreB: 1, rounds: 3 });
  });

  it('a tied score at the end of the match is a draw', () => {
    const ev = events();
    const d = new Duel({ topic, difficulty: 1, rounds: 2, rng: rng(8) }, ev);
    d.start();
    d.hit('a', d.current!.answer); d.waveEnd();
    d.hit('b', d.current!.answer); d.waveEnd();
    expect(ev.onMatchEnd.mock.calls[0][0]).toEqual({ winner: 'draw', scoreA: 1, scoreB: 1, rounds: 2 });
  });

  it('nothing fires once the match has ended', () => {
    const ev = events();
    const d = new Duel({ topic, difficulty: 1, rounds: 1, rng: rng(9) }, ev);
    d.start();
    d.hit('a', d.current!.answer);
    d.waveEnd();
    expect(d.ended).toBe(true);
    const callsBefore = ev.onQuestion.mock.calls.length;
    expect(d.hit('b', 'anything')).toBe('ignored');
    d.waveEnd();
    expect(ev.onQuestion.mock.calls.length).toBe(callsBefore);
    expect(ev.onRoundDraw).not.toHaveBeenCalled();
    expect(ev.onMatchEnd).toHaveBeenCalledTimes(1);
  });
});

// #16 items 2–4: the pure helpers the duel screen leans on — which topics a duel may use, and the match line.
import { duelHeadline, duelPool } from '../../src/game/duel';
import { topicsFor, YEARS } from '../../src/curriculum';

describe('duelPool (#16 item 4: which topics a duel is played on)', () => {
  it('drops tracing topics and sequence topics, keeps plain bubble topics, for every year', () => {
    for (const y of YEARS) {
      const all = topicsFor(y.id); const pool = duelPool(all, y.diffs[0] ?? 1);
      expect(pool.length).toBeGreaterThan(0);
      for (const t of pool) {
        expect(t.input).not.toBe('tracing');
        for (let i = 0; i < 5; i++) expect(t.gen(y.diffs[0] ?? 1, rng(i)).sequence, `${t.id} produced a sequence question`).toBeUndefined();
      }
      if (y.id === 'reception') expect(pool.map(t => t.id)).not.toContain('r-build');   // Build a Word slices letters in order
    }
  });
});

describe('duelHeadline (#16 item 3: the match-end line)', () => {
  it('names the winner with the score, or a draw', () => {
    expect(duelHeadline({ winner: 'a', scoreA: 6, scoreB: 3, rounds: 10 })).toBe('Player 1 wins 6–3!');
    expect(duelHeadline({ winner: 'b', scoreA: 2, scoreB: 7, rounds: 10 })).toBe('Player 2 wins 7–2!');
    expect(duelHeadline({ winner: 'draw', scoreA: 4, scoreB: 4, rounds: 10 })).toBe("It's a draw — 4 all!");
  });
});
