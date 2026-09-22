import { describe, expect, it } from 'vitest';
import { resultMedal, resultHeading } from '../../src/ui/results';
import { resultsHTML, type ResultsData } from '../../src/ui/overlays';
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
  /**
   * #522 review (pr-test-analyzer, silent-failure-hunter): Endless/Sprint grade purely on score/stars, so an
   * incomplete run's partial numbers would otherwise still earn a real 🥇/🥈/🥉 — a medal that reads as an
   * achievement next to a heading that says the session did not finish. `incomplete` overrides every mode.
   */
  it('never grades an incomplete run on score or stars, whatever the mode', () => {
    for (const mode of ['mission', 'boss', 'endless', 'sprint'] as Mode[]) {
      expect(resultMedal({ mode, won: false, score: 999, stars: 3, incomplete: true })).toBe('💪');
      expect(resultMedal({ mode, won: true, score: 999, stars: 3, incomplete: true }), 'even a (never-should-happen) won+incomplete result').toBe('💪');
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

/**
 * #522 review (pr-test-analyzer, silent-failure-hunter): `.hero-big.sad` is the genuine-defeat face
 * (grayscale portrait, `src/style.css`) — an incomplete run must never wear it, whatever `won` reads, or the
 * avatar contradicts the "that question broke" copy right beside it.
 */
describe('resultsHTML heroExtra (#522)', () => {
  const base: ResultsData = {
    mode: 'mission', won: false, training: false, glow: '#fff', img: 'x.webp', name: 'Ninja',
    headline: 'hi', medal: '💪', heading: 'Out of lives', starCount: 0, score: 0, correct: 0, attempts: 0,
    bestCombo: 0, coins: 0, newBest: false, streak: 0, dojoRows: '', stickerHTML: '', cert: false,
  };
  it('a genuine loss wears the sad face', () => {
    expect(resultsHTML(base)).toContain('hero-big sad');
  });
  it('an incomplete run never wears it, even though won is false the same way a loss is', () => {
    expect(resultsHTML({ ...base, incomplete: true })).not.toContain('sad');
  });
  it('a win never wears it either way', () => {
    expect(resultsHTML({ ...base, won: true })).not.toContain('sad');
  });
});
