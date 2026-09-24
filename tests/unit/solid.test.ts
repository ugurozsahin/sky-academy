import { describe, expect, it, vi } from 'vitest';
import { createSolidSlot, solidNameFor, SOLID_NAMES, SOLID_TOPICS } from '../../src/ui/solid';
import { SHAPES_3D } from '../../src/curriculum/util';
import type { Question } from '../../src/curriculum';

const word = (text: string, extra: Partial<Question> = {}): Question =>
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
  type Fake = { el: object; shown: string[]; hidden: number; destroyed: number; frames: number; show(n: string): void; hide(): void; destroy(): void; readonly state: { name: string; frames: number; webgl: boolean; error: null } | null };
  const fakeModule = (fail = false) => {
    const views: Fake[] = [];
    class SolidView implements Fake {
      el = { tag: 'solid' }; shown: string[] = []; hidden = 0; destroyed = 0; frames = 0;
      constructor() { if (fail) throw new Error('no WebGL'); views.push(this); }
      show(n: string) { this.shown.push(n); this.frames++; }
      hide() { this.hidden++; }
      destroy() { this.destroyed++; }
      get state() { const name = this.shown.at(-1); return name ? { name, frames: this.frames, webgl: true, error: null } : null; }
    }
    return { views, mod: { SolidView } };
  };
  /** A stand-in for `#vis`: `kids` is what the card currently holds — the emoji word card until a view replaces it. */
  const host = () => ({ kids: ['wordcard'] as unknown[], replaceChildren(...n: unknown[]) { this.kids = n; } });
  const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

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
