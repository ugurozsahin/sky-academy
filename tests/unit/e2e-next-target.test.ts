import { describe, expect, it } from 'vitest';
import { code, e2eSpecFiles } from './helpers/sources';

// #1540: the e2e "Relaxed practice (#937)" test failed about one run in eight — whenever Year 1's mixed pool
// drew an any-order card (`y1-skip-anyorder`). `__sna.answer()` slices `session.remaining()[0]`, but the
// waits around it named the next bubble as `current.sequence[seqIndex]`, a position that never advances on an
// any-order card (`session.ts`'s `remainingOf`). After the first slice the wait watched a bubble already
// `hit`, the rest of the wave relaunched (#591) and fell, the card ended as a miss (#918), and `solveCurrent`
// quietly solved the NEXT question in its place — one question short, 6/10 instead of 7/10, and a 20 s wait
// on a game that had already ended. The wait and the slice must name the same bubble: `remaining()[0]`.
// The ban is on the bare token, not on one spelling of the index: `sequence[seqIndex]`, `sequence?.[seqIndex]`,
// `sequence.at(seqIndex)` and an aliased `const i = seqIndex` are the same mistake, and no e2e code reads
// `seqIndex` for any other reason (comments are stripped by `code()` first).
// Scope: `e2eSpecFiles()` reads `tests/e2e/*.spec.ts` only, so a wait hoisted into a non-spec helper file
// there is outside this ban — widen the read if one appears. And if a `nextTarget()` hook ever joins
// `PlayHooks` so the wait and the slice read one function, the floor-of-five test below correctly goes to
// zero: retire or re-point this rail in that PR rather than keep both spellings alive.
const IDIOM = /\bseqIndex\b/;

describe('an e2e wait names the next bubble the way answer() slices it (#1540)', () => {
  const specs = e2eSpecFiles();

  it('finds the specs it is about, and the regex catches the idiom it bans', () => {
    expect(specs.length).toBeGreaterThanOrEqual(4);
    expect('c.sequence ? c.sequence[window.__sna.session.seqIndex] : c.answer').toMatch(IDIOM);
    expect('c.sequence?.[s.seqIndex]').toMatch(IDIOM);
    expect('c.sequence ? window.__sna.session.remaining()[0] : c.answer').not.toMatch(IDIOM);
  });

  it.each(specs.map(s => s.name))('%s never reads seqIndex to name the next bubble', name => {
    const src = code(specs.find(s => s.name === name)!.text);
    const hits = src.split('\n').flatMap((l, i) => (IDIOM.test(l) ? [`${name}:${i + 1}`] : []));
    expect(hits, 'name the next bubble as session.remaining()[0] — seqIndex stands still on an any-order card').toEqual([]);
  });

  it('game.spec.ts still waits on the bubble answer() will slice, at every one of the five sites', () => {
    const game = code(specs.find(s => s.name === 'game.spec.ts')!.text);
    // frozenTarget, waitForTarget, waitForWrongOrEnd, answerAll and the r-build spelling test — one fewer is a
    // helper that drifted back to some other spelling of "the next bubble".
    expect(game.split('session.remaining()[0]').length - 1, 'the five waits read remaining()[0]').toBeGreaterThanOrEqual(5);
  });
});
