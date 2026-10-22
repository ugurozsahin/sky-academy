// #2195: an island's `years.<id>.visible` in the catalogue decides whether the map shows it — `"auto"` is the
// topic-count gate (#1032), `true` always shows it, `false` always hides it — and every reward and dashboard
// total follows, because they all read `shownYears()`.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { RuntimeCatalogue } from '../../src/config/catalogue';
import { RUNTIME } from '../../src/config/resolve';
import { SHOWN_YEARS_KEY, TOPICS, YEARS, shownYears, type YearId } from '../../src/curriculum';
import { placementYear, yearIdFromLevel } from '../../src/school-year';

type Mut = { years: Record<string, { visible: 'auto' | boolean }>; games: Record<string, { visible: boolean; years: Record<string, { visible: boolean }> }> };
/** A test copy of the committed runtime catalogue, edited. */
const copy = (edit: (c: Mut) => void): RuntimeCatalogue => { const c = structuredClone(RUNTIME) as unknown as Mut; edit(c); return c as unknown as RuntimeCatalogue; };
const ids = (cat?: RuntimeCatalogue) => shownYears(cat).map(y => y.id);
const ALL: YearId[] = ['reception', 'year1', 'year2', 'year3', 'year4', 'year5', 'year6'];

const mem: Record<string, string> = {};
beforeEach(() => {
  for (const k in mem) delete mem[k];
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } });
});
afterEach(() => vi.unstubAllGlobals());

describe('shownYears follows years.<id>.visible (#2195)', () => {
  it('the committed file is "auto" everywhere, and shows exactly today\'s islands', () => {
    expect(Object.values(RUNTIME.years).map(y => y.visible)).toEqual(ALL.map(() => 'auto'));
    expect(ids()).toEqual(ALL);
    expect(ids(RUNTIME)).toEqual(ALL);
  });

  it('"auto": a KS2 island under the topic-count gate is hidden, as today', () => {
    const maths = TOPICS.filter(t => t.year === 'year3' && t.subject === 'maths' && !t.drill);
    const under = copy(c => { for (const t of maths.slice(11)) c.games[t.id].visible = false; });
    expect(ids(under)).toEqual(ALL.filter(y => y !== 'year3'));
  });

  it('true: shows an island the gate would hide', () => {
    const maths = TOPICS.filter(t => t.year === 'year3' && t.subject === 'maths' && !t.drill);
    const forced = copy(c => { for (const t of maths.slice(11)) c.games[t.id].visible = false; c.years.year3.visible = true; });
    expect(ids(forced)).toEqual(ALL);
  });

  it('false: hides an island the gate would show, EYFS/KS1 included', () => {
    expect(ids(copy(c => { c.years.year2.visible = false; }))).toEqual(ALL.filter(y => y !== 'year2'));
    expect(ids(copy(c => { c.years.reception.visible = false; c.years.year5.visible = false; })))
      .toEqual(['year1', 'year2', 'year3', 'year4', 'year6']);
  });

  it('true never shows an island with no game on: there would be nothing to play', () => {
    const empty = copy(c => { c.years.year1.visible = true; for (const t of TOPICS.filter(t => t.year === 'year1')) c.games[t.id].years.year1.visible = false; });
    expect(ids(empty)).toEqual(ALL.filter(y => y !== 'year1'));
  });

  it('returns YEARS rows in YEARS order, whatever the catalogue\'s key order', () => {
    const reversed = copy(c => { c.years = Object.fromEntries(Object.entries(c.years).reverse()); });
    expect(Object.keys(reversed.years)[0]).toBe('year6');
    expect(shownYears(reversed)).toEqual(YEARS);
  });

  it('the preview key still shows every island, even one the file sets to false', () => {
    mem[SHOWN_YEARS_KEY] = 'all';
    expect(shownYears(copy(c => { c.years.year2.visible = false; }))).toEqual(YEARS);
  });
});

describe('a saved school year whose island is hidden falls back as a gated year does (#1055, #2195)', () => {
  const noYear2 = () => shownYears(copy(c => { c.years.year2.visible = false; }));
  it('placement and the birthday helper land on the nearest shown year below', () => {
    expect(placementYear({ ks2: { schoolYear: 'year2' } }, noYear2())).toBe('year1');
    expect(yearIdFromLevel(2, noYear2())).toBe('year1');
    expect(placementYear({ ks2: { schoolYear: 'year3' } }, noYear2()), 'a shown year is kept').toBe('year3');
  });
  it('with nothing shown at or below it, placement is unset (the first mission then takes the first shown island)', () => {
    expect(placementYear({ ks2: { schoolYear: 'reception' } }, shownYears(copy(c => { c.years.reception.visible = false; })))).toBeUndefined();
  });
});

describe('a year set to false leaves the map and every reward total (#2195)', () => {
  it('the map\'s islands, listedTopics, belts, stickers, Master Ninja and the parents\' summary all drop year2', async () => {
    vi.resetModules();
    vi.doMock('../../src/config/catalogue.runtime.json', () => ({ default: copy(c => { c.years.year2.visible = false; }) }));
    try {
      const cur = await import('../../src/curriculum');
      const { islandsHTML } = await import('../../src/ui/map-layout');
      const { totalStarsOf } = await import('../../src/game/belts');
      const { masterProgress } = await import('../../src/game/sensei');
      const { parentSummary } = await import('../../src/game/parents');
      const st = await import('../../src/storage');

      const shown = cur.shownYears();
      expect(shown.map(y => y.id)).toEqual(ALL.filter(y => y !== 'year2'));
      const map = islandsHTML(shown, () => ({ s: 0, m: 0 }), undefined, false);
      expect(map).not.toContain('data-year="year2"');
      expect(map).toContain('data-year="year1"');
      expect(cur.listedTopics().some(t => t.year === 'year2')).toBe(false);

      st.reset();
      st.recordTopic('r-count', 1, 5); st.recordTopic('y1-bonds', 1, 5); st.recordTopic('y2-tables', 3, 5);
      const d = st.load();
      expect(totalStarsOf(d.progress, cur.listedTopics()), 'the year2 stars count toward no belt').toBe(2);
      expect(st.evaluateStickers(d), 'two shown islands with a star, not three').not.toContain('gust');
      const sm = parentSummary(d, cur.listedTopics(), shown, 0, new Date(), cur.listedTopics());
      expect(sm.starsEarned).toBe(2);
      expect(sm.years.map(y => y.id)).toEqual(ALL.filter(y => y !== 'year2'));
      expect(sm.noTrophy.some(r => r.year === 'year2')).toBe(false);
      expect(sm.topicsTotal).toBe(cur.listedTopics().length);

      const threeIslands = Object.fromEntries(cur.TOPICS.filter(t => ['reception', 'year1', 'year2'].includes(t.year)).map(t => [t.id, { stars: 1, best: 5, plays: 1 }]));
      expect(masterProgress(shown.map(y => cur.topicsFor(y.id)), threeIslands), 'a fully starred hidden island is not one of the three')
        .toMatchObject({ done: 2, unlocked: false });
    } finally {
      vi.doUnmock('../../src/config/catalogue.runtime.json');
      vi.resetModules();
    }
  });
});
