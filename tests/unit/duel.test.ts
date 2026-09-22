import { describe, it, expect, vi } from 'vitest';
import { Duel, DUEL_ROUNDS, duelEarnsCertificate, duelStars, seededRng } from '../../src/game/duel';
import { layoutWave } from '../../src/game/arena';
import { topicById } from '../../src/curriculum';
import { hintText, promptHTML, promptMode } from '../../src/ui/hud';
import { esc } from '../../src/ui/dom';
import { duelHistoryHTML } from '../../src/ui/duel';
import type { StoredDuel } from '../../src/storage';

function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const events = (): any => ({ onQuestion: vi.fn(), onRoundWon: vi.fn(), onRoundMiss: vi.fn(), onRoundDraw: vi.fn(), onMatchEnd: vi.fn() });
const topic = topicById('y1-add')!;
/**
 * The tally of a match in which every decided round was won on a clean first slice and nobody sliced anything
 * wrong — the shape a `DuelResult` literal needs, for the helpers below whose subject is not the tally.
 */
const matchTally = (scoreA: number, scoreB: number) => ({ a: { hits: scoreA, tries: scoreA }, b: { hits: scoreB, tries: scoreB } });

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

  it('settleDraw announces a draw WITHOUT advancing, and only once (#425 review)', () => {
    const ev = events();
    const d = new Duel({ topic, difficulty: 1, rng: rng(7) }, ev);
    d.start();
    const q = d.current;
    // The whole point of the split: the verdict goes out while the question it is about is still the current
    // one. Joined to `advance()`, the two ran in one synchronous task, so a screen that clears its toast on a
    // new question added and removed the class before any frame painted — the draw was never shown at all.
    expect(d.settleDraw()).toBe(true);
    expect(ev.onRoundDraw).toHaveBeenCalledTimes(1);
    expect(ev.onRoundDraw.mock.calls[0][0]).toBe(q);        // announced about THIS round's question
    expect(d.round).toBe(1);                                 // and nothing moved on
    expect(d.current).toBe(q);
    expect(ev.onQuestion).toHaveBeenCalledTimes(1);
    expect(d.roundDecided).toBe(true);
    // Settling twice draws the round twice; `waveEnd` calls it again on the way past.
    expect(d.settleDraw()).toBe(false);
    expect(ev.onRoundDraw).toHaveBeenCalledTimes(1);
    d.waveEnd();
    expect(ev.onRoundDraw).toHaveBeenCalledTimes(1);
    expect(d.round).toBe(2);
  });

  it('settleDraw before the first question is a no-op, not a draw about nothing (#425 review, note 4)', () => {
    const ev = events();
    const d = new Duel({ topic, difficulty: 1, rng: rng(7) }, ev);
    // Not reachable in play — `waveEnd()` cannot run before a wave — but `settleDraw()` is newly PUBLIC and
    // reachable through `window.__sna.duel`, and `current` is null until `start()`. Without the guard the
    // non-null assertion inside handed `onRoundDraw` a null question and latched `roundDecided` on a round
    // that had not begun, so the real round 1 could then never be drawn.
    expect(d.current).toBe(null);
    expect(d.settleDraw()).toBe(false);
    expect(ev.onRoundDraw).not.toHaveBeenCalled();
    expect(d.roundDecided).toBe(false);
    // And the match still runs normally afterwards, which is what makes the no-op a no-op.
    d.start();
    expect(d.settleDraw()).toBe(true);
    expect(ev.onRoundDraw).toHaveBeenCalledTimes(1);
    expect(ev.onRoundDraw.mock.calls[0][0]).toBe(d.current);
  });

  it('waveEnd still draws and advances in one call, for every caller that has not split them (#425 review)', () => {
    const ev = events();
    const d = new Duel({ topic, difficulty: 1, rng: rng(8) }, ev);
    d.start();
    d.waveEnd();
    expect(ev.onRoundDraw).toHaveBeenCalledTimes(1);
    expect(d.round).toBe(2);
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

  it('a generator that throws mid-match ends the match instead of freezing it (#444 review, B1)', () => {
    const ev = events();
    let calls = 0;
    // Throws from round 3 on — duelPool()'s own 8-fixed-seed screen would have passed this topic cleanly,
    // since nothing here throws for seeds 1..8; only live play (this test's own rng) reaches the failure.
    const flaky = { ...topic, gen: (d: Parameters<typeof topic.gen>[0], r: Parameters<typeof topic.gen>[1]) => { calls++; if (calls > 2) throw new Error('boom'); return topic.gen(d, r); } };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const duel = new Duel({ topic: flaky, difficulty: 1, rng: rng(1) }, ev);
    duel.start();
    expect(duel.hit('a', duel.current!.answer)).toBe('won');
    duel.waveEnd();   // round 2, still fine
    expect(duel.hit('a', duel.current!.answer)).toBe('won');
    duel.waveEnd();   // round 3's draw is what throws
    expect(duel.ended).toBe(true);
    expect(ev.onMatchEnd).toHaveBeenCalledTimes(1);
    expect(ev.onMatchEnd.mock.calls[0][0]).toMatchObject({ winner: 'a', scoreA: 2, scoreB: 0 });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining(topic.id), expect.any(Error));
    // The match is over — no further round starts, and hits are ignored the same way any ended match's are.
    expect(duel.hit('a', 'anything')).toBe('ignored');
    spy.mockRestore();
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
    expect(ev.onMatchEnd.mock.calls[0][0]).toEqual({
      winner: 'a', scoreA: 2, scoreB: 1, rounds: 3,
      tally: { a: { hits: 2, tries: 2 }, b: { hits: 1, tries: 1 } },
    });
  });

  it('a tied score at the end of the match is a draw', () => {
    const ev = events();
    const d = new Duel({ topic, difficulty: 1, rounds: 2, rng: rng(8) }, ev);
    d.start();
    d.hit('a', d.current!.answer); d.waveEnd();
    d.hit('b', d.current!.answer); d.waveEnd();
    expect(ev.onMatchEnd.mock.calls[0][0]).toEqual({
      winner: 'draw', scoreA: 1, scoreB: 1, rounds: 2,
      tally: { a: { hits: 1, tries: 1 }, b: { hits: 1, tries: 1 } },
    });
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
import { DUEL_HANDOVER, duelCoins, duelHeadline, duelPool, spokenQuestion, type DuelResult } from '../../src/game/duel';
import { topicsFor, YEARS } from '../../src/curriculum';

describe('duelPool (#16 item 4: which topics a duel is played on)', () => {
  it('drops tracing topics and sequence topics, keeps plain bubble topics, for every year and difficulty', () => {
    for (const y of YEARS) for (const diff of [1, 2, 3] as const) {
      const all = topicsFor(y.id); const pool = duelPool(all, diff);
      expect(pool.length, `${y.id} d${diff}`).toBeGreaterThan(0);
      for (const t of pool) {
        expect(t.input).not.toBe('tracing');
        for (let i = 100; i < 140; i++) expect(t.gen(diff, rng(i)).sequence, `${t.id} at d${diff} produced a sequence question`).toBeUndefined();
      }
      if (y.id === 'reception') expect(pool.map(t => t.id)).not.toContain('r-build');   // Build a Word slices letters in order
    }
    // Generators that mix a sequence branch in only at difficulty 3 (PR #295 review) are out at 3 and in below it.
    expect(duelPool(topicsFor('year1'), 3).map(t => t.id)).not.toContain('y1-spelling');
    expect(duelPool(topicsFor('year1'), 1).map(t => t.id)).toContain('y1-spelling');
  });
  it('a topic whose generator throws is dropped, not left to freeze the whole year (#444)', () => {
    const good = topicById('y1-add')!;
    const boom = { ...good, id: 'y1-boom', gen: () => { throw new Error('boom'); } };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => duelPool([good, boom], 1)).not.toThrow();
    const pool = duelPool([good, boom], 1);
    expect(pool.map(t => t.id)).toEqual(['y1-add']);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('y1-boom'), expect.any(Error));
    spy.mockRestore();
  });
});

describe('duelHeadline (#16 item 3: the match-end line)', () => {
  const tally = { a: { hits: 0, tries: 0 }, b: { hits: 0, tries: 0 } };   // the headline reads the score, never the tally
  it('names the winner with the score, or a draw', () => {
    expect(duelHeadline({ winner: 'a', scoreA: 6, scoreB: 3, rounds: 10, tally })).toBe('Player 1 wins 6–3!');
    expect(duelHeadline({ winner: 'b', scoreA: 2, scoreB: 7, rounds: 10, tally })).toBe('Player 2 wins 7–2!');
    expect(duelHeadline({ winner: 'draw', scoreA: 4, scoreB: 4, rounds: 10, tally })).toBe("It's a draw — 4 all!");
  });
});

// #16 item 5: what a finished match pays into the one shared save.
describe('duelCoins (#16 item 5: a match pays the device, not the winner)', () => {
  const res = (scoreA: number, scoreB: number): DuelResult =>
    ({ winner: scoreA > scoreB ? 'a' : scoreB > scoreA ? 'b' : 'draw', scoreA, scoreB, rounds: DUEL_ROUNDS, tally: matchTally(scoreA, scoreB) });

  it('pays one coin per decided round — the same rate baseCoins pays per correct answer', () => {
    expect(duelCoins(res(6, 3))).toBe(9);
    expect(duelCoins(res(3, 6))).toBe(9);
    expect(duelCoins(res(5, 5))).toBe(10);
  });

  it('pays nothing for a drawn round: a match nobody decided pays nothing at all', () => {
    expect(duelCoins(res(0, 0))).toBe(0);
    expect(duelCoins(res(4, 2))).toBe(6);            // four rounds drawn out of ten
  });

  it('does not pay a match-win bonus — the payout depends on the rounds, never on who won', () => {
    // The pair below is the whole property: same rounds decided, opposite winners, and a draw. A bonus for
    // the winner (or for `a`, the save's owner) would separate these three.
    expect(duelCoins(res(7, 3))).toBe(duelCoins(res(3, 7)));
    expect(duelCoins(res(5, 5))).toBe(duelCoins(res(10, 0)));
  });

  it('cannot pay more than one coin per round of the match', () => {
    for (let a = 0; a <= DUEL_ROUNDS; a++) for (let b = 0; a + b <= DUEL_ROUNDS; b++) {
      expect(duelCoins(res(a, b))).toBeLessThanOrEqual(DUEL_ROUNDS);
    }
  });
});

describe('spokenQuestion (#16: the hand-over line is heard)', () => {
  const q = topic.gen(1, rng(3));
  it('round 1 folds the hand-over instruction into the question\'s own utterance', () => {
    expect(spokenQuestion(q, 1)).toBe(`${DUEL_HANDOVER} ${q.say ?? q.prompt}`);
  });
  it('every later round speaks the question alone', () => {
    expect(spokenQuestion(q, 2)).toBe(q.say ?? q.prompt);
    expect(spokenQuestion(q, 10)).toBe(q.say ?? q.prompt);
  });
});

describe('Duel refuses a sequence question (#16: the pool is the filter, this is the floor)', () => {
  it('ends the match instead of draining ten unwinnable rounds (#444 review, B1: the floor is now caught, not a raw throw out of start())', () => {
    const ev = events();
    const seqTopic = { ...topic, id: 'fake-seq', gen: () => ({ ...topic.gen(1, rng(1)), sequence: ['a', 'b'], answer: 'ab' }) };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = new Duel({ topic: seqTopic, difficulty: 1, rng: rng(1) }, ev);
    // #444 review (PR #502) widened this file's own error boundary to cover this throw too, alongside a
    // generator's own: both are "this topic misbehaved for a duel", and duelPool()'s screening is the same
    // 8-fixed-seed sample for either, so a topic reaching this floor live is caught the same way, not left to
    // propagate uncaught out of start().
    expect(() => d.start()).not.toThrow();
    expect(d.ended).toBe(true);
    expect(ev.onMatchEnd).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('fake-seq'), expect.any(Error));
    spy.mockRestore();
  });
});

