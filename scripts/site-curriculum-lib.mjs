// The /curriculum/ page (#2089): the pure half. Given docs/content-map.json and the home page it returns the page
// as a string, so `scripts/site-curriculum.mjs` (writes it) and `tests/unit/site-curriculum.test.ts` (fails on
// drift) run the very same code. Every line about the curriculum comes from the content map; this file only
// arranges it. One render function per year (`renderYear`), so the per-year pages (#2090) can reuse it.

const ORIGIN = 'https://sharpwise.co.uk';
/** Subject id in the content map → the word a parent uses. */
const SUBJECTS = [['maths', 'maths'], ['writing', 'English']];

/** Text for HTML: content and attribute values alike. */
export const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

/** `year1` → `year-1`: the anchor here, and the per-year path segment for #2090. `reception` stays as it is. */
export const yearSlug = (id) => id.replace(/^year(\d)$/, 'year-$1');

/** A strand's name inside its own year: `Year 1 Number: fractions` → `Number: fractions`. EYFS names are kept. */
const areaName = (name) => name.replace(/^Years? [\d–-]+ /, '');

const topicWord = (n) => `${n} ${n === 1 ? 'topic' : 'topics'}`;
const between = (html, from, to) => html.slice(html.indexOf(from), html.indexOf(to, html.indexOf(from)) + to.length);

/**
 * The home page's skip link, header and footer, with only the current-page mark moved to `currentPath`
 * (`site-home.test.ts` holds every page to the home page's shell).
 */
export function shellFrom(home, currentPath) {
  const unmark = (s) => s.replaceAll(' aria-current="page"', '');
  const mark = (s) => s.replace(`<a href="${currentPath}">`, `<a href="${currentPath}" aria-current="page">`);
  return {
    header: mark(unmark(between(home, '<a class="skip"', '</header>'))),
    footer: mark(unmark(between(home, '<footer', '</footer>'))),
  };
}

/** One subject's table for one year, rows grouped by curriculum area in the strand table's order. */
export function subjectTable(map, year, subject) {
  const label = SUBJECTS.find(([id]) => id === subject)[1];
  const rows = map.topics.filter(t => t.year === year.year && t.subject === subject);
  if (!rows.length) return '';
  const out = [
    '<table>',
    `  <caption>${esc(year.title)} ${esc(label)}: ${topicWord(rows.length)}</caption>`,
    '  <thead><tr><th scope="col">Topic</th><th scope="col">Curriculum objective</th></tr></thead>',
  ];
  for (const area of map.coverage.filter(c => c.subject === subject && c.years.includes(year.year))) {
    const inArea = rows.filter(t => t.strands[0] === area.id);
    if (!inArea.length) continue;
    out.push('  <tbody>', `    <tr><th scope="rowgroup" colspan="2">${esc(areaName(area.name))}</th></tr>`);
    for (const t of inArea) out.push(`    <tr><th scope="row">${esc(t.title)}</th><td>${esc(t.nc)}</td></tr>`);
    out.push('  </tbody>');
  }
  out.push('</table>');
  return out.join('\n');
}

/**
 * The parts of this year's programmes of study that no topic of this year names yet. Counted per year: a strand
 * shared by Years 3 and 4 with topics only in Year 4 is a gap in Year 3.
 */
export function gapsOf(map, year) {
  const named = new Set(map.topics.filter(t => t.year === year.year).flatMap(t => t.strands));
  return map.coverage.filter(c => c.years.includes(year.year) && !named.has(c.id));
}

