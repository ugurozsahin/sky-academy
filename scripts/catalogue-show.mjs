// `npm run catalogue:show -- <gameId> [year]` (#2194): prints what a game actually gets on a year island — its
// visibility and every resolved setting — after the catalogue's layers (defaults, year, game, year group, single
// year). Without a year it uses the game's own. The resolver is TypeScript, so it is loaded through Vite's SSR
// loader, as `content-map.mjs` does. `npm run catalogue:show` regenerates the runtime copy first, so an edit to
// `src/config/catalogue.json` shows here at once.
import { createServer } from 'vite';

const [id, year] = process.argv.slice(2);
if (!id) {
  console.error('usage: npm run catalogue:show -- <gameId> [year]');
  process.exit(2);
}
const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
try {
  const { RUNTIME, resolveGame } = await server.ssrLoadModule('/src/config/resolve.ts');
  const game = RUNTIME.games[id];
  if (!game) throw new Error(`catalogue-show: no game "${id}" in src/config/catalogue.json`);
  const y = year ?? Object.keys(game.years)[0];
  if (!(y in RUNTIME.years)) throw new Error(`catalogue-show: no year "${y}"; the years are ${Object.keys(RUNTIME.years).join(', ')}`);
  // Arrays of numbers on one line each, so a speed or stage table reads across.
  console.log(JSON.stringify({ game: id, year: y, ...resolveGame(id, y) }, null, 2).replace(/\[\s+([^[\]{}]*?)\s+\]/g, (_, xs) => `[${xs.split(/,\s+/).join(', ')}]`));
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await server.close();
}