/**
 * #16 review (the 18:33Z block): the duel card showed `prompt` and `visual` only. Five of the pool's topics —
 * the `measureCompare()` comparisons — put the values being compared in `hint` and nowhere else, so those
 * rounds read "Which is fuller?" over two coloured bubbles with nothing on screen to decide by; and the
 * `listen` topics (Sound Hunt) had no read fallback on a silent device. These pin the two card writers the
 * screen now goes through (`src/ui/duel.ts` `onQuestion`) over the whole pool, not one sampled round.
 */
describe('the duel card carries every question it can draw (#16 review, #65)', () => {
  const DRAWS = 200;
  /** Every question the pool can put on the card, for each year at the difficulty a duel is played at. */
  const drawPool = () => YEARS.flatMap(y => {
    const difficulty = y.diffs[0] ?? 1;
    return duelPool(topicsFor(y.id), difficulty).flatMap(t =>
      Array.from({ length: DRAWS }, (_, i) => ({ topic: t, q: t.gen(difficulty, rng(i + 1)) })));
  });

  it('a question whose deciding data lives in `hint` shows that hint, not a generic instruction', () => {
    const hintOnly = drawPool().filter(({ q }) => q.hint && !q.visual);
    // Not a vacuous pass: the class of question this review is about has to still exist in the pool.
    expect(new Set(hintOnly.map(x => x.topic.id)).size).toBeGreaterThan(0);
    for (const { topic: t, q } of hintOnly) {
      expect(hintText(q, { reveal: false }), `${t.id}: ${q.prompt}`).toBe(q.hint);
      expect(hintText(q, { reveal: true }), `${t.id}: ${q.prompt}`).toBe(q.hint);
    }
  });

  it('every card shows a line under the prompt, so the strip never renders an empty hint', () => {
    for (const { topic: t, q } of drawPool()) {
      expect(hintText(q, { reveal: false }), `${t.id}: ${q.prompt}`).not.toBe('');
    }
  });

  it('a `listen` question shows its words when the device cannot be heard', () => {
    const listens = drawPool().filter(({ q }) => q.listen);
    expect(new Set(listens.map(x => x.topic.id)).size).toBeGreaterThan(0);   // Sound Hunt is in the pool
    for (const { topic: t, q } of listens) {
      expect(promptMode(q, false), `${t.id}`).not.toBe('hear');
      expect(promptHTML(q, 0, true), `${t.id}: ${q.prompt}`).toContain(esc(q.listen!));
      expect(promptMode(q, true), `${t.id}`).toBe('hear');            // with a voice the ordinary prompt is enough
      expect(promptHTML(q, 0, false), `${t.id}`).toBe(esc(q.prompt));
    }
  });
});

