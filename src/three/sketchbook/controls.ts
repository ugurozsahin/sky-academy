/**
 * The right-hand panel: lil-gui (ships inside three, no new dependency). Object, variant, tier, "beside the
 * avatar", and one slider per `n()` parameter — rebuilt when the object changes, because the schema does.
 * The left-hand list is plain buttons; the two agree through the `Model` they both mutate.
 *
 * `Model` is lil-gui's live binding: the panel writes `model.x = v` itself, BEFORE the matching handler
 * fires, so a handler is a change notification and the model already holds the value (type-design review).
 * `main.ts` therefore redraws from the model and ignores the arguments.
 */
import GUI from 'three/examples/jsm/libs/lil-gui.module.min.js';
import type { ObjectSpec } from '../objects';
import type { Tier } from '../stage/tiers';
import { variantsOf } from './catalogue';

export interface Model { object: string; variant: string; tier: Tier; beside: boolean; params: Record<string, number> }
export interface Handlers {
  pick(name: string): void;
  variant(v: string): void;
  tier(t: Tier): void;
  beside(on: boolean): void;
  param(key: string): void;
}

/** The tier names a grown-up would understand, the way the issue puts it. Exhaustive over `Tier`. */
export const TIER_LABEL: Readonly<Record<Tier, string>> = { low: 'tablet (low)', high: 'good phone (high)' };
const byLabel = Object.fromEntries(Object.entries(TIER_LABEL).map(([t, l]) => [l, t])) as Record<string, Tier>;

export function mountControls(model: Model, entries: readonly ObjectSpec[], on: Handlers): { rebuild(o: ObjectSpec): void; destroy(): void } {
  const gui = new GUI({ title: 'Sketchbook' });
  gui.add(model, 'object', entries.map(e => e.name)).name('object').onChange((v: string) => on.pick(v));
  // The variant dropdown lives in its own folder so it can be destroyed and re-added in place when the
  // object changes. lil-gui's `options()` would instead REPLACE the controller — destroying the old one,
  // handler included, and appending the new one at the end of the panel (type-design review of #715).
  const variants = gui.addFolder('variant');
  const addVariant = (o: ObjectSpec) => variants.add(model, 'variant', variantsOf(o)).name('variant').onChange((v: string) => on.variant(v));
  // Seeded from the model's object, not `entries[0]`: a deep link to the second object would otherwise get
  // the placeholder's variants and sliders (type-design review, round 2 of #715).
  const initial = entries.find(e => e.name === model.object) ?? entries[0];
  let variantCtl = addVariant(initial);
  gui.add(model, 'tier', byLabel).name('tier').onChange((t: Tier) => on.tier(t));
  gui.add(model, 'beside').name('beside the avatar').onChange((b: boolean) => on.beside(b));
  let params = gui.addFolder('params');

  const rebuild = (o: ObjectSpec) => {
    variantCtl.destroy();
    variantCtl = addVariant(o);   // reads `model.variant`, which the caller has already set; never `setValue()`, which would fire the handler
    params.destroy();
    params = gui.addFolder('params');
    for (const [key, spec] of Object.entries(o.params))
      params.add(model.params, key, spec.min, spec.max, (spec.max - spec.min) / 100).onChange(() => on.param(key));
    // `window.__sketch.show()` sets the object, tier and beside on the model directly; repaint them, or the panel
    // goes on naming the placeholder beside a hammer (#717). `updateDisplay()` fires no handler.
    for (const c of gui.controllers) c.updateDisplay();
  };
  rebuild(initial);
  return { rebuild, destroy: () => gui.destroy() };
}

/** The left-hand list: one button per object, the current one marked. Returns a refresh for the mark. */
export function mountList(host: HTMLElement, entries: readonly ObjectSpec[], current: () => string, pick: (name: string) => void): () => void {
  host.replaceChildren(...entries.map(e => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.object = e.name; b.textContent = e.name;
    b.addEventListener('click', () => pick(e.name));
    return b;
  }));
  const refresh = () => { for (const b of host.querySelectorAll<HTMLButtonElement>('button')) b.classList.toggle('on', b.dataset.object === current()); };
  refresh();
  return refresh;
}
