// Writes website/curriculum/index.html (#2089) and website/curriculum/<year>/index.html for each year (#2090) from
// docs/content-map.json and the home page's shell. Run by `npm run content-map` after the map itself, so one
// command keeps them all current. No build step: the pages are committed, and `tests/unit/site-curriculum*.test.ts`
// regenerate them in memory and fail on drift.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { renderCurriculumPage, renderYearPage, yearSlug } from './site-curriculum-lib.mjs';

const map = JSON.parse(readFileSync('docs/content-map.json', 'utf8'));
const home = readFileSync('website/index.html', 'utf8');
writeFileSync('website/curriculum/index.html', renderCurriculumPage(map, home));
for (const year of map.byYear) {
  const dir = `website/curriculum/${yearSlug(year.year)}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/index.html`, renderYearPage(map, year, home));
}
console.log(`curriculum pages: ${map.topicCount} topics written, on the index and ${map.byYear.length} year pages`);