// #16 item 5: what a finished match tells the Daily Dojo. The rules the event has to respect live in
// `applyEvent()` (src/game/dojo.ts), so these assert against the real dojo, not against the shape alone.
import { duelCorrect, duelDojoEvent } from '../../src/game/duel';
import { applyEvent, CHALLENGE_BONUS, dailyChallenges, freshDojo, type DojoState } from '../../src/game/dojo';

/** The first date on or after 2026-01-01 whose focus challenge is `id` — the pool's draw is date-seeded. */
function dateDrawing(id: string): string {
  for (let d = 0; d < 400; d++) {
    const dt = new Date(Date.UTC(2026, 0, 1)); dt.setUTCDate(dt.getUTCDate() + d);
    const date = dt.toISOString().slice(0, 10);
    if (dailyChallenges(date).some(c => c.id === id)) return date;
  }
  throw new Error(`no date in 2026 draws ${id}`);
}

describe('duelDojoEvent (#16 item 5: a match tells the dojo the maths the device saw)', () => {
  const res = (scoreA: number, scoreB: number, rounds = DUEL_ROUNDS): DuelResult =>
    ({ winner: scoreA > scoreB ? 'a' : scoreB > scoreA ? 'b' : 'draw', scoreA, scoreB, rounds, tally: matchTally(scoreA, scoreB) });

  it('reports both players\' decided rounds as the questions answered correctly', () => {
    expect(duelDojoEvent(res(6, 3), 'maths').correct).toBe(9);
    expect(duelDojoEvent(res(0, 0), 'maths').correct).toBe(0);
    // One source: the payout and the dojo agree. `duelCoins` is `r => duelCorrect(r)`, so the two-sided
    // comparison alone is a tautology that would hold for `scoreA - scoreB` — the literal is what pins it.
    expect(duelCorrect(res(6, 3))).toBe(9);
    expect(duelCoins(res(6, 3))).toBe(duelCorrect(res(6, 3)));
  });

  it('never reports a combo — the duel screen tracks none, and combo5 is not gated on the mode', () => {
    // `measure()` reads bestCombo through Math.max for every mode, so a non-zero value here would complete a
    // challenge on evidence the duel screen does not collect. This is the rail for that. `combo5` is not the
    // only un-gated challenge (`maths10`/`writing6` are too) — it is the only un-gated one whose field a duel
    // cannot measure, which is what makes zero the honest value rather than a convenient one.
    for (let a = 0; a <= DUEL_ROUNDS; a++) for (let b = 0; a + b <= DUEL_ROUNDS; b++) {
      expect(duelDojoEvent(res(a, b), 'maths').bestCombo, `${a}-${b}`).toBe(0);
    }
  });

  it('claims no win, no stars and no score: the shared save has no winner to credit', () => {
    const e = duelDojoEvent(res(10, 0), 'maths');
    expect(e).toMatchObject({ mode: 'duel', won: false, stars: 0, score: 0, attempts: DUEL_ROUNDS });
  });

  it('splits by the match topic\'s subject, and counts a match only once', () => {
    expect(duelDojoEvent(res(4, 3), 'maths')).toMatchObject({ mathsCorrect: 7, writingCorrect: 0 });
    expect(duelDojoEvent(res(4, 3), 'writing')).toMatchObject({ mathsCorrect: 0, writingCorrect: 7 });
  });

  it('moves the volume challenge through the real dojo, and completes it exactly once across four matches', () => {
    // A day whose focus challenge is neither maths10 nor writing6, so the volume challenge is the only thing
    // a maths duel can complete and the exact figures below are knowable rather than a matter of the draw.
    const date = '2026-09-20';
    const cs = dailyChallenges(date);
    expect(cs.map(c => c.id)).toEqual(['correct15', 'memory1', 'perfect']);
    const volume = cs.find(c => c.group === 'volume')!;
    let s: DojoState = freshDojo(date);
    let paid = 0; let completed = 0;
    for (let i = 0; i < 4; i++) {
      const out = applyEvent(s, duelDojoEvent(res(5, 5), 'maths'), date);
      s = out.state; paid += out.coins; completed += out.completed.length;
    }
    expect(s.progress[volume.id]).toBe(volume.goal);        // 40 correct clears 15, 20 or 25
    // Exact, not `>= 1`: if the `done.includes` guard broke and matches 2–4 paid again, a lower bound holds
    // while the child is paid four times over. That is the bug this case exists to catch.
    expect(completed).toBe(1);
    expect(paid).toBe(CHALLENGE_BONUS);
    expect(s.total).toBe(1);
  });

  it('completes maths10 on a maths duel and leaves writing6 untouched — and the mirror', () => {
    // The other two un-gated challenges. A full match puts all ten correct answers in ONE subject, so it
    // clears maths10 (goal 10) or writing6 (goal 6) outright. Nothing else here drives the subject fields
    // through `applyEvent()`, so a regression setting both to `correct` would otherwise pass this whole file
    // and double-pay the dojo on every duel.
    const mDate = dateDrawing('maths10'); const wDate = dateDrawing('writing6');
    const m = applyEvent(freshDojo(mDate), duelDojoEvent(res(5, 5), 'maths'), mDate);
    expect(m.state.progress.maths10).toBe(10);
    expect(m.completed.map(c => c.id)).toContain('maths10');
    expect(m.state.progress.writing6).toBeUndefined();     // not today's draw, so never written

    const w = applyEvent(freshDojo(wDate), duelDojoEvent(res(5, 5), 'writing'), wDate);
    expect(w.state.progress.writing6).toBe(6);
    expect(w.completed.map(c => c.id)).toContain('writing6');
    expect(w.state.progress.maths10).toBeUndefined();

    // The cross cases: the day's subject challenge does not move on a duel of the other subject.
    expect(applyEvent(freshDojo(mDate), duelDojoEvent(res(5, 5), 'writing'), mDate).state.progress.maths10).toBe(0);
    expect(applyEvent(freshDojo(wDate), duelDojoEvent(res(5, 5), 'maths'), wDate).state.progress.writing6).toBe(0);
  });

  it('leaves every mode challenge, and every focus challenge but the two subject ones, exactly where they were', () => {
    // Sweep a month of days so most of the pool's mode and focus challenges are actually seen: one day only
    // ever draws one of each, and a rail that happens to miss `combo5` is the one that would not have caught
    // a non-zero bestCombo. `seen` is asserted at the end so a pool change cannot hollow this out silently.
    const seen = new Set<string>();
    for (let day = 1; day <= 28; day++) {
      const date = `2026-09-${String(day).padStart(2, '0')}`;
      const out = applyEvent(freshDojo(date), duelDojoEvent(res(5, 5), 'maths'), date);
      for (const c of dailyChallenges(date)) {
        if (c.group === 'volume') continue;
        // maths10 / writing6 are the two focus challenges a duel legitimately moves (per-subject correct
        // answers); the case above pins those, both ways round.
        if (c.id === 'maths10' || c.id === 'writing6') continue;
        seen.add(c.id);
        // No `?? 0`: applyEvent always writes the key, so an absent one is a change, not "stayed at 0".
        expect(out.state.progress[c.id], `${c.id} moved on a duel`).toBe(0);
      }
    }
    expect(seen.has('combo5'), 'the un-gated challenge was never drawn — this rail proved nothing').toBe(true);
    expect(seen.size, 'these 28 days draw nine such challenges; fewer means some dropped out of the pool unnoticed').toBe(9);
  });
});

