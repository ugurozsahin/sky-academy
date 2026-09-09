import { afterEach, describe, expect, it } from 'vitest';
import { gameSpeed, initGameSpeed, scaled, setGameSpeed } from '../../src/game/speed';

// #32: the test-only time compression. The child's game must always run at speed 1 — the multiplier is
// reachable only through an explicit `?fast=N`, the `window.__SNA_FAST` harness global, or `setSpeed()`.
afterEach(() => setGameSpeed(1));   // module state: never leak a speed into the next test

describe('game speed (#32)', () => {
  it('defaults to 1, and scaled() is a no-op at speed 1', () => {
    expect(gameSpeed()).toBe(1);
    expect(scaled(1000)).toBe(1000);
  });

  it('divides durations by the multiplier', () => {
    setGameSpeed(4);
    expect(gameSpeed()).toBe(4);
    expect(scaled(1000)).toBe(250);
    expect(scaled(1800)).toBe(450);
  });

  it('never runs the game slower than real time (clamps below 1, rejects rubbish)', () => {
    expect(setGameSpeed(0.5)).toBe(1);
    expect(setGameSpeed(0)).toBe(1);
    expect(setGameSpeed(-3)).toBe(1);
    expect(setGameSpeed(NaN)).toBe(1);
    expect(setGameSpeed(Infinity)).toBe(1);
    expect(gameSpeed()).toBe(1);
  });

  it('reads `?fast=N` from the query string', () => {
    expect(initGameSpeed('?fast=4')).toBe(4);
    expect(gameSpeed()).toBe(4);
    expect(initGameSpeed('?fast=2.5&other=1')).toBe(2.5);
  });

  it('stays at 1 with no query parameter (a child can never trigger it)', () => {
    setGameSpeed(4);                      // even if a previous screen set it
    expect(initGameSpeed('')).toBe(1);    // no ?fast, no window global in vitest
    expect(initGameSpeed('?reset=1')).toBe(1);
    expect(gameSpeed()).toBe(1);
  });
});
