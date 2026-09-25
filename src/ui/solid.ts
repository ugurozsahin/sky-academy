// The rotating 3-D solid on a 3-D Shapes question card (#684): which questions get one, and the one lazy
// renderer per play screen that shows it. `three` itself lives behind a dynamic `import()` of
// `src/three/mount/solids.ts`, so this file — and the main chunk it is part of — never carries it; the rails
// in `tests/unit/guardrails.test.ts` hold that line. The spike's cost and the owner's verdict are on the issue.
import type { Question } from '../curriculum';
import { SHAPES_3D } from '../curriculum/util';
import type { SolidName, SolidView, SpinSheet } from '../three/mount/solids';

/** The two topics whose question side shows a real solid; every other topic keeps its emoji. */
export const SOLID_TOPICS: ReadonlySet<string> = new Set(['y1-shapes3d', 'y2-shapes']);

/** The solids `src/three/mount/solids.ts` can build. `SHAPES_3D` (curriculum data, unchanged by #684) is checked
 *  against this list by `tests/unit/solid.test.ts`, so a new or respelt row there fails a test rather than
 *  throwing inside the renderer mid-mission. */
export const SOLID_NAMES: readonly SolidName[] = ['cube', 'cuboid', 'sphere', 'cylinder', 'cone', 'pyramid'];
const isSolidName = (n: string): n is SolidName => (SOLID_NAMES as readonly string[]).includes(n);
const NAME_BY_GLYPH = new Map<string, SolidName>(SHAPES_3D.flatMap(([g, name]) => isSolidName(name) ? [[g, name] as const] : []));
const GLYPH_BY_NAME = new Map<SolidName, string>([...NAME_BY_GLYPH].map(([g, n]) => [n, g]));

/** The solid `q` shows, or null: only on a 3-D Shapes topic, only a word visual that is exactly one `SHAPES_3D` glyph. */
export function solidNameFor(q: Question, topicId: string | undefined): SolidName | null {
  if (!topicId || !SOLID_TOPICS.has(topicId) || q.visual?.type !== 'word') return null;
  return NAME_BY_GLYPH.get(q.visual.text) ?? null;
}

/**
 * What the `window.__sna.solid()` hook reports: the solid named, frames drawn so far, and whether WebGL came
 * up. `error` says why not when it did not — a renderer that refused to start and a chunk that failed to
 * download both keep the emoji, but they are different bugs to chase (silent-failure review of the spike).
 */
export interface SolidState { name: SolidName; frames: number; webgl: boolean; error: 'no-webgl' | 'load-failed' | 'built-off' | null }
/** What `window.__sna.solidArt()` reports: which solids have a baked spin sheet, and how many bubble frames drew one. */
export interface SolidArtState { ready: SolidName[]; draws: number; error: SolidState['error'] }
export interface SolidSlot {
  /** Called after every question is rendered into the card: mounts, swaps or hides the solid for `q`, and bakes
   *  a spin sheet for every solid among `q`'s bubbles. */
  show(q: Question, topicId: string | undefined): void;
  state(): SolidState | null;
  /**
   * The picture to draw inside a bubble instead of its label, or null to draw the label. Called by the arena once
   * per bubble per frame, so it allocates nothing on the hit path: every map it reads is keyed by strings the
   * arena already holds. `phase` is seconds, offset per bubble so a wave does not turn in lock-step.
   */
  bubbleArt(label: string, colour: string, phase: number): Readonly<ArtFrame> | null;
  art(): SolidArtState | null;
  dispose(): void;
}
type Loader = () => Promise<typeof import('../three/mount/solids')>;
/**
 * The default loader, and the build-time layer of the 3-D flag (#714): `VITE_THREE=off` makes the test below
 * a constant, so Vite folds the `import()` away and the build has no three chunk at all — a rail builds both
 * ways and checks. Read here as a literal `import.meta.env.VITE_THREE`, which is the only spelling Vite
 * replaces; `src/three/mount/enabled.ts` reads the same variable for the runtime decision, and this spike
 * is not behind that runtime decision (the comment at the top of `solids.ts` says why). Read inside the
 * function, not at module level: Playwright's own loader evaluates this module in Node for a duel spec's
 * constants, and Node has no `import.meta.env`.
 */
const loadSolids: Loader = () => import.meta.env.VITE_THREE === 'off'
  ? Promise.reject(Object.assign(new Error('3-D is off in this build (VITE_THREE=off)'), { builtOff: true }))
  : import('../three/mount/solids');
/** The card element the view is mounted into — `#vis`, whose contents `renderVisual` rewrites per question. */
type Host = Pick<HTMLElement, 'replaceChildren'>;
/**
 * Tints a whole white-lit spin sheet to `colour`, once, and hands back an immutable bitmap of it — asynchronously,
 * because `createImageBitmap` is. The arena then copies one cell of it per bubble per frame, a plain `drawImage`.
 * Per-frame tinting through a shared scratch canvas was the first cut, and it stalled the arena: every copy out of
 * a freshly composited canvas forced a GPU read-back (measured: the arena clock at 0.4× wall time in Chromium,
 * and later a page that stopped answering at all). So the pixels never pass through a canvas on the way here.
 */