// #16 item 5: what a finished match teaches Sensei. The tally is collected by the scorer as the match is
// played, so these drive a real `Duel` rather than asserting against a hand-built result: the whole point is
// which slices reach it and which never do.
import { beforeEach } from 'vitest';
import { duelAccuracy } from '../../src/game/duel';
import { recordAccuracy, recordTopic, reset } from '../../src/storage';
import { accuracy, weakestTopics } from '../../src/game/sensei';

// The same minimal node shim `storage.test.ts` uses, for the cases below that follow a match's tally all the
// way into the save and back out through Sensei's ranking.
const mem: Record<string, string> = {};
(globalThis as any).localStorage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };

describe('the duel tallies each seat\'s answers, one per round (#16 item 5: Sensei)', () => {
  /** A match of `rounds` rounds on the seeded topic, so a test can say what each seat did round by round. */
  const match = (rounds: number, seed = 11) => new Duel({ topic, difficulty: 1, rounds, rng: rng(seed) }, events());
  const wrongOf = (d: Duel) => d.current!.options.find(o => o !== d.current!.answer)!;

  it('counts a correct slice as a hit and a try, a wrong slice as a try alone, for the seat that made it', () => {
    const d = match(2); d.start();
    d.hit('a', wrongOf(d));
    expect(d.tally).toEqual({ a: { hits: 0, tries: 1 }, b: { hits: 0, tries: 0 } });
    d.hit('b', d.current!.answer);
    expect(d.tally).toEqual({ a: { hits: 0, tries: 1 }, b: { hits: 1, tries: 1 } });
    d.waveEnd();
    d.hit('a', d.current!.answer);
    expect(d.tally).toEqual({ a: { hits: 1, tries: 2 }, b: { hits: 1, tries: 1 } });
  });

  /**
   * PR #374's review, B1 — the whole reason this tally is per round. `Arena`'s pointermove hit-tests every
   * bubble one stroke crosses and fires `onHit` for each, and a wrong slice in a duel deliberately does not end
   * the round, so swiping the wave is the cheap and obvious play. Counted per slice, a seat that wins every
   * round that way reads as 10/28 to a parent; `progress[id].hits/tries` is one lifetime counter shared with
   * missions, where `Session` latches a question to exactly one try.
   */
  it('counts one try however many bubbles a stroke crosses: four wrong slices in one round are one try', () => {
    const d = match(2); d.start();
    const q = d.current!;
    const wrongs = q.options.filter(o => o !== q.answer);
    expect(wrongs.length, 'a wave with only one wrong option could not show this').toBeGreaterThan(1);
    for (const w of wrongs) expect(d.hit('a', w)).toBe('wrong');       // one stroke across the whole wave
    expect(d.hit('a', wrongs[0])).toBe('wrong');                        // and back over a bubble already cut
    expect(d.tally.a, 'the round is one answer, whatever the finger did').toEqual({ hits: 0, tries: 1 });
  });

  it('a seat that answers wrongly and then slices the answer wins the round and still tallies a miss', () => {
    const d = match(2); d.start();
    expect(d.hit('a', wrongOf(d))).toBe('wrong');
    expect(d.hit('a', d.current!.answer)).toBe('won');
    expect(d.scoreA, 'the round is won — the score is the race').toBe(1);
    // ...and the tally is the mission's unit: a mission question whose first answer was wrong is 0/1, because
    // `markWrong()` sets `waiting` before `tally()`. So `hits` is not a second copy of the score.
    expect(d.tally.a).toEqual({ hits: 0, tries: 1 });
  });

  it('a correct first answer is not re-counted when the same seat cuts more bubbles in that round', () => {
    const d = match(2); d.start();
    expect(d.hit('a', d.current!.answer)).toBe('won');
    expect(d.hit('a', wrongOf(d)), 'the round is decided, so this is dropped before the tally').toBe('ignored');
    expect(d.tally.a).toEqual({ hits: 1, tries: 1 });
  });

  it('latches per seat and per round, never across either', () => {
    const d = match(3); d.start();
    d.hit('a', wrongOf(d)); d.hit('a', wrongOf(d));                    // a answers once (wrongly)
    d.hit('b', d.current!.answer);                                     // b answers once (rightly), same round
    expect(d.tally).toEqual({ a: { hits: 0, tries: 1 }, b: { hits: 1, tries: 1 } });
    d.waveEnd();                                                       // round 2: the latch is off again
    d.hit('a', d.current!.answer);
    expect(d.tally.a).toEqual({ hits: 1, tries: 2 });
  });

  it('counts nothing for a slice the round has already been decided by, or for one after the match ended', () => {
    const d = match(1); d.start();
    const answer = d.current!.answer;
    d.hit('b', answer);
    // 'ignored' is the whole property: a seat that slices the answer a moment late has answered correctly, but
    // crediting it would make the tally a fact about the other child's reflexes. Dropped, not counted wrong.
    expect(d.hit('a', answer)).toBe('ignored');
    expect(d.hit('a', 'nonsense')).toBe('ignored');
    expect(d.tally.a).toEqual({ hits: 0, tries: 0 });
    d.waveEnd();                                   // the match ends here (one round)
    expect(d.hit('a', 'nonsense')).toBe('ignored');
    expect(d.tally.a).toEqual({ hits: 0, tries: 0 });
  });

  it('counts nothing at all for a round nobody sliced', () => {
    const d = match(2); d.start();
    d.waveEnd();                                   // round 1 drawn
    expect(d.tally).toEqual({ a: { hits: 0, tries: 0 }, b: { hits: 0, tries: 0 } });
  });

  it('hands the match result a snapshot a rematch cannot move', () => {
    const ev = events();
    const d = new Duel({ topic, difficulty: 1, rounds: 1, rng: rng(12) }, ev);
    d.start(); d.hit('a', d.current!.answer); d.waveEnd();
    const r: DuelResult = ev.onMatchEnd.mock.calls[0][0];
    expect(r.tally).toEqual({ a: { hits: 1, tries: 1 }, b: { hits: 0, tries: 0 } });
    d.tally.a.hits = 99; d.tally.a.tries = 99;     // the live counters are not the result's
    expect(r.tally.a).toEqual({ hits: 1, tries: 1 });
  });
});

