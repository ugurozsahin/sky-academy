import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { YEARS, type YearId } from '../../src/curriculum';
import { layoutWave } from '../../src/game/bubbles';
import { RUNTIME, TIMING, resolveGame, resolveYear } from '../../src/config/resolve';
import type { RuntimeCatalogue } from '../../src/config/catalogue';
import { RUNTIME as RUNTIME_FILE, slimCatalogue } from '../../scripts/catalogue-slim.mjs';
import { CATALOGUE } from './helpers/catalogue-file';

// #2194: the catalogue is the source of the year settings and the bubble timing, read through the resolver.
//
// Prove it red: change a year's `lives`, or a timing value, in `src/config/catalogue.json` and run
// `npm run catalogue:slim` (the snapshot fails); edit the file without it (the runtime-copy rail fails); swap two
// layers in `resolveGame` (an order case fails); drop the `overridable` filter (the isolation cases fail).

/** Today's values, frozen before #2194 moved them into the file: `YEARS` (src/curriculum/types.ts) and `layoutWave`'s
 *  air time and stagger at speeds 0..3 (src/game/bubbles.ts:320-322). Never regenerate this from the code. */
const TIMING_TODAY = { airTime: [7.5, 5.6, 4.4, 3.4], stagger: [500, 420, 330, 260] };
const STARS = { threeStar: 12, twoStar: 6 }, KS2 = { perStage: 7, lives: 3, gentle: false, speeds: [1, 2, 3, 3, 3], diffs: [1, 2, 2, 3, 3], sprintStars: STARS };
const TODAY: Record<YearId, object> = {
  reception: { maxAnswer: 30, minAnswer: 0, perStage: 5, lives: 4, gentle: true, speeds: [0, 0, 0, 1, 1], diffs: [1, 1, 2, 2, 3], sprintStars: { threeStar: 8, twoStar: 4 } },
  year1: { maxAnswer: 120, minAnswer: 0, perStage: 6, lives: 3, gentle: false, speeds: [1, 2, 2, 3, 3], diffs: [1, 2, 2, 3, 3], sprintStars: STARS },
  year2: { maxAnswer: 130, minAnswer: 0, ...KS2 },
  year3: { maxAnswer: 2000, minAnswer: 0, ...KS2 },
  year4: { maxAnswer: 20000, minAnswer: -50, ...KS2 },
  year5: { maxAnswer: 1000000, minAnswer: -100, ...KS2 },
  year6: { maxAnswer: 10000000, minAnswer: -1000, ...KS2 },
};
const SETTING_KEYS = ['maxAnswer', 'minAnswer', 'perStage', 'lives', 'gentle', 'speeds', 'diffs', 'sprintStars'] as const;

describe("frozen snapshot: the file holds today's values (#2194)", () => {
  it('names every year, and only those', () => expect(Object.keys(TODAY).sort()).toEqual(YEARS.map((y) => y.id).sort()));

  it.each(YEARS.map((y) => [y.id] as const))('resolveYear(%s) equals the frozen settings and timing', (id) => {
    expect(resolveYear(id)).toEqual({ ...TODAY[id], ...TIMING_TODAY });
  });

  it.each(YEARS.map((y) => [y.id, y] as const))('YEARS.%s reads its eight settings from the resolver', (id, y) => {
    expect(Object.fromEntries(SETTING_KEYS.map((k) => [k, y[k] ?? (k === 'minAnswer' ? 0 : undefined)]))).toEqual(TODAY[id]);
  });

  it('layoutWave flies each speed 0..3 at the frozen air time and stagger, and past 3 at the fastest', () => {
    const at = (speed: number) => layoutWave({ labels: ['1', '2', '3'], speed }, { W: 390, H: 700, topInset: 0 }, 1, 0, () => 0.5);
    expect([0, 1, 2, 3].map((s) => at(s).waveT / 1000)).toEqual(TIMING_TODAY.airTime);
    expect([0, 1, 2, 3].map((s) => at(s).stagger)).toEqual(TIMING_TODAY.stagger);
    expect([at(4).waveT, at(4).stagger], 'the old `?? 3.4` / `?? 260` fallback, kept').toEqual([3400, 260]);
    expect(TIMING).toEqual(TIMING_TODAY);
  });
});

