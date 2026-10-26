// #2196: a game whose catalogue node is hidden — globally (`games.<id>.visible`) or for its year
// (`games.<id>.years.<y>.visible`) — leaves every list, pool, total and unlock; `TOPICS`, `topicById` and the save
// keep it. With the committed file every list is exactly what it was before the catalogue.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RuntimeCatalogue } from '../../src/config/catalogue';
import { RUNTIME } from '../../src/config/resolve';
import { CORE_TOPICS, TOPICS, YEARS, drillsFor, isGameShown, listedTopics, shownYears, topicById, topicsFor, type Topic, type YearId } from '../../src/curriculum';
import { GRAMMAR, grammarPool } from '../../src/game/sprint-pools';
import { answerableBy } from '../../src/game/pools';
import { mtcOffered } from '../../src/game/mtc';
import { islandMenu, islandSubjects } from '../../src/ui/home';
import { load } from '../../src/storage';
import { SOURCES, code } from './helpers/sources';

/** Switched off in the committed file by the owner (#2281); every baseline below is "before the catalogue" minus these. */
const OFF = ['y1-contractions'];
const CORE = CORE_TOPICS.filter(t => !OFF.includes(t.id));
type Mut = { years: Record<string, { visible: 'auto' | boolean }>; games: Record<string, { visible: boolean; years: Record<string, { visible: boolean }> }> };
/** A test copy of the committed runtime catalogue, edited. */
const copy = (edit: (c: Mut) => void): RuntimeCatalogue => { const c = structuredClone(RUNTIME) as unknown as Mut; edit(c); return c as unknown as RuntimeCatalogue; };
const ids = (ts: readonly { id: string }[]) => ts.map(t => t.id);
const SUBJECTS = [undefined, 'maths', 'writing'] as const;
/** The real island menu's rows on `year` for a new save (`islandMenu`, src/ui/home.ts), against the loaded catalogue. */
type Menu = typeof islandMenu;
const menu = (im: Menu, ld: typeof load, year: { id: YearId }) => im({} as never, YEARS.find(y => y.id === year.id)!, ld(), {}, () => 'maths');
/** The rows the catalogue can empty, in menu order, as the committed file offers them. */
const FED = (y: YearId) => ['train', 'endless', ...(y === 'year4' ? ['mtc', 'mtcpad'] : []), 'sprint', 'relaxed', 'boss', 'duel'];

/** Today's lists, as they were before the catalogue (#915, #1039, #1234): the baseline the committed file must equal. */
const before = {
  topicsFor: (y: YearId, s?: Topic['subject']) => CORE.filter(t => t.year === y && (!s || t.subject === s)),
  drillsFor: (y: YearId, s?: Topic['subject']) => TOPICS.filter(t => t.drill && t.year === y && (!s || t.subject === s)),
  grammarPool: (n: number) => GRAMMAR.filter(id => Number(id[1]) <= n).map(topicById).filter((t): t is Topic => !!t && !t.drill && t.subject === 'writing' && answerableBy(t, 'mixed')),
};

const mem: Record<string, string> = {};
beforeEach(() => {
  for (const k in mem) delete mem[k];
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } });
});
afterEach(() => vi.unstubAllGlobals());

