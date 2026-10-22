import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { validateCatalogue } from '../../src/config/catalogue';
import { CATALOGUE } from './helpers/catalogue-file';
import { applyRows, checkRows, parseRows, reportProblems } from '../../scripts/playability-apply.mjs';
import { PARENT, profilesIn, rowProblems, type PlaytestRow } from '../../scripts/playtest-row.mjs';

// #2206: `scripts/playability-apply.mjs` checks the playtester profiles' rows and writes each score into the
// catalogue with a report behind it; `scripts/playtest-row.mjs` is the row's validator, with #2214's three rules.
// The fixture is the two dry-run rows `playtester-year1` wrote in PR #2211, verbatim. They are applied only to
// `UNSCORED`, a copy of the catalogue with every score cleared (the committed file carries #2207's scores), in
// memory or in a temporary folder.
//
// Prove it red: drop a check from `rowProblems` (its mutation below then passes clean); write a parent row to
// the game-year node; skip the report; read `playability` in any file under src/ui/; delete a report a score names.
const path = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url));
const SCRIPT = path('scripts/playability-apply.mjs');
const AGENTS = path('.claude/agents');
const DATE = '2026-10-22';
const REPORT = `docs/playability/${DATE}/playtester-year1.md`;
type Doc = Record<string, any>;
type Loose = any;   // a hand-broken catalogue copy, for the rails' failure cases
const FIXTURE = readFileSync(path('tests/unit/fixtures/playability-dry-run.jsonl'), 'utf8');
const ROWS = FIXTURE.trim().split('\n').map((l) => JSON.parse(l) as PlaytestRow);
/** The committed catalogue with every `playability` back to null, as it was before the #2207 run scored it. */
const UNSCORED: Loose = structuredClone(CATALOGUE);
for (const n of [...Object.values<Doc>(UNSCORED.years), ...Object.values<Doc>(UNSCORED.games).flatMap((g) => [g, ...Object.values<Doc>(g.years)])]) n.playability = null;
const ctx = { catalogue: UNSCORED, profiles: profilesIn(AGENTS) };
const fresh = (i = 0): Doc => structuredClone(ROWS[i]);

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

/** A scratch repository root: the unscored catalogue, the eight profiles and the fixture rows. */
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'sna-playability-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'src/config'), { recursive: true });
  mkdirSync(join(dir, '.claude/agents'), { recursive: true });
  writeFileSync(join(dir, 'src/config/catalogue.json'), `${JSON.stringify(UNSCORED, null, 2)}\n`);
  for (const f of readdirSync(AGENTS).filter((f) => f.startsWith('playtester-'))) copyFileSync(join(AGENTS, f), join(dir, '.claude/agents', f));
  writeFileSync(join(dir, 'rows.jsonl'), FIXTURE);
  return dir;
}
const run = (dir: string, ...args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: 'utf8' });
const reader = (dir: string) => (p: string) => (existsSync(join(dir, p)) ? readFileSync(join(dir, p), 'utf8') : null);
const catalogueIn = (dir: string) => readFileSync(join(dir, 'src/config/catalogue.json'), 'utf8');

