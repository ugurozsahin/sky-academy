import { describe, expect, it, vi } from 'vitest';
import { complement, createSolidSlot, hasInk, SHEET, solidNameFor, SOLID_NAMES, SOLID_TOPICS } from '../../src/ui/solid';
import { downsampleInto } from '../../src/three/mount/solids';
import { GOOD, BAD, PALETTE } from '../../src/game/arena';
import { SHAPES_3D } from '../../src/curriculum/util';
import type { Question } from '../../src/curriculum';

const word = (text: string, extra: Partial<Omit<Question, 'hint' | 'hintIsData'>> = {}): Question =>
  ({ prompt: 'What is this shape?', answer: 'cube', options: ['cube', 'cone'], visual: { type: 'word', text }, ...extra });

describe('solidNameFor — which question shows a rotating solid (#684)', () => {
  it('every SHAPES_3D name is a solid the renderer can build — a new row there lands here, not as a throw mid-mission', () => {
    expect(SHAPES_3D.map(([, name]) => name).sort()).toEqual([...SOLID_NAMES].sort());
  });
  it('maps every SHAPES_3D glyph to its name on both 3-D Shapes topics, and nothing else', () => {
    expect([...SOLID_TOPICS].sort()).toEqual(['y1-shapes3d', 'y2-shapes']);
    for (const topic of SOLID_TOPICS)
      for (const [glyph, name] of SHAPES_3D) expect(solidNameFor(word(glyph), topic), `${glyph} on ${topic}`).toBe(name);
  });
  it('is null on every other topic, even for a 3-D glyph — Memory Match and the 2-D topics keep their emoji', () => {
    for (const topic of ['y1-shapes', 'r-count', 'y2-tables', undefined]) expect(solidNameFor(word('🎲'), topic)).toBeNull();
  });
  it('is null when the visual is not a lone SHAPES_3D glyph', () => {
    expect(solidNameFor(word('🔷'), 'y2-shapes')).toBeNull();                                   // a 2-D glyph
    expect(solidNameFor({ ...word('🎲'), visual: undefined }, 'y2-shapes')).toBeNull();          // "Which is a cube?" has no visual
    expect(solidNameFor({ ...word('🎲'), visual: { type: 'objects', emoji: '🎲', n: 3 } }, 'y2-shapes')).toBeNull();
    expect(solidNameFor(word('🎲 🎲'), 'y2-shapes')).toBeNull();
  });
});