type Tint = (sheet: SpinSheet, colour: string) => Promise<CanvasImageSource>;
/** One cell of a tinted sheet: the arena draws `img` from `(sx, 0)`, `size` px square. Reused, never reallocated per frame. */
export interface ArtFrame { img: CanvasImageSource; sx: number; size: number }
/** One tinted sheet in the cache: tinting, drawn, or given up on (a failed tint is never retried per frame). */
interface Tinted { state: 'pending' | 'ready' | 'failed'; img: CanvasImageSource | null; used: number }
/** Whether a sheet has any opaque pixel at all — a lost WebGL context reads back an all-zero one. */
export function hasInk(sheet: SpinSheet): boolean {
  for (let i = 3; i < sheet.data.length; i += 4) if (sheet.data[i]) return true;
  return false;
}

/**
 * A spin sheet: `frames` views of one solid a full turn apart, `cell` device pixels square, played at `fps`.
 * 32 frames at 8 a second is one turn in 4 s — slow, like the card's solid, and short enough to see a whole
 * turn in one bubble's flight. 96 px covers a phone bubble (r ≈ 33 CSS px at 2–3×) without upscaling much.
 */
export const SHEET = { frames: 32, cell: 96, fps: 8 } as const;

const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n * 255))).toString(16).padStart(2, '0');
const rgbOf = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
const luminance = (hex: string) => {
  const [r, g, b] = rgbOf(hex).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
function hsl2hex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  return `#${hex2(f(0))}${hex2(f(8))}${hex2(f(4))}`;
}
const COMPLEMENTS = new Map<string, string>();
/**
 * The colour a solid takes inside a bubble of `bubble` colour (owner, in session: contrasting, not the card's
 * solid colours): the opposite hue, saturated, and darkened step by step until it stands off the bubble by
 * 3:1 — WCAG's floor for a non-text shape. Every bubble here is bright, so darker is the only way to get there.
 * Cached: the arena asks once per bubble per frame and must never rebuild a colour string on that path.
 */
export function complement(bubble: string): string {
  const hit = COMPLEMENTS.get(bubble); if (hit) return hit;
  const [r, g, b] = rgbOf(bubble);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const h = d === 0 ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  const hue = (h * 60 + 180) % 360;
  const bl = luminance(bubble);
  let out = hsl2hex(hue, 0.85, 0.5);
  for (let l = 0.5; l > 0.05; l -= 0.02) {
    out = hsl2hex(hue, 0.85, l);
    const cl = luminance(out);
    if ((Math.max(bl, cl) + 0.05) / (Math.min(bl, cl) + 0.05) >= 3) break;
  }
  COMPLEMENTS.set(bubble, out);
  return out;
}

/** The real `Tint`: white-lit shading × the colour, on the pixels, then one immutable bitmap — no canvas in between. */
const tintSheet: Tint = (sheet, colour) => {
  const [r, g, b] = rgbOf(colour);
  const d = new Uint8ClampedArray(sheet.data);
  for (let i = 0; i < d.length; i += 4) { d[i] *= r; d[i + 1] *= g; d[i + 2] *= b; }
  return createImageBitmap(new ImageData(d, sheet.width, sheet.height));
};
/** Finished tinted sheets kept per screen, least recently drawn evicted first. 16 covers several waves at ~1.2 MB each. */
const TINTED_MAX = 16;

