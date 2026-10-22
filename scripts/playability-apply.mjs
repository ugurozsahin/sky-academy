// `node scripts/playability-apply.mjs <rows.jsonl…> --date YYYY-MM-DD [--check] [--force]` (#2206, epic #2192):
// takes the playtester profiles' rows (`.claude/skills/playtest/SKILL.md` §4), checks every one with
// `playtest-row.mjs`, and writes each score into `src/config/catalogue.json` with a report behind it.
//
// - A year profile's row goes to `games.<id>.years.<year>.playability`; the parent's to `games.<id>.playability`.
// - Each profile's rows become one report, `docs/playability/<date>/<profile>.md`: a table of game, year, score
//   and note, the score distribution, then each game's marks and evidence. Every `playability.report` names it.
// - **Several parent rows for one game** (a game in more than one year, scored from each year's pack): the game
//   takes the lowest score, the earliest year on a tie; the report lists every row and names the year applied.
//   A parent judges whether a game is worth the child's time, and the weakest year is the one that decides that.
//   The rule holds within one run: a later run's score replaces the game's, as a rescore does, so a parent run
//   passes all of a game's years together. (Every game sits in one year today, so it cannot fire yet.)
// - All or nothing: any bad row, a pack scored twice, or a report that already exists (without `--force`) stops
//   the run before anything is written, with every problem listed. `--check` validates and writes nothing.
// - Paths are relative to the working directory (the repository root), as in `catalogue-init.mjs`.
//
// Exit 0 = written (or valid, with --check); 1 = a row or report problem, nothing written; 2 = bad usage.
// The rails are in `tests/unit/playability-apply.test.ts`: nothing that displays the game reads `playability`,
// and every non-null score has a report that lists it (`reportProblems` below).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRITERIA, PARENT, profilesIn, rowProblems } from './playtest-row.mjs';

export const CATALOGUE_FILE = 'src/config/catalogue.json';
const AGENTS = '.claude/agents';
const SCORES = Array.from({ length: 11 }, (_, i) => i);
const TABLE_HEAD = '| Game | Year | Score | Note |';

/** A YYYY-MM-DD that is a real date, the rule `catalogue.ts` holds `playability.at` to. */
export const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().startsWith(v);
export const reportPath = (date, profile) => `docs/playability/${date}/${profile}.md`;

/** JSON Lines → `{ row, where }`; blank lines are skipped, and a line that is not JSON is a problem. */
export function parseRows(text, file) {
  const rows = [], problems = [];
  text.split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    const text = i === 0 ? line.replace(/^\uFEFF/, '') : line;   // a byte-order mark some editors write
    try { rows.push({ row: JSON.parse(text), where: `${file}:${i + 1}` }); } catch (e) { problems.push(`${file}:${i + 1}: not valid JSON on one line (${e.message})`); }
  });
  if (!rows.length && !problems.length) problems.push(`${file}: no rows`);
  return { rows, problems };
}

/** Every bad row and every pack scored twice, as `file:line: game: problem` lines. */
export function checkRows(parsed, ctx) {
  const problems = [], seen = new Map();
  for (const { row, where } of parsed) {
    const tag = `${where}: ${row?.game ?? '?'}`, own = rowProblems(row, ctx);
    problems.push(...own.map((p) => `${tag}: ${p}`));
    if (own.length) continue;   // only a valid row can be a duplicate
    const key = `${row?.by}|${row?.game}|${row?.year}`;
    if (seen.has(key)) problems.push(`${tag}: ${row.by} already scored ${row.game} for ${row.year} at ${seen.get(key)}`);
    else seen.set(key, where);
  }
  return problems;
}

/** The row each catalogue node takes: one per game-year for a year profile; the parent's lowest per game. */
function applied(rows, order) {
  const best = new Map();
  for (const r of rows) {
    const key = r.by === PARENT ? r.game : `${r.game}|${r.year}`, cur = best.get(key);
    if (!cur || r.score < cur.score || (r.score === cur.score && order.indexOf(r.year) < order.indexOf(cur.year))) best.set(key, r);
  }
  return [...best.values()];
}

const cell = (s) => s.replace(/\|/g, '\\|');