describe('duelAccuracy (#16 item 5: only the seat the shared save can claim)', () => {
  const played = (script: ('a' | 'b' | 'wrongA' | 'draw')[]): DuelResult => {
    const ev = events();
    const d = new Duel({ topic, difficulty: 1, rounds: script.length, rng: rng(13) }, ev);
    d.start();
    for (const step of script) {
      if (step === 'wrongA') d.hit('a', d.current!.options.find(o => o !== d.current!.answer)!);
      else if (step !== 'draw') d.hit(step, d.current!.answer);
      d.waveEnd();
    }
    return ev.onMatchEnd.mock.calls[0][0];
  };

  it('is Player 1\'s own slices — never the rounds the device got right', () => {
    const r = played(['a', 'b', 'b', 'wrongA']);
    expect(duelAccuracy(r)).toEqual({ hits: 1, tries: 2 });
    // The three numbers this must not be: the match total the coins and the dojo pay on (3 right of 4 rounds),
    // and the score read as a tally (1 of 4). Each would be a claim about a child who did not answer.
    expect(duelCorrect(r)).toBe(3);
    expect(duelAccuracy(r).hits).not.toBe(duelCorrect(r));
    expect(duelAccuracy(r).tries).not.toBe(r.rounds);
  });

  it('hands back a copy, so the record cannot be edited through the hook it is put on', () => {
    // `src/ui/duel.ts` puts this object on `window.__sna` as `taught`. Nothing mutates it today; the copy is
    // what keeps that true of whatever reads the hook next (#374 N4), and `end()`'s own snapshot is the same rule.
    const r = played(['a', 'a']);
    const t = duelAccuracy(r);
    t.hits = 99; t.tries = 99;
    expect(r.tally.a).toEqual({ hits: 2, tries: 2 });
  });

  it('throws Player 2\'s tally away: it has no profile to go to', () => {
    const r = played(['b', 'b', 'b']);
    expect(r.tally.b).toEqual({ hits: 3, tries: 3 });
    expect(duelAccuracy(r)).toEqual({ hits: 0, tries: 0 });   // and `recordAccuracy` ignores a 0-try tally
  });

  it('teaches nothing after a match Player 1 never sliced in', () => {
    expect(duelAccuracy(played(['draw', 'draw']))).toEqual({ hits: 0, tries: 0 });
    expect(duelAccuracy(played(['b', 'draw']))).toEqual({ hits: 0, tries: 0 });
  });

  // Every case below writes to the save, so the save is cleared before each one rather than inline: a shim
  // shared by the whole file otherwise hands the next storage-touching test whatever the last one left (#374 N6).
  beforeEach(() => reset());

  it('is what Sensei then ranks the topic by, and a duel-only topic is not ranked as a weak one', () => {
    // The end of the chain, through the real storage and the real ranking: a duel's tally reaches
    // `progress[topic]`, and because a duel is no `play` of the topic (`recordTopic()` is not called) the
    // topic still reads as never played — the same as a topic met only in Sensei training or Sky Storm.
    const r = played(['wrongA', 'a', 'a']);
    const t = duelAccuracy(r);
    expect(t).toEqual({ hits: 2, tries: 3 });
    recordAccuracy(topic.id, t.hits, t.tries);
    const p = JSON.parse(localStorage.getItem('sna:v1')!).progress[topic.id];
    expect(p).toMatchObject({ hits: 2, tries: 3, plays: 0, stars: 0 });
    expect(accuracy(p), 'no plays, so the ratio is not yet a verdict on the child').toBe(null);
    // A SECOND topic, played and ranked, so the ordering can actually distinguish the two: `weakestTopics()`
    // puts played topics first and the never-played ones after them, so the duel-only topic must come second
    // however poor its raw ratio (#374 N1 — with one topic and n = 1 this assertion could not fail).
    const other = topicsFor('year1').find(x => x.id !== topic.id && x.input !== 'tracing')!;
    const strong = { stars: 3, best: 9, plays: 4, hits: 19, tries: 20 };
    expect(weakestTopics([topic, other], { [topic.id]: p, [other.id]: strong }, 2)).toEqual([other, topic]);
  });

  it('once the topic has been played for real, a duel\'s answers move its Sensei ranking', () => {
    // The inverse of the case above, and the one that makes the unit matter: with `plays > 0` the ratio is
    // live, so what a duel writes decides which topic Train with Sensei drills. Per-slice counting is what
    // #374's review blocked — a swiped wave would have dragged this topic to the bottom on merit it lost.
    const other = topicsFor('year1').find(x => x.id !== topic.id && x.input !== 'tracing')!;
    recordTopic(topic.id, 2, 40); recordAccuracy(topic.id, 9, 10);        // played, 90%
    recordTopic(other.id, 2, 40); recordAccuracy(other.id, 7, 10);        // played, 70% — the weaker of the two
    const before = JSON.parse(localStorage.getItem('sna:v1')!).progress;
    expect(weakestTopics([topic, other], before, 1).map(t => t.id)).toEqual([other.id]);
    // One duel of three rounds, answered wrongly twice: 10/13 ≈ 77%, still above `other`. Four wrong slices in
    // one of those rounds would have made it 10/16 on a per-slice tally and flipped the ranking on nothing.
    const t = duelAccuracy(played(['wrongA', 'a', 'wrongA']));
    expect(t).toEqual({ hits: 1, tries: 3 });
    recordAccuracy(topic.id, t.hits, t.tries);
    const after = JSON.parse(localStorage.getItem('sna:v1')!).progress;
    expect(after[topic.id]).toMatchObject({ hits: 10, tries: 13, plays: 1 });
    expect(accuracy(after[topic.id])!).toBeCloseTo(10 / 13, 5);
    expect(weakestTopics([topic, other], after, 1).map(t => t.id), 'a duel moves the ratio, without inventing tries').toEqual([other.id]);
  });
});

