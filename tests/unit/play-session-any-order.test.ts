import { describe, expect, it } from 'vitest';
import type { Question } from '../../src/curriculum';
import { waveOptsFor } from '../../src/ui/play-session';

// Its own file because play-session.test.ts is frozen at its length (#1388).
describe('waveOptsFor for an any-order card (#919)', () => {
  const q = (extra: Partial<Omit<Question, 'hint' | 'hintIsData'>> = {}): Question => ({ prompt: 'p', answer: 'a', options: ['a', 'b'], ...extra });

  // #919: an any-order card's remaining targets are a subset of the sequence, not a trailing slice of it —
  // the middle one can be found first, unlike a spelling sequence's strictly-in-order `seqIndex`.
  it('sends any subset of the sequence as ordered for an any-order question, not only a trailing slice', () => {
    const sequence = ['2', '4', '6', '8'];
    expect(waveOptsFor(q({ sequence, anyOrder: true }), { labels: sequence, speed: 1 }, ['2', '8']).ordered).toEqual(['2', '8']);
  });

  // #919 round 2 review: the fix for duel.ts's mistranslated `[]` was making `remaining` default to the
  // whole sequence when omitted — but nothing pinned that default itself. Mutation-tested by the reviewer
  // (temporarily `remaining ?? []`): the full suite still passed, since every other sequence-question test
  // passes an explicit array. This is the one that would have caught it.
  it('omitting remaining for a sequence question defaults to the whole sequence, not nothing left', () => {
    const sequence = ['one', 'two', 'three'];
    expect(waveOptsFor(q({ sequence }), { labels: sequence, speed: 1 }).ordered).toEqual(sequence);
  });
});