let warnedOnce = false;
export function createSolidSlot(host: () => Host, loader: Loader = loadSolids, tint: Tint = tintSheet): SolidSlot {
  let view: SolidView | null = null;
  let loading: Promise<typeof import('../three/mount/solids')> | null = null;
  let wanted: SolidName | null = null;   // the solid the card currently asks for; null once a plain question follows
  let error: SolidState['error'] = null;   // set once three could not be used — the emoji stays, the hook says why
  let disposed = false;
  let topic: string | undefined;          // the live question's topic: bubble art is drawn only on a 3-D Shapes topic
  let toBake: SolidName[] = [];           // solids among the live question's bubbles with no sheet yet
  let draws = 0;
  const sheets = new Map<string, SpinSheet>();   // keyed by the bubble's glyph, the label the arena passes
  // glyph → bubble colour → its tinted sheet. Both keys are strings the arena already holds, so a lookup builds
  // nothing on the per-frame path. `used` is a frame-independent tick bumped on every hit: the eviction key.
  const tinted = new Map<string, Map<string, Tinted>>();
  let tick = 0;
  // Reused for every bubble every frame (no per-frame allocation): valid until the next `bubbleArt` call, which
  // is all the arena needs — it draws it at once. `img` is set before `frame` is ever handed out.
  const frame: ArtFrame = { img: null as unknown as CanvasImageSource, sx: 0, size: SHEET.cell };
  /** Drop least-recently-used finished sheets until at most `TINTED_MAX` remain. Pending and failed ones are small. */
  function evict() {
    for (;;) {
      let n = 0, oldest: { m: Map<string, Tinted>; key: string; t: Tinted } | null = null;
      for (const m of tinted.values()) for (const [key, t] of m) {
        if (t.state !== 'ready') continue;
        n++; if (!oldest || t.used < oldest.t.used) oldest = { m, key, t };
      }
      if (n <= TINTED_MAX || !oldest) return;
      oldest.m.delete(oldest.key);
      (oldest.t.img as { close?: () => void } | null)?.close?.();   // an ImageBitmap's pixels go now, not at GC
    }
  }
  function startTint(colour: string, sheet: SpinSheet, byColour: Map<string, Tinted>) {
    const entry: Tinted = { state: 'pending', img: null, used: ++tick };
    byColour.set(colour, entry);
    const failed = (e: unknown) => { entry.state = 'failed'; console.warn('3-D solids: could not tint a bubble sheet; that bubble keeps its emoji', e); };
    let p: Promise<CanvasImageSource>;
    try { p = tint(sheet, complement(colour)); } catch (e) { failed(e); return; }   // never throw into the arena's frame
    p.then(img => {
      if (disposed || byColour.get(colour) !== entry) { (img as { close?: () => void }).close?.(); return; }
      entry.state = 'ready'; entry.img = img; evict();
    }, failed);
  }
  function mount(name: SolidName) {
    if (!view || disposed) return;
    host().replaceChildren(view.el);
    view.show(name);
  }
  /** Once per solid per screen: a few dozen tiny renders, at question time rather than in the arena's frame. */
  function bake() {
    if (!view || disposed) return;
    const names = toBake; toBake = [];
    for (const name of names) {
      const glyph = GLYPH_BY_NAME.get(name)!;
      if (sheets.has(glyph)) continue;
      let sheet: SpinSheet;
      try { sheet = view.sheet(name, SHEET.frames, SHEET.cell); } catch (e) { fail('no-webgl', e); return; }
      // A lost GL context draws nothing and reads back zeros, silently. A sheet with no opaque pixel would put an
      // empty bubble in front of a child, so it is not kept: the emoji stays, and the next question tries again.
      if (!hasInk(sheet)) { console.warn(`3-D solids: the ${name} sheet came back blank (context lost?); keeping the emoji`); continue; }
      sheets.set(glyph, sheet);
    }
  }
  function fail(kind: NonNullable<SolidState['error']>, e: unknown) {
    error = kind;
    if (kind === 'built-off') return;   // a build choice, not a failure: the emoji is the design, nothing to warn about
    if (!warnedOnce) { warnedOnce = true; console.warn(`3-D solids: ${kind === 'no-webgl' ? 'WebGL renderer unavailable' : 'could not load three'}, keeping the emoji`, e); }
  }
  return {
    show(q, topicId) {
      topic = topicId;
      const name = solidNameFor(q, topicId);
      wanted = name;
      if (!name) view?.hide();
      toBake = topicId && SOLID_TOPICS.has(topicId)
        ? q.options.flatMap(o => { const n = NAME_BY_GLYPH.get(o); return n && !sheets.has(o) ? [n] : []; })
        : [];
      if (!name && !toBake.length) return;
      // A renderer that has already failed once (`bake()`'s catch below) is never retried per question — the
      // same guard the pre-load path already takes six lines down.
      if (view) { if (error) return; if (name) mount(name); bake(); return; }
      if (error) return;
      // The card and the bubbles already hold the emoji; three arrives a moment later and takes over — unless the
      // question moved on meanwhile, in which case `wanted`/`toBake` already describe the new one.
      loading ??= loader();
      loading.then(m => {
        if (disposed || view) return;
        try { view = new m.SolidView(); }
        catch (e) { fail('no-webgl', e); return; }
        if (wanted) mount(wanted);
        bake();
      }, e => fail((e as { builtOff?: boolean } | null)?.builtOff ? 'built-off' : 'load-failed', e));
    },
    state() {
      if (!wanted) return null;
      return view?.state ?? { name: wanted, frames: 0, webgl: !error, error };
    },
    bubbleArt(label, colour, phase) {
      if (!topic || !SOLID_TOPICS.has(topic)) return null;
      const sheet = sheets.get(label); if (!sheet) return null;
      let byColour = tinted.get(label);
      if (!byColour) { byColour = new Map(); tinted.set(label, byColour); }
      const entry = byColour.get(colour);
      if (!entry) { startTint(colour, sheet, byColour); return null; }   // the emoji until it lands
      if (entry.state !== 'ready') return null;                          // still tinting, or failed for good: the emoji
      entry.used = ++tick; draws++;
      frame.img = entry.img!; frame.sx = (Math.floor(Math.max(0, phase) * SHEET.fps) % SHEET.frames) * SHEET.cell;
      return frame;
    },
    art() {
      if (!view && !error && !sheets.size) return null;
      return { ready: [...sheets.keys()].map(g => NAME_BY_GLYPH.get(g)!).sort(), draws, error };
    },
    dispose() {
      disposed = true; wanted = null; topic = undefined; sheets.clear();
      for (const m of tinted.values()) for (const t of m.values()) (t.img as { close?: () => void } | null)?.close?.();
      tinted.clear(); view?.destroy(); view = null;
    },
  };
}
