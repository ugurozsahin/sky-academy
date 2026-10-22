// Writes website/curriculum/index.html (#2089) and website/curriculum/<year>/index.html for each year (#2090) from
// docs/content-map.json and the home page's shell. Run by `npm run content-map` after the map itself, so one
// command keeps them all current. No build step: the pages are committed, and `tests/unit/site-curriculum*.test.ts`
// regenerate them in memory and fail on drift.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { ALL_YEARS, renderCurriculumPage, renderYearPage, withoutYearLinks, yearSlug } from './site-curriculum-lib.mjs';
import { sitemapXml } from './site-sitemap.mjs';

const map = JSON.parse(readFileSync('docs/content-map.json', 'utf8'));
const hidden = ALL_YEARS.filter(id => !map.byYear.some(y => y.year === id));
// A year the catalogue hides is not advertised either (#2201): its nav line goes from every page, and from llms.txt.
const pages = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? pages(`${dir}/${e.name}`) : e.name.endsWith('.html') ? [`${dir}/${e.name}`] : []);
for (const f of [...pages('website'), 'website/llms.txt']) {
  const was = readFileSync(f, 'utf8');
  const now = hidden.reduce(withoutYearLinks, was);
  if (now !== was) writeFileSync(f, now);
}
const home = readFileSync('website/index.html', 'utf8');
writeFileSync('website/curriculum/index.html', renderCurriculumPage(map, home));
// A year the catalogue hides has no page (#2201): drop one an earlier run wrote, so the sitemap, which lists the folders, follows.
for (const id of hidden) rmSync(`website/curriculum/${yearSlug(id)}`, { recursive: true, force: true });
for (const year of map.byYear) {
  const dir = `website/curriculum/${yearSlug(year.year)}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/index.html`, renderYearPage(map, year, home));
}
writeFileSync('website/sitemap.xml', sitemapXml());
console.log(`curriculum pages: ${map.topicCount} topics written, on the index and ${map.byYear.length} year pages`);