describe('playability-apply on the PR #2211 dry-run rows (#2206)', () => {
  it('writes each score to its game-year node, and nothing else in the catalogue changes', () => {
    const dir = sandbox(), before = JSON.parse(catalogueIn(dir));
    const out = run(dir, 'rows.jsonl', '--date', DATE);
    expect(out.status, out.stderr).toBe(0);
    expect(out.stdout).toContain(`2 score(s) from 2 row(s) written to src/config/catalogue.json; report(s): ${REPORT}`);
    const after = JSON.parse(catalogueIn(dir));
    for (const [game, score] of [['y1-add', 7], ['y1-alien', 4]] as const)
      before.games[game].years.year1.playability = { score, by: 'playtester-year1', at: DATE, report: REPORT };
    expect(after).toEqual(before);
    expect(validateCatalogue(after)).toEqual([]);
    // `before` keeps the original file's key order, so this pins every byte but the two scored nodes.
    expect(catalogueIn(dir), 'the original bytes, with only the two scores filled in').toBe(`${JSON.stringify(before, null, 2)}\n`);
  });

  it('writes the report: the table, the distribution and the evidence, and it backs both scores', () => {
    const dir = sandbox();
    expect(run(dir, 'rows.jsonl', '--date', DATE).status).toBe(0);
    const text = reader(dir)(REPORT)!;
    expect(text).toMatch(/^# Playability: playtester-year1, 2026-10-22\n/);
    expect(text).toContain(`| y1-add | year1 | 7 | ${ROWS[0].note} |`);
    expect(text).toContain(`| y1-alien | year1 | 4 | ${ROWS[1].note} |`);
    expect(text).toContain('| Rows | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 0 | 0 | 0 |');
    expect(text).toContain('2 rows · 8 or above: 0 of 2 (0%).');
    expect(text).toContain('### y1-alien, year1: 4/10\n\nunderstand 1 · physical 0 · challenge 1 · feedback 1 · again 1');
    expect(text.match(/^- \w+ — `/gm)).toHaveLength(ROWS[0].evidence.length + ROWS[1].evidence.length);
    expect(reportProblems(JSON.parse(catalogueIn(dir)), reader(dir))).toEqual([]);
  });

  it('fails on a bad row with a clear message, naming file, line and game, and writes nothing', () => {
    const dir = sandbox(), before = catalogueIn(dir);
    writeFileSync(join(dir, 'bad.jsonl'), `${FIXTURE.replace('"score":7', '"score":8')}{"game":`);
    const out = run(dir, 'bad.jsonl', '--date', DATE);
    expect(out.status).toBe(1);
    expect(out.stderr).toContain('bad.jsonl:1: y1-add: score: 8 is not the sum of the criteria (7)');
    expect(out.stderr).toContain('bad.jsonl:3: not valid JSON on one line (');
    expect(out.stderr).toContain('nothing written');
    expect(catalogueIn(dir)).toBe(before);
    expect(existsSync(join(dir, 'docs'))).toBe(false);
  });

  it('refuses to replace an existing report unless --force; --check validates and writes nothing', () => {
    const dir = sandbox();
    const check = run(dir, 'rows.jsonl', '--date', DATE, '--check');
    expect([check.status, check.stdout.trim()]).toEqual([0, 'playability-apply: 2 row(s) valid; nothing written (--check)']);
    expect(existsSync(join(dir, 'docs'))).toBe(false);
    expect(run(dir, 'rows.jsonl', '--date', DATE).status).toBe(0);
    const scoredOnce = catalogueIn(dir), again = run(dir, 'rows.jsonl', '--date', DATE);
    expect(again.status).toBe(1);
    expect(catalogueIn(dir), 'a report clash writes nothing').toBe(scoredOnce);
    expect(again.stderr).toContain(`${REPORT}: already exists`);
    expect(run(dir, 'rows.jsonl', '--date', DATE, '--check').status, '--check reports the clash too').toBe(1);
    expect(run(dir, 'rows.jsonl', '--date', DATE, '--force').status).toBe(0);
  });

  it('one run with a year profile and the parent writes both nodes and both reports, each backing its own score', () => {
    const dir = sandbox(), parentRow = { ...ROWS[1], by: PARENT, score: 3, criteria: { ...ROWS[1].criteria, again: 0 }, note: 'Good phonics | too fast.' };
    writeFileSync(join(dir, 'parent.jsonl'), `${JSON.stringify(parentRow)}\n`);
    const out = run(dir, 'rows.jsonl', 'parent.jsonl', '--date', DATE);
    expect(out.status, out.stderr).toBe(0);
    expect(out.stdout).toContain(`3 score(s) from 3 row(s) written to src/config/catalogue.json; report(s): ${REPORT}, docs/playability/${DATE}/${PARENT}.md`);
    const c = JSON.parse(catalogueIn(dir));
    expect([c.games['y1-alien'].playability.by, c.games['y1-alien'].playability.score]).toEqual([PARENT, 3]);
    expect([c.games['y1-alien'].years.year1.playability.by, c.games['y1-alien'].years.year1.playability.score]).toEqual(['playtester-year1', 4]);
    const parentReport = reader(dir)(`docs/playability/${DATE}/${PARENT}.md`)!;
    expect(parentReport, 'a pipe in the note is escaped, so the table keeps its columns').toContain('| y1-alien | year1 | 3 | Good phonics \\| too fast. |');
    expect(reportProblems(c, reader(dir))).toEqual([]);
  });

  it.each([
    ['no --date', ['rows.jsonl']], ['an impossible date', ['rows.jsonl', '--date', '2026-02-30']],
    ['no rows file', ['--date', DATE]], ['an unknown flag', ['rows.jsonl', '--date', DATE, '--dry-run']],
  ])('is a usage error, exit 2, with %s', (_what, args) => {
    const dir = sandbox(), out = run(dir, ...args);
    expect([out.status, out.stderr]).toEqual([2, expect.stringContaining('usage: node scripts/playability-apply.mjs')]);
    expect(out.stderr.split('\n')[0], 'the first line names what is wrong').toMatch(/^(--date|no rows file|unknown flag --dry-run)/);
  });

  it('a missing or empty rows file is a problem, not a silent success', () => {
    const dir = sandbox();
    writeFileSync(join(dir, 'empty.jsonl'), '\n\n');
    const out = run(dir, 'empty.jsonl', 'gone.jsonl', '--date', DATE);
    expect(out.status).toBe(1);
    expect(out.stderr).toContain('empty.jsonl: no rows');
    expect(out.stderr).toContain('gone.jsonl: no such file');
  });
});

// ---- The row validator catches each rule ----------------------------------------------------------------------
const Y2_GAME = Object.keys(UNSCORED.games).find((g) => 'year2' in UNSCORED.games[g].years)!;
const without = (r: Doc, k: string) => r.evidence.filter((e: Doc) => e.criterion !== k);
/** [what is wrong, how to break a fresh copy of dry-run row 1 (y1-add, 7), the problem it must produce (prefix)]. */
const MUTATIONS: [string, (r: Doc) => void, string][] = [
  ['a missing key', (r) => { delete r.note; }, 'note: missing'],
  ['an unknown key', (r) => { r.extra = 1; }, 'extra: unknown key'],
  ['an unknown game', (r) => { r.game = 'y1-nope'; }, 'game: "y1-nope" is not a game in the catalogue'],
  ['a game the row\'s year does not hold', (r) => { r.game = Y2_GAME; }, `year: ${Y2_GAME} is not in year1`],
  ['a year that is not a year id', (r) => { r.year = 'year7'; }, 'year: "year7" is not a year id'],
  ['a profile with no agent file', (r) => { r.by = 'playtester-teacher'; }, 'by: "playtester-teacher" is not a profile'],
  ['a year profile scoring another year (#2214)', (r) => { r.by = 'playtester-year2'; }, 'by: playtester-year2 scores only its own year'],
  ['a fractional score', (r) => { r.score = 6.5; }, 'score: must be a whole number from 0 to 10'],
  ['a score above 10', (r) => { r.score = 11; }, 'score: must be a whole number from 0 to 10'],
  ['a score that is not the sum', (r) => { r.score = 8; }, 'score: 8 is not the sum of the criteria (7)'],
  ['a mark above 2', (r) => { r.criteria.again = 3; r.score = 8; }, 'criteria.again: must be 0, 1 or 2'],
  ['a fractional mark', (r) => { r.criteria.again = 1.5; }, 'criteria.again: must be 0, 1 or 2'],
  ['a missing criterion', (r) => { delete r.criteria.again; }, 'criteria.again: missing'],
  ['an unknown criterion', (r) => { r.criteria.fun = 0; }, 'criteria.fun: unknown key'],
  ['criteria as a list', (r) => { r.criteria = [2, 1, 1, 1, 2]; }, 'criteria: must be an object'],
  ['evidence that is not a list', (r) => { r.evidence = {}; }, 'evidence: must be a list'],
  ['an evidence entry that is a bare ref', (r) => { r.evidence.unshift('2-prompt.png'); }, 'evidence[0]: must be { criterion, ref, saw }'],
  ['an evidence entry with an unknown key', (r) => { r.evidence[0].why = 'x'; }, 'evidence[0].why: unknown key'],
  ['an evidence entry for an unknown criterion', (r) => { r.evidence[0].criterion = 'fun'; }, 'evidence[0].criterion: "fun" is not one of'],
  ['a ref that names nothing in a pack', (r) => { r.evidence[0].ref = 'the prompt'; }, 'evidence[0].ref: "the prompt" must name'],
  ['a ref that climbs out of the pack', (r) => { r.evidence[0].ref = '../y1-alien/2-prompt.png'; }, 'evidence[0].ref:'],
  ['an empty saw', (r) => { r.evidence[0].saw = ' '; }, 'evidence[0].saw: must say what the ref shows'],
  ['a live ref that breaks the line to forge a table row', (r) => { r.evidence[0].ref = 'live:\n| y1-add | year1 | 9 |'; }, 'evidence[0].ref:'],
  ['a ref with a carriage return', (r) => { r.evidence[0].ref = 'live: 3 s\r| y1-add | year1 | 9 |'; }, 'evidence[0].ref:'],
  ['a saw with a line separator (U+2028)', (r) => { r.evidence[0].saw = 'six plus one\u2028| y1-add | year1 | 9 |'; }, 'evidence[0].saw: must say what the ref shows'],
  ['a note with a paragraph separator (U+2029)', (r) => { r.note = 'Good sums.\u2029| y1-add | year1 | 9 |'; }, 'note: must be one sentence on one line'],
  ['a criterion seen only as "not-observed"', (r) => { r.evidence = [...without(r, 'again'), { criterion: 'again', ref: '6-result.png', saw: 'not-observed' }]; },
    'evidence: every entry for again is "not observed"'],
  ['a saw on two lines', (r) => { r.evidence[0].saw = 'six plus one\n- understand — fake'; }, 'evidence[0].saw: must say what the ref shows'],
  ['a criterion with no evidence', (r) => { r.evidence = without(r, 'again'); }, 'evidence: no entry for again'],
  ['a criterion seen only as "not observed" (#2214)', (r) => { r.evidence = [...without(r, 'again'), { criterion: 'again', ref: '6-result.png', saw: 'Not observed: no result screen' }]; },
    'evidence: every entry for again is "not observed"'],
  ['an empty note', (r) => { r.note = ''; }, 'note: must be one sentence on one line'],
  ['a note on two lines', (r) => { r.note = 'Good sums.\nToo fast.'; }, 'note: must be one sentence on one line'],
  ['the parent with again above challenge (#2214)', (r) => { r.by = PARENT; }, "criteria.again: the parent's cap"],
  ['the parent with feedback 0 and again above 0 (#2214)', (r) => { r.by = PARENT; Object.assign(r.criteria, { challenge: 2, feedback: 0, again: 1 }); r.score = 6; },
    "criteria.again: the parent's gate"],
];

describe('rowProblems holds each row to the skill and #2214 (#2206)', () => {
  it('passes both dry-run rows as written, "not observed" entries beside observed ones included', () => {
    expect(ROWS.map((r) => rowProblems(r, ctx))).toEqual([[], []]);
    expect(ROWS[0].evidence.some((e) => e.criterion === 'physical' && e.saw.startsWith('not observed')), 'the fixture exercises the mixed case').toBe(true);
  });

  it.each(MUTATIONS)('%s', (_what, mutate, expected) => {
    const row = fresh();
    mutate(row);
    const errs = rowProblems(row, ctx);
    expect(errs.some((e) => e.startsWith(expected)), `expected a line starting "${expected}", got:\n${errs.join('\n')}`).toBe(true);
  });

  it('a non-object is one problem, not a throw; a prototype key is not a game', () => {
    for (const bad of [null, 7, 'row', []]) expect(rowProblems(bad, ctx)).toEqual(['must be a JSON object, one per line']);
    expect(rowProblems({ ...fresh(), game: 'constructor' }, ctx)).toEqual(['game: "constructor" is not a game in the catalogue']);
  });

  it('returns every problem rather than the first', () => {
    const picked = ['a year profile scoring another year (#2214)', 'a score that is not the sum', 'an empty saw', 'a note on two lines'];
    const row = fresh();
    for (const w of picked) MUTATIONS.find(([what]) => what === w)![1](row);
    expect(rowProblems(row, ctx)).toHaveLength(picked.length);
  });

  it('accepts a parent row within both caps, scoring any year its game is in', () => {
    expect(rowProblems({ ...fresh(1), by: PARENT }, ctx)).toEqual([]);
  });

  it('checkRows reports bad rows once each, never as duplicates of each other, and never throws', () => {
    const parsed = parseRows('\uFEFFnull\nnull\n{}\n{}\n{"game":,}\n', 'r.jsonl');
    expect(parsed.problems).toEqual([expect.stringMatching(/^r\.jsonl:5: not valid JSON on one line \(.+\)$/)]);
    expect(checkRows(parsed.rows, ctx).filter((p) => p.includes('already scored'))).toEqual([]);
    expect(checkRows(parsed.rows, ctx).filter((p) => p.endsWith('must be a JSON object, one per line'))).toHaveLength(2);
  });

  it('checkRows tags each problem with file, line and game, and refuses one pack scored twice', () => {
    const parsed = parseRows(`${FIXTURE}\n${JSON.stringify(ROWS[0])}\n`, 'rows.jsonl');
    expect(parsed.problems).toEqual([]);
    expect(checkRows(parsed.rows, ctx)).toEqual(['rows.jsonl:4: y1-add: playtester-year1 already scored y1-add for year1 at rows.jsonl:1']);
  });
});

describe('applyRows: where each profile\'s score goes (#2206, #2214)', () => {
  /** A valid parent row on y1-alien (4 = dry-run row 2's marks); the marks add the extra points to `understand` and `physical`. */
  const parent = (year: string, score: number): PlaytestRow => ({ ...ROWS[1], by: PARENT, year, score,
    criteria: { ...ROWS[1].criteria, understand: Math.min(2, score - 3), physical: Math.max(0, score - 5) } });

  it("writes the parent's row to the game itself, and leaves its game-year node alone", () => {
    const { catalogue, reports } = applyRows(UNSCORED, [parent('year1', 4)], DATE);
    expect(catalogue.games['y1-alien'].playability).toEqual({ score: 4, by: PARENT, at: DATE, report: `docs/playability/${DATE}/${PARENT}.md` });
    expect(catalogue.games['y1-alien'].years.year1!.playability).toBeNull();
    expect(reports.map((r) => r.path)).toEqual([`docs/playability/${DATE}/${PARENT}.md`]);
    expect(UNSCORED.games['y1-alien'].playability, 'the input is not mutated').toBeNull();
  });

  it('several parent rows on one game: the lowest wins, the earliest year on a tie, and the report names it', () => {
    const two: Loose = structuredClone(UNSCORED);
    two.games['y1-alien'].years.year2 = { visible: true, settings: {}, playability: null };
    const rows = [parent('year1', 6), parent('year2', 4)];
    expect(checkRows(rows.map((row, i) => ({ row, where: `p.jsonl:${i + 1}` })), { ...ctx, catalogue: two }), 'both rows pass the validator first').toEqual([]);
    const low = applyRows(two, rows, DATE);
    expect(low.catalogue.games['y1-alien'].playability.score).toBe(4);
    expect(low.reports[0].text).toContain('the catalogue took the lowest: y1-alien (year2).');
    expect(low.reports[0].text).toMatch(/\| y1-alien \| year1 \| 6 \|[^\n]*\n\| y1-alien \| year2 \| 4 \|/);
    const tie = applyRows(two, [parent('year2', 5), parent('year1', 5)], DATE);
    expect(tie.reports[0].text).toContain('the catalogue took the lowest: y1-alien (year1).');
    const read = (p: string) => low.reports.find((r) => r.path === p)?.text ?? null;
    expect(reportProblems(low.catalogue, read)).toEqual([]);
    low.catalogue.games['y1-alien'].playability.score = 6;   // a hand edit to the year the parent did not take
    expect(reportProblems(low.catalogue, read)).toEqual([`games.y1-alien.playability: docs/playability/${DATE}/${PARENT}.md does not give y1-alien 6 as its lowest score`]);
  });

  it('marks a bunched run in the distribution, over the skill\'s 40% line', () => {
    const top = { ...ROWS[0], score: 9 };
    expect(applyRows(UNSCORED, [top, ROWS[1]], DATE).reports[0].text).toContain("8 or above: 1 of 2 (50%) — over the skill's 40% honesty line");
  });
});

// ---- The rails: playability is read-only, and every score is backed ---------------------------------------------
/**
 * The set: everything that shows the game or the site to a player — `src/ui/`, `src/game/`, `src/three/`, the
 * site under `website/` and the scripts that build it (`scripts/site-*.mjs`). None may name `playability`
 * (#2192: nothing displays it yet). A text check: a whole-node spread carries it without the word, and is not
 * caught here. The user patch rail (no patch writes it) is #2199's acceptance criterion, with the patch API.
 */
describe('rail: nothing that shows the game reads playability (#2206)', () => {
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : /\.(ts|mjs|js|html|txt|xml|json|css)$/.test(e.name) ? [join(dir, e.name)] : []));
  const files = [...['src/ui', 'src/game', 'src/three', 'website'].flatMap((d) => walk(path(d))),
    ...readdirSync(path('scripts')).filter((f) => /^site-.*\.mjs$/.test(f)).map((f) => path(`scripts/${f}`))];

  it('walks a real set, or the check below would pass on nothing', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => f.includes('/scripts/site-'))).toBe(true);
  });

  it('no file in the set names playability', () => {
    expect(files.filter((f) => /playability/i.test(readFileSync(f, 'utf8'))).map((f) => f.slice(path('').length))).toEqual([]);
  });
});

describe('rail: every non-null score has a report that lists it (#2206)', () => {
  it('holds for the committed catalogue', () => {
    expect(reportProblems(CATALOGUE, (p) => (existsSync(path(p)) ? readFileSync(path(p), 'utf8') : null))).toEqual([]);
  });

  const scoredCopy = () => {
    const out = applyRows(UNSCORED, ROWS, DATE) as { catalogue: Loose; reports: { path: string; text: string }[] };
    const files = new Map(out.reports.map((r) => [r.path, r.text]));
    return { c: out.catalogue, files, read: (p: string) => files.get(p) ?? null };
  };

  it('catches a missing report, a report without the game, a different score, and a report named for someone else', () => {
    const gone = scoredCopy();
    gone.files.clear();
    expect(reportProblems(gone.c, gone.read)).toEqual([
      `games.y1-add.years.year1.playability.report: ${REPORT} does not exist`,
      `games.y1-alien.years.year1.playability.report: ${REPORT} does not exist`,
    ]);
    const cut = scoredCopy();
    cut.files.set(REPORT, cut.files.get(REPORT)!.replace(/^\| y1-alien \|.*$/m, ''));
    expect(reportProblems(cut.c, cut.read)).toEqual([`games.y1-alien.years.year1.playability: ${REPORT} has no row for y1-alien in year1 scoring 4`]);
    const moved = scoredCopy();
    moved.c.games['y1-add'].years.year1.playability.score = 8;
    expect(reportProblems(moved.c, moved.read)).toEqual([`games.y1-add.years.year1.playability: ${REPORT} has no row for y1-add in year1 scoring 8`]);
    const other = scoredCopy();
    other.c.games['y1-add'].years.year1.playability.by = 'playtester-year2';
    expect(reportProblems(other.c, other.read)[0]).toBe(`games.y1-add.years.year1.playability.report: ${REPORT} is not docs/playability/${DATE}/playtester-year2.md`);
  });

  it('reads only the score table: a matching line elsewhere in the report does not back a score', () => {
    const forged = scoredCopy();
    forged.c.games['y1-add'].years.year1.playability.score = 8;
    forged.files.set(REPORT, `${forged.files.get(REPORT)!}\n| y1-add | year1 | 8 | planted below the evidence |\n`);
    expect(reportProblems(forged.c, forged.read)).toEqual([`games.y1-add.years.year1.playability: ${REPORT} has no row for y1-add in year1 scoring 8`]);
  });

  it('a scored island needs its report too', () => {
    const island = scoredCopy();
    island.c.years.year1.playability = { score: 5, by: 'playtester-year1', at: DATE, report: `docs/playability/${DATE}/playtester-year1.md` };
    expect(reportProblems(island.c, island.read)).toEqual([]);
    island.files.clear();
    expect(reportProblems(island.c, island.read)).toContain(`years.year1.playability.report: ${REPORT} does not exist`);
  });
});