describe('with the committed catalogue every list is exactly today\'s (#2196)', () => {
  it('topicsFor and drillsFor, per year and subject', () => {
    for (const y of YEARS) for (const s of SUBJECTS) {
      expect(ids(topicsFor(y.id, s)), `${y.id} ${s ?? 'all'}`).toEqual(ids(before.topicsFor(y.id, s)));
      expect(ids(drillsFor(y.id, s)), `${y.id} ${s ?? 'all'} drills`).toEqual(ids(before.drillsFor(y.id, s)));
    }
  });
  it('listedTopics, the grammar pools, Tables Check and every island-menu row', () => {
    const shown = new Set(shownYears().map(y => y.id));
    expect(ids(listedTopics())).toEqual(ids(CORE.filter(t => shown.has(t.year))));
    for (const n of [5, 6]) expect(ids(grammarPool(`year${n}` as YearId))).toEqual(ids(before.grammarPool(n)));
    expect(mtcOffered()).toBe(true);
    for (const y of YEARS) {
      const rows = menu(islandMenu, load, y);
      expect(rows.filter(r => !['mixed', 'duel', 'mtc', 'none'].includes(r.feeds)).map(r => r.id), `${y.id}: a row names its pool (#2240)`).toEqual([]);
      expect(ids(rows.filter(r => r.feeds !== 'none')), y.id).toEqual(FED(y.id));
    }
  });
  it('isGameShown is true for every registry game on its own year, and agrees with topicsFor/drillsFor', () => {
    expect(TOPICS.filter(t => !isGameShown(t.id, t.year)).map(t => t.id)).toEqual(OFF);
    const listed = new Set(ids(YEARS.flatMap(y => [...topicsFor(y.id), ...drillsFor(y.id)])));
    expect(TOPICS.filter(t => listed.has(t.id) !== isGameShown(t.id, t.year)).map(t => t.id)).toEqual([]);
  });
});

describe('isGameShown reads the game, its year node and the island (#2196)', () => {
  it('global off, year off, island off: each hides; a year with no node never shows the game', () => {
    expect(isGameShown('y4-tables', 'year4', copy(c => { c.games['y4-tables'].visible = false; }))).toBe(false);
    expect(isGameShown('y4-tables', 'year4', copy(c => { c.games['y4-tables'].years.year4.visible = false; }))).toBe(false);
    expect(isGameShown('y4-tables', 'year4', copy(c => { c.years.year4.visible = false; }))).toBe(false);
    expect(isGameShown('y4-tables', 'year3')).toBe(false);
    expect(isGameShown('y4-tables', 'year4')).toBe(true);
  });
});

/** The test catalogue: one maths game hidden globally, one writing game hidden for its year, both on Year 4. */
const HIDDEN = ['y4-tables', 'y4-pronouns'];
const TEST_CAT = copy(c => { c.games['y4-tables'].visible = false; c.games['y4-pronouns'].years.year4.visible = false; });
const without = (ts: readonly { id: string }[], gone = HIDDEN) => ids(ts).filter(id => !gone.includes(id));

/** Points the game at `cat` through the catalogue seam (#2239), runs `body`, then restores the profile's own. */
async function withCatalogue(cat: RuntimeCatalogue, body: () => Promise<void>) {
  vi.resetModules();
  const { setActiveCatalogue } = await import('../../src/config/active');
  setActiveCatalogue(cat);
  try { await body(); } finally { setActiveCatalogue(null); vi.resetModules(); }
}

