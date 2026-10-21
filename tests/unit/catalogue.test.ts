import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STAGE_NAMES, TOPICS, YEARS, type YearId } from '../../src/curriculum';
import { EYFS_KS1 } from '../../src/curriculum/key-stage';
import { layoutWave } from '../../src/game/bubbles';
import { CATALOGUE, GROUP_IDS, OVERRIDABLE_KEYS, STAGES, YEAR_ONLY_KEYS, validateCatalogue, type MediaEntry } from '../../src/config/catalogue';

// #2193: the game catalogue file, `src/config/catalogue.json`, written once from today's code by
// `scripts/catalogue-init.mjs`. Nothing in the game reads it yet; these rails hold it complete, valid and equal
// to the code until item B (#2194) makes the file the source.
//
// Prove it red: delete a game node or add one; change a year's `lives` in the file; change `[7.5, 5.6, 4.4]` in
// `layoutWave`; give two games one thumbnail; set a playability score; drop a validator check (its mutation below
// then passes clean).
const FILE = 'src/config/catalogue.json';
const onDisk = () => JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, any>;
const years = CATALOGUE.years as Record<string, (typeof CATALOGUE.years)[YearId]>;
const pictures = (m: { thumbnail: MediaEntry; screenshots: readonly MediaEntry[] }) => [m.thumbnail, ...m.screenshots];

describe('catalogue coverage: one node per game and per year (#2193)', () => {
  it('has exactly one game node per TOPICS id, in registry order, drills included', () => {
    expect(Object.keys(CATALOGUE.games)).toEqual(TOPICS.map((t) => t.id));
    const drills = TOPICS.filter((t) => t.drill);
    expect(drills.length, 'drills are games too, so the file must carry some').toBeGreaterThan(0);
    for (const d of drills) expect(CATALOGUE.games[d.id], d.id).toBeDefined();
  });

  it("gives every game exactly its code year, so a game's year node is where the code puts it", () => {
    const wrong = TOPICS.filter((t) => JSON.stringify(Object.keys(CATALOGUE.games[t.id].years)) !== JSON.stringify([t.year]));
    expect(wrong.map((t) => t.id)).toEqual([]);
  });

  it('has a year node for every YearId, and the groups name each year once, split at the key stage', () => {
    expect(Object.keys(CATALOGUE.years)).toEqual(YEARS.map((y) => y.id));
    expect(Object.keys(CATALOGUE.groups)).toEqual(GROUP_IDS);
    expect(Object.values(CATALOGUE.groups).flat().sort()).toEqual(YEARS.map((y) => y.id).sort());
    expect([...CATALOGUE.groups.eyfs, ...CATALOGUE.groups.ks1].sort()).toEqual([...EYFS_KS1].sort());
  });
});

describe('catalogue equals the code today (#2193; lives until #2194 makes the file the source)', () => {
  it.each(YEARS.map((y) => [y.id, y] as const))('years.%s.settings equal YEARS', (id, y) => {
    expect(years[id].settings).toEqual({
      perStage: y.perStage, lives: y.lives, gentle: y.gentle, speeds: y.speeds, diffs: y.diffs,
      sprintStars: y.sprintStars, maxAnswer: y.maxAnswer, minAnswer: y.minAnswer ?? 0,
    });
    expect(years[id].visible, "every island starts on today's topic-count gate").toBe('auto');
  });

  it("defaults equal layoutWave's air time and stagger at speeds 0 to 2, read by driving it", () => {
    const plans = [0, 1, 2].map((speed) => layoutWave({ labels: ['1', '2', '3'], speed }, { W: 390, H: 700, topInset: 0 }, 1, 0, () => 0.5));
    expect(CATALOGUE.defaults.settings).toEqual({ airTime: plans.map((p) => p.waveT / 1000), stagger: plans.map((p) => p.stagger) });
  });

  it('every game and game-year node is visible and inherits everything', () => {
    const notDefault = Object.entries(CATALOGUE.games).filter(([, g]) => !g.visible || Object.keys(g.settings).length
      || Object.keys(g.groupSettings).length || Object.values(g.years).some((n) => !n?.visible || Object.keys(n.settings).length));
    expect(notDefault.map(([id]) => id)).toEqual([]);
  });

  it('the stage arrays are as long as the session runs them, and STAGE_NAMES names every stage', () => {
    expect(STAGE_NAMES.length).toBe(STAGES);
    for (const y of YEARS) expect([y.speeds.length, y.diffs.length], y.id).toEqual([STAGES, STAGES]);
  });
});

