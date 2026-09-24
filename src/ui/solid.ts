// The rotating 3-D solid on a 3-D Shapes question card (#684): which questions get one, and the one lazy
// renderer per play screen that shows it. `three` itself lives behind a dynamic `import()` of
// `src/game/solids.ts`, so this file — and the main chunk it is part of — never carries it; a guard rail in
// `tests/unit/guardrails.test.ts` holds that line. The spike's cost and the owner's verdict are on the issue.
import type { Question } from '../curriculum';
import { SHAPES_3D } from '../curriculum/util';
import type { SolidName, SolidView } from '../game/solids';

/** The two topics whose question side shows a real solid; every other topic keeps its emoji. */
export const SOLID_TOPICS: ReadonlySet<string> = new Set(['y1-shapes3d', 'y2-shapes']);

/** The solids `src/game/solids.ts` can build. `SHAPES_3D` (curriculum data, unchanged by #684) is checked
 *  against this list by `tests/unit/solid.test.ts`, so a new or respelt row there fails a test rather than
 *  throwing inside the renderer mid-mission. */
export const SOLID_NAMES: readonly SolidName[] = ['cube', 'cuboid', 'sphere', 'cylinder', 'cone', 'pyramid'];
const isSolidName = (n: string): n is SolidName => (SOLID_NAMES as readonly string[]).includes(n);
const NAME_BY_GLYPH = new Map<string, SolidName>(SHAPES_3D.flatMap(([g, name]) => isSolidName(name) ? [[g, name] as const] : []));

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
export interface SolidState { name: SolidName; frames: number; webgl: boolean; error: 'no-webgl' | 'load-failed' | null }
export interface SolidSlot {
  /** Called after every question is rendered into the card: mounts, swaps or hides the solid for `q`. */
  show(q: Question, topicId: string | undefined): void;
  state(): SolidState | null;
  dispose(): void;
}
type Loader = () => Promise<typeof import('../game/solids')>;
/** The card element the view is mounted into — `#vis`, whose contents `renderVisual` rewrites per question. */
type Host = Pick<HTMLElement, 'replaceChildren'>;

let warnedOnce = false;
export function createSolidSlot(host: () => Host, loader: Loader = () => import('../game/solids')): SolidSlot {
  let view: SolidView | null = null;
  let loading: Promise<typeof import('../game/solids')> | null = null;
  let wanted: SolidName | null = null;   // the solid the card currently asks for; null once a plain question follows
  let error: SolidState['error'] = null;   // set once three could not be used — the emoji stays, the hook says why
  let disposed = false;
  function mount(name: SolidName) {
    if (!view || disposed) return;
    host().replaceChildren(view.el);
    view.show(name);
  }
  return {
    show(q, topicId) {
      const name = solidNameFor(q, topicId);
      wanted = name;
      if (!name) { view?.hide(); return; }
      if (view) { mount(name); return; }
      if (error) return;
      // The card already holds the emoji; three arrives a moment later and replaces it — unless the question
      // moved on meanwhile (`wanted` changed), in which case the view is kept for the next solid and not shown.
      loading ??= loader();
      loading.then(m => {
        if (disposed || view) return;
        try { view = new m.SolidView(); }
        catch (e) {
          error = 'no-webgl';
          if (!warnedOnce) { warnedOnce = true; console.warn('3-D solids: WebGL renderer unavailable, keeping the emoji', e); }
          return;
        }
        if (wanted) mount(wanted);
      }, e => { error = 'load-failed'; if (!warnedOnce) { warnedOnce = true; console.warn('3-D solids: could not load three', e); } });
    },
    state() {
      if (!wanted) return null;
      return view?.state ?? { name: wanted, frames: 0, webgl: !error, error };
    },
    dispose() { disposed = true; wanted = null; view?.destroy(); view = null; },
  };
}