describe('duelStars (#16 item 5: what a duel certificate may claim)', () => {
  /** Play a scripted match and return its result — the same driver the duelAccuracy block uses. */
  const played = (script: ('a' | 'b' | 'wrongA' | 'draw')[]): DuelResult => {
    const ev = events();
    const d = new Duel({ topic, difficulty: 1, rounds: script.length, rng: rng(13) }, ev);
    d.start();
    for (const step of script) {
      if (step === 'wrongA') d.hit('a', d.current!.options.find(o => o !== d.current!.answer)!);
      else if (step !== 'draw') d.hit(step, d.current!.answer);
      d.waveEnd();
    }
    return ev.onMatchEnd.mock.calls[0][0];
  };
  // These denominators are 20, above `DUEL_ROUNDS` (10), because 95% and 70% are not expressible over ten
  // rounds and the boundaries are the point (#397 round 2, note 8). The reachable cases are asserted
  // separately below. `duelStars` now *calls* `starsForAccuracy`, so this table and
  // `tests/unit/session.test.ts`'s are two views of one function rather than two copies that can drift.
  it('uses the identical accuracy bar a mission stage uses — 95% for three, 70% for two', () => {
    expect(duelStars({ hits: 20, tries: 20 })).toBe(3);      // 100%
    expect(duelStars({ hits: 19, tries: 20 })).toBe(3);      // 95% exactly — the boundary is inclusive
    expect(duelStars({ hits: 18, tries: 20 })).toBe(2);      // 90%
    expect(duelStars({ hits: 14, tries: 20 })).toBe(2);      // 70% exactly — inclusive
    expect(duelStars({ hits: 13, tries: 20 })).toBe(1);      // 65%
    expect(duelStars({ hits: 0, tries: 20 })).toBe(1);       // never zero stars: one is the floor a mission has
  });
  it('is Player 1\'s accuracy, not the scoreline — a race won on speed is not a measurement', () => {
    // Ten rounds, Player 1 takes six, and cut wrongly four times on the way. The scoreline says 6–4; the
    // slices say 6 right of 10 tried, which is 60% and one star. Reading `scoreA` here would print three.
    const r = played(['a', 'wrongA', 'a', 'wrongA', 'a', 'wrongA', 'a', 'wrongA', 'a', 'a']);
    expect(duelAccuracy(r)).toEqual({ hits: 6, tries: 10 });
    expect(duelStars(duelAccuracy(r))).toBe(1);
    // The scoreline and the tally really do disagree on this match, which is what makes the line above a test
    // of anything. An earlier version asserted `duelStars({ hits: r.scoreA, tries: r.scoreA })` is 3 — but
    // those two fields are the same expression, so it was 3 by construction for any non-zero score and said
    // nothing about `duelStars` or about production (#16 review, note 4). The e2e's `stars: 2` from a 6–4
    // match is what actually guards the production path; this asserts the premise that path depends on.
    expect(r.scoreA, 'six rounds won').toBe(6);
    expect(duelAccuracy(r).tries, 'but ten slices taken — the two numbers a scoreline read would conflate').toBe(10);
  });
  it('gives a clean ten-round sweep three stars — the case a child actually reaches', () => {
    // Every case above is over 20; a duel is ten rounds. 10/10 is the only three-star tally reachable in one,
    // and no test reached it before (#397 round 2, note 8) — the e2e's best is two stars from a 6-4 match.
    expect(duelStars({ hits: 10, tries: 10 })).toBe(3);
    expect(duelStars({ hits: 9, tries: 10 })).toBe(2);     // 90% — one slip over ten rounds is not three stars
    expect(duelStars({ hits: 7, tries: 10 })).toBe(2);     // 70% exactly, reachable and inclusive
    expect(duelStars({ hits: 6, tries: 10 })).toBe(1);
  });
  it('scores an empty tally 1, not 3 — no answers is not perfect accuracy', () => {
    expect(duelStars({ hits: 0, tries: 0 })).toBe(1);
    // Unreachable from a won match — a win needs a hit, and a hit is a try — so this is the hand-edited floor.
    expect(duelAccuracy(played(['b', 'b']))).toEqual({ hits: 0, tries: 0 });
  });
});