describe('catalogue media and playability (#2193)', () => {
  const games = Object.entries(CATALOGUE.games);
  const all = [...games.map(([, g]) => g.media), ...Object.values(years).map((y) => y.media)].flatMap(pictures);

  it('every media path is unique', () => {
    const srcs = all.map((p) => p.src);
    expect(srcs.length).toBe(2 * (TOPICS.length + YEARS.length));
    expect(srcs.filter((s, i) => srcs.indexOf(s) !== i)).toEqual([]);
  });

  it("every game's alt text names the game and its year; every island's names its year", () => {
    const title = Object.fromEntries(YEARS.map((y) => [y.id, y.title]));
    const bad = games.flatMap(([id, g]) => pictures(g.media).filter((p) => {
      const t = TOPICS.find((x) => x.id === id)!;
      return !p.alt.includes(t.title) || !p.alt.includes(`a ${title[t.year]} game`);
    }).map((p) => `${id}: ${p.alt}`));
    for (const y of YEARS) for (const p of pictures(years[y.id].media)) if (!p.alt.includes(y.title)) bad.push(`${y.id}: ${p.alt}`);
    expect(bad).toEqual([]);
  });

  it('every playability value is null until the playtest run scores it', () => {
    const scored = [
      ...games.flatMap(([id, g]) => [[id, g.playability], ...Object.entries(g.years).map(([y, n]) => [`${id}/${y}`, n?.playability])]),
      ...Object.entries(years).map(([id, y]) => [id, y.playability]),
    ].filter(([, p]) => p !== null);
    expect(scored).toEqual([]);
  });
});

describe('the catalogue file on disk (#2193)', () => {
  it('passes the validator, as imported and as read from disk', () => {
    expect(validateCatalogue(CATALOGUE)).toEqual([]);
    expect(validateCatalogue(onDisk())).toEqual([]);
  });

  it('is 2-space JSON ending in a newline, the shape the init script writes', () => {
    expect(readFileSync(FILE, 'utf8')).toBe(`${JSON.stringify(onDisk(), null, 2)}\n`);
  });

  it('a plain Node .mjs script can read it, as the site scripts will', () => {
    const probe = "import { readFileSync } from 'node:fs'; const c = JSON.parse(readFileSync(process.argv[1], 'utf8')); console.log(Object.keys(c.games).length);";
    expect(execFileSync(process.execPath, ['--input-type=module', '-e', probe, FILE], { encoding: 'utf8' }).trim()).toBe(String(TOPICS.length));
  });

  it('the init script refuses to overwrite the file without --force', () => {
    const before = readFileSync(FILE, 'utf8');
    const run = spawnSync(process.execPath, ['scripts/catalogue-init.mjs'], { encoding: 'utf8' });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain('pass --force');
    expect(readFileSync(FILE, 'utf8')).toBe(before);
  });
});

