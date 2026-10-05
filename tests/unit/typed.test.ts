// Typed answers from the number pad reach the Session (#1119).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { differentNumber, sameNumber } from '../../src/game/typed';
import { setGameSpeed } from '../../src/game/speed';
import { inputFor } from '../../src/ui/play-input';
import { AVATARS } from '../../src/avatars';
import { YEARS, type Question } from '../../src/curriculum';
import { createPlaySession, type PlaySessionDeps, type PlaySessionEls } from '../../src/ui/play-session';

describe('sameNumber', () => {
  it('ignores commas and spaces', () => { expect(sameNumber('1,000', '1000')).toBe(true); expect(sameNumber('1000', '1,000')).toBe(true); expect(sameNumber(' 12 ', '12')).toBe(true); });
  it('treats - and U+2212 alike', () => { for (const a of ['-3', '−3']) for (const b of ['-3', '−3']) expect(sameNumber(a, b)).toBe(true); expect(sameNumber('3', '−3')).toBe(false); });
  it('compares exact decimal values without floats', () => {
    expect(sameNumber('3.50', '3.5')).toBe(true); expect(sameNumber('007', '7')).toBe(true); expect(sameNumber('0.1', '.10')).toBe(true);
    expect(sameNumber('-0', '0')).toBe(true); expect(sameNumber('9007199254740993', '9007199254740992')).toBe(false);
  });
  it('is false for a different number or anything that is not one', () => {
    expect(sameNumber('12', '21')).toBe(false);
    for (const t of ['', '-', '.', '1.2.3', 'abc', '1e3', '--3']) expect(sameNumber(t, '3'), JSON.stringify(t)).toBe(false);
    expect(sameNumber('3', 'three')).toBe(false);
  });
});

describe('differentNumber', () => {
  it('is never the answer', () => { for (const a of ['0', '1', '7', '−3', '1,000', '0.0']) expect(sameNumber(differentNumber(a), a), a).toBe(false); });
});

describe('inputFor: ?input=keypad is a test hook (#1119)', () => {
  afterEach(() => { setGameSpeed(1); vi.unstubAllGlobals(); });
  it('is ignored at speed 1, which a child always plays at', () => {
    vi.stubGlobal('location', { search: '?input=keypad' });
    expect(inputFor({})).toBe('bubbles');
  });
  it('opens the pad at test speed, but never over an explicit input', () => {
    vi.stubGlobal('location', { search: '?fast=8&input=keypad' }); setGameSpeed(8);
    expect(inputFor({})).toBe('keypad');
    expect(inputFor({ input: 'tracing' })).toBe('tracing');
    vi.stubGlobal('location', { search: '?fast=8' });
    expect(inputFor({})).toBe('bubbles');
  });
});

describe('a keypad screen (no arena) moves on after every outcome (#1119)', () => {
  const el = () => new Proxy({ classList: { add() {}, remove() {}, contains: () => false, toggle: () => false }, setAttribute() {}, getBoundingClientRect: () => ({ bottom: 0 }) } as Record<string, unknown>, { set: (o, k, v) => { o[k as string] = v; return true; } });
  function build() {
    const starts: Question[] = []; let wrongHeard = 0;
    const deps = {
      training: false, tracing: false, villain: false, av: AVATARS[0], els: { score: el(), stage: el(), prompt: el(), vis: el(), hint: el(), qcard: el(), speak: el() } as unknown as PlaySessionEls,
      hud: { drawLives() {}, drawTimer() {}, drawHp() {}, showOutcome() {}, speakCorrection() { wrongHeard++; } },
      hold: { correct: 900, wrong: 1200, miss: 900 }, arena: () => null, mounted: () => true,
      later: (fn: () => void, ms: number) => { setTimeout(fn, ms); }, holdTimers() {}, toast() {},
      startTrace() { throw new Error('a keypad screen is not tracing'); }, startPad: (q: Question) => { starts.push(q); },
      showTutorial: () => 0, showTaunt() {}, showStageClear() {}, commitResult: () => ({}) as never, showResults() {},
    } as PlaySessionDeps;
    const topic = { id: 't', title: 't', icon: 't', subject: 'maths', year: 'year2', nc: '', gen: () => ({}) as Question, input: 'keypad' } as never;
    const deck = Array.from({ length: 8 }, (_, i) => ({ topic, q: { prompt: `${i + 2} × 3`, answer: String((i + 2) * 3), options: [] } as Question }));
    const ps = createPlaySession({ mode: 'mtc', year: YEARS[2], deck }, deps);
    return { ps, starts, wrongHeard: () => wrongHeard };
  }
  it('starts each card on the pad; a wrong, a right and a timed-out card all advance on their own', async () => {
    vi.useFakeTimers();
    try {
      const { ps, starts } = build(); const s = ps.session;
      s.start(); expect(starts.length).toBe(1);
      expect(s.hit('0')).toBe('wrong'); await vi.advanceTimersByTimeAsync(3000); expect(starts.length, 'wrong').toBe(2);
      expect(s.hit(s.current!.answer)).toBe('correct'); await vi.advanceTimersByTimeAsync(3000); expect(starts.length, 'right').toBe(3);
      s.hit(s.current!.answer); await vi.advanceTimersByTimeAsync(3000);   // the three practice cards carry no clock; the fourth does
      expect(starts.length).toBe(4);
      s.armQuestionClock(ms => ms); expect(s.questionLeft, 'the clock is armed').toBeGreaterThan(0);
      s.tick(60000); await vi.advanceTimersByTimeAsync(3000);
      expect(starts.length, 'timed out').toBe(5);
    } finally { vi.useRealTimers(); }
  });
});