describe('a hidden maths game and a hidden writing game leave every list and pool (#2196)', () => {
  it('island lists, drills, choosers, Duel, trophies, mixed, Sensei, Daily, Legend\'s source and the grammar pools', () => withCatalogue(TEST_CAT, async () => {
    const cur = await import('../../src/curriculum');
    const { chooserTopics, duelChooserTopics, trophyCount } = await import('../../src/ui/chooser');
    const { grammarPool: gp, GRAMMAR_MIN } = await import('../../src/game/sprint-pools');
    const { subjectPool } = await import('../../src/game/pools');
    const { senseiTopics } = await import('../../src/game/sensei');
    const { dailySprintPool } = await import('../../src/game/daily-sprint');
    const { dailyTenPool } = await import('../../src/game/daily-ten');
    const { duelPool } = await import('../../src/game/duel');
    const y4 = cur.YEARS.find(y => y.id === 'year4')!;
    for (const y of cur.YEARS) for (const s of SUBJECTS) expect(ids(cur.topicsFor(y.id, s)), `${y.id} ${s ?? 'all'}`).toEqual(without(before.topicsFor(y.id, s)));
    expect(ids(cur.drillsFor('year4')), 'the drills are untouched').toEqual(ids(before.drillsFor('year4')));
    for (const s of ['maths', 'writing'] as const) {
      expect(ids(chooserTopics('year4', s)).filter(id => HIDDEN.includes(id)), `Sprint chooser ${s}`).toEqual([]);
      expect(ids(duelChooserTopics(y4, s)).filter(id => HIDDEN.includes(id)), `Duel chooser ${s}`).toEqual([]);
      expect(ids(subjectPool(cur.topicsFor('year4'), s)).filter(id => HIDDEN.includes(id)), `mixed ${s}`).toEqual([]);
    }
    expect(trophyCount(y4, {})).toBe(` · 🏆 0/${before.topicsFor('year4').filter(t => answerableBy(t, 'mixed')).length - 2}`);
    const all = cur.topicsFor('year4');
    for (const [name, pool] of [['Duel', duelPool(all)], ['Daily Sprint', dailySprintPool(all)], ['Daily Ten', dailyTenPool(all)]] as const)
      expect(ids(pool).filter(id => HIDDEN.includes(id)), name).toEqual([]);
    const weakest = Object.fromEntries(HIDDEN.map(id => [id, { stars: 1, best: 1, plays: 9, hits: 0, tries: 50 }]));
    expect(ids(senseiTopics(all, weakest, new Date())).filter(id => HIDDEN.includes(id)), 'Sensei never picks a hidden game, however weak').toEqual([]);
    for (const y of ['year5', 'year6'] as const) {
      expect(ids(gp(y)), `grammar mix ${y}`).toEqual(without(before.grammarPool(Number(y[4]))));
      expect(gp(y).length, 'still offered').toBeGreaterThanOrEqual(GRAMMAR_MIN);
    }
  }));

  it('Tables Check rows go with y4-tables; no other row moves', () => withCatalogue(TEST_CAT, async () => {
    const { islandMenu: im } = await import('../../src/ui/home');
    const { load: ld } = await import('../../src/storage');
    const { mtcOffered: offered } = await import('../../src/game/mtc');
    expect(offered()).toBe(false);
    for (const y of YEARS) expect(ids(menu(im, ld, y).filter(r => r.feeds !== 'none')), y.id).toEqual(without(FED(y.id).map(id => ({ id })), ['mtc', 'mtcpad']));
  }));

  it('every total and unlock counts shown games only; the save keeps the hidden games\' stars', () => withCatalogue(TEST_CAT, async () => {
    const cur = await import('../../src/curriculum');
    const { totalStarsOf } = await import('../../src/game/belts');
    const { masterProgress } = await import('../../src/game/sensei');
    const { parentSummary } = await import('../../src/game/parents');
    const st = await import('../../src/storage');
    const { islandComplete } = await import('../../src/storage/stickers');
    expect(ids(cur.listedTopics())).toEqual(without(CORE));
    st.reset();
    for (const t of before.topicsFor('year4')) st.recordTopic(t.id, HIDDEN.includes(t.id) ? 3 : 1, 5);
    const d = st.load();
    const shownY4 = before.topicsFor('year4').length - 2;
    expect(totalStarsOf(d.progress, cur.listedTopics()), 'belts').toBe(shownY4);
    expect(cur.topicsFor('year4').length * 3, 'the map\'s star total').toBe(shownY4 * 3);
    expect(islandComplete(d.progress, 'year4'), 'island complete without the hidden two').toBe(true);
    expect(masterProgress(cur.shownYears().map(y => cur.topicsFor(y.id)), d.progress)).toMatchObject({ done: 1 });
    const sm = parentSummary(d, cur.listedTopics(), cur.shownYears(), 0, new Date(), cur.listedTopics());
    expect([sm.topicsTotal, sm.starsEarned], 'the grown-ups\' summary').toEqual([CORE.length - 2, shownY4]);
    expect(st.ACHIEVEMENTS.find(a => a.id === 'terra')!.progress({ ...d, progress: Object.fromEntries(HIDDEN.map(id => [id, d.progress[id]])) }).done, 'Star 5 topics').toBe(0);
    expect(HIDDEN.map(id => st.load().progress[id]?.stars), 'never removed').toEqual([3, 3]);
    expect([cur.TOPICS.length, cur.TOPICS.findIndex(t => t.id === 'y4-tables')], 'TOPICS stays whole, in order').toEqual([TOPICS.length, TOPICS.findIndex(t => t.id === 'y4-tables')]);
    expect(HIDDEN.map(id => cur.topicById(id)?.id)).toEqual(HIDDEN);
  }));

  it('a hidden drill leaves the drills and the chooser', () => withCatalogue(copy(c => { c.games['y4-tables-6'].visible = false; }), async () => {
    const cur = await import('../../src/curriculum');
    const { chooserTopics } = await import('../../src/ui/chooser');
    expect(ids(cur.drillsFor('year4'))).toEqual(without(before.drillsFor('year4'), ['y4-tables-6']));
    expect(ids(chooserTopics('year4', 'maths'))).not.toContain('y4-tables-6');
  }));
});

