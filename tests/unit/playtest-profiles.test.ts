import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { YEARS } from '../../src/curriculum/types';
import { CATALOGUE } from './helpers/catalogue-file';
import { CRITERIA, ROW_KEYS, profilesIn, rowProblems } from '../../scripts/playtest-row.mjs';
import { PLAYTESTERS } from './helpers/playtest';

/**
 * #2204 — the playtest skill and its eight profiles. `governance.test.ts` holds them on the allow-list and pins
 * their descriptions; this holds what the later items of #2192 rely on: one profile per `YearId` plus the
 * parent, the row the skill defines (#2206 validates against it), sources cited by link, and no Edit or Write
 * tool. Bash stays, to drive the live game, so a profile's one guard against writing is its prompt's own line,
 * pinned below (#2213).
 */
const root = new URL('../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');
const SKILL = read('.claude/skills/playtest/SKILL.md');
const CHILD = YEARS.map((y) => `playtester-${y.id}`);   // driven by the registry, so a new year needs a profile
const PROFILES = [...CHILD, 'playtester-parent'];
const KEYS = CRITERIA;   // the row's one home in code is scripts/playtest-row.mjs, which #2206 applies (#2214)
const body = (name: string) => read(`.claude/agents/${name}.md`);
const links = (text: string) => [...new Set([...text.matchAll(/\]\((https:\/\/[^)\s]+)\)/g)].map((m) => m[1]))];
// #2213: what counts as "a published study" — a DOI, PubMed, ERIC, or a paper PDF on its author's own site. A
// blog or news link is not one. A new author site is an edit to this list, so a reviewer reads it.
const AUTHOR_PDF_HOSTS = ['lisa-anthony.com'];
const isStudy = (u: string) => {
  const { hostname: h, pathname } = new URL(u);
  return h === 'doi.org' || h === 'pubmed.ncbi.nlm.nih.gov' || h === 'eric.ed.gov' || h === 'files.eric.ed.gov'
    || (AUTHOR_PDF_HOSTS.includes(h) && pathname.endsWith('.pdf'));
};

describe('playtest profiles (#2204)', () => {
  it('there is exactly one profile per year group, plus the parent', () => {
    const onDisk = readdirSync(new URL('.claude/agents/', root)).filter((f) => f.startsWith('playtester-')).map((f) => f.replace(/\.md$/, ''));
    expect(onDisk.sort()).toEqual([...PROFILES].sort());
    expect([...PLAYTESTERS].sort(), 'the allow-list in helpers/playtest.ts names the same eight').toEqual([...PROFILES].sort());
  });

  it.each(PROFILES)('%s has no Edit or Write tool', (name) => {
    const tools = /^tools:[ \t]+(.+)$/m.exec(body(name));
    expect(tools, `${name} must name its tools, or it inherits Edit and Write`).not.toBeNull();
    const list = tools![1].split(',').map((t) => t.trim());
    expect(list.filter((t) => !['Read', 'Glob', 'Grep', 'Bash'].includes(t)), `${name}: a playtester never edits code`).toEqual([]);
  });

  it.each(PROFILES)('%s keeps its no-writing line, its only guard while it holds Bash (#2213)', (name) => {
    expect(body(name)).toContain('Read code, packs and the catalogue; never change any of them.');
  });

  it.each(PROFILES)('%s scores under the playtest skill and signs its rows with its own name', (name) => {
    const text = body(name);
    expect(text, `${name} must send the scorer to the skill that holds the rubric`).toMatch(/`playtest` skill/);
    expect(text, `${name} must state its own \`by\` value, which #2206 matches to this file`).toContain(`"by": "${name}"`);
  });

  it.each(CHILD)('%s cites at least three official GOV.UK sources and one published study, by link', (name) => {
    const all = links(body(name));
    const gov = all.filter((u) => u.startsWith('https://www.gov.uk/') || u.startsWith('https://assets.publishing.service.gov.uk/')
      || u.startsWith('https://explore-education-statistics.service.gov.uk/'));
    expect(gov.length, `${name}: the acceptance criterion is three official sources, linked`).toBeGreaterThanOrEqual(3);
    expect(all.filter(isStudy).length, `${name}: motor and reaction-time norms need a published study (DOI, PubMed, ERIC or an author's PDF)`).toBeGreaterThanOrEqual(1);
  });

  it('the parent cites at least one published study, by link (#2213)', () => {
    expect(links(body('playtester-parent')).filter(isStudy).length, 'the parent\'s pressure and anxiety claims rest on a study').toBeGreaterThanOrEqual(1);
  });

  it('the parent profile states how it reweights the rubric: two caps that keep the sum', () => {
    const parent = body('playtester-parent');
    expect(parent).toMatch(/reweight/i);
    expect(parent, 'learning value counts twice').toMatch(/`again` may not be higher than `challenge`/);
    expect(parent, 'safety and calm is a gate').toMatch(/if `feedback` is 0, `again` is 0 too/);
  });
});

