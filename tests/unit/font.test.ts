import { afterEach, describe, expect, it, vi } from 'vitest';
import { FONT_PROBE, fontReady, resetFontReady } from '../../src/ui/font';

// #44: the canvas font gate. The behaviour that matters is the awkward one: before Google's stylesheet is
// parsed the document's font set is empty, and an empty set answers check() with TRUE. A gate that trusted
// check() would therefore report "ready" at exactly the moment the font is NOT ready, which is the bug.

/** A stand-in for FontFaceSet: starts empty, gains a Fredoka face when the "stylesheet" is parsed. */
function fakeFonts(o: { faces?: string[]; check?: boolean; load?: () => Promise<unknown> } = {}) {
  const faces = o.faces ?? [];
  return {
    set: (f: string) => faces.push(f),
    fonts: {
      forEach: (fn: (f: { family: string }) => void) => faces.forEach(family => fn({ family })),
      load: o.load ?? (() => Promise.resolve([])),
      check: () => o.check ?? true,
    } as unknown as FontFaceSet,
  };
}

afterEach(() => { resetFontReady(); vi.useRealTimers(); });

describe('canvas font readiness (#44)', () => {
  it('probes a real Fredoka face, not a bare family name', () => {
    expect(FONT_PROBE).toMatch(/^\d+ \d+px "Fredoka"$/);
  });

  it('resolves true once a Fredoka face is declared and loads', async () => {
    const f = fakeFonts({ faces: ['Fredoka'], check: true });
    await expect(fontReady(1000, f.fonts)).resolves.toBe(true);
  });

  it('does NOT report ready while the font set is still empty — the empty-set check() trap', async () => {
    const f = fakeFonts({ faces: [], check: true });   // check() says true, but nothing is declared yet
    await expect(fontReady(120, f.fonts)).resolves.toBe(false);
  });

  it('waits for a face that arrives late, then reports ready', async () => {
    const f = fakeFonts({ faces: [], check: true });
    setTimeout(() => f.set('"Fredoka"'), 60);         // the stylesheet lands mid-wait; quoted family too
    await expect(fontReady(2000, f.fonts)).resolves.toBe(true);
  });

  it('gives up rather than holding the game back for ever (stylesheet never parses)', async () => {
    const started = Date.now();
    await expect(fontReady(100, fakeFonts({ faces: [] }).fonts)).resolves.toBe(false);
    expect(Date.now() - started).toBeLessThan(1500);
  });

  // The case the first version of this gate got wrong, and the one that actually matters. Google's stylesheet
  // is ~1 kB and lands fast, so `declared()` flips almost at once; it is the woff2 behind it that crawls on a
  // slow connection. A cap that only bounded the polling loop left `fonts.load()` unbounded — and a stalled
  // socket neither completes nor errors, so the child got a question card with no bubbles and no read-aloud,
  // for ever. That is a regression from "labels look wrong" to "the round never starts", on exactly the
  // connection #44 is about. The deadline must cover the load, not just the wait for the declaration.
  it('gives up even when the face IS declared and load() never settles (#139 review)', async () => {
    const started = Date.now();
    const f = fakeFonts({ faces: ['Fredoka'], load: () => new Promise(() => { /* never settles */ }) });
    await expect(fontReady(100, f.fonts)).resolves.toBe(false);
    expect(Date.now() - started, 'the cap must bound the load, not only the declaration wait').toBeLessThan(1500);
  });

  it('reports false, never throws, when load() rejects', async () => {
    const f = fakeFonts({ faces: ['Fredoka'], load: () => Promise.reject(new Error('offline')) });
    await expect(fontReady(500, f.fonts)).resolves.toBe(false);
  });

  it('resolves at once where there is no Font Loading API at all', async () => {
    await expect(fontReady(5000, undefined)).resolves.toBe(true);
  });

  it('caches: the font loads once a page, so later screens do not wait again', async () => {
    const load = vi.fn(() => Promise.resolve([]));
    const f = fakeFonts({ faces: ['Fredoka'], check: true, load });
    await fontReady(1000, f.fonts);
    await fontReady(1000, f.fonts);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