describe('a pool the catalogue empties hides its entry point (#2196)', () => {
  it('an island left with only tracing and story games offers no mixed mode and no Duel, and still shows', () => {
    const mixable = before.topicsFor('reception').filter(t => answerableBy(t, 'mixed')).map(t => t.id);
    return withCatalogue(copy(c => { for (const id of mixable) c.games[id].visible = false; }), async () => {
      const cur = await import('../../src/curriculum');
      const { islandMenu: im } = await import('../../src/ui/home');
      const { load: ld } = await import('../../src/storage');
      expect(ids(cur.topicsFor('reception')), 'the story and tracing games are left').toEqual(['r-storytime', 'r-trace']);
      expect(cur.shownYears().map(y => y.id)).toContain('reception');
      expect(ids(menu(im, ld, { id: 'reception' })), 'every row id, so a renamed or new mixed row shows up here').toEqual(['memory']);
    });
  });
  it('a hidden island lists nothing', () => withCatalogue(copy(c => { c.years.year2.visible = false; }), async () => {
    const cur = await import('../../src/curriculum');
    expect([cur.topicsFor('year2'), cur.drillsFor('year2'), cur.listedTopics().filter(t => t.year === 'year2')]).toEqual([[], [], []]);
  }));
});

/**
 * The static rail (#2196): a list built straight from the registry skips the catalogue. Every use of `TOPICS` or
 * `CORE_TOPICS` as a list (called on, spread, looped, passed as an argument, copied or assigned to a name), and every
 * `topicById` pool (`.map(topicById)` or `.map(id => topicById(id))`), outside `src/curriculum/index.ts` is on this list with
 * its reason; anything else reads `topicsFor`/`drillsFor`/`listedTopics` or applies `isGameShown`.
 */
