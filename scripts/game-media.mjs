// The game and island pictures the Pages deploy publishes (#2203): only those the repository catalogue shows.
// Usage: node scripts/game-media.mjs ids                    the island and game ids to capture, comma-separated,
//                                                           for `game-shots.mjs --only` (#2202)
//        node scripts/game-media.mjs check <https://host>   after a deploy: every published media src answers 200
//                                                           with image/webp, every withheld one 404
// "Shows" is `catalogueShown` in src/curriculum/catalogue-shown.ts, the one definition, read from the committed
// src/config/catalogue.json and never from a user's patch (#2192). The registry is TypeScript, so it is loaded
// through Vite's SSR loader, as scripts/content-map.mjs does. Exit 0 = as intended, 1 = a check failed, 2 = bad usage.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';

export const CONCURRENCY = 8;
const root = fileURLToPath(new URL('..', import.meta.url));
const catalogue = () => JSON.parse(readFileSync(new URL('../src/config/catalogue.json', import.meta.url), 'utf8'));

/** The shown islands and games of `cat`, by the shared helper over the real registry. */
export async function loadShown(cat = catalogue()) {
  const server = await createServer({ root, logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
  try {
    const { TOPICS } = await server.ssrLoadModule('/src/curriculum/index.ts');
    const { catalogueShown } = await server.ssrLoadModule('/src/curriculum/catalogue-shown.ts');
    return catalogueShown(cat, TOPICS);
  } finally {
    await server.close();
  }
}

const srcs = (media) => [media.thumbnail.src, ...media.screenshots.map(s => s.src)];

/** Pure: which ids to capture, which media srcs to publish and which to withhold, given `catalogueShown`'s result. */
export function mediaPlan(cat, shown) {
  const publish = [], withheld = [];
  for (const [y, node] of Object.entries(cat.years)) (shown.years.includes(y) ? publish : withheld).push(...srcs(node.media));
  for (const [id, g] of Object.entries(cat.games)) (shown.games.includes(id) ? publish : withheld).push(...srcs(g.media));
  return { ids: [...shown.years, ...shown.games], publish, withheld };
}

/** Problems with one media file: a list of messages, empty when it answers as the plan says. */
export async function checkFile(base, path, published) {
  const url = `${base.replace(/\/+$/, '')}/${path}`;
  let res;
  try { res = await fetch(url, { redirect: 'manual' }); } catch (e) { return [`${url}: request failed (${e.cause?.code ?? e.message})`]; }
  await res.body?.cancel();
  const { status } = res;
  if (!published) return status === 404 ? [] : [`${url}: withheld (the catalogue hides it) but answered ${status}; want 404`];
  if (status !== 200) return [`${url}: status ${status}, want 200 (was it left out of the deploy?)`];
  const type = res.headers.get('content-type') ?? '';
  return /^image\/webp\s*(;|$)/i.test(type) ? [] : [`${url}: content-type "${type}", want image/webp`];
}

/** Every file of the plan, `CONCURRENCY` at a time. Returns every problem found. */
export async function checkMedia(base, plan) {
  const jobs = [...plan.publish.map(p => [p, true]), ...plan.withheld.map(p => [p, false])];
  const problems = [];
  let next = 0;
  const worker = async () => { for (let j = jobs[next++]; j; j = jobs[next++]) problems.push(...await checkFile(base, ...j)); };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return problems;
}

async function main([cmd, base]) {
  if (!(cmd === 'ids' || (cmd === 'check' && /^https?:\/\//.test(base ?? '')))) {
    console.error('usage: node scripts/game-media.mjs ids | check <https://host>');
    return 2;
  }
  const cat = catalogue();
  const plan = mediaPlan(cat, await loadShown(cat));
  if (cmd === 'ids') { console.log(plan.ids.join(',')); return 0; }
  const problems = await checkMedia(base, plan);
  console.log(`game-media: ${plan.publish.length} files published, ${plan.withheld.length} withheld`);
  if (!problems.length) { console.log('ok: every game and island picture answers as the catalogue intends'); return 0; }
  for (const p of problems.slice(0, 30)) console.error(`FAIL ${p}`);
  if (problems.length > 30) console.error(`… and ${problems.length - 30} more`);
  return 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(code => process.exit(code), e => { console.error(`game-media: ${e.message}`); process.exit(1); });
}
