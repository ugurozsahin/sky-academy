// `npm run catalogue:slim` (#2194): writes `src/config/catalogue.runtime.json`, the part of the game catalogue
// the game reads — groups, defaults, and each year's and game's visibility and settings. `media` and
// `playability` never reach the game bundle (#2194, architect): the full file is ~217 KB, the runtime part ~74 KB
// (~2.4 KB gzipped). `predev` and `prebuild` run this, and `tests/unit/resolve.test.ts` fails when the committed copy
// differs from what this writes, so an edit to `catalogue.json` that is not regenerated cannot ship.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const FULL = 'src/config/catalogue.json';
export const RUNTIME = 'src/config/catalogue.runtime.json';
const NOTE = 'Generated from catalogue.json by scripts/catalogue-slim.mjs. Do not edit: edit catalogue.json, then run npm run catalogue:slim.';

const map = (o, f) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));
const game = (g) => ({ visible: g.visible, settings: g.settings, groupSettings: g.groupSettings, years: map(g.years, (n) => ({ visible: n.visible, settings: n.settings })) });

/** The runtime catalogue as text: every key the resolver reads, nothing else, in the full file's key order. */
export function slimCatalogue(full) {
  const slim = { $comment: NOTE, groups: full.groups, defaults: full.defaults, years: map(full.years, (y) => ({ visible: y.visible, settings: y.settings })), games: map(full.games, game) };
  return `${JSON.stringify(slim, null, 2)}\n`;
}

/** Rewrites the runtime copy when it differs; returns whether it did. */
export function writeSlim() {
  const text = slimCatalogue(JSON.parse(readFileSync(FULL, 'utf8')));
  if (existsSync(RUNTIME) && readFileSync(RUNTIME, 'utf8') === text) return false;
  writeFileSync(RUNTIME, text);
  return true;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(writeSlim() ? `catalogue-slim: ${RUNTIME} rewritten` : `catalogue-slim: ${RUNTIME} is up to date`);
