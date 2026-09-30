import { describe, it, expect } from 'vitest';
import { drawFresh, repeatKey } from '../../src/game/repeat-key';
import type { Question } from '../../src/curriculum';

const q = (answer: string): Question => ({ prompt: 'p', answer, options: ['a', 'b', 'c'] });

/**
 * Direct tests of `drawFresh` itself (#879 review, pr-test-analyzer): `Duel`'s own tests
 * (`tests/unit/duel-repeats.test.ts`) exercise it only through `Duel.nextQuestion()`'s one call site, at the
 * default `tries = 5` — these pin the two edges that call site can never reach on its own: `tries = 0`, and
 * the exact boundary where the *last* allowed re-roll is what succeeds.
 */
describe('drawFresh (#879)', () => {
  it('prevQuestion null never re-rolls, whatever draw() returns', () => {
    let calls = 0;
    const { q: got, gaveUp } = drawFresh(() => { calls++; return q('a'); }, null);
    expect(calls).toBe(1);
    expect(got.answer).toBe('a');
    expect(gaveUp).toBe(false);
  });

  it('tries = 0 skips the re-roll loop entirely: one draw, gaveUp true if it collides', () => {
    let calls = 0;
    const { q: got, gaveUp } = drawFresh(() => { calls++; return q('x'); }, q('x'), 0);
    expect(calls, 'no re-roll may happen').toBe(1);
    expect(got.answer).toBe('x');
    expect(gaveUp).toBe(true);
  });

  it('a collision on every try but the last is still resolved: only the final, non-colliding draw is kept', () => {
    // Collides on the raw draw and the first three re-rolls; the fourth re-roll (the fifth draw, the last one
    // `tries = 5` allows) is the one that finally differs.
    const seq = ['x', 'x', 'x', 'x', 'y'];
    let i = 0;
    const { q: got, gaveUp } = drawFresh(() => q(seq[i++]), q('x'));
    expect(i, 'every draw up to and including the last allowed one was used').toBe(5);
    expect(got.answer).toBe('y');
    expect(gaveUp).toBe(false);
  });

  it('a collision that survives every try, including the last, is served anyway and counted as given up', () => {
    let calls = 0;
    const { q: got, gaveUp } = drawFresh(() => { calls++; return q('x'); }, q('x'));
    expect(calls, 'the raw draw plus all five re-rolls').toBe(6);
    expect(got.answer).toBe('x');
    expect(gaveUp).toBe(true);
  });

  it('takes the previous Question itself, not an already-computed key: repeatKey is derived internally', () => {
    // Two Questions with the same answer but a different prompt are NOT the same card (`repeatKey` reads
    // more than `answer`) — passing the whole Question, not a bare string, is what makes that distinction
    // possible at all.
    const { gaveUp } = drawFresh(() => q('a'), { ...q('a'), prompt: 'a different prompt' });
    expect(repeatKey(q('a'))).not.toBe(repeatKey({ ...q('a'), prompt: 'a different prompt' }));
    expect(gaveUp, 'a different prompt is a different card, not a repeat').toBe(false);
  });
});