/**
 * #389 — both halves of a duel pose the same wave. Found in play by the owner and his child: the answer rose
 * at a different moment on each side, so the match was decided by whichever shuffle dealt it early rather
 * than by who was quicker. `src/ui/duel.ts` spawned each arena from `Math.random` and its own
 * `performance.now()`, and `layoutWave` draws the launch order, the arcs, the colours and the wobble from
 * that rng — the launch order being the one that decides matches. At speed 1 a slot is 420 ms and a whole
 * batch is over four seconds.
 *
 * These test the production seam, not a restatement of `layoutWave`'s purity (`arena.test.ts` has that): the
 * real exported `seededRng`, one generator per half off one round seed, exactly as the screen builds them.
 */
describe('a duel lays both halves out from one draw (#389)', () => {
  const HALF = { W: 195, H: 760, topInset: 8 };       // one side of a 390-wide phone split down the middle
  const OPTS = { speed: 1, labels: ['12', '9', '14', '11'] } as never;
  const answer = (p: ReturnType<typeof layoutWave>) => p.bubbles.findIndex(b => b.label === '12');

  it('two generators off one seed deal the identical wave, launch order included', () => {
    const a = layoutWave(OPTS, HALF, 1, 1000, seededRng(7));
    const b = layoutWave(OPTS, HALF, 1, 1000, seededRng(7));
    expect(b).toEqual(a);
    // Named separately, because deep equality would still pass if every bubble were identical and the whole
    // plan were empty — and because the launch timetable is the half of it the defect was actually about.
    expect(b.bubbles.map(x => x.label)).toEqual(a.bubbles.map(x => x.label));
    expect(b.bubbles.map(x => x.launchAt)).toEqual(a.bubbles.map(x => x.launchAt));
    expect(answer(a), 'the answer is in the wave at all, so the row above is not comparing its absence').toBeGreaterThanOrEqual(0);
  });

  it('one shared generator is not the fix: the second half gets the first half leftovers', () => {
    const shared = seededRng(7);
    const a = layoutWave(OPTS, HALF, 1, 1000, shared);
    const b = layoutWave(OPTS, HALF, 1, 1000, shared);
    expect(b, 'an Rng is stateful — this is the bug with extra steps, and why each call gets its own').not.toEqual(a);
  });

  it('the plan is shared only while the geometry is — a half a different size is a different wave', () => {
    const a = layoutWave(OPTS, HALF, 1, 1000, seededRng(7));
    const b = layoutWave(OPTS, { ...HALF, H: HALF.H - 40 }, 1, 1000, seededRng(7));
    expect(b, 'which is what the rail on both halves topInset and canvas size is for').not.toEqual(a);
  });

  it('and `now` has to be shared too: the same seed a millisecond apart is a different timetable', () => {
    const a = layoutWave(OPTS, HALF, 1, 1000, seededRng(7));
    const b = layoutWave(OPTS, HALF, 1, 1001, seededRng(7));
    expect(b.bubbles.map(x => x.launchAt), 'one `performance.now()` per arena was the other half of the defect')
      .not.toEqual(a.bubbles.map(x => x.launchAt));
  });

  it('the defect itself: independent draws put the answer up at different moments', () => {
    // Sampled rather than asserted once — two independent shuffles do sometimes agree. What is pinned is that
    // they disagree *often*, which is the claim the issue makes: this is an ordinary draw, not a rare one.
    let differed = 0;
    for (let i = 0; i < 200; i++) {
      const a = layoutWave(OPTS, HALF, 1, 1000, seededRng(i * 2 + 1));
      const b = layoutWave(OPTS, HALF, 1, 1000, seededRng(i * 2 + 2));
      if (a.bubbles[answer(a)].launchAt !== b.bubbles[answer(b)].launchAt) differed++;
    }
    expect(differed, 'the head start the child actually felt').toBeGreaterThan(100);
  });
});


