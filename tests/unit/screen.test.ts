import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resultsModal, screenScope, stickersHTML, type ResultsModalParts } from '../../src/ui/screen';

// `screenScope()` reaches for `window.setTimeout` and `performance.now()` and nothing else until `toast()` or
// `dispose()` is called, neither of which the beat rails below touch. Stubbed the same way
// `play-session.test.ts` stubs the speech engine: after the imports, because only the calls inside the tests
// need it.
(globalThis as any).window = globalThis;

// A minimal, memory-style parts object (no boss K.O., no certificate, no extra hero classes).
const base: ResultsModalParts = {
  glow: '#40c4ff', img: '/avatars/kai.webp', name: 'Kai', headline: 'Great job!',
  medal: '🥇', heading: 'All pairs found!',
  stars: 3,
  stats: '<div><b>120</b><small>score</small></div>',
  coins: 8,
  dojoRows: '', stickerHTML: '',
};

describe('resultsModal (#35 — the shared end-of-run modal shell)', () => {
  it('always renders the modal shell and the Play again / Islands buttons', () => {
    const h = resultsModal(base);
    expect(h).toContain('<div class="modal results">');
    expect(h).toContain('<button class="btn primary big" id="again">Play again</button>');
    expect(h).toContain('<button class="btn big" id="home">Islands</button>');
  });

  it('the medal, heading, stat grid and coin gain come straight from the slots', () => {
    const h = resultsModal(base);
    expect(h).toContain('<div class="medal">🥇</div>');
    expect(h).toContain('<h2>All pairs found!</h2>');
    expect(h).toContain('<div class="statgrid"><div><b>120</b><small>score</small></div></div>');
    expect(h).toContain('<span class="coin-gain">+8 🪙</span>');
  });

  it('escapes the headline in the speech bubble', () => {
    const h = resultsModal({ ...base, headline: '5 < 8 rocks' });
    expect(h).toContain('5 &lt; 8 rocks');
    expect(h).not.toContain('5 < 8 rocks');
  });

  it('a bare hero has no trailing class, an extra class is appended verbatim', () => {
    expect(resultsModal(base)).toContain('<div class="hero-big" style="--glow:#40c4ff">');
    expect(resultsModal({ ...base, heroExtra: ' sad' })).toContain('<div class="hero-big sad" style');
    expect(resultsModal({ ...base, heroExtra: ' sensei' })).toContain('<div class="hero-big sensei" style');
  });

  it('shows the star row when a star count is given and hides it when omitted', () => {
    expect(resultsModal({ ...base, stars: 2 })).toContain('<div class="big-stars">');
    expect(resultsModal({ ...base, stars: undefined })).not.toContain('big-stars');
  });

  it('the K.O. banner and the certificate button appear only when their slots are set', () => {
    const plain = resultsModal(base);
    expect(plain).not.toContain('class="ko"');
    expect(plain).not.toContain('id="cert"');
    const boss = resultsModal({ ...base, ko: '<div class="ko" aria-hidden="true"><b>K.O.</b></div>', cert: true });
    expect(boss).toContain('<div class="ko" aria-hidden="true"><b>K.O.</b></div>');
    expect(boss).toContain('id="cert"');
  });

  it('appends pills after the coin gain (new best, day streak)', () => {
    const h = resultsModal({ ...base, pills: '<span class="best-pill">🏆 New best!</span>' });
    expect(h).toContain('<span class="coin-gain">+8 🪙</span><span class="best-pill">🏆 New best!</span>');
  });
});

describe('stickersHTML (#35)', () => {
  it('renders nothing for an empty unlock list', () => {
    expect(stickersHTML([])).toBe('');
  });
  it('renders one unlock card per freshly earned avatar', () => {
    const h = stickersHTML(['kai']);
    expect(h).toContain('New sticker!');
    expect((h.match(/class="unlock"/g) ?? []).length).toBe(1);
  });
});