function distribution(rows) {
  const count = SCORES.map((s) => rows.filter((r) => r.score === s).length), top = rows.filter((r) => r.score >= 8).length;
  const share = Math.round((100 * top) / rows.length);
  return [
    '## Distribution', '',
    `| Score | ${SCORES.join(' | ')} |`, `|---|${SCORES.map(() => '---').join('|')}|`, `| Rows | ${count.join(' | ')} |`, '',
    `${rows.length} rows · 8 or above: ${top} of ${rows.length} (${share}%)${share > 40 ? ' — over the skill\'s 40% honesty line (§3), so each top score must have been re-justified' : ''}.`,
  ];
}

function evidence(r) {
  return [
    `### ${r.game}, ${r.year}: ${r.score}/10`, '',
    CRITERIA.map((k) => `${k} ${r.criteria[k]}`).join(' · '), '',
    ...r.evidence.map((e) => `- ${e.criterion} — \`${e.ref}\`: ${e.saw}`), '',
  ];
}

/** The Markdown report for one profile's rows, in catalogue order. `chosen` is the rows the catalogue took. */
export function renderReport(profile, date, rows, chosen) {
  const scope = profile === PARENT
    ? 'the parent\'s score is each game\'s own `games.<id>.playability`; a game scored in more than one year takes its lowest'
    : 'a year profile\'s score is the game-year node\'s `games.<id>.years.<year>.playability`';
  const several = rows.filter((r) => !chosen.includes(r)).map((r) => r.game);
  const lines = [
    `# Playability: ${profile}, ${date}`, '',
    `Scored by the \`${profile}\` profile under the \`playtest\` skill (\`.claude/skills/playtest/SKILL.md\`) from each game's play pack, and written into \`${CATALOGUE_FILE}\` by \`scripts/playability-apply.mjs\` (#2206): ${scope}.`, '',
    TABLE_HEAD, '|---|---|---|---|',
    ...rows.map((r) => `| ${r.game} | ${r.year} | ${r.score} | ${cell(r.note)} |`), '',
    ...(several.length ? [`Scored in more than one year, so the catalogue took the lowest: ${[...new Set(several)].map((g) => `${g} (${chosen.find((r) => r.game === g).year})`).join(', ')}.`, ''] : []),
    ...distribution(rows), '',
    '## Evidence', '',
    ...rows.flatMap(evidence),
  ];
  return `${lines.join('\n').trimEnd()}\n`;
}

/**
 * Applies validated rows to a copy of `catalogue`: returns the new catalogue, `{ path, text }` per report and
 * the number of nodes written. Precondition: the rows passed `checkRows` with no problem; it is not re-checked.
 */
export function applyRows(catalogue, rows, date) {
  const next = structuredClone(catalogue), reports = [];
  let written = 0;
  const gameOrder = Object.keys(catalogue.games), yearOrder = Object.values(catalogue.groups).flat();
  const sorted = [...rows].sort((a, b) => gameOrder.indexOf(a.game) - gameOrder.indexOf(b.game) || yearOrder.indexOf(a.year) - yearOrder.indexOf(b.year));
  for (const profile of [...new Set(sorted.map((r) => r.by))]) {
    const mine = sorted.filter((r) => r.by === profile), chosen = applied(mine, yearOrder), report = reportPath(date, profile);
    for (const r of chosen) {
      const value = { score: r.score, by: r.by, at: date, report };
      if (r.by === PARENT) next.games[r.game].playability = value;
      else next.games[r.game].years[r.year].playability = value;
    }
    written += chosen.length;
    reports.push({ path: report, text: renderReport(profile, date, mine, chosen) });
  }
  return { catalogue: next, reports, written };
}

/** Every non-null `playability` in `catalogue`, as `[where, value, game]`. */
function scored(catalogue) {
  const out = [];
  for (const [id, y] of Object.entries(catalogue.years)) if (y.playability) out.push([`years.${id}`, y.playability, null]);
  for (const [id, g] of Object.entries(catalogue.games)) {
    if (g.playability) out.push([`games.${id}`, g.playability, id]);
    for (const [y, n] of Object.entries(g.years)) if (n?.playability) out.push([`games.${id}.years.${y}`, n.playability, id, y]);
  }
  return out;
}

/** The lines of a report's score table only, split on `\n` alone: text elsewhere in the report can never count. */
function tableRows(text) {
  const lines = text.split('\n'), start = lines.indexOf(TABLE_HEAD);
  if (start < 0) return [];
  const rest = lines.slice(start + 2), end = rest.findIndex((l) => !l.startsWith('| '));
  return end < 0 ? rest : rest.slice(0, end);
}

