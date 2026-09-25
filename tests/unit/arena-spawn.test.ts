// The wrap from #348 reaching a pixel (PR #467 review, B2). `fitLabelLines` is pure and tested directly in
// `arena.test.ts`, but nothing stood between the fit and the screen: three one-line edits — drawing only
// `lines[0]`, dropping the recentring, or having `spawnWave` push `[p.label]` instead of the fitted lines —
// each reverted the whole feature with the suite green. This file builds a real `Arena` on a stub canvas and
// 2D context, spawns a wave and draws one frame, so the assertions are on the calls the canvas received.
//
// The stubs are hand-built rather than jsdom: jsdom is not a dependency of this project and `CLAUDE.md`'s
// allowlist rail is the reason not to make it one for nine tests. Only what `Arena` actually touches is
// faked, so a constructor that starts reaching for more of the DOM fails here loudly rather than silently.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Arena, type Bubble } from '../../src/game/arena';

/** The per-character factor #348 measured for Fredoka bold (`a three-quarter turn`, 109.6px at fs 9.6). */
const PER_CHAR = 0.571;
const W = 390, H = 600;
const sizeOf = (font: string) => parseFloat(font.match(/([\d.]+)px/)?.[1] ?? '0');

type TextCall = { op: 'fill' | 'stroke'; text: string; x: number; y: number; fs: number };
let texts: TextCall[] = [];

/** Everything `render`/`drawBubble`/the sprite bakers touch, recording only the text calls this file is about. */
function stubCtx() {
  const ctx: Record<string, unknown> = {
    font: '', textAlign: '', textBaseline: '', lineJoin: '', lineWidth: 0,
    fillStyle: '', strokeStyle: '', globalAlpha: 1, globalCompositeOperation: '',
    measureText: (t: string) => ({ width: sizeOf(String(ctx.font)) * t.length * PER_CHAR }),
    fillText: (t: string, x: number, y: number) => { texts.push({ op: 'fill', text: t, x, y, fs: sizeOf(String(ctx.font)) }); },
    strokeText: (t: string, x: number, y: number) => { texts.push({ op: 'stroke', text: t, x, y, fs: sizeOf(String(ctx.font)) }); },
    createRadialGradient: () => ({ addColorStop: () => {} }),
    setTransform: () => {}, clearRect: () => {}, save: () => {}, restore: () => {},
    translate: () => {}, rotate: () => {}, scale: () => {}, drawImage: () => {},
    beginPath: () => {}, closePath: () => {}, arc: () => {}, ellipse: () => {},
    moveTo: () => {}, lineTo: () => {}, stroke: () => {}, fill: () => {}, fillRect: () => {},
  };
  return ctx;
}

const stubCanvas = (ctx: unknown) => ({
  width: 0, height: 0,
  getContext: () => ctx,
  getBoundingClientRect: () => ({ width: W, height: H, left: 0, top: 0, right: W, bottom: H }),
  addEventListener: () => {}, removeEventListener: () => {},
}) as unknown as HTMLCanvasElement;

const saved: Record<string, unknown> = {};
const g = globalThis as unknown as Record<string, unknown>;

let ctx: Record<string, unknown>;
let arenas: Arena[] = [];

beforeEach(() => {
  texts = []; arenas = []; ctx = stubCtx();
  for (const k of ['window', 'document', 'requestAnimationFrame', 'cancelAnimationFrame']) saved[k] = g[k];
  g.window = { addEventListener: () => {}, removeEventListener: () => {}, devicePixelRatio: 1 };
  // The offscreen sprite canvases (`glowSprite`, `bodySprite`) come through here.
  g.document = { createElement: () => stubCanvas(ctx) };
  // A no-op rAF: the loop never runs itself, so every frame in this file is one drawn on purpose.
  g.requestAnimationFrame = () => 0;
  g.cancelAnimationFrame = () => {};
});

afterEach(() => {
  for (const a of arenas) a.destroy();
  for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete g[k]; else g[k] = saved[k]; }
});

const arenaWith = (labels: string[], wide = true) => {
  const arena = new Arena(stubCanvas(ctx), { onHit: () => {}, onFall: () => {}, onWaveEnd: () => {} });
  arenas.push(arena);
  arena.spawnWave({ labels, speed: 2, wide });
  return arena;
};
/** Draw one frame with every bubble in flight — `render` skips anything not launched. */
const drawOnce = (arena: Arena) => {
  for (const b of arena.bubbles) b.launched = true;
  (arena as unknown as { render: (now: number) => void }).render(1000);
};
const find = (arena: Arena, label: string): Bubble => {
  const b = arena.bubbles.find(x => x.label === label);
  if (!b) throw new Error(`no bubble for "${label}" — the wave did not spawn what this test measures`);
  return b;
};