// ---- The validator catches each kind of error ---------------------------------------------------------------
type Doc = Record<string, any>;
const GAME = 'y1-bonds', OTHER = 'r-count';
const play = { score: 7, by: 'year1-child', at: '2026-10-22', report: 'docs/playability/2026-10-22.md' };
/** [what is wrong, how to break a fresh copy, the error line it must produce (prefix match)]. */
const MUTATIONS: [string, (c: Doc) => void, string][] = [
  ['an unknown top-level key', (c) => { c.extra = 1; }, 'extra: unknown key'],
  ['a missing top-level key', (c) => { delete c.defaults; }, 'defaults: missing'],
  ['the wrong version', (c) => { c.version = 2; }, 'version: must be 1'],
  ['an unknown group', (c) => { c.groups.ks3 = ['year3']; }, 'groups.ks3: unknown key'],
  ['a group that is not a list', (c) => { c.groups.ks1 = 'year1'; }, 'groups.ks1: must be a list'],
  ['a year in two groups', (c) => { c.groups.ks1.push('reception'); }, 'groups.ks1: reception is in more than one group'],
  ['a missing year node', (c) => { delete c.years.year3; }, 'years.year3: missing'],
  ['a year node no group names', (c) => { c.years.year7 = c.years.year6; }, 'years.year7: unknown key'],
  ['an island visible that is not "auto" or boolean', (c) => { c.years.year1.visible = 'yes'; }, 'years.year1.visible: must be "auto"'],
  ['a missing year setting', (c) => { delete c.years.year1.settings.lives; }, 'years.year1.settings.lives: missing'],
  ['an unknown setting', (c) => { c.years.year1.settings.speed = 1; }, 'years.year1.settings.speed: not a setting'],
  ['lives below 1', (c) => { c.years.year1.settings.lives = 0; }, 'years.year1.settings.lives: must be a whole number from 1 to 5'],
  ['lives above 5', (c) => { c.years.year1.settings.lives = 6; }, 'years.year1.settings.lives: must be a whole number from 1 to 5'],
  ['fractional lives', (c) => { c.years.year1.settings.lives = 2.5; }, 'years.year1.settings.lives: must be a whole number'],
  ['perStage 0', (c) => { c.years.year1.settings.perStage = 0; }, 'years.year1.settings.perStage: must be a whole number from 1 to 10'],
  ['perStage past the pill', (c) => { c.years.year1.settings.perStage = 11; }, 'years.year1.settings.perStage: must be a whole number from 1 to 10'],
  ['gentle not a boolean', (c) => { c.years.year1.settings.gentle = 'no'; }, 'years.year1.settings.gentle: must be true or false'],
  ['a speed outside 0-3', (c) => { c.years.year1.settings.speeds[4] = 4; }, 'years.year1.settings.speeds: must be 5 values'],
  ['too few stages', (c) => { c.years.year1.settings.speeds.pop(); }, 'years.year1.settings.speeds: must be 5 values'],
  ['a difficulty outside 1-3', (c) => { c.years.year1.settings.diffs[0] = 0; }, 'years.year1.settings.diffs: must be 5 values'],
  ['twoStar not below threeStar', (c) => { c.years.year1.settings.sprintStars.twoStar = 12; }, 'years.year1.settings.sprintStars: must be whole numbers'],
  ['an unknown sprintStars key', (c) => { c.years.year1.settings.sprintStars.oneStar = 1; }, 'years.year1.settings.sprintStars.oneStar: unknown key'],
  ['maxAnswer 0', (c) => { c.years.year1.settings.maxAnswer = 0; }, 'years.year1.settings.maxAnswer: must be a whole number above 0'],
  ['minAnswer not below maxAnswer', (c) => { c.years.year1.settings.minAnswer = 120; }, 'years.year1.settings.minAnswer: must be a whole number below maxAnswer'],
  ['an air time table of the wrong length', (c) => { c.defaults.settings.airTime.pop(); }, 'defaults.settings.airTime: must be 3 positive numbers'],
  ['a stagger that is not positive', (c) => { c.defaults.settings.stagger[0] = 0; }, 'defaults.settings.stagger: must be 3 positive numbers'],
  ['a missing default', (c) => { delete c.defaults.settings.stagger; }, 'defaults.settings.stagger: missing'],
  ['a default the year always overrides', (c) => { c.defaults.settings.lives = 3; }, 'defaults.settings.lives: not a setting this level holds'],
  ['a year-only key on a game', (c) => { c.games[GAME].settings.maxAnswer = 50; }, `games.${GAME}.settings.maxAnswer: year-only`],
  ['a year-only key on a group override', (c) => { c.games[GAME].groupSettings.ks1 = { sprintStars: { threeStar: 9, twoStar: 3 } }; }, `games.${GAME}.groupSettings.ks1.sprintStars: year-only`],
  ['a bad game override', (c) => { c.games[GAME].settings.lives = 9; }, `games.${GAME}.settings.lives: must be a whole number from 1 to 5`],
  ['an unknown group override', (c) => { c.games[GAME].groupSettings.ks3 = {}; }, `games.${GAME}.groupSettings.ks3: not a group`],
  ['a bad group override', (c) => { c.games[GAME].groupSettings.ks1 = { diffs: [1, 2, 3, 4, 3] }; }, `games.${GAME}.groupSettings.ks1.diffs: must be 5 values`],
  ['a bad year-node override', (c) => { c.games[GAME].years.year1.settings = { airTime: [1, 2] }; }, `games.${GAME}.years.year1.settings.airTime: must be 3`],
  ['a game visible that is not boolean', (c) => { c.games[GAME].visible = 'auto'; }, `games.${GAME}.visible: must be true or false`],
  ['a game-year visible that is not boolean', (c) => { c.games[GAME].years.year1.visible = 'auto'; }, `games.${GAME}.years.year1.visible: must be true or false`],
  ['a game with two years', (c) => { c.games[GAME].years.year2 = c.games[GAME].years.year1; }, `games.${GAME}.years: must name exactly one year`],
  ['a game in an unknown year', (c) => { c.games[GAME].years = { year7: c.games[GAME].years.year1 }; }, `games.${GAME}.years.year7: not a year in groups`],
  ['an unknown key on a game', (c) => { c.games[GAME].hidden = true; }, `games.${GAME}.hidden: unknown key`],
  ['an unknown key on a game-year node', (c) => { c.games[GAME].years.year1.media = {}; }, `games.${GAME}.years.year1.media: unknown key`],
  ['a game id with capitals', (c) => { c.games.Y1Bonds = c.games[GAME]; }, 'games.Y1Bonds: a game id is lower-case'],
  ['a missing thumbnail', (c) => { delete c.games[GAME].media.thumbnail; }, `games.${GAME}.media.thumbnail: missing`],
  ['no screenshots', (c) => { c.games[GAME].media.screenshots = []; }, `games.${GAME}.media.screenshots: must be a list of at least one`],
  ["a src in another game's folder", (c) => { c.games[GAME].media.thumbnail.src = `img/games/${OTHER}/x.webp`; }, `games.${GAME}.media.thumbnail.src: must be a .webp path under img/games/${GAME}/`],
  ['a src that is not .webp', (c) => { c.games[GAME].media.thumbnail.src = `img/games/${GAME}/thumb.png`; }, `games.${GAME}.media.thumbnail.src: must be a .webp path`],
  ['a src that climbs out', (c) => { c.games[GAME].media.thumbnail.src = `img/games/${GAME}/../${OTHER}/thumb.webp`; }, `games.${GAME}.media.thumbnail.src: must be a .webp path`],
  ['an island src outside its folder', (c) => { c.years.year1.media.thumbnail.src = 'img/islands/year2/thumb.webp'; }, 'years.year1.media.thumbnail.src: must be a .webp path under img/islands/year1/'],
  ['one src used twice', (c) => { c.games[GAME].media.screenshots.push({ ...c.games[GAME].media.screenshots[0] }); }, `games.${GAME}.media.screenshots[1].src: img/games/${GAME}/1.webp is used more than once`],
  ['an empty alt', (c) => { c.games[GAME].media.screenshots[0].alt = ' '; }, `games.${GAME}.media.screenshots[0].alt: must be some text`],
  ['playability that is not an object', (c) => { c.games[GAME].playability = 7; }, `games.${GAME}.playability: must be null or`],
  ['a score above 10', (c) => { c.games[GAME].playability = { ...play, score: 11 }; }, `games.${GAME}.playability.score: must be a whole number from 0 to 10`],
  ['a fractional score', (c) => { c.years.year1.playability = { ...play, score: 6.5 }; }, 'years.year1.playability.score: must be a whole number'],
  ['a bad profile id', (c) => { c.games[GAME].years.year1.playability = { ...play, by: 'Year 1' }; }, `games.${GAME}.years.year1.playability.by: must be a profile id`],
  ['an impossible date', (c) => { c.games[GAME].playability = { ...play, at: '2026-02-30' }; }, `games.${GAME}.playability.at: must be a date`],
  ['a report outside docs/playability', (c) => { c.games[GAME].playability = { ...play, report: 'README.md' }; }, `games.${GAME}.playability.report: must be a file under docs/playability/`],
  ['a missing playability key', (c) => { const { at: _, ...rest } = play; c.games[GAME].playability = rest; }, `games.${GAME}.playability.at: missing`],
  ['an unknown playability key', (c) => { c.games[GAME].playability = { ...play, note: 'fun' }; }, `games.${GAME}.playability.note: unknown key`],
];