/**
 * The rail behind "every score has a report": each non-null playability names `docs/playability/<at>/<by>.md`,
 * that file exists (`read` returns its text, or null), and its table backs the score: a game-year node's row
 * (game, year, score), or for a game's own score the lowest of its rows there. `[]` means every score is backed.
 */
export function reportProblems(catalogue, read) {
  const problems = [];
  for (const [where, p, game, year] of scored(catalogue)) {
    if (p.report !== reportPath(p.at, p.by)) problems.push(`${where}.playability.report: ${p.report} is not ${reportPath(p.at, p.by)}`);
    const text = read(p.report);
    if (text === null) { problems.push(`${where}.playability.report: ${p.report} does not exist`); continue; }
    if (!game) continue;
    const listed = tableRows(text).map((l) => new RegExp(`^\\| ${game} \\| ([a-z0-9]+) \\| (\\d+) \\|`).exec(l)).filter(Boolean).map((m) => ({ year: m[1], score: Number(m[2]) }));
    if (year && !listed.some((r) => r.year === year && r.score === p.score)) problems.push(`${where}.playability: ${p.report} has no row for ${game} in ${year} scoring ${p.score}`);
    // A game's own score is the parent's lowest across the years it scored (the rule in the header).
    if (!year && (!listed.length || Math.min(...listed.map((r) => r.score)) !== p.score))
      problems.push(`${where}.playability: ${p.report} does not give ${game} ${p.score} as its lowest score`);
  }
  return problems;
}

const readOrNull = (path) => (existsSync(path) ? readFileSync(path, 'utf8') : null);

/** The CLI, as a function of its arguments and the working directory; returns the exit code. */
export function main(argv, log = console.log, warn = console.error) {
  const at = argv.indexOf('--date'), date = at >= 0 ? argv[at + 1] : undefined;
  const files = argv.filter((a, i) => !a.startsWith('--') && !(at >= 0 && i === at + 1));
  const unknown = argv.filter((a) => a.startsWith('--') && !['--date', '--check', '--force'].includes(a));
  const wrong = [...unknown.map((a) => `unknown flag ${a}`), ...(!date || isDate(date) ? [] : [`--date ${JSON.stringify(date)} is not a real YYYY-MM-DD`]),
    ...(date ? [] : ['--date YYYY-MM-DD is required']), ...(files.length ? [] : ['no rows file given'])];
  if (wrong.length) {
    for (const w of wrong) warn(w);
    warn('usage: node scripts/playability-apply.mjs <rows.jsonl…> --date YYYY-MM-DD [--check] [--force]');
    return 2;
  }
  const catalogue = JSON.parse(readFileSync(CATALOGUE_FILE, 'utf8'));
  const parsed = files.map((f) => (existsSync(f) ? parseRows(readFileSync(f, 'utf8'), f) : { rows: [], problems: [`${f}: no such file`] }));
  const rows = parsed.flatMap((p) => p.rows);
  const problems = [...parsed.flatMap((p) => p.problems), ...checkRows(rows, { catalogue, profiles: profilesIn(AGENTS) })];
  const out = problems.length ? null : applyRows(catalogue, rows.map((r) => r.row), date);
  if (out && !argv.includes('--force')) for (const { path } of out.reports) if (existsSync(path)) problems.push(`${path}: already exists; pass all of a profile's rows for a date in one run, or --force to replace it`);
  if (out && !problems.length) {
    const pending = new Map(out.reports.map((r) => [r.path, r.text]));
    problems.push(...reportProblems(out.catalogue, (p) => pending.get(p) ?? readOrNull(p)));
  }
  if (problems.length) {
    for (const p of problems) warn(p);
    warn(`playability-apply: ${problems.length} problem(s) in ${rows.length} row(s); nothing written`);
    return 1;
  }
  if (argv.includes('--check')) { log(`playability-apply: ${rows.length} row(s) valid; nothing written (--check)`); return 0; }
  for (const { path, text } of out.reports) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); }
  writeFileSync(CATALOGUE_FILE, `${JSON.stringify(out.catalogue, null, 2)}\n`);
  log(`playability-apply: ${out.written} score(s) from ${rows.length} row(s) written to ${CATALOGUE_FILE}; report(s): ${out.reports.map((r) => r.path).join(', ')}`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)));
