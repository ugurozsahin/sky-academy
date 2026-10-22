// `node scripts/catalogue-init.mjs [--force]` (#2193): writes `src/config/catalogue.json`, the game catalogue,
// from today's code — `TOPICS`, `YEARS` and the bubble timing table — so that every value in it starts equal to
// what the game does now. It runs once; from then on the file is the source and is edited by hand, so the script
// refuses to overwrite an existing file unless given `--force`.
//
// The registry is TypeScript, so it is loaded through Vite's own SSR loader, as `content-map.mjs` does. The air
// time and stagger are read by driving the real `layoutWave` at each speed, not by copying its literals. Since
// #2194 `YEARS` and `layoutWave` read these values from the file itself, so `--force` rewrites the file's own
// settings, resets its media and playability, and regenerates the runtime copy.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { writeSlim } from './catalogue-slim.mjs';

const OUT = 'src/config/catalogue.json';
const GROUPS = { eyfs: ['reception'], ks1: ['year1', 'year2'], lks2: ['year3', 'year4'], uks2: ['year5', 'year6'] };

if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.error(`catalogue-init: ${OUT} exists and is now the source of truth; pass --force to overwrite it`);
  process.exit(1);
}

/** Air time (s) and stagger (ms) at speeds 0..3, measured from `layoutWave` at `speedK` 1. */
function speedTable(layoutWave) {
  const plans = [0, 1, 2, 3].map((speed) => layoutWave({ labels: ['1', '2', '3'], speed }, { W: 390, H: 700, topInset: 0 }, 1, 0, () => 0.5));
  const table = { airTime: plans.map((p) => p.waveT / 1000), stagger: plans.map((p) => p.stagger) };
  if (![...table.airTime, ...table.stagger].every((n) => Number.isFinite(n) && n > 0)) throw new Error(`catalogue-init: layoutWave no longer reports waveT/stagger: ${JSON.stringify(table)}`);
  return table;
}

const yearSettings = (y) => ({
  perStage: y.perStage, lives: y.lives, gentle: y.gentle, speeds: [...y.speeds], diffs: [...y.diffs],
  sprintStars: { threeStar: y.sprintStars.threeStar, twoStar: y.sprintStars.twoStar },
  maxAnswer: y.maxAnswer, minAnswer: y.minAnswer ?? 0,
});

const yearNode = (y) => ({
  visible: 'auto',
  settings: yearSettings(y),
  media: {
    thumbnail: { src: `img/islands/${y.id}/thumb.webp`, alt: `The ${y.title} island on the Sharpwise map` },
    screenshots: [{ src: `img/islands/${y.id}/1.webp`, alt: `The ${y.title} island's games on a phone` }],
  },
  playability: null,
});

const gameNode = (t, yearTitle) => ({
  visible: true,
  settings: {},
  groupSettings: {},
  years: { [t.year]: { visible: true, settings: {}, playability: null } },
  media: {
    thumbnail: { src: `img/games/${t.id}/thumb.webp`, alt: `${t.title}, a ${yearTitle} game` },
    screenshots: [{ src: `img/games/${t.id}/1.webp`, alt: `${t.title} being played, a ${yearTitle} game on a phone` }],
  },
  playability: null,
});

const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
try {
  const { TOPICS, YEARS } = await server.ssrLoadModule('/src/curriculum/index.ts');
  const { layoutWave } = await server.ssrLoadModule('/src/game/bubbles.ts');
  const title = Object.fromEntries(YEARS.map((y) => [y.id, y.title]));
  const catalogue = {
    version: 1,
    groups: GROUPS,
    defaults: { settings: speedTable(layoutWave) },
    years: Object.fromEntries(YEARS.map((y) => [y.id, yearNode(y)])),
    games: Object.fromEntries(TOPICS.map((t) => [t.id, gameNode(t, title[t.year])])),
  };
  mkdirSync('src/config', { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(catalogue, null, 2)}\n`);
  writeSlim();
  console.log(`catalogue-init: ${TOPICS.length} games and ${YEARS.length} years written to ${OUT}`);
} finally {
  await server.close();
}
