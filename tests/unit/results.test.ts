import { describe, expect, it, vi } from 'vitest';
import { firstQuestionLine, resultHeading, resultHeadline, resultMedal, resultPillsHTML, resultsAction, resultsLines, scoreLine, type ResultCandidate } from '../../src/ui/results';
import { resultsHTML, type ResultsData } from '../../src/ui/overlays';
import type { Mode } from '../../src/game/modes';
import type { Question, Topic } from '../../src/curriculum';

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
 * #929: the results row's one contextual action. `retry` and `fix` have no caller yet (#931/#930 supply
 * `lostAtStage`/`misses` later) — this pins the precedence order the pure function already implements, so
 * the day a caller does pass them the rule is proven rather than assumed.
 */
describe('resultsAction', () => {
  const topic = { id: 'y1-bonds', title: 'Number Bonds' } as Topic;
  const base = { mode: 'mission' as Mode, training: false, won: true, misses: 0, next: null as Topic | null };

  it('a won, non-training mission with a topic left offers "next"', () => {
    expect(resultsAction({ ...base, next: topic })).toEqual({ kind: 'next', topic });
  });

  it('a won mission with every topic already starred (next: null) offers nothing', () => {
    expect(resultsAction({ ...base, next: null })).toBeNull();
  });

  it('a non-mission win never offers "next", whatever topic is passed', () => {
    for (const mode of ['endless', 'sprint', 'boss'] as Mode[]) expect(resultsAction({ ...base, mode, next: topic })).toBeNull();
  });

  it('a won training run never offers "next" — Sensei has no single topic to advance from', () => {
    expect(resultsAction({ ...base, training: true, next: topic })).toBeNull();
  });

  it('a lost mission offers "retry" only from stage 3 or later', () => {
    expect(resultsAction({ ...base, won: false, lostAtStage: 3, next: topic })).toEqual({ kind: 'retry', stage: 3 });
    expect(resultsAction({ ...base, won: false, lostAtStage: 2, next: topic })).toBeNull();
    expect(resultsAction({ ...base, won: false, lostAtStage: undefined, next: topic })).toBeNull();
  });

  it('a lost training run never offers "retry" — training has no stage to repeat', () => {
    expect(resultsAction({ ...base, won: false, training: true, lostAtStage: 5 })).toBeNull();
  });

  it('one or more misses offers "fix" on a mission or a training run', () => {
    expect(resultsAction({ ...base, misses: 1, next: topic })).toEqual({ kind: 'fix' });
    expect(resultsAction({ ...base, training: true, won: false, misses: 2 })).toEqual({ kind: 'fix' });
  });

  it('the full precedence order: retry > fix > next > nothing', () => {
    // A lost mission at stage 3+ with misses still reads "retry", never "fix".
    expect(resultsAction({ ...base, won: false, lostAtStage: 3, misses: 4 })).toEqual({ kind: 'retry', stage: 3 });
    // A won mission with misses reads "fix", never "next", even though a topic is left.
    expect(resultsAction({ ...base, misses: 1, next: topic })).toEqual({ kind: 'fix' });
  });

  it('a non-mission, non-training run with misses never offers "fix"', () => {
    expect(resultsAction({ ...base, mode: 'endless', misses: 3 })).toBeNull();
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

/** #929: `action` passes straight through to `resultsModal()`'s own row — the escaping and placement are
 *  pinned there (`tests/unit/screen.test.ts`); this only proves `resultsHTML` forwards it. */
describe('resultsHTML action (#929)', () => {
  const base: ResultsData = {
    mode: 'mission', won: true, training: false, glow: '#fff', img: 'x.webp', name: 'Ninja',
    headline: 'hi', medal: '🥇', heading: 'Mission complete!', starCount: 3, score: 10, correct: 5, attempts: 5,
    bestCombo: 3, coins: 5, newBest: false, streak: 0, dojoRows: '', stickerHTML: '', cert: false,
  };
  it('renders the same HTML with action omitted as with no action at all', () => {
    expect(resultsHTML(base)).not.toContain('next-topic');
  });
  it('a supplied action reaches the row as its own button', () => {
    expect(resultsHTML({ ...base, action: { id: 'next-topic', label: 'Next topic →' } })).toContain('id="next-topic">Next topic →</button>');
  });
});

/**
 * #897: the results screen's spoken score line — how a non-reader hears they did, not only a praise line.
 */
describe('scoreLine', () => {
  const base = { mode: 'mission' as Mode, won: true, correct: 18, stars: 3 };

  it('always opens with the correct count, singular phrasing included', () => {
    expect(scoreLine({ ...base, correct: 18 })).toBe('You got 18 right. Three stars!');
    expect(scoreLine({ ...base, correct: 1 })).toBe('You got 1 right. Three stars!');
    expect(scoreLine({ ...base, correct: 0, won: false, stars: 0 })).toBe('You got 0 right.');
  });

  it('adds the star word only for a won mission with stars, one/two/three', () => {
    expect(scoreLine({ ...base, stars: 1 })).toBe('You got 18 right. One star!');
    expect(scoreLine({ ...base, stars: 2 })).toBe('You got 18 right. Two stars!');
    expect(scoreLine({ ...base, stars: 3 })).toBe('You got 18 right. Three stars!');
  });

  it('never adds a star word to a lost mission, whatever stars carries over from a prior stage', () => {
    expect(scoreLine({ ...base, won: false, stars: 2 })).toBe('You got 18 right.');
  });

  it('never adds a star word at 0 stars, even on a win', () => {
    expect(scoreLine({ ...base, stars: 0 })).toBe('You got 18 right.');
  });

  it('never adds a star word outside mission mode', () => {
    for (const mode of ['endless', 'sprint', 'boss'] as Mode[]) expect(scoreLine({ ...base, mode })).toBe('You got 18 right.');
  });
});

/**
 * #897: a pre-reader tapping straight into a topic mission hears its name, folded into the SAME utterance as
 * the first question so a separate, earlier `say()` cannot be cancelled by it (the same reasoning `duel.ts`'s
 * `spokenQuestion` hand-over already follows).
 */
describe('firstQuestionLine', () => {
  const topic = { title: 'Number Bonds' } as Topic;
  const q = { prompt: '2 + 2', say: undefined } as unknown as Question;

  it('folds the topic title into question 1 of a topic mission, title first', () => {
    expect(firstQuestionLine(q, topic, true, false)).toBe('Number Bonds! 2 + 2');
  });

  it('prefers q.say over q.prompt, same as every other question utterance', () => {
    const spoken = { prompt: '2 + 2', say: 'Two plus two' } as unknown as Question;
    expect(firstQuestionLine(spoken, topic, true, false)).toBe('Number Bonds! Two plus two');
  });

  it('returns the plain prompt for every question after the first', () => {
    expect(firstQuestionLine(q, topic, false, false)).toBe('2 + 2');
  });

  it('returns the plain prompt with no topic — every pool-driven mode (training, Storm, Sprint, Boss)', () => {
    expect(firstQuestionLine(q, undefined, true, false)).toBe('2 + 2');
  });

  it('returns the plain prompt on a "Fix my mistakes" replay, even of a topic mission\'s own first question', () => {
    expect(firstQuestionLine(q, topic, true, true)).toBe('2 + 2');
  });
});