const LIST_USE = /\b(?:CORE_)?TOPICS\s*\.\s*(?:filter|find|findIndex|findLast|findLastIndex|some|every|map|flatMap|forEach|reduce)\b|\bof\s+(?:CORE_)?TOPICS\b|\.\.\.\s*(?:CORE_)?TOPICS\b|\.map\(\s*topicById\s*\)|\b(?:CORE_)?TOPICS\s*\.\s*(?:slice|concat|values|entries)\b|\bArray\s*\.\s*from\(\s*(?:CORE_)?TOPICS\b|[(,]\s*(?:CORE_)?TOPICS\s*[,)]|=\s*(?:CORE_)?TOPICS\s*(?:;|$)|\.map\(\s*\(?\s*\w+\s*\)?\s*=>\s*topicById\(/gm;
const ALLOWED: Record<string, string> = {
  '/src/game/sprint-pools.ts': 'grammarPool looks its ids up with topicById and applies isGameShown itself',
  '/src/deeplink-open.ts': 'a link resolves every registry id so a hidden game gets its notice (#2197); takeLink then applies gameHidden',
  '/src/ui/parents-catalogue.ts': 'the grown-ups settings list every game of a year, hidden ones too, so a hidden game can be switched back on (#2200)',
};

describe('a subject with no shown game draws no tab (#2238)', () => {
  const WRITING = CORE_TOPICS.filter(t => t.year === 'year1' && t.subject === 'writing').map(t => t.id);
  const NO_WRITING = copy(c => { for (const id of WRITING) c.games[id].visible = false; });
  it('the committed catalogue draws both tabs on every island', () => {
    for (const y of YEARS) expect(islandSubjects(y.id), y.id).toEqual(['maths', 'writing']);
  });
  it('Year 1 with every writing game hidden keeps Maths only, and its mixed rows stay maths', () => withCatalogue(NO_WRITING, async () => {
    const { islandSubjects: subjects, islandMenu: im } = await import('../../src/ui/home');
    const { subjectPool } = await import('../../src/game/pools');
    const cur = await import('../../src/curriculum');
    expect(subjects('year1')).toEqual(['maths']);
    expect(subjects('year2')).toEqual(['maths', 'writing']);
    expect(cur.topicsFor('year1', 'writing')).toEqual([]);
    expect(subjectPool(cur.topicsFor('year1'), 'maths').every(t => t.subject === 'maths')).toBe(true);
    const { load: ld } = await import('../../src/storage');
    expect(ids(menu(im, ld, { id: 'year1' })).length).toBeGreaterThan(0);
  }));
  it('startFirstMission falls back to writing, then to the island, never a silent map', () => {
    const src = SOURCES['/src/main.ts'];
    expect(src).toMatch(/\['maths', 'writing'\] as const\)\.flatMap\(s => topicsFor\(y\.id, s\)\)/);
    expect(src).toMatch(/if \(!topic\) \{ nav\.island\(y\); return; \}/);
  });
});

describe('guard rail: no list is built from the registry directly (#2196)', () => {
  const hits = Object.entries(SOURCES).filter(([f]) => f !== '/src/curriculum/index.ts')
    .map(([f, src]) => [f, code(src).match(LIST_USE) ?? []] as const).filter(([, m]) => m.length);
  it('every use is on the allow-list', () => {
    expect(hits.filter(([f]) => !ALLOWED[f]).map(([f, m]) => `${f}: ${m.join(', ')}`)).toEqual([]);
  });
  it('every allow-list entry is still used, so the list stays short', () => {
    expect(Object.keys(ALLOWED).filter(f => !hits.some(([h]) => h === f))).toEqual([]);
  });
  it('the pattern catches each shape it names', () => {
    for (const s of ['TOPICS.filter(t => t)', 'CORE_TOPICS.find(x)', 'for (const t of TOPICS)', '[...TOPICS]', 'ids.map(topicById)',
      'totalStarsOf(d.progress, CORE_TOPICS)', 'duelPool(TOPICS)', 'senseiTopics(CORE_TOPICS, p, now)', 'const all = TOPICS;', 'let all = CORE_TOPICS',
      'TOPICS.slice()', 'CORE_TOPICS.concat(x)', 'Array.from(TOPICS)', 'ids.map(id => topicById(id))', 'ids.map((id) => topicById(id)!)'])
      expect(s.match(LIST_USE), s).not.toBeNull();
    for (const s of ['YEAR4_TOPICS.filter(t => t)', 'TOPICS[c.topic]', 'TOPICS.indexOf(t)',
      'import { CORE_TOPICS, TOPICS } from', 'const x = TOPICS[id];', 'ids.map(id => topicsFor(id))']) expect(s.match(LIST_USE), s).toBeNull();
  });
});