describe('createSolidSlot — one lazy renderer per play screen (#684)', () => {
  // No DOM in the unit suite (vitest runs in plain Node here): the slot only ever calls `replaceChildren` on
  // the host it is given, so a fake host and a fake element are the whole contract, and `three` never loads.
  type Fake = { el: object; shown: string[]; beats: string[]; hidden: number; destroyed: number; frames: number; show(n: string): void; beat(k: string): void; hide(): void; destroy(): void; readonly state: { name: string; frames: number; webgl: boolean; error: null } | null };
  const fakeModule = (fail = false) => {
    const views: Fake[] = [];
    class SolidView implements Fake {
      el = { tag: 'solid' }; shown: string[] = []; beats: string[] = []; hidden = 0; destroyed = 0; frames = 0;
      constructor() { if (fail) throw new Error('no WebGL'); views.push(this); }
      show(n: string) { this.shown.push(n); this.frames++; }
      beat(k: string) { this.beats.push(k); }
      hide() { this.hidden++; }
      destroy() { this.destroyed++; }
      get state() { const name = this.shown.at(-1); return name ? { name, frames: this.frames, webgl: true, error: null } : null; }
    }
    return { views, mod: { SolidView } };
  };
  /** A stand-in for `#vis`: `kids` is what the card currently holds — the emoji word card until a view replaces it. */
  const host = () => ({ kids: ['wordcard'] as unknown[], replaceChildren(...n: unknown[]) { this.kids = n; } });
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

  // #740 on the card: a right answer cheers the solid shown — and only a solid that is shown.
  it('cheer plays on the card solid only: nothing before one loads, nothing on a question without one', async () => {
    const { views, mod } = fakeModule();
    const h = host();
    const slot = createSolidSlot(() => h as never, async () => mod as never);
    expect(() => slot.cheer(), 'no view yet: nothing to cheer, and no throw').not.toThrow();
    slot.show(word('🎲'), 'y2-shapes');
    await settle();
    slot.cheer();
    expect(views[0].beats).toEqual(['cheer']);
    slot.show(word('🍎'), 'y2-shapes');   // not a solid: the card shows the emoji again
    await settle();
    slot.cheer();
    expect(views[0].beats, 'no solid on the card, no cheer').toEqual(['cheer']);
  });

  it('loads the module once, mounts the view into the host, and reuses it for the next solid', async () => {
    const { views, mod } = fakeModule();
    const loader = vi.fn(async () => mod as never);
    const h = host();
    const slot = createSolidSlot(() => h as never, loader);
    expect(slot.state()).toBeNull();
    slot.show(word('🎲'), 'y2-shapes');
    expect(slot.state()).toEqual({ name: 'cube', frames: 0, webgl: true, error: null });   // pending: named, nothing drawn yet
    await settle();
    expect(views).toHaveLength(1);
    expect(h.kids).toEqual([views[0].el]);                                    // the emoji card is replaced, not kept beside it
    expect(views[0].shown).toEqual(['cube']);
    expect(slot.state()).toEqual({ name: 'cube', frames: 1, webgl: true, error: null });
    h.kids = ['wordcard'];                                                    // the next question re-rendered the card
    slot.show(word('⚽'), 'y2-shapes');
    await settle();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(views).toHaveLength(1);
    expect(views[0].shown).toEqual(['cube', 'sphere']);
    expect(h.kids).toEqual([views[0].el]);
  });
  it('hides the view on a question with no solid, and never loads three for one', async () => {
    const { views, mod } = fakeModule();
    const loader = vi.fn(async () => mod as never);
    const h = host();
    const slot = createSolidSlot(() => h as never, loader);
    slot.show(word('🎲'), 'r-count');
    await settle();
    expect(loader).not.toHaveBeenCalled();
    expect(slot.state()).toBeNull();
    expect(h.kids).toEqual(['wordcard']);
    slot.show(word('🎲'), 'y2-shapes');
    await settle();
    slot.show(word('7'), 'y2-shapes');
    expect(views[0].hidden).toBe(1);
    expect(slot.state()).toBeNull();
  });
  it('a question that changed while three was still loading is not mounted over the new one', async () => {
    const { views, mod } = fakeModule();
    let release!: (m: unknown) => void;
    const loader = vi.fn(() => new Promise<never>(r => { release = r as never; }));
    const h = host();
    const slot = createSolidSlot(() => h as never, loader);
    slot.show(word('🎲'), 'y2-shapes');
    h.kids = ['seven'];
    slot.show(word('7'), 'y2-shapes');
    release(mod);
    await settle();
    expect(views).toHaveLength(1);
    expect(views[0].shown).toEqual([]);
    expect(h.kids).toEqual(['seven']);
    expect(slot.state()).toBeNull();
  });
  it('a device with no WebGL keeps the emoji and says so through the hook, once', async () => {
    const { mod } = fakeModule(true);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const h = host();
    const slot = createSolidSlot(() => h as never, async () => mod as never);
    slot.show(word('🎲'), 'y2-shapes');
    await settle();
    expect(h.kids).toEqual(['wordcard']);
    expect(slot.state()).toEqual({ name: 'cube', frames: 0, webgl: false, error: 'no-webgl' });
    slot.show(word('⚽'), 'y2-shapes');
    await settle();
    expect(slot.state()).toEqual({ name: 'sphere', frames: 0, webgl: false, error: 'no-webgl' });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
  it('a chunk that fails to download keeps the emoji, says load-failed (not no-webgl), and is not retried', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const h = host();
    const loader = vi.fn(async () => { throw new Error('404 solids-OLD.js'); });
    const slot = createSolidSlot(() => h as never, loader);
    slot.show(word('🎲'), 'y2-shapes');
    await settle();
    expect(h.kids).toEqual(['wordcard']);
    expect(slot.state()).toEqual({ name: 'cube', frames: 0, webgl: false, error: 'load-failed' });
    slot.show(word('⚽'), 'y2-shapes');
    await settle();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(slot.state()).toMatchObject({ name: 'sphere', error: 'load-failed' });
    warn.mockRestore();
  });
  // #714: the build-time layer of the 3-D flag, on the default loader — the one `createSolidSlot` uses in the
  // game. An off build is a choice, not a failure: the emoji stays, the hook says `built-off` (not `load-failed`,
  // which a real chunk download failure produces), and nothing is warned.
  it('a VITE_THREE=off build keeps the emoji, says built-off through the hook, and warns nothing', async () => {
    vi.stubEnv('VITE_THREE', 'off');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const h = host();
      const slot = createSolidSlot(() => h as never);
      slot.show(word('🎲'), 'y2-shapes');
      await settle();
      expect(h.kids).toEqual(['wordcard']);
      expect(slot.state()).toEqual({ name: 'cube', frames: 0, webgl: false, error: 'built-off' });
      expect(warn).not.toHaveBeenCalled();
    } finally { warn.mockRestore(); vi.unstubAllEnvs(); }
  });
  // The runtime layer (the owner, in session, 2026-09-25): with `threeEnabled()` false the solids chunk is never
  // fetched and the emoji stays, exactly as before #684. Switched off the way a child's page is — `?three=off`,
  // which answers before the device probe runs, so nothing is asked of the GPU and nothing is warned.
  it('with the flag off the default loader keeps the emoji, says flag-off through the hook, and warns nothing', async () => {
    vi.stubGlobal('location', { search: '?three=off' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const h = host();
      const slot = createSolidSlot(() => h as never);
      slot.show(word('🎲', { options: ['🎲', '⚽'] }), 'y1-shapes3d');
      // Two dynamic imports in a row (the flag's chunk, then the answer) take longer than one settle().
      await vi.waitFor(() => expect(slot.state()?.error).toBe('flag-off'));
      expect(h.kids).toEqual(['wordcard']);
      expect(slot.state()).toEqual({ name: 'cube', frames: 0, webgl: false, error: 'flag-off' });
      expect(slot.bubbleArt('🎲', '#ffb020', 0), 'no spinning solid in a bubble either').toBeNull();
      expect(warn).not.toHaveBeenCalled();
    } finally { warn.mockRestore(); vi.unstubAllGlobals(); }
  });
  it('a bake that throws once is never retried — the doomed sheet() call stays doomed (#687 review)', async () => {
    const shown: string[] = [];
    const baked: string[] = [];
    class SolidView {
      el = { tag: 'solid' }; state = null;
      show(n: string) { shown.push(n); }
      hide() {} destroy() {}
      sheet(n: string) { baked.push(n); throw new Error('GL context lost'); }
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const h = host();
    const slot = createSolidSlot(() => h as never, async () => ({ SolidView }) as never);
    slot.show(word('🎲', { options: ['🎲', '⚽'] }), 'y1-shapes3d');
    await settle();
    expect(shown).toEqual(['cube']);
    expect(baked).toEqual(['cube']);
    expect(slot.state()).toMatchObject({ error: 'no-webgl' });
    // Two more questions on the same failed renderer: neither mounts the card again nor repeats the bake.
    slot.show(word('⚽', { options: ['⚽'] }), 'y1-shapes3d');
    slot.show(word('🧱', { options: ['🧱'] }), 'y1-shapes3d');
    expect(shown).toEqual(['cube']);
    expect(baked).toEqual(['cube']);
    warn.mockRestore();
  });
  it('dispose destroys the view, and a load that lands after dispose is thrown away', async () => {
    const { views, mod } = fakeModule();
    let release!: (m: unknown) => void;
    const slot = createSolidSlot(() => host() as never, () => new Promise<never>(r => { release = r as never; }));
    slot.show(word('🎲'), 'y2-shapes');
    slot.dispose();
    release(mod);
    await settle();
    expect(views).toHaveLength(0);
    expect(slot.state()).toBeNull();
    const { views: v2, mod: m2 } = fakeModule();
    const slot2 = createSolidSlot(() => host() as never, async () => m2 as never);
    slot2.show(word('🎲'), 'y2-shapes');
    await settle();
    slot2.dispose();
    expect(v2[0].destroyed).toBe(1);
    expect(slot2.state()).toBeNull();
  });
});

describe('complement — the colour a solid takes inside a bubble (#684, owner in session)', () => {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const hue = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };
  // Every colour a bubble can be: the wave palette, plus the green/red of an outcome reveal.
  const BUBBLES = [...PALETTE, GOOD, BAD];
  it('covers every bubble colour the arena draws', () => { expect(BUBBLES.length).toBeGreaterThanOrEqual(10); });
  it('is the opposite hue of its bubble, within a few degrees', () => {
    for (const c of BUBBLES) {
      const apart = Math.abs(((hue(complement(c)) - hue(c)) % 360 + 360) % 360 - 180);   // 0 when exactly opposite, either way round
      expect(apart, `${c} → ${complement(c)}`).toBeLessThanOrEqual(6);
    }
  });
  it('stands off its bubble by at least 3:1 (WCAG non-text contrast), so the solid never melts into it', () => {
    for (const c of BUBBLES) expect(ratio(c, complement(c)), `${c} → ${complement(c)}`).toBeGreaterThanOrEqual(3);
  });
  it('is a well-formed hex and the same answer every time (cached, never rebuilt per frame)', () => {
    for (const c of BUBBLES) { expect(complement(c)).toMatch(/^#[0-9a-f]{6}$/); expect(complement(c)).toBe(complement(c)); }
  });
});

describe('bubble art — the rotating solid inside a "Which is a …?" bubble (#684)', () => {
  const which = (answer: string, options: string[]): Question => ({ prompt: 'Which is a cube?', answer, options });
  /** A fake SolidView with only what bubble art uses: `sheet()` records each bake. */
  /** A one-pixel stand-in sheet: opaque unless `blank`, tagged with the solid it is for. */
  const fakeSheet = (n: string, blank = false) => ({ name: n, width: 1, height: 1, data: new Uint8ClampedArray([255, 255, 255, blank ? 0 : 255]) });
  const viewModule = (blank: string[] = []) => {
    const baked: string[] = [];
    class SolidView {
      el = {}; state = null;
      show() {} hide() {} destroy() {}
      sheet(n: string) { baked.push(n); return fakeSheet(n, blank.includes(n)) as never; }
    }
    return { baked, mod: { SolidView } };
  };
  const sheetName = (x: unknown) => (x as { name: string }).name;
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
  const fakeHost = () => ({ replaceChildren() {} }) as never;

  it('bakes one sheet per solid among the options, once per screen, and never for a plain topic', async () => {
    const { baked, mod } = viewModule();
    const loader = vi.fn(async () => mod as never);
    const slot = createSolidSlot(fakeHost, loader, async () => ({}) as never);
    slot.show(which('🎲', ['🎲', '⚽', '🥫', '🔺']), 'r-count');
    await settle();
    expect(loader).not.toHaveBeenCalled();
    slot.show(which('🎲', ['🎲', '⚽', '🥫', '🔺']), 'y1-shapes3d');
    await settle();
    expect(baked.sort()).toEqual(['cube', 'cylinder', 'pyramid', 'sphere']);
    slot.show(which('⚽', ['⚽', '🎲', '🍦', '🧱']), 'y1-shapes3d');
    expect(baked.sort()).toEqual(['cone', 'cube', 'cuboid', 'cylinder', 'pyramid', 'sphere']);   // only the two new ones
    expect(slot.art()).toMatchObject({ ready: ['cone', 'cube', 'cuboid', 'cylinder', 'pyramid', 'sphere'] });
  });
  it('tints a sheet once per (solid, bubble colour), draws the emoji until it lands, then the frame for the phase', async () => {
    const { mod } = viewModule();
    const tints: [string, string][] = [];
    const slot = createSolidSlot(fakeHost, async () => mod as never, async (sheet, colour) => { tints.push([sheetName(sheet), colour]); return { tinted: colour } as never; });
    expect(slot.bubbleArt('🎲', '#40c4ff', 0)).toBeNull();                 // nothing baked yet: the emoji is drawn
    slot.show(which('🎲', ['🎲', '⚽', '🥫', '🔺']), 'y2-shapes');
    await settle();
    expect(slot.bubbleArt('🎲', '#40c4ff', 0)).toBeNull();                 // baked, tint started: still the emoji this frame
    expect(tints).toEqual([['cube', complement('#40c4ff')]]);
    await settle();
    expect(slot.bubbleArt('🎲', '#40c4ff', 0)).toEqual({ img: { tinted: complement('#40c4ff') }, sx: 0, size: SHEET.cell });
    expect(slot.bubbleArt('🎲', '#40c4ff', 1)).toMatchObject({ sx: (SHEET.fps % SHEET.frames) * SHEET.cell });
    expect(slot.bubbleArt('🎲', '#40c4ff', SHEET.frames / SHEET.fps + 0.01)).toMatchObject({ sx: 0 });   // wraps after a turn
    expect(tints).toHaveLength(1);                                           // never re-tinted
    expect(slot.bubbleArt('7', '#40c4ff', 0)).toBeNull();                    // a number bubble keeps its label
    expect(slot.bubbleArt('🧱', '#40c4ff', 0)).toBeNull();                   // a solid not in this wave: not baked
    expect(slot.art()!.draws).toBe(3);
    slot.show({ prompt: '2 + 2', answer: '4', options: ['4', '5'] }, 'y2-tables');   // Sensei moved to another topic
    expect(slot.bubbleArt('🎲', '#40c4ff', 0)).toBeNull();
  });
  it('evicts the least recently DRAWN sheet, not the first made — a bubble in flight keeps its solid', async () => {
    const { mod } = viewModule();
    const made: string[] = [];
    const slot = createSolidSlot(fakeHost, async () => mod as never, async (sheet, colour) => { made.push(`${sheetName(sheet)}|${colour}`); return { close() {} } as never; });
    slot.show(which('🎲', ['🎲', '⚽']), 'y2-shapes');
    await settle();
    const colours = Array.from({ length: 16 }, (_, i) => `#${(i * 15).toString(16).padStart(2, '0')}8040`);
    // Two labels interleaved: 8 cube colours and 8 sphere colours fill the cache.
    for (let i = 0; i < 16; i++) { slot.bubbleArt(i % 2 ? '⚽' : '🎲', colours[i], 0); await settle(); }
    slot.bubbleArt('🎲', colours[0], 0);                                   // the first one made is drawn again now
    slot.bubbleArt('🎲', '#123456', 0); await settle();                    // a 17th: something must go
    const n = made.length;
    slot.bubbleArt('🎲', colours[0], 0); await settle();                   // recently drawn: still cached
    expect(made.length).toBe(n);
    slot.bubbleArt('⚽', colours[1], 0); await settle();                   // least recently drawn: evicted, made again
    expect(made.at(-1)).toBe(`sphere|${complement(colours[1])}`);
  });
  it('a tint that fails — rejected or thrown — keeps the emoji, never throws into the arena, and is not retried', async () => {
    const { mod } = viewModule();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let calls = 0;
    const rejects = createSolidSlot(fakeHost, async () => mod as never, async () => { calls++; throw new Error('out of memory'); });
    rejects.show(which('🎲', ['🎲', '⚽']), 'y2-shapes'); await settle();
    for (let i = 0; i < 5; i++) { expect(rejects.bubbleArt('🎲', '#40c4ff', i)).toBeNull(); await settle(); }
    expect(calls).toBe(1);
    let thrown = 0;
    const throws = createSolidSlot(fakeHost, async () => mod as never, () => { thrown++; throw new TypeError('createImageBitmap is not defined'); });
    throws.show(which('🎲', ['🎲', '⚽']), 'y2-shapes'); await settle();
    for (let i = 0; i < 5; i++) expect(() => throws.bubbleArt('🎲', '#40c4ff', i)).not.toThrow();
    expect(thrown).toBe(1);
    expect(throws.bubbleArt('🎲', '#40c4ff', 0)).toBeNull();
    warn.mockRestore();
  });
  it('a blank sheet (a lost GL context reads back zeros) is not kept: the emoji stays and the hook does not list it', async () => {
    const { mod } = viewModule(['cube']);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const slot = createSolidSlot(fakeHost, async () => mod as never, async () => ({}) as never);
    slot.show(which('🎲', ['🎲', '⚽']), 'y2-shapes'); await settle();
    expect(slot.art()!.ready).toEqual(['sphere']);
    expect(slot.bubbleArt('🎲', '#40c4ff', 0)).toBeNull();
    expect(hasInk({ width: 2, height: 1, data: new Uint8ClampedArray(8) })).toBe(false);
    warn.mockRestore();
  });
  it('a tint that lands after dispose is closed, not stored', async () => {
    const { mod } = viewModule();
    let land!: (v: unknown) => void; const closed = vi.fn();
    const slot = createSolidSlot(fakeHost, async () => mod as never, () => new Promise(r => { land = r as never; }));
    slot.show(which('🎲', ['🎲', '⚽']), 'y2-shapes'); await settle();
    slot.bubbleArt('🎲', '#40c4ff', 0);
    slot.dispose();
    land({ close: closed }); await settle();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(slot.art()).toBeNull();
  });
  it('keeps at most 16 tinted sheets, evicting the oldest', async () => {
    const { mod } = viewModule();
    let n = 0;
    const slot = createSolidSlot(fakeHost, async () => mod as never, async () => { n++; return {} as never; });
    slot.show(which('🎲', ['🎲', '⚽']), 'y2-shapes');
    await settle();
    const colours = Array.from({ length: 17 }, (_, i) => `#${(i * 15).toString(16).padStart(2, '0')}8040`);
    for (const c of colours) { slot.bubbleArt('🎲', c, 0); await settle(); }
    expect(n).toBe(17);
    slot.bubbleArt('🎲', colours[0], 0); await settle();                    // the first was evicted: tinted again
    expect(n).toBe(18);
    slot.bubbleArt('🎲', colours[16], 0); await settle();                   // the newest is still cached
    expect(n).toBe(18);
  });
  it('a device with no WebGL bakes nothing and draws nothing — the emoji stays in every bubble', async () => {
    class SolidView { constructor() { throw new Error('no WebGL'); } }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const slot = createSolidSlot(fakeHost, async () => ({ SolidView }) as never, async () => ({}) as never);
    slot.show(which('🎲', ['🎲', '⚽']), 'y2-shapes');
    await settle();
    expect(slot.bubbleArt('🎲', '#40c4ff', 0)).toBeNull();
    expect(slot.art()).toMatchObject({ ready: [], error: 'no-webgl' });
    warn.mockRestore();
  });
});

describe('downsampleInto — one GL read-back into a sheet cell (#684)', () => {
  it('flips GL rows, averages 2×2 premultiplied, encodes sRGB, and keeps straight alpha', () => {
    // A 4×4 read-back, GL order (row 0 = bottom). Top half: opaque white on the left, fully transparent red on the
    // right. Bottom half: opaque black on the left, half-covered white on the right.
    const read = new Uint8Array(4 * 4 * 4);
    const px = (x: number, y: number, r: number, g: number, b: number, a: number) => read.set([r, g, b, a], (y * 4 + x) * 4);
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
      const top = y >= 2, left = x < 2;
      if (top && left) px(x, y, 255, 255, 255, 255);
      else if (top) px(x, y, 255, 0, 0, 0);
      else if (left) px(x, y, 0, 0, 0, 255);
      else px(x, y, 255, 255, 255, (x + y) % 2 ? 255 : 0);
    }
    const out = new Uint8ClampedArray(3 * 2 * 4);                          // a 3-wide sheet row, cell at x0 = 1
    downsampleInto(read, 4, out, 3, 1);
    const at = (x: number, y: number) => [...out.slice((y * 3 + x) * 4, (y * 3 + x) * 4 + 4)];
    expect(at(0, 0)).toEqual([0, 0, 0, 0]);                                 // left of the cell: untouched
    expect(at(1, 0)).toEqual([255, 255, 255, 255]);                         // top-left: white, flipped to the top row
    expect(at(2, 0)).toEqual([0, 0, 0, 0]);                                 // transparent red: no colour leaks out
    expect(at(1, 1)).toEqual([0, 0, 0, 255]);                               // bottom-left: black
    expect(at(2, 1)).toEqual([255, 255, 255, 128]);                         // half coverage: white stays white, alpha halves
  });
});