describe('validateCatalogue catches each kind of error in a seeded bad copy (#2193)', () => {
  it.each(MUTATIONS)('%s', (_what, mutate, expected) => {
    const copy = onDisk();
    mutate(copy);
    const errs = validateCatalogue(copy);
    expect(errs.some((e) => e.startsWith(expected)), `expected a line starting "${expected}", got:\n${errs.join('\n')}`).toBe(true);
  });

  it('returns every error rather than the first', () => {
    const picked = ['an unknown top-level key', 'an island visible that is not "auto" or boolean', 'lives above 5', 'a missing default',
      'a bad group override', 'an empty alt', 'a score above 10'].map((w) => MUTATIONS.find(([what]) => what === w)!);
    const copy = onDisk();
    for (const [, mutate] of picked) mutate(copy);
    const errs = validateCatalogue(copy);
    expect(picked.filter(([, , e]) => !errs.some((x) => x.startsWith(e))).map(([what]) => what)).toEqual([]);
  });

  it('a non-object is one error, not a throw', () => {
    for (const bad of [null, 1, 'x', []]) expect(validateCatalogue(bad)).toEqual(['catalogue: must be an object']);
  });

  it('accepts what the shape allows: overrides at each level, a scored node, extra keys on a media entry', () => {
    const copy = onDisk();
    copy.games[GAME].settings = { perStage: 4, lives: 5, gentle: true, speeds: [0, 0, 1, 1, 2], diffs: [1, 1, 1, 2, 2], airTime: [9, 7, 5], stagger: [600, 500, 400] };
    copy.games[GAME].groupSettings = { ks1: { lives: 1 }, eyfs: {} };
    copy.games[GAME].years.year1.settings = { speeds: [3, 3, 3, 3, 3] };
    copy.years.year1.settings.airTime = [8, 6, 4];
    copy.games[GAME].playability = play;
    copy.games[GAME].years.year1 = { visible: false, settings: {}, playability: { ...play, score: 0 } };
    copy.years.year2.visible = false;
    copy.games[GAME].media.screenshots.push({ src: `img/games/${GAME}/2.webp`, alt: 'Two', caption: 'Stage 2', kind: 'tablet' });
    expect(validateCatalogue(copy)).toEqual([]);
  });

  it('the mutation table covers every setting key and every year-only key', () => {
    const named = MUTATIONS.map(([, , e]) => e);
    for (const k of [...OVERRIDABLE_KEYS, ...YEAR_ONLY_KEYS]) expect(named.some((e) => e.includes(`.${k}:`)), k).toBe(true);
  });
});
