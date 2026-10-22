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
// #2243: the target line under "Your working floors" — its first sub-bullet — names two sizes, each
// "**N mm (… a R px radius)**"; the one followed by "or more is comfortable" is the comfortable size, the other the floor.
type Size = { mm: number; radius: number; across?: number };
const workingFloors = (text: string): { floor: Size; comfortable: Size } | null => {
  const block = /\*\*Your working floors\*\*[^\n]*\n {2}- ([\s\S]*?)(?=\n {2}- |\n\n|$)/.exec(text);
  if (!block) return null;
  const sizes = [...block[1].replace(/\s+/g, ' ').matchAll(/\*\*([\d.]+) mm \((?:about (\d+) CSS px across, )?a (\d+) px radius\)\*\*( or more is comfortable)?/g)]
    .map((m) => ({ mm: Number(m[1]), radius: Number(m[3]), across: m[2] ? Number(m[2]) : undefined, comfy: !!m[4] }));
  const comfortable = sizes.filter((s) => s.comfy), floor = sizes.filter((s) => !s.comfy);
  return sizes.length === 2 && comfortable.length === 1 ? { floor: floor[0], comfortable: comfortable[0] } : null;
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

  it.each(CHILD)('%s states a target floor below its comfortable size, each in mm and a matching radius (#2243)', (name) => {
    const floors = workingFloors(body(name));
    expect(floors, `${name}: the "Your working floors" target line names a floor and a comfortable size`).not.toBeNull();
    const { floor, comfortable } = floors!;
    expect(floor.radius, `${name}: a floor at or above "comfortable" fails every game on \`physical\``).toBeLessThan(comfortable.radius);
    for (const s of [floor, comfortable]) {
      expect(s.radius, `${name}: ${s.mm} mm at the profile's own 6 CSS px per mm is a ${s.mm * 3} px radius`).toBe(s.mm * 3);
      if (s.across !== undefined) expect(s.across, `${name}: ${s.across} px across is not twice a ${s.radius} px radius`).toBe(s.radius * 2);
    }
  });

  it('the Reception floor and comfortable size follow the hit rates it quotes (#2243)', () => {
    // Read from the profile's own Targets line (Hourcade et al., 2004, Table VI): 4-year-olds at three sizes, then
    // 5-year-olds at the same three. The floor claims "a miss as often as a hit", so it sits within 1 mm of where the
    // 4-year-olds' rate crosses 50% (straight line between the two quoted points either side). "Comfortable" is the
    // middle the profile argues for: above the size where 5-year-olds reach 90%, below the one where 4-year-olds do.
    const text = body('playtester-reception').replace(/\s+/g, ' ');
    const rates = /4-year-olds hit 16 px \(([\d.]+) mm\) targets (\d+)% of the time, 32 px \(([\d.]+) mm\) (\d+)% and 64 px \(([\d.]+) mm\) (\d+)%; 5-year-olds (\d+)%, (\d+)% and (\d+)%/.exec(text);
    expect(rates, 'the Targets line quotes 4- and 5-year-olds at all three sizes').not.toBeNull();
    const mmAt = [1, 3, 5].map((i) => Number(rates![i]));
    const four = [2, 4, 6].map((i) => Number(rates![i])), five = [7, 8, 9].map((i) => Number(rates![i]));
    const { floor, comfortable } = workingFloors(body('playtester-reception'))!;
    expect(text, 'the "miss as often as a hit" claim is the floor\'s own').toContain(`a ${floor.radius} px radius)** is a miss as often as a hit`);
    const at = four.findIndex((h, i) => i > 0 && four[i - 1] < 50 && h >= 50);
    expect(at, 'the quoted 4-year-old rates cross 50% somewhere').toBeGreaterThan(0);
    const half = mmAt[at - 1] + ((50 - four[at - 1]) / (four[at] - four[at - 1])) * (mmAt[at] - mmAt[at - 1]);
    expect(Math.abs(floor.mm - half), `the floor is ${floor.mm} mm; the quoted rates put 50% at ${half.toFixed(1)} mm`).toBeLessThanOrEqual(1);
    const ninety = (rs: number[]) => mmAt[rs.findIndex((h) => h >= 90)];
    expect(comfortable.mm, 'comfortable is above the size where 5-year-olds already reach 90%').toBeGreaterThan(ninety(five));
    expect(comfortable.mm, 'and below the size where 4-year-olds first do').toBeLessThan(ninety(four));
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

  it('takes a sequence game\'s reach from labelReachMs.min, over its relaunches, never aboveCardMs (#2251)', () => {
    const at = SKILL.indexOf("**A `sequence` game's reach is `labelReachMs.min`, not `aboveCardMs`**");
    const compare = SKILL.indexOf('Compare that need with the bubble\'s **reach**'), later = SKILL.indexOf("**A later stage's reach**");
    expect(at, 'the rule is stated in §2').toBeGreaterThan(-1);
    expect(at > compare && at < later, 'beside the reach definition, before the later-stage estimate that uses it').toBe(true);
    const rule = SKILL.slice(at, later).replace(/\s+/g, ' ');
    expect(rule, 'the reach spans every relaunch').toContain('its total time below the card over its first flight and every relaunch, until it is sliced or its relaunches run out');
    expect(rule, 'and cites the limit the pack carries').toContain('`metrics.json#labelReach.maxRelaunches`');
    expect(rule, 'aboveCardMs is not used for it').toContain('`aboveCardMs` times one flight of any bubble, decoys included, so it is not used');
    expect(rule, 'a label the pack\'s own miss cut short is never the reach').toContain("was stopped by the pack's own miss, not by the game, so it is information only and never the reach");
    expect(rule, 'and it feeds the later-stage estimate').toContain('it is `reach_1` in the estimate below');
    expect(rule, 'the wait for a relaunch is judged elsewhere').toContain('judged under `again` (pace) and `feedback`, not `physical`');
    expect(SKILL.replace(/\s+/g, ' '), 'the pack\'s own deliberate miss is never held against the game')
      .toContain("**A sequence game's first question is missed on purpose.**");
  });

  it('marks `physical` on a band, not a cliff, and estimates later stages one way (#2245)', () => {
    const at = SKILL.indexOf('**`physical`**');
    const anchors = SKILL.slice(at, SKILL.indexOf('\n\n', at)).replace(/\s+/g, ' ');
    expect(anchors, 'a clear miss is below 75% of the need').toMatch(/- \*\*0\*\* — The stage-1 reach is below \*\*75%\*\* of the need/);
    expect(anchors, 'a near miss is a 1').toMatch(/- \*\*1\*\* — The stage-1 reach is at least 75% but below 100% of the need/);
    expect(anchors, 'a radius between floor and comfortable is a 1, not a gap').toContain('at or above the floor but below the comfortable size');
    expect(anchors, 'the lowest clause decides between anchors').toContain('The lowest anchor any clause reaches is the mark');
    expect(anchors, 'a 2 needs every stage, not only the one the pack played').toMatch(/- \*\*2\*\* — Every stage's estimated reach meets the need/);
    expect(anchors, 'the mark cites its numbers').toContain('`saw` states the need, the reach and the percentage');
    expect(SKILL, 'the later-stage estimate is one formula').toContain('`reach_k ≈ reach_1 × airTime[speeds[k-1]] / airTime[speeds[0]]`');
    expect(SKILL, 'and says the unit of the measured reach').toContain('in milliseconds: divide by 1000');
    expect(SKILL, 'and says how a speed indexes the table').toContain('A `speeds` value indexes `airTime` from 0');
    expect(SKILL.replace(/\s+/g, ' '), 'a sequence or slow game flies one speed lower, as eased() plays it').toContain('**Ease the speed before indexing:** a `sequence` game (`metrics.json#sequence`) or a `slow` one (`metrics.json#slow`) flies one speed lower at every stage, never below 1, or below 0 in a gentle year');
    const row = JSON.parse(/```json\n(\{.*\})\n```/.exec(SKILL)![1]);
    const saw = row.evidence.filter((e: { criterion: string }) => e.criterion === 'physical').map((e: { saw: string }) => e.saw).join(' ');
    expect(saw, 'the example row shows the evidence wording it asks for').toMatch(/need [\d.]+ s, reach [\d.]+ s, \d+%/);
  });

  it('says what counts toward the need: card text, a fixed line, working time (#2245)', () => {
    const at = SKILL.indexOf('**The time a bubble needs**'), end = SKILL.indexOf('Compare that need', at);
    expect(at, 'the need paragraph is where the rules live').toBeGreaterThan(-1);
    expect(end, 'and the comparison follows it').toBeGreaterThan(at);
    const need = SKILL.slice(at, end).replace(/\s+/g, ' ');
    expect(need, 'card text counts only when it must be read to choose').toContain('**Card text, only when the child must read it to choose the answer**');
    expect(need, 'once per wave, and never a picture').toMatch(/Count it once per wave\. A picture does not count, nor a card that only repeats the question line/);
    expect(need, 'a fixed line is not in the per-wave need').toContain('**A line that is the same every wave is read once per game, so it is not in the per-wave need**');
    expect(need, 'working time is judged, and says so').toContain('**Working time**, a judgement, not a published norm');
    expect(need, 'a recalled fact is free').toContain('**a recalled fact adds 0**');
    expect(need, 'each further step costs a second').toContain('**each further mental step the question needs adds 1 s**');
    expect(need, 'with a worked step').toContain('`0.4 × 3` is recall 4 × 3, then adjust the place value: one step, 1 s');
    expect(need, 'and a fixed line is told from two waves in the pack, never the source').toContain('`2-prompt.webp` (wave 1) and in `5-wrong.webp` (wave 2) is the same text');
    expect(need, 'the mark shows its working').toContain('Every `physical` `saw` names the steps it counted');
    const row = JSON.parse(/```json\n(\{.*\})\n```/.exec(SKILL)![1]) as { evidence: { criterion: string; saw: string }[] };
    const physical = row.evidence.filter((e) => e.criterion === 'physical');
    expect(physical.length, 'the example has physical evidence').toBeGreaterThan(0);
    for (const e of physical) expect(e.saw, 'every physical saw in the example names its steps').toMatch(/working: \d+ steps?/);
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
