// Writes website/curriculum/index.html (#2089) from docs/content-map.json and the home page's shell. Run by
// `npm run content-map` after the map itself, so one command keeps both current. No build step: the page is
// committed, and `tests/unit/site-curriculum.test.ts` regenerates it in memory and fails on drift.
import { readFileSync, writeFileSync } from 'node:fs';
import { renderCurriculumPage } from './site-curriculum-lib.mjs';

const map = JSON.parse(readFileSync('docs/content-map.json', 'utf8'));
writeFileSync('website/curriculum/index.html', renderCurriculumPage(map, readFileSync('website/index.html', 'utf8')));
console.log(`curriculum page: ${map.topicCount} topics written`);
