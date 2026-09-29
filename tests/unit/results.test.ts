import { describe, expect, it, vi } from 'vitest';
import { resultHeading, resultHeadline, resultMedal, resultPillsHTML, resultsLines, type ResultCandidate } from '../../src/ui/results';
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
 * #877: Mission has no villain (`MODES.mission.villain` is false), so a lost Mission used to say "Hammer Man
 * got away" regardless of mode — the only mode that reaches the plain-loss branch without one, and the mode
 * children play most. This table covers mode × won × training × incomplete × newBest.
 */
describe('resultHeadline', () => {
  const base = { training: false, newBest: false, name: 'Ninja', senseiLine: () => 'SENSEI SAYS', praiseLine: () => 'PRAISE LINE' };

  it('incomplete overrides every other case', () => {
    for (const mode of ['mission', 'boss', 'endless', 'sprint'] as Mode[]) {
      for (const won of [true, false]) {
        expect(resultHeadline({ mode, won, score: 0, stars: 0, incomplete: true }, base))
          .toBe('That question broke — here is what you earned so far!');
      }
    }
  });

  it('training reads senseiLine, won or lost', () => {
    expect(resultHeadline({ mode: 'mission', won: true, score: 0, stars: 3 }, { ...base, training: true })).toBe('SENSEI SAYS');
    expect(resultHeadline({ mode: 'mission', won: false, score: 0, stars: 0 }, { ...base, training: true })).toBe('SENSEI SAYS');
  });

  it('a Sprint new best reads "New best"', () => {
    expect(resultHeadline({ mode: 'sprint', won: true, score: 0, stars: 3 }, { ...base, newBest: true })).toBe('New best, Ninja!');
  });

  it('a won Boss Battle reads the K.O. line', () => {
    expect(resultHeadline({ mode: 'boss', won: true, score: 0, stars: 3 }, base)).toBe('K.O.! You beat Hammer Man, Ninja!');
  });

  it('any other win reads the praise line', () => {
    for (const mode of ['mission', 'endless', 'sprint'] as Mode[]) {
      expect(resultHeadline({ mode, won: true, score: 0, stars: 3 }, base)).toBe('PRAISE LINE');
    }
  });

  it('a lost Mission never names Hammer Man — Mission has no villain', () => {
    expect(resultHeadline({ mode: 'mission', won: false, score: 0, stars: 0 }, base)).toBe('Good try, Ninja! Have another go.');
  });

  it('a lost Sky Storm and a lost Boss Battle keep "Hammer Man got away this time"', () => {
    expect(resultHeadline({ mode: 'endless', won: false, score: 0, stars: 0 }, base)).toBe('Hammer Man got away this time, Ninja!');
    expect(resultHeadline({ mode: 'boss', won: false, score: 0, stars: 0 }, base)).toBe('Hammer Man got away this time, Ninja!');
  });

  it('falls back to "Ninja" when the child has no name', () => {
    expect(resultHeadline({ mode: 'mission', won: false, score: 0, stars: 0 }, { ...base, name: '' })).toBe('Good try, Ninja! Have another go.');
  });

  // The type-design review of PR #877's fix: senseiLine/praiseLine draw a random line as a side effect
  // (src/avatars.ts), so a plain string here would draw and discard one on every branch that does not read it.
  it('never calls the line-generator thunk its branch does not read', () => {
    const spies = () => ({ senseiLine: vi.fn(() => 'SENSEI SAYS'), praiseLine: vi.fn(() => 'PRAISE LINE') });
    let s = spies();
    resultHeadline({ mode: 'mission', won: true, score: 0, stars: 0, incomplete: true }, { ...base, ...s });
    expect(s.senseiLine).not.toHaveBeenCalled(); expect(s.praiseLine).not.toHaveBeenCalled();

    s = spies();
    resultHeadline({ mode: 'sprint', won: true, score: 0, stars: 3 }, { ...base, ...s, newBest: true });
    expect(s.senseiLine).not.toHaveBeenCalled(); expect(s.praiseLine).not.toHaveBeenCalled();

    s = spies();
    resultHeadline({ mode: 'boss', won: true, score: 0, stars: 3 }, { ...base, ...s });
    expect(s.senseiLine).not.toHaveBeenCalled(); expect(s.praiseLine).not.toHaveBeenCalled();

    s = spies();
    resultHeadline({ mode: 'mission', won: false, score: 0, stars: 0 }, { ...base, ...s });
    expect(s.senseiLine).not.toHaveBeenCalled(); expect(s.praiseLine).not.toHaveBeenCalled();

    s = spies();
    resultHeadline({ mode: 'mission', won: true, score: 0, stars: 3 }, { ...base, ...s });
    expect(s.praiseLine).toHaveBeenCalledTimes(1); expect(s.senseiLine).not.toHaveBeenCalled();

    s = spies();
    resultHeadline({ mode: 'mission', won: false, score: 0, stars: 0 }, { ...base, ...s, training: true });
    expect(s.senseiLine).toHaveBeenCalledTimes(1); expect(s.praiseLine).not.toHaveBeenCalled();
  });
});

