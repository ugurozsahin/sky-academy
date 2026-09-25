/**
 * The sketchbook's boot (#715, epic #713 decision 4): the catalogue on the left, the stage in the centre, the
 * controls on the right, and `window.__sketch` — the contract `scripts/sketch-shot.mjs` drives to render
 * every object × variant × tier and refuse a blank frame. `?object=&variant=&tier=&beside=1` deep-links a
 * view; `?shot=1` hides the panels so a screenshot is the canvas alone.
 *
 * Never imported by anything under `src/` outside this folder (a rail): the game does not know this page.
 */
import { createStage, measure, type Measure } from '../stage';
import { pickTier, readTierEnv, type Tier } from '../stage/tiers';
import { avatarSrc, CATALOGUE, DEFAULT_VARIANT, find, paramsFor, variantsOf } from './catalogue';
import { mountControls, mountList, type Model } from './controls';
import { createView } from './view';
import './sketchbook.css';

export interface SketchObject { name: string; avatar: string; variants: string[] }
/** What the screenshot script and the sketch spec drive. `budget()` is for the `three-art` look pass's numbers. */
export interface SketchHook {
  readonly ready: boolean;
  objects(): SketchObject[];
  /** Throws on a variant or tier the object does not have: a frame filed under the wrong name is worse than no frame. */
  show(name: string, variant: string, tier: Tier, beside?: boolean): void;
  readonly frames: number;
  ink(): number;
  budget(): { declared: Measure; measured: Measure };
  /** A copy, never the live model — the sliders are bound to that one. */
  model(): Model;
}
declare global { interface Window { __sketch: SketchHook } }

const isTier = (t: string | null): t is Tier => t === 'low' || t === 'high';
/** The model a query string asks for; anything it does not say, or says wrongly, falls to the defaults. Pure. */
export function modelFromQuery(q: URLSearchParams, fallbackTier: Tier): Model {
  const o = find(q.get('object'));
  const variant = variantsOf(o).includes(q.get('variant') ?? '') ? q.get('variant')! : DEFAULT_VARIANT;
  const tier = q.get('tier');
  return { object: o.name, variant, tier: isTier(tier) ? tier : fallbackTier, beside: q.get('beside') === '1', params: { ...paramsFor(o, variant) } };
}

const q = new URLSearchParams(location.search);
const shot = q.get('shot') === '1';
if (shot) document.body.classList.add('shot');
const tokens = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const model = modelFromQuery(q, pickTier(readTierEnv()));
let measured: Measure = { triangles: 0, drawCalls: 0 };
let ready = false;

const view = createView(document.getElementById('stage')!, tokens, reduced);
const besideEl = document.getElementById('beside') as HTMLElement, besideImg = document.getElementById('beside-img') as HTMLImageElement;

/** Rebuild the object from the model and put it on the stage. Everything visible flows through here. */
function draw() {
  const o = find(model.object);
  const stage = createStage(model.tier, tokens);
  const built = o.build(model.params, stage);
  measured = measure(built);
  view.set(built, model.tier);
  besideImg.src = avatarSrc(o.avatar);
  besideEl.hidden = !model.beside;
  document.title = `${o.name} · ${model.variant} · ${model.tier} — sketchbook`;
}
/** Replace `model.params` in place: the sliders are bound to that object, so it is never reassigned. */
function setParams(next: Record<string, number>) {
  for (const k of Object.keys(model.params)) delete model.params[k];
  Object.assign(model.params, next);
}

const controls = shot ? null : mountControls(model, CATALOGUE, {
  pick: (name) => pick(name),
  variant: (v) => { setParams(paramsFor(find(model.object), v)); controls?.rebuild(find(model.object)); draw(); },
  tier: () => draw(),
  beside: () => draw(),
  param: () => draw(),
});
const refreshList = shot ? () => {} : mountList(document.getElementById('list')!, CATALOGUE, () => model.object, (name) => pick(name));

function pick(name: string) {
  const o = find(name);
  model.object = o.name; model.variant = DEFAULT_VARIANT;
  setParams(paramsFor(o, DEFAULT_VARIANT));
  controls?.rebuild(o);
  refreshList();
  draw();
}

window.__sketch = {
  get ready() { return ready; },
  objects: () => CATALOGUE.map(o => ({ name: o.name, avatar: o.avatar, variants: variantsOf(o) })),
  show(name, variant, tier, beside = false) {
    const o = find(name);
    if (o.name !== name) throw new Error(`no object named ${name}`);
    if (!variantsOf(o).includes(variant)) throw new Error(`${name} has no variant ${variant}`);
    if (!isTier(tier)) throw new Error(`no tier ${String(tier)}`);
    model.object = o.name; model.variant = variant; model.tier = tier; model.beside = beside;
    setParams(paramsFor(o, variant));
    controls?.rebuild(o); refreshList();
    draw();
  },
  get frames() { return view.frames; },
  ink: () => view.ink(),
  budget: () => ({ declared: find(model.object).budget, measured }),
  model: () => structuredClone(model),
};
draw();
ready = true;