// ---- The resolver's order, one case per level --------------------------------------------------------------
const GAME = 'y1-bonds';
type Doc = Record<string, any>;
/** A deep copy of the committed runtime catalogue to break; `y1-bonds` sits on year1, in ks1. */
const copy = (): Doc => structuredClone(RUNTIME) as Doc;
const resolve = (c: Doc, patch?: object, year: YearId = 'year1') => resolveGame(GAME, year, patch, c as RuntimeCatalogue);

describe('resolveGame applies the layers in order, last wins (#2194)', () => {
  it('1. defaults: the timing a year does not set', () => {
    const c = copy();
    c.defaults.settings.airTime = [9, 8, 7, 6];
    expect(resolve(c).settings.airTime).toEqual([9, 8, 7, 6]);
  });

  it('2. the year beats the defaults', () => {
    const c = copy();
    c.years.year1.settings.airTime = [8, 6, 4, 3];
    c.years.year1.settings.lives = 2;
    expect(resolve(c).settings).toMatchObject({ airTime: [8, 6, 4, 3], lives: 2 });
    expect(resolveYear('year1', c as RuntimeCatalogue)).toMatchObject({ airTime: [8, 6, 4, 3], lives: 2 });
  });

  it("3. the game's settings beat the year", () => {
    const c = copy();
    c.years.year1.settings.airTime = [8, 6, 4, 3];
    c.games[GAME].settings = { lives: 5, airTime: [10, 8, 6, 4] };
    expect(resolve(c).settings).toMatchObject({ lives: 5, airTime: [10, 8, 6, 4], perStage: 6 });
  });

  it("4. the game's group override beats the game, and only for its group's years", () => {
    const c = copy();
    c.games[GAME].settings = { lives: 5, perStage: 4 };
    c.games[GAME].groupSettings = { ks1: { lives: 1 }, lks2: { perStage: 9 } };
    expect(resolve(c).settings).toMatchObject({ lives: 1, perStage: 4 });
  });

  it("5. the game's single-year override beats its group", () => {
    const c = copy();
    c.games[GAME].groupSettings = { ks1: { lives: 1, perStage: 4 } };
    c.games[GAME].years.year1.settings = { perStage: 3 };
    expect(resolve(c).settings).toMatchObject({ lives: 1, perStage: 3 });
  });

  it('6. the patch beats everything', () => {
    const c = copy();
    c.games[GAME].years.year1.settings = { perStage: 3, gentle: false };
    expect(resolve(c, { perStage: 8, gentle: true }).settings).toMatchObject({ perStage: 8, gentle: true });
  });

  it("with the committed file every game resolves to its year's settings", () => {
    const off = Object.entries(RUNTIME.games).flatMap(([id, g]) => Object.keys(g.years).map((y) => [id, y as YearId] as const))
      .filter(([id, y]) => JSON.stringify(resolveGame(id, y)) !== JSON.stringify({ visible: true, settings: resolveYear(y) }));
    expect(off.map(([id]) => id), 'only the game the owner switched off on #2281').toEqual(['y1-contractions']);
    expect(resolveGame('y1-contractions', 'year1').visible).toBe(false);
  });
});

describe('isolation: a game level or a patch cannot reach a year-only key (#2194)', () => {
  const yearOnly = { maxAnswer: 5, minAnswer: -5, sprintStars: { threeStar: 99, twoStar: 1 } };
  it('the patch is ignored for maxAnswer, minAnswer and sprintStars, and applies its other keys', () => {
    const r = resolve(copy(), { ...yearOnly, lives: 2 }).settings;
    expect(r).toMatchObject({ maxAnswer: 120, minAnswer: 0, sprintStars: STARS, lives: 2 });
  });

  it('so is a year-only key the validator would refuse at a game level', () => {
    const c = copy();
    c.games[GAME].settings = yearOnly;
    c.games[GAME].groupSettings = { ks1: yearOnly };
    c.games[GAME].years.year1.settings = yearOnly;
    expect(resolve(c).settings).toMatchObject({ maxAnswer: 120, minAnswer: 0, sprintStars: STARS });
  });

  it('a key a patch leaves undefined does not blank the value under it', () => {
    expect(resolve(copy(), { lives: undefined }).settings.lives).toBe(3);
  });
});

