import { describe, expect, it } from 'vitest';
import { resultMedal, resultHeading } from '../../src/ui/results';
import type { Mode } from '../../src/game/modes';

// #36: these were dense ternaries buried in play.ts's showResults, reached only by the e2e results screen.
// Now they are pure functions, so every mode/win/star combination is checked here directly.

describe('resultMedal', () => {
  it('grades Sky Storm (endless) on score, ignoring stars and win', () => {
    expect(resultMedal({ mode: 'endless', won: true, score: 300, stars: 0 })).toBe('🥇');
    expect(resultMedal({ mode: 'endless', won: false, score: 400, stars: 0 })).toBe('🥇');
    expect(resultMedal({ mode: 'endless', won: true, score: 299, stars: 3 })).toBe('🥈');
    expect(resultMedal({ mode: 'endless', won: true, score: 150, stars: 0 })).toBe('🥈');
    expect(resultMedal({ mode: 'endless', won: true, score: 149, stars: 3 })).toBe('🥉');
    expect(resultMedal({ mode: 'endless', won: true, score: 0, stars: 0 })).toBe('🥉');
  });

  it('grades Ninja Sprint on its star tier (💪 when it earned none)', () => {
    expect(resultMedal({ mode: 'sprint', won: true, score: 999, stars: 3 })).toBe('🥇');
    expect(resultMedal({ mode: 'sprint', won: true, score: 0, stars: 2 })).toBe('🥈');
    expect(resultMedal({ mode: 'sprint', won: true, score: 0, stars: 1 })).toBe('🥉');
    expect(resultMedal({ mode: 'sprint', won: true, score: 0, stars: 0 })).toBe('💪');
  });

  it('grades mission and boss on stars when won, and the effort medal when lost', () => {
    for (const mode of ['mission', 'boss'] as Mode[]) {
      expect(resultMedal({ mode, won: true, score: 0, stars: 3 })).toBe('🥇');
      expect(resultMedal({ mode, won: true, score: 0, stars: 2 })).toBe('🥈');
      expect(resultMedal({ mode, won: true, score: 0, stars: 1 })).toBe('🥉');
      expect(resultMedal({ mode, won: true, score: 0, stars: 0 })).toBe('🥉');
      expect(resultMedal({ mode, won: false, score: 999, stars: 3 })).toBe('💪');
    }
  });
});

describe('resultHeading', () => {
  it('reads each mode heading from the table', () => {
    expect(resultHeading('mission', { won: true, training: false })).toBe('Mission complete!');
    expect(resultHeading('mission', { won: false, training: false })).toBe('Out of lives');
    expect(resultHeading('endless', { won: true, training: false })).toBe('Storm over!');
    expect(resultHeading('endless', { won: false, training: false })).toBe('Storm over!');
    expect(resultHeading('sprint', { won: true, training: false })).toBe("Time's up!");
    expect(resultHeading('sprint', { won: false, training: false })).toBe("Time's up!");
    expect(resultHeading('boss', { won: true, training: false })).toBe('Knock-out!');
    expect(resultHeading('boss', { won: false, training: false })).toBe('Hammer Man wins this round');
  });

  it('a won Sensei-training run (staged + training) reads "Training complete!"', () => {
    expect(resultHeading('mission', { won: true, training: true })).toBe('Training complete!');
  });

  it('training only rebrands a won staged run — a lost mission keeps its own heading', () => {
    expect(resultHeading('mission', { won: false, training: true })).toBe('Out of lives');
  });

  it('training on a non-staged mode never triggers the training heading', () => {
    expect(resultHeading('endless', { won: true, training: true })).toBe('Storm over!');
    expect(resultHeading('sprint', { won: true, training: true })).toBe("Time's up!");
    expect(resultHeading('boss', { won: true, training: true })).toBe('Knock-out!');
  });
});