describe('the playtest skill (#2204)', () => {
  it('defines five criteria, each 0 to 2, summed to a whole score out of 10', () => {
    for (const k of KEYS) expect(SKILL, `the rubric table names \`${k}\``).toContain(`| \`${k}\` |`);
    expect(SKILL.match(/^\| `\w+` \|/gm), 'exactly five rows, or "out of 10" stops being true').toHaveLength(5);
    expect(SKILL).toMatch(/five criteria, 0 to 2 each, summed to a whole score out of 10/);
  });

  it('anchors each criterion at 0, 1 and 2, and the whole score at 3, 5, 7 and 9', () => {
    for (const k of KEYS) {
      const at = SKILL.indexOf(`**\`${k}\`**`);
      expect(at, `anchors for ${k}`).toBeGreaterThan(-1);
      const block = SKILL.slice(at, SKILL.indexOf('\n\n', at + 10) < 0 ? undefined : SKILL.indexOf('\n\n', at + 10));
      for (const m of ['0', '1', '2']) expect(block, `${k} has a ${m} anchor`).toContain(`- **${m}** —`);
    }
    for (const s of ['3', '5', '7', '9']) expect(SKILL).toContain(`- **${s}** —`);
  });

  it('keeps the evidence and honesty rules', () => {
    expect(SKILL).toMatch(/A mark with no evidence is a 0/);
    expect(SKILL).toMatch(/"not observed", never guessed/);
    expect(SKILL).toMatch(/more than 40% of one profile's games score 8 or above/);
  });

  it('marks `physical` on a band, not a cliff, and estimates later stages one way (#2245)', () => {
    const at = SKILL.indexOf('**`physical`**');
    const anchors = SKILL.slice(at, SKILL.indexOf('\n\n', at)).replace(/\s+/g, ' ');
    expect(anchors, 'a clear miss is below 75% of the need').toMatch(/- \*\*0\*\* — The stage-1 reach is below \*\*75%\*\* of the need/);
    expect(anchors, 'a near miss is a 1').toMatch(/- \*\*1\*\* — The stage-1 reach is 75% to 100% of the need/);
    expect(anchors, 'a 2 needs every stage, not only the one the pack played').toMatch(/- \*\*2\*\* — Every stage's estimated reach meets the need/);
    expect(anchors, 'the mark cites its numbers').toContain('`saw` states the need, the reach and the percentage');
    expect(SKILL, 'the later-stage estimate is one formula').toContain('`reach_k ≈ reach_1 × airTime[speeds[k]] / airTime[speeds[0]]`');
    expect(SKILL, 'and says how a speed indexes the table').toContain('A `speeds` value indexes `airTime` from 0');
    const row = JSON.parse(/```json\n(\{.*\})\n```/.exec(SKILL)![1]);
    const saw = row.evidence.filter((e: { criterion: string }) => e.criterion === 'physical').map((e: { saw: string }) => e.saw).join(' ');
    expect(saw, 'the example row shows the evidence wording it asks for').toMatch(/need [\d.]+ s, reach [\d.]+ s, \d+%/);
  });

  it('its example row is a valid row: the five keys, the sum, evidence, and a profile as `by`', () => {
    const json = /```json\n(\{.*\})\n```/.exec(SKILL);
    expect(json, 'the skill shows one example row').not.toBeNull();
    const row = JSON.parse(json![1]);
    expect(Object.keys(row).sort()).toEqual(['by', 'criteria', 'evidence', 'game', 'note', 'score', 'year']);
    expect([...ROW_KEYS].sort(), 'the validator #2206 runs names the same seven keys').toEqual(Object.keys(row).sort());
    expect(rowProblems(row, { catalogue: CATALOGUE, profiles: profilesIn(fileURLToPath(new URL('.claude/agents/', root))) }), 'and passes the example as written').toEqual([]);
    expect(Object.keys(row.criteria).sort()).toEqual([...KEYS].sort());
    expect(Object.values<number>(row.criteria).reduce((a, b) => a + b, 0)).toBe(row.score);
    for (const v of Object.values(row.criteria)) expect([0, 1, 2], 'each criterion is a whole mark from 0 to 2').toContain(v);
    expect(Number.isInteger(row.score) && row.score >= 0 && row.score <= 10).toBe(true);
    for (const e of row.evidence) {
      expect(Object.keys(e).sort(), 'an evidence entry is { criterion, ref, saw }').toEqual(['criterion', 'ref', 'saw']);
      expect(KEYS).toContain(e.criterion);
      expect(e.ref && e.saw, 'ref and saw say something').toBeTruthy();
    }
    for (const k of KEYS) expect(row.evidence.filter((e: { criterion: string }) => e.criterion === k).length, `the example cites evidence for ${k}`).toBeGreaterThan(0);
    expect(PROFILES).toContain(row.by);
    expect(row.by === `playtester-${row.year}` || row.by === 'playtester-parent', 'a year profile scores only its own year (#2213)').toBe(true);
    expect(YEARS.map((y) => y.id)).toContain(row.year);
  });
});