// #301: a pause pressed inside the ~1 s outcome hold used to let every scheduled beat fire behind the overlay —
// `clearWave`, the wave end, the round advance, then the next question rendered, spoken and its wave spawned with
// `launchAt` already in the past. Both game screens paused their ARENA and neither could hold a timer it had
// already handed to the browser, so the hold lives here, and these are the rails for it. Driven with fake
// timers rather than through a screen: the bug is arithmetic about remaining time, and a browser cannot be
// asked "how much of that timeout is left".
describe('screenScope beats freeze under a hold (#301)', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }); });
  afterEach(() => { vi.useRealTimers(); });

  it('a held beat does not fire, however long the hold lasts', () => {
    const scope = screenScope();
    const fired: string[] = [];
    scope.later(() => fired.push('advance'), 1000);
    vi.advanceTimersByTime(900);
    scope.holdTimers(true);
    // Ten times the beat's own length. This is the actual symptom: the round advanced and the next wave flew
    // while the child was looking at the pause overlay.
    vi.advanceTimersByTime(10_000);
    expect(fired, 'nothing runs behind the overlay').toEqual([]);
  });

  it('a re-armed beat runs the time it had LEFT, not its whole length again', () => {
    const scope = screenScope();
    const fired: string[] = [];
    scope.later(() => fired.push('advance'), 1000);
    vi.advanceTimersByTime(900);
    scope.holdTimers(true);
    vi.advanceTimersByTime(5000);
    scope.holdTimers(false);
    // 100ms left of the 1000, not another 1000: re-arming at full length would stretch every pause into an
    // extra outcome hold, which is a different bug in the same place.
    vi.advanceTimersByTime(99);
    expect(fired).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(fired).toEqual(['advance']);
  });

  it('holds every pending beat, each with its own remainder, and in the order they come due', () => {
    const scope = screenScope();
    const fired: string[] = [];
    scope.later(() => fired.push('clearWave'), 400);
    scope.later(() => fired.push('waveEnd'), 900);
    scope.later(() => fired.push('results'), 1200);
    vi.advanceTimersByTime(300);
    scope.holdTimers(true);
    vi.advanceTimersByTime(3000);
    expect(fired).toEqual([]);
    scope.holdTimers(false);
    vi.advanceTimersByTime(100);
    expect(fired).toEqual(['clearWave']);
    vi.advanceTimersByTime(500);
    expect(fired).toEqual(['clearWave', 'waveEnd']);
    vi.advanceTimersByTime(300);
    expect(fired).toEqual(['clearWave', 'waveEnd', 'results']);
  });

  it('a second hold does not re-measure what is already frozen', () => {
    const scope = screenScope();
    const fired: string[] = [];
    scope.later(() => fired.push('advance'), 1000);
    vi.advanceTimersByTime(900);
    scope.holdTimers(true);
    vi.advanceTimersByTime(5000);
    // The screens guard this themselves, but a scope that re-measured here would set the remainder to 0 and
    // fire the beat the instant the overlay closed — the bug back, by a different road.
    scope.holdTimers(true);
    scope.holdTimers(false);
    vi.advanceTimersByTime(99);
    expect(fired).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(fired).toEqual(['advance']);
  });

  it('a beat armed WHILE held is frozen too, and starts its full length on resume', () => {
    const scope = screenScope();
    const fired: string[] = [];
    scope.holdTimers(true);
    scope.later(() => fired.push('late'), 500);
    vi.advanceTimersByTime(5000);
    expect(fired, 'a beat scheduled by the overlay itself is not the one thing still running behind it').toEqual([]);
    scope.holdTimers(false);
    vi.advanceTimersByTime(499);
    expect(fired).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(fired).toEqual(['late']);
  });

  it('an unheld scope is unchanged: a beat still fires on time, and once', () => {
    const scope = screenScope();
    const fired: string[] = [];
    scope.later(() => fired.push('advance'), 1000);
    vi.advanceTimersByTime(999);
    expect(fired).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(fired).toEqual(['advance']);
    // And a hold AFTER it fired does not resurrect it — the beat list must drop what it has run.
    scope.holdTimers(true); scope.holdTimers(false);
    vi.advanceTimersByTime(10_000);
    expect(fired).toEqual(['advance']);
  });
});
