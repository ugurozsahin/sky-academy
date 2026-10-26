import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { watchBox } from '../../src/game/box-watch';

// #678: a deterministic fake ResizeObserver + a manual rAF queue, so the batching and the loop guard are asserted
// without a browser. The env is Node, so `window`, `ResizeObserver` and `requestAnimationFrame` are stubbed here.
class FakeRO {
  static all: FakeRO[] = [];
  observed: unknown[] = []; disconnected = false;
  constructor(public cb: () => void) { FakeRO.all.push(this); }
  observe(el: unknown) { this.observed.push(el); }
  disconnect() { this.disconnected = true; }
  fire() { this.cb(); }
}
let frames: (() => void)[] = [], winListeners: Record<string, Set<() => void>> = {};
const flush = () => { const f = frames; frames = []; f.forEach(fn => fn()); };
const box = { w: 100, h: 50 };
const el = { getBoundingClientRect: () => ({ width: box.w, height: box.h }) } as unknown as HTMLElement;

beforeEach(() => {
  FakeRO.all = []; frames = []; winListeners = {}; box.w = 100; box.h = 50;
  vi.stubGlobal('ResizeObserver', FakeRO);
  vi.stubGlobal('requestAnimationFrame', (fn: () => void) => frames.push(fn));
  vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
  vi.stubGlobal('window', {
    addEventListener: (t: string, f: () => void) => (winListeners[t] ??= new Set()).add(f),
    removeEventListener: (t: string, f: () => void) => winListeners[t]?.delete(f),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('watchBox — re-measure when the element\'s own box changes (#678)', () => {
  it('calls back once, on the next frame, when the observed box changes height with no window resize', () => {
    const onChange = vi.fn();
    watchBox(el, onChange);
    expect(FakeRO.all[0].observed).toEqual([el]);
    box.h = 141;
    FakeRO.all[0].fire(); FakeRO.all[0].fire(); FakeRO.all[0].fire();   // three notifications in one frame...
    expect(onChange).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);                                     // ...batch to one frame request
    flush();
    expect(onChange).toHaveBeenCalledTimes(1);                          // ...and one call
  });

  it('does not call back when the observer fires for a box that has not changed (no feedback loop)', () => {
    const onChange = vi.fn();
    watchBox(el, onChange);
    FakeRO.all[0].fire(); flush();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('two duel halves a sub-pixel apart (194.390625 vs 194.375) are not re-measured, so they keep identical waves (#389/#400)', () => {
    const calls: string[] = [];
    for (const h of [194.375, 194.390625]) {
      const half = { getBoundingClientRect: () => ({ width: 390, height: 194.375 }) } as unknown as HTMLElement;
      watchBox(half, () => calls.push('measured'));
      FakeRO.all[FakeRO.all.length - 1].fire();
      (half as unknown as { getBoundingClientRect: () => object }).getBoundingClientRect = () => ({ width: 390, height: h });
      FakeRO.all[FakeRO.all.length - 1].fire();
    }
    flush();
    expect(calls).toEqual([]);                                          // neither half re-derived g from its own sub-pixel H
    box.h = 50.015; const onChange = vi.fn(); watchBox(el, onChange); box.h = 51.5;
    FakeRO.all[FakeRO.all.length - 1].fire(); flush();
    expect(onChange).toHaveBeenCalledTimes(1);                          // a real change (>= 1px) still does
  });

  it('settles after the callback itself moves the box: one extra pass at most, then silence', () => {
    let calls = 0;
    watchBox(el, () => { calls++; });
    box.h = 70; FakeRO.all[0].fire(); flush();
    FakeRO.all[0].fire(); flush();                                      // the observer reports our own change back
    expect(calls).toBe(1);
  });

  it('still re-measures on a window resize, synchronously', () => {
    const onChange = vi.fn();
    watchBox(el, onChange);
    box.w = 300;
    winListeners.resize.forEach(f => f());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('teardown disconnects the observer, drops the window listener and cancels a pending frame', () => {
    const onChange = vi.fn();
    const stop = watchBox(el, onChange);
    box.h = 99; FakeRO.all[0].fire();
    stop();
    flush();
    expect(FakeRO.all[0].disconnected).toBe(true);
    expect(winListeners.resize.size).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('works where there is no ResizeObserver: the window listener alone', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const onChange = vi.fn();
    const stop = watchBox(el, onChange);
    winListeners.resize.forEach(f => f());
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    expect(winListeners.resize.size).toBe(0);
  });
});

describe('watchBox also follows the visual viewport (#2184)', () => {
  it('re-measures when a toolbar resizes the visual viewport and the box moved, not when it did not, and lets go on teardown', () => {
    const vv: Record<string, Set<() => void>> = {};
    vi.stubGlobal('window', {
      addEventListener: (t: string, f: () => void) => (winListeners[t] ??= new Set()).add(f),
      removeEventListener: (t: string, f: () => void) => winListeners[t]?.delete(f),
      visualViewport: { addEventListener: (t: string, f: () => void) => (vv[t] ??= new Set()).add(f), removeEventListener: (t: string, f: () => void) => vv[t]?.delete(f) },
    });
    const onChange = vi.fn();
    const stop = watchBox(el, onChange);
    vv.resize.forEach(f => f());                                        // a pinch-zoom frame: the box is unchanged
    expect(onChange).not.toHaveBeenCalled();
    box.h = 40;                                                         // the toolbar came back
    vv.resize.forEach(f => f());
    expect(onChange, 'synchronously, so --vh (registered first) is already current').toHaveBeenCalledTimes(1);
    stop();
    expect(vv.resize.size).toBe(0);
  });
});

describe('Arena and Tracer take the same trigger and release it on teardown (#678)', () => {
  const src = (f: string) => readFileSync(new URL(`../../src/game/${f}`, import.meta.url), 'utf8');
  it.each(['arena.ts', 'tracing.ts'])('%s watches its own canvas and unwatches in destroy()', f => {
    const t = src(f);
    expect(t).toMatch(/this\.unwatch = watchBox\(canvas, this\.resize\)/);
    expect(t).toMatch(/destroy\(\) \{[\s\S]*?this\.unwatch\(\)/);
    expect(t).not.toMatch(/addEventListener\('resize'/);                // the one trigger is watchBox, not a second window listener
  });
});

describe('Arena measures whole CSS pixels, so two duel halves a sub-pixel apart derive the same wave (#389/#400)', () => {
  it('rounds the measured width and height before g and vy are derived from them', () => {
    const t = readFileSync(new URL('../../src/game/arena.ts', import.meta.url), 'utf8');
    expect(t).toMatch(/this\.W = Math\.max\(1, Math\.round\(rect\.width\)\); this\.H = Math\.max\(1, Math\.round\(rect\.height\)\)/);
  });
});

describe('main.ts keeps --vh current as the visual viewport changes (#2184, #2189)', () => {
  it('registers setVH on the window and on visualViewport resize, before any arena exists', () => {
    const t = readFileSync(new URL('../../src/main.ts', import.meta.url), 'utf8');
    expect(t).toMatch(/window\.addEventListener\('resize', setVH\)/);
    expect(t).toMatch(/window\.visualViewport\?\.addEventListener\('resize', setVH\)/);
    expect(t).toMatch(/setProperty\('--vh'/);
  });
});