describe('spawnWave carries the fit onto the bubble (#348 / PR #467 B2)', () => {
  it('stores the wrapped lines, not the raw label, for a label #348 squeezed', () => {
    const b = find(arenaWith(['£1 and 50p', '£2', '50p']), '£1 and 50p');
    expect(b.lines).toEqual(['£1 and', '50p']);       // `lines: [p.label]` at the push site fails here
    expect(b.label).toBe('£1 and 50p');               // …and the answer key is untouched by the wrap
    expect(b.fontSize).toBeGreaterThan(13);
  });

  it('leaves a comfortable label on one line, and records how each bubble came out', () => {
    const arena = arenaWith(["9 o'clock", '£2', '50p']);
    expect(find(arena, "9 o'clock").lines).toEqual(["9 o'clock"]);
    expect(find(arena, "9 o'clock").labelState).toBe('ok');
    expect(find(arena, '£2').labelState).toBe('ok');
  });

  it('marks a bubble whose label could not be rescued, so the state is readable from outside', () => {
    const b = find(arenaWith(['a three-quarter turn', 'a half turn']), 'a three-quarter turn');
    expect(b.lines).toHaveLength(2);
    expect(b.labelState).not.toBe('ok');
  });
});

describe('drawBubble puts every fitted line on the canvas (#348 / PR #467 B2)', () => {
  // Every label in these waves produces distinct line texts, so a draw call identifies its bubble without
  // depending on the order `layoutWave` shuffled them into — which is `Math.random` and not seeded here.
  it('draws both lines of a wrapped label, stroked and filled', () => {
    const arena = arenaWith(['twenty-five', '£2', '12']);
    drawOnce(arena);
    for (const op of ['stroke', 'fill'] as const) {
      const drawn = texts.filter(t => t.op === op).map(t => t.text);
      expect(drawn).toContain('twenty-');
      expect(drawn).toContain('five');                // drawing only `lines[0]` loses this
      expect(drawn).not.toContain('twenty-five');     // the unwrapped label is never drawn
    }
  });

  it('centres the block of lines on the disc instead of hanging it off the bottom', () => {
    const arena = arenaWith(['twenty-five', '£2', '12']);
    drawOnce(arena);
    const first = texts.find(t => t.op === 'fill' && t.text === 'twenty-')!;
    const second = texts.find(t => t.op === 'fill' && t.text === 'five')!;
    expect(first.fs).toBe(second.fs);
    // Both lines are drawn in the bubble's own local space, origin at the centre. Centred means they
    // straddle it, with their midpoint on the single line's baseline of 2. `top = 2` — the recentring
    // dropped — puts the first line on 2 and the second below it, which every assertion here rejects.
    expect(first.y).toBeLessThan(2);
    expect(second.y).toBeGreaterThan(2);
    expect((first.y + second.y) / 2).toBeCloseTo(2, 5);
    expect(second.y - first.y).toBeCloseTo(first.fs * 1.02, 5);
  });

  it('draws a one-line label on the single baseline, exactly as before the wrap existed', () => {
    const arena = arenaWith(['£2', '50p', '£5']);
    drawOnce(arena);
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) expect(t.y).toBe(2);
  });
});

describe('warnUnfitLabel says so out loud when a label does not fit (#348 / #495)', () => {
  // #495: the fitted lines and state reach the bubble (tested above) but nothing pinned the diagnostic
  // itself — `warnUnfitLabel`'s call site could be deleted, moved above the `state === 'ok'` guard, or
  // passed the wrong fit, and the suite stayed green throughout. These two tests read `console.warn`
  // directly, so they catch a call site removed as well as a guard inverted the wrong way.
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => { warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { warnSpy.mockRestore(); });

  it('warns once for a label that does not fit its bubble', () => {
    // A label this repo's tests have never spawned before (#348's own dedupe is keyed on label+radius+state,
    // so reusing 'a three-quarter turn' here would silently inherit an earlier test's warning).
    const label = 'a whole entire year and then a bit more besides';
    arenaWith([label, '£2', '50p']);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain(label);
  });

  it('warns not at all for a wave of comfortable labels', () => {
    arenaWith(["9 o'clock", '£2', '50p']);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // #348 has a second call site: `reveal()` fits and warns for the "good answer" bubble it respawns when
  // the wave never launched one. That call site is a separate deletion risk from `spawnWave`'s (above) and
  // was still untested — reviewed independently by two agents on this PR.
  it('warns once when reveal() respawns a "good answer" bubble that does not fit', () => {
    const arena = new Arena(stubCanvas(ctx), { onHit: () => {}, onFall: () => {}, onWaveEnd: () => {} });
    arenas.push(arena);
    const label = 'this particular good answer will not fit any bubble either';
    arena.reveal({ good: label });
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain(label);
  });
});