describe('resolveGame visibility (#2194)', () => {
  it("is the game's own AND its year node's", () => {
    for (const [game, node, want] of [[true, true, true], [false, true, false], [true, false, false], [false, false, false]] as const) {
      const c = copy();
      c.games[GAME].visible = game;
      c.games[GAME].years.year1.visible = node;
      expect(resolve(c).visible, `game ${game}, year node ${node}`).toBe(want);
    }
  });

  it('a game asked for on an island it has no node for is not visible there, and still resolves', () => {
    const r = resolve(copy(), undefined, 'year4');
    expect(r.visible).toBe(false);
    expect(r.settings.maxAnswer).toBe(20000);
  });

  it('an unknown game or year throws, rather than resolving to nothing', () => {
    expect(() => resolveGame('no-such-game', 'year1')).toThrow('no game no-such-game');
    expect(() => resolveYear('year9' as YearId)).toThrow('no year year9');
  });
});

// ---- The runtime copy: what the game bundle carries ---------------------------------------------------------
const srcFiles = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? srcFiles(p) : /\.tsx?$/.test(f) ? [p] : [];
});

describe('the runtime catalogue (#2194)', () => {
  it('the committed copy equals the full file slimmed: run `npm run catalogue:slim` after editing catalogue.json', () => {
    expect(readFileSync(RUNTIME_FILE, 'utf8')).toBe(slimCatalogue(CATALOGUE));
  });

  it('keeps every visibility and setting of the full file, built here independently of the script', () => {
    const { version: _v, ...rest } = structuredClone(CATALOGUE) as Doc;
    for (const y of Object.values(rest.years) as Doc[]) { delete y.media; delete y.playability; }
    for (const g of Object.values(rest.games) as Doc[]) {
      delete g.media; delete g.playability;
      for (const n of Object.values(g.years) as Doc[]) delete n.playability;
    }
    const { $comment: _c, ...slim } = JSON.parse(readFileSync(RUNTIME_FILE, 'utf8'));
    expect(slim).toEqual(rest);
  });

  it('holds no media and no playability anywhere', () => {
    const text = readFileSync(RUNTIME_FILE, 'utf8');
    expect(text).not.toMatch(/"(media|playability|thumbnail|screenshots|alt|src)"\s*:/);
  });

  it('no module under src/ imports the full catalogue.json, so its media never reaches the game bundle', () => {
    const bad = srcFiles('src').filter((f) => /from\s+['"][^'"]*\/catalogue\.json['"]/.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });

  it('`npm run catalogue:show -- <game>` prints the resolved node for the game on its own year', () => {
    const out = execFileSync(process.execPath, ['scripts/catalogue-show.mjs', 'y4-decimals'], { encoding: 'utf8' });
    expect(JSON.parse(out)).toEqual({ game: 'y4-decimals', year: 'year4', ...resolveGame('y4-decimals', 'year4') });
  });

  it('`catalogue:show` names a mistyped game or year and exits 1, an inherited key included', () => {
    for (const [args, msg] of [[['no-such-game'], 'no game "no-such-game"'], [['constructor'], 'no game "constructor"'], [['y4-decimals', 'year9'], 'no year "year9"']] as const) {
      const run = spawnSync(process.execPath, ['scripts/catalogue-show.mjs', ...args], { encoding: 'utf8' });
      expect([run.status, run.stderr.includes(msg)], args.join(' ')).toEqual([1, true]);
    }
  });
});