/** One year: its heading, a maths table, an English table and what is not covered yet. */
export function renderYear(map, year) {
  const slug = yearSlug(year.year);
  const gaps = gapsOf(map, year);
  const label = (s) => SUBJECTS.find(([id]) => id === s)[1];
  const notCovered = gaps.length
    ? ['<ul>', ...gaps.map(c => `  <li>${esc(areaName(c.name))} (${label(c.subject)})</li>`), '</ul>']
    : ['<p>Every part of the curriculum listed for this year has at least one topic.</p>'];
  const body = [
    `<h2 id="${slug}-title">${esc(year.title)}</h2>`,
    `<p>${topicWord(year.maths)} in maths and ${topicWord(year.writing)} in English.</p>`,
    ...SUBJECTS.map(([id]) => subjectTable(map, year, id)).filter(Boolean),
    `<h3>Not covered yet in ${esc(year.title)}</h3>`,
    ...notCovered,
  ];
  return [
    `<section id="${slug}" aria-labelledby="${slug}-title">`,
    '  <div class="wrap">',
    ...body.flatMap(b => b.split('\n')).map(l => `    ${l}`),
    '  </div>',
    '</section>',
  ].join('\n');
}

/** The in-page index: one entry per year, with its counts. */
function yearIndex(map) {
  return [
    '<nav aria-labelledby="index-title">',
    '  <h2 id="index-title">Jump to a year</h2>',
    '  <dl class="facts">',
    ...map.byYear.map(y => `    <div><dt><a href="#${yearSlug(y.year)}">${esc(y.title)}</a></dt><dd>${topicWord(y.maths)} in maths, ${topicWord(y.writing)} in English</dd></div>`),
    '  </dl>',
    '</nav>',
  ].join('\n');
}

/** The whole /curriculum/ page. `home` is website/index.html, the source of the shared shell. */
export function renderCurriculumPage(map, home) {
  const { header, footer } = shellFrom(home, '/curriculum/');
  const covered = map.coverage.filter(c => c.topics.length).length;
  const url = `${ORIGIN}/curriculum/`;
  const title = 'Curriculum: every Sharpwise topic, Reception to Year 6';
  const description = `All ${map.topicCount} Sharpwise maths and English topics, Reception to Year 6, by year and curriculum area, with what is not covered yet.`;
  const ogAlt = 'Sharpwise: a ninja ready to slice the right answer. Free maths and English, Reception to Year 6.';
  const indent = (s, n) => s.split('\n').map(l => (l ? ' '.repeat(n) + l : l)).join('\n');
  const intro = [
    '<section aria-labelledby="page-title">',
    '  <div class="wrap">',
    '    <h1 id="page-title">What Sharpwise covers</h1>',
    `    <p class="lede">Sharpwise has ${map.topicCount} maths and English topics, from Reception to Year 6. Each one is listed below under its school year, with the part of the curriculum it practises.</p>`,
    '    <p>Reception topics follow the EYFS Early Learning Goals. Years 1 to 6 follow the <a href="https://www.gov.uk/government/collections/national-curriculum" rel="noopener">National Curriculum for England</a>. This page is made from the game\'s own list of topics, so it changes when the game does.</p>',
    `    <p>${covered} of the ${map.coverage.length} parts of the curriculum we track have at least one topic. Each year ends with the parts that are not covered yet.</p>`,
    indent(yearIndex(map), 4),
    '  </div>',
    '</section>',
  ].join('\n');
  return `<!doctype html>
<!-- DO NOT EDIT. Generated by \`npm run content-map\` (scripts/site-curriculum.mjs) from docs/content-map.json. -->
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${url}">
  <meta name="theme-color" content="#131a33">
  <link rel="icon" href="/icons/icon-192.webp" type="image/webp">
  <link rel="preload" href="/fonts/fredoka-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/site.css">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Sharpwise">
  <meta property="og:locale" content="en_GB">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${ORIGIN}/share.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(ogAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${ORIGIN}/share.jpg">
  <meta name="twitter:image:alt" content="${esc(ogAlt)}">
</head>
<body>
  ${header}

  <main id="main" tabindex="-1">
${indent(intro, 4)}

${map.byYear.map(y => indent(renderYear(map, y), 4)).join('\n\n')}
  </main>

  ${footer}
</body>
</html>
`;
}