describe('duelEarnsCertificate (#397 review round 2, note 1: only Player 1 wins one)', () => {
  const ended = (winner: 'a' | 'b' | 'draw', scoreA: number, scoreB: number): DuelResult =>
    ({ winner, scoreA, scoreB, rounds: DUEL_ROUNDS, tally: matchTally(scoreA, scoreB) });

  // All three `winner` values, which is the whole reason this predicate was lifted out of `duelScreen`'s
  // closure: in there it took a full ten-round Playwright match to reach, so the draw arm was exercised and a
  // LOSS was not. Weakening it to `winner === 'draw'` left the entire suite green while a defeat filed a
  // certificate into the child's own album, carrying the loser's score and stars off a tally that is not theirs.
  it('is a Player 1 win, and nothing else', () => {
    expect(duelEarnsCertificate(ended('a', 6, 4))).toBe(true);
    expect(duelEarnsCertificate(ended('b', 4, 6)), 'a loss earns the profile nothing').toBe(false);
    expect(duelEarnsCertificate(ended('draw', 5, 5)), 'a draw earns nothing either').toBe(false);
  });
  it('reads the winner, not the scoreline', () => {
    // A result whose `winner` disagrees with its scores is not constructible by `Duel`, but the predicate must
    // not second-guess it: `winner` is the scorer's own verdict and the one field the rest of the screen uses.
    expect(duelEarnsCertificate(ended('a', 0, 9))).toBe(true);
    expect(duelEarnsCertificate(ended('b', 9, 0))).toBe(false);
  });
});

// B1 of PR #415's review: `duelHistoryHTML`'s own docstring said it was "unit-tested without a DOM, exactly as
// `certAlbumHTML` is" while a grep over tests/ returned nothing. These mirror `certAlbumHTML`'s five tests in
// `tests/unit/certificate.test.ts` one for one, because that is the sibling the claim named.
describe('duelHistoryHTML ("Recent duels", #16)', () => {
  const storedDuel = (o: Partial<StoredDuel> = {}): StoredDuel =>
    ({ at: Date.UTC(2026, 8, 6, 10, 0, 0), topic: 'y1-bonds', title: 'Number Bonds', year: 'Year 1', winner: 'a', scoreA: 6, scoreB: 4, rounds: 10, ...o });

  it('shows an empty-state hint, with no cert-list, when no duel has been played', () => {
    const h = duelHistoryHTML([]);
    expect(h).toContain('duel-empty');
    expect(h).toContain('Hand the device to a friend and play a Ninja Duel');
    expect(h).not.toContain('cert-list');
    // Its own class, not the album's: `.cert-empty` means "no certificates" to the certificate album's e2e.
    expect(h).not.toContain('cert-empty');
  });

  it('renders one row per match, in the album\'s own markup, with the scoreline where the stars sit', () => {
    const h = duelHistoryHTML([storedDuel(), storedDuel({ title: 'Days of the Week', winner: 'b', scoreA: 3, scoreB: 7 })]);
    expect((h.match(/class="cert-row duel-row"/g) ?? []).length).toBe(2);
    // Both classes, always paired (#415 review, note 1): the album's rule is borrowed, but the album's own
    // e2e and two QA scripts select `.cert-row`, so a duel row has to stay tellable apart from a certificate
    // one. Dropping `duel-row` here makes `.cert-row:not(.duel-row)` count duel rows in the album's test.
    expect(h).toContain('class="cert-list duel-list"');
    expect(h).not.toContain('class="cert-row"');
    expect(h).toContain('cert-info');
    expect(h).toContain('Number Bonds');
    expect(h).toContain('Days of the Week');
    expect(h).toContain('Player 1 won · 6–4');
    expect(h).toContain('Player 2 won · 3–7');
    // No View button: a duel has nothing to redraw, which is the one thing the row does not borrow.
    expect(h).not.toContain('cert-open');
  });

  it('subtitles a row with the year group and a British, year-less date', () => {
    const h = duelHistoryHTML([storedDuel()]);
    // The WHOLE subtitle, not a substring of it (#415 round 2, B2 and note 4). `toContain('6 Sept')` passed
    // under `month: 'long'` ("6 September") and said nothing at all about `year`, so dropping the year group
    // from the row was green — and `StoredDuel.year`'s own comment promises the title, never the id.
    expect(h).toContain('<small>Year 1 · 6 Sept</small>');
    // The deliberate difference from `certAlbumHTML`, which renders "6 Sept 2026": twenty rows from the last
    // fortnight all carry the same year, and the row needs the width for its scoreline.
    expect(h).not.toContain('6 Sept 2026');
  });

  it('names the topic the match was played on, not the id', () => {
    // `topic` is the durable key and `title` is what a child reads; the row shows the title. Swapping them at
    // the `recordDuel` call site used to pass, because nothing asserted which one reached the row.
    const h = duelHistoryHTML([storedDuel({ topic: 'y1-bonds', title: 'Number Bonds' })]);
    expect(h).toContain('<b>Number Bonds</b>');
    expect(h).not.toContain('y1-bonds');
  });

  it('escapes a hand-edited title/year rather than injecting markup', () => {
    const h = duelHistoryHTML([storedDuel({ title: '<img onerror=alert(1)>', year: '"><script>' })]);
    expect(h).not.toContain('<img onerror');
    expect(h).not.toContain('<script>');
  });

  it('tolerates an unparsable timestamp instead of printing "Invalid Date"', () => {
    const h = duelHistoryHTML([storedDuel({ at: NaN })]);
    expect(h).not.toContain('Invalid Date');
    expect(h).toContain('Number Bonds');   // the row still renders, it just loses its date
  });
});