/**
 * #896: at most two results-screen announcements, in register order (belt > island > trophy > best > rest),
 * so two features speaking on the same results screen never talk over each other.
 */
describe('resultsLines', () => {
  const c = (kind: ResultCandidate['kind'], text: string = kind): ResultCandidate => ({ kind, text });

  it('returns every candidate, in precedence order, when two or fewer', () => {
    expect(resultsLines([c('rest'), c('belt')])).toEqual([c('belt'), c('rest')]);
    expect(resultsLines([c('best')])).toEqual([c('best')]);
  });

  it('caps at two even when every kind is present, keeping the two highest', () => {
    const all = ['rest', 'best', 'trophy', 'island', 'belt'].map(k => c(k as ResultCandidate['kind']));
    expect(resultsLines(all)).toEqual([c('belt'), c('island')]);
  });

  it('returns an empty list for an empty list', () => {
    expect(resultsLines([])).toEqual([]);
  });

  it('keeps ties (two candidates of the same kind) in their input order', () => {
    const first = c('best', 'first'); const second = c('best', 'second');
    expect(resultsLines([first, second])).toEqual([first, second]);
  });

  it('the full precedence order: belt > island > trophy > best > rest', () => {
    const shuffled = [c('best'), c('rest'), c('trophy'), c('belt'), c('island')];
    expect(resultsLines(shuffled).map(l => l.kind)).toEqual(['belt', 'island']);
    expect(resultsLines(shuffled.filter(l => l.kind !== 'belt')).map(l => l.kind)).toEqual(['island', 'trophy']);
    expect(resultsLines(shuffled.filter(l => !['belt', 'island'].includes(l.kind))).map(l => l.kind)).toEqual(['trophy', 'best']);
    expect(resultsLines(shuffled.filter(l => ['best', 'rest'].includes(l.kind))).map(l => l.kind)).toEqual(['best', 'rest']);
  });
});

/**
 * #896 review (pr-test-analyzer): the escaping itself lives in `resultPillsHTML`'s `esc()` call, one layer
 * below the `overlays.ts` test above that only proves an already-escaped string passes through unchanged.
 * A future candidate's `text` (a belt name, eventually a child's own name) is untrusted the same way every
 * other on-screen string here is.
 */
describe('resultPillsHTML', () => {
  it('wraps each line in a best-pill span, in resultsLines order', () => {
    const lines: ResultCandidate[] = [{ kind: 'belt', text: 'Green Belt' }, { kind: 'best', text: 'New best!' }];
    expect(resultPillsHTML(lines)).toBe('<span class="best-pill">Green Belt</span><span class="best-pill">New best!</span>');
  });

  it('escapes HTML-unsafe characters in the candidate text', () => {
    expect(resultPillsHTML([{ kind: 'best', text: '<b>Ada</b> & "friends"' }]))
      .toBe('<span class="best-pill">&lt;b&gt;Ada&lt;/b&gt; &amp; &quot;friends&quot;</span>');
  });

  it('renders nothing for an empty list', () => {
    expect(resultPillsHTML([])).toBe('');
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

/**
 * #896: with no candidates the overlay's HTML is unchanged (`resultLines` omitted); a candidate line renders
 * into the coin row as an existing `best-pill` span, the same class `newBest` already uses — no new class,
 * rule or element type.
 */
describe('resultsHTML resultLines (#896)', () => {
  const base: ResultsData = {
    mode: 'mission', won: true, training: false, glow: '#fff', img: 'x.webp', name: 'Ninja',
    headline: 'hi', medal: '🥇', heading: 'Mission complete!', starCount: 3, score: 10, correct: 5, attempts: 5,
    bestCombo: 3, coins: 5, newBest: false, streak: 0, dojoRows: '', stickerHTML: '', cert: false,
  };
  it('renders the same HTML with resultLines omitted as with it empty', () => {
    expect(resultsHTML(base)).toBe(resultsHTML({ ...base, resultLines: '' }));
  });
  it('a supplied line renders as a best-pill in the coin row, escaped', () => {
    const html = resultsHTML({ ...base, resultLines: '<span class="best-pill">Green Belt &lt;3&gt;</span>' });
    expect(html).toContain('<span class="best-pill">Green Belt &lt;3&gt;</span>');
  });
});
