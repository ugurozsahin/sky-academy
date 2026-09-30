import { describe, it, expect } from 'vitest';
import { Duel } from '../../src/game/duel';
import type { Topic } from '../../src/curriculum';

function rng(seed: number) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const events = (): any => ({ onQuestion: () => {}, onRoundWon: () => {}, onRoundMiss: () => {}, onRoundDraw: () => {}, onMatchEnd: () => {} });

/**
 * Ninja Duel avoids repeating the previous round's card, the same rule `Session.nextQuestion()` applies,
 * through `drawFresh()` (`src/game/repeat-key.ts`, #879) — before this, `Duel.nextQuestion()` drew every round
 * with a bare `topic.gen()` and could serve the same card twice running. These three stub topics are the
 * shapes the issue itself asked for: a small uniform keyspace, a keyspace of one, and a controlled first-draw
 * collision. In its own file rather than `duel.test.ts`, whose `fileLines` ratchet is frozen at 970 (#1381).
 */
describe('Duel avoids an immediate repeat (#879)', () => {
  const win = (d: Duel) => { d.hit('a', d.current!.answer); d.waveEnd(); };

  it('a three-card uniform topic (unaided repeat rate 1 in 3) keeps the immediate-repeat rate under 2%, and every repeat served is counted', () => {
    const three: Topic = { id: 'test-three', title: 'test', icon: '🔧', subject: 'maths', year: 'year1', nc: '',
      gen: (_d, gen) => ({ prompt: 'p', answer: String(Math.floor(gen() * 3)), options: ['0', '1', '2'] }) };
    const rounds = 2000;
    const d = new Duel({ topic: three, difficulty: 1, rng: rng(1), rounds }, events());
    d.start();
    let prev = d.current!.answer, repeats = 0;
    for (let i = 1; i < rounds; i++) {
      win(d);
      const q = d.current!;
      if (q.answer === prev) repeats++;
      prev = q.answer;
    }
    expect(repeats / rounds, 'immediate-repeat rate').toBeLessThan(0.02);
    expect(d.repeatGiveUps, 'every repeat served must be the one this counts').toBe(repeats);
  });

  it('a one-card topic still plays a full match: every round after the first repeats, counted, no throw', () => {
    const one: Topic = { id: 'test-one', title: 'test', icon: '🔧', subject: 'maths', year: 'year1', nc: '',
      gen: () => ({ prompt: 'p', answer: 'x', options: ['x', 'y'] }) };
    const rounds = 20;
    const d = new Duel({ topic: one, difficulty: 1, rng: rng(1), rounds }, events());
    expect(() => d.start()).not.toThrow();
    for (let i = 1; i < rounds; i++) expect(() => win(d)).not.toThrow();
    expect(d.repeatGiveUps).toBe(rounds - 1);
    expect(d.round).toBe(rounds);
    expect(d.ended, 'a full match, not the #444 abort path').toBe(false);
  });

  it('a card that collides on the first draw of a round is replaced by the re-roll, not left as the repeat', () => {
    let n = 0;
    const seq = ['a', 'a', 'b'];   // round 1's card, round 2's colliding raw draw, round 2's re-roll
    const flippy: Topic = { id: 'test-flippy', title: 'test', icon: '🔧', subject: 'maths', year: 'year1', nc: '',
      gen: () => ({ prompt: 'p', answer: seq[n++] ?? 'b', options: ['a', 'b'] }) };
    const d = new Duel({ topic: flippy, difficulty: 1, rng: rng(1) }, events());
    d.start();
    expect(d.current!.answer).toBe('a');
    win(d);
    expect(d.current!.answer, 'the re-roll must have replaced the colliding raw draw').toBe('b');
    expect(d.repeatGiveUps, 'the re-roll found a non-repeat within its five tries').toBe(0);
  });
});
