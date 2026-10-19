// `npm run content-map` (#2031): regenerates docs/content-map.json and docs/CONTENT-MAP.md from the topic
// registry. The registry is TypeScript, so it is loaded through Vite's own SSR loader (already a devDependency).
// `tests/unit/content-map.test.ts` runs the same `buildContentMap` and fails when these files are stale.
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { buildContentMap } from './content-map-lib.mjs';

const server = await createServer({ logLevel: 'silent', server: { middlewareMode: true }, appType: 'custom' });
try {
  const { TOPICS, YEARS } = await server.ssrLoadModule('/src/curriculum/index.ts');
  const { tipFor } = await server.ssrLoadModule('/src/game/tips.ts');
  const { R_STORIES } = await server.ssrLoadModule('/src/curriculum/stories-r.ts');
  const { Y1_STORIES } = await server.ssrLoadModule('/src/curriculum/stories-y1.ts');
  const { Y2_STORIES } = await server.ssrLoadModule('/src/curriculum/stories-y2.ts');
  const strands = JSON.parse(readFileSync('docs/content-map-strands.json', 'utf8'));
  const { json, md } = buildContentMap({ topics: TOPICS, years: YEARS, strands, tipFor, banks: { 'r-storytime': R_STORIES.length, 'y1-storytime': Y1_STORIES.length, 'y2-storytime': Y2_STORIES.length } });
  writeFileSync('docs/content-map.json', json);
  writeFileSync('docs/CONTENT-MAP.md', md);
  console.log(`content map: ${TOPICS.length} topics written`);
} finally {
  await server.close();
}
